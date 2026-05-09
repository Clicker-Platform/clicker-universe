import { adminDb, Timestamp, FieldValue } from '@/lib/firebase-admin';

export type EventType =
  | 'registration.activated'
  | 'registration.credentials_sent'
  | 'registration.rejected'
  | 'email.failed'
  | 'promo.commit.failed';

const TTL_DAYS = 7;
const COLLECTION = 'registrationEvents';

export interface WriteEventInput {
  type: EventType;
  registrationId: string;
  actorEmail?: string;
  payload?: Record<string, unknown>;
}

export async function writeEvent(input: WriteEventInput): Promise<void> {
  const isError = input.type === 'email.failed' || input.type === 'promo.commit.failed';
  const expireAt = Timestamp.fromMillis(Date.now() + TTL_DAYS * 24 * 60 * 60 * 1000);

  try {
    await adminDb.collection(COLLECTION).add({
      type: input.type,
      level: isError ? 'error' : 'info',
      registrationId: input.registrationId,
      actorEmail: input.actorEmail ?? null,
      payload: input.payload ?? {},
      createdAt: FieldValue.serverTimestamp(),
      expireAt,
    });
  } catch (err) {
    console.error('[event-log] Failed to write event:', err);
  }
}
