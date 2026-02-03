
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const serviceAccount = require('./service-account.json');

initializeApp({
    credential: cert(serviceAccount)
});

const db = getFirestore();

async function testSaveFlow() {
    const siteId = 'quattro';
    const email = 'staff+1@clicker.com';
    const membersRef = db.collection('sites').doc(siteId).collection('members');

    console.log('--- 1. Initial State ---');
    let snapshot = await membersRef.get();
    let uid = '';
    snapshot.forEach(doc => {
        if (doc.data().email === email) {
            uid = doc.id;
            console.log('Initial ModuleAccess:', JSON.stringify(doc.data().moduleAccess, null, 2));
        }
    });

    if (!uid) { console.error('User not found'); return; }

    console.log('\n--- 2. Simulate Save (Config -> Full) ---');
    // We intentionally set it to FULL to see if we can reproduce the "reverting to full" behavior
    // Or we set it to matches what the user WANTS (None) to prove it persists.
    // User wants: Menu -> Full, Config -> None.
    const newModuleAccess = {
        byod_pos: {
            // "settings": "none"  <-- Implicitly deleted
            "menu": "full",
            "kitchen": "view",
            "cashier": "view",
            "history": "view"
        }
    };

    // Simulate what the API does:
    const data = {
        moduleAccess: newModuleAccess
        // permissions: ... (keep existing)
    };

    await membersRef.doc(uid).set(data, { merge: true });
    console.log('Write completed.');

    console.log('\n--- 3. Read After Save ---');
    const docAfter = await membersRef.doc(uid).get();
    console.log('Updated ModuleAccess:', JSON.stringify(docAfter.data().moduleAccess, null, 2));

    const settingsAccess = docAfter.data().moduleAccess?.byod_pos?.settings;
    console.log('Settings Access (Should be undefined):', settingsAccess);

    if (settingsAccess === undefined) {
        console.log('✅ TEST PASSED: Settings permission effectively removed.');
    } else {
        console.log('❌ TEST FAILED: Settings permission still exists:', settingsAccess);
    }
}

testSaveFlow();
