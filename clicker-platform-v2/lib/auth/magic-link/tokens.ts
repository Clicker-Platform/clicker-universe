import { randomBytes, createHash } from 'crypto';

// 24 bytes → 32 base64url chars. URL-safe, no padding.
export function generateToken(): string {
  return randomBytes(24).toString('base64url');
}

export function hashEmail(email: string): string {
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email);
}
