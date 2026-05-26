import type { Timestamp } from 'firebase-admin/firestore';

export type MagicLinkInput = {
  email: string;
  siteId: string;
  module: string;
  purpose: string;
  redirectUrl: string;   // path the buyer lands on after sign-in (validated by caller)
  verifyUrl: string;     // absolute URL placed in email body (caller builds w/ token placeholder)
  tenantName: string;
};

export type MagicLinkVerifyInput = {
  token: string;
  siteId: string;
  module: string;
};

export type MagicLinkVerifyResult = {
  customToken: string;
  redirectUrl: string;
  email: string;
};

export type MagicLinkTokenDoc = {
  email: string;
  emailHash: string;
  siteId: string;
  module: string;
  redirectUrl: string;
  expiresAt: Timestamp;
  used: boolean;
  usedAt: Timestamp | null;
  createdAt: Timestamp;
};

export type MagicLinkErrorCode =
  | 'invalid_token'
  | 'used'
  | 'expired'
  | 'mismatch'
  | 'user_create_failed'
  | 'unknown';

export class MagicLinkError extends Error {
  code: MagicLinkErrorCode;
  constructor(code: MagicLinkErrorCode, message?: string) {
    super(message ?? code);
    this.code = code;
    this.name = 'MagicLinkError';
  }
}
