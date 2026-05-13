import { NextResponse } from 'next/server';
import { listSecrets } from '@/lib/secrets';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const secrets = await listSecrets();
    return NextResponse.json({ secrets });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
