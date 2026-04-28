import { adminDb } from '@/lib/firebase-admin';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuthedMember } from '@/lib/api-auth';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    const auth = await requireAuthedMember(request);
    if (!auth.ok) return auth.res;
    const { siteId } = auth.session;

    try {
        const body = await request.json();
        const { id, action } = body;

        if (!id || !action) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const docRef = adminDb.collection('sites').doc(siteId).collection('inbox').doc(id);

        if (action === 'delete') {
            await docRef.delete();
        } else if (['new', 'read', 'archived'].includes(action)) {
            await docRef.update({ status: action });
        } else {
            return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        logger.error('crm.submission.update.failed', { siteId, error });
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
