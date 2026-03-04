import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb, Timestamp } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { uid, email, siteId } = body;

        if (!uid || !email || !siteId) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        console.log(`[Check Access] Checking access rights for ${email} at site ${siteId}`);

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

        console.log(`[Check Access] Found pending access for role: ${accessData.role}`);

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

        console.log(`[Check Access] Successfully granted access to ${email}.`);

        return NextResponse.json({ status: 'joined', role: accessData.role });

    } catch (error: any) {
        console.error('[Check Access] Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
