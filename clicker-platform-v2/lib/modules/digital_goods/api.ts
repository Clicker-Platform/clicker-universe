// Digital Goods Module — Firestore API
// All paths from constants.ts. Site-scoped, never hardcoded.

import {
  collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc,
  query, orderBy, serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  COLLECTION_PRODUCTS,
  DOC_SETTINGS,
} from './constants';
import {
  DigitalProduct, DigitalGoodsSettings,
} from './types';

// --- Slug helpers ---

export function generateSlug(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function ensureUniqueSlug(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

// --- Products ---

export async function getProducts(siteId: string): Promise<DigitalProduct[]> {
  const q = query(
    collection(db, 'sites', siteId, COLLECTION_PRODUCTS),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as DigitalProduct));
}

export async function getProduct(siteId: string, productId: string): Promise<DigitalProduct | null> {
  const snap = await getDoc(doc(db, 'sites', siteId, COLLECTION_PRODUCTS, productId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as DigitalProduct;
}

export async function getAllSlugs(siteId: string): Promise<Set<string>> {
  const snap = await getDocs(collection(db, 'sites', siteId, COLLECTION_PRODUCTS));
  return new Set(snap.docs.map(d => (d.data() as DigitalProduct).slug));
}

type NewProduct = Omit<DigitalProduct, 'id' | 'createdAt' | 'updatedAt' | 'publishedAt'>;

export async function createProduct(siteId: string, data: NewProduct): Promise<string> {
  const ref = await addDoc(collection(db, 'sites', siteId, COLLECTION_PRODUCTS), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...(data.status === 'published' ? { publishedAt: serverTimestamp() } : {}),
  });
  return ref.id;
}

export async function updateProduct(
  siteId: string,
  productId: string,
  data: Partial<Omit<DigitalProduct, 'id' | 'createdAt'>>
): Promise<void> {
  const current = await getProduct(siteId, productId);
  const wasPublished = current?.status === 'published';
  const willBePublished = data.status === 'published';
  const transitionToPublished = !wasPublished && willBePublished;

  await updateDoc(doc(db, 'sites', siteId, COLLECTION_PRODUCTS, productId), {
    ...data,
    updatedAt: serverTimestamp(),
    ...(transitionToPublished ? { publishedAt: serverTimestamp() } : {}),
  });
}

export async function deleteProduct(siteId: string, productId: string): Promise<void> {
  await deleteDoc(doc(db, 'sites', siteId, COLLECTION_PRODUCTS, productId));
}

// --- Settings ---

export async function getSettings(siteId: string): Promise<DigitalGoodsSettings | null> {
  const snap = await getDoc(doc(db, 'sites', siteId, DOC_SETTINGS));
  if (!snap.exists()) return null;
  return snap.data() as DigitalGoodsSettings;
}

export async function saveSettings(siteId: string, data: DigitalGoodsSettings): Promise<void> {
  await setDoc(
    doc(db, 'sites', siteId, DOC_SETTINGS),
    { ...data, updatedAt: serverTimestamp() },
    { merge: true }
  );
}
