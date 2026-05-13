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

export async function listSecrets(): Promise<SecretStatus[]> {
  const results = await Promise.all(
    Object.keys(SECRET_KEYS).map(async (key) => ({
      key: key as SecretKey,
      exists: await checkSecretExists(key as SecretKey),
    }))
  );
  return results;
}
