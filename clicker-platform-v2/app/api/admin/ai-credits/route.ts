import { NextRequest, NextResponse } from 'next/server';
import { getCreditBalance } from '@/lib/ai/credits';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const siteId = req.headers.get('x-site-id');
  if (!siteId) return NextResponse.json({ error: 'Missing siteId' }, { status: 400 });

  try {
    const balance = await getCreditBalance(siteId);
    return NextResponse.json(balance);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[ai-credits] getCreditBalance failed:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
