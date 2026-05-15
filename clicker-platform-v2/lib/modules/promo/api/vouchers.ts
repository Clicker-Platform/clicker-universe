// lib/modules/promo/api/vouchers.ts
import {
  collection, doc, getDoc, getDocs, query, where, orderBy, limit,
  updateDoc, deleteDoc
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Voucher, VoucherStatus } from '../types';
import { VOUCHERS_COLLECTION } from '../constants';

export async function listAllVouchers(siteId: string): Promise<Voucher[]> {
  const q = query(
    collection(db, 'sites', siteId, VOUCHERS_COLLECTION),
    orderBy('issuedAt', 'desc'),
    limit(500)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Voucher));
}

export async function listMemberVouchers(siteId: string, memberId: string): Promise<Voucher[]> {
  const q = query(
    collection(db, 'sites', siteId, VOUCHERS_COLLECTION),
    where('ownerMemberId', '==', memberId),
    orderBy('issuedAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Voucher));
}

export async function findVoucherByCode(siteId: string, code: string): Promise<Voucher | null> {
  const upper = code.trim().toUpperCase();
  const q = query(
    collection(db, 'sites', siteId, VOUCHERS_COLLECTION),
    where('code', '==', upper),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as Voucher;
}

export async function getVoucher(siteId: string, voucherId: string): Promise<Voucher | null> {
  const ref = doc(db, 'sites', siteId, VOUCHERS_COLLECTION, voucherId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Voucher;
}

export async function findVoucherByUsedRef(
  siteId: string,
  source: string,
  refDocId: string
): Promise<Voucher | null> {
  const q = query(
    collection(db, 'sites', siteId, VOUCHERS_COLLECTION),
    where('usedSource', '==', source),
    where('usedRefId', '==', refDocId),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as Voucher;
}

export async function setVoucherStatus(siteId: string, voucherId: string, status: VoucherStatus): Promise<void> {
  const ref = doc(db, 'sites', siteId, VOUCHERS_COLLECTION, voucherId);
  await updateDoc(ref, { status });
}

export async function revokeVoucher(siteId: string, voucherId: string): Promise<void> {
  const ref = doc(db, 'sites', siteId, VOUCHERS_COLLECTION, voucherId);
  await deleteDoc(ref);
}
