// GET  /api/admin/modules/ai-marketing/config  → fetch settings
// POST /api/admin/modules/ai-marketing/config  → save settings

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb, Timestamp } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

const SETTINGS_PATH = (siteId: string) =>
  `sites/${siteId}/modules/ai_marketing/settings/default`;

async function verifyRequest(req: NextRequest): Promise<{ siteId: string; uid: string } | null> {
  const siteId = req.headers.get('x-site-id');
  const authHeader = req.headers.get('authorization');
  if (!siteId || !authHeader?.startsWith('Bearer ')) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(authHeader.split('Bearer ')[1]);
    return { siteId, uid: decoded.uid };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const session = await verifyRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const doc = await adminDb.doc(SETTINGS_PATH(session.siteId)).get();
  if (!doc.exists) {
    return NextResponse.json({ settings: null });
  }
  return NextResponse.json({ settings: doc.data() });
}

export async function POST(req: NextRequest) {
  const session = await verifyRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { brandVoice, defaultPlatforms } = body;

  if (!brandVoice) {
    return NextResponse.json({ error: 'brandVoice is required' }, { status: 400 });
  }

  await adminDb.doc(SETTINGS_PATH(session.siteId)).set({
    brandVoice,
    defaultPlatforms: defaultPlatforms ?? [],
    updatedAt: Timestamp.now(),
    updatedBy: session.uid,
  }, { merge: true });

  return NextResponse.json({ ok: true });
}
