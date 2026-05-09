function getAllowlist(): string[] {
  const raw = process.env.EMAIL_DEV_ALLOWLIST ?? '@clicker.id,@resend.dev,@gmail.com';
  return raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
}

export function isAllowedInDev(email: string): boolean {
  if (process.env.NODE_ENV === 'production') return true;
  const allowlist = getAllowlist();
  const lower = email.toLowerCase();
  return allowlist.some((suffix) => lower.endsWith(suffix));
}
