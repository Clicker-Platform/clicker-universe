import { adminDb } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';

export async function resolveSiteFromEmail(email: string): Promise<string | null> {
  try {
    const ownerSnap = await adminDb
      .collection('sites')
      .where('ownerEmail', '==', email)
      .limit(1)
      .get();
    if (!ownerSnap.empty) return ownerSnap.docs[0]!.id;

    const memberSnap = await adminDb
      .collectionGroup('members')
      .where('email', '==', email)
      .limit(1)
      .get();
    if (!memberSnap.empty) {
      const ref = memberSnap.docs[0]!.ref;
      const siteRef = ref.parent.parent;
      return siteRef ? siteRef.id : null;
    }
    return null;
  } catch (error) {
    logger.warn('auth.resolve.site.failed', { email, error });
    return null;
  }
}
