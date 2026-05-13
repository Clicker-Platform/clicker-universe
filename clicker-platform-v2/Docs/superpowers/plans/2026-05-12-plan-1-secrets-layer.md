# Platform Secrets Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `lib/secrets/` as the single source for all platform API keys via GCP Secret Manager, migrating all `process.env` secret reads.

**Architecture:** `lib/secrets/client.ts` wraps `@google-cloud/secret-manager` with per-key in-memory cache (TTL 10min). `lib/secrets/index.ts` exposes public API. All consuming files replace `process.env.X` with `await getSecret('X')`. `lib/email/config.ts` additionally migrates to Firestore for non-secret template config.

**Tech Stack:** `@google-cloud/secret-manager`, Firebase Admin SDK (Firestore), Next.js App Router, TypeScript

---

### Task 1: Install package + scaffold lib/secrets/

**Files:**
- Modify: `clicker-platform-v2/package.json`
- Create: `clicker-platform-v2/lib/secrets/types.ts`
- Create: `clicker-platform-v2/lib/secrets/client.ts`
- Create: `clicker-platform-v2/lib/secrets/index.ts`

- [ ] **Step 1: Install @google-cloud/secret-manager**

```bash
cd clicker-platform-v2
pnpm add @google-cloud/secret-manager
```

Expected: package added, pnpm-lock.yaml updated.

- [ ] **Step 2: Create lib/secrets/types.ts**

```typescript
export const SECRET_KEYS = {
  OPENROUTER_API_KEY:      'OPENROUTER_API_KEY',
  RESEND_API_KEY:          'RESEND_API_KEY',
  WA_WEBHOOK_VERIFY_TOKEN: 'WA_WEBHOOK_VERIFY_TOKEN',
  META_APP_SECRET:         'META_APP_SECRET',
  WA_ENCRYPTION_KEY:       'WA_ENCRYPTION_KEY',
  UPSTASH_REDIS_REST_TOKEN:'UPSTASH_REDIS_REST_TOKEN',
} as const;

export type SecretKey = keyof typeof SECRET_KEYS;

export interface SecretStatus {
  key: SecretKey;
  exists: boolean;
}
```

- [ ] **Step 3: Create lib/secrets/client.ts**

```typescript
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { SecretKey, SECRET_KEYS } from './types';

const PROJECT_ID = process.env.GCLOUD_PROJECT ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

const cache = new Map<SecretKey, { value: string; expiresAt: number }>();
const TTL_MS = 10 * 60 * 1000; // 10 minutes

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

  const client = getClient();
  const [version] = await client.accessSecretVersion({ name: secretName(key) });
  const value = version.payload?.data?.toString() ?? '';
  if (!value) throw new Error(`Secret ${key} is empty`);

  cache.set(key, { value, expiresAt: Date.now() + TTL_MS });
  return value;
}

export async function checkSecretExists(key: SecretKey): Promise<boolean> {
  try {
    const client = getClient();
    await client.getSecret({ name: `projects/${PROJECT_ID}/secrets/${SECRET_KEYS[key]}` });
    return true;
  } catch {
    return false;
  }
}

export async function writeSecret(key: SecretKey, value: string): Promise<void> {
  const client = getClient();
  const parent = `projects/${PROJECT_ID}`;
  const secretId = SECRET_KEYS[key];
  const secretPath = `${parent}/secrets/${secretId}`;

  // Create secret if not exists
  try {
    await client.getSecret({ name: secretPath });
  } catch {
    await client.createSecret({
      parent,
      secretId,
      secret: { replication: { automatic: {} } },
    });
  }

  // Add new version
  await client.addSecretVersion({
    parent: secretPath,
    payload: { data: Buffer.from(value, 'utf8') },
  });

  // Invalidate cache
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
```

- [ ] **Step 4: Create lib/secrets/index.ts**

```typescript
import { fetchSecret, checkSecretExists, writeSecret, removeSecret } from './client';
import { SecretKey, SecretStatus, SECRET_KEYS } from './types';

export { SecretKey, SECRET_KEYS };

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
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd clicker-platform-v2
pnpm tsc --noEmit
```

Expected: no errors in lib/secrets/

- [ ] **Step 6: Commit**

```bash
git add lib/secrets/ package.json pnpm-lock.yaml
git commit -m "feat(secrets): add lib/secrets layer with GCP Secret Manager"
```

---

### Task 2: Migrate lib/email/sender.ts

**Files:**
- Modify: `clicker-platform-v2/lib/email/sender.ts`

- [ ] **Step 1: Replace RESEND_API_KEY env var**

In `lib/email/sender.ts`, find:
```typescript
const apiKey = process.env.RESEND_API_KEY;
if (!apiKey) throw new Error('RESEND_API_KEY is not set');
```

Replace with:
```typescript
const apiKey = await getSecret('RESEND_API_KEY');
```

