import { adminDb } from '@/lib/firebase-admin';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { FieldValue } = require('firebase-admin').firestore;
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
    try {
        // const session = (await cookies()).get('session')?.value;
        // if (!session) {
        //     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        // }

        const form = await request.json();

        // Remove id from data if it exists to avoid overwriting document key with inside data
        const { id, ...data } = form;

        let docRef;
        if (id) {
            // Update
            docRef = adminDb.collection('forms').doc(id);
            await docRef.set({ ...data, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        } else {
            // Create
            const res = await adminDb.collection('forms').add({
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
