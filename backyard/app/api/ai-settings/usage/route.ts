import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireSuperadmin } from '@/lib/require-superadmin';

export const dynamic = 'force-dynamic';

// GET /api/ai-settings/usage?siteId=xxx&limit=50
// Returns topup entries only — debit is aggregated in daily/ collection
export async function GET(req: NextRequest) {
  const auth = await requireSuperadmin(req);
  if (!auth.ok) return auth.res;
  try {
    const { searchParams } = new URL(req.url);
    const siteId = searchParams.get('siteId');
    const pageLimit = Math.min(Number(searchParams.get('limit') ?? 50), 100);

    if (siteId) {
      const snap = await adminDb
        .collection('sites').doc(siteId)
        .collection('platform').doc('aiCreditLedger')
        .collection('entries')
        .where('type', '==', 'topup')
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

    // Cross-site: fetch topup entries from all sites
    const sitesSnap = await adminDb.collection('sites').limit(50).get();
    const allEntries: unknown[] = [];

    await Promise.all(
      sitesSnap.docs.map(async (siteDoc) => {
        const sid = siteDoc.id;
        const snap = await adminDb
          .collection('sites').doc(sid)
          .collection('platform').doc('aiCreditLedger')
          .collection('entries')
          .where('type', '==', 'topup')
          .orderBy('createdAt', 'desc')
          .limit(5)
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
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
