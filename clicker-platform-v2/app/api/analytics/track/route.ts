import { NextResponse } from 'next/server';
import { adminDb, FieldValue } from '@/lib/firebase-admin';
import { randomShardId } from '@/lib/analytics/counters';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const headersList = Object.fromEntries(request.headers.entries());

        let body;
        try {
            if (headersList['x-firebase-parsed-body']) {
                body = JSON.parse(headersList['x-firebase-parsed-body']);
            } else {
                const text = await request.text();
                body = text ? JSON.parse(text) : null;
            }
            if (!body) return NextResponse.json({ error: 'Empty body' }, { status: 400 });
        } catch (e: any) {
            return NextResponse.json({ error: 'Invalid JSON body', details: e.message }, { status: 400 });
        }

        const { type, id, siteId: bodySiteId } = body;
        const siteId = bodySiteId || request.headers.get('x-site-id');

        if (!siteId || siteId === 'default' || siteId === 'pending') {
            logger.warn('analytics.invalid.siteId', { siteId: 'platform' });
            return NextResponse.json({ error: 'Invalid site context' }, { status: 400 });
        }

        let batch;
        try {
            batch = adminDb.batch();
        } catch (dbError: any) {
            logger.error('analytics.batch.failed', { siteId: siteId ?? 'platform', error: dbError });
            return NextResponse.json({ error: 'Database connection failed', details: dbError.message }, { status: 500 });
        }

        // Pick a random shard to distribute write load across 10 documents
        const shardId = randomShardId();
        const shard = adminDb.collection('sites').doc(siteId).collection('analytics_shards').doc(shardId);

        if (type === 'page_view') {
            batch.set(shard, { pageViews: FieldValue.increment(1) }, { merge: true });
        }

        if (type === 'link_click' && id) {
            const linkRef = adminDb.doc(`sites/${siteId}/links/${id}`);
            batch.set(linkRef, { clicks: FieldValue.increment(1) }, { merge: true });
            batch.set(shard, { totalClicks: FieldValue.increment(1) }, { merge: true });
        }

        if (type === 'product_click' && id) {
            const productRef = adminDb.doc(`sites/${siteId}/products/${id}`);
            batch.set(productRef, { clicks: FieldValue.increment(1) }, { merge: true });
            batch.set(shard, { totalClicks: FieldValue.increment(1) }, { merge: true });
        }

        try {
            await batch.commit();
            return NextResponse.json({ success: true });
        } catch (commitError: any) {
            logger.error('analytics.batch.failed', { siteId: siteId ?? 'platform', error: commitError });
            return NextResponse.json({ error: 'Database write failed', details: commitError.message }, { status: 500 });
        }

    } catch (error: any) {
        const errorMessage = error?.message || '';

        if (
            error?.code === 7 ||
            error?.code === 'permission-denied' ||
            errorMessage.includes('Missing or insufficient permissions')
        ) {
            logger.warn('analytics.permission.denied', { siteId: 'platform', error });
            return NextResponse.json({ success: true, warning: 'Tracking skipped (permission denied by rules)' });
        }

        logger.error('analytics.batch.failed', { siteId: 'platform', error });
        return NextResponse.json({
            error: 'Internal Server Error',
            details: error?.message || 'Unknown error',
            code: error?.code
        }, { status: 500 });
    }
}
