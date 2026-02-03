import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

// DEBUG: Force Emulator usage if detecting local environment
// This solves the issue where Admin SDK tries to hit Production Auth
if (process.env.FUNCTIONS_EMULATOR === 'true' || process.env.NODE_ENV === 'development') {
    process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
    process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
    console.log('🔧 [God Mode] Forcing Admin SDK to use Emulators at 127.0.0.1');
}

// Initialize Firebase Admin SDK once at module load
// Use Application Default Credentials (ADC) which automatically works in Cloud Functions
// This completely avoids the service account file loading issue
if (!admin.apps.length) {
    admin.initializeApp();
    console.log('✅ [Auth] Firebase Admin SDK initialized with Application Default Credentials.')
}

// Generate Handoff Token for cross-app authentication
export const generateHandoffToken = functions.https.onCall(async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in to generate handoff token.');
    }

    try {
        const uid = request.auth.uid;

        // Fetch user record to get existing custom claims
        const userRecord = await admin.auth().getUser(uid);
        const claims = userRecord.customClaims || {};

        console.log(`👤 Generating token for ${uid} with claims:`, claims);

        // Create custom token WITH claims using the runtime service account
        // NOTE: The service account (1065982109250-compute@developer.gserviceaccount.com)
        // must have "Service Account Token Creator" role granted
        const customToken = await admin.auth().createCustomToken(uid, claims);

        console.log(`✅ Successfully created custom token for UID: ${uid}`);
        return { token: customToken };
    } catch (error: any) {
        console.error("❌ Error generating handoff token:", error);
        console.error("Error details:", {
            code: error.code,
            message: error.message,
            stack: error.stack
        });
        throw new functions.https.HttpsError('internal', error.message);
    }
});

export const createUser = functions.https.onCall(async (request) => {
    // Basic security: Ensure requester is authenticated (and ideally is an admin)
    const { email, password, displayName, role } = request.data;
    const SUPER_ADMIN_EMAIL = 'clickerplatform@gmail.com';

    // Basic security: Ensure requester is authenticated (and ideally is an admin)
    // EXCEPTION: Allow creating the specific super admin user without auth (Bootstrap)
    if (!request.auth && email !== SUPER_ADMIN_EMAIL) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'The function must be called while authenticated.'
        );
    }

    // In a real scenario, you should check for custom claims here
    // if (context.auth.token.role !== 'admin') { ... }


    if (!email || !password) {
        throw new functions.https.HttpsError(
            'invalid-argument',
            'Email and password are required.'
        );
    }

    try {
        const userRecord = await admin.auth().createUser({
            email,
            password,
            displayName,
            emailVerified: true // God mode: Auto verify
        });

        // Set custom claims if role is provided OR if it matches the Super Admin email
        const SUPER_ADMIN_EMAIL = 'clickerplatform@gmail.com';
        if (role || email === SUPER_ADMIN_EMAIL) {
            const finalRole = (email === SUPER_ADMIN_EMAIL) ? 'superadmin' : role;
            await admin.auth().setCustomUserClaims(userRecord.uid, { role: finalRole });
        }

        return { userId: userRecord.uid, message: 'User created successfully.' };
    } catch (error: any) {
        console.error("Error creating user:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
        throw new functions.https.HttpsError('internal', `Failed to create user: ${error.message} (Code: ${error.code})`);
    }
});

// God Mode: Delete User
export const deleteUser = functions.https.onCall(async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'The function must be called while authenticated.'
        );
    }

    const { uid } = request.data;

    if (!uid) {
        throw new functions.https.HttpsError(
            'invalid-argument',
            'UID is required.'
        );
    }

    try {
        await admin.auth().deleteUser(uid);
        // Optional: Delete user data from Firestore
        // await admin.firestore().collection('users').doc(uid).delete();

        return { message: 'User deleted successfully.' };
    } catch (error: any) {
        console.error("Error deleting user:", error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

// God Mode: List Users (Simple version)
export const listUsers = functions.https.onCall(async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Auth required');
    }

    try {
        const listUsersResult = await admin.auth().listUsers(100);
        return { users: listUsersResult.users };
    } catch (error: any) {
        throw new functions.https.HttpsError('internal', error.message);
    }
});

export { createTenant, suspendTenant, getTenants, updateTenantModules } from './admin/tenant';
export * from './admin/rbac';
export * from './admin/system';
export { seedSiteData } from './admin/site';
