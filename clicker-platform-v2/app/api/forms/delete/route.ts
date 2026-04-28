import { adminDb } from '@/lib/firebase-admin';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuthedMember } from '@/lib/api-auth';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function DELETE(req: NextRequest) {
    const auth = await requireAuthedMember(req);
    if (!auth.ok) return auth.res;
    const { siteId } = auth.session;

    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Missing Form ID' }, { status: 400 });
        }

        // Check if form is linked to any card
        const linksSnapshot = await adminDb
            .collection('sites').doc(siteId).collection('links')
            .where('type', '==', 'form')
            .where('formId', '==', id)
            .limit(1)
            .get();

        if (!linksSnapshot.empty) {
            return NextResponse.json(
                {
                    error: 'Cannot delete form because it is linked to a card.',
                    code: 'FORM_IN_USE'
                },
                { status: 409 }
            );
        }

        await adminDb.collection('sites').doc(siteId).collection('forms').doc(id).delete();

        return NextResponse.json({ success: true });
    } catch (error) {
        logger.error('form.delete.failed', { siteId, error });
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
