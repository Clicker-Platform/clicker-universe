import { collection, query, where, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTION_LIBRARY } from './constants';
import { getLibraryForBuyer } from './library';
import type { MemberSurfaceContext } from '@/lib/modules/types';
import type { LibraryEntry } from './types';

// Cheap "does this account have any library entries?" — the account uid is the
// library key (same Firebase uid the order was placed under as buyerId).
export async function libraryHasData(ctx: MemberSurfaceContext): Promise<boolean> {
  const q = query(
    collection(db, 'sites', ctx.siteId, COLLECTION_LIBRARY),
    where('buyerId', '==', ctx.uid),
    limit(1),
  );
  const snap = await getDocs(q);
  return !snap.empty;
}

export async function getLibraryForAccount(ctx: MemberSurfaceContext): Promise<LibraryEntry[]> {
  return getLibraryForBuyer(ctx.siteId, ctx.uid);
}
