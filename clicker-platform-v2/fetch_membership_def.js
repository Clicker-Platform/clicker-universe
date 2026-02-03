
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const serviceAccount = require('./service-account.json');

initializeApp({
    credential: cert(serviceAccount)
});

const db = getFirestore();

async function fetchMembershipDef() {
    console.log('Fetching membership module definition...');
    const doc = await db.collection('modules').doc('membership').get();

    if (!doc.exists) {
        console.log('Module not found!');
        return;
    }

    const data = doc.data();
    console.log('--- Admin Routes ---');
    console.log(JSON.stringify(data.adminRoutes, null, 2));
}

fetchMembershipDef();
