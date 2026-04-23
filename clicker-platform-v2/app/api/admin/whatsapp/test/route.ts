import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { decryptToken } from '@/lib/whatsapp/encryption';
import { META_API_BASE } from '@/lib/whatsapp/constants';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { siteId } = await req.json();
    if (!siteId) return NextResponse.json({ error: 'Missing siteId.' }, { status: 400 });

    const configSnap = await adminDb.doc(`sites/${siteId}/wa/config`).get();
    if (!configSnap.exists) {
      return NextResponse.json({ ok: false, message: 'WA belum dikonfigurasi.' });
    }

    const config = configSnap.data()!;
    const accessToken = decryptToken(config.accessToken);

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
    console.error('[WA test]', err);
    return NextResponse.json({ ok: false, message: 'Tidak dapat menghubungi Meta API.' });
  }
}
