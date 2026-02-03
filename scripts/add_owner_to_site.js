
const admin = require('firebase-admin');
var serviceAccount = require("./service-account.json");

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function addOwner() {
    const siteId = 'quattro';
    const uid = 'Je7FaSHUSsY5KYfYsHbrGe31lZI2';

    console.log(`Adding user ${uid} as OWNER to site ${siteId}...`);

    await db.collection('sites').doc(siteId).collection('members').doc(uid).set({
        email: 'user-imported@manual.com', // Placeholder if unknown, or fetch via Auth
        role: 'owner',
        status: 'active',
        joinedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log('✅ User added to members collection.');
}

addOwner().catch(console.error);
