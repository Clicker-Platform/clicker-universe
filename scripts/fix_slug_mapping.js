
const admin = require('firebase-admin');
var serviceAccount = require("./service-account.json");

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function fixMapping() {
    console.log('🔧 Fixing slug mapping for "quattro"...');

    // 1. Verify site exists
    const siteDoc = await db.collection('sites').doc('quattro').get();
    if (!siteDoc.exists) {
        console.error('❌ FATAL: Site "quattro" does not exist!');
        return;
    }
    console.log('✅ Site "quattro" found with modules:', siteDoc.data().modules);

    // 2. Update Mapping
    await db.collection('slugMappings').doc('quattro').update({
        siteId: 'quattro',  // Point to correct ID
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log('✅ Mapping UPDATED. "quattro" -> "quattro".');
}

fixMapping().catch(console.error);
