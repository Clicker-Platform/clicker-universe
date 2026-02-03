
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const serviceAccount = require('./service-account.json');

initializeApp({
    credential: cert(serviceAccount)
});

const db = getFirestore();

async function check() {
    console.log('Checking user permissions...');
    const siteId = 'quattro';
    const email = 'staff+1@clicker.com';

    // Find the user by email in the members collection
    const membersRef = db.collection('sites').doc(siteId).collection('members');
    const snapshot = await membersRef.get();

    if (snapshot.empty) {
        console.log('No members found!');
        return;
    }

    let found = false;
    snapshot.forEach(doc => {
        if (doc.data().email === email) {
            found = true;
            console.log('User Found:', doc.id);
            console.log('Role:', doc.data().role);
            console.log('Permissions (Legacy):', doc.data().permissions);
            console.log('ModuleAccess (Granular):', JSON.stringify(doc.data().moduleAccess, null, 2));
        }
    });

    if (!found) console.log('User not found in list.');

    // Check Module Definition
    console.log('\nChecking Module Definition for byod_pos...');
    const modRef = db.collection('modules').doc('byod_pos');
    const modSnap = await modRef.get();

    if (modSnap.exists) {
        console.log('Admin Routes:', JSON.stringify(modSnap.data().adminRoutes, null, 2));
    } else {
        console.log('Module byod_pos not found!');
    }
}

check();
