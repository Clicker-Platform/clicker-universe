import {
  collection, doc, getDocs, addDoc, deleteDoc,
  query, orderBy, serverTimestamp, getDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { VaultSKU, VaultUnit } from './types';
import { STOCKLENS_SKUS, STOCKLENS_UNITS } from './constants';

export async function getVaultSKUs(siteId: string): Promise<VaultSKU[]> {
  const q = query(
    collection(db, 'sites', siteId, STOCKLENS_SKUS),
    orderBy('name')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as VaultSKU));
}

export async function getVaultSKU(siteId: string, skuId: string): Promise<VaultSKU | null> {
  const snap = await getDoc(doc(db, 'sites', siteId, STOCKLENS_SKUS, skuId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as VaultSKU;
}

export async function createVaultSKU(
  siteId: string,
  data: Omit<VaultSKU, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const ref = await addDoc(collection(db, 'sites', siteId, STOCKLENS_SKUS), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function deleteVaultSKU(siteId: string, skuId: string): Promise<void> {
  await deleteDoc(doc(db, 'sites', siteId, STOCKLENS_SKUS, skuId));
}

export async function getVaultUnits(siteId: string, skuId: string): Promise<VaultUnit[]> {
  const q = query(
    collection(db, 'sites', siteId, STOCKLENS_SKUS, skuId, STOCKLENS_UNITS),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as VaultUnit));
}

export async function createVaultUnit(
  siteId: string,
  skuId: string,
  data: Omit<VaultUnit, 'id' | 'createdAt'>
): Promise<string> {
  const ref = await addDoc(
    collection(db, 'sites', siteId, STOCKLENS_SKUS, skuId, STOCKLENS_UNITS),
    { ...data, createdAt: serverTimestamp() }
  );
  return ref.id;
}

export async function deleteVaultUnit(siteId: string, skuId: string, unitId: string): Promise<void> {
  await deleteDoc(doc(db, 'sites', siteId, STOCKLENS_SKUS, skuId, STOCKLENS_UNITS, unitId));
}
