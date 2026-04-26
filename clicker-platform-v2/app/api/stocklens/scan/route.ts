import { NextRequest, NextResponse } from 'next/server';
import { scanProductImage } from '@/lib/modules/stocklens/server/gemini-scanner';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const siteId = formData.get('siteId') as string;
    const file = formData.get('image') as File;

    if (!siteId || !file) {
      return NextResponse.json({ error: 'siteId and image are required' }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const mimeType = file.type || 'image/jpeg';

    const result = await scanProductImage(siteId, base64, mimeType);
    return NextResponse.json(result);
  } catch (error: any) {
    logger.error('stocklens.scan.route.failed', { error });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
