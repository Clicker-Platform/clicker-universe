import {
  collection,
  query,
  where,
  getDocs,
  limit,
  doc,
  runTransaction,
  increment
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

const PROMOS_COLLECTION = 'modules/promo/promos';
const REGISTRATION_PROMO_SITE_ID = 'go';

export async function commitRegistrationPromo(_targetSiteId: string, code: string): Promise<void> {
  const promoCode = code.trim().toUpperCase();
  const siteId = REGISTRATION_PROMO_SITE_ID;
  const promosRef = collection(db, 'sites', siteId, PROMOS_COLLECTION);
  const q = query(promosRef, where('code', '==', promoCode), limit(1));

  const snap = await getDocs(q);
  if (snap.empty) {
    console.warn(`[Promo] Code ${promoCode} not found for site ${siteId}`);
    return;
  }

  const promoDoc = snap.docs[0];
  const promoRef = doc(db, 'sites', siteId, PROMOS_COLLECTION, promoDoc.id);

  await runTransaction(db, async (tx) => {
    tx.update(promoRef, {
      usageCount: increment(1),
      updatedAt: new Date()
    });
  });
}
