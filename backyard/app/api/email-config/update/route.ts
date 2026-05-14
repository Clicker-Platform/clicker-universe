import { NextRequest, NextResponse } from 'next/server';
import { adminDb, FieldValue } from '@/lib/firebase-admin';
import { requireSuperadmin } from '@/lib/require-superadmin';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const auth = await requireSuperadmin(req);
  if (!auth.ok) return auth.res;
  try {
    const body = await req.json() as {
      templates?: Record<string, string>;
      sender?: Record<string, string>;
      updatedBy?: string;
    };

    await adminDb.doc('platform/settings/email/config').set(
      {
        ...(body.templates && { templates: body.templates }),
        ...(body.sender && { sender: body.sender }),
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: body.updatedBy ?? 'unknown',
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
