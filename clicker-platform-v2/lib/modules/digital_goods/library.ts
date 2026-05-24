// Digital Goods Module — Library (Plan 2 client-side reads)
// Server-only writes (creating library entries on order paid) live in server-api.ts.

import {
  collection, doc, getDoc, getDocs, query, where, orderBy, limit,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTION_LIBRARY } from './constants';
import type { LibraryEntry } from './types';

export async function getLibraryEntry(siteId: string, entryId: string): Promise<LibraryEntry | null> {
  const snap = await getDoc(doc(db, 'sites', siteId, COLLECTION_LIBRARY, entryId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as LibraryEntry;
}

export async function getLibraryForBuyer(siteId: string, buyerId: string): Promise<LibraryEntry[]> {
  const q = query(
    collection(db, 'sites', siteId, COLLECTION_LIBRARY),
    where('buyerId', '==', buyerId),
    orderBy('purchasedAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as LibraryEntry));
}

// "Already purchased" guard for product detail page.
export async function hasLibraryEntryForProduct(
  siteId: string, buyerId: string, productId: string,
): Promise<LibraryEntry | null> {
  const q = query(
    collection(db, 'sites', siteId, COLLECTION_LIBRARY),
    where('buyerId', '==', buyerId),
    where('productId', '==', productId),
    limit(1),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as LibraryEntry;
}
