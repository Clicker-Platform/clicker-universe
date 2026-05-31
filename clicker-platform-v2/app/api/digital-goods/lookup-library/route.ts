import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { adminDb } from '@/lib/firebase-admin';
import { COLLECTION_LIBRARY } from '@/lib/modules/digital_goods/constants';
import { getAccountSession } from '@/lib/account/session';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const headersList = await headers();
  const siteId = headersList.get('x-site-id');
  if (!siteId) return NextResponse.json({ error: 'no_site' }, { status: 400 });

  const session = await getAccountSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const orderId = url.searchParams.get('orderId');
  if (!orderId) return NextResponse.json({ error: 'missing_order' }, { status: 400 });

  const snap = await adminDb
    .collection(`sites/${siteId}/${COLLECTION_LIBRARY}`)
    .where('orderId', '==', orderId)
    .where('buyerId', '==', session.uid)
    .limit(1)
    .get();
  if (snap.empty) return NextResponse.json({ libraryEntryId: null });
  return NextResponse.json({ libraryEntryId: snap.docs[0].id });
}
