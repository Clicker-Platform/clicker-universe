import { adminDb } from '@/lib/firebase-admin';
// Dynamic require to prevent Turbopack from hashing the module name
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { FieldValue } = require('firebase-admin/firestore') as typeof import('firebase-admin/firestore');
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        let body;
        try {
            const text = await request.text();
            if (!text) return NextResponse.json({ error: 'Empty body' }, { status: 400 });
            body = JSON.parse(text);
        } catch (e) {
            return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
        }

        console.log('Analytics received body:', JSON.stringify(body, null, 2));
        console.log('Analytics received headers:', JSON.stringify(Object.fromEntries(request.headers.entries()), null, 2));
        const { type, id, siteId: bodySiteId } = body;

        // FIXED: Extract siteId from Body (preferred) or Headers
        const siteId = bodySiteId || request.headers.get('x-site-id');

        if (!siteId || siteId === 'default' || siteId === 'pending') {
            console.warn('[Analytics] Skipped tracking: Invalid siteId', siteId);
            return NextResponse.json({ error: 'Invalid site context' }, { status: 400 });
        }

        if (!adminDb) {
            console.error('[Analytics] adminDb is not initialized');
            return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });
        }

        let batch;
        try {
            batch = adminDb.batch();
        } catch (dbError: any) {
            console.error('[Analytics] Failed to create batch:', dbError);
            return NextResponse.json({ error: 'Database connection failed', details: dbError.message }, { status: 500 });
        }

        // 1. Track Page Views (Site Scoped)
        if (type === 'page_view') {
            const statsRef = adminDb.collection('sites').doc(siteId).collection('analytics').doc('siteStats');
            batch.set(statsRef, { pageViews: FieldValue.increment(1) }, { merge: true });
        }

        // 2. Track Link Clicks
        if (type === 'link_click' && id) {
            const linkRef = adminDb.collection('sites').doc(siteId).collection('links').doc(id);
            // Increment local link click - use set merge to support creation if missing
            batch.set(linkRef, { clicks: FieldValue.increment(1) }, { merge: true });

            // Increment site-level click count
            const statsRef = adminDb.collection('sites').doc(siteId).collection('analytics').doc('siteStats');
            batch.set(statsRef, { totalClicks: FieldValue.increment(1) }, { merge: true });
        }

        // 3. Track Product Clicks
        if (type === 'product_click' && id) {
            const productRef = adminDb.collection('sites').doc(siteId).collection('products').doc(id);
            // Increment local product click - use set merge to support creation if missing
            batch.set(productRef, { clicks: FieldValue.increment(1) }, { merge: true });

            // Increment site-level click count
            const statsRef = adminDb.collection('sites').doc(siteId).collection('analytics').doc('siteStats');
            batch.set(statsRef, { totalClicks: FieldValue.increment(1) }, { merge: true });
        }

        try {
            await batch.commit();
            console.log('[Analytics] Batch committed successfully');
        } catch (commitError: any) {
            console.error('[Analytics] Batch commit failed:', commitError);
            return NextResponse.json({ error: 'Database write failed', details: commitError.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        // PERMISSION_DENIED (GRPC code 7) often happens in local dev without service account keys
        // "Could not load the default credentials" happens when no key and no gcloud auth
        const errorMessage = error?.message || '';

        if (
            error?.code === 7 ||
            error?.code === 'PERMISSION_DENIED' ||
            errorMessage.includes('Could not load the default credentials')
        ) {
            console.warn('[Analytics] Skipped tracking: Missing Service Account or ADC instructions.');
            return NextResponse.json({ success: true, warning: 'Tracking skipped (no credentials)' });
        }

        console.error('Analytics Error:', JSON.stringify(error, null, 2), error);
        return NextResponse.json({
            error: 'Internal Server Error',
            details: error?.message || 'Unknown error',
            code: error?.code
        }, { status: 500 });
    }
}
