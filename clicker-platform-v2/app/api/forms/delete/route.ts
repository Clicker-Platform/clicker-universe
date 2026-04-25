import { adminDb } from '@/lib/firebase-admin';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function DELETE(request: Request) {
    try {
        // const session = (await cookies()).get('session')?.value;
        // if (!session) {
        //     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        // }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        const siteId = searchParams.get('siteId');

        if (!id) {
            return NextResponse.json({ error: 'Missing Form ID' }, { status: 400 });
        }

        if (!siteId) {
            return NextResponse.json({ error: 'Missing siteId' }, { status: 400 });
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
        const { searchParams } = new URL(request.url);
        const siteId = searchParams.get('siteId') ?? undefined;
        logger.error('form.delete.failed', { siteId, error });
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
