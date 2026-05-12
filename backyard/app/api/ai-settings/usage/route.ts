import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

// GET /api/ai-settings/usage?siteId=xxx&limit=20
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const siteId = searchParams.get('siteId');
    const pageLimit = Math.min(Number(searchParams.get('limit') ?? 20), 100);

    if (siteId) {
      const snap = await adminDb
        .collection('sites').doc(siteId)
        .collection('platform').doc('aiCreditLedger')
        .collection('entries')
        .orderBy('createdAt', 'desc')
        .limit(pageLimit)
        .get();

      const entries = snap.docs.map(d => ({
        id: d.id,
        siteId,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate?.()?.toISOString() ?? null,
      }));
      return NextResponse.json({ entries });
    }

    // Cross-site: fetch recent entries from all sites (expensive — cap at 5 sites)
    const sitesSnap = await adminDb.collection('sites').limit(50).get();
    const allEntries: unknown[] = [];

    await Promise.all(
      sitesSnap.docs.map(async (siteDoc) => {
        const sid = siteDoc.id;
        const snap = await adminDb
          .collection('sites').doc(sid)
          .collection('platform').doc('aiCreditLedger')
          .collection('entries')
          .orderBy('createdAt', 'desc')
          .limit(10)
          .get();
        snap.docs.forEach(d => {
          allEntries.push({
            id: d.id,
            siteId: sid,
            siteName: siteDoc.data().name ?? siteDoc.data().businessName ?? sid,
            ...d.data(),
            createdAt: d.data().createdAt?.toDate?.()?.toISOString() ?? null,
          });
        });
      })
    );

    allEntries.sort((a: any, b: any) =>
      (b.createdAt ?? '').localeCompare(a.createdAt ?? '')
    );

    return NextResponse.json({ entries: allEntries.slice(0, pageLimit) });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
