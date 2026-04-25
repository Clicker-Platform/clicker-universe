import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { siteId } = await req.json();
    if (!siteId) return NextResponse.json({ error: 'Missing siteId.' }, { status: 400 });

    const { adminDb } = await import('@/lib/firebase-admin');
    await adminDb.doc(`sites/${siteId}/wa/config`).update({
      status: 'disconnected',
      accessToken: '',
      phoneNumberId: '',
      wabaId: '',
      webhookVerifyToken: '',
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('wa.disconnect.failed', { siteId: 'platform', error: err });
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
