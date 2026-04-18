// GET  /api/admin/modules/ai-marketing/campaigns      → list campaigns
// POST /api/admin/modules/ai-marketing/campaigns      → create campaign

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb, Timestamp } from '@/lib/firebase-admin';
import { COLLECTION_CAMPAIGNS } from '@/lib/modules/ai-marketing/constants';

export const dynamic = 'force-dynamic';

async function verify(req: NextRequest) {
  const siteId = req.headers.get('x-site-id');
  const auth = req.headers.get('authorization');
  if (!siteId || !auth?.startsWith('Bearer ')) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(auth.split('Bearer ')[1]);
    return { siteId, uid: decoded.uid };
  } catch { return null; }
}

export async function GET(req: NextRequest) {
  const session = await verify(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const snap = await adminDb
    .collection(`sites/${session.siteId}/${COLLECTION_CAMPAIGNS}`)
    .orderBy('createdAt', 'desc')
    .get();

  const campaigns = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return NextResponse.json({ campaigns });
}

export async function POST(req: NextRequest) {
  const session = await verify(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name, platform, objective, status } = await req.json();
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });

  const now = Timestamp.now();
  const docRef = adminDb.collection(`sites/${session.siteId}/${COLLECTION_CAMPAIGNS}`).doc();
  await docRef.set({
    name,
    platform: platform ?? '',
    objective: objective ?? '',
    status: status ?? 'draft',
    strategy: null,
    savedContentIds: [],
    assetIds: [],
    performanceData: null,
    createdAt: now,
    updatedAt: now,
    createdBy: session.uid,
  });

  return NextResponse.json({ ok: true, campaignId: docRef.id });
}
