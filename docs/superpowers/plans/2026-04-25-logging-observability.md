# Logging & Observability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace semua `console.*` di platform dengan structured logger terpusat yang menulis JSON ke GCP Cloud Logging (semua) dan Firestore `platform_logs` (hanya error kritikal, 4-layer filtered), plus Backyard `/monitoring` live feed untuk superadmin.

**Architecture:** Satu `lib/logger.ts` dengan dua behavior: di server (API routes, middleware, lib core) menulis ke stdout sebagai JSON terstruktur + Firestore via `firebase-admin`; di client (React components, module api.ts) hanya menulis ke `console.*` dengan format JSON standar — tidak ada network call dari browser. Firestore write dilindungi 4-layer filter: whitelist 12 event kritikal, dedup 5 menit per event per siteId, quota guard 500 writes/hari, TTL 7 hari.

**Tech Stack:** TypeScript, Next.js 14 App Router, Firebase Admin SDK, Firestore, Tailwind CSS, Lucide React

**Worktree:** `dev/.worktrees/dev-logging` (branch: `dev-logging`)

---

## File Map

### New Files
| File | Responsibility |
|------|----------------|
| `clicker-platform-v2/lib/logger.ts` | Structured logger — server + client behavior, 4-layer Firestore filter |
| `clicker-platform-v2/lib/logger.test.ts` | Unit tests untuk logger logic |
| `backyard/lib/useMonitoringLogs.ts` | Firestore `onSnapshot` hook untuk Backyard monitoring |

### Modified Files
| File | Perubahan |
|------|-----------|
| `clicker-platform-v2/lib/firebase.ts` | Hapus `console.log` baris 34 (expose config) |
| `clicker-platform-v2/lib/firebase-admin.ts` | Replace `console.log/error` → `logger` |
| `clicker-platform-v2/middleware.ts` | Replace `console.error` → `logger.error` |
| `clicker-platform-v2/lib/admin-auth.ts` | Replace `console.*` → logger, hapus debug log |
| `clicker-platform-v2/lib/fetchData.ts` | Replace `console.*` → logger, hapus debug log |
| `clicker-platform-v2/lib/cache/redis.ts` | Replace `console.*` → logger |
| `clicker-platform-v2/app/api/upload/image/route.ts` | Replace `console.*` → logger, hapus step logs |
| `clicker-platform-v2/app/api/upload/avatar/route.ts` | Replace `console.*` → logger, hapus step logs |
| `clicker-platform-v2/app/api/analytics/track/route.ts` | Replace `console.*` → logger |
| `clicker-platform-v2/app/api/forms/submit/route.ts` | Replace `console.*` → logger |
| `clicker-platform-v2/app/api/forms/create/route.ts` | Replace `console.*` → logger |
| `clicker-platform-v2/app/api/forms/update/route.ts` | Replace `console.*` → logger |
| `clicker-platform-v2/app/api/forms/delete/route.ts` | Replace `console.*` → logger |
| `clicker-platform-v2/app/api/webhook/whatsapp/route.ts` | Replace `console.*` → logger |
| `clicker-platform-v2/app/api/ai-sales-agent/chat/route.ts` | Replace `console.*` → logger |
| `clicker-platform-v2/app/api/admin/team/add/route.ts` | Replace `console.*` → logger, hapus step logs |
| `clicker-platform-v2/app/api/admin/team/remove/route.ts` | Replace `console.*` → logger |
| `clicker-platform-v2/app/api/admin/knowledge/sync/route.ts` | Replace `console.*` → logger |
| `clicker-platform-v2/app/api/admin/whatsapp/send/route.ts` | Replace `console.*` → logger |
| `clicker-platform-v2/app/api/auth/check-access/route.ts` | Replace `console.*` → logger, hapus step logs |
| `clicker-platform-v2/app/admin/auth/callback/page.tsx` | Hapus 8 verbose auth step logs |
| `clicker-platform-v2/lib/modules/byod_pos/api.ts` | Replace `console.*` → logger |
| `clicker-platform-v2/lib/modules/reservation/api.ts` | Replace `console.*` → logger, hapus verbose loyalty logs |
| `clicker-platform-v2/lib/modules/membership/api.ts` | Replace `console.*` → logger |
| `clicker-platform-v2/lib/modules/service-records/api.ts` | Replace `console.*` → logger, hapus verbose step logs |
| `clicker-platform-v2/lib/modules/sales-pipeline/api.ts` | Replace `console.*` → logger, hapus step logs |
| `clicker-platform-v2/lib/modules/sales-pipeline/server-integration.ts` | Replace `console.*` → logger |
| `clicker-platform-v2/lib/modules/inventory/admin/InventoryAdminPage.tsx` | Replace `console.*` → logger |
| `clicker-platform-v2/lib/modules/membership/components/dashboard/MemberDashboard.tsx` | Hapus DEBUG log |
| `clicker-platform-v2/lib/modules/byod_pos/components/POSWidget.tsx` | Hapus Order Payload log |
| `clicker-platform-v2/app/[tenant]/page.tsx` | Hapus debug logs baris 25, 30 |
| `clicker-platform-v2/app/[tenant]/[...slug]/page.tsx` | Hapus debug log baris 72 |
| `clicker-platform-v2/firestore.rules` | Tambah rules `platform_logs` + `platform_meta` |
| `backyard/app/monitoring/page.tsx` | Replace placeholder → live error feed |
| `backyard/components/Sidebar.tsx` | Tambah unread badge di Monitoring nav item |

---

## Task 1: Hapus Debug Logs Berbahaya (Firebase Config Expose)

**Files:**
- Modify: `clicker-platform-v2/lib/firebase.ts:34`

- [ ] **Step 1: Buka file dan identifikasi baris**

```bash
grep -n "console.log" clicker-platform-v2/lib/firebase.ts
```

Expected output: baris 34 berisi `console.log('[Firebase] Initialized with config:', {...})`

- [ ] **Step 2: Hapus console.log yang expose Firebase config**

Di `clicker-platform-v2/lib/firebase.ts`, hapus baris ini sepenuhnya:
```ts
// HAPUS baris ini:
console.log('[Firebase] Initialized with config:', {
    projectId: firebaseConfig.projectId,
    authDomain: firebaseConfig.authDomain
});
```

- [ ] **Step 3: Verify tidak ada console.log tersisa di firebase.ts**

```bash
grep -n "console\." clicker-platform-v2/lib/firebase.ts
```

Expected output: tidak ada output (kosong).

- [ ] **Step 4: Commit**

```bash
git add clicker-platform-v2/lib/firebase.ts
git commit -m "security: remove Firebase config from console.log output"
```

---

## Task 2: Buat `lib/logger.ts`

