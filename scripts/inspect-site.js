const admin = require('firebase-admin');
const serviceAccount = require('../clicker-universe-firebase-adminsdk-fbsvc-cd9dacac7e.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

const SITE_IDS = ['hi-clicker', 'demo'];
const UID = 'wPiDjuu4nBQKLpqJSVw55OGlRzl2';
const EMAIL = 'hi+1@clicker.id';

async function inspectSites() {
    console.log('🔍 Inspecting sites for ownership...');

    for (const siteId of SITE_IDS) {
        try {
            const siteDoc = await db.collection('sites').doc(siteId).get();
            if (siteDoc.exists) {
                const data = siteDoc.data();
                console.log(`\nSite: [${siteId}]`);
                console.log(`   - Owner ID: ${data.ownerId} ${data.ownerId === UID ? '✅ MATCH' : ''}`);
                console.log(`   - Owner Email: ${data.ownerEmail} ${data.ownerEmail === EMAIL ? '✅ MATCH' : ''}`);
            } else {
                console.log(`\nSite: [${siteId}] - Not Found`);
            }
        } catch (error) {
            console.error('Error checking site', siteId + ':', error);
        }
    }
}

inspectSites().catch(console.error);
