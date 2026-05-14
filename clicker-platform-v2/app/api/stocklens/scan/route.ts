import { NextRequest, NextResponse } from 'next/server';
import { scanProductImage } from '@/lib/modules/stocklens/server/scanner';
import { requireAuthedMember } from '@/lib/api-auth';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const auth = await requireAuthedMember(req);
  if (!auth.ok) return auth.res;

  try {
    const text = await req.text();
    let body: { base64?: string; mimeType?: string };
    try {
      body = JSON.parse(text);
    } catch {
      logger.error('stocklens.scan.body.parse.failed', { preview: text.slice(0, 80) });
      return NextResponse.json({ error: 'Request body tidak valid' }, { status: 400 });
    }
    const { base64, mimeType } = body;

    if (!base64) {
      return NextResponse.json({ error: 'base64 is required' }, { status: 400 });
    }

    const result = await scanProductImage(auth.session.siteId, base64, mimeType || 'image/jpeg');
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.startsWith('insufficient_credits:')) {
      const [, balance, required] = message.split(':');
      return NextResponse.json(
        { error: 'insufficient_credits', balance: Number(balance), required: Number(required) },
        { status: 402 }
      );
    }
    logger.error('stocklens.scan.route.failed', { error });
    return NextResponse.json({ error: 'Scan gagal. Coba lagi.' }, { status: 500 });
  }
}
