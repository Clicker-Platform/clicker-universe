import * as admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';

function getAdminApp(): admin.app.App {
    if (admin.apps.length > 0) return admin.apps[0]!;

    const keyPath = process.env.GCP_SERVICE_ACCOUNT_KEY;
    if (keyPath) {
        const resolvedPath = path.resolve(process.cwd(), keyPath);
        if (fs.existsSync(resolvedPath)) {
            const serviceAccount = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
            return admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
            });
        }
    }

    // Production: use Application Default Credentials
    return admin.initializeApp({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    });
}

export const adminApp = getAdminApp();
export const adminAuth = admin.auth(adminApp);
