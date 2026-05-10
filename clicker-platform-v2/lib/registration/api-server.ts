import { adminDb, Timestamp } from '@/lib/firebase-admin';
import { REGISTRATION_REQUESTS_COLLECTION } from './constants';
import type { RegistrationRequestInput } from './types';

export interface PromoValidationResult {
  valid: boolean;
  name?: string;
  reason?: string;
  kind?: 'percent' | 'fixed';
  value?: number;
  maxDiscount?: number;
}

const REGISTRATION_PROMO_SITE_ID = 'go';

export async function validatePromoCode(rawCode: string): Promise<PromoValidationResult> {
  const code = (rawCode ?? '').trim().toUpperCase();
  if (!code) {
    return { valid: false, reason: 'Code is empty' };
  }

  const snap = await adminDb
    .collection('sites')
    .doc(REGISTRATION_PROMO_SITE_ID)
    .collection('modules')
    .doc('promo')
    .collection('promos')
    .where('code', '==', code)
    .limit(1)
    .get();

  if (snap.empty || snap.docs.length === 0) {
    return { valid: false, reason: 'Promo code not found' };
  }

  const data = snap.docs[0].data() as {
    name?: string;
    kind?: 'percent' | 'fixed';
    value?: number;
    maxDiscount?: number;
  };
  return {
    valid: true,
    name: data.name,
    kind: data.kind,
    value: data.value,
    maxDiscount: data.maxDiscount,
  };
}

export async function createRegistrationRequest(
  input: RegistrationRequestInput
): Promise<string> {
  const ref = adminDb.collection(REGISTRATION_REQUESTS_COLLECTION).doc();
  const now = Timestamp.now();

  await ref.set({
    name: input.name,
    email: input.email,
    phone: input.phone,
    businessName: input.businessName,
    businessType: input.businessType,
    city: input.city,
    expectedOutlets: input.expectedOutlets,
    bundle: input.bundle,
    modules: input.modules,
    customRequest: input.customRequest,
    promoCode: input.promoCode ? input.promoCode.trim().toUpperCase() : null,
    promoCodeValidAtSubmit: input.promoCodeValidAtSubmit,
    source: input.source,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
    activatedSiteId: null,
    activatedAt: null,
    rejectionReason: null,
    internalNotes: '',
  });

  return ref.id;
}
