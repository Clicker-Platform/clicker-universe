import 'server-only';
import { adminDb, FieldValue, Timestamp } from '@/lib/firebase-admin';
import {
  COLLECTION_RATE_LIMITS,
  RATE_LIMIT_EMAIL_BUCKET,
  RATE_LIMIT_MAX_PER_WINDOW,
  RATE_LIMIT_WINDOW_MS,
} from './constants';

type RateLimitDoc = {
  count: number;
  windowStart: Timestamp;
  updatedAt: Timestamp;
};

// Returns true if the request is within limit (allowed), false if rate-limited.
export async function checkAndIncrementEmailLimit(emailHash: string): Promise<boolean> {
  // Path must be even segments. Layout: rateLimits/{bucket}/entries/{hash}
  const ref = adminDb.doc(`${COLLECTION_RATE_LIMITS}/${RATE_LIMIT_EMAIL_BUCKET}/entries/${emailHash}`);
  const nowMs = Date.now();
  const nowTs = Timestamp.fromMillis(nowMs);

  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? (snap.data() as RateLimitDoc) : null;

    const windowExpired = !data
      || !data.windowStart
      || (nowMs - data.windowStart.toMillis()) >= RATE_LIMIT_WINDOW_MS;

    if (windowExpired) {
      tx.set(ref, { count: 1, windowStart: nowTs, updatedAt: nowTs });
      return true;
    }

    if (data.count >= RATE_LIMIT_MAX_PER_WINDOW) {
      return false;
    }

    tx.update(ref, { count: FieldValue.increment(1), updatedAt: nowTs });
    return true;
  });
}
