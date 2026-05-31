import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';
import { listAccounts } from '@/lib/account/admin-api';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface AccountListItem {
    uid: string;
    email: string;
    fullName: string | null;
    status: 'pending' | 'active';
    createdVia: 'register' | 'purchase';
    createdAt: number | null;
}

export async function GET(req: NextRequest) {
    const siteId = req.headers.get('x-site-id');
    if (!siteId) {
        return NextResponse.json({ error: 'no_site' }, { status: 400 });
    }

    try {
        // --- SECURITY CHECK START ---
        const authHeader = req.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized: Missing token' }, { status: 401 });
        }
        const idToken = authHeader.split('Bearer ')[1];

        try {
            const decodedToken = await adminAuth.verifyIdToken(idToken);
            const requesterUid = decodedToken.uid;

            // Check if requester is Owner of the site OR a member of it
            const siteDoc = await adminDb.collection('sites').doc(siteId).get();
            if (!siteDoc.exists) return NextResponse.json({ error: 'Site not found' }, { status: 404 });
            const siteData = siteDoc.data();

            let isAuthorized = false;

            if (siteData?.ownerId === requesterUid) {
                isAuthorized = true;
            } else {
                const memberDoc = await adminDb.collection('sites').doc(siteId).collection('members').doc(requesterUid).get();
                if (memberDoc.exists) {
                    isAuthorized = true;
                }
            }

            if (!isAuthorized) {
                return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
            }
        } catch (authError) {
            logger.error('account.admin.list.auth.failed', { siteId, error: authError });
            return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
        }
        // --- SECURITY CHECK END ---

        const accounts = await listAccounts(siteId);
        const items: AccountListItem[] = accounts.map((a) => ({
            uid: a.uid,
            email: a.email,
            fullName: a.fullName ?? null,
            status: a.status,
            createdVia: a.createdVia,
            createdAt: a.createdAt?.toMillis?.() ?? null,
        }));

        return NextResponse.json({ accounts: items });
    } catch (error) {
        logger.error('account.admin.list.failed', { siteId, error });
        return NextResponse.json({ error: 'server_error' }, { status: 500 });
    }
}