Add import at top of file:
```typescript
import { getSecret } from '@/lib/secrets';
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add lib/email/sender.ts
git commit -m "feat(secrets): migrate RESEND_API_KEY to Secret Manager"
```

---

### Task 3: Migrate lib/cache/redis.ts

**Files:**
- Modify: `clicker-platform-v2/lib/cache/redis.ts`

- [ ] **Step 1: Convert module to lazy async init**

Replace the current top-level sync init with async lazy init. Full new file content:

```typescript
import { Redis } from '@upstash/redis';
import { logger } from '@/lib/logger-edge';
import { getSecret } from '@/lib/secrets';

const URL = process.env.UPSTASH_REDIS_REST_URL;
let redisInstance: Redis | null = null;
let initAttempted = false;

async function getRedis(): Promise<Redis | null> {
  if (initAttempted) return redisInstance;
  initAttempted = true;
  if (!URL) return null;
  try {
    const token = await getSecret('UPSTASH_REDIS_REST_TOKEN');
    redisInstance = new Redis({ url: URL, token });
  } catch {
    redisInstance = null;
  }
  return redisInstance;
}

export async function cached<T>(
  key: string,
  ttl: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const redis = await getRedis();
  if (!redis) return fetcher();

  try {
    const hit = await redis.get<T>(key);
    if (hit !== null) return hit;
  } catch (err) {
    logger.warn('cache.get.failed', { siteId: 'platform', error: err });
  }

  const fresh = await fetcher();

  try {
    await redis.set(key, fresh, { ex: ttl });
  } catch (err) {
    logger.warn('cache.set.failed', { siteId: 'platform', error: err });
  }

  return fresh;
}

export async function invalidate(pattern: string): Promise<number> {
  const redis = await getRedis();
  if (!redis) return 0;
  let deleted = 0;
  try {
    let cursor = 0;
    do {
      const [next, keys] = await redis.scan(cursor, { match: pattern, count: 100 });
      cursor = Number(next);
      if (keys.length > 0) {
        await redis.del(...(keys as [string, ...string[]]));
        deleted += keys.length;
      }
    } while (cursor !== 0);
  } catch (err) {
    logger.warn('cache.invalidate.failed', { siteId: 'platform', error: err });
  }
  return deleted;
}

export function siteKey(siteId: string, suffix: string): string {
  return `site:${siteId}:${suffix}`;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add lib/cache/redis.ts
git commit -m "feat(secrets): migrate UPSTASH_REDIS_REST_TOKEN to Secret Manager"
```

---

### Task 4: Migrate lib/whatsapp/encryption.ts

**Files:**
- Modify: `clicker-platform-v2/lib/whatsapp/encryption.ts`

- [ ] **Step 1: Make getKey async, use getSecret**

Replace full file content:

```typescript
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { getSecret } from '@/lib/secrets';

async function getKey(): Promise<Buffer> {
  const secret = await getSecret('WA_ENCRYPTION_KEY');
  return createHash('sha256').update(secret).digest();
}

export async function encryptToken(token: string): Promise<string> {
  const key = await getKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-cbc', key, iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

export async function decryptToken(encrypted: string): Promise<string> {
  const key = await getKey();
  const [ivHex, dataHex] = encrypted.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = createDecipheriv('aes-256-cbc', key, iv);
  return Buffer.concat([
    decipher.update(Buffer.from(dataHex, 'hex')),
    decipher.final(),
  ]).toString('utf8');
}
```

- [ ] **Step 2: Find all callers of encryptToken/decryptToken and add await**

```bash
grep -rn "encryptToken\|decryptToken" --include="*.ts" --include="*.tsx" .
```

Update each caller to `await encryptToken(...)` / `await decryptToken(...)`.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add lib/whatsapp/encryption.ts
git commit -m "feat(secrets): migrate WA_ENCRYPTION_KEY to Secret Manager"
```

---

### Task 5: Migrate app/api/webhook/whatsapp/route.ts

**Files:**
- Modify: `clicker-platform-v2/app/api/webhook/whatsapp/route.ts`

- [ ] **Step 1: Replace env var reads with getSecret**

Add import at top:
```typescript
import { getSecret } from '@/lib/secrets';
```

In the GET handler, replace:
```typescript
const globalToken = process.env.WA_WEBHOOK_VERIFY_TOKEN;
```
With:
```typescript
let globalToken: string | null = null;
try { globalToken = await getSecret('WA_WEBHOOK_VERIFY_TOKEN'); } catch { globalToken = null; }
```

In the POST handler, replace:
```typescript
const appSecret = process.env.META_APP_SECRET ?? '';
```
With:
```typescript
let appSecret = '';
try { appSecret = await getSecret('META_APP_SECRET'); } catch { appSecret = ''; }
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add app/api/webhook/whatsapp/route.ts
git commit -m "feat(secrets): migrate WA_WEBHOOK_VERIFY_TOKEN and META_APP_SECRET to Secret Manager"
```

---

### Task 6: Migrate lib/email/config.ts to Firestore

**Files:**
- Modify: `clicker-platform-v2/lib/email/config.ts`

- [ ] **Step 1: Replace full lib/email/config.ts content**

```typescript
import { getFirestore } from 'firebase-admin/firestore';

