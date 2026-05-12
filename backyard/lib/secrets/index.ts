import { fetchSecret, checkSecretExists, writeSecret, removeSecret } from './client';
import { SecretKey, SecretStatus, SECRET_KEYS } from './types';

export type { SecretKey, SecretStatus };
export { SECRET_KEYS };

export async function getSecret(key: SecretKey): Promise<string> {
  return fetchSecret(key);
}

export async function secretExists(key: SecretKey): Promise<boolean> {
  return checkSecretExists(key);
}

export async function setSecret(key: SecretKey, value: string): Promise<void> {
  return writeSecret(key, value);
}

export async function deleteSecret(key: SecretKey): Promise<void> {
  return removeSecret(key);
}

const SECRET_ORDER: SecretKey[] = [
  'OPENROUTER_API_KEY',
  'RESEND_API_KEY',
  'UPSTASH_REDIS_REST_TOKEN',
  'WA_WEBHOOK_VERIFY_TOKEN',
  'META_APP_SECRET',
  'WA_ENCRYPTION_KEY',
];

export async function listSecrets(): Promise<SecretStatus[]> {
  const results = await Promise.all(
    SECRET_ORDER.map(async (key) => ({
      key,
      exists: await checkSecretExists(key),
    }))
  );
  return results;
}