**Files:**
- Create: `clicker-platform-v2/lib/logger.ts`
- Create: `clicker-platform-v2/lib/logger.test.ts`

- [ ] **Step 1: Tulis failing test untuk logger**

Buat file `clicker-platform-v2/lib/logger.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock firebase-admin SEBELUM import logger
vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        set: vi.fn().mockResolvedValue(undefined),
        get: vi.fn().mockResolvedValue({ exists: false, data: () => undefined }),
      })),
    })),
  },
  Timestamp: {
    fromDate: vi.fn((d: Date) => ({ toDate: () => d, _seconds: Math.floor(d.getTime() / 1000) })),
  },
  FieldValue: {
    increment: vi.fn((n: number) => ({ _increment: n })),
  },
}));

// Mock firebase-admin doc reference
vi.mock('firebase-admin/firestore', () => ({}));

describe('logger', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('logger.error', () => {
    it('calls console.error with JSON payload containing event and level', async () => {
      const { logger } = await import('@/lib/logger');
      logger.error('test.event.failed', { siteId: 'test-site', error: 'something broke' });
      expect(consoleErrorSpy).toHaveBeenCalledOnce();
      const call = consoleErrorSpy.mock.calls[0][0];
      const payload = JSON.parse(call);
      expect(payload.level).toBe('error');
      expect(payload.event).toBe('test.event.failed');
      expect(payload.siteId).toBe('test-site');
      expect(payload.meta.error).toBe('something broke');
      expect(payload.ts).toBeDefined();
    });
  });

  describe('logger.warn', () => {
    it('calls console.warn with JSON payload containing event and level', async () => {
      const { logger } = await import('@/lib/logger');
      logger.warn('test.event.skipped', { siteId: 'other-site' });
      expect(consoleWarnSpy).toHaveBeenCalledOnce();
      const call = consoleWarnSpy.mock.calls[0][0];
      const payload = JSON.parse(call);
      expect(payload.level).toBe('warn');
      expect(payload.event).toBe('test.event.skipped');
    });
  });

  describe('isFirestoreCritical', () => {
    it('returns true for whitelisted events', async () => {
      const { isFirestoreCritical } = await import('@/lib/logger');
      expect(isFirestoreCritical('upload.image.failed')).toBe(true);
      expect(isFirestoreCritical('wa.send.failed')).toBe(true);
      expect(isFirestoreCritical('pos.checkout.failed')).toBe(true);
    });

    it('returns false for non-whitelisted events', async () => {
      const { isFirestoreCritical } = await import('@/lib/logger');
      expect(isFirestoreCritical('some.random.event')).toBe(false);
      expect(isFirestoreCritical('analytics.invalid.siteId')).toBe(false);
    });
  });

  describe('buildDedupeKey', () => {
    it('produces deterministic key per siteId + event + 5-minute window', async () => {
      const { buildDedupeKey } = await import('@/lib/logger');
      const key1 = buildDedupeKey('quattro', 'upload.image.failed');
      const key2 = buildDedupeKey('quattro', 'upload.image.failed');
      expect(key1).toBe(key2);
      expect(key1).toMatch(/^quattro_upload\.image\.failed_\d+$/);
    });

    it('differs for different siteId', async () => {
      const { buildDedupeKey } = await import('@/lib/logger');
      const k1 = buildDedupeKey('siteA', 'upload.image.failed');
      const k2 = buildDedupeKey('siteB', 'upload.image.failed');
      expect(k1).not.toBe(k2);
    });
  });
});
```

- [ ] **Step 2: Jalankan test untuk verify FAIL**

```bash
cd clicker-platform-v2 && pnpm vitest run lib/logger.test.ts 2>&1 | tail -20
```

Expected: FAIL dengan `Cannot find module '@/lib/logger'`

- [ ] **Step 3: Buat `lib/logger.ts`**

Buat file `clicker-platform-v2/lib/logger.ts`:

```ts
const FIRESTORE_CRITICAL_EVENTS = new Set([
  'middleware.env.missing',
  'firebase.admin.init.failed',
  'auth.callback.failed',
  'upload.image.failed',
  'upload.avatar.failed',
  'wa.send.failed',
  'wa.webhook.site.not.found',
  'ai.chat.failed',
  'form.submit.failed',
  'pos.checkout.failed',
  'service.record.create.failed',
  'firestore.write.failed',
]);

export function isFirestoreCritical(event: string): boolean {
  return FIRESTORE_CRITICAL_EVENTS.has(event);
}

export function buildDedupeKey(siteId: string, event: string): string {
  const window = Math.floor(Date.now() / 300_000);
  return `${siteId}_${event}_${window}`;
}

interface LogContext {
  siteId?: string;
  error?: string | unknown;
  [key: string]: unknown;
}

interface LogPayload {
  level: 'error' | 'warn' | 'info';
  event: string;
  service: string;
  siteId: string;
  ts: string;
  meta: Record<string, unknown>;
}

function buildPayload(level: LogPayload['level'], event: string, ctx: LogContext): LogPayload {
  const { siteId = 'platform', error, ...rest } = ctx;
  const meta: Record<string, unknown> = { ...rest };
  if (error !== undefined) {
    meta.error = error instanceof Error ? error.message : String(error);
  }
  return {
    level,
    event,
    service: 'clicker-platform',
    siteId,
    ts: new Date().toISOString(),
    meta,
  };
}

async function writeToFirestore(payload: LogPayload): Promise<void> {
  // Only runs server-side (firebase-admin only works in Node.js)
  if (typeof window !== 'undefined') return;

  try {
    const { adminDb, Timestamp, FieldValue } = await import('@/lib/firebase-admin');

    // Quota guard
    const metaRef = adminDb.collection('platform_meta').doc('log_quota');
    const metaSnap = await metaRef.get();
    const today = new Date().toISOString().slice(0, 10);
    const meta = metaSnap.data() as { writesToday: number; resetDate: string } | undefined;

    let writesToday = 0;
    if (meta?.resetDate === today) {
      writesToday = meta.writesToday ?? 0;
    }

    if (writesToday >= 500) return;

    const dedupeKey = buildDedupeKey(payload.siteId, payload.event);
    const ttl = Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
    const ts = Timestamp.fromDate(new Date());

    const logRef = adminDb.collection('platform_logs').doc(dedupeKey);
    await logRef.set(
      {
        level: payload.level,
        event: payload.event,
        service: payload.service,
        siteId: payload.siteId,
        meta: payload.meta,
        ts,
        ttl,
        count: FieldValue.increment(1),
      },
      { merge: true }
    );

    // Increment quota counter
    await metaRef.set(
      { writesToday: FieldValue.increment(1), resetDate: today },
      { merge: true }
    );
  } catch {
    // Firestore write errors must NOT re-throw — original error already logged to GCP
  }
}

function log(level: LogPayload['level'], event: string, ctx: LogContext = {}): void {
  const payload = buildPayload(level, event, ctx);
  const json = JSON.stringify(payload);

  if (level === 'error') console.error(json);
  else if (level === 'warn') console.warn(json);
  else console.log(json);

  // Server-side only: write kritikal events ke Firestore
  if (level === 'error' && isFirestoreCritical(event)) {
    void writeToFirestore(payload);
  }
}

export const logger = {
  error: (event: string, ctx?: LogContext) => log('error', event, ctx),
  warn: (event: string, ctx?: LogContext) => log('warn', event, ctx),
  info: (event: string, ctx?: LogContext) => log('info', event, ctx),
};
```

