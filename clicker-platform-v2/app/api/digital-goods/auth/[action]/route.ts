import { NextRequest } from 'next/server';
import { createMagicLinkRoutes } from '@/lib/auth/magic-link';
import { publicRoutes } from '@/lib/modules/digital_goods/constants';

export const runtime = 'nodejs';

const { POST_request, POST_verify } = createMagicLinkRoutes({
  module: 'digital_goods',
  defaultPurpose: 'masuk ke store',
  verifyPath: '/store/login/verify',
  getRedirectUrl: (next, tenant) => {
    if (next && next.startsWith('/') && !next.startsWith('//')) return next;
    return publicRoutes(tenant).store;
  },
});

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ action: string }> }
): Promise<Response> {
  const { action } = await ctx.params;
  if (action === 'request') return POST_request(req);
  if (action === 'verify') return POST_verify(req);
  return new Response('not found', { status: 404 });
}
