import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { applyAccountSession } from '@/lib/account/session-handler';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
const NO_STORE = { 'Cache-Control': 'private, no-store, max-age=0' };

export async function POST(req: NextRequest): Promise<Response> {
  const siteId = req.headers.get('x-site-id');
  if (!siteId) return NextResponse.json({ error: 'no_site' }, { status: 400, headers: NO_STORE });

  let body: { idToken?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad_body' }, { status: 400, headers: NO_STORE }); }

  const idToken = (body.idToken ?? '').trim();
  if (!idToken) return NextResponse.json({ error: 'no_token' }, { status: 400, headers: NO_STORE });

  let decoded;
  try { decoded = await adminAuth.verifyIdToken(idToken); }
  catch (e) { logger.error('account.session.verify_failed', { siteId, error: e }); return NextResponse.json({ error: 'invalid_token' }, { status: 401, headers: NO_STORE }); }

  const email = decoded.email;
  if (!email) return NextResponse.json({ error: 'no_email' }, { status: 400, headers: NO_STORE });

  await applyAccountSession({ siteId, uid: decoded.uid, email });

  const res = NextResponse.json({ ok: true }, { status: 200, headers: NO_STORE });
  // Account session cookie — separate from admin __session by design (spec §3.4).
  res.cookies.set('__account_session', idToken, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/',
  });
  return res;
}
