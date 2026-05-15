import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb, Timestamp } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    let siteId: string | undefined;
    try {
        const body = await req.json();
        const { uid, email, siteId: sid } = body;
        siteId = sid;

        if (!uid || !email || !siteId) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Token assertion — verify caller is actually the user they claim to be
        const authHeader = req.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        let decoded: { uid: string; email?: string };
        try {
            decoded = await adminAuth.verifyIdToken(authHeader.slice(7));
        } catch {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }
        if (decoded.uid !== uid || decoded.email !== email) {
            return NextResponse.json({ error: 'Token mismatch' }, { status: 403 });
        }

        // 1. Check if pending access grant exists (legacy invitations)
        const accessRef = adminDb.collection('sites').doc(siteId).collection('invitations').doc(email);
        const accessSnap = await accessRef.get();

        if (!accessSnap.exists) {
            return NextResponse.json({ status: 'no_access', message: 'No pending access found.' });
        }

        const accessData = accessSnap.data();
        if (!accessData) {
            return NextResponse.json({ status: 'error', message: 'Invalid access data' });
        }

        // 2. Promote to Member
        // Get user details ensuring we have latest
        const userRecord = await adminAuth.getUser(uid);

        const batch = adminDb.batch();

        const memberRef = adminDb.collection('sites').doc(siteId).collection('members').doc(uid);
        batch.set(memberRef, {
            email: userRecord.email,
            displayName: userRecord.displayName || '',
            photoURL: userRecord.photoURL || '',
            role: accessData.role,
            status: 'active',
            joinedAt: Timestamp.now(),
            acceptedAccessAt: Timestamp.now(),
            permissions: accessData.permissions || [] // Ensure permissions are carried over
        }, { merge: true });

        // Delete pending access
        batch.delete(accessRef);

        await batch.commit();

        return NextResponse.json({ status: 'joined', role: accessData.role });

    } catch (error: unknown) {
        logger.error('auth.check.failed', { siteId: siteId ?? 'platform', error });
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal Server Error' }, { status: 500 });
    }
}
