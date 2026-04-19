// GET    /api/admin/modules/ai-marketing/campaigns/[id]  → get campaign
// PATCH  /api/admin/modules/ai-marketing/campaigns/[id]  → update campaign
// DELETE /api/admin/modules/ai-marketing/campaigns/[id]  → delete campaign

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

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await verify(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const doc = await adminDb.doc(`sites/${session.siteId}/${COLLECTION_CAMPAIGNS}/${id}`).get();
  if (!doc.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ campaign: { id: doc.id, ...doc.data() } });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await verify(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const allowed = ['name', 'platform', 'objective', 'status', 'strategy', 'savedContentIds', 'assetIds', 'performanceData'];
  const updates: Record<string, any> = { updatedAt: Timestamp.now() };
  for (const key of allowed) {
    if (body[key] !== undefined) updates[key] = body[key];
  }

  await adminDb.doc(`sites/${session.siteId}/${COLLECTION_CAMPAIGNS}/${id}`).update(updates);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await verify(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  await adminDb.doc(`sites/${session.siteId}/${COLLECTION_CAMPAIGNS}/${id}`).delete();
  return NextResponse.json({ ok: true });
}
