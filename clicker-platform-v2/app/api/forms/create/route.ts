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

        // Remove id and siteId from data to avoid storing them as fields
        const { id, ...data } = form;
        siteId = form.siteId;

        if (!siteId) {
            return NextResponse.json({ error: 'Missing siteId' }, { status: 400 });
        }

        let docRef;
        if (id) {
            // Update
            docRef = adminDb.collection('sites').doc(siteId).collection('forms').doc(id);
            await docRef.set({ ...data, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        } else {
            // Create
            const res = await adminDb.collection('sites').doc(siteId).collection('forms').add({
                ...data,
                createdAt: FieldValue.serverTimestamp()
            });
            docRef = res;
        }

        return NextResponse.json({ success: true, id: docRef.id });
    } catch (error) {
        logger.error('form.create.failed', { siteId, error });
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
