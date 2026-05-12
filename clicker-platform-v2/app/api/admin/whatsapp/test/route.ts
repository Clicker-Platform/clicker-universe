import { NextRequest, NextResponse } from 'next/server';
import { requireAuthedMember } from '@/lib/api-auth';
import { decryptToken } from '@/lib/whatsapp/encryption';
import { META_API_BASE } from '@/lib/whatsapp/constants';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const auth = await requireAuthedMember(req);
  if (!auth.ok) return auth.res;
  const { siteId } = auth.session;

  try {

    const { adminDb } = await import('@/lib/firebase-admin');
    const configSnap = await adminDb.doc(`sites/${siteId}/wa/config`).get();
    if (!configSnap.exists) {
      return NextResponse.json({ ok: false, message: 'WA belum dikonfigurasi.' });
    }

    const config = configSnap.data()!;
    const accessToken = await decryptToken(config.accessToken);

    const res = await fetch(`${META_API_BASE}/${config.phoneNumberId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (res.ok) {
      const data = await res.json();
      return NextResponse.json({
        ok: true,
        message: `Koneksi berhasil! Nomor: ${data.display_phone_number ?? config.phoneNumberId}`,
      });
    } else {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json({
        ok: false,
        message: `Meta API error: ${err?.error?.message ?? res.status}`,
      });
    }
  } catch (err) {
    logger.error('wa.test.failed', { siteId: 'platform', error: err });
    return NextResponse.json({ ok: false, message: 'Tidak dapat menghubungi Meta API.' });
  }
}
