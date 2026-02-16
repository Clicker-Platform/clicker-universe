
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function readSite(siteId) {
    const doc = await db.collection('sites').doc(siteId).get();
    console.log(JSON.stringify(doc.data(), null, 2));
}

readSite('clickerapps.web.app');
