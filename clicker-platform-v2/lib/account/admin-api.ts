import { adminDb } from '@/lib/firebase-admin';
import { COLLECTION_ACCOUNTS } from './constants';
import type { Account } from './types';

// Tenant-facing read of the account-tier members for a site (admin SDK, server-only by
// virtue of the firebase-admin import). Newest first.
export async function listAccounts(siteId: string): Promise<Account[]> {
  const snap = await adminDb
    .collection(`sites/${siteId}/${COLLECTION_ACCOUNTS}`)
    .orderBy('createdAt', 'desc')
    .get();
  return snap.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<Account, 'uid'>) }));
}
