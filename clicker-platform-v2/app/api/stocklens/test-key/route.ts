import { NextRequest, NextResponse } from 'next/server';
import { secretExists } from '@/lib/secrets';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { siteId } = await req.json() as { siteId?: string };
    if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

    const exists = await secretExists('OPENROUTER_API_KEY');
    if (!exists) return NextResponse.json({ error: 'OpenRouter API Key belum dikonfigurasi.' }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
