import { adminDb, FieldValue } from '@/lib/firebase-admin';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuthedMember } from '@/lib/api-auth';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    const auth = await requireAuthedMember(req);
    if (!auth.ok) return auth.res;
    const { siteId } = auth.session;

    try {
        const form = await req.json();
        const { id, siteId: _siteId, ...data } = form;

        if (!id) {
            return NextResponse.json({ error: 'Missing Form ID' }, { status: 400 });
        }

        const docRef = adminDb.collection('sites').doc(siteId).collection('forms').doc(id);
        await docRef.set({ ...data, updatedAt: FieldValue.serverTimestamp() }, { merge: true });

        return NextResponse.json({ success: true, id });
    } catch (error) {
        logger.error('form.update.failed', { siteId, error });
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
