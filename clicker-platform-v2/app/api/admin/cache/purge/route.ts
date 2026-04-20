import { NextRequest, NextResponse } from 'next/server';
import { invalidate } from '@/lib/cache/redis';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const authHeader = req.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
        }

        const token = authHeader.slice(7);
        const { adminAuth } = await import('@/lib/firebase-admin');
        const decoded = await adminAuth.verifyIdToken(token);

        const { siteId } = await req.json();
        if (!siteId) {
            return NextResponse.json({ error: 'siteId required' }, { status: 400 });
        }

        const claims = decoded as any;
        const allowedSites: string[] = claims.siteIds || [];
        if (!allowedSites.includes(siteId) && claims.role !== 'superadmin') {
            return NextResponse.json({ error: 'forbidden' }, { status: 403 });
        }

        const deleted = await invalidate(`site:${siteId}:*`);
        return NextResponse.json({ ok: true, deleted });
    } catch (err) {
        console.error('[purge] error:', err);
        return NextResponse.json({ error: 'internal' }, { status: 500 });
    }
}
