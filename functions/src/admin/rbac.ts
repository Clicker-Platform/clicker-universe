import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

/**
 * Sets custom claims for a user (Role-Based Access Control)
 * @param data { uid: string, claims: object }
 */
export const setCustomClaims = functions.https.onCall(async (request) => {
    // 1. Security Check: Must be Superadmin
    if (!request.auth || request.auth.token.role !== 'superadmin') {
        const SUPER_ADMIN_EMAIL = 'clickerplatform@gmail.com';
        if (!request.auth?.token.email || request.auth.token.email !== SUPER_ADMIN_EMAIL) {
            throw new functions.https.HttpsError('permission-denied', 'Only Superadmins can manage roles.');
        }
    }

    const { uid, claims } = request.data;
    if (!uid || !claims) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing uid or claims.');
    }

    // 2. Security Check: Prevent modification of the Root Superadmin
    try {
        const targetUser = await admin.auth().getUser(uid);
        const SUPER_ADMIN_EMAIL = 'clickerplatform@gmail.com';
        if (targetUser.email === SUPER_ADMIN_EMAIL) {
            throw new functions.https.HttpsError('permission-denied', 'The Root Superadmin cannot be modified.');
        }
    } catch (error: any) {
        // Pass through if it is the permission denied error we just threw
        if (error.code === 'functions/permission-denied') throw error;
        // Ignore user-not-found here as setCustomUserClaims would fail anyway, or handle it gracefully
    }

    try {
        await admin.auth().setCustomUserClaims(uid, claims);
        return { message: `Claims updated for user ${uid}`, claims };
    } catch (error: any) {
        throw new functions.https.HttpsError('internal', error.message);
    }
});

/**
 * Get User Record by Email (for admin lookup)
 * @param data { email: string }
 */
export const getUserByEmail = functions.https.onCall(async (request) => {
    if (!request.auth || request.auth.token.role !== 'superadmin') {
        const SUPER_ADMIN_EMAIL = 'clickerplatform@gmail.com';
        if (!request.auth?.token.email || request.auth.token.email !== SUPER_ADMIN_EMAIL) {
            throw new functions.https.HttpsError('permission-denied', 'Access denied.');
        }
    }

    const { email } = request.data;
    if (!email) {
        throw new functions.https.HttpsError('invalid-argument', 'Email is required.');
    }

    try {
        const userRecord = await admin.auth().getUserByEmail(email);
        return {
            uid: userRecord.uid,
            email: userRecord.email,
            displayName: userRecord.displayName,
            customClaims: userRecord.customClaims
        };
    } catch (error: any) {
        if (error.code === 'auth/user-not-found') {
            throw new functions.https.HttpsError('not-found', 'User not found.');
        }
        throw new functions.https.HttpsError('internal', error.message);
    }
});
