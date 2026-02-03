
const admin = require('firebase-admin');
var serviceAccount = require("./service-account.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function listGlobalModules() {
    console.log('Checking Global "modules" collection...');
    const snapshot = await db.collection('modules').get();

    if (snapshot.empty) {
        console.log('❌ No global modules found in "modules" collection.');
        return;
    }

    snapshot.forEach(doc => {
        console.log(`- ${doc.id}: enabled=${doc.data().enabled}, displayName="${doc.data().displayName}"`);
    });
}

listGlobalModules().catch(console.error);
