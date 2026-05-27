import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { COLLECTION_LIBRARY } from '@/lib/modules/digital_goods/constants';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const headersList = await headers();
  const siteId = headersList.get('x-site-id');
  if (!siteId) return NextResponse.json({ error: 'no_site' }, { status: 400 });

  const sessionCookie = req.cookies.get('__buyer_session')?.value;
  if (!sessionCookie) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let decoded;
  try { decoded = await adminAuth.verifySessionCookie(sessionCookie, true); }
  catch { return NextResponse.json({ error: 'unauthorized' }, { status: 401 }); }

  const url = new URL(req.url);
  const orderId = url.searchParams.get('orderId');
  if (!orderId) return NextResponse.json({ error: 'missing_order' }, { status: 400 });

  const snap = await adminDb
    .collection(`sites/${siteId}/${COLLECTION_LIBRARY}`)
    .where('orderId', '==', orderId)
    .where('buyerId', '==', decoded.uid)
    .limit(1)
    .get();
  if (snap.empty) return NextResponse.json({ libraryEntryId: null });
  return NextResponse.json({ libraryEntryId: snap.docs[0].id });
}
