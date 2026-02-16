
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function fixSlug() {
    const docRef = db.collection('sites').doc('demo');

    await docRef.update({ slug: 'demo' });
    console.log('Updated sites/demo slug to "demo"');
}

fixSlug();
