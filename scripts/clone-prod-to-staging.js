/**
 * clone-prod-to-staging.js
 *
 * Full clone: clicker-universe (PROD) → clicker-universe-stagging (STAGING)
 * Meliputi: Firestore, Firebase Auth, Firebase Storage
 *
 * Kondisi berdasarkan audit 2026-04-11:
 *   PROD Firestore : 8 sites, root collections: content, modules, slugMappings, templates
 *   PROD Auth      : 13 users
 *   PROD Storage   : 85 files (sites/ + profile/)
 *   STAGING        : 1 site (stagging) — akan dipertahankan, tidak ditimpa
 *
 * Strategi:
 *   - Firestore  : copy semua docs secara rekursif (deep clone semua subcollection)
 *   - Auth       : recreate dengan UID sama + password seragam
 *   - Storage    : copy file per file
 *   - SKIP       : sites/stagging (staging-only site)
 *
 * Usage:
 *   node clone-prod-to-staging.js             # full clone
 *   node clone-prod-to-staging.js --dry-run   # preview tanpa nulis
 *   node clone-prod-to-staging.js --skip-storage
 *   node clone-prod-to-staging.js --skip-auth
 *   node clone-prod-to-staging.js --password=MyPass123
 */

'use strict';

const admin = require('firebase-admin');

// ─── Config ──────────────────────────────────────────────────────────────────

const PROD_SA    = require('./serviceAccountKey.json');
const STAGING_SA = require('./clicker-universe-stagging-firebase-adminsdk-fbsvc-e9c7e1b2e5.json');

const args        = process.argv.slice(2);
const DRY_RUN     = args.includes('--dry-run');
const SKIP_AUTH   = args.includes('--skip-auth');
const SKIP_STOR   = args.includes('--skip-storage');
const PASSWORD    = (args.find(a => a.startsWith('--password=')) || '').split('=')[1] || 'B1774sjo';

// Site ini milik staging-only, jangan ditimpa dari prod
const STAGING_ONLY_SITES = new Set(['stagging']);

// UID staging lama clickerplatform@gmail.com (berbeda dari prod UID)
const STALE_SUPERADMIN_UID_STAGING = 'KK66jxnasKWt1JySAdGNOSaKU4r2';

// God mode — dibuat manual oleh admin, jangan di-clone passwordnya
const SKIP_AUTH_EMAILS = new Set(['clickerplatform@gmail.com']);

// Anonymous user tanpa email di prod — skip
const SKIP_AUTH_UIDS = new Set(['zwgHGdaQ39eM9ta1OdJi6azV9BG2']);

// Batch size Firestore (max 500, pakai 400 untuk safety)
const BATCH_SIZE = 400;

// ─── Init Firebase ───────────────────────────────────────────────────────────

const prodApp = admin.initializeApp({
    credential:    admin.credential.cert(PROD_SA),
    storageBucket: 'clicker-universe.firebasestorage.app',
}, 'prod');

const stagingApp = admin.initializeApp({
    credential:    admin.credential.cert(STAGING_SA),
    storageBucket: 'clicker-universe-stagging.firebasestorage.app',
}, 'staging');

const dbProd      = admin.firestore(prodApp);
const dbStaging   = admin.firestore(stagingApp);
const authProd    = admin.auth(prodApp);
const authStaging = admin.auth(stagingApp);
const bucketProd    = admin.storage(prodApp).bucket();
const bucketStaging = admin.storage(stagingApp).bucket();

// ─── Stats ───────────────────────────────────────────────────────────────────

const stats = {
    firestore: { docs: 0, skipped: 0, errors: 0 },
    auth:      { created: 0, updated: 0, deleted: 0, skipped: 0, errors: 0 },
    storage:   { copied: 0, skipped: 0, errors: 0 },
};

// ─── Logger ──────────────────────────────────────────────────────────────────

// nosemgrep: javascript.express.log.console-log-express.console-log-express
const log  = (msg)  => console.log(msg);
const ok   = (msg)  => console.log(`  ✅ ${msg}`);
const skip = (msg)  => console.log(`  ⏭️  ${msg}`);
const warn = (msg)  => console.warn(`  ⚠️  ${msg}`);
const fail = (msg)  => console.error(`  ❌ ${msg}`);
const head = (msg)  => log(`\n${'─'.repeat(55)}\n${msg}\n${'─'.repeat(55)}`);

// ─── Firestore: deep clone collection ────────────────────────────────────────

/**
 * Rekursif clone semua docs + subcollections dari srcRef ke dstRef.
 * srcRef / dstRef adalah CollectionReference.
 */
