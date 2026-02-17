/**
 * Firebase Admin SDK initialization for server-side operations.
 * 
 * IMPORTANT: Uses dynamic require() to bypass Turbopack's static analysis
 * which otherwise generates hashed module identifiers that fail at runtime
 * in Firebase Cloud Functions. This is a known Turbopack bug (#87737).
 * 
 * CORE STRATEGY: "Hybrid Identity"
 * 1. PRODUCTION: Use Application Default Credentials (ADC) - No keys needed.
 * 2. LOCAL DEV: Optionally use GCP_SERVICE_ACCOUNT_KEY if ADC (gcloud) is not set up.
 */

// Dynamic require to prevent Turbopack from hashing the module name
// eslint-disable-next-line @typescript-eslint/no-require-imports
const firebaseAdminApp = require('firebase-admin/app') as typeof import('firebase-admin/app');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const firebaseAdminAuth = require('firebase-admin/auth') as typeof import('firebase-admin/auth');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const firebaseAdminFirestore = require('firebase-admin/firestore') as typeof import('firebase-admin/firestore');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const firebaseAdminStorage = require('firebase-admin/storage') as typeof import('firebase-admin/storage');

const { initializeApp, getApps, cert } = firebaseAdminApp;
const { getAuth } = firebaseAdminAuth;
const { getFirestore } = firebaseAdminFirestore;
const { getStorage } = firebaseAdminStorage;

import type { App } from 'firebase-admin/app';

function initializeAdminApp(): App {
    const apps = getApps();

    // singleton pattern: return existing app if available
    if (apps.length > 0) {
        return apps[0];
    }

    // LOCAL FALLBACK: Check for Service Account Key in env
    const serviceAccountKey = process.env.GCP_SERVICE_ACCOUNT_KEY;

    if (serviceAccountKey) {
        try {
            console.log('[firebase-admin] Found GCP_SERVICE_ACCOUNT_KEY. Initializing...');
            let credential;

            // Check if it's a file path (starts with / or ./ or ends with .json)
            if (serviceAccountKey.endsWith('.json') || serviceAccountKey.startsWith('/') || serviceAccountKey.startsWith('./')) {
                console.log('[firebase-admin] Reading credentials from file:', serviceAccountKey);
                const fs = require('fs');
                const path = require('path');
                const keyPath = path.resolve(process.cwd(), serviceAccountKey);
                const keyContent = fs.readFileSync(keyPath, 'utf-8');
                credential = JSON.parse(keyContent);
            } else {
                console.log('[firebase-admin] Parsing credentials from JSON string...');
                credential = JSON.parse(serviceAccountKey);
            }

            return initializeApp({
                credential: cert(credential),
                projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
                storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
            });
        } catch (error) {
            console.error('[firebase-admin] Failed to load/parse GCP_SERVICE_ACCOUNT_KEY:', error);
            // Fallthrough to ADC if key is invalid
        }
    }

    console.log('[firebase-admin] Initializing with ADC (Production/Cloud Mode)...');

    // Initialize with minimal config - ADC handles the credentials automatically
    return initializeApp({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    });
}

export const adminApp = initializeAdminApp();
export const adminAuth = getAuth(adminApp);
export const adminDb = getFirestore(adminApp);
export const adminStorage = getStorage(adminApp);
