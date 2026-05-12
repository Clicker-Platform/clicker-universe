import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuthedMember } from '@/lib/api-auth';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

type Action = 'new' | 'read' | 'archived' | 'delete';
const FIRESTORE_BATCH_LIMIT = 500;

function buildStatusPatch(action: Exclude<Action, 'delete'>, actor: { uid: string; email: string }) {
    const now = FieldValue.serverTimestamp();
    const patch: Record<string, unknown> = {
        status: action,
        lastActionAt: now,
        lastActionBy: actor,
    };
    if (action === 'read') {
        patch.readAt = now;
        patch.readBy = actor;
    } else if (action === 'archived') {
        patch.archivedAt = now;
        patch.archivedBy = actor;
    }
    return patch;
}

export async function POST(request: NextRequest) {
    const auth = await requireAuthedMember(request);
    if (!auth.ok) return auth.res;
    const { siteId, uid, email } = auth.session;
    const actor = { uid, email };

    try {
        const body = await request.json();
        const { id, ids, action } = body as { id?: string; ids?: string[]; action?: Action };

        if (!action || (!id && !Array.isArray(ids))) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }
        if (action !== 'delete' && !['new', 'read', 'archived'].includes(action)) {
            return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

        const targetIds = Array.isArray(ids) ? ids.filter(Boolean) : [id!];
        if (targetIds.length === 0) {
            return NextResponse.json({ error: 'No ids provided' }, { status: 400 });
        }

        const inboxRef = adminDb.collection('sites').doc(siteId).collection('inbox');

        // Single-id fast path keeps prior behavior unchanged.
        if (targetIds.length === 1) {
            const docRef = inboxRef.doc(targetIds[0]);
            if (action === 'delete') {
                await docRef.delete();
            } else {
                await docRef.update(buildStatusPatch(action, actor));
            }
            return NextResponse.json({ success: true, count: 1 });
        }

        // Bulk path: chunk into 500-op batches (Firestore limit).
        let processed = 0;
        for (let i = 0; i < targetIds.length; i += FIRESTORE_BATCH_LIMIT) {
            const slice = targetIds.slice(i, i + FIRESTORE_BATCH_LIMIT);
            const batch = adminDb.batch();
            for (const docId of slice) {
                const docRef = inboxRef.doc(docId);
                if (action === 'delete') {
                    batch.delete(docRef);
                } else {
                    batch.update(docRef, buildStatusPatch(action, actor));
                }
            }
            await batch.commit();
            processed += slice.length;
        }

        return NextResponse.json({ success: true, count: processed });
    } catch (error) {
        logger.error('crm.submission.update.failed', { siteId, error });
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
