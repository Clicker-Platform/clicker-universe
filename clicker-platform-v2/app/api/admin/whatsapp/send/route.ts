import { NextResponse } from 'next/server';
import { decryptToken } from '@/lib/whatsapp/encryption';
import { META_MESSAGES_ENDPOINT, WA_ROOT, WA_MAIN_DOC, WA_CUSTOMER_THREADS } from '@/lib/whatsapp/constants';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { siteId, to, content, threadId, staffUserId } = await req.json();

    if (!siteId || !to || !content || !threadId) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }

    const { adminDb } = await import('@/lib/firebase-admin');
    const { FieldValue } = await import('firebase-admin/firestore');
    const configSnap = await adminDb.doc(`sites/${siteId}/wa/config`).get();
    if (!configSnap.exists) {
      return NextResponse.json({ error: 'WA not connected.' }, { status: 400 });
    }
    const config = configSnap.data()!;
    if (config.status !== 'connected') {
      return NextResponse.json({ error: 'WA not connected.' }, { status: 400 });
    }

    const accessToken = decryptToken(config.accessToken);

    const res = await fetch(META_MESSAGES_ENDPOINT(config.phoneNumberId), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: content },
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('[WA send] Meta error:', err);
      return NextResponse.json({ error: 'Gagal mengirim pesan.' }, { status: 502 });
    }

    const metaData = await res.json();
    const threadPath = `sites/${siteId}/${WA_ROOT}/${WA_MAIN_DOC}/${WA_CUSTOMER_THREADS}/${threadId}`;

    await adminDb.collection(`${threadPath}/messages`).add({
      direction: 'outbound',
      content,
      type: 'text',
      sentAt: FieldValue.serverTimestamp(),
      sentBy: staffUserId ? `staff:${staffUserId}` : 'staff',
      waMessageId: metaData.messages?.[0]?.id ?? null,
    });

    await adminDb.doc(threadPath).update({
      lastMessage: content,
      lastMessageAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[WA send]', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
