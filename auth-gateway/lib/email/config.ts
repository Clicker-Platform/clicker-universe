export type SenderParts = { localPart: string; domain: string };

export function resolveDefaultSender(): SenderParts {
  const isDev = process.env.NODE_ENV !== 'production';
  const domain = process.env.EMAIL_SENDER_DOMAIN ?? (isDev ? 'resend.dev' : 'clicker.id');
  const fallbackLocal = domain === 'resend.dev' ? 'onboarding' : 'noreply';
  const localPart = process.env.EMAIL_SENDER_LOCAL_PART ?? fallbackLocal;
  return { localPart, domain };
}

export function getDevAllowlistSuffixes(): string[] {
  const raw = process.env.EMAIL_DEV_ALLOWLIST ?? '@clicker.id,@resend.dev';
  return raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
}

export function getSystemDefaults() {
  return {
    fromName: process.env.EMAIL_SYSTEM_FROM_NAME ?? 'Clicker Platform',
    platformUrl: process.env.EMAIL_PLATFORM_URL ?? 'https://clicker.id',
    logoUrl: process.env.EMAIL_PLATFORM_LOGO_URL ?? null,
  };
}

export function formatFrom(fromName: string, parts: SenderParts): string {
  return `${fromName} <${parts.localPart}@${parts.domain}>`;
}
