import { adminDb, FieldValue } from '@/lib/firebase-admin';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    let siteId: string | undefined;
    try {
        // const session = (await cookies()).get('session')?.value;
        // if (!session) {
        //     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        // }

        const form = await request.json();
        const { id, ...data } = form;
        siteId = form.siteId;

        if (!id) {
            return NextResponse.json({ error: 'Missing Form ID' }, { status: 400 });
        }

        if (!siteId) {
            return NextResponse.json({ error: 'Missing siteId' }, { status: 400 });
        }

        const docRef = adminDb.collection('sites').doc(siteId).collection('forms').doc(id);
        await docRef.set({ ...data, updatedAt: FieldValue.serverTimestamp() }, { merge: true });

        return NextResponse.json({ success: true, id });
    } catch (error) {
        logger.error('form.update.failed', { siteId, error });
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