const EMAIL_CONFIG_PATH = 'platform/email/config';
const CONFIG_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface EmailPlatformConfig {
  templates: {
    passwordReset: string;
    emailVerification: string;
    formSubmission: string;
    systemAlert: string;
    regConfirmation: string;
    regAdminNotif: string;
  };
  sender: {
    domain: string;
    localPart: string;
    fromName: string;
  };
}

const DEFAULTS: EmailPlatformConfig = {
  templates: {
    passwordReset:    'password-reset',
    emailVerification:'email-verification',
    formSubmission:   'form-submission',
    systemAlert:      'system-alert',
    regConfirmation:  'registration-confirmation',
    regAdminNotif:    'registration-admin-notif',
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
    fromName: config.sender.fromName,
    platformUrl: process.env.EMAIL_PLATFORM_URL ?? 'https://clicker.id',
    logoUrl: process.env.EMAIL_PLATFORM_LOGO_URL ?? null,
  };
}

export function formatFrom(fromName: string, parts: SenderParts): string {
  return `${fromName} <${parts.localPart}@${parts.domain}>`;
}

export async function getTemplateAliases(): Promise<EmailPlatformConfig['templates']> {
  const config = await getEmailPlatformConfig();
  return config.templates;
}

export { getEmailPlatformConfig };
export type { EmailPlatformConfig };
```

- [ ] **Step 2: Find all callers of resolveDefaultSender, getSystemDefaults, getTemplateAliases and add await**

```bash
grep -rn "resolveDefaultSender\|getSystemDefaults\|getTemplateAliases" --include="*.ts" --include="*.tsx" .
```

Update each caller — these functions are now async, add `await`.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add lib/email/config.ts
git commit -m "feat(secrets): migrate email config to Firestore, remove env vars"
```

---

### Task 7: Remove GEMINI_API_KEY + verify all env vars migrated

**Files:**
- Modify: `clicker-platform-v2/.env.local` (or `.env.development.local`)

- [ ] **Step 1: Verify no remaining secret env var reads**

```bash
grep -rn "process.env.RESEND_API_KEY\|process.env.WA_WEBHOOK\|process.env.META_APP_SECRET\|process.env.WA_ENCRYPTION\|process.env.UPSTASH_REDIS_REST_TOKEN\|process.env.GEMINI_API_KEY\|process.env.RESEND_TEMPLATE" --include="*.ts" --include="*.tsx" .
```

Expected: 0 results.

- [ ] **Step 2: Remove migrated env vars from .env files**

Remove these lines from all `.env*` files:
```
RESEND_API_KEY=
WA_WEBHOOK_VERIFY_TOKEN=
META_APP_SECRET=
WA_ENCRYPTION_KEY=
UPSTASH_REDIS_REST_TOKEN=
GEMINI_API_KEY=
RESEND_TEMPLATE_PASSWORD_RESET=
RESEND_TEMPLATE_EMAIL_VERIFY=
RESEND_TEMPLATE_FORM_SUBMISSION=
RESEND_TEMPLATE_SYSTEM_ALERT=
RESEND_TEMPLATE_REG_CONFIRMATION=
RESEND_TEMPLATE_REG_ADMIN_NOTIF=
EMAIL_SENDER_DOMAIN=
EMAIL_SENDER_LOCAL_PART=
EMAIL_SYSTEM_FROM_NAME=
```

- [ ] **Step 3: Final TypeScript compile check**

```bash
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(secrets): remove migrated env vars, complete Secret Manager migration"
```

---

### GCP One-Time Setup (Manual — Before Running)

Run these commands once before executing this plan:

```bash
# Enable Secret Manager API
gcloud services enable secretmanager.googleapis.com --project=YOUR_PROJECT_ID

# Grant roles to Firebase service account
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:YOUR_SERVICE_ACCOUNT@YOUR_PROJECT.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:YOUR_SERVICE_ACCOUNT@YOUR_PROJECT.iam.gserviceaccount.com" \
  --role="roles/secretmanager.admin"

# Create initial secrets (replace VALUES with actual keys)
gcloud secrets create RESEND_API_KEY --replication-policy="automatic" --project=YOUR_PROJECT_ID
echo -n "YOUR_RESEND_KEY" | gcloud secrets versions add RESEND_API_KEY --data-file=- --project=YOUR_PROJECT_ID

# Repeat for each key: WA_WEBHOOK_VERIFY_TOKEN, META_APP_SECRET, WA_ENCRYPTION_KEY, UPSTASH_REDIS_REST_TOKEN
```
