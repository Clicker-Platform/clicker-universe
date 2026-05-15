import { adminDb, FieldValue } from '@/lib/firebase-admin';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuthedMember } from '@/lib/api-auth';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    const auth = await requireAuthedMember(req);
    if (!auth.ok) return auth.res;
    const { siteId } = auth.session;

    try {
        const form = await req.json();

        // Remove id and siteId from data to avoid storing them as fields
        const { id, siteId: _siteId, ...data } = form; // siteId excluded from data intentionally

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
