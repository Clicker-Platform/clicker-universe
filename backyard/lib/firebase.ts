
'use client';

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app);

// Connect to Emulators in Development
// WARNING: This must match the ports defined in firebase.json
// if (process.env.NODE_ENV === 'development') {
//     // Prevent multiple connections in React Strict Mode
//     // @ts-ignore
//     if (!global._firebase_emulators_connected) {
//         console.log('🔥 [Backyard] Connecting to Firebase Emulators...');
//
//         connectAuthEmulator(auth, 'http://localhost:9099');
//         connectFirestoreEmulator(db, 'localhost', 8080);
//         connectFunctionsEmulator(functions, 'localhost', 5001);
//
//         // @ts-ignore
//         global._firebase_emulators_connected = true;
//     }
// }

export { app, auth, db, functions };
