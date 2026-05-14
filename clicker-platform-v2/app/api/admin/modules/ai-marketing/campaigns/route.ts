// GET  /api/admin/modules/ai-marketing/campaigns      → list campaigns
// POST /api/admin/modules/ai-marketing/campaigns      → create campaign

import { NextRequest, NextResponse } from 'next/server';
import { adminDb, Timestamp } from '@/lib/firebase-admin';
import { requireAuthedMember } from '@/lib/api-auth';
import { COLLECTION_CAMPAIGNS } from '@/lib/modules/ai-marketing/constants';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAuthedMember(req);
  if (!auth.ok) return auth.res;

  const snap = await adminDb
    .collection(`sites/${auth.session.siteId}/${COLLECTION_CAMPAIGNS}`)
    .orderBy('createdAt', 'desc')
    .get();

  const campaigns = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return NextResponse.json({ campaigns });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuthedMember(req);
  if (!auth.ok) return auth.res;

  const { name, platform, objective, status } = await req.json();
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });

  const now = Timestamp.now();
  const docRef = adminDb.collection(`sites/${auth.session.siteId}/${COLLECTION_CAMPAIGNS}`).doc();
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
    createdBy: auth.session.uid,
  });

  return NextResponse.json({ ok: true, campaignId: docRef.id });
}
