const admin = require('firebase-admin');
const serviceAccount = require('../quattro-cafe-bce2b-firebase-adminsdk-fbsvc-9a38f048eb.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const SITE_ID = 'cafe-quattro'; // Change this to the target site ID
const CORRECT_NAME = 'Cafe Quattro';

async function fixSiteIdentity() {
    console.log(`🔧 Fixing identity for site: ${SITE_ID}...`);

    const siteRef = db.collection('sites').doc(SITE_ID);
    const doc = await siteRef.get();

    if (!doc.exists) {
        console.log(`❌ Site ${SITE_ID} not found.`);
        return;
    }

    // 1. Fix Main Site Document
    await siteRef.update({
        name: CORRECT_NAME,
        slug: SITE_ID
    });
    console.log(`✅ Updated site document name to "${CORRECT_NAME}"`);

    // 2. Fix Site Settings Title
    await siteRef.collection('content').doc('siteSettings').update({
        title: CORRECT_NAME
    });
    console.log(`✅ Updated site settings title to "${CORRECT_NAME}"`);

    // 3. Fix Metadata
    await siteRef.update({
        'metadata.name': CORRECT_NAME,
        'metadata.seo.title': `${CORRECT_NAME} | Powered by Clicker`
    });
    console.log(`✅ Updated metadata name to "${CORRECT_NAME}"`);

    console.log('🎉 Fix complete!');
}

fixSiteIdentity().catch(console.error);
