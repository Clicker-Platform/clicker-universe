export type SenderParts = { localPart: string; domain: string };

export function resolveDefaultSender(): SenderParts {
  const domain = process.env.EMAIL_SENDER_DOMAIN ?? 'clicker.id';
  const localPart = process.env.EMAIL_SENDER_LOCAL_PART ?? 'noreply';
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

export function getTemplateAliases() {
  return {
    passwordReset: process.env.RESEND_TEMPLATE_PASSWORD_RESET ?? 'password-reset',
    emailVerification: process.env.RESEND_TEMPLATE_EMAIL_VERIFY ?? 'email-verification',
    formSubmission: process.env.RESEND_TEMPLATE_FORM_SUBMISSION ?? 'form-submission',
    systemAlert: process.env.RESEND_TEMPLATE_SYSTEM_ALERT ?? 'system-alert',
  };
}
