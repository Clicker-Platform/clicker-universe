// GET  /api/admin/modules/ai-marketing/config  → fetch settings
// POST /api/admin/modules/ai-marketing/config  → save settings

import { NextRequest, NextResponse } from 'next/server';
import { adminDb, Timestamp } from '@/lib/firebase-admin';
import { requireAuthedMember } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

const SETTINGS_PATH = (siteId: string) =>
  `sites/${siteId}/modules/ai_marketing/settings/default`;

export async function GET(req: NextRequest) {
  const auth = await requireAuthedMember(req);
  if (!auth.ok) return auth.res;

  const doc = await adminDb.doc(SETTINGS_PATH(auth.session.siteId)).get();
  if (!doc.exists) {
    return NextResponse.json({ settings: null });
  }
  return NextResponse.json({ settings: doc.data() });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuthedMember(req);
  if (!auth.ok) return auth.res;

  const body = await req.json();
  const { brandVoice, defaultPlatforms } = body;

  if (!brandVoice) {
    return NextResponse.json({ error: 'brandVoice is required' }, { status: 400 });
  }

  await adminDb.doc(SETTINGS_PATH(auth.session.siteId)).set({
    brandVoice,
    defaultPlatforms: defaultPlatforms ?? [],
    updatedAt: Timestamp.now(),
    updatedBy: auth.session.uid,
  }, { merge: true });

  return NextResponse.json({ ok: true });
}