- [ ] **Step 4: Jalankan test untuk verify PASS**

```bash
cd clicker-platform-v2 && pnpm vitest run lib/logger.test.ts 2>&1 | tail -15
```

Expected: `Tests 5 passed`

- [ ] **Step 5: Commit**

```bash
git add clicker-platform-v2/lib/logger.ts clicker-platform-v2/lib/logger.test.ts
git commit -m "feat(logger): structured JSON logger with 4-layer Firestore filter"
```

---

## Task 3: Firestore Rules + Indexes untuk `platform_logs`

**Files:**
- Modify: `clicker-platform-v2/firestore.rules`
- Modify: `clicker-platform-v2/firestore.indexes.json`

- [ ] **Step 1: Tambah rules `platform_logs` dan `platform_meta` ke firestore.rules**

Cari baris `// Default Deny` di `clicker-platform-v2/firestore.rules` dan tambahkan rules ini SEBELUMNYA:

```
    // === PLATFORM MONITORING ===

    // platform_logs — write hanya dari server (admin SDK bypass rules)
    // read hanya superadmin
    match /platform_logs/{logId} {
      allow read: if isGlobalAdmin();
      allow write: if false; // server-only via Admin SDK
    }

    // platform_meta — quota guard counter
    match /platform_meta/{docId} {
      allow read: if isGlobalAdmin();
      allow write: if false; // server-only via Admin SDK
    }
```

- [ ] **Step 2: Tambah index untuk `platform_logs` ke firestore.indexes.json**

Buka `clicker-platform-v2/firestore.indexes.json`, tambahkan ke dalam array `indexes`:

```json
{
  "collectionGroup": "platform_logs",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "siteId", "order": "ASCENDING" },
    { "fieldPath": "ts", "order": "DESCENDING" }
  ]
},
{
  "collectionGroup": "platform_logs",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "level", "order": "ASCENDING" },
    { "fieldPath": "ts", "order": "DESCENDING" }
  ]
},
{
  "collectionGroup": "platform_logs",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "event", "order": "ASCENDING" },
    { "fieldPath": "ts", "order": "DESCENDING" }
  ]
},
{
  "collectionGroup": "platform_logs",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "ttl", "order": "ASCENDING" }
  ]
}
```

- [ ] **Step 3: Commit**

```bash
git add clicker-platform-v2/firestore.rules clicker-platform-v2/firestore.indexes.json
git commit -m "feat(firestore): add platform_logs and platform_meta rules + indexes"
```

---

## Task 4: Migrate `lib/firebase-admin.ts`

**Files:**
- Modify: `clicker-platform-v2/lib/firebase-admin.ts`

> **Catatan:** `firebase-admin.ts` adalah file yang di-import oleh `logger.ts`. Kita tidak bisa import `logger` dari sini (circular dependency). Untuk file ini, gunakan `console.error` bare minimum — hanya untuk kegagalan init yang terjadi sebelum logger bisa berjalan.

- [ ] **Step 1: Replace console.log (debug) dan rapikan console.error**

Buka `clicker-platform-v2/lib/firebase-admin.ts`. Replace semua `console.log` dengan tidak ada (hapus), dan pastikan `console.error` di baris init failure tetap ada tapi lebih ringkas:

```ts
// HAPUS semua console.log:
// console.log('[firebase-admin] Found GCP_SERVICE_ACCOUNT_KEY. Initializing...');
// console.log('[firebase-admin] Reading credentials from file:', serviceAccountKey);
// console.log('[firebase-admin] Parsing credentials from JSON string...');
// console.log('[firebase-admin] Initializing with ADC (Production/Cloud Mode)...');

// PERTAHANKAN hanya ini (tidak bisa pakai logger karena circular):
// console.error('[firebase-admin] Failed to load/parse GCP_SERVICE_ACCOUNT_KEY:', error);
```

Setelah edit, file `initializeAdminApp()` harus terlihat seperti ini (bagian yang berubah):

```ts
if (serviceAccountKey) {
    try {
        let credential;
        if (serviceAccountKey.endsWith('.json') || serviceAccountKey.startsWith('/') || serviceAccountKey.startsWith('./')) {
            const fs = require('fs');
            const path = require('path');
            const keyPath = path.resolve(process.cwd(), serviceAccountKey);
            const keyContent = fs.readFileSync(keyPath, 'utf-8');
            credential = JSON.parse(keyContent);
        } else {
            credential = JSON.parse(serviceAccountKey);
        }
        return initializeApp({
            credential: cert(credential),
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
            storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
        }) as App;
    } catch (error) {
        console.error('[firebase-admin] Failed to load/parse GCP_SERVICE_ACCOUNT_KEY:', error);
    }
}

return initializeApp({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
}) as App;
```

- [ ] **Step 2: Verify tidak ada console.log tersisa**

```bash
grep -n "console\.log" clicker-platform-v2/lib/firebase-admin.ts
```

Expected: tidak ada output.

- [ ] **Step 3: Commit**

```bash
git add clicker-platform-v2/lib/firebase-admin.ts
git commit -m "chore(logger): remove debug console.log from firebase-admin init"
```

---

## Task 5: Migrate `middleware.ts`

**Files:**
- Modify: `clicker-platform-v2/middleware.ts`

- [ ] **Step 1: Tambah import logger di atas file**

Buka `clicker-platform-v2/middleware.ts`. Tambahkan import di baris paling atas (setelah import Next.js):

```ts
import { logger } from '@/lib/logger';
```

- [ ] **Step 2: Replace semua console.error → logger.error**

Cari ketiga `console.error` di middleware.ts:

```ts
// SEBELUM (baris ~53):
console.error('[Middleware] NEXT_PUBLIC_BASE_DOMAIN is not defined');

// SESUDAH:
logger.error('middleware.env.missing', { siteId: 'platform', error: 'NEXT_PUBLIC_BASE_DOMAIN is not defined' });
```

```ts
// SEBELUM (baris ~136):
console.error('[Middleware] NEXT_PUBLIC_AUTH_GATEWAY_URL is not defined');

// SESUDAH:
logger.error('middleware.env.missing', { siteId: 'platform', error: 'NEXT_PUBLIC_AUTH_GATEWAY_URL is not defined' });
```

