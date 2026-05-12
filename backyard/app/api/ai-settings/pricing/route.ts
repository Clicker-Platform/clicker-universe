import { NextRequest, NextResponse } from 'next/server';
import { adminDb, FieldValue } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

const PRICING_DOC = 'modules/ai-platform/config/pricing';

export async function GET() {
  try {
    const doc = await adminDb.doc(PRICING_DOC).get();
    const models = (doc.data()?.models as Record<string, { inputPer1M: number; outputPer1M: number }>) ?? {};
    return NextResponse.json({ models });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { models } = await req.json() as { models: Record<string, { inputPer1M: number; outputPer1M: number }> };
    if (!models || typeof models !== 'object') {
      return NextResponse.json({ error: 'Invalid models payload' }, { status: 400 });
    }
    await adminDb.doc(PRICING_DOC).set({ models, updatedAt: FieldValue.serverTimestamp() });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
