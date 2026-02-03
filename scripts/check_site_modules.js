
const admin = require('firebase-admin');
var serviceAccount = require("./service-account.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkModules(siteId) {
    console.log(`Checking modules for site: ${siteId}`);
    const doc = await db.collection('sites').doc(siteId).get();

    if (!doc.exists) {
        console.log('❌ Site document does not exist!');
        return;
    }

    const data = doc.data();
    console.log('📂 Root Modules:', data.modules);
    if (data.settings && data.settings.modules) {
        console.log('⚙️ Settings Modules (Legacy):', data.settings.modules);
    } else {
        console.log('⚙️ No Settings Modules found.');
    }
}

// Check 'quattro' (assuming it is the ID)
checkModules('quattro').catch(console.error);
