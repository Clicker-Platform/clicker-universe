// POST /api/admin/modules/ai-marketing/saved — save a generation result
// DELETE /api/admin/modules/ai-marketing/saved?id=xxx — delete saved content

import { NextRequest, NextResponse } from 'next/server';
import { adminDb, Timestamp } from '@/lib/firebase-admin';
import { requireAuthedMember } from '@/lib/api-auth';
import { COLLECTION_SAVED } from '@/lib/modules/ai-marketing/constants';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const auth = await requireAuthedMember(req);
  if (!auth.ok) return auth.res;

  const { generationId, type, content, platform, campaignId, tags } = await req.json();
  if (!generationId || !type || !content) {
    return NextResponse.json({ error: 'generationId, type, content required' }, { status: 400 });
  }

  const docRef = adminDb.collection(`sites/${auth.session.siteId}/${COLLECTION_SAVED}`).doc();
  await docRef.set({
    generationId,
    type,
    content,
    platform: platform ?? null,
    campaignId: campaignId ?? null,
    tags: tags ?? [],
    createdAt: Timestamp.now(),
    createdBy: auth.session.uid,
  });

  return NextResponse.json({ ok: true, contentId: docRef.id });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuthedMember(req);
  if (!auth.ok) return auth.res;

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  await adminDb.doc(`sites/${auth.session.siteId}/${COLLECTION_SAVED}/${id}`).delete();
  return NextResponse.json({ ok: true });
}
