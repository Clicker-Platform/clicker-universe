import 'server-only';
import { adminAuth, adminDb, Timestamp } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';
import { COLLECTION_SIGN_IN_TOKENS } from './constants';
import { MagicLinkError } from './types';
import type { MagicLinkTokenDoc, MagicLinkVerifyInput, MagicLinkVerifyResult } from './types';

export async function verifyMagicLink(input: MagicLinkVerifyInput): Promise<MagicLinkVerifyResult> {
  const ref = adminDb.doc(`${COLLECTION_SIGN_IN_TOKENS}/${input.token}`);

  const tokenData = await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new MagicLinkError('invalid_token');

    const data = snap.data() as MagicLinkTokenDoc;
    if (data.used === true) throw new MagicLinkError('used');

    const nowMs = Date.now();
    if (!data.expiresAt || data.expiresAt.toMillis() < nowMs) {
      throw new MagicLinkError('expired');
    }

    if (data.siteId !== input.siteId || data.module !== input.module) {
      throw new MagicLinkError('mismatch');
    }

    tx.update(ref, { used: true, usedAt: Timestamp.fromMillis(nowMs) });
    return data;
  });

  let uid: string;
  try {
    uid = await getOrCreateFirebaseUser(tokenData.email);
  } catch (e) {
    logger.error('magic_link.verify.user_create_failed', {
      siteId: input.siteId,
      module: input.module,
      error: e,
    });
    throw new MagicLinkError('user_create_failed');
  }

  let customToken: string;
  try {
    customToken = await adminAuth.createCustomToken(uid);
  } catch (e) {
    logger.error('magic_link.verify.custom_token_failed', {
      siteId: input.siteId,
      module: input.module,
      uid,
      error: e,
    });
    throw new MagicLinkError('unknown');
  }

  return {
    customToken,
    redirectUrl: tokenData.redirectUrl,
    email: tokenData.email,
  };
}

export async function getOrCreateFirebaseUser(email: string): Promise<string> {
  try {
    const user = await adminAuth.getUserByEmail(email);
    return user.uid;
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code;
    if (code === 'auth/user-not-found') {
      const created = await adminAuth.createUser({ email, emailVerified: true });
      return created.uid;
    }
    throw e;
  }
}

