import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import type { CreditBalance } from './types';

const CREDIT_DOC_PATH = (siteId: string) => `sites/${siteId}/platform/aiCredits`;

function dailyDoc(siteId: string) {
  const date = new Date().toISOString().slice(0, 10);
  return adminDb
    .collection('sites').doc(siteId)
    .collection('platform').doc('aiCreditLedger')
    .collection('daily').doc(date);
}

function topupCol(siteId: string) {
  return adminDb
    .collection('sites').doc(siteId)
    .collection('platform').doc('aiCreditLedger')
    .collection('entries');
}

export async function deductCredits(
  siteId: string,
  costUSD: number,
  meta: {
    moduleId: string;
    skillId: string;
    uid: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
  }
): Promise<{ balanceAfter: number }> {
  const creditRef = adminDb.doc(CREDIT_DOC_PATH(siteId));

  const balanceAfter = await adminDb.runTransaction(async (transaction) => {
    const creditDoc = await transaction.get(creditRef);

    if (!creditDoc.exists) {
      transaction.set(creditRef, { balance: 0, lifetimeUsed: 0 });
      throw new Error(`insufficient_credits:0:${costUSD}`);
    }

    const balance: number = creditDoc.data()?.balance ?? 0;
    if (balance < costUSD) {
      throw new Error(`insufficient_credits:${balance}:${costUSD}`);
    }

    const after = Math.round((balance - costUSD) * 1_000_000) / 1_000_000;
    transaction.update(creditRef, {
      balance: after,
      lifetimeUsed: FieldValue.increment(costUSD),
    });

    return after;
  });

  await dailyDoc(siteId).set({
    date: new Date().toISOString().slice(0, 10),
    totalCost: FieldValue.increment(costUSD),
    callCount: FieldValue.increment(1),
    inputTokens: FieldValue.increment(meta.inputTokens),
    outputTokens: FieldValue.increment(meta.outputTokens),
    [`byModule.${meta.moduleId}.cost`]: FieldValue.increment(costUSD),
    [`byModule.${meta.moduleId}.calls`]: FieldValue.increment(1),
  }, { merge: true });

  return { balanceAfter };
}

export async function refundCredits(
  siteId: string,
  costUSD: number,
  _meta?: { moduleId: string; skillId: string; reason: string; model: string }
): Promise<void> {
  await adminDb.doc(CREDIT_DOC_PATH(siteId)).update({
    balance: FieldValue.increment(costUSD),
    lifetimeUsed: FieldValue.increment(-costUSD),
  });
}

export async function addCredits(
  siteId: string,
  amountUSD: number,
  meta: { performedBy: string; reason: string }
): Promise<{ balanceAfter: number }> {
  const creditRef = adminDb.doc(CREDIT_DOC_PATH(siteId));

  return adminDb.runTransaction(async (transaction) => {
    const creditDoc = await transaction.get(creditRef);
    const currentBalance: number = creditDoc.exists ? (creditDoc.data()?.balance ?? 0) : 0;
    const balanceAfter = Math.round((currentBalance + amountUSD) * 1_000_000) / 1_000_000;

    if (creditDoc.exists) {
      transaction.update(creditRef, { balance: balanceAfter });
    } else {
      transaction.set(creditRef, { balance: balanceAfter, lifetimeUsed: 0 });
    }

    transaction.set(topupCol(siteId).doc(), {
      type: 'topup',
      amount: amountUSD,
      balanceAfter,
      description: meta.reason,
      performedBy: meta.performedBy,
      createdAt: FieldValue.serverTimestamp(),
    });

    return { balanceAfter };
  });
}

export async function getCreditBalance(siteId: string): Promise<CreditBalance> {
  const doc = await adminDb.doc(CREDIT_DOC_PATH(siteId)).get();
  if (!doc.exists) return { balance: 0, lifetimeUsed: 0 };
  const data = doc.data()!;
  return { balance: data.balance ?? 0, lifetimeUsed: data.lifetimeUsed ?? 0 };
}
