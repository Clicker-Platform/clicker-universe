import { NextRequest, NextResponse } from 'next/server';
import { deleteSecret, SECRET_KEYS } from '@/lib/secrets';
import type { SecretKey } from '@/lib/secrets';
import { adminDb, FieldValue } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function DELETE(req: NextRequest) {
  try {
    const { key } = await req.json() as { key: string };

    if (!key || !(key in SECRET_KEYS)) {
      return NextResponse.json({ error: `Unknown secret key: ${key}` }, { status: 400 });
    }

    await deleteSecret(key as SecretKey);

    await adminDb.collection('platform/auditLog/entries').add({
      action: 'secret.delete',
      key,
      performedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
