import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

// DEBUG: Force Emulator usage if detecting local environment
// This solves the issue where Admin SDK tries to hit Production Auth
if (process.env.FUNCTIONS_EMULATOR === 'true' || process.env.NODE_ENV === 'development') {
    process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
    process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
    console.log('🔧 [God Mode] Forcing Admin SDK to use Emulators at 127.0.0.1');
}

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
    const projectId = process.env.GCLOUD_PROJECT || 'clicker-universe';
    console.log(`🚀 [System] Initializing Admin SDK for Project: ${projectId}`);

    try {
        // Dynamic loading of service account JSON for Staging/Prod
        // This solves the 'signBlob' permission issue by signing tokens locally with private key
        let serviceAccount: any = null;

        if (projectId === 'clicker-universe-stagging') {
            try {
                serviceAccount = require('../service-account-staging.json');
                console.log('📂 [Auth] Loaded Staging Service Account JSON.');
            } catch (e) {
                console.warn('⚠️ [Auth] Staging JSON not found, falling back to ADC.');
            }
        } else if (projectId === 'clicker-universe') {
            try {
                serviceAccount = require('../service-account-prod.json');
                console.log('📂 [Auth] Loaded Production Service Account JSON.');
            } catch (e) {
                console.warn('⚠️ [Auth] Production JSON not found, falling back to ADC.');
            }
        }

        if (serviceAccount) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                databaseURL: `https://${projectId}.firebaseio.com`,
                storageBucket: `${projectId}.firebasestorage.app`,
            });
            console.log(`✅ [Auth] Firebase Admin SDK initialized with Service Account JSON: ${serviceAccount.client_email}`);
        } else {
            admin.initializeApp();
            console.log('✅ [Auth] Firebase Admin SDK initialized with Application Default Credentials (ADC).');
        }
    } catch (error) {
        console.error('❌ [Auth] Admin SDK Initialization Failed:', error);
        admin.initializeApp(); // Last ditch fallback
    }
}

// Generate Handoff Token for cross-app authentication
export const generateHandoffToken = functions.https.onCall(async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    }
    try {
        const customToken = await admin.auth().createCustomToken(request.auth.uid);
        return { token: customToken };
    } catch (error: any) {
        throw new functions.https.HttpsError('internal', error.message);
    }
});

export const createUser = functions.https.onCall(async (request) => {
    // Basic security: Ensure requester is authenticated (and ideally is an admin)
    const { email, password, displayName, role, siteId, permissions, moduleAccess } = request.data;
    const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL;

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


    if (!email) {
        throw new functions.https.HttpsError(
            'invalid-argument',
            'Email is required.'
        );
    }

    try {
        let userRecord;
        let isNewUser = false;

        try {
            // 1. Try to fetch existing user
            userRecord = await admin.auth().getUserByEmail(email);
            console.log(`[createUser] Found existing user: ${userRecord.uid}`);
        } catch (error: any) {
            if (error.code === 'auth/user-not-found') {
                // 2. If not found, create new user
                if (!password) {
                    throw new functions.https.HttpsError(
                        'invalid-argument',
                        'Password is required for new users.'
                    );
                }
                userRecord = await admin.auth().createUser({
                    email,
                    password,
                    displayName,
                    emailVerified: true
                });
                isNewUser = true;
                console.log(`[createUser] Created new user: ${userRecord.uid}`);
            } else {
                throw error;
            }
        }

        // 3. Prepare Claims
        // Get existing claims if any (to avoid overwriting other potential claims if we were to support multi-tenancy more purely, but here we overwrite siteId)
        const currentClaims = userRecord.customClaims || {};
        const newClaims: Record<string, any> = { ...currentClaims };

        if (role) newClaims.role = role;
        if (siteId) newClaims.siteId = siteId;

        // Force Superadmin logic
        if (email === SUPER_ADMIN_EMAIL) {
            newClaims.role = 'superadmin';
            // Optional: maybe remove siteId for superadmin? 
            // newClaims.siteId = null; 
        }

        // 4. Update Claims
        await admin.auth().setCustomUserClaims(userRecord.uid, newClaims);

        // 5. Sync with Firestore (Platform V2 Compatibility)
        if (siteId) {
            const memberData: any = {
                uid: userRecord.uid,
                email: userRecord.email,
                displayName: userRecord.displayName || displayName || '',
                role: role || 'staff', // Default to staff
                status: 'active',
                joinedAt: admin.firestore.FieldValue.serverTimestamp(),
            };

            // Only update permissions if provided, otherwise default to empty for new users
            if (permissions !== undefined) memberData.permissions = permissions;
            else if (isNewUser) memberData.permissions = [];

            if (moduleAccess !== undefined) memberData.moduleAccess = moduleAccess;
            else if (isNewUser) memberData.moduleAccess = {};


            // Log for debugging
            console.log('[createUser] Syncing to Firestore:', `sites/${siteId}/members/${userRecord.uid}`, memberData);

            await admin.firestore()
                .collection('sites')
                .doc(siteId)
                .collection('members')
                .doc(userRecord.uid)
                .set(memberData, { merge: true }); // Merge to avoid overwriting existing detailed permissions if any
        }

        return {
            userId: userRecord.uid,
            isNewUser,
            message: isNewUser ? 'User created successfully.' : 'Existing user updated with new access.'
        };

    } catch (error: any) {
        console.error("Error creating/updating user:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
        throw new functions.https.HttpsError('internal', `Failed to process user: ${error.message}`);
    }
});

// Remove user from a specific site (removes claims and Firestore doc)
export const removeUserFromSite = functions.https.onCall(async (request) => {
    if (!request.auth) throw new functions.https.HttpsError('unauthenticated', 'Auth required');

    const { uid, siteId } = request.data;
    if (!uid || !siteId) throw new functions.https.HttpsError('invalid-argument', 'UID and Site ID required');

    try {
        // 1. Remove Firestore Document
        await admin.firestore()
            .collection('sites')
            .doc(siteId)
            .collection('members')
            .doc(uid)
            .delete();

        // 2. Update Claims (Remove role and siteId)
        const userRecord = await admin.auth().getUser(uid);
        const currentClaims = userRecord.customClaims || {};

        // Remove siteId if it matches
        if (currentClaims.siteId === siteId) {
            delete currentClaims.siteId;
            delete currentClaims.role; // Also remove role context
            await admin.auth().setCustomUserClaims(uid, currentClaims);
        }

        return { message: 'User removed from site successfully.' };
    } catch (error: any) {
        console.error("Error removing user:", error);
        throw new functions.https.HttpsError('internal', error.message);
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

// Sync site "go" dari staging → production secara realtime
export {
    syncGoFirestore,
    syncGoFirestoreDeep,
    syncGoFirestoreLevel3,
    syncGoStorageUpload,
    syncGoStorageDelete,
} from './sync-to-prod';

// Monitoring
export { getPosthogStats } from './monitoring/getPosthogStats';
export { retentionCleanup, triggerRetentionCleanup } from './scheduled/retentionCleanup';
