import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireAuthedMember } from '@/lib/api-auth';
import { logger } from '@/lib/logger';
import { STOCKLENS_SKUS } from '@/lib/modules/stocklens/constants';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const auth = await requireAuthedMember(req);
  if (!auth.ok) return auth.res;

  try {
    const { sku } = await req.json();
    if (!sku) {
      return NextResponse.json({ error: 'sku required' }, { status: 400 });
    }

    const snap = await adminDb
      .collection(`sites/${auth.session.siteId}/${STOCKLENS_SKUS}`)
      .where('sku', '==', sku)
      .limit(1)
      .get();

    if (snap.empty) {
      return NextResponse.json({ exists: false });
    }

    const docSnap = snap.docs[0];
    return NextResponse.json({ exists: true, skuId: docSnap.id, existingData: { id: docSnap.id, ...docSnap.data() } });
  } catch (error: unknown) {
    logger.error('stocklens.check-sku.failed', { error });
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
