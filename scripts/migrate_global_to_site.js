/**
 * Migration Script: Global to Site-Scoped Data
 * 
 * This script migrates data from legacy global Firestore paths 
 * to site-scoped paths for multi-tenancy support.
 * 
 * Source: modules/{moduleId}/... (global)
 * Target: sites/{siteId}/modules/{moduleId}/... (site-scoped)
 * 
 * Usage: node migrate_global_to_site.js
 */

const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: 'clicker-universe.firebasestorage.app'
});

const db = admin.firestore();
const bucket = admin.storage().bucket();

// Configuration
const TARGET_SITE_ID = 'quattro';

// Collections to migrate
const COLLECTIONS_TO_MIGRATE = [
    // POS Module
    { globalPath: 'modules/byod_pos/orders', newPath: `sites/${TARGET_SITE_ID}/modules/byod_pos/orders` },
    { globalPath: 'modules/byod_pos/menu_items', newPath: `sites/${TARGET_SITE_ID}/modules/byod_pos/menu_items` },
    { globalPath: 'modules/byod_pos/categories', newPath: `sites/${TARGET_SITE_ID}/modules/byod_pos/categories` },
    { globalPath: 'modules/byod_pos/settings', newPath: `sites/${TARGET_SITE_ID}/modules/byod_pos/settings` },

    // Reservation Module
    { globalPath: 'modules/reservation/bookings', newPath: `sites/${TARGET_SITE_ID}/modules/reservation/bookings` },
    { globalPath: 'modules/reservation/services', newPath: `sites/${TARGET_SITE_ID}/modules/reservation/services` },
    { globalPath: 'modules/reservation/staff', newPath: `sites/${TARGET_SITE_ID}/modules/reservation/staff` },

    // Inventory Module
    { globalPath: 'modules/inventory/items', newPath: `sites/${TARGET_SITE_ID}/modules/inventory/items` },

    // Membership Module
    { globalPath: 'modules/membership/members', newPath: `sites/${TARGET_SITE_ID}/modules/membership/members` },
    { globalPath: 'modules/membership/transactions', newPath: `sites/${TARGET_SITE_ID}/modules/membership/transactions` },

    // Legacy collections at root level (if any)
    { globalPath: 'products', newPath: `sites/${TARGET_SITE_ID}/products` },
    { globalPath: 'inventory', newPath: `sites/${TARGET_SITE_ID}/modules/inventory/items` },
];

// Storage paths to migrate
const STORAGE_PATHS_TO_MIGRATE = [
    { globalPrefix: 'products/', newPrefix: `sites/${TARGET_SITE_ID}/products/` },
    { globalPrefix: 'uploads/', newPrefix: `sites/${TARGET_SITE_ID}/uploads/` },
    { globalPrefix: 'uploads/content/', newPrefix: `sites/${TARGET_SITE_ID}/uploads/content/` },
];

async function migrateCollection(source, target) {
    console.log(`\n📦 Migrating: ${source} → ${target}`);

    try {
        const snapshot = await db.collection(source).get();

        if (snapshot.empty) {
            console.log(`   ⏭️  No documents found in ${source}`);
            return { source, migrated: 0, skipped: 0 };
        }

        let migrated = 0;
        let skipped = 0;

        for (const doc of snapshot.docs) {
            const targetRef = db.collection(target).doc(doc.id);
            const existingDoc = await targetRef.get();

            if (existingDoc.exists) {
                console.log(`   ⚠️  Document ${doc.id} already exists in target, skipping`);
                skipped++;
                continue;
            }

            const data = doc.data();
            // Add migration metadata
            data._migratedFrom = source;
            data._migratedAt = admin.firestore.FieldValue.serverTimestamp();

            await targetRef.set(data);
            console.log(`   ✅ Migrated: ${doc.id}`);
            migrated++;
        }

        console.log(`   📊 Result: ${migrated} migrated, ${skipped} skipped`);
        return { source, migrated, skipped };

    } catch (error) {
        if (error.code === 5 || error.message.includes('NOT_FOUND')) {
            console.log(`   ⏭️  Collection ${source} does not exist`);
            return { source, migrated: 0, skipped: 0, notFound: true };
        }
        console.error(`   ❌ Error: ${error.message}`);
        return { source, error: error.message };
    }
}

