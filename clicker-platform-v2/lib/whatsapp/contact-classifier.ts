import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { WA_ROOT, WA_MAIN_DOC, WA_CONFIG_DOC, WA_CONTACTS } from './constants';
import { normalizePhone } from './phone';
import type { WAClassificationResult, WAConfig } from './types';

export async function classifyActor(
  siteId: string,
  phone: string
): Promise<WAClassificationResult> {
  if (!siteId || siteId === 'default' || siteId === 'pending') {
    return { type: 'unknown' };
  }

  // 1. Check if owner or staff via config
  const configRef = doc(db, 'sites', siteId, WA_ROOT, WA_CONFIG_DOC);
  const configSnap = await getDoc(configRef);

  if (configSnap.exists()) {
    const config = configSnap.data() as WAConfig;
    const normalized = normalizePhone(phone);

    if (config.ownerPhone && normalizePhone(config.ownerPhone) === normalized) {
      return { type: 'owner' };
    }

    if (config.staffPhones?.some(p => normalizePhone(p) === normalized)) {
      return { type: 'staff' };
    }
  }

  // 2. Check known contacts collection
  const contactsRef = collection(db, 'sites', siteId, WA_ROOT, WA_MAIN_DOC, WA_CONTACTS);
  const q = query(contactsRef, where('phone', '==', phone));
  const snap = await getDocs(q);

  if (!snap.empty) {
    const contactDoc = snap.docs[0];
    const data = contactDoc.data();
    return {
      type: data.type ?? 'customer',
      contactId: contactDoc.id,
      contactName: data.name,
    };
  }

  // 3. Unknown — treated as new customer
  return { type: 'unknown' };
}
