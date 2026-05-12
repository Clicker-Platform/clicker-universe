import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import type { CreditBalance } from './types';

const CREDIT_DOC_PATH = (siteId: string) => `sites/${siteId}/platform/aiCredits`;

function ledgerCol(db: Firestore, siteId: string) {
  return db.collection('sites').doc(siteId)
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
  const db = getFirestore();
  const creditRef = db.doc(CREDIT_DOC_PATH(siteId));

  return db.runTransaction(async (transaction) => {
    const creditDoc = await transaction.get(creditRef);

    if (!creditDoc.exists) {
      transaction.set(creditRef, { balance: 0, lifetimeUsed: 0 });
      throw new Error(`insufficient_credits:0:${costUSD}`);
    }

    const balance: number = creditDoc.data()?.balance ?? 0;
    if (balance < costUSD) {
      throw new Error(`insufficient_credits:${balance}:${costUSD}`);
    }

    const balanceAfter = Math.round((balance - costUSD) * 1_000_000) / 1_000_000;
    transaction.update(creditRef, {
      balance: balanceAfter,
      lifetimeUsed: FieldValue.increment(costUSD),
    });

    transaction.set(ledgerCol(db, siteId).doc(), {
      type: 'debit',
      amount: -costUSD,
      balanceAfter,
      moduleId: meta.moduleId,
      skillId: meta.skillId,
      model: meta.model,
      inputTokens: meta.inputTokens,
      outputTokens: meta.outputTokens,
      costUSD,
      performedBy: meta.uid,
      createdAt: FieldValue.serverTimestamp(),
    });

    return { balanceAfter };
  });
}

export async function refundCredits(
  siteId: string,
  costUSD: number,
  meta: { moduleId: string; skillId: string; reason: string; model: string }
): Promise<void> {
  const db = getFirestore();
  const batch = db.batch();

  batch.update(db.doc(CREDIT_DOC_PATH(siteId)), {
    balance: FieldValue.increment(costUSD),
    lifetimeUsed: FieldValue.increment(-costUSD),
  });

  batch.set(ledgerCol(db, siteId).doc(), {
    type: 'refund',
    amount: costUSD,
    moduleId: meta.moduleId,
    skillId: meta.skillId,
    model: meta.model,
    description: `Refund: ${meta.reason}`,
    performedBy: 'system',
    createdAt: FieldValue.serverTimestamp(),
  });

  await batch.commit();
}

export async function addCredits(
  siteId: string,
  amountUSD: number,
  meta: { performedBy: string; reason: string }
): Promise<{ balanceAfter: number }> {
  const db = getFirestore();
  const creditRef = db.doc(CREDIT_DOC_PATH(siteId));

  return db.runTransaction(async (transaction) => {
    const creditDoc = await transaction.get(creditRef);
    const currentBalance: number = creditDoc.exists ? (creditDoc.data()?.balance ?? 0) : 0;
    const balanceAfter = Math.round((currentBalance + amountUSD) * 1_000_000) / 1_000_000;

    if (creditDoc.exists) {
      transaction.update(creditRef, { balance: balanceAfter });
    } else {
      transaction.set(creditRef, { balance: balanceAfter, lifetimeUsed: 0 });
    }

    transaction.set(ledgerCol(db, siteId).doc(), {
      type: 'topup',
      amount: amountUSD,
      balanceAfter,
      moduleId: 'platform',
      skillId: 'manual_topup',
      description: meta.reason,
      performedBy: meta.performedBy,
      createdAt: FieldValue.serverTimestamp(),
    });

    return { balanceAfter };
  });
}

export async function getCreditBalance(siteId: string): Promise<CreditBalance> {
  const db = getFirestore();
  const doc = await db.doc(CREDIT_DOC_PATH(siteId)).get();
  if (!doc.exists) return { balance: 0, lifetimeUsed: 0 };
  const data = doc.data()!;
  return { balance: data.balance ?? 0, lifetimeUsed: data.lifetimeUsed ?? 0 };
}
