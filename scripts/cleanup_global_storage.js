/**
 * Cleanup Script: Delete Global Storage Files
 * 
 * This script deletes files from global storage paths after migration.
 * Only run this AFTER verifying migration was successful!
 * 
 * Usage: node cleanup_global_storage.js
 */

const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: 'clicker-universe.firebasestorage.app'
});

const bucket = admin.storage().bucket();

// Global storage paths to delete (these have been migrated to sites/quattro/...)
const GLOBAL_PREFIXES_TO_DELETE = [
    'products/',
    'uploads/',
];

async function deleteFilesWithPrefix(prefix) {
    console.log(`\n🗑️  Deleting files with prefix: ${prefix}`);

    try {
        const [files] = await bucket.getFiles({ prefix });

        if (files.length === 0) {
            console.log(`   ⏭️  No files found`);
            return { prefix, deleted: 0 };
        }

        let deleted = 0;
        for (const file of files) {
            // Skip if this is a site-scoped path (safety check)
            if (file.name.startsWith('sites/')) {
                console.log(`   ⚠️  Skipping site-scoped file: ${file.name}`);
                continue;
            }

            await file.delete();
            console.log(`   ✅ Deleted: ${file.name}`);
            deleted++;
        }

        console.log(`   📊 Result: ${deleted} files deleted`);
        return { prefix, deleted };

    } catch (error) {
        console.error(`   ❌ Error: ${error.message}`);
        return { prefix, error: error.message };
    }
}

async function runCleanup() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🗑️  CLEANUP: Deleting Global Storage Files');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('\n⚠️  WARNING: This will permanently delete files from global paths!');
    console.log('   Make sure migration to site-scoped paths was successful.\n');

    let totalDeleted = 0;

    for (const prefix of GLOBAL_PREFIXES_TO_DELETE) {
        const result = await deleteFilesWithPrefix(prefix);
        totalDeleted += result.deleted || 0;
    }

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('📊 CLEANUP SUMMARY');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`\n✅ Total files deleted: ${totalDeleted}`);
    console.log('\n🎉 Cleanup Complete!');
}

runCleanup()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('\n❌ Cleanup Failed:', error);
        process.exit(1);
    });
