import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, collection, writeBatch, increment } from 'firebase/firestore';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        console.log('--- Incoming POST Analytics ---');
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
            console.error('Body parse failed:', e.message);
            return NextResponse.json({ error: 'Invalid JSON body', details: e.message }, { status: 400 });
        }

        const { type, id, siteId: bodySiteId } = body;
        const siteId = bodySiteId || request.headers.get('x-site-id');

        if (!siteId || siteId === 'default' || siteId === 'pending') {
            console.warn('[Analytics] Skipped tracking: Invalid siteId', siteId);
            return NextResponse.json({ error: 'Invalid site context' }, { status: 400 });
        }

        if (!db) {
            console.error('[Analytics] db is not initialized');
            return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });
        }

        let batch;
        try {
            batch = writeBatch(db);
        } catch (dbError: any) {
            console.error('[Analytics] Failed to create batch:', dbError);
            return NextResponse.json({ error: 'Database connection failed', details: dbError.message }, { status: 500 });
        }

        if (type === 'page_view') {
            const statsRef = doc(db, `sites/${siteId}/analytics/siteStats`);
            batch.set(statsRef, { pageViews: increment(1) }, { merge: true });
        }

        if (type === 'link_click' && id) {
            const linkRef = doc(db, `sites/${siteId}/links/${id}`);
            batch.set(linkRef, { clicks: increment(1) }, { merge: true });

            const statsRef = doc(db, `sites/${siteId}/analytics/siteStats`);
            batch.set(statsRef, { totalClicks: increment(1) }, { merge: true });
        }

        if (type === 'product_click' && id) {
            const productRef = doc(db, `sites/${siteId}/products/${id}`);
            batch.set(productRef, { clicks: increment(1) }, { merge: true });

            const statsRef = doc(db, `sites/${siteId}/analytics/siteStats`);
            batch.set(statsRef, { totalClicks: increment(1) }, { merge: true });
        }

        try {
            await batch.commit();
            console.log('[Analytics] Tracked successfully');
            return NextResponse.json({ success: true });
        } catch (commitError: any) {
            console.error('[Analytics] Failed to commit batch:', commitError);
            return NextResponse.json({ error: 'Database write failed', details: commitError.message }, { status: 500 });
        }

    } catch (error: any) {
        // PERMISSION_DENIED often happens in local dev or if rules restrict it
        const errorMessage = error?.message || '';

        if (
            error?.code === 7 ||
            error?.code === 'permission-denied' ||
            errorMessage.includes('Missing or insufficient permissions')
        ) {
            console.warn('[Analytics] Skipped tracking: Firestore rules denied access.');
            return NextResponse.json({ success: true, warning: 'Tracking skipped (permission denied by rules)' });
        }

        console.error('Analytics Error:', JSON.stringify(error, null, 2), error);
        return NextResponse.json({
            error: 'Internal Server Error',
            details: error?.message || 'Unknown error',
            code: error?.code
        }, { status: 500 });
    }
}
