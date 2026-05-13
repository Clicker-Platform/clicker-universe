import { collection, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export type EventType =
  | 'registration.activated'
  | 'registration.credentials_sent'
  | 'registration.rejected'
  | 'email.failed'
  | 'promo.commit.failed';

const TTL_DAYS = 7;

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
    await addDoc(collection(db, 'registrationEvents'), {
      type: input.type,
      level: isError ? 'error' : 'info',
      registrationId: input.registrationId,
      actorEmail: input.actorEmail ?? null,
      payload: input.payload ?? {},
      createdAt: serverTimestamp(),
      expireAt,
    });
  } catch (err) {
    console.error('[event-log] Failed to write event:', err);
  }
}
