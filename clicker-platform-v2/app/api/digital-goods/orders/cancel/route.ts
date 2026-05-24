import { NextRequest, NextResponse } from 'next/server';
import { requireAuthedMember } from '@/lib/api-auth';
import { cancelOrderAdmin } from '@/lib/modules/digital_goods/server-api';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const auth = await requireAuthedMember(req);
  if (!auth.ok) return auth.res;
  const { siteId } = auth.session;

  const body = await req.json().catch(() => ({}));
  const { orderId } = body as { orderId?: string };
  if (!orderId) return NextResponse.json({ error: 'missing_order' }, { status: 400 });

  try {
    await cancelOrderAdmin(siteId, orderId);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'server_error' }, { status: 400 });
  }
}
