/**
 * Firebase Admin SDK initialization for server-side operations.
 *
 * Uses ESM imports (compatible with Next.js 16 + Turbopack).
 * Same pattern as auth-gateway/lib/firebase-admin.ts.
 */
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

import type { App } from 'firebase-admin/app';
import type { Auth } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';
import type { Storage } from 'firebase-admin/storage';

function initializeAdminApp(): App {
    if (admin.apps.length > 0) {
        return admin.apps[0] as App;
    }

    // LOCAL FALLBACK: Check for Service Account Key in env
    const serviceAccountKey = process.env.GCP_SERVICE_ACCOUNT_KEY;

    if (serviceAccountKey) {
        try {
            let credential;

            // Check if it's a file path (starts with / or ./ or ends with .json)
            if (serviceAccountKey.endsWith('.json') || serviceAccountKey.startsWith('/') || serviceAccountKey.startsWith('./')) {
                const keyPath = path.resolve(process.cwd(), serviceAccountKey);
                const keyContent = fs.readFileSync(keyPath, 'utf-8');
                credential = JSON.parse(keyContent);
            } else {
                credential = JSON.parse(serviceAccountKey);
            }

            return admin.initializeApp({
                credential: admin.credential.cert(credential),
                projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
                storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
            }) as App;
        } catch (error) {
            console.error('[firebase-admin] Failed to load/parse GCP_SERVICE_ACCOUNT_KEY:', error);
            // Fallthrough to ADC if key is invalid
        }
    }

    // Initialize with minimal config - ADC handles the credentials automatically
    return admin.initializeApp({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    }) as App;
}

export const adminApp: App = initializeAdminApp();
export const adminAuth: Auth = admin.auth(adminApp);
export const adminDb: Firestore = admin.firestore(adminApp);
export const adminStorage: Storage = admin.storage(adminApp);
export const firebaseAdmin = admin;

export { Timestamp, FieldValue } from 'firebase-admin/firestore';
