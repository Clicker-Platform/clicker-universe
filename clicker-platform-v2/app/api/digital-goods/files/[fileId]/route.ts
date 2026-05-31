import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { getFileForBuyer } from '@/lib/modules/digital_goods/server-api';
import { getAccountSession } from '@/lib/account/session';
import { logger } from '@/lib/logger-edge';

export const runtime = 'nodejs';

// Streams the buyer's purchased file directly through the server (Option A).
// No signed URL is ever returned to the client, so there is nothing to re-share.
// Entitlement (library ownership + path/IDOR checks) is enforced in getFileForBuyer.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ fileId: string }> },
) {
  // `fileId` is unused in MVP; we accept the storagePath in the body and verify against the library.
  await params;

  const headersList = await headers();
  const siteId = headersList.get('x-site-id');
  if (!siteId) return NextResponse.json({ error: 'no_site' }, { status: 400 });

  const session = await getAccountSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { productId, storagePath } = body as { productId?: string; storagePath?: string };
  if (!productId || !storagePath) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  }

  try {
    const file = await getFileForBuyer(siteId, session.uid, productId, storagePath);
    return new NextResponse(file.bytes as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': file.contentType,
        'Content-Length': String(file.sizeBytes),
        'Content-Disposition': `attachment; filename="${encodeURIComponent(file.filename)}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (e: any) {
    const msg = e?.message ?? 'unknown';
    if (msg === 'forbidden') return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    if (msg === 'not_found') return NextResponse.json({ error: 'not_found' }, { status: 404 });
    logger.error('digital_goods.file_stream.failed', { siteId, error: e });
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
