import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

/**
 * Firebase Client SDK configuration.
 * Uses environment variables for flexibility across environments.
 */
const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
if (typeof window !== 'undefined') {
    console.log('[Firebase Gateway] Initialized with config:', {
        projectId: firebaseConfig.projectId,
        authDomain: firebaseConfig.authDomain
    });
}
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

export { app, db, auth, storage };

// Functions instance for Handoff
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";
const functions = getFunctions(app, 'us-central1');

import { connectAuthEmulator } from "firebase/auth";
import { connectFirestoreEmulator } from "firebase/firestore";

// Connect to emulators if in localhost/dev context
// if (process.env.NODE_ENV === 'development') {
//     // @ts-ignore
//     if (!auth.emulatorConfig) {
//         connectAuthEmulator(auth, "http://localhost:9099");
//         connectFunctionsEmulator(functions, "localhost", 5001);
//         connectFirestoreEmulator(db, 'localhost', 8080);
//         console.log("🔥 [AuthGateway] Connected to Firebase Emulators");
//     }
// }

export { functions };
