const admin = require('firebase-admin');
const serviceAccount = require('../clicker-universe-firebase-adminsdk-fbsvc-cd9dacac7e.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const SITE_ID = 'kasisehat';
const USER_EMAIL = 'hi+2@clicker.id';

async function fixSiteOwner() {
    console.log(`🔧 Fixing owner for site [${SITE_ID}]...`);

    try {
        const userRecord = await admin.auth().getUserByEmail(USER_EMAIL);
        const uid = userRecord.uid;
        console.log(`   - Found UID: ${uid}`);

        const siteRef = db.collection('sites').doc(SITE_ID);

        // 1. Update Main Site Doc (Owner Fields)
        console.log('   - Updating site ownerId and ownerEmail...');
        await siteRef.set({
            ownerId: uid,
            ownerEmail: USER_EMAIL
        }, { merge: true });

        // 2. Add to 'members' collection (consistency with getUserSites)
        console.log("   - Adding to 'members' collection...");
        await siteRef.collection('members').doc(uid).set({
            email: USER_EMAIL,
            role: 'owner',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            displayName: userRecord.displayName || 'Admin',
            uid: uid
        }, { merge: true });

        // 3. Add to 'users' collection (legacy support just in case)
        console.log("   - Adding to 'users' collection (legacy)...");
        await siteRef.collection('users').doc(uid).set({
            email: USER_EMAIL,
            role: 'owner',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            displayName: userRecord.displayName || 'Admin'
        }, { merge: true });

        console.log(`✅ Site [${SITE_ID}] ownership fixed for [${USER_EMAIL}].`);
        console.log(`👉 Please refresh the admin dashboard.`);

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

fixSiteOwner().catch(console.error);
