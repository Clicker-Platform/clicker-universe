import { NextRequest, NextResponse } from 'next/server';
import { adminDb, FieldValue } from '@/lib/firebase-admin';
import { requireSuperadmin } from '@/lib/require-superadmin';

export const dynamic = 'force-dynamic';

// GET /api/ai-settings/credits — list all sites with credit balance
export async function GET(req: NextRequest) {
  const auth = await requireSuperadmin(req);
  if (!auth.ok) return auth.res;
  try {
    const sitesSnap = await adminDb.collection('sites').get();
    const results = await Promise.all(
      sitesSnap.docs.map(async (siteDoc) => {
        const siteId = siteDoc.id;
        const creditDoc = await adminDb.doc(`sites/${siteId}/platform/aiCredits`).get();
        const data = creditDoc.data() ?? {};
        return {
          siteId,
          name: siteDoc.data().name ?? siteDoc.data().businessName ?? siteId,
          balance: data.balance ?? 0,
          lifetimeUsed: data.lifetimeUsed ?? 0,
        };
      })
    );
    results.sort((a, b) => b.balance - a.balance);
    return NextResponse.json({ sites: results });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/ai-settings/credits — top up credits for a site
export async function POST(req: NextRequest) {
  const auth = await requireSuperadmin(req);
  if (!auth.ok) return auth.res;
  try {
    const { siteId, amount, reason } = await req.json() as {
      siteId: string;
      amount: number;
      reason?: string;
    };

    if (!siteId || !amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid siteId or amount' }, { status: 400 });
    }

    const creditRef = adminDb.doc(`sites/${siteId}/platform/aiCredits`);

    const balanceAfter = await adminDb.runTransaction(async (tx) => {
      const doc = await tx.get(creditRef);
      const current = doc.exists ? (doc.data()?.balance ?? 0) : 0;
      const next = current + amount;
      if (doc.exists) {
        tx.update(creditRef, { balance: next });
      } else {
        tx.set(creditRef, { balance: next, lifetimeUsed: 0 });
      }
      const ledgerRef = adminDb.collection('sites').doc(siteId)
        .collection('platform').doc('aiCreditLedger').collection('entries').doc();
      tx.set(ledgerRef, {
        type: 'topup',
        amount,
        balanceAfter: next,
        moduleId: 'platform',
        skillId: 'manual_topup',
        description: reason ?? 'Manual top-up from Backyard',
        performedBy: 'superadmin',
        createdAt: FieldValue.serverTimestamp(),
      });
      return next;
    });

    return NextResponse.json({ ok: true, balanceAfter });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
