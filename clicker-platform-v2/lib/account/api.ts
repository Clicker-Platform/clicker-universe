import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTION_ACCOUNTS } from './constants';
import type { Account } from './types';

export async function getAccountClient(siteId: string, uid: string): Promise<Account | null> {
  const snap = await getDoc(doc(db, 'sites', siteId, COLLECTION_ACCOUNTS, uid));
  if (!snap.exists()) return null;
  return { uid, ...(snap.data() as Omit<Account, 'uid'>) };
}