```ts
// SEBELUM (baris ~255):
console.error('[Middleware] NEXT_PUBLIC_AUTH_GATEWAY_URL is not defined for tenant admin');

// SESUDAH:
logger.error('middleware.env.missing', { siteId, error: 'NEXT_PUBLIC_AUTH_GATEWAY_URL is not defined for tenant admin' });
```

- [ ] **Step 3: Verify tidak ada console.* tersisa di middleware**

```bash
grep -n "console\." clicker-platform-v2/middleware.ts
```

Expected: tidak ada output.

- [ ] **Step 4: Commit**

```bash
git add clicker-platform-v2/middleware.ts
git commit -m "feat(logger): migrate middleware.ts to structured logger"
```

---

## Task 6: Migrate `lib/admin-auth.ts` dan `lib/fetchData.ts`

**Files:**
- Modify: `clicker-platform-v2/lib/admin-auth.ts`
- Modify: `clicker-platform-v2/lib/fetchData.ts`

- [ ] **Step 1: Migrate admin-auth.ts**

Tambah import di atas `clicker-platform-v2/lib/admin-auth.ts`:

```ts
import { logger } from '@/lib/logger';
```

Replace semua `console.*` di admin-auth.ts:

```ts
// SEBELUM (baris ~100, ~103):
console.error("Failed to fetch site details for member match:", siteRef.id, err);
// SESUDAH:
logger.error('auth.sites.fetch.failed', { siteId: siteRef.id, error: err });

// SEBELUM (baris ~118, ~119):
console.warn("Membership lookup failed...");
console.warn("Please create this index...");
// SESUDAH:
logger.warn('auth.membership.index.missing', { siteId: 'platform', error: 'Missing Collection Group Index on members.email' });

// SEBELUM (baris ~120):
console.error(e);
// SESUDAH: (sudah di-handle oleh warn di atas, hapus baris ini)

// SEBELUM (baris ~124):
console.error("[getUserSites] Error fetching user sites for user:", userId, e);
// SESUDAH:
logger.error('auth.getUserSites.failed', { siteId: 'platform', error: e });

// SEBELUM (baris ~127):
console.log("[getUserSites] Returning sites:", sites);
// SESUDAH: HAPUS (debug log)
```

- [ ] **Step 2: Migrate fetchData.ts**

Tambah import di atas `clicker-platform-v2/lib/fetchData.ts`:

```ts
import { logger } from '@/lib/logger';
```

Cari semua `console.*` di fetchData.ts dan replace:

```bash
grep -n "console\." clicker-platform-v2/lib/fetchData.ts
```

Untuk setiap `console.error` yang ditemukan, gunakan pattern:
```ts
// SEBELUM:
console.error("Error fetching X:", error)
// SESUDAH:
logger.error('fetch.X.failed', { siteId: siteId ?? 'platform', error })
```

Untuk setiap `console.log` debug:
```ts
// HAPUS sepenuhnya
```

Untuk setiap `console.warn`:
```ts
// SEBELUM:
console.warn('[DEBUG] msg', val)
// SESUDAH:
logger.warn('fetch.warning', { siteId: siteId ?? 'platform', detail: val })
```

- [ ] **Step 3: Verify bersih**

```bash
grep -n "console\." clicker-platform-v2/lib/admin-auth.ts
grep -n "console\." clicker-platform-v2/lib/fetchData.ts
```

Expected: tidak ada output dari kedua file.

- [ ] **Step 4: Commit**

```bash
git add clicker-platform-v2/lib/admin-auth.ts clicker-platform-v2/lib/fetchData.ts
git commit -m "feat(logger): migrate admin-auth and fetchData to structured logger"
```

---

## Task 7: Migrate API Routes — Upload, Analytics, Forms

**Files:**
- Modify: `clicker-platform-v2/app/api/upload/image/route.ts`
- Modify: `clicker-platform-v2/app/api/upload/avatar/route.ts`
- Modify: `clicker-platform-v2/app/api/analytics/track/route.ts`
- Modify: `clicker-platform-v2/app/api/forms/submit/route.ts`
- Modify: `clicker-platform-v2/app/api/forms/create/route.ts`
- Modify: `clicker-platform-v2/app/api/forms/update/route.ts`
- Modify: `clicker-platform-v2/app/api/forms/delete/route.ts`

- [ ] **Step 1: Migrate upload/image/route.ts**

Tambah import:
```ts
import { logger } from '@/lib/logger';
```

Replace seluruh `console.*` — hapus semua step logs, pertahankan hanya error/warn:

```ts
// HAPUS semua ini:
// console.log('[Upload Image] Starting upload process...');
// console.log('[Upload Image] Processing image with Sharp...');
// console.log('[Upload Image] Storage bucket:', bucketName);
// console.log('[Upload Image] Saving to:', fileName);
// console.log('[Upload Image] Success! URL:', publicUrl);

// REPLACE warn:
// console.warn('[Upload Image] No file provided')
// → (tidak perlu logger untuk 400 validation errors — biarkan return saja)

// REPLACE error:
// console.warn('[Upload Image] Invalid file type:', file.type)
logger.warn('upload.invalid.type', { siteId, error: file.type });

// console.warn('[Upload Image] File size too large:', file.size)
logger.warn('upload.size.exceeded', { siteId, error: `${file.size} bytes` });

// console.error('[Upload Image] Error: NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET is not defined')
logger.error('upload.image.failed', { siteId, error: 'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET not defined' });

// console.error('[Upload Image] FATAL ERROR:', error)
logger.error('upload.image.failed', { siteId, error });
```

Pastikan `siteId` diambil dari header sebelum dipakai di logger:
```ts
const siteId = req.headers.get('x-site-id') || 'platform';
```
(Baris ini sudah ada di file — pastikan letaknya sebelum pemanggilan logger pertama)

- [ ] **Step 2: Migrate upload/avatar/route.ts dengan cara sama**

Tambah import `logger`. Hapus semua step logs. Replace error/warn sesuai pattern:

```ts
// console.error upload.avatar.failed
logger.error('upload.avatar.failed', { siteId, error });

// console.warn invalid type
logger.warn('upload.invalid.type', { siteId, error: file.type });

// console.warn size exceeded
logger.warn('upload.size.exceeded', { siteId, error: `${file.size} bytes` });
```

- [ ] **Step 3: Migrate analytics/track/route.ts**

Tambah import `logger`. Replace:

```ts
// console.error — db missing
logger.error('analytics.db.missing', { siteId: siteId ?? 'platform', error: 'Firebase db not initialized' });

// console.error — batch failed
logger.error('analytics.batch.failed', { siteId: siteId ?? 'platform', error });

// console.warn — permission denied
logger.warn('analytics.permission.denied', { siteId: siteId ?? 'platform', error });

// console.warn — invalid siteId
logger.warn('analytics.invalid.siteId', { siteId: 'platform', error: 'tracking skipped' });
```

