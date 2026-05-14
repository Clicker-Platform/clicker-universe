import { NextRequest, NextResponse } from 'next/server';
import { listSecrets } from '@/lib/secrets';
import { requireSuperadmin } from '@/lib/require-superadmin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireSuperadmin(req);
  if (!auth.ok) return auth.res;
  try {
    const secrets = await listSecrets();
    return NextResponse.json({ secrets });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