async function cloneCollection(srcRef, dstRef, depth = 0) {
    const indent = '  '.repeat(depth);
    let snapshot;
    try {
        snapshot = await srcRef.get();
    } catch (e) {
        fail(`${indent}Gagal baca ${srcRef.path}: ${e.message}`);
        stats.firestore.errors++;
        return;
    }

    if (snapshot.empty) return;

    log(indent + '📦 ' + srcRef.path + ' (' + snapshot.size + ' docs)');
    if (DRY_RUN) return;

    let batch  = dbStaging.batch();
    let count  = 0;

    for (const doc of snapshot.docs) {
        const dstDocRef = dstRef.doc(doc.id);
        batch.set(dstDocRef, doc.data());
        count++;
        stats.firestore.docs++;

        if (count % BATCH_SIZE === 0) {
            await batch.commit();
            batch = dbStaging.batch();
        }
    }
    if (count % BATCH_SIZE !== 0) await batch.commit();

    // Rekursif ke subcollections setiap doc
    for (const doc of snapshot.docs) {
        const srcDocRef = srcRef.doc(doc.id);
        const dstDocRef = dstRef.doc(doc.id);
        const subColls  = await srcDocRef.listCollections();
        for (const sub of subColls) {
            await cloneCollection(
                srcDocRef.collection(sub.id),
                dstDocRef.collection(sub.id),
                depth + 1
            );
        }
    }
}

// ─── Phase 1: Firestore ──────────────────────────────────────────────────────

async function cloneFirestore() {
    head('PHASE 1: FIRESTORE');

    // 1a. Root collections (content, modules, slugMappings, templates)
    log('\n[1a] Root collections');
    const rootColls = await dbProd.listCollections();
    for (const coll of rootColls) {
        if (coll.id === 'sites') continue; // handle sites separately
        if (coll.id === 'users') continue; // empty di prod, skip
        log(`\n  → ${coll.id}`);
        await cloneCollection(
            dbProd.collection(coll.id),
            dbStaging.collection(coll.id)
        );
    }

    // 1b. Sites
    log('\n[1b] Sites');
    const sitesSnap = await dbProd.collection('sites').get();
    log(`  Total prod sites: ${sitesSnap.size}`);

    for (const siteDoc of sitesSnap.docs) {
        const siteId = siteDoc.id;

        if (STAGING_ONLY_SITES.has(siteId)) {
            skip(`sites/${siteId} — staging-only, skip`);
            stats.firestore.skipped++;
            continue;
        }

        log(`\n  🏢 sites/${siteId}`);
        if (!DRY_RUN) {
            // Copy root site doc
            await dbStaging.collection('sites').doc(siteId).set(siteDoc.data(), { merge: true });
            stats.firestore.docs++;
        }

        // Clone semua subcollections di site ini
        const subColls = await siteDoc.ref.listCollections();
        for (const sub of subColls) {
            await cloneCollection(
                dbProd.collection('sites').doc(siteId).collection(sub.id),
                dbStaging.collection('sites').doc(siteId).collection(sub.id),
                1
            );
        }
    }
}

// ─── Phase 2: Firebase Auth ──────────────────────────────────────────────────

async function cloneAuth() {
    head('PHASE 2: FIREBASE AUTH');
    log(`  Password staging: ${PASSWORD}\n`);

    // Step 2a: Hapus staging superadmin lama (UID beda dari prod)
    log('[2a] Hapus staging superadmin UID lama');
    log(`  UID: ${STALE_SUPERADMIN_UID_STAGING} (clickerplatform@gmail.com — dihapus, password di-input manual)`);
    log(`  ℹ️  Setelah script selesai, buat manual di Firebase Console dengan password pilihan kamu`);
    if (!DRY_RUN) {
        try {
            await authStaging.deleteUser(STALE_SUPERADMIN_UID_STAGING);
            ok(`Deleted ${STALE_SUPERADMIN_UID_STAGING}`);
            stats.auth.deleted++;
        } catch (e) {
            if (e.code === 'auth/user-not-found') skip('Sudah tidak ada');
            else { fail(`Gagal delete: ${e.message}`); stats.auth.errors++; }
        }
    } else {
        skip(`DRY RUN — akan delete ${STALE_SUPERADMIN_UID_STAGING}`);
    }

    // Step 2b: Clone semua prod users
    log('\n[2b] Clone prod users');
    const prodResult = await authProd.listUsers(1000);
    log(`  Total: ${prodResult.users.length} users\n`);

    for (const u of prodResult.users) {
        log(`  → ${u.email || '(no email)'} [${u.uid}]`);

        // Skip anonymous / no email
        if (SKIP_AUTH_UIDS.has(u.uid) || !u.email) {
            skip('Skip (no email / anonymous)');
            stats.auth.skipped++;
            continue;
        }

        // Skip god mode — password di-input manual
        if (SKIP_AUTH_EMAILS.has(u.email)) {
            skip(`Skip god mode (${u.email}) — input password manual`);
            stats.auth.skipped++;
            continue;
        }

        if (DRY_RUN) {
            skip(`DRY RUN — createUser uid=${u.uid} claims=${JSON.stringify(u.customClaims || {})}`);
            continue;
        }

        // Cek UID di staging
        let uidExists = false;
        try { await authStaging.getUser(u.uid); uidExists = true; } catch (_) {}

        if (uidExists) {
            // Update password + claims
            try {
                await authStaging.updateUser(u.uid, { password: PASSWORD, emailVerified: true });
                if (u.customClaims && Object.keys(u.customClaims).length > 0)
                    await authStaging.setCustomUserClaims(u.uid, u.customClaims);
                ok(`Updated — ${u.email}`);
                stats.auth.updated++;
            } catch (e) {
                fail(`Gagal update ${u.email}: ${e.message}`);
                stats.auth.errors++;
            }
            continue;
        }

        // Cek email conflict (UID lain pakai email yang sama)
        try {
            const existing = await authStaging.getUserByEmail(u.email);
            // Ada conflict — hapus dulu
            warn(`Email conflict ${u.email} (staging UID: ${existing.uid}), hapus + recreate`);
            await authStaging.deleteUser(existing.uid);
            stats.auth.deleted++;
        } catch (e) {
            if (e.code !== 'auth/user-not-found') {
                fail(`Gagal cek email ${u.email}: ${e.message}`);
                stats.auth.errors++;
                continue;
            }
        }

        // Buat user baru
        try {
            await authStaging.createUser({
                uid:           u.uid,
                email:         u.email,
                displayName:   u.displayName || undefined,
                emailVerified: true,
                password:      PASSWORD,
            });
            if (u.customClaims && Object.keys(u.customClaims).length > 0)
                await authStaging.setCustomUserClaims(u.uid, u.customClaims);
            ok(`Created — ${u.email} | claims: ${JSON.stringify(u.customClaims || {})}`);
            stats.auth.created++;
        } catch (e) {
            fail(`Gagal buat ${u.email}: ${e.message}`);
            stats.auth.errors++;
        }
    }
}

