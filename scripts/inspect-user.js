const admin = require('firebase-admin');
const serviceAccount = require('../clicker-universe-firebase-adminsdk-fbsvc-cd9dacac7e.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const emailsToCheck = ['hi+1@clicker.id', 'hi+1@clicker'];

async function inspectUsers() {
    console.log('🔍 Inspecting users...');

    for (const email of emailsToCheck) {
        try {
            console.log(`\nChecking email: ${email}`);
            const userRecord = await admin.auth().getUserByEmail(email);
            console.log(`   - UID: ${userRecord.uid}`);
            console.log(`   - Display Name: ${userRecord.displayName}`);
            console.log(`   - Custom Claims:`, JSON.stringify(userRecord.customClaims, null, 2));
        } catch (error) {
            if (error.code === 'auth/user-not-found') {
                console.log(`   - ❌ User not found.`);
            } else {
                console.error(`   - ❌ Error:`, error.message);
            }
        }
    }
}

inspectUsers().catch(console.error);
