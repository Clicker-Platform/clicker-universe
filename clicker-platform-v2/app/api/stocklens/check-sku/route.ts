import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';
import { STOCKLENS_SKUS } from '@/lib/modules/stocklens/constants';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { siteId, sku } = await req.json();
    if (!siteId || !sku) {
      return NextResponse.json({ error: 'siteId and sku required' }, { status: 400 });
    }

    const snap = await adminDb
      .collection(`sites/${siteId}/${STOCKLENS_SKUS}`)
      .where('sku', '==', sku)
      .limit(1)
      .get();

    if (snap.empty) {
      return NextResponse.json({ exists: false });
    }

    const docSnap = snap.docs[0];
    return NextResponse.json({ exists: true, skuId: docSnap.id, existingData: { id: docSnap.id, ...docSnap.data() } });
  } catch (error: any) {
    logger.error('stocklens.check-sku.failed', { error });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
