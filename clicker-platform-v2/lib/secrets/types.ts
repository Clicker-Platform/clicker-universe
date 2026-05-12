export const SECRET_KEYS = {
  OPENROUTER_API_KEY:       'OPENROUTER_API_KEY',
  RESEND_API_KEY:           'RESEND_API_KEY',
  WA_WEBHOOK_VERIFY_TOKEN:  'WA_WEBHOOK_VERIFY_TOKEN',
  META_APP_SECRET:          'META_APP_SECRET',
  WA_ENCRYPTION_KEY:        'WA_ENCRYPTION_KEY',
  UPSTASH_REDIS_REST_TOKEN: 'UPSTASH_REDIS_REST_TOKEN',
} as const;

export type SecretKey = keyof typeof SECRET_KEYS;

export interface SecretStatus {
  key: SecretKey;
  exists: boolean;
}
