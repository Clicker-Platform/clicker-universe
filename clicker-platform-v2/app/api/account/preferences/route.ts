import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { updateAccountAccent } from '@/lib/account/server-api';
import { ACCENT_PRESETS } from '@/lib/account/accent';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
const NO_STORE = { 'Cache-Control': 'private, no-store, max-age=0' };

// Persists a member-chosen dashboard preference (currently: accent preset) to
// sites/{siteId}/accounts/{uid}. uid is resolved from the __account_session cookie.
export async function POST(req: NextRequest): Promise<Response> {
  const siteId = req.headers.get('x-site-id');
  if (!siteId) return NextResponse.json({ error: 'no_site' }, { status: 400, headers: NO_STORE });

  const idToken = req.cookies.get('__account_session')?.value;
  if (!idToken) return NextResponse.json({ error: 'unauthenticated' }, { status: 401, headers: NO_STORE });

  let uid: string;
  try {
    uid = (await adminAuth.verifyIdToken(idToken)).uid;
  } catch (e) {
    logger.error('account.preferences.auth_failed', { siteId, error: e });
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401, headers: NO_STORE });
  }

  let body: { accentPreset?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad_body' }, { status: 400, headers: NO_STORE });
  }

  const accentPreset = body.accentPreset ?? '';
  if (!(accentPreset in ACCENT_PRESETS)) {
    return NextResponse.json({ error: 'invalid_preset' }, { status: 400, headers: NO_STORE });
  }

  try {
    await updateAccountAccent(siteId, uid, accentPreset);
    return NextResponse.json({ ok: true }, { status: 200, headers: NO_STORE });
  } catch (e) {
    logger.error('account.preferences.write_failed', { siteId, uid, error: e });
    return NextResponse.json({ error: 'write_failed' }, { status: 500, headers: NO_STORE });
  }
}
