import { NextRequest, NextResponse } from 'next/server';
import { isFirestoreCritical, buildDedupeKey } from '@/lib/logger';

export const dynamic = 'force-dynamic';

interface ClientLogPayload {
    event: string;
    level: 'error' | 'warn' | 'info';
    siteId?: string;
    meta?: Record<string, unknown>;
}

/**
 * Client-side error beacon.
 *
 * Browsers cannot write to Firestore via firebase-admin (Node-only). This
 * endpoint accepts critical client errors and persists them server-side
 * using the same dedupe + quota logic as lib/logger.ts.
 *
 * Gating:
 * - event MUST be in FIRESTORE_CRITICAL_EVENTS whitelist (cheap spam guard)
 * - level MUST be 'error' (warn/info from client are console-only)
 *
 * No auth check by design — error beacons fire when a user is mid-session
 * and may have stale tokens. Public endpoint is safe because the whitelist
 * limits what can be written, dedupe key throttles by 5-minute windows, and
 * the daily 500-write quota caps total writes.
 */
export async function POST(req: NextRequest) {
    try {
        const body: ClientLogPayload = await req.json();
        const { event, level, siteId = 'platform', meta = {} } = body;

        if (!event || level !== 'error') {
            return NextResponse.json({ ok: false, reason: 'invalid' }, { status: 400 });
        }

        if (!isFirestoreCritical(event)) {
            // Silently drop non-whitelisted events — they're already in the
            // browser console / GCP Logs and don't warrant Firestore quota.
            return NextResponse.json({ ok: true, dropped: true });
        }

        const { adminDb } = await import('@/lib/firebase-admin');
        const { Timestamp, FieldValue } = await import('firebase-admin/firestore');

        // Quota check (same logic as logger.ts writeToFirestore)
        const metaRef = adminDb.collection('platform_meta').doc('log_quota');
        const metaSnap = await metaRef.get();
        const today = new Date().toISOString().slice(0, 10);
        const quotaMeta = metaSnap.data() as { writesToday: number; resetDate: string } | undefined;
        const writesToday = quotaMeta?.resetDate === today ? (quotaMeta.writesToday ?? 0) : 0;
        if (writesToday >= 500) {
            return NextResponse.json({ ok: true, throttled: true });
        }

        const dedupeKey = buildDedupeKey(siteId, event);
        const ttl = Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
        const ts = Timestamp.fromDate(new Date());

        await adminDb
            .collection('platform_logs')
            .doc(dedupeKey)
            .set(
                {
                    level,
                    event,
                    service: 'clicker-platform-client',
                    siteId,
                    meta,
                    ts,
                    ttl,
                    count: FieldValue.increment(1),
                },
                { merge: true }
            );

        await metaRef.set(
            { writesToday: FieldValue.increment(1), resetDate: today },
            { merge: true }
        );

        return NextResponse.json({ ok: true });
    } catch {
        // Beacon must never throw — if logging fails the original UX must
        // still proceed. Original error was already in browser console.
        return NextResponse.json({ ok: false }, { status: 500 });
    }
}
