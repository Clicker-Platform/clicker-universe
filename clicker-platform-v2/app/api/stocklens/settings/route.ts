import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';
import { STOCKLENS_CONFIG } from '@/lib/modules/stocklens/constants';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const siteId = req.nextUrl.searchParams.get('siteId');
  if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

  try {
    const snap = await adminDb.doc(`sites/${siteId}/${STOCKLENS_CONFIG}`).get();
    return NextResponse.json({ hasKey: snap.exists && !!snap.data()?.apiKey });
  } catch (error: unknown) {
    logger.error('stocklens.settings.get.failed', { error });
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { siteId, apiKey } = await req.json();
    if (!siteId || !apiKey) {
      return NextResponse.json({ error: 'siteId and apiKey required' }, { status: 400 });
    }

    await adminDb.doc(`sites/${siteId}/${STOCKLENS_CONFIG}`).set(
      { apiKey, updatedAt: Date.now() },
      { merge: true }
    );
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger.error('stocklens.settings.post.failed', { error });
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