// ─── Phase 3: Firebase Storage ───────────────────────────────────────────────

async function cloneStorage() {
    head('PHASE 3: FIREBASE STORAGE');

    const [files] = await bucketProd.getFiles();
    log(`  Total prod files: ${files.length}\n`);

    for (const file of files) {
        // Skip staging-only site files
        const isStagingOnly = [...STAGING_ONLY_SITES].some(s => file.name.startsWith(`sites/${s}/`));
        if (isStagingOnly) {
            skip(`${file.name} — staging-only site, skip`);
            stats.storage.skipped++;
            continue;
        }

        log(`  📄 ${file.name}`);
        if (DRY_RUN) continue;

        const destFile = bucketStaging.file(file.name);
        try {
            const [exists] = await destFile.exists();
            if (exists) {
                skip(`Sudah ada, skip`);
                stats.storage.skipped++;
                continue;
            }

            const [content]  = await file.download();
            const [metadata] = await file.getMetadata();
            await destFile.save(content, {
                contentType: metadata.contentType,
                metadata:    { cacheControl: metadata.cacheControl },
            });
            ok(`Copied`);
            stats.storage.copied++;
        } catch (e) {
            fail(`Gagal copy ${file.name}: ${e.message}`);
            stats.storage.errors++;
        }
    }
}

// ─── Phase 4: Verifikasi ─────────────────────────────────────────────────────

async function verify() {
    head('PHASE 4: VERIFIKASI STAGING');

    // Firestore
    const stagingSites = await dbStaging.collection('sites').get();
    log(`\nFirestore sites di staging: ${stagingSites.size}`);
    stagingSites.forEach(d => log(`  - ${d.id}`));

    // Auth
    const stagingUsers = await authStaging.listUsers(1000);
    log(`\nAuth users di staging: ${stagingUsers.users.length}`);
    for (const u of stagingUsers.users) {
        log(`  - ${u.email || '(no email)'} | uid: ${u.uid} | claims: ${JSON.stringify(u.customClaims || {})}`);
    }

    // Storage
    const [files] = await bucketStaging.getFiles();
    log(`\nStorage files di staging: ${files.length}`);
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function run() {
    log('═'.repeat(55));
    log('🚀 FULL CLONE: clicker-universe → clicker-universe-stagging');
    if (DRY_RUN) log('   ⚠️  DRY RUN — tidak ada yang ditulis');
    log('═'.repeat(55));

    const t0 = Date.now();

    await cloneFirestore();
    if (!SKIP_AUTH) await cloneAuth();
    if (!SKIP_STOR) await cloneStorage();
    if (!DRY_RUN)   await verify();

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

    log('\n' + '═'.repeat(55));
    log(`📊 SUMMARY (${elapsed}s)`);
    log(`\nFirestore:`);
    log(`  docs cloned : ${stats.firestore.docs}`);
    log(`  skipped     : ${stats.firestore.skipped}`);
    log(`  errors      : ${stats.firestore.errors}`);
    log(`\nAuth:`);
    log(`  created     : ${stats.auth.created}`);
    log(`  updated     : ${stats.auth.updated}`);
    log(`  deleted     : ${stats.auth.deleted}`);
    log(`  skipped     : ${stats.auth.skipped}`);
    log(`  errors      : ${stats.auth.errors}`);
    log(`\nStorage:`);
    log(`  copied      : ${stats.storage.copied}`);
    log(`  skipped     : ${stats.storage.skipped}`);
    log(`  errors      : ${stats.storage.errors}`);
    log(`\n💡 Login staging dengan password: ${PASSWORD}`);
    log('═'.repeat(55));

    const totalErrors = stats.firestore.errors + stats.auth.errors + stats.storage.errors;
    process.exit(totalErrors > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(1); });
