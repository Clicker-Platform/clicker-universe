import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { requireAuthedMember } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const auth = await requireAuthedMember(req);
  if (!auth.ok) return auth.res;
  const { siteId } = auth.session;

  try {

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
    logger.error('wa.disconnect.failed', { siteId, error: err });
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
