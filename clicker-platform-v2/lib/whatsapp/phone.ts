/**
 * Strip everything except digits for comparison purposes.
 * Works regardless of whether numbers are stored as +628xxx or 628xxx.
 */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

/**
 * Format a raw phone string into E.164 format (+62xxxxxxxxxx).
 * Handles inputs like: 08123456789, 628123456789, +628123456789
 */
export function formatPhoneE164(raw: string): string {
  let digits = raw.replace(/[^\d+]/g, '');
  if (digits.startsWith('0')) digits = '62' + digits.slice(1);
  if (digits.startsWith('62') && !digits.startsWith('+')) digits = '+' + digits;
  if (!digits.startsWith('+')) digits = '+62' + digits;
  return digits;
}

export function isValidE164(phone: string): boolean {
  return /^\+\d{8,15}$/.test(phone);
}
