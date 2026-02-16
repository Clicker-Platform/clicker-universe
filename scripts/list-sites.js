
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function listSites() {
    const snapshot = await db.collection('sites').get();
    snapshot.forEach(doc => {
        console.log(doc.id, doc.data().title || doc.data().name);
    });
}

listSites();
