// lib/modules/promo/api/promos.ts
import {
  collection, doc, getDoc, getDocs, query, where, orderBy, limit,
  setDoc, updateDoc, deleteDoc, serverTimestamp, Timestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Promo, PromoStatus } from '../types';
import { PROMOS_COLLECTION } from '../constants';

export async function listPromos(siteId: string): Promise<Promo[]> {
  const q = query(
    collection(db, 'sites', siteId, PROMOS_COLLECTION),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Promo));
}

export async function getPromo(siteId: string, promoId: string): Promise<Promo | null> {
  const ref = doc(db, 'sites', siteId, PROMOS_COLLECTION, promoId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Promo;
}

export async function findPromoByCode(siteId: string, code: string): Promise<Promo | null> {
  const upper = code.trim().toUpperCase();
  const q = query(
    collection(db, 'sites', siteId, PROMOS_COLLECTION),
    where('code', '==', upper),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as Promo;
}

// Recursively remove undefined values from an object before writing to Firestore
function stripUndefined<T extends Record<string, any>>(obj: T): T {
  const out: any = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    out[k] = v !== null && typeof v === 'object' && !Array.isArray(v) && typeof v.toDate !== 'function'
      ? stripUndefined(v)
      : v;
  }
  return out;
}

export async function createPromo(
  siteId: string,
  data: Omit<Promo, 'id' | 'siteId' | 'createdAt' | 'updatedAt' | 'usageCount'>
): Promise<Promo> {
  const ref = doc(collection(db, 'sites', siteId, PROMOS_COLLECTION));
  const payload = stripUndefined({
    ...data,
    siteId,
    code: data.code ? data.code.trim().toUpperCase() : null,
    usageCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await setDoc(ref, payload);
  return { id: ref.id, ...payload, createdAt: Timestamp.now(), updatedAt: Timestamp.now() } as Promo;
}

export async function updatePromo(siteId: string, promoId: string, patch: Partial<Promo>): Promise<void> {
  const ref = doc(db, 'sites', siteId, PROMOS_COLLECTION, promoId);
  const { id: _id, siteId: _siteId, createdAt: _createdAt, ...rest } = patch as any;
  const cleaned = stripUndefined({ ...rest, updatedAt: serverTimestamp() });
  if (patch.code !== undefined) cleaned.code = patch.code ? patch.code.trim().toUpperCase() : null;
  await updateDoc(ref, cleaned);
}

export async function setPromoStatus(siteId: string, promoId: string, status: PromoStatus): Promise<void> {
  await updatePromo(siteId, promoId, { status });
}

export async function deletePromo(siteId: string, promoId: string): Promise<void> {
  const ref = doc(db, 'sites', siteId, PROMOS_COLLECTION, promoId);
  await deleteDoc(ref);
}

export async function getMemberUsageCount(
  siteId: string,
  promoId: string,
  memberId: string,
): Promise<number> {
  const ref = doc(db, 'sites', siteId, PROMOS_COLLECTION, promoId, 'memberUsage', memberId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return 0;
  return (snap.data().count as number) ?? 0;
}

export async function findAutoPromos(siteId: string): Promise<Promo[]> {
  const q = query(
    collection(db, 'sites', siteId, PROMOS_COLLECTION),
    where('trigger', '==', 'auto'),
    where('status', '==', 'active')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Promo));
}

export async function listClaimablePromos(siteId: string, memberId: string): Promise<Promo[]> {
  const q = query(
    collection(db, 'sites', siteId, PROMOS_COLLECTION),
    where('trigger', '==', 'claim'),
    where('status', '==', 'active')
  );
  const snap = await getDocs(q);
  const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as Promo));
  return all.filter(p => {
    if (typeof p.costInPoints !== 'number' || p.costInPoints <= 0) return false;
    const aud = p.conditions.audience;
    if (aud === 'specific' && !p.conditions.specificMemberIds?.includes(memberId)) return false;
    return true;
  });
}
