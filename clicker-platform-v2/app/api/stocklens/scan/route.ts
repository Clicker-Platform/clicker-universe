import { NextRequest, NextResponse } from 'next/server';
import { scanProductImage } from '@/lib/modules/stocklens/server/gemini-scanner';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const text = await req.text();
    let body: { siteId?: string; base64?: string; mimeType?: string };
    try {
      body = JSON.parse(text);
    } catch {
      logger.error('stocklens.scan.body.parse.failed', { preview: text.slice(0, 80) });
      return NextResponse.json({ error: 'Request body tidak valid' }, { status: 400 });
    }
    const { siteId, base64, mimeType } = body;

    if (!siteId || !base64) {
      return NextResponse.json({ error: 'siteId and base64 are required' }, { status: 400 });
    }

    const result = await scanProductImage(siteId, base64, mimeType || 'image/jpeg');
    return NextResponse.json(result);
  } catch (error: unknown) {
    logger.error('stocklens.scan.route.failed', { error });
    const message = error instanceof Error ? error.message : 'Unknown error';
    const isQuotaError = message.includes('429') || message.includes('quota') || message.includes('Too Many Requests');
    if (isQuotaError) {
      return NextResponse.json(
        { error: 'Quota Gemini API habis. Tambahkan billing di Google AI Studio atau gunakan API Key sendiri di StockLens Settings.' },
        { status: 429 }
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
