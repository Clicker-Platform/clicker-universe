/**
 * clone-users-to-staging.js
 *
 * Clone semua Firebase Auth users dari clicker-universe (PROD)
 * ke clicker-universe-stagging (STAGING) dengan password seragam.
 *
 * Berdasarkan hasil audit 2026-04-11:
 *   PROD  : 13 users
 *   STAGING: 2 users (clickerplatform@gmail.com UID beda, stagging@clicker.id keep)
 *
 * Strategi per user:
 *   1. clickerplatform@gmail.com  → delete staging UID lama, recreate dengan UID prod + claims superadmin
 *   2. 11 user lainnya (ada email) → createUser dengan UID prod + password staging
 *   3. zwgHGdaQ39eM9ta1OdJi6azV9BG2 (no email, anonymous) → SKIP
 *   4. stagging@clicker.id        → TIDAK DISENTUH
 *
 * Usage:
 *   node clone-users-to-staging.js
 *   node clone-users-to-staging.js --dry-run
 *   node clone-users-to-staging.js --password=MyPass123
 */

const admin = require('firebase-admin');

// ─── Config ──────────────────────────────────────────────────────────────────

const PROD_SA    = require('./serviceAccountKey.json');
const STAGING_SA = require('./clicker-universe-stagging-firebase-adminsdk-fbsvc-e9c7e1b2e5.json');

const args = process.argv.slice(2);
const DRY_RUN  = args.includes('--dry-run');
const PASSWORD = (args.find(a => a.startsWith('--password=')) || '').split('=')[1] || 'Staging@123';

// UID staging lama clickerplatform@gmail.com — harus dihapus dulu
const STALE_SUPERADMIN_UID = 'KK66jxnasKWt1JySAdGNOSaKU4r2';

// User tanpa email (anonymous) — skip
const SKIP_UIDS = new Set(['zwgHGdaQ39eM9ta1OdJi6azV9BG2']);

// ─── Init Firebase ───────────────────────────────────────────────────────────

const prodApp    = admin.initializeApp({ credential: admin.credential.cert(PROD_SA) },    'prod');
const stagingApp = admin.initializeApp({ credential: admin.credential.cert(STAGING_SA) }, 'staging');

const authProd    = admin.auth(prodApp);
const authStaging = admin.auth(stagingApp);

// ─── Helpers ─────────────────────────────────────────────────────────────────

const log  = (msg) => console.log(msg);
const ok   = (msg) => console.log(`  ✅ ${msg}`);
const skip = (msg) => console.log(`  ⏭️  ${msg}`);
const warn = (msg) => console.warn(`  ⚠️  ${msg}`);
const fail = (msg) => console.error(`  ❌ ${msg}`);

const stats = { created: 0, updated: 0, deleted: 0, skipped: 0, errors: 0 };

// ─── Step 1: Hapus staging superadmin lama ───────────────────────────────────

async function deleteStaleUser() {
    log('\n── STEP 1: Hapus staging superadmin UID lama ──────────────────────');
    log(`   UID: ${STALE_SUPERADMIN_UID} (clickerplatform@gmail.com staging lama)`);

    if (DRY_RUN) { skip('DRY RUN — skip delete'); return; }

    try {
        await authStaging.deleteUser(STALE_SUPERADMIN_UID);
        ok(`Deleted staging UID ${STALE_SUPERADMIN_UID}`);
        stats.deleted++;
    } catch (e) {
        if (e.code === 'auth/user-not-found') {
            skip('Sudah tidak ada, skip');
        } else {
            fail(`Gagal delete: ${e.message}`);
            stats.errors++;
        }
    }
}

// ─── Step 2: Clone semua prod users ─────────────────────────────────────────

