import { NextRequest, NextResponse } from 'next/server';
import { getCreditBalance } from '@/lib/ai/credits';
import { requireAuthedMember } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAuthedMember(req);
  if (!auth.ok) return auth.res;

  try {
    const balance = await getCreditBalance(auth.session.siteId);
    return NextResponse.json(balance);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[ai-credits] getCreditBalance failed:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