- [ ] **Step 4: Migrate semua forms routes**

Untuk `forms/submit/route.ts`, `forms/create/route.ts`, `forms/update/route.ts`, `forms/delete/route.ts` — tambah import logger dan replace:

```ts
// forms/submit
logger.error('form.submit.failed', { siteId, formId, error });
logger.warn('form.siteId.missing', { siteId: 'platform' });
logger.warn('form.not.found', { siteId, formId });
logger.warn('form.email.notify.failed', { siteId, formId, error });

// forms/create
logger.error('form.create.failed', { siteId, error });

// forms/update
logger.error('form.update.failed', { siteId, error });

// forms/delete
logger.error('form.delete.failed', { siteId, error });
```

- [ ] **Step 5: Verify bersih**

```bash
grep -rn "console\." \
  clicker-platform-v2/app/api/upload/ \
  clicker-platform-v2/app/api/analytics/ \
  clicker-platform-v2/app/api/forms/
```

Expected: tidak ada output.

- [ ] **Step 6: Commit**

```bash
git add \
  clicker-platform-v2/app/api/upload/ \
  clicker-platform-v2/app/api/analytics/ \
  clicker-platform-v2/app/api/forms/
git commit -m "feat(logger): migrate upload, analytics, forms API routes to structured logger"
```

---

## Task 8: Migrate API Routes — WhatsApp, AI, Team, Knowledge

**Files:**
- Modify: `clicker-platform-v2/app/api/webhook/whatsapp/route.ts`
- Modify: `clicker-platform-v2/app/api/ai-sales-agent/chat/route.ts`
- Modify: `clicker-platform-v2/app/api/admin/team/add/route.ts`
- Modify: `clicker-platform-v2/app/api/admin/team/remove/route.ts`
- Modify: `clicker-platform-v2/app/api/admin/knowledge/sync/route.ts`
- Modify: `clicker-platform-v2/app/api/admin/whatsapp/send/route.ts`
- Modify: `clicker-platform-v2/app/api/admin/modules/ai-marketing/generate/route.ts`
- Modify: `clicker-platform-v2/app/api/admin/modules/ai-marketing/assets/analyze/route.ts`
- Modify: `clicker-platform-v2/app/api/auth/check-access/route.ts`

- [ ] **Step 1: Migrate webhook/whatsapp/route.ts**

Tambah import `logger`. Replace:

```ts
// console.warn — site not found
logger.warn('wa.webhook.site.not.found', { siteId: 'platform', error: phoneNumberId });

// console.error — send failed
logger.error('wa.send.failed', { siteId, error });

// console.error — test failed
logger.error('wa.test.failed', { siteId, error });

// console.error — disconnect failed
logger.error('wa.disconnect.failed', { siteId, error });
```

- [ ] **Step 2: Migrate ai-sales-agent/chat/route.ts**

Tambah import `logger`. Replace:

```ts
// console.warn — primary model failed (fallback triggered)
logger.warn('ai.primary.model.failed', { siteId, error });

// console.error — chat failed
logger.error('ai.chat.failed', { siteId, error });
```

- [ ] **Step 3: Migrate team/add/route.ts dan team/remove/route.ts**

Tambah import `logger`. Hapus verbose step logs. Replace error:

```ts
// team/add
logger.error('team.add.failed', { siteId, error });

// team/remove
logger.error('team.remove.failed', { siteId, error });
```

- [ ] **Step 4: Migrate knowledge/sync/route.ts**

Tambah import `logger`. Replace:

```ts
logger.error('knowledge.sync.failed', { siteId, error });
```

- [ ] **Step 4b: Migrate ai-marketing routes**

Tambah import `logger` ke kedua file. Replace:

```ts
// generate/route.ts
logger.error('ai.marketing.generate.failed', { siteId, error: err.message });

// assets/analyze/route.ts
logger.warn('ai.marketing.analyze.failed', { siteId, error: err.message });
```

- [ ] **Step 5: Migrate auth/check-access/route.ts**

Tambah import `logger`. Hapus verbose step logs (baris 15, 30, 55). Replace error:

```ts
logger.error('auth.check.failed', { siteId: siteId ?? 'platform', error });
```

- [ ] **Step 6: Verify bersih**

```bash
grep -rn "console\." \
  clicker-platform-v2/app/api/webhook/ \
  clicker-platform-v2/app/api/ai-sales-agent/ \
  clicker-platform-v2/app/api/admin/ \
  clicker-platform-v2/app/api/auth/
```

Expected: tidak ada output.

- [ ] **Step 7: Commit**

```bash
git add \
  clicker-platform-v2/app/api/webhook/ \
  clicker-platform-v2/app/api/ai-sales-agent/ \
  clicker-platform-v2/app/api/admin/ \
  clicker-platform-v2/app/api/auth/
git commit -m "feat(logger): migrate WA, AI, team, knowledge, auth API routes to structured logger"
```

---

## Task 9: Migrate `lib/cache/redis.ts`

**Files:**
- Modify: `clicker-platform-v2/lib/cache/redis.ts`

- [ ] **Step 1: Cek console.* di redis.ts**

```bash
grep -n "console\." clicker-platform-v2/lib/cache/redis.ts
```

- [ ] **Step 2: Tambah import dan replace**

Tambah import `logger`. Replace semua `console.*`:

```ts
// cache get failed
logger.warn('cache.get.failed', { siteId: 'platform', error });

// cache set failed
logger.warn('cache.set.failed', { siteId: 'platform', error });

// cache invalidate failed
logger.warn('cache.invalidate.failed', { siteId: 'platform', error });
```

- [ ] **Step 3: Verify bersih**

```bash
grep -n "console\." clicker-platform-v2/lib/cache/redis.ts
```

- [ ] **Step 4: Commit**

```bash
git add clicker-platform-v2/lib/cache/redis.ts
git commit -m "feat(logger): migrate cache/redis.ts to structured logger"
```

---

## Task 10: Migrate Module API Files (Client-side)

**Files:**
- Modify: `clicker-platform-v2/lib/modules/byod_pos/api.ts`
- Modify: `clicker-platform-v2/lib/modules/reservation/api.ts`
- Modify: `clicker-platform-v2/lib/modules/membership/api.ts`
- Modify: `clicker-platform-v2/lib/modules/service-records/api.ts`
- Modify: `clicker-platform-v2/lib/modules/sales-pipeline/api.ts`
- Modify: `clicker-platform-v2/lib/modules/sales-pipeline/server-integration.ts`
- Modify: `clicker-platform-v2/lib/modules/inventory/admin/InventoryAdminPage.tsx`

