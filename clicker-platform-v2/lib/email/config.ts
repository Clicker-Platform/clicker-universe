import { getFirestore } from 'firebase-admin/firestore';

const EMAIL_CONFIG_PATH = 'platform/settings/email/config';
const CONFIG_TTL_MS = 5 * 60 * 1000;

interface EmailPlatformConfig {
  templates: Record<string, string>;
  sender: {
    domain: string;
    localPart: string;
    fromName: string;
  };
}

const DEFAULTS: EmailPlatformConfig = {
  templates: {
    digitalGoodsNewOrderTenant: 'digital-goods-new-order-tenant',
    digitalGoodsOrderPaidBuyer: 'digital-goods-order-paid-buyer',
  },
  sender: {
    domain:    'clicker.id',
    localPart: 'noreply',
    fromName:  'Clicker Platform',
  },
};

let configCache: { value: EmailPlatformConfig; expiresAt: number } | null = null;

async function getEmailPlatformConfig(): Promise<EmailPlatformConfig> {
  if (configCache && Date.now() < configCache.expiresAt) return configCache.value;

  try {
    const db = getFirestore();
    const doc = await db.doc(EMAIL_CONFIG_PATH).get();
    if (doc.exists) {
      const data = doc.data() as EmailPlatformConfig;
      const value = {
        templates: { ...DEFAULTS.templates, ...data.templates },
        sender: { ...DEFAULTS.sender, ...data.sender },
      };
      configCache = { value, expiresAt: Date.now() + CONFIG_TTL_MS };
      return value;
    }
  } catch {
    // Fall through to defaults
  }

  return DEFAULTS;
}

export type SenderParts = { localPart: string; domain: string };

export async function resolveDefaultSender(): Promise<SenderParts> {
  const config = await getEmailPlatformConfig();
  return { localPart: config.sender.localPart, domain: config.sender.domain };
}

export function getDevAllowlistSuffixes(): string[] {
  const raw = process.env.EMAIL_DEV_ALLOWLIST ?? '@clicker.id,@resend.dev';
  return raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
}

export async function getSystemDefaults(): Promise<{ fromName: string; platformUrl: string; logoUrl: string | null }> {
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
