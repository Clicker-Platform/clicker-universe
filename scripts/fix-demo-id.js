
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function fixId() {
    const docRef = db.collection('sites').doc('demo');

    await docRef.update({ id: 'demo' });
    console.log('Updated sites/demo id to "demo"');
}

fixId();
