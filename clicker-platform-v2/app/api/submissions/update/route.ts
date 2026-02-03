import { adminDb } from '@/lib/firebase-admin';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
    try {
        // const session = (await cookies()).get('session')?.value;
        // if (!session) {
        //     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        // }

        const body = await request.json();
        const { id, action } = body;

        if (!id || !action) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const docRef = adminDb.collection('submissions').doc(id);

        if (action === 'delete') {
            await docRef.delete();
        } else if (['new', 'read', 'archived'].includes(action)) {
            await docRef.update({ status: action });
        } else {
            return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error updating submission:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
