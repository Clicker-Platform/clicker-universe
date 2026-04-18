// Platform-level AI credit system — shared across all AI modules
// Uses Firestore transactions to prevent race conditions (double-spend)

import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { CreditBalance } from './types';

const CREDIT_DOC_PATH = (siteId: string) => `sites/${siteId}/platform/aiCredits`;
const LEDGER_PATH = (siteId: string) => `sites/${siteId}/platform/aiCreditLedger`;

export const DEFAULT_FREE_CREDITS = 100;

/**
 * Atomically deducts credits. Throws if insufficient balance.
 * Throws error string format: "insufficient_credits:{balance}:{required}"
 */
export async function deductCredits(
  siteId: string,
  creditCost: number,
  meta: { moduleId: string; skillId: string; uid: string; description?: string }
): Promise<{ balanceAfter: number }> {
  const db = getFirestore();
  const creditRef = db.doc(CREDIT_DOC_PATH(siteId));

  return db.runTransaction(async (transaction) => {
    const creditDoc = await transaction.get(creditRef);

    if (!creditDoc.exists) {
      // Auto-initialize if missing (safety net)
      transaction.set(creditRef, { balance: 0, lifetimeUsed: 0 });
      throw new Error(`insufficient_credits:0:${creditCost}`);
    }

    const balance = creditDoc.data()?.balance ?? 0;
    if (balance < creditCost) {
      throw new Error(`insufficient_credits:${balance}:${creditCost}`);
    }

    const balanceAfter = balance - creditCost;
    transaction.update(creditRef, {
      balance: balanceAfter,
      lifetimeUsed: FieldValue.increment(creditCost),
    });

    const ledgerRef = db.collection(LEDGER_PATH(siteId)).doc();
    transaction.set(ledgerRef, {
      type: 'debit',
      amount: -creditCost,
      balanceAfter,
      moduleId: meta.moduleId,
      skillId: meta.skillId,
      description: meta.description ?? `AI call: ${meta.skillId}`,
      performedBy: meta.uid,
      createdAt: FieldValue.serverTimestamp(),
    });

    return { balanceAfter };
  });
}

/**
 * Refunds credits after a failed AI call.
 * Does NOT use a transaction (refund can be non-atomic — only adds back balance).
 */
export async function refundCredits(
  siteId: string,
  creditCost: number,
  meta: { moduleId: string; skillId: string; reason: string }
): Promise<void> {
  const db = getFirestore();
  const batch = db.batch();

  const creditRef = db.doc(CREDIT_DOC_PATH(siteId));
  batch.update(creditRef, {
    balance: FieldValue.increment(creditCost),
    lifetimeUsed: FieldValue.increment(-creditCost),
  });

  const ledgerRef = db.collection(LEDGER_PATH(siteId)).doc();
  batch.set(ledgerRef, {
    type: 'refund',
    amount: creditCost,
    moduleId: meta.moduleId,
    skillId: meta.skillId,
    description: `Refund: ${meta.reason}`,
    performedBy: 'system',
    createdAt: FieldValue.serverTimestamp(),
  });

  await batch.commit();
}

/**
 * Adds credits to a tenant (used by Backyard admin top-up).
 */
export async function addCredits(
  siteId: string,
  amount: number,
  meta: { performedBy: string; reason: string }
): Promise<{ balanceAfter: number }> {
  const db = getFirestore();
  const creditRef = db.doc(CREDIT_DOC_PATH(siteId));

  return db.runTransaction(async (transaction) => {
    const creditDoc = await transaction.get(creditRef);
    const currentBalance = creditDoc.exists ? (creditDoc.data()?.balance ?? 0) : 0;
    const balanceAfter = currentBalance + amount;

    if (creditDoc.exists) {
      transaction.update(creditRef, { balance: balanceAfter });
    } else {
      transaction.set(creditRef, { balance: balanceAfter, lifetimeUsed: 0 });
    }

    const ledgerRef = db.collection(LEDGER_PATH(siteId)).doc();
    transaction.set(ledgerRef, {
      type: 'topup',
      amount,
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

/**
 * Initializes credit balance for a new tenant.
 * Called from createTenant Cloud Function.
 */
export async function initTenantCredits(siteId: string): Promise<void> {
  const db = getFirestore();
  const creditRef = db.doc(CREDIT_DOC_PATH(siteId));
  const batch = db.batch();

  batch.set(creditRef, {
    balance: DEFAULT_FREE_CREDITS,
    lifetimeUsed: 0,
  });

  const ledgerRef = db.collection(LEDGER_PATH(siteId)).doc();
  batch.set(ledgerRef, {
    type: 'topup',
    amount: DEFAULT_FREE_CREDITS,
    balanceAfter: DEFAULT_FREE_CREDITS,
    moduleId: 'platform',
    skillId: 'registration_bonus',
    description: `Welcome bonus: ${DEFAULT_FREE_CREDITS} free credits`,
    performedBy: 'system',
    createdAt: FieldValue.serverTimestamp(),
  });

  await batch.commit();
}

/**
 * Gets current credit balance for a tenant.
 */
export async function getCreditBalance(siteId: string): Promise<CreditBalance> {
  const db = getFirestore();
  const doc = await db.doc(CREDIT_DOC_PATH(siteId)).get();
  if (!doc.exists) return { balance: 0, lifetimeUsed: 0 };
  const data = doc.data()!;
  return { balance: data.balance ?? 0, lifetimeUsed: data.lifetimeUsed ?? 0 };
}
