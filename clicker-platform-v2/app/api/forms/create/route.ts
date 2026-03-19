import { adminDb, FieldValue } from '@/lib/firebase-admin';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        // const session = (await cookies()).get('session')?.value;
        // if (!session) {
        //     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        // }

        const form = await request.json();

        // Remove id and siteId from data to avoid storing them as fields
        const { id, siteId, ...data } = form;

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
        console.error('Error saving form:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
