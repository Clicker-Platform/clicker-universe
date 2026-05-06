import * as admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';

function getAdminApp(): admin.app.App {
    if (admin.apps.length > 0) return admin.apps[0]!;

    const keyEnv = process.env.GCP_SERVICE_ACCOUNT_KEY;
    if (keyEnv) {
        // Cloud Run/Secret Manager: value is JSON string
        if (keyEnv.trim().startsWith('{')) {
            const serviceAccount = JSON.parse(keyEnv);
            return admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
            });
        }
        // Local dev: value is a file path
        const resolvedPath = path.resolve(process.cwd(), keyEnv);
        if (fs.existsSync(resolvedPath)) {
            const serviceAccount = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
            return admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
            });
        }
    }

    // Fallback: Application Default Credentials
    return admin.initializeApp({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    });
}

export const adminApp = getAdminApp();
export const adminAuth = admin.auth(adminApp);
