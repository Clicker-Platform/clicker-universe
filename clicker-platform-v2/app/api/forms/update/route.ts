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
        const { id, ...data } = form; // ID should come from body if not in URL, but logical to expect it

        if (!id) {
            return NextResponse.json({ error: 'Missing Form ID' }, { status: 400 });
        }

        const docRef = adminDb.collection('forms').doc(id);
        await docRef.set({ ...data, updatedAt: FieldValue.serverTimestamp() }, { merge: true });

        return NextResponse.json({ success: true, id });
    } catch (error) {
        console.error('Error updating form:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
