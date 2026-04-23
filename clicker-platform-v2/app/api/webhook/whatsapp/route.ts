import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { adminDb } from '@/lib/firebase-admin';
import { processIncomingMessage } from '@/lib/whatsapp/webhook-processor';
import type { MetaWebhookPayload } from '@/lib/whatsapp/types';

export const dynamic = 'force-dynamic';

/**
 * GET — Meta webhook verification (hub challenge handshake).
 * Fast path: match against WA_WEBHOOK_VERIFY_TOKEN env var.
 * Fallback: per-tenant lookup in Firestore wa/config.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const mode = searchParams.get('hub.mode');
  const challenge = searchParams.get('hub.challenge');
  const verifyToken = searchParams.get('hub.verify_token');

  if (mode !== 'subscribe' || !challenge || !verifyToken) {
    return new Response('Bad Request', { status: 400 });
  }

  // Fast path: global env token
  const globalToken = process.env.WA_WEBHOOK_VERIFY_TOKEN;
  if (globalToken && verifyToken === globalToken) {
    return new Response(challenge, { status: 200 });
  }

  // Per-tenant: find site with matching webhookVerifyToken
  try {
    const snap = await adminDb
      .collectionGroup('config')
      .where('webhookVerifyToken', '==', verifyToken)
      .where('status', '==', 'connected')
      .limit(1)
      .get();

    if (snap.empty) return new Response('Forbidden', { status: 403 });
    return new Response(challenge, { status: 200 });
  } catch (err) {
    console.error('[WA webhook] GET error:', err);
    return new Response('Forbidden', { status: 403 });
  }
}

/**
 * POST — Incoming webhook events from Meta.
 * Always returns 200 to Meta (prevents flood retries on transient errors).
 * Validates HMAC-SHA256 signature before processing.
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-hub-signature-256') ?? '';
    const appSecret = process.env.META_APP_SECRET ?? '';

    if (appSecret && !validateSignature(rawBody, signature, appSecret)) {
      console.error('[WA webhook] Invalid signature — ignoring payload');
      return NextResponse.json({ ok: true }); // Still 200 to Meta
    }

    let payload: MetaWebhookPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ ok: true });
    }

    if (payload.object !== 'whatsapp_business_account') {
      return NextResponse.json({ ok: true });
    }

    const phoneNumberId = payload.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;
    if (!phoneNumberId) return NextResponse.json({ ok: true });

    const siteId = await resolveSiteId(phoneNumberId);
    if (!siteId) {
      console.warn('[WA webhook] No site found for phoneNumberId:', phoneNumberId);
      return NextResponse.json({ ok: true });
    }

    // Process async — respond 200 immediately so Meta doesn't retry
    processIncomingMessage(siteId, payload).catch(err =>
      console.error('[WA webhook] processIncomingMessage error:', err)
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[WA webhook] POST error:', err);
    return NextResponse.json({ ok: true }); // Always 200 to Meta
  }
}

function validateSignature(body: string, signature: string, appSecret: string): boolean {
  try {
    const expected = 'sha256=' + createHmac('sha256', appSecret).update(body).digest('hex');
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
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

    // Path: sites/{siteId}/wa/config — parts[1] = siteId
    const parts = snap.docs[0].ref.path.split('/');
    return parts[1] ?? null;
  } catch {
    return null;
  }
}
