import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireAuthedMember } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAuthedMember(req);
  if (!auth.ok) return auth.res;

  const limit = Math.min(Number(new URL(req.url).searchParams.get('limit') ?? 30), 90);

  try {
    const snap = await adminDb
      .collection('sites').doc(auth.session.siteId)
      .collection('platform').doc('aiCreditLedger')
      .collection('daily')
      .orderBy('date', 'desc')
      .limit(limit)
      .get();

    const days = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return NextResponse.json({ days });
  } catch (err: unknown) {
    console.error('[ai-usage] query failed:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