> **Catatan:** File-file ini berjalan di browser (client SDK, bukan admin SDK). `logger` akan otomatis hanya menulis ke `console.*` — tidak ada Firestore write dari browser.

- [ ] **Step 1: Migrate byod_pos/api.ts**

Tambah import di atas file:
```ts
import { logger } from '@/lib/logger';
```

Replace semua `console.*`:

```ts
// console.error "Error subscribing to recent orders"
logger.error('pos.order.failed', { siteId, error });

// console.error "Failed to process loyalty points"
logger.warn('pos.loyalty.failed', { siteId, error });

// console.error "Failed to refund item"
logger.warn('pos.refund.failed', { siteId, error: `${item.name}: ${e}` });

// console.error "Error in getPOSSettings"
logger.warn('pos.settings.no.siteId', { siteId, error: e });
```

- [ ] **Step 2: Migrate reservation/api.ts**

Tambah import `logger`. Hapus verbose loyalty logs (baris 225, 247). Replace:

```ts
// console.error "Error fetching counts"
logger.error('reservation.create.failed', { siteId, error });

// console.error '[Loyalty] Failed to award points'
logger.warn('reservation.loyalty.skipped', { siteId, error });
```

- [ ] **Step 3: Migrate membership/api.ts**

Tambah import `logger`. Replace:

```ts
logger.error('membership.load.failed', { siteId, error });
logger.error('membership.link.failed', { siteId, error });
logger.error('membership.settings.fetch.failed', { siteId, error });
```

- [ ] **Step 4: Migrate service-records/api.ts**

Tambah import `logger`. Hapus verbose step logs (baris 415, 421, 434, 453). Replace:

```ts
logger.error('service.inventory.deduct.failed', { siteId, error: err });
logger.error('service.booking.complete.failed', { siteId, error: err });
logger.error('service.loyalty.award.failed', { siteId, error: err });
logger.error('service.record.fetch.failed', { siteId, error });
logger.error('service.vehicle.fetch.failed', { siteId, error });
```

- [ ] **Step 5: Migrate sales-pipeline/api.ts dan server-integration.ts**

Tambah import `logger` di kedua file. Hapus verbose step logs (server-integration.ts baris 6, 28, 81). Replace:

```ts
// api.ts
logger.error('pipeline.lead.create.failed', { siteId, error });
logger.error('pipeline.board.fetch.failed', { siteId, error });

// server-integration.ts
logger.error('pipeline.lead.create.failed', { siteId, formId, error });
```

- [ ] **Step 6: Migrate inventory/admin/InventoryAdminPage.tsx**

Tambah import `logger`. Replace:

```ts
logger.error('inventory.adjust.failed', { siteId, error });
logger.error('inventory.history.fetch.failed', { siteId, error });
```

- [ ] **Step 7: Verify bersih**

```bash
grep -rn "console\." \
  clicker-platform-v2/lib/modules/byod_pos/api.ts \
  clicker-platform-v2/lib/modules/reservation/api.ts \
  clicker-platform-v2/lib/modules/membership/api.ts \
  clicker-platform-v2/lib/modules/service-records/api.ts \
  clicker-platform-v2/lib/modules/sales-pipeline/api.ts \
  clicker-platform-v2/lib/modules/sales-pipeline/server-integration.ts \
  clicker-platform-v2/lib/modules/inventory/admin/InventoryAdminPage.tsx
```

Expected: tidak ada output.

- [ ] **Step 8: Commit**

```bash
git add \
  clicker-platform-v2/lib/modules/byod_pos/api.ts \
  clicker-platform-v2/lib/modules/reservation/api.ts \
  clicker-platform-v2/lib/modules/membership/api.ts \
  clicker-platform-v2/lib/modules/service-records/api.ts \
  clicker-platform-v2/lib/modules/sales-pipeline/api.ts \
  clicker-platform-v2/lib/modules/sales-pipeline/server-integration.ts \
  clicker-platform-v2/lib/modules/inventory/admin/InventoryAdminPage.tsx
git commit -m "feat(logger): migrate all module api files to structured logger"
```

---

## Task 11: Hapus Debug Logs di Client Components

**Files:**
- Modify: `clicker-platform-v2/app/[tenant]/page.tsx`
- Modify: `clicker-platform-v2/app/[tenant]/[...slug]/page.tsx`
- Modify: `clicker-platform-v2/lib/modules/byod_pos/components/POSWidget.tsx`
- Modify: `clicker-platform-v2/lib/modules/membership/components/dashboard/MemberDashboard.tsx`
- Modify: `clicker-platform-v2/app/admin/auth/callback/page.tsx`

- [ ] **Step 1: Hapus debug logs di tenant pages**

Di `app/[tenant]/page.tsx` baris 25, 30 — hapus:
```ts
// HAPUS:
console.log('[TenantPage] Tenant:', tenant)
console.log('[TenantPage] SiteId:', siteId)
```

Di `app/[tenant]/[...slug]/page.tsx` baris 72 — hapus:
```ts
// HAPUS:
console.log('[TenantCatchAll] Tenant:', tenant)
```

- [ ] **Step 2: Hapus debug logs di POSWidget dan MemberDashboard**

Di `lib/modules/byod_pos/components/POSWidget.tsx` baris 153 — hapus:
```ts
// HAPUS (expose order data):
console.log('Order Payload:', orderPayload)
```

Di `lib/modules/membership/components/dashboard/MemberDashboard.tsx` baris 45 — hapus:
```ts
// HAPUS:
console.log('DEBUG: Loading member...')
```

- [ ] **Step 3: Hapus 8 verbose auth step logs di callback/page.tsx**

Di `app/admin/auth/callback/page.tsx` baris 132–171 — hapus semua `console.log` verbose auth steps. Pertahankan hanya `console.error` jika ada, tapi ganti ke logger:

```ts
import { logger } from '@/lib/logger';

// Ganti error:
logger.error('auth.callback.failed', { siteId: 'platform', error });
```

- [ ] **Step 4: Verify bersih**

```bash
grep -rn "console\." \
  "clicker-platform-v2/app/[tenant]/page.tsx" \
  "clicker-platform-v2/app/[tenant]/[...slug]/page.tsx" \
  clicker-platform-v2/lib/modules/byod_pos/components/POSWidget.tsx \
  clicker-platform-v2/lib/modules/membership/components/dashboard/MemberDashboard.tsx \
  clicker-platform-v2/app/admin/auth/callback/page.tsx
```

Expected: tidak ada output.

- [ ] **Step 5: Commit**

