import { adminDb, FieldValue } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';
import type { EmailLogDoc } from './types';

export function getLogCollection(siteId: string | null) {
  if (siteId === null) {
    return adminDb.collection('system').doc('email').collection('emailLog');
  }
  return adminDb.collection('sites').doc(siteId).collection('emailLog');
}

export function newLogDocRef(siteId: string | null) {
  return getLogCollection(siteId).doc();
}

type WriteInput = Omit<EmailLogDoc, 'createdAt' | 'sentAt'> & {
  sentAt: Date | null;
};

export async function writeEmailLog(
  ref: FirebaseFirestore.DocumentReference,
  doc: WriteInput
): Promise<void> {
  try {
    await ref.set({
      ...doc,
      createdAt: FieldValue.serverTimestamp(),
      sentAt: doc.sentAt ?? null,
    });
  } catch (error) {
    logger.warn('email.log.write.failed', { siteId: doc.siteId ?? undefined, error });
  }
}
