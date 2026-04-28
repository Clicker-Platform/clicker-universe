import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { adminDb } from '@/lib/firebase-admin';
import { STOCKLENS_CONFIG } from '@/lib/modules/stocklens/constants';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { siteId } = await req.json() as { siteId?: string };
    if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

    const snap = await adminDb.doc(`sites/${siteId}/${STOCKLENS_CONFIG}`).get();
    const apiKey = snap.data()?.apiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'API Key belum dikonfigurasi' }, { status: 400 });

    const ai = new GoogleGenerativeAI(apiKey);
    const model = ai.getGenerativeModel({ model: 'gemini-3-flash-preview' });
    await model.generateContent('Reply with just "ok"');

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
