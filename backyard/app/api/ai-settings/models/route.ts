import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireSuperadmin } from '@/lib/require-superadmin';

export const dynamic = 'force-dynamic';

const MODELS_DOC = 'modules/ai-platform/config/models';

const FALLBACK = {
  llm:    'google/gemini-2.0-flash',
  vision: 'google/gemini-2.0-flash',
  rag:    'google/gemini-2.0-flash',
};

export async function GET(req: NextRequest) {
  const auth = await requireSuperadmin(req);
  if (!auth.ok) return auth.res;
  try {
    const doc = await adminDb.doc(MODELS_DOC).get();
    const data = doc.exists ? { ...FALLBACK, ...doc.data() } : FALLBACK;
    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireSuperadmin(req);
  if (!auth.ok) return auth.res;
  try {
    const body = await req.json() as Record<string, string>;
    await adminDb.doc(MODELS_DOC).set(body, { merge: true });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
