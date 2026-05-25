// Digital Goods Module — Orders (Plan 2 client-side API)
// Server-only writes that touch payment state live in server-api.ts.

import {
  collection, doc, getDoc, getDocs, addDoc, query, where, orderBy,
  onSnapshot, serverTimestamp, Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTION_ORDERS } from './constants';
import type { DigitalOrder, OrderStatus, PaymentInstructions, ProductSnapshot } from './types';

// Re-export OrderStatus so test file can import from here
export type { OrderStatus };

// Status transition table (used by both client UI and server confirm endpoint)
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (from === 'pending'                 && to === 'awaiting_confirmation') return true;
  if (from === 'awaiting_confirmation'   && to === 'paid')                  return true;
  if (from === 'awaiting_confirmation'   && to === 'cancelled')             return true;
  return false;
}

export async function getOrder(siteId: string, orderId: string): Promise<DigitalOrder | null> {
  const snap = await getDoc(doc(db, 'sites', siteId, COLLECTION_ORDERS, orderId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as DigitalOrder;
}

export async function listOrders(siteId: string): Promise<DigitalOrder[]> {
  const q = query(
    collection(db, 'sites', siteId, COLLECTION_ORDERS),
    orderBy('createdAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as DigitalOrder));
}

export async function listOrdersForBuyer(siteId: string, buyerId: string): Promise<DigitalOrder[]> {
  const q = query(
    collection(db, 'sites', siteId, COLLECTION_ORDERS),
    where('buyerId', '==', buyerId),
    orderBy('createdAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as DigitalOrder));
}

// Live subscription for order status page (Plan 2: buyer order status, admin orders list refresh)
export function subscribeOrder(
  siteId: string,
  orderId: string,
  cb: (order: DigitalOrder | null) => void,
): Unsubscribe {
  const ref = doc(db, 'sites', siteId, COLLECTION_ORDERS, orderId);
  return onSnapshot(ref, snap => {
    if (!snap.exists()) cb(null);
    else cb({ id: snap.id, ...snap.data() } as DigitalOrder);
  });
}

// Create order — called from checkout server action only. Client never calls directly.
// Exposed here for typing convenience; security rules block client writes to orders/*.
export type NewOrderInput = {
  buyerId: string;
  productId: string;
  productSnapshot: ProductSnapshot;
  amount: number;
  paymentInstructions: PaymentInstructions;
  buyerNote?: string;
};

export async function createOrderClient(siteId: string, input: NewOrderInput): Promise<string> {
  // NOTE: rules will block this in production; use the server endpoint. Kept here for tests.
  const ref = await addDoc(collection(db, 'sites', siteId, COLLECTION_ORDERS), {
    ...input,
    currency: 'IDR',
    paymentMethod: 'manual_transfer',
    status: 'awaiting_confirmation',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}