async function migrateDocument(sourcePath, targetPath) {
    console.log(`\n📄 Migrating doc: ${sourcePath} → ${targetPath}`);

    try {
        const sourceDoc = await db.doc(sourcePath).get();

        if (!sourceDoc.exists) {
            console.log(`   ⏭️  Document not found`);
            return { sourcePath, migrated: false, notFound: true };
        }

        const targetDoc = await db.doc(targetPath).get();
        if (targetDoc.exists) {
            console.log(`   ⚠️  Target already exists, skipping`);
            return { sourcePath, migrated: false, skipped: true };
        }

        const data = sourceDoc.data();
        data._migratedFrom = sourcePath;
        data._migratedAt = admin.firestore.FieldValue.serverTimestamp();

        await db.doc(targetPath).set(data);
        console.log(`   ✅ Migrated`);
        return { sourcePath, migrated: true };

    } catch (error) {
        console.error(`   ❌ Error: ${error.message}`);
        return { sourcePath, error: error.message };
    }
}

async function migrateStorageFiles(globalPrefix, newPrefix) {
    console.log(`\n🗂️  Migrating storage: ${globalPrefix} → ${newPrefix}`);

    try {
        const [files] = await bucket.getFiles({ prefix: globalPrefix });

        if (files.length === 0) {
            console.log(`   ⏭️  No files found with prefix ${globalPrefix}`);
            return { globalPrefix, migrated: 0 };
        }

        let migrated = 0;
        let skipped = 0;

        for (const file of files) {
            const newFileName = file.name.replace(globalPrefix, newPrefix);

            // Check if target exists
            const [targetExists] = await bucket.file(newFileName).exists();
            if (targetExists) {
                console.log(`   ⚠️  File ${newFileName} already exists, skipping`);
                skipped++;
                continue;
            }

            // Copy file to new location (preserving metadata)
            await file.copy(newFileName);
            console.log(`   ✅ Copied: ${file.name} → ${newFileName}`);
            migrated++;
        }

        console.log(`   📊 Result: ${migrated} copied, ${skipped} skipped`);
        return { globalPrefix, migrated, skipped };

    } catch (error) {
        console.error(`   ❌ Storage Error: ${error.message}`);
        return { globalPrefix, error: error.message };
    }
}

async function runMigration() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`🚀 Starting Migration to Site: ${TARGET_SITE_ID}`);
    console.log('═══════════════════════════════════════════════════════════════');

    const results = {
        firestore: [],
        storage: []
    };

    // 1. Migrate Firestore Collections
    console.log('\n\n📂 PHASE 1: FIRESTORE COLLECTIONS');
    console.log('───────────────────────────────────────────────────────────────');

    for (const { globalPath, newPath } of COLLECTIONS_TO_MIGRATE) {
        const result = await migrateCollection(globalPath, newPath);
        results.firestore.push(result);
    }

    // 2. Migrate Firestore Documents (settings docs)
    console.log('\n\n📄 PHASE 2: FIRESTORE SETTINGS DOCUMENTS');
    console.log('───────────────────────────────────────────────────────────────');

    const settingsDocs = [
        { source: 'modules/byod_pos/settings/config', target: `sites/${TARGET_SITE_ID}/modules/byod_pos/settings/config` },
        { source: 'modules/reservation/settings/config', target: `sites/${TARGET_SITE_ID}/modules/reservation/settings/config` },
        { source: 'modules/membership/settings/config', target: `sites/${TARGET_SITE_ID}/modules/membership/settings/config` },
    ];

    for (const { source, target } of settingsDocs) {
        const result = await migrateDocument(source, target);
        results.firestore.push(result);
    }

    // 3. Migrate Storage Files
    console.log('\n\n🗂️  PHASE 3: STORAGE FILES');
    console.log('───────────────────────────────────────────────────────────────');

    for (const { globalPrefix, newPrefix } of STORAGE_PATHS_TO_MIGRATE) {
        const result = await migrateStorageFiles(globalPrefix, newPrefix);
        results.storage.push(result);
    }

    // Summary
    console.log('\n\n═══════════════════════════════════════════════════════════════');
    console.log('📊 MIGRATION SUMMARY');
    console.log('═══════════════════════════════════════════════════════════════');

    const totalFirestore = results.firestore.reduce((acc, r) => acc + (r.migrated || 0), 0);
    const totalStorage = results.storage.reduce((acc, r) => acc + (r.migrated || 0), 0);

    console.log(`\n✅ Firestore: ${totalFirestore} documents migrated`);
    console.log(`✅ Storage: ${totalStorage} files copied`);
    console.log(`\nTarget Site: ${TARGET_SITE_ID}`);
    console.log('\n⚠️  Note: Original data is NOT deleted. Review and delete manually if needed.');

    return results;
}

// Run the migration
runMigration()
    .then(() => {
        console.log('\n🎉 Migration Complete!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Migration Failed:', error);
        process.exit(1);
    });
