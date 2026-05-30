import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { adminAuth } from '@/lib/firebase-admin';
import { upsertBuyerAdmin } from '@/lib/modules/digital_goods/server-api';
import { logger } from '@/lib/logger-edge';

export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'private, no-store, max-age=0' };

// Build cookie string for a given name.
function cookieString(name: string, value: string): string {
  const maxAge = 60 * 60 * 24 * 7;
  const isProd = process.env.NODE_ENV === 'production';
  const parts = [
    `${name}=${value}`,
    'Path=/',
    `Max-Age=${maxAge}`,
    'HttpOnly',
    'SameSite=Lax',
  ];
  if (isProd) parts.push('Secure');
  return parts.join('; ');
}

// Firebase App Hosting CDN only forwards the `__session` cookie to the
// Next.js backend. All other cookies are stripped before they reach server
// components. We therefore emit TWO Set-Cookie headers:
//   1. __session  — forwarded by Firebase, read by buyer server pages
//   2. __buyer_session — read by buyer server pages on non-Firebase hosts
//      (local dev, custom-domain deployments without CDN stripping)
//
// Buyer server pages try __buyer_session first, then fall back to __session.
// Admin code only writes __session as a short siteId string (e.g. "go"),
// which will never pass verifySessionCookie(), so no false-positive risk.
function buildSessionCookies(sessionCookie: string): string[] {
  return [
    cookieString('__session', sessionCookie),
    cookieString('__buyer_session', sessionCookie),
  ];
}

async function processInit(siteId: string, idToken: string): Promise<
  | { ok: true; sessionCookie: string; uid: string }
  | { ok: false; error: string; status: number }
> {
  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(idToken, true);
    console.log('[BUYER_INIT] idToken verified uid=', decoded.uid, 'email=', decoded.email, 'aud=', decoded.aud, 'iss=', decoded.iss);
  } catch (e) {
    logger.error('digital_goods.buyer.init.verify.failed', { siteId, error: e });
    return { ok: false, error: 'invalid_token', status: 401 };
  }

  try {
    await upsertBuyerAdmin(siteId, decoded.uid, {
      email: decoded.email ?? '',
    });
    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: 60 * 60 * 24 * 7 * 1000,
    });
    console.log('[BUYER_INIT] sessionCookie minted len=', sessionCookie.length, 'first40=', sessionCookie.slice(0,40), 'last20=', sessionCookie.slice(-20));
    return { ok: true, sessionCookie, uid: decoded.uid };
  } catch (e) {
    logger.error('digital_goods.buyer.init.failed', { siteId, uid: decoded.uid, error: e });
    return { ok: false, error: 'init_failed', status: 500 };
  }
}

function isSafePath(s: string | null): s is string {
  return !!s && s.startsWith('/') && !s.startsWith('//');
}

// Form POST handler — used by VerifyClient via native HTML form submission.
// Returns HTTP 302 + Set-Cookie so the browser applies the session cookie
// natively and includes it on the redirect request. This is the only flow
// that reliably persists __session through mobile Custom Tabs / in-app
// browsers where fetch + Set-Cookie + JS redirect can drop the cookie.
async function handleFormPost(req: NextRequest): Promise<Response> {
  const form = await req.formData().catch(() => null);
  if (!form) {
    return new Response('bad_form', { status: 400, headers: NO_STORE });
  }

  const siteId = String(form.get('siteId') ?? '').trim();
  const idToken = String(form.get('idToken') ?? '').trim();
  const nextRaw = String(form.get('next') ?? '').trim();

  if (!siteId) return new Response('no_site', { status: 400, headers: NO_STORE });
  if (!idToken) return new Response('missing_token', { status: 400, headers: NO_STORE });

  const result = await processInit(siteId, idToken);
  if (!result.ok) {
    return new Response(result.error, { status: result.status, headers: NO_STORE });
  }

  const next = isSafePath(nextRaw) ? nextRaw : `/${siteId}/store`;
  const resHeaders = new Headers({ ...NO_STORE, Location: next });
  for (const c of buildSessionCookies(result.sessionCookie)) resHeaders.append('Set-Cookie', c);
  return new Response(null, { status: 302, headers: resHeaders });
}

// JSON POST handler — kept for backward compatibility with any caller that
// still posts JSON (e.g. older client paths). Behaves the same minus the
// redirect — caller is responsible for navigating.
async function handleJsonPost(req: NextRequest): Promise<Response> {
  const headersList = await headers();
  const siteId = headersList.get('x-site-id');
  if (!siteId) {
    return NextResponse.json({ error: 'no_site' }, { status: 400, headers: NO_STORE });
  }

  const body = await req.json().catch(() => ({}));
  const { idToken } = body as { idToken?: string };
  if (!idToken) {
    return NextResponse.json({ error: 'missing_token' }, { status: 400, headers: NO_STORE });
  }

  const result = await processInit(siteId, idToken);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status, headers: NO_STORE });
  }

  const resHeaders = new Headers({ 'Content-Type': 'application/json', ...NO_STORE });
  for (const c of buildSessionCookies(result.sessionCookie)) resHeaders.append('Set-Cookie', c);
  return new NextResponse(JSON.stringify({ ok: true, uid: result.uid }), { status: 200, headers: resHeaders });
}

export async function POST(req: NextRequest): Promise<Response> {
  const ct = req.headers.get('content-type') ?? '';
  if (ct.includes('application/x-www-form-urlencoded') || ct.includes('multipart/form-data')) {
    return handleFormPost(req);
  }
  return handleJsonPost(req);
}
