import { adminDb, Timestamp } from '@/lib/firebase-admin';
import { COLLECTION_ACCOUNTS } from './constants';
import type { Account, AccountCreatedVia } from './types';

function accountPath(siteId: string, uid: string) {
  return `sites/${siteId}/${COLLECTION_ACCOUNTS}/${uid}`;
}

export async function getAccount(siteId: string, uid: string): Promise<Account | null> {
  const snap = await adminDb.doc(accountPath(siteId, uid)).get();
  if (!snap.exists) return null;
  return { uid, ...(snap.data() as Omit<Account, 'uid'>) };
}

// Create a pending account if absent. Never overwrites an existing one.
export async function ensureAccount(
  siteId: string,
  uid: string,
  data: { email: string; fullName?: string; createdVia: AccountCreatedVia },
): Promise<void> {
  const ref = adminDb.doc(accountPath(siteId, uid));
  const existing = await ref.get();
  if (existing.exists) return;
  const now = Timestamp.now();
  await ref.set({
    uid,
    email: data.email,
    ...(data.fullName ? { fullName: data.fullName } : {}),
    status: 'pending',
    createdVia: data.createdVia,
    createdAt: now,
    updatedAt: now,
  });
}

export async function markAccountActive(siteId: string, uid: string): Promise<void> {
  await adminDb.doc(accountPath(siteId, uid)).set(
    { status: 'active', updatedAt: Timestamp.now() },
    { merge: true },
  );
}
