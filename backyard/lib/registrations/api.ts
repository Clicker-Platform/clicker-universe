import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
  where,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { REGISTRATION_REQUESTS_COLLECTION } from './constants';
import type { RegistrationRequest, RegistrationStatus } from './types';

function toRegistration(id: string, data: Record<string, unknown>): RegistrationRequest {
  return {
    id,
    name: (data.name as string) ?? '',
    email: (data.email as string) ?? '',
    phone: (data.phone as string) ?? '',
    businessName: (data.businessName as string) ?? '',
    businessType: (data.businessType as RegistrationRequest['businessType']) ?? 'other',
    city: (data.city as string) ?? '',
    expectedOutlets: (data.expectedOutlets as number) ?? 1,
    bundle: (data.bundle as string | null) ?? null,
    modules: (data.modules as string[]) ?? [],
    customRequest: (data.customRequest as string) ?? '',
    promoCode: (data.promoCode as string | null) ?? null,
    promoCodeValidAtSubmit: (data.promoCodeValidAtSubmit as boolean) ?? false,
    status: (data.status as RegistrationStatus) ?? 'pending',
    createdAt: data.createdAt as Timestamp,
    updatedAt: data.updatedAt as Timestamp,
    activatedSiteId: (data.activatedSiteId as string | null) ?? null,
    activatedAt: (data.activatedAt as Timestamp | null) ?? null,
    rejectionReason: (data.rejectionReason as string | null) ?? null,
    internalNotes: (data.internalNotes as string) ?? '',
    source: (data.source as string | null) ?? null,
    tempPassword: (data.tempPassword as string | null) ?? null,
    credentialsSent: (data.credentialsSent as boolean) ?? false,
    credentialsSentAt: (data.credentialsSentAt as Timestamp | null) ?? null,
  };
}

export async function listRegistrations(
  filterStatus?: RegistrationStatus,
): Promise<RegistrationRequest[]> {
  const col = collection(db, REGISTRATION_REQUESTS_COLLECTION);
  const q = filterStatus
    ? query(col, where('status', '==', filterStatus), orderBy('createdAt', 'desc'))
    : query(col, orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => toRegistration(d.id, d.data()));
}

export async function getRegistration(id: string): Promise<RegistrationRequest | null> {
  const ref = doc(db, REGISTRATION_REQUESTS_COLLECTION, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return toRegistration(snap.id, snap.data());
}

export async function setStatus(
  id: string,
  status: RegistrationStatus,
  extra?: { activatedSiteId?: string; rejectionReason?: string },
): Promise<void> {
  const ref = doc(db, REGISTRATION_REQUESTS_COLLECTION, id);
  const patch: Record<string, unknown> = { status, updatedAt: serverTimestamp() };
  if (status === 'activated' && extra?.activatedSiteId) {
    patch.activatedSiteId = extra.activatedSiteId;
    patch.activatedAt = serverTimestamp();
  }
  if (status === 'rejected' && extra?.rejectionReason) {
    patch.rejectionReason = extra.rejectionReason;
  }
  await updateDoc(ref, patch);
}

export async function saveNotes(id: string, internalNotes: string): Promise<void> {
  const ref = doc(db, REGISTRATION_REQUESTS_COLLECTION, id);
  await updateDoc(ref, { internalNotes, updatedAt: serverTimestamp() });
}

export async function countPriorByEmail(
  email: string,
  excludeId: string,
): Promise<number> {
  const col = collection(db, REGISTRATION_REQUESTS_COLLECTION);
  const q = query(col, where('email', '==', email));
  const snap = await getDocs(q);
  return snap.docs.filter((d) => d.id !== excludeId).length;
}
