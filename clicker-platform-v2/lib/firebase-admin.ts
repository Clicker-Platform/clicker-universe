import { initializeApp, getApps, App, getApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

/**
 * Firebase Admin SDK initialization for server-side operations.
 * 
 * CORE STRATEGY: "Hybrid Identity"
 * 1. PRODUCTION: Use Application Default Credentials (ADC) - No keys needed.
 * 2. LOCAL DEV: Optionally use GCP_SERVICE_ACCOUNT_KEY if ADC (gcloud) is not set up.
 */

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
                // Resolve path relative to cwd if needed, though absolute/relative usually works as is in node
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