```bash
git add \
  "clicker-platform-v2/app/[tenant]/page.tsx" \
  "clicker-platform-v2/app/[tenant]/[...slug]/page.tsx" \
  clicker-platform-v2/lib/modules/byod_pos/components/POSWidget.tsx \
  clicker-platform-v2/lib/modules/membership/components/dashboard/MemberDashboard.tsx \
  clicker-platform-v2/app/admin/auth/callback/page.tsx
git commit -m "chore(logger): remove debug console.log from client components"
```

---

## Task 12: Final Sweep — Remaining console.* 

**Files:**
- Semua file yang belum di-migrate

- [ ] **Step 1: Audit sisa console.* di server-side**

```bash
grep -rn "console\." \
  clicker-platform-v2/app/api/ \
  clicker-platform-v2/lib/ \
  clicker-platform-v2/middleware.ts \
  2>/dev/null | grep -v "node_modules\|\.next"
```

- [ ] **Step 2: Untuk setiap console.error yang tersisa di server — migrate ke logger**

Gunakan pattern yang sama: import logger, identifikasi event name yang sesuai dari Log Inventory (Section 6 design doc), replace.

- [ ] **Step 3: Untuk setiap console.log debug yang tersisa — hapus**

Semua `console.log` yang tidak mengandung informasi observability harus dihapus.

- [ ] **Step 4: Audit sisa console.* di client modules**

```bash
grep -rn "console\." clicker-platform-v2/lib/modules/ 2>/dev/null | grep -v "node_modules"
```

Migrate atau hapus sesuai konteks.

- [ ] **Step 5: Commit final sweep**

```bash
git add -p  # review perubahan satu per satu
git commit -m "chore(logger): final sweep — remove all remaining unstructured console.*"
```

---

## Task 13: Backyard Monitoring Hook

**Files:**
- Create: `backyard/lib/useMonitoringLogs.ts`

- [ ] **Step 1: Buat hook `useMonitoringLogs`**

Buat file `backyard/lib/useMonitoringLogs.ts`:

```ts
'use client';

import { useEffect, useState } from 'react';
import { collection, query, orderBy, limit, onSnapshot, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface PlatformLog {
  id: string;
  level: 'error' | 'warn';
  event: string;
  service: string;
  siteId: string;
  message?: string;
  meta?: Record<string, unknown>;
  ts: { toDate: () => Date };
  ttl: { toDate: () => Date };
  count?: number;
}

interface UseMonitoringLogsOptions {
  siteId?: string;
  level?: 'error' | 'warn';
  event?: string;
  maxItems?: number;
}

export function useMonitoringLogs(options: UseMonitoringLogsOptions = {}) {
  const { siteId, level, event, maxItems = 50 } = options;
  const [logs, setLogs] = useState<PlatformLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const col = collection(db, 'platform_logs');
    const constraints: Parameters<typeof query>[1][] = [
      orderBy('ts', 'desc'),
      limit(maxItems),
    ];

    if (siteId) constraints.push(where('siteId', '==', siteId));
    if (level) constraints.push(where('level', '==', level));
    if (event) constraints.push(where('event', '==', event));

    const q = query(col, ...constraints);

    const unsub = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as PlatformLog));
        setLogs(items);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return unsub;
  }, [siteId, level, event, maxItems]);

  return { logs, loading, error };
}

export function useUnreadLogCount(lastSeenAt: Date | null): number {
  const { logs } = useMonitoringLogs({ level: 'error', maxItems: 100 });
  if (!lastSeenAt) return logs.length;
  return logs.filter((l) => l.ts.toDate() > lastSeenAt).length;
}
```

- [ ] **Step 2: Commit**

```bash
git add backyard/lib/useMonitoringLogs.ts
git commit -m "feat(monitoring): add useMonitoringLogs Firestore hook"
```

---

## Task 14: Backyard Monitoring Page

**Files:**
- Modify: `backyard/app/monitoring/page.tsx`

- [ ] **Step 1: Replace placeholder dengan live monitoring page**

Replace seluruh isi `backyard/app/monitoring/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import { Activity, AlertCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { useMonitoringLogs, PlatformLog } from '@/lib/useMonitoringLogs';

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s lalu`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m lalu`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h lalu`;
  return `${Math.floor(seconds / 86400)}d lalu`;
}

