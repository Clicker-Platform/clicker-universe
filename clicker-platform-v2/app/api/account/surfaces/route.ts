import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { getEnabledModuleDefinitions } from '@/lib/modules/registry';
import { resolveVisibleSurfaces } from '@/lib/account/surfaces';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
const NO_STORE = { 'Cache-Control': 'private, no-store, max-age=0' };

export async function GET(req: NextRequest): Promise<Response> {
  const siteId = req.headers.get('x-site-id');
  if (!siteId) return NextResponse.json({ items: [] }, { headers: NO_STORE });

  const idToken = req.cookies.get('__account_session')?.value;
  if (!idToken) return NextResponse.json({ items: [] }, { headers: NO_STORE });

  let uid: string;
  try {
    uid = (await adminAuth.verifyIdToken(idToken)).uid;
  } catch (e) {
    logger.error('account.surfaces.auth_failed', { siteId, error: e });
    return NextResponse.json({ items: [] }, { headers: NO_STORE });
  }

  try {
    const mods = await getEnabledModuleDefinitions();
    const visible = await resolveVisibleSurfaces(mods, { siteId, uid });
    // Nav-item shape matches what the account sidebar consumes:
    // { id, label, icon (lucide key), route (segment, e.g. '/library') }.
    const items = visible.map((v) => ({
      id: v.surface.id,
      label: v.surface.label,
      icon: v.surface.icon,
      route: v.surface.route,
    }));
    return NextResponse.json({ items }, { headers: NO_STORE });
  } catch (e) {
    logger.error('account.surfaces.resolve_failed', { siteId, uid, error: e });
    return NextResponse.json({ items: [] }, { headers: NO_STORE });
  }
}
