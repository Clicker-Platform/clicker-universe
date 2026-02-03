import { adminDb } from '@/lib/firebase-admin';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function DELETE(request: Request) {
    try {
        // const session = (await cookies()).get('session')?.value;
        // if (!session) {
        //     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        // }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Missing Form ID' }, { status: 400 });
        }

        // Check if form is linked to any card
        const linksSnapshot = await adminDb
            .collection('links')
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

        await adminDb.collection('forms').doc(id).delete();


        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting form:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
