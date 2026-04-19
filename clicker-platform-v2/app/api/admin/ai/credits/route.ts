// GET /api/admin/ai/credits → returns { balance, lifetimeUsed } for current tenant
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const siteId = req.headers.get('x-site-id');
    if (!siteId) return NextResponse.json({ error: 'Site ID required' }, { status: 400 });

    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await adminAuth.verifyIdToken(authHeader.split('Bearer ')[1]);

    const doc = await adminDb.doc(`sites/${siteId}/platform/aiCredits`).get();

    if (!doc.exists) {
      return NextResponse.json({ balance: 0, lifetimeUsed: 0 });
    }

    const data = doc.data()!;
    return NextResponse.json({
      balance: data.balance ?? 0,
      lifetimeUsed: data.lifetimeUsed ?? 0,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
