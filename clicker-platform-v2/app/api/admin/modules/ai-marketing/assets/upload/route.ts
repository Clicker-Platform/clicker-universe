// POST /api/admin/modules/ai-marketing/assets/upload
// Registers asset metadata in Firestore (actual file upload is client-side via lib/upload.ts)
// Also enforces 100MB per-tenant storage quota

import { NextRequest, NextResponse } from 'next/server';
import { adminDb, Timestamp } from '@/lib/firebase-admin';
import { requireAuthedMember } from '@/lib/api-auth';
import { COLLECTION_ASSETS, MAX_STORAGE_BYTES } from '@/lib/modules/ai-marketing/constants';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const auth = await requireAuthedMember(req);
  if (!auth.ok) return auth.res;

  const { siteId, uid } = auth.session;

  const { fileName, fileUrl, thumbnailUrl, fileSizeMB, mimeType, type, tags } = await req.json();
  if (!fileName || !fileUrl || !type || fileSizeMB === undefined) {
    return NextResponse.json({ error: 'fileName, fileUrl, type, fileSizeMB are required' }, { status: 400 });
  }

  // Enforce 100MB storage quota
  const assetsSnap = await adminDb
    .collection(`sites/${siteId}/${COLLECTION_ASSETS}`)
    .get();

  const totalUsedMB = assetsSnap.docs.reduce((sum, d) => sum + (d.data().fileSizeMB ?? 0), 0);
  if ((totalUsedMB + fileSizeMB) * 1024 * 1024 > MAX_STORAGE_BYTES) {
    return NextResponse.json(
      { error: 'storage_quota_exceeded', usedMB: totalUsedMB, limitMB: 100 },
      { status: 413 }
    );
  }

  const docRef = adminDb.collection(`sites/${siteId}/${COLLECTION_ASSETS}`).doc();
  await docRef.set({
    type,
    fileName,
    fileUrl,
    thumbnailUrl: thumbnailUrl ?? fileUrl,
    fileSizeMB,
    mimeType: mimeType ?? 'image/webp',
    tags: tags ?? [],
    analysis: null,
    analysisStatus: 'pending',
    createdAt: Timestamp.now(),
    createdBy: uid,
  });

  return NextResponse.json({ ok: true, assetId: docRef.id });
}

// DELETE /api/admin/modules/ai-marketing/assets/upload?assetId=xxx
export async function DELETE(req: NextRequest) {
  const auth = await requireAuthedMember(req);
  if (!auth.ok) return auth.res;

  const assetId = req.nextUrl.searchParams.get('assetId');
  if (!assetId) return NextResponse.json({ error: 'assetId required' }, { status: 400 });

  await adminDb.doc(`sites/${auth.session.siteId}/${COLLECTION_ASSETS}/${assetId}`).delete();
  return NextResponse.json({ ok: true });
}
