import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { siteId } = await req.json();
    if (!siteId) return NextResponse.json({ error: 'Missing siteId.' }, { status: 400 });

    await adminDb.doc(`sites/${siteId}/wa/config`).update({
      status: 'disconnected',
      accessToken: '',
      phoneNumberId: '',
      wabaId: '',
      webhookVerifyToken: '',
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[WA disconnect]', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
