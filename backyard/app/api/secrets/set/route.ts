import { NextRequest, NextResponse } from 'next/server';
import { setSecret, SECRET_KEYS } from '@/lib/secrets';
import type { SecretKey } from '@/lib/secrets';
import { adminDb, FieldValue } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { key, value } = await req.json() as { key: string; value: string };

    if (!key || !value) {
      return NextResponse.json({ error: 'key and value required' }, { status: 400 });
    }
    if (!(key in SECRET_KEYS)) {
      return NextResponse.json({ error: `Unknown secret key: ${key}` }, { status: 400 });
    }

    await setSecret(key as SecretKey, value);

    await adminDb.collection('platform/auditLog/entries').add({
      action: 'secret.set',
      key,
      performedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
