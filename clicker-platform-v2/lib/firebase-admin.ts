/**
 * Firebase Admin SDK initialization for server-side operations.
 * 
 * CRITICAL FIX FOR FIREBASE HOSTING:
 * We MUST use a dynamic require() to bypass Turbopack's static analysis.
 * Next.js 15 Turbopack has a bug (#87737) where modules in `serverExternalPackages`
 * get their module IDs mangled in production (e.g., 'firebase-admin-021ca263...').
 * Using a dynamic string prevents Turbopack from seeing the require statement.
 * DO NOT REVERT TO ES6 IMPORTS OR STANDARD REQUIRE. IT WILL BREAK ALL API ROUTES.
 */
import type * as AdminTypes from 'firebase-admin';
const pkgName = 'firebase' + '-admin';
// @ts-ignore
const admin = require(pkgName) as typeof AdminTypes;

const initializeApp = (opts?: any) => admin.initializeApp(opts);
const getApps = () => admin.apps || [];
const cert = (cred: any) => admin.credential.cert(cred);

const getAuth = (app?: any) => admin.auth(app);
const getFirestore = (app?: any) => admin.firestore(app);
const getStorage = (app?: any) => admin.storage(app);

import type { App } from 'firebase-admin/app';
import type { Auth } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';
import type { Storage } from 'firebase-admin/storage';

function initializeAdminApp(): App {
    const apps = getApps();

    // singleton pattern: return existing app if available
    if (apps.length > 0) {
        return apps[0] as App;
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
            }) as App;
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
    }) as App;
}

export const adminApp: App = initializeAdminApp();
export const adminAuth: Auth = getAuth(adminApp);
export const adminDb: Firestore = getFirestore(adminApp);
export const adminStorage: Storage = getStorage(adminApp);
export const firebaseAdmin = admin;
