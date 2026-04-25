import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb, Timestamp } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { email, password, role = 'staff', permissions = [], moduleAccess = {} } = body;
        const siteId = req.headers.get('x-site-id');

        if (!siteId) {
            return NextResponse.json({ error: 'Site ID is required' }, { status: 400 });
        }
        if (!email) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 });
        }
        // Password is required for NEW users, but optional if we are adding an existing user?
        // Let's enforce it for now as this is "Provisioning".
        if (password && password.length < 6) {
            return NextResponse.json({ error: 'Password too short' }, { status: 400 });
        }

        // --- SECURITY CHECK START ---
        const authHeader = req.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized: Missing token' }, { status: 401 });
        }
        const idToken = authHeader.split('Bearer ')[1];

        try {
            const decodedToken = await adminAuth.verifyIdToken(idToken);
            const requesterUid = decodedToken.uid;

            // Check if requester is Owner/Manager of the site
            // 1. Check Site Metadata (Owner)
            const siteDoc = await adminDb.collection('sites').doc(siteId).get();
            if (!siteDoc.exists) return NextResponse.json({ error: 'Site not found' }, { status: 404 });
            const siteData = siteDoc.data();

            let isAuthorized = false;

            if (siteData?.ownerId === requesterUid) {
                isAuthorized = true;
            } else {
                // 2. Check Member Role (Staff with permissions)
                const memberDoc = await adminDb.collection('sites').doc(siteId).collection('members').doc(requesterUid).get();
                if (memberDoc.exists) {
                    const memberData = memberDoc.data();
                    // Must be 'owner' role OR have 'settings' permission to add/edit users
                    if (memberData?.role === 'owner' || memberData?.permissions?.includes('settings')) {
                        isAuthorized = true;
                    }
                }
            }

            if (!isAuthorized) {
                return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
            }
        } catch (authError) {
            logger.error('team.add.auth.failed', { siteId: siteId ?? 'platform', error: authError });
            return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
        }
        // --- SECURITY CHECK END ---

        let uid = null;
        let displayName = '';
        let photoURL = '';
        let isNewUser = false;

        // 1. Try to Create User
        try {
            const userRecord = await adminAuth.createUser({
                email,
                password,
                displayName: email.split('@')[0], // Default display name
            });
            uid = userRecord.uid;
            displayName = userRecord.displayName || '';
            photoURL = userRecord.photoURL || '';
            isNewUser = true;
        } catch (error: any) {
            if (error.code === 'auth/email-already-exists') {
                // Fetch existing user
                const userRecord = await adminAuth.getUserByEmail(email);
                uid = userRecord.uid;
                displayName = userRecord.displayName || '';
                photoURL = userRecord.photoURL || '';
            } else {
                throw error;
            }
        }

        if (!uid) {
            throw new Error("Failed to resolve User UID");
        }

        // 2. Add to Site Members (Directly Active)
        const batch = adminDb.batch();

        const memberRef = adminDb.collection('sites').doc(siteId).collection('members').doc(uid);
        batch.set(memberRef, {
            email,
            role,
            permissions, // Array of module keys (legacy)
            moduleAccess, // Granular permissions - THE FIX
            displayName,
            photoURL,
            status: 'active',
            joinedAt: Timestamp.now(),
            addedBy: 'admin', // Metadata
        }, { merge: true });

        // Cleanup any potential old invites if they existed (unlikely if direct create, but good practice)
        const inviteRef = adminDb.collection('sites').doc(siteId).collection('invitations').doc(email);
        batch.delete(inviteRef);

        await batch.commit();

        return NextResponse.json({
            message: isNewUser ? 'User created and added to team.' : 'Existing user added to team.'
        });

    } catch (error: any) {
        logger.error('team.add.failed', { siteId: req.headers.get('x-site-id') ?? 'platform', error });
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