async function cloneUsers() {
    log('\n── STEP 2: Clone prod users ke staging ────────────────────────────');
    log(`   Password staging: ${PASSWORD}\n`);

    const prodResult = await authProd.listUsers(1000);
    log(`   Total prod users: ${prodResult.users.length}`);

    for (const u of prodResult.users) {
        log(`\n   → ${u.email || '(no email)'} [${u.uid}]`);

        // Skip anonymous
        if (SKIP_UIDS.has(u.uid)) {
            skip('Anonymous user, skip');
            stats.skipped++;
            continue;
        }

        // Skip user tanpa email
        if (!u.email) {
            skip('Tidak ada email, skip');
            stats.skipped++;
            continue;
        }

        if (DRY_RUN) {
            skip(`DRY RUN — akan createUser uid=${u.uid} email=${u.email} claims=${JSON.stringify(u.customClaims || {})}`);
            continue;
        }

        // Cek apakah UID sudah ada di staging
        let existsByUid = false;
        try {
            await authStaging.getUser(u.uid);
            existsByUid = true;
        } catch (e) {
            if (e.code !== 'auth/user-not-found') {
                fail(`Gagal cek UID ${u.uid}: ${e.message}`);
                stats.errors++;
                continue;
            }
        }

        if (existsByUid) {
            // UID sudah ada → update password + claims saja
            try {
                await authStaging.updateUser(u.uid, {
                    password:      PASSWORD,
                    emailVerified: true,
                    disabled:      false,
                });
                if (u.customClaims && Object.keys(u.customClaims).length > 0) {
                    await authStaging.setCustomUserClaims(u.uid, u.customClaims);
                }
                ok(`Updated (UID exist) — ${u.email}`);
                stats.updated++;
            } catch (e) {
                fail(`Gagal update ${u.email}: ${e.message}`);
                stats.errors++;
            }
            continue;
        }

        // Cek apakah email sudah dipakai UID lain di staging
        let existingUidByEmail = null;
        try {
            const existing = await authStaging.getUserByEmail(u.email);
            existingUidByEmail = existing.uid;
        } catch (e) {
            // auth/user-not-found = belum ada, lanjut
        }

        if (existingUidByEmail) {
            // Email ada tapi UID berbeda → hapus dulu, recreate dengan UID prod
            warn(`Email ${u.email} sudah ada di staging (UID: ${existingUidByEmail}), hapus + recreate`);
            try {
                await authStaging.deleteUser(existingUidByEmail);
                ok(`Deleted conflicting UID ${existingUidByEmail}`);
                stats.deleted++;
            } catch (e) {
                fail(`Gagal hapus conflicting user: ${e.message}`);
                stats.errors++;
                continue;
            }
        }

        // Buat user baru dengan UID prod
        try {
            await authStaging.createUser({
                uid:           u.uid,
                email:         u.email,
                displayName:   u.displayName || undefined,
                phoneNumber:   u.phoneNumber || undefined,
                emailVerified: true,      // langsung verified, skip email konfirmasi
                password:      PASSWORD,
            });

            // Copy custom claims
            if (u.customClaims && Object.keys(u.customClaims).length > 0) {
                await authStaging.setCustomUserClaims(u.uid, u.customClaims);
                ok(`Created — ${u.email} | claims: ${JSON.stringify(u.customClaims)}`);
            } else {
                ok(`Created — ${u.email}`);
            }

            stats.created++;
        } catch (e) {
            fail(`Gagal buat ${u.email}: ${e.message}`);
            stats.errors++;
        }
    }
}

// ─── Step 3: Verifikasi hasil ────────────────────────────────────────────────

async function verify() {
    log('\n── STEP 3: Verifikasi staging users ───────────────────────────────');

    const result = await authStaging.listUsers(1000);
    log(`   Total staging users sekarang: ${result.users.length}\n`);

    for (const u of result.users) {
        log(`   ${u.email || '(no email)'}`);
        log(`      UID    : ${u.uid}`);
        log(`      Claims : ${JSON.stringify(u.customClaims || {})}`);
        log(`      Verify : ${u.emailVerified}`);
    }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function run() {
    log('═'.repeat(60));
    log('👤 CLONE AUTH USERS: PROD → STAGING');
    if (DRY_RUN) log('   ⚠️  DRY RUN — tidak ada yang ditulis');
    log('═'.repeat(60));

    await deleteStaleUser();
    await cloneUsers();

    if (!DRY_RUN) await verify();

    log('\n' + '═'.repeat(60));
    log('📊 SUMMARY');
    log(`   Created  : ${stats.created}`);
    log(`   Updated  : ${stats.updated}`);
    log(`   Deleted  : ${stats.deleted}`);
    log(`   Skipped  : ${stats.skipped}`);
    log(`   Errors   : ${stats.errors}`);
    log('');
    log(`💡 Login ke staging dengan password: ${PASSWORD}`);
    log('═'.repeat(60));
}

run()
    .then(() => process.exit(stats.errors > 0 ? 1 : 0))
    .catch(e => { console.error(e); process.exit(1); });
