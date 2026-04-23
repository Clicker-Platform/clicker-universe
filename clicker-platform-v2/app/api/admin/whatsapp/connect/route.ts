import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { encryptToken } from '@/lib/whatsapp/encryption';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { siteId, phoneNumberId, wabaId, accessToken, ownerPhone } = await req.json();

    if (!siteId || !phoneNumberId || !wabaId || !accessToken || !ownerPhone) {
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
    console.error('[WA connect]', err);
    return NextResponse.json({ error: 'Gagal menyimpan konfigurasi.' }, { status: 500 });
  }
}
