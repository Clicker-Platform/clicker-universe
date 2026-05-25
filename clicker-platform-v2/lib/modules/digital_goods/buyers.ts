// Digital Goods Module — Buyer identity (Plan 2)
// Digital_goods owns its own buyer record. No dependency on the membership module.

import {
  doc, getDoc, setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTION_BUYERS } from './constants';
import type { DigitalGoodsBuyer } from './types';

export async function getBuyer(siteId: string, uid: string): Promise<DigitalGoodsBuyer | null> {
  const snap = await getDoc(doc(db, 'sites', siteId, COLLECTION_BUYERS, uid));
  if (!snap.exists()) return null;
  return { uid, ...snap.data() } as DigitalGoodsBuyer;
}

// Upsert: create if absent, merge fields if present. Called from client on first authed visit
// (server-side equivalent lives in server-api.ts).
export async function upsertBuyer(
  siteId: string,
  uid: string,
  data: { email: string; fullName?: string }
): Promise<void> {
  const ref = doc(db, 'sites', siteId, COLLECTION_BUYERS, uid);
  const existing = await getDoc(ref);
  if (existing.exists()) {
    await setDoc(ref, {
      ...data,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } else {
    await setDoc(ref, {
      uid,
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
}
