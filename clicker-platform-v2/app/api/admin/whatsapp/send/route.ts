import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { createDecipheriv, createHash } from 'crypto';
import { META_MESSAGES_ENDPOINT } from '@/lib/whatsapp/constants';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { siteId, to, content, threadId, staffUserId } = await req.json();

    if (!siteId || !to || !content || !threadId) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }

    // Load config server-side (access token decrypted here only)
    const configSnap = await adminDb.doc(`sites/${siteId}/wa/config`).get();
    if (!configSnap.exists) {
      return NextResponse.json({ error: 'WA not connected.' }, { status: 400 });
    }
    const config = configSnap.data()!;
    if (config.status !== 'connected') {
      return NextResponse.json({ error: 'WA not connected.' }, { status: 400 });
    }

    const accessToken = decryptToken(config.accessToken);

    // Send via Meta API
    const url = META_MESSAGES_ENDPOINT(config.phoneNumberId);
    const res = await fetch(url, {
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

    // Save outbound message to Firestore
    await adminDb
      .collection(`sites/${siteId}/wa/customer_threads/${threadId}/messages`)
      .add({
        direction: 'outbound',
        content,
        type: 'text',
        sentAt: FieldValue.serverTimestamp(),
        sentBy: staffUserId ? `staff:${staffUserId}` : 'staff',
        waMessageId: metaData.messages?.[0]?.id ?? null,
      });

    // Update thread lastMessage
    await adminDb.doc(`sites/${siteId}/wa/customer_threads/${threadId}`).update({
      lastMessage: content,
      lastMessageAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[WA send]', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

function decryptToken(encrypted: string): string {
  const secret = process.env.WA_ENCRYPTION_KEY ?? process.env.NEXTAUTH_SECRET ?? 'fallback-dev-key-change-in-prod';
  const key = createHash('sha256').update(secret).digest();
  const [ivHex, dataHex] = encrypted.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = createDecipheriv('aes-256-cbc', key, iv);
  return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString('utf8');
}