function LogCard({ log }: { log: PlatformLog }) {
  const [expanded, setExpanded] = useState(false);
  const isError = log.level === 'error';
  const date = log.ts.toDate();

  return (
    <div
      className={`border rounded-2xl p-4 cursor-pointer transition-all ${
        isError
          ? 'border-red-200 bg-red-50/50 hover:bg-red-50'
          : 'border-amber-200 bg-amber-50/50 hover:bg-amber-50'
      }`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2 min-w-0">
          {isError ? (
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
          )}
          <span className={`text-xs font-bold uppercase ${isError ? 'text-red-600' : 'text-amber-600'}`}>
            {log.level}
          </span>
          <span className="font-mono text-sm font-semibold text-gray-800 truncate">{log.event}</span>
        </div>
        <span className="text-xs text-gray-400 whitespace-nowrap">{timeAgo(date)}</span>
      </div>

      <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
        <span>Tenant: <span className="font-medium text-gray-700">{log.siteId}</span></span>
        <span>·</span>
        <span>{log.service}</span>
        {log.count && log.count > 1 && (
          <>
            <span>·</span>
            <span className="font-medium text-gray-700">{log.count}x dalam 5 menit</span>
          </>
        )}
      </div>

      {log.meta?.error && (
        <p className="mt-1 text-xs text-gray-600 font-mono truncate">
          {String(log.meta.error)}
        </p>
      )}

      {expanded && log.meta && Object.keys(log.meta).length > 0 && (
        <pre className="mt-3 text-xs bg-white rounded-lg p-3 border border-gray-100 overflow-auto max-h-40 text-gray-700">
          {JSON.stringify(log.meta, null, 2)}
        </pre>
      )}
    </div>
  );
}

export default function MonitoringPage() {
  const [filterSiteId, setFilterSiteId] = useState('');
  const [filterLevel, setFilterLevel] = useState<'error' | 'warn' | ''>('');
  const [filterEvent, setFilterEvent] = useState('');

  const { logs, loading, error } = useMonitoringLogs({
    siteId: filterSiteId || undefined,
    level: filterLevel || undefined,
    event: filterEvent || undefined,
  });

  const errorCount = logs.filter((l) => l.level === 'error').length;
  const warnCount = logs.filter((l) => l.level === 'warn').length;

  return (
    <div className="min-h-screen bg-gray-50/50 flex font-sans">
      <Sidebar />
      <div className="flex-1 ml-64 p-8">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-brand-dark flex items-center gap-3">
              <Activity className="w-8 h-8" />
              SYSTEM PULSE
            </h1>
            <p className="text-gray-500 font-medium">Platform Health & Telemetry — Live</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <RefreshCw className="w-3 h-3 animate-spin" />
            Real-time
          </div>
        </header>

        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 font-medium">Total Events</p>
            <p className="text-2xl font-black text-brand-dark">{logs.length}</p>
          </div>
          <div className="bg-white rounded-2xl border border-red-100 p-4">
            <p className="text-xs text-red-500 font-medium">Errors</p>
            <p className="text-2xl font-black text-red-600">{errorCount}</p>
          </div>
          <div className="bg-white rounded-2xl border border-amber-100 p-4">
            <p className="text-xs text-amber-500 font-medium">Warnings</p>
            <p className="text-2xl font-black text-amber-600">{warnCount}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-6">
          <input
            type="text"
            placeholder="Filter by siteId..."
            value={filterSiteId}
            onChange={(e) => setFilterSiteId(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-brand-dark/20"
          />
          <select
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value as 'error' | 'warn' | '')}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark/20"
          >
            <option value="">All levels</option>
            <option value="error">Error</option>
            <option value="warn">Warn</option>
          </select>
          <input
            type="text"
            placeholder="Filter by event..."
            value={filterEvent}
            onChange={(e) => setFilterEvent(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-brand-dark/20"
          />
        </div>

        {/* Log Feed */}
        <div className="space-y-3">
          {loading && (
            <div className="text-center text-gray-400 py-12">Loading logs...</div>
          )}
          {error && (
            <div className="text-center text-red-500 py-12">{error}</div>
          )}
          {!loading && !error && logs.length === 0 && (
            <div className="text-center text-gray-400 py-12">
              No logs found. Platform is healthy or no events match filter.
            </div>
          )}
          {logs.map((log) => (
            <LogCard key={log.id} log={log} />
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add backyard/app/monitoring/page.tsx
git commit -m "feat(monitoring): live error feed with filters and stats bar"
```

---

## Task 15: Backyard Sidebar — Unread Badge

**Files:**
- Modify: `backyard/components/Sidebar.tsx`

- [ ] **Step 1: Tambah state unread count dan hook**

Buka `backyard/components/Sidebar.tsx`. Tambah import:

```ts
import { useEffect, useState } from 'react';
import { collection, query, orderBy, limit, onSnapshot, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
```

Tambah state dan effect di dalam komponen `Sidebar` (sebelum return):

```ts
const [unreadCount, setUnreadCount] = useState(0);
const [lastSeenAt] = useState<Date>(() => {
  if (typeof window === 'undefined') return new Date();
  const stored = localStorage.getItem('monitoring_last_seen');
  return stored ? new Date(stored) : new Date(0);
});

useEffect(() => {
  const col = collection(db, 'platform_logs');
  const q = query(col, where('level', '==', 'error'), orderBy('ts', 'desc'), limit(50));
  const unsub = onSnapshot(q, (snap) => {
    const newLogs = snap.docs.filter((d) => {
      const ts = d.data().ts?.toDate?.();
      return ts && ts > lastSeenAt;
    });
    setUnreadCount(newLogs.length);
  });
  return unsub;
}, [lastSeenAt]);

const handleMonitoringClick = () => {
  localStorage.setItem('monitoring_last_seen', new Date().toISOString());
  setUnreadCount(0);
};
```

- [ ] **Step 2: Tambah badge di nav item Monitoring**

Cari link Monitoring di `menuItems.map(...)` dan tambahkan badge:

```tsx
<Link
  key={item.href}
  href={item.href}
  onClick={item.href === '/monitoring' ? handleMonitoringClick : undefined}
  className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all font-medium text-sm border border-transparent
    ${isActive
      ? 'bg-brand-green/10 text-brand-dark border-brand-dark/10'
      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
    }`}
>
  <item.icon className={`w-5 h-5 ${isActive ? 'text-brand-dark' : 'text-slate-400'}`} />
  <span className="flex-1">{item.name}</span>
  {item.href === '/monitoring' && unreadCount > 0 && (
    <span className="bg-red-500 text-white text-xs font-bold rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
      {unreadCount > 99 ? '99+' : unreadCount}
    </span>
  )}
</Link>
```

- [ ] **Step 3: Commit**

```bash
git add backyard/components/Sidebar.tsx
git commit -m "feat(monitoring): unread error badge on Sidebar Monitoring nav item"
```

---

## Task 16: Verifikasi Final & Build Check

- [ ] **Step 1: Audit menyeluruh — tidak boleh ada console.* yang tersisa di server-side**

```bash
grep -rn "console\." \
  clicker-platform-v2/app/api/ \
  clicker-platform-v2/middleware.ts \
  clicker-platform-v2/lib/firebase-admin.ts \
  clicker-platform-v2/lib/admin-auth.ts \
  clicker-platform-v2/lib/fetchData.ts \
  clicker-platform-v2/lib/cache/ \
  2>/dev/null | grep -v "node_modules\|\.next"
```

Expected: tidak ada output (atau hanya satu `console.error` di firebase-admin.ts untuk init failure).

- [ ] **Step 2: Audit client-side — tidak boleh ada console.log debug**

```bash
grep -rn "console\.log" \
  clicker-platform-v2/lib/modules/ \
  clicker-platform-v2/app/ \
  2>/dev/null | grep -v "node_modules\|\.next\|logger\.test"
```

Expected: tidak ada output.

- [ ] **Step 3: Jalankan test suite**

```bash
cd clicker-platform-v2 && pnpm vitest run 2>&1 | tail -10
```

Expected: logger tests pass. Pre-existing failures (37 dari baseline) boleh tetap ada — pastikan tidak ada regression baru.

- [ ] **Step 4: TypeScript check**

```bash
cd clicker-platform-v2 && pnpm tsc --noEmit 2>&1 | head -30
```

Expected: tidak ada error TypeScript baru.

- [ ] **Step 5: Commit final**

```bash
git add -A
git commit -m "chore(logger): final verification — all console.* migrated to structured logger"
```

---

## Task 17: Merge ke Dev

- [ ] **Step 1: Pastikan branch dev-logging up-to-date dengan dev**

```bash
git fetch origin dev
git rebase origin/dev
```

- [ ] **Step 2: Push branch dan buat PR ke dev**

```bash
git push -u origin dev-logging
```

Buat PR: `dev-logging → dev` dengan title: `feat(logger): structured logging + Backyard monitoring live feed`

- [ ] **Step 3: Setelah merge, deploy Firestore rules dan indexes**

```bash
# Deploy dari root monorepo (dev atau main worktree)
firebase deploy --only firestore:rules,firestore:indexes
```

- [ ] **Step 4: Set TTL policy di Firebase Console**

Buka Firebase Console → Firestore → `platform_logs` collection → klik field `ttl` → Enable TTL policy.

Ini harus dilakukan manual sekali saja via Firebase Console (tidak bisa lewat CLI).
