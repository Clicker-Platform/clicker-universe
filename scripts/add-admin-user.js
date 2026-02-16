const admin = require('firebase-admin');
const serviceAccount = require('../clicker-universe-firebase-adminsdk-fbsvc-cd9dacac7e.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const SITE_ID = 'kasisehat';
const USER_EMAIL = 'hi+2@clicker.id'; // Replace with correct email if different
// We need UID. We can fetch it by email.

async function addUserToSite() {
    console.log(`👤 Adding user [${USER_EMAIL}] to site [${SITE_ID}]...`);

    try {
        const userRecord = await admin.auth().getUserByEmail(USER_EMAIL);
        const uid = userRecord.uid;
        console.log(`   - Found UID: ${uid}`);

        const userRef = db.collection('sites').doc(SITE_ID).collection('users').doc(uid);

        // Check if already exists
        const doc = await userRef.get();
        if (doc.exists) {
            console.log(`   - User already exists in site. Updating role just in case.`);
        }

        await userRef.set({
            email: USER_EMAIL,
            role: 'owner', // Give full access
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            displayName: userRecord.displayName || 'Admin'
        }, { merge: true });

        console.log(`✅ User added as Owner to ${SITE_ID}.`);
        console.log(`👉 Please access: https://${SITE_ID}.clicker.id/admin`);

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

addUserToSite().catch(console.error);
