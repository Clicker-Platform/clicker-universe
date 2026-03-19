import { adminDb } from '@/lib/firebase-admin';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const siteId = searchParams.get('siteId');

    if (!id || !siteId) {
        return NextResponse.json({ error: 'Missing id or siteId' }, { status: 400 });
    }

    try {
        const doc = await adminDb.collection('sites').doc(siteId).collection('forms').doc(id).get();
        if (!doc.exists || doc.data()?.isPublished === false) {
            return NextResponse.json({ error: 'Form not found' }, { status: 404 });
        }
        return NextResponse.json({ id: doc.id, ...doc.data() });
    } catch (error) {
        console.error('Error fetching form:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
