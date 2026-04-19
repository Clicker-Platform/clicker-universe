import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { randomBytes, createCipheriv, createHash } from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { siteId, phoneNumberId, wabaId, accessToken, ownerPhone } = await req.json();

    if (!siteId || !phoneNumberId || !wabaId || !accessToken || !ownerPhone) {
      return NextResponse.json({ error: 'Semua field wajib diisi.' }, { status: 400 });
    }

    // Encrypt accessToken before storing
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

function encryptToken(token: string): string {
  const secret = process.env.WA_ENCRYPTION_KEY ?? process.env.NEXTAUTH_SECRET ?? 'fallback-dev-key-change-in-prod';
  const key = createHash('sha256').update(secret).digest();
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-cbc', key, iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}
