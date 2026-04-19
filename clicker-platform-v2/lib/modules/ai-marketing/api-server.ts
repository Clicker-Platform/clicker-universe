// Server-side Firestore helpers for AI Marketing module
// Uses firebase-admin — import only from API routes and Cloud Functions

import { adminDb } from '@/lib/firebase-admin';
import { MarketingSettings } from './types';
import { COLLECTION_SETTINGS, SETTINGS_DOC_ID } from './constants';

export async function getMarketingSettings(siteId: string): Promise<MarketingSettings | null> {
  const doc = await adminDb
    .doc(`sites/${siteId}/${COLLECTION_SETTINGS}/${SETTINGS_DOC_ID}`)
    .get();
  if (!doc.exists) return null;
  return doc.data() as MarketingSettings;
}
