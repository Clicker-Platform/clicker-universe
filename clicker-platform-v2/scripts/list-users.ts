
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: '.env.local' });

function initializeAdmin() {
    if (getApps().length > 0) return getApps()[0];
    const serviceAccountKeyPath = process.env.GCP_SERVICE_ACCOUNT_KEY;
    if (serviceAccountKeyPath && fs.existsSync(serviceAccountKeyPath)) {
        const credential = JSON.parse(fs.readFileSync(serviceAccountKeyPath, 'utf8'));
        return initializeApp({ credential: cert(credential) });
    }
    return initializeApp();
}

const app = initializeAdmin();
const auth = getAuth(app);

async function listUsers() {
    try {
        const listUsersResult = await auth.listUsers(10);
        listUsersResult.users.forEach((userRecord) => {
            console.log('user', userRecord.uid, userRecord.email, userRecord.displayName);
        });
        process.exit(0);
    } catch (error) {
        console.log('Error listing users:', error);
        process.exit(1);
    }
}

listUsers();
