import * as admin from 'firebase-admin';

// Use Application Default Credentials for standalone script
// Make sure GOOGLE_APPLICATION_CREDENTIALS is set or run with gcloud auth
admin.initializeApp();

async function main() {
    const siteId = 'clickerapps.web.app';
    console.log(`🔍 Verifying data for: ${siteId}`);
    const db = admin.firestore();

    // 1. Check Site Doc
    const siteDoc = await db.collection('sites').doc(siteId).get();
    console.log('Site Doc exists:', siteDoc.exists);
    if (siteDoc.exists) console.log('Site Data:', JSON.stringify(siteDoc.data(), null, 2));

    // 2. Check Settings
    const settingsDoc = await db.collection('sites').doc(siteId).collection('content').doc('siteSettings').get();
    console.log('Settings Doc exists:', settingsDoc.exists);
    if (settingsDoc.exists) console.log('Settings Data:', JSON.stringify(settingsDoc.data(), null, 2));

    // 3. Check Products
    const productsSnap = await db.collection('sites').doc(siteId).collection('products').get();
    console.log('Products Count:', productsSnap.size);
    if (!productsSnap.empty) {
        console.log('First Product:', JSON.stringify(productsSnap.docs[0].data(), null, 2));
    }
}

main().catch(console.error);
