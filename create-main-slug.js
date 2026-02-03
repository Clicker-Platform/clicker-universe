/**
 * Quick Script: Create Slug Mapping for Main Site
 * 
 * Run this to manually create slug mapping for clickerapps.web.app
 * 
 * Usage: node create-main-slug.js
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
let serviceAccount;
try {
    serviceAccount = require('./service-account.json');
} catch (e) {
    console.error('Error: service-account.json not found!');
    console.error('Please download it from Firebase Console > Project Settings > Service Accounts');
    process.exit(1);
}

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'clicker-universe'
});

const db = admin.firestore();

async function createMainSlug() {
    try {
        console.log('🚀 Creating slug mapping for clickerapps.web.app...');

        const siteId = 'clickerapps.web.app';
        const slug = 'clickerapps-web-app';
        const timestamp = new Date().toISOString();

        // 1. Create slug mapping
        console.log('📝 Creating slugMappings document...');
        await db.collection('slugMappings').doc(slug).set({
            siteId: siteId,
            isActive: true,
            createdAt: timestamp
        });
        console.log('✅ slugMappings/clickerapps-web-app created');

        // 2. Update settings
        console.log('📝 Updating site settings...');
        const settingsRef = db.doc(`sites/${siteId}/settings/general`);

        await settingsRef.update({
            slug: slug,
            slugHistory: [],
            slugUpdatedAt: timestamp
        });
        console.log('✅ sites/clickerapps.web.app/settings/general updated');

        console.log('\n✨ Success! Slug mapping created.');
        console.log(`\nTest URL: https://clickerapps.web.app/${slug}/home`);

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error);
    } finally {
        process.exit(0);
    }
}

createMainSlug();
