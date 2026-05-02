// lib/modules/promo/api/settings.ts
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { PromoSettings } from '../types';
import { SETTINGS_DOC, DEFAULT_PROMO_SETTINGS } from '../constants';

export async function getPromoSettings(siteId: string): Promise<PromoSettings> {
  const ref = doc(db, 'sites', siteId, SETTINGS_DOC);
  const snap = await getDoc(ref);
  if (snap.exists()) return snap.data() as PromoSettings;
  return DEFAULT_PROMO_SETTINGS as PromoSettings;
}

export async function updatePromoSettings(siteId: string, patch: Partial<PromoSettings>): Promise<void> {
  const ref = doc(db, 'sites', siteId, SETTINGS_DOC);
  await setDoc(ref, { ...patch, updatedAt: serverTimestamp() }, { merge: true });
}
