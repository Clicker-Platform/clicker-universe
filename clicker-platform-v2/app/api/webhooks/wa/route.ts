import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { processIncomingMessage } from '@/lib/whatsapp/webhook-processor';
import type { MetaWebhookPayload } from '@/lib/whatsapp/types';

export const dynamic = 'force-dynamic';

// GET — Meta webhook verification challenge
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode !== 'subscribe' || !token || !challenge) {
    return new Response('Bad Request', { status: 400 });
  }

  // Look up siteId by verifyToken — tokens are unique per tenant
  try {
    const snap = await adminDb
      .collectionGroup('config')
      .where('webhookVerifyToken', '==', token)
      .where('status', '==', 'connected')
      .limit(1)
      .get();

    if (snap.empty) {
      return new Response('Forbidden', { status: 403 });
    }

    return new Response(challenge, { status: 200 });
  } catch (err) {
    console.error('[WA webhook] GET error:', err);
    return new Response('Internal Server Error', { status: 500 });
  }
}

// POST — incoming messages from Meta
export async function POST(req: Request) {
  // Always return 200 to Meta — even on error (prevents Meta retries flooding)
  try {
    const rawBody = await req.text();

    // Verify HMAC SHA256 signature
    const signature = req.headers.get('x-hub-signature-256') ?? '';
    const appSecret = process.env.META_APP_SECRET ?? '';

    if (appSecret && !(await verifySignature(rawBody, signature, appSecret))) {
      console.error('[WA webhook] Invalid signature — ignoring payload');
      return NextResponse.json({ ok: true }); // Still 200 to Meta
    }

    const payload: MetaWebhookPayload = JSON.parse(rawBody);

    if (payload.object !== 'whatsapp_business_account') {
      return NextResponse.json({ ok: true });
    }

    // Resolve siteId from phoneNumberId in the payload
    const phoneNumberId = payload.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;
    if (!phoneNumberId) return NextResponse.json({ ok: true });

    const siteId = await resolveSiteId(phoneNumberId);
    if (!siteId) {
      console.warn('[WA webhook] No site found for phoneNumberId:', phoneNumberId);
      return NextResponse.json({ ok: true });
    }

    // Process async — don't block the 200 response
    processIncomingMessage(siteId, payload).catch(err =>
      console.error('[WA webhook] processIncomingMessage error:', err)
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[WA webhook] POST error:', err);
    return NextResponse.json({ ok: true }); // Always 200 to Meta
  }
}

async function resolveSiteId(phoneNumberId: string): Promise<string | null> {
  try {
    const snap = await adminDb
      .collectionGroup('config')
      .where('phoneNumberId', '==', phoneNumberId)
      .where('status', '==', 'connected')
      .limit(1)
      .get();

    if (snap.empty) return null;

    // Path: sites/{siteId}/wa/config — extract siteId
    const path = snap.docs[0].ref.path; // sites/{siteId}/wa/config
    const parts = path.split('/');
    return parts[1] ?? null; // index 1 = siteId
  } catch {
    return null;
  }
}

async function verifySignature(
  body: string,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
    const hex = Array.from(new Uint8Array(sig))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    const expected = `sha256=${hex}`;
    return signature === expected;
  } catch {
    return false;
  }
}
