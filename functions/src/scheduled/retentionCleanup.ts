import * as admin from 'firebase-admin';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onCall, HttpsError } from 'firebase-functions/v2/https';

const PLATFORM_LOGS_RETENTION_DAYS = 7;
const EMAIL_LOG_RETENTION_DAYS = 30;
const BATCH_SIZE = 500;
const MAX_BATCHES = 20;

type CleanupTarget = 'platform_logs' | 'emailLog' | 'both';

interface CleanupResult {
    deletedPlatformLogs: number;
    deletedEmailLogs: number;
    durationMs: number;
}

async function deleteOlderThan(
    queryFactory: () => FirebaseFirestore.Query,
): Promise<number> {
    let total = 0;
    for (let i = 0; i < MAX_BATCHES; i++) {
        const snap = await queryFactory().limit(BATCH_SIZE).get();
        if (snap.size === 0) break;
        const batch = admin.firestore().batch();
        snap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
        total += snap.size;
        if (snap.size < BATCH_SIZE) break;
    }
    return total;
}

export async function runRetentionCleanup(target: CleanupTarget = 'both'): Promise<CleanupResult> {
    const start = Date.now();
    const now = Date.now();

    let deletedPlatformLogs = 0;
    let deletedEmailLogs = 0;
    let failed: string | null = null;

    try {
        if (target === 'platform_logs' || target === 'both') {
            const platformCutoff = admin.firestore.Timestamp.fromMillis(
                now - PLATFORM_LOGS_RETENTION_DAYS * 24 * 60 * 60 * 1000
            );
            // platform_logs uses `ts` field (set by clicker-platform-v2/lib/logger.ts).
            deletedPlatformLogs = await deleteOlderThan(() =>
                admin.firestore().collection('platform_logs').where('ts', '<', platformCutoff)
            );
        }

        if (target === 'emailLog' || target === 'both') {
            const emailCutoff = admin.firestore.Timestamp.fromMillis(
                now - EMAIL_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000
            );
            // emailLog uses `createdAt` field (set by clicker-platform-v2/lib/email/log.ts).
            deletedEmailLogs = await deleteOlderThan(() =>
                admin.firestore().collectionGroup('emailLog').where('createdAt', '<', emailCutoff)
            );
        }
    } catch (err) {
        failed = err instanceof Error ? err.message : String(err);
    }

    const durationMs = Date.now() - start;

    try {
        await admin.firestore().collection('platform_logs').doc().set({
            event: failed ? 'retention.cleanup.failed' : 'retention.cleanup.done',
            level: failed ? 'error' : 'info',
            data: { deletedPlatformLogs, deletedEmailLogs, durationMs, error: failed },
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    } catch {
        // swallow; cleanup must never throw
    }

    return { deletedPlatformLogs, deletedEmailLogs, durationMs };
}

export const retentionCleanup = onSchedule(
    {
        schedule: 'every day 02:00',
        timeZone: 'Asia/Jakarta',
        region: 'asia-southeast1',
    },
    async () => {
        await runRetentionCleanup();
    }
);

export const triggerRetentionCleanup = onCall(
    { region: 'asia-southeast1' },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'Auth required');
        }
        const data = (request.data ?? {}) as { target?: CleanupTarget };
        const target: CleanupTarget = data.target === 'platform_logs' || data.target === 'emailLog'
            ? data.target
            : 'both';
        return runRetentionCleanup(target);
    },
);
