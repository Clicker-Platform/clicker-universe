import { NextRequest, NextResponse } from 'next/server';
import { requireAuthedMember } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

// API Key management removed — AI Sales Agent uses platform OpenRouter key via lib/secrets.
export async function POST(req: NextRequest) {
  const auth = await requireAuthedMember(req);
  if (!auth.ok) return auth.res;
  return NextResponse.json({ success: true });
}
