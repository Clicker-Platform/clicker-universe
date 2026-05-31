import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { listLibraryForAccountAdmin } from '@/lib/modules/digital_goods/surface-admin';
import { getAccountSession } from '@/lib/account/session';
import { logger } from '@/lib/logger-edge';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Returns the authenticated buyer's library entries. Server-session gated + admin SDK
// so the list never depends on client Firestore rules or a still-building index.
export async function GET(_req: NextRequest) {
  const headersList = await headers();
  const siteId = headersList.get('x-site-id');
  if (!siteId) return NextResponse.json({ error: 'no_site' }, { status: 400 });

  const session = await getAccountSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  try {
    const entries = await listLibraryForAccountAdmin(siteId, session.uid);
    return NextResponse.json({ entries });
  } catch (e) {
    logger.error('digital_goods.library.list.failed', { siteId, error: e });
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
