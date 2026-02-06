import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        console.log('Analytics received body:', body); // Debug log
        const { type, id, siteId: bodySiteId } = body;

        // FIXED: Extract siteId from Body (preferred) or Headers
        const siteId = bodySiteId || request.headers.get('x-site-id');

        if (!siteId || siteId === 'default' || siteId === 'pending') {
            console.warn('[Analytics] Skipped tracking: Invalid siteId', siteId);
            return NextResponse.json({ error: 'Invalid site context' }, { status: 400 });
        }

        const batch = adminDb.batch();

        // 1. Track Page Views (Site Scoped)
        if (type === 'page_view') {
            const statsRef = adminDb.collection('sites').doc(siteId).collection('analytics').doc('siteStats');
            batch.set(statsRef, { pageViews: FieldValue.increment(1) }, { merge: true });
        }

        // 2. Track Link Clicks
        if (type === 'link_click' && id) {
            const linkRef = adminDb.collection('sites').doc(siteId).collection('links').doc(id);
            // Increment local link click
            batch.update(linkRef, { clicks: FieldValue.increment(1) });

            // Increment site-level click count
            const statsRef = adminDb.collection('sites').doc(siteId).collection('analytics').doc('siteStats');
            batch.set(statsRef, { totalClicks: FieldValue.increment(1) }, { merge: true });
        }

        // 3. Track Product Clicks
        if (type === 'product_click' && id) {
            const productRef = adminDb.collection('sites').doc(siteId).collection('products').doc(id);
            // Increment local product click
            batch.update(productRef, { clicks: FieldValue.increment(1) });

            // Increment site-level click count
            const statsRef = adminDb.collection('sites').doc(siteId).collection('analytics').doc('siteStats');
            batch.set(statsRef, { totalClicks: FieldValue.increment(1) }, { merge: true });
        }

        await batch.commit();

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
