import { adminDb } from '@/lib/firebase-admin';

export type SenderParts = { localPart: string; domain: string };

const EMAIL_CONFIG_PATH = 'platform/settings/email/config';
const CONFIG_TTL_MS = 5 * 60 * 1000;

interface EmailPlatformConfig {
  templates: Record<string, string>;
  sender: { domain: string; localPart: string; fromName: string };
}

const DEFAULTS: EmailPlatformConfig = {
  templates: {
    passwordReset:     process.env.RESEND_TEMPLATE_PASSWORD_RESET     ?? 'password-reset',
    emailVerification: process.env.RESEND_TEMPLATE_EMAIL_VERIFY       ?? 'email-verification',
    formSubmission:    process.env.RESEND_TEMPLATE_FORM_SUBMISSION    ?? 'form-submission',
    systemAlert:       process.env.RESEND_TEMPLATE_SYSTEM_ALERT       ?? 'system-alert',
  },
  sender: {
    domain:    process.env.EMAIL_SENDER_DOMAIN     ?? 'clicker.id',
    localPart: process.env.EMAIL_SENDER_LOCAL_PART ?? 'noreply',
    fromName:  process.env.EMAIL_SYSTEM_FROM_NAME  ?? 'Clicker Platform',
  },
};

let configCache: { value: EmailPlatformConfig; expiresAt: number } | null = null;

async function getEmailPlatformConfig(): Promise<EmailPlatformConfig> {
  if (configCache && Date.now() < configCache.expiresAt) return configCache.value;

  try {
    const doc = await adminDb.doc(EMAIL_CONFIG_PATH).get();
    if (doc.exists) {
      const data = doc.data() as Partial<EmailPlatformConfig>;
      const value: EmailPlatformConfig = {
        templates: { ...DEFAULTS.templates, ...(data.templates ?? {}) },
        sender:    { ...DEFAULTS.sender,    ...(data.sender    ?? {}) },
      };
      configCache = { value, expiresAt: Date.now() + CONFIG_TTL_MS };
      return value;
    }
  } catch {
    // Fall through to defaults
  }

  return DEFAULTS;
}

export async function resolveDefaultSender(): Promise<SenderParts> {
  const config = await getEmailPlatformConfig();
  return { localPart: config.sender.localPart, domain: config.sender.domain };
}

export function getDevAllowlistSuffixes(): string[] {
  const raw = process.env.EMAIL_DEV_ALLOWLIST ?? '@clicker.id,@resend.dev';
  return raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
}

export async function getSystemDefaults() {
  const config = await getEmailPlatformConfig();
  return {
    fromName:    config.sender.fromName,
    platformUrl: process.env.EMAIL_PLATFORM_URL ?? 'https://clicker.id',
    logoUrl:     process.env.EMAIL_PLATFORM_LOGO_URL ?? null,
  };
}

export function formatFrom(fromName: string, parts: SenderParts): string {
  return `${fromName} <${parts.localPart}@${parts.domain}>`;
}

export async function getTemplateAliases(): Promise<Record<string, string>> {
  const config = await getEmailPlatformConfig();
  return config.templates;
}

export { getEmailPlatformConfig };
export type { EmailPlatformConfig };
