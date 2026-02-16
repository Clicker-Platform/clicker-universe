
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function updateTitle() {
    const docRef = db.collection('sites').doc('demo').collection('content').doc('siteSettings');

    await docRef.set({ title: 'Demo' }, { merge: true });
    console.log('Updated sites/demo/content/siteSettings title to "Demo"');
}

updateTitle();
