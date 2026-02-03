import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { id, type } = body; // id is UID for member, Email for invitation
        const siteId = req.headers.get('x-site-id');

        if (!siteId) {
            return NextResponse.json({ error: 'Site ID is required' }, { status: 400 });
        }
        if (!id || !type) {
            return NextResponse.json({ error: 'ID and Type are required' }, { status: 400 });
        }

        // --- SECURITY CHECK START ---
        // Need to duplicate verification logic or move to a shared lib helper?
        // For now, duplicate to be self-contained and safe.
        const authHeader = req.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized: Missing token' }, { status: 401 });
        }

        // Dynamic import auth to avoid non-edge issues if deployed to edge, though this is node env
        const { adminAuth } = await import('@/lib/firebase-admin');

        const idToken = authHeader.split('Bearer ')[1];
        try {
            const decodedToken = await adminAuth.verifyIdToken(idToken);
            const requesterUid = decodedToken.uid;

            // Check Permissions
            const siteDoc = await adminDb.collection('sites').doc(siteId).get();
            if (!siteDoc.exists) return NextResponse.json({ error: 'Site not found' }, { status: 404 });
            const siteData = siteDoc.data();

            let isAuthorized = false;

            if (siteData?.ownerId === requesterUid) {
                isAuthorized = true;
            } else {
                const memberDoc = await adminDb.collection('sites').doc(siteId).collection('members').doc(requesterUid).get();
                if (memberDoc.exists) {
                    const memberData = memberDoc.data();
                    if (memberData?.role === 'owner' || memberData?.permissions?.includes('settings')) {
                        isAuthorized = true;
                    }
                }
            }

            if (!isAuthorized) {
                return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
            }
        } catch (authError) {
            console.error('Auth check failed', authError);
            return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
        }
        // --- SECURITY CHECK END ---

        console.log(`[Remove API] Removing ${type} ${id} from site ${siteId}`);

        if (type === 'member') {
            await adminDb.collection('sites').doc(siteId).collection('members').doc(id).delete();
        } else if (type === 'invitation') {
            await adminDb.collection('sites').doc(siteId).collection('invitations').doc(id).delete();
        } else {
            return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
        }

        return NextResponse.json({ message: 'Removed successfully' });

    } catch (error: any) {
        console.error('[Remove API] Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
