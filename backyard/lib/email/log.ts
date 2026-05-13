import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface EmailLogInput {
  to: string;
  templateAlias: string;
  fromAddress: string;
  status: 'sent' | 'failed' | 'dev_blocked';
  resendId: string | null;
  error: string | null;
  registrationId?: string;
}

export async function logEmail(input: EmailLogInput): Promise<void> {
  try {
    await addDoc(collection(db, 'email_logs'), {
      to: [input.to],
      cc: null,
      bcc: null,
      subject: input.templateAlias,
      fromName: process.env.EMAIL_SYSTEM_FROM_NAME ?? 'Clicker Platform',
      fromAddress: input.fromAddress,
      replyTo: null,
      siteId: 'platform',
      tags: input.registrationId
        ? [{ name: 'registrationId', value: input.registrationId }]
        : [],
      status: input.status === 'dev_blocked' ? 'sent' : input.status,
      resendId: input.resendId,
      error: input.error,
      errorCode: null,
      attemptCount: 1,
      createdAt: serverTimestamp(),
      sentAt: input.status === 'sent' ? serverTimestamp() : null,
    });
  } catch (err) {
    console.error('[email-log] Failed to write log:', err);
  }
}
