import type { Timestamp } from 'firebase-admin/firestore';

export type EmailTag = { name: string; value: string };

export type SendEmailInput = {
  to: string | string[];
  templateAlias: string;
  variables: Record<string, string>;
  siteId: string | null;
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
  tags?: EmailTag[];
};

export type SendEmailResult =
  | { ok: true; id: string; logId: string }
  | { ok: false; error: string; logId: string };

export type EmailContext = {
  fromName: string;
  fromAddress: string;
  replyTo: string | null;
  brand: {
    businessName: string;
    logoUrl: string | null;
    primaryColor: string | null;
    siteUrl: string;
  };
};

export type EmailLogStatus = 'sent' | 'failed';

export type EmailLogDoc = {
  to: string[];
  cc: string[] | null;
  bcc: string[] | null;
  subject: string;
  fromName: string;
  fromAddress: string;
  replyTo: string | null;
  siteId: string | null;
  tags: EmailTag[];
  status: EmailLogStatus;
  resendId: string | null;
  error: string | null;
  errorCode: string | null;
  attemptCount: number;
  createdAt: Timestamp;
  sentAt: Timestamp | null;
};
