/**
 * backfill-member-codes.ts
 *
 * One-time migration: assigns a memberCode to every member that doesn't have one,
 * and initialises the counter doc so future createMember() calls continue from
 * the correct sequence.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register scripts/backfill-member-codes.ts \
 *     --siteId <YOUR_SITE_ID> \
 *     [--prefix MBR]
 *
 * Options:
 *   --siteId   Required. The Firestore site document ID (e.g. the value in useSite().siteId)
 *   --prefix   Optional. The code prefix to use (default: MBR). Max 5 chars, uppercase.
 *   --dry-run  Optional. Print what would be written without committing to Firestore.
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// --- Init Admin ---

function initAdmin() {
    if (getApps().length > 0) return getApps()[0];
    const key = process.env.GCP_SERVICE_ACCOUNT_KEY;
    if (key) {
        try {
            return initializeApp({ credential: cert(JSON.parse(key)) });
        } catch (_) {}
    }
    return initializeApp();
}

const db = getFirestore(initAdmin());

// --- CLI Args ---

const args = process.argv.slice(2);
const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i !== -1 ? args[i + 1] : undefined;
};

const SITE_ID  = get('--siteId');
const PREFIX   = (get('--prefix') || 'MBR').toUpperCase().slice(0, 5);
const DRY_RUN  = args.includes('--dry-run');

if (!SITE_ID) {
    console.error('❌  Missing required argument: --siteId <YOUR_SITE_ID>');
    process.exit(1);
}

// --- Paths (mirrors api.ts constants) ---

const MEMBERS_PATH = `sites/${SITE_ID}/modules/membership/members`;
const COUNTER_PATH = `sites/${SITE_ID}/modules/membership/settings/counter`;

// --- Main ---

async function run() {
    console.log(`\n🔍  Site:    ${SITE_ID}`);
    console.log(`🏷️   Prefix:  ${PREFIX}`);
    console.log(`🧪  Dry-run: ${DRY_RUN}\n`);

    // 1. Fetch all members without a memberCode
    const snap = await db.collection(MEMBERS_PATH)
        .where('memberCode', '==', null)        // covers explicit null
        .get();

    // Firestore doesn't support "field does not exist" queries directly —
    // fetch all and filter client-side for missing field too.
    const allSnap = await db.collection(MEMBERS_PATH).get();
    const toBackfill = allSnap.docs.filter(d => !d.data().memberCode);

    if (toBackfill.length === 0) {
        console.log('✅  All members already have a memberCode. Nothing to do.');
        return;
    }

    console.log(`📋  Found ${toBackfill.length} member(s) without a code.`);

    // 2. Sort by createdAt ascending so codes are assigned in join order
    toBackfill.sort((a, b) => {
        const tA = a.data().createdAt?.toMillis?.() ?? 0;
        const tB = b.data().createdAt?.toMillis?.() ?? 0;
        return tA - tB;
    });

    // 3. Read current counter (may not exist yet)
    const counterSnap = await db.doc(COUNTER_PATH).get();
    let counter = counterSnap.exists ? (counterSnap.data()!.memberCount || 0) : 0;

    // 4. Batch write (Firestore limit: 500 ops per batch)
    const BATCH_SIZE = 400;
    let batch = db.batch();
    let opsInBatch = 0;

    for (const memberDoc of toBackfill) {
        counter++;
        const memberCode = `${PREFIX}-${String(counter).padStart(3, '0')}`;
        const data = memberDoc.data();

        console.log(`  ${memberCode}  →  ${data.fullName} (${data.phoneNumber})`);

        if (!DRY_RUN) {
            batch.update(memberDoc.ref, { memberCode });
            opsInBatch++;

            if (opsInBatch >= BATCH_SIZE) {
                await batch.commit();
                batch = db.batch();
                opsInBatch = 0;
            }
        }
    }

    // 5. Update the counter doc so new members continue from the right number
    if (!DRY_RUN) {
        if (opsInBatch > 0) {
            batch.set(db.doc(COUNTER_PATH), { memberCount: counter }, { merge: true });
            opsInBatch++;
            await batch.commit();
        } else {
            await db.doc(COUNTER_PATH).set({ memberCount: counter }, { merge: true });
        }
        console.log(`\n✅  Backfilled ${toBackfill.length} member(s). Counter set to ${counter}.`);
    } else {
        console.log(`\n🧪  Dry-run complete. Would have backfilled ${toBackfill.length} member(s) and set counter to ${counter}.`);
    }
}

run().catch(err => {
    console.error('❌  Script failed:', err);
    process.exit(1);
});
