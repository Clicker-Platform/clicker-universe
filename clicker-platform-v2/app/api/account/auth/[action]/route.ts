import { NextRequest } from 'next/server';
import { createMagicLinkRoutes } from '@/lib/auth/magic-link';
import { ACCOUNT_MODULE_SCOPE } from '@/lib/account/constants';

export const runtime = 'nodejs';

const { POST_request, POST_verify } = createMagicLinkRoutes({
  module: ACCOUNT_MODULE_SCOPE,
  defaultPurpose: 'masuk ke akun kamu',
  verifyPath: '/account/login/verify',
  getRedirectUrl: (next, tenant) => {
    if (next && next.startsWith('/') && !next.startsWith('//')) return next;
    return `/${tenant}/account`;
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
