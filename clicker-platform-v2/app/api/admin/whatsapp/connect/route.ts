import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { encryptToken } from '@/lib/whatsapp/encryption';
import { logger } from '@/lib/logger';
import { requireAuthedMember } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const auth = await requireAuthedMember(req);
  if (!auth.ok) return auth.res;
  const { siteId } = auth.session;

  try {
    const { phoneNumberId, wabaId, accessToken, ownerPhone } = await req.json();

    if (!phoneNumberId || !wabaId || !accessToken || !ownerPhone) {
      return NextResponse.json({ error: 'Semua field wajib diisi.' }, { status: 400 });
    }

    const { adminDb } = await import('@/lib/firebase-admin');
    const encryptedToken = encryptToken(accessToken);
    const webhookVerifyToken = randomBytes(32).toString('hex');

    await adminDb.doc(`sites/${siteId}/wa/config`).set({
      phoneNumberId,
      wabaId,
      accessToken: encryptedToken,
      webhookVerifyToken,
      ownerPhone,
      staffPhones: [],
      status: 'connected',
      connectedAt: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true, webhookVerifyToken });
  } catch (err) {
    logger.error('wa.connect.failed', { siteId, error: err });
    return NextResponse.json({ error: 'Gagal menyimpan konfigurasi.' }, { status: 500 });
  }
}
