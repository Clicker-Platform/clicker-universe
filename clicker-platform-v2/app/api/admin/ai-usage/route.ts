import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const siteId = req.headers.get('x-site-id');
  if (!siteId) return NextResponse.json({ error: 'Missing siteId' }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get('limit') ?? 20), 100);
  const cursor = searchParams.get('cursor');
  const moduleId = searchParams.get('moduleId');

  try {
    let query = adminDb
      .collection('sites').doc(siteId)
      .collection('platform').doc('aiCreditLedger')
      .collection('entries')
      .where('type', '==', 'debit')
      .orderBy('createdAt', 'desc')
      .limit(limit + 1);

    if (moduleId) query = query.where('moduleId', '==', moduleId) as typeof query;
    if (cursor) {
      const cursorDoc = await adminDb
        .collection('sites').doc(siteId)
        .collection('platform').doc('aiCreditLedger')
        .collection('entries').doc(cursor).get();
      if (cursorDoc.exists) query = query.startAfter(cursorDoc) as typeof query;
    }

    const snap = await query.get();
    const docs = snap.docs.slice(0, limit);
    const nextCursor = snap.docs.length > limit ? snap.docs[limit - 1].id : null;

    const entries = docs.map(d => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate?.()?.toISOString() ?? null,
    }));

    return NextResponse.json({ entries, nextCursor });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
