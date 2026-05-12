import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import type { SecretKey } from './types';
import { SECRET_KEYS } from './types';

const PROJECT_ID = process.env.GCLOUD_PROJECT ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

const cache = new Map<SecretKey, { value: string; expiresAt: number }>();
const TTL_MS = 10 * 60 * 1000;

let smClient: SecretManagerServiceClient | null = null;

function getClient(): SecretManagerServiceClient {
  if (!smClient) smClient = new SecretManagerServiceClient();
  return smClient;
}

function secretName(key: SecretKey): string {
  return `projects/${PROJECT_ID}/secrets/${SECRET_KEYS[key]}/versions/latest`;
}

export async function fetchSecret(key: SecretKey): Promise<string> {
  const cached = cache.get(key);
  if (cached && Date.now() < cached.expiresAt) return cached.value;

  // Dev fallback: read from env var if GCP not available
  const envFallback = process.env[SECRET_KEYS[key]];

  try {
    const client = getClient();
    const [version] = await client.accessSecretVersion({ name: secretName(key) });
    const value = version.payload?.data?.toString() ?? '';
    if (!value) throw new Error(`Secret ${key} is empty`);
    cache.set(key, { value, expiresAt: Date.now() + TTL_MS });
    return value;
  } catch (err) {
    if (envFallback) {
      cache.set(key, { value: envFallback, expiresAt: Date.now() + TTL_MS });
      return envFallback;
    }
    throw err;
  }
}

export async function checkSecretExists(key: SecretKey): Promise<boolean> {
  try {
    const client = getClient();
    await client.getSecret({ name: `projects/${PROJECT_ID}/secrets/${SECRET_KEYS[key]}` });
    return true;
  } catch {
    // Dev fallback: env var counts as existing
    return !!process.env[SECRET_KEYS[key]];
  }
}

export async function writeSecret(key: SecretKey, value: string): Promise<void> {
  const client = getClient();
  const parent = `projects/${PROJECT_ID}`;
  const secretId = SECRET_KEYS[key];
  const secretPath = `${parent}/secrets/${secretId}`;

  try {
    await client.getSecret({ name: secretPath });
  } catch {
    await client.createSecret({
      parent,
      secretId,
      secret: { replication: { automatic: {} } },
    });
  }

  await client.addSecretVersion({
    parent: secretPath,
    payload: { data: Buffer.from(value, 'utf8') },
  });

  cache.delete(key);
}

export async function removeSecret(key: SecretKey): Promise<void> {
  const client = getClient();
  await client.deleteSecret({
    name: `projects/${PROJECT_ID}/secrets/${SECRET_KEYS[key]}`,
  });
  cache.delete(key);
}

export function invalidateCache(key: SecretKey): void {
  cache.delete(key);
}
