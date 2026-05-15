import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { invalidate } from '@/lib/cache/redis';
import { logger } from '@/lib/logger';

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

        const claims = decoded as { siteIds?: string[]; role?: string };
        const allowedSites: string[] = claims.siteIds || [];
        if (!allowedSites.includes(siteId) && claims.role !== 'superadmin') {
            return NextResponse.json({ error: 'forbidden' }, { status: 403 });
        }

        const deleted = await invalidate(`site:${siteId}:*`);
        revalidatePath(`/${siteId}`);
        revalidatePath(`/${siteId}`, 'layout');
        return NextResponse.json({ ok: true, deleted });
    } catch (err) {
        logger.error('cache.purge.failed', { siteId: 'platform', error: err });
        return NextResponse.json({ error: 'internal' }, { status: 500 });
    }
}
