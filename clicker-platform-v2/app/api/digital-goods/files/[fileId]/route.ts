import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { issueSignedUrlForFile } from '@/lib/modules/digital_goods/server-api';
import { getAccountSession } from '@/lib/account/session';
import { logger } from '@/lib/logger-edge';

export const runtime = 'nodejs';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ fileId: string }> },
) {
  // `fileId` is unused in MVP; we accept the storagePath in the body and verify against the library.
  // Future: lookup file metadata by fileId for extra defense.
  await params;

  const headersList = await headers();
  const siteId = headersList.get('x-site-id');
  if (!siteId) return NextResponse.json({ error: 'no_site' }, { status: 400 });

  // Authorize via the platform account session. Entitlement (library ownership)
  // is keyed on the account uid inside issueSignedUrlForFile.
  const session = await getAccountSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { productId, storagePath } = body as { productId?: string; storagePath?: string };
  if (!productId || !storagePath) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  }

  try {
    const url = await issueSignedUrlForFile(siteId, session.uid, productId, storagePath);
    return NextResponse.json({ url });
  } catch (e: any) {
    const msg = e?.message ?? 'unknown';
    if (msg === 'forbidden') return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    if (msg === 'not_found') return NextResponse.json({ error: 'not_found' }, { status: 404 });
    logger.error('digital_goods.signed_url.failed', { siteId, error: e });
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
