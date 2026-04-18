// POST /api/admin/modules/ai-marketing/saved — save a generation result
// DELETE /api/admin/modules/ai-marketing/saved?id=xxx — delete saved content

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb, Timestamp } from '@/lib/firebase-admin';
import { COLLECTION_SAVED } from '@/lib/modules/ai-marketing/constants';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const siteId = req.headers.get('x-site-id');
  const authHeader = req.headers.get('authorization');
  if (!siteId || !authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let uid: string;
  try {
    const decoded = await adminAuth.verifyIdToken(authHeader.split('Bearer ')[1]);
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const { generationId, type, content, platform, campaignId, tags } = await req.json();
  if (!generationId || !type || !content) {
    return NextResponse.json({ error: 'generationId, type, content required' }, { status: 400 });
  }

  const docRef = adminDb.collection(`sites/${siteId}/${COLLECTION_SAVED}`).doc();
  await docRef.set({
    generationId,
    type,
    content,
    platform: platform ?? null,
    campaignId: campaignId ?? null,
    tags: tags ?? [],
    createdAt: Timestamp.now(),
    createdBy: uid,
  });

  return NextResponse.json({ ok: true, contentId: docRef.id });
}

export async function DELETE(req: NextRequest) {
  const siteId = req.headers.get('x-site-id');
  const authHeader = req.headers.get('authorization');
  if (!siteId || !authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await adminAuth.verifyIdToken(authHeader.split('Bearer ')[1]);
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  await adminDb.doc(`sites/${siteId}/${COLLECTION_SAVED}/${id}`).delete();
  return NextResponse.json({ ok: true });
}
