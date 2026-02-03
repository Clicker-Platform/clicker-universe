
const admin = require('firebase-admin');
var serviceAccount = require("./service-account.json");

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function checkSlug(slug) {
    console.log(`Checking slug mapping for: ${slug}`);
    const doc = await db.collection('slugMappings').doc(slug).get();

    if (!doc.exists) {
        console.log('❌ Slug mapping does not exist!');
        return;
    }

    const data = doc.data();
    console.log('✅ Mapping found:', data);

    // Also check Reverse Mapping in Settings
    if (data.siteId) {
        console.log(`Checking reverse mapping for site: ${data.siteId}`);
        const siteDoc = await db.doc(`sites/${data.siteId}/settings/general`).get();
        if (siteDoc.exists) {
            console.log('✅ Reverse slug:', siteDoc.data().slug);
        } else {
            console.log('❌ Reverse mapping (settings/general) not found!');
        }
    }
}

checkSlug('quattro').catch(console.error);
