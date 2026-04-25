# Logging Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix semua issues yang ditemukan code reviewer — 2 Critical, 5 Important, 2 Suggestions.

**Architecture:** Semua fix terlokalisasi — tidak ada perubahan arsitektur baru. Task 1–2 fix `lib/logger.ts`, Task 3 fix Backyard query, Task 4–6 migrate file yang terlewat, Task 7 fix dead code.

**Tech Stack:** TypeScript, Firestore, Next.js

**Worktree:** `dev/.worktrees/dev-logging` (branch: `dev-logging`)

---

## File Map

| File | Perubahan |
|------|-----------|
| `clicker-platform-v2/lib/logger.ts` | Rename `window` → `windowSlot`, tambah komentar quota atomicity, sanitize siteId slash |
| `clicker-platform-v2/lib/logger.test.ts` | Tambah test untuk `buildDedupeKey` rename + sanitize |
| `backyard/lib/useMonitoringLogs.ts` | Fix urutan constraint (where sebelum orderBy), hapus `useUnreadLogCount` |
| `backyard/components/Sidebar.tsx` | Replace `console.error` logout → structured log |
| `clicker-platform-v2/lib/whatsapp/webhook-processor.ts` | Replace `console.error` → `logger.error` |
| `clicker-platform-v2/lib/whatsapp/message-router.ts` | Replace `console.error` → `logger.error` |
| `clicker-platform-v2/lib/templates/service.ts` | Replace 5x `console.error` → `logger.error` |
| `clicker-platform-v2/lib/use-admin-unread-counts.ts` | Replace 3x `console.error` → `logger.error` |
| `clicker-platform-v2/lib/user-context.tsx` | Replace 2x `console.error` → `logger.error`, hapus commented log |
| `clicker-platform-v2/lib/hooks/useNavigationConfig.ts` | Replace `console.error` → `logger.error` |
| `clicker-platform-v2/lib/systemBlocks.ts` | Replace `console.warn` → `logger.warn` |

---

## Task 1: Fix Critical Issues di `lib/logger.ts`

**Files:**
- Modify: `clicker-platform-v2/lib/logger.ts`
- Modify: `clicker-platform-v2/lib/logger.test.ts`

**Issues yang di-fix:**
- #1: Variable `window` shadows global — rename ke `windowSlot`
- #2: Quota guard tidak atomic — tambah komentar known limitation
- #10: Sanitize `siteId` dari slash di `buildDedupeKey`

- [ ] **Step 1: Update test untuk `buildDedupeKey`**

Buka `clicker-platform-v2/lib/logger.test.ts`. Di dalam describe `buildDedupeKey`, tambahkan test baru:

```ts
    it('sanitizes siteId containing slashes', async () => {
      const { buildDedupeKey } = await import('@/lib/logger');
      const key = buildDedupeKey('site/with/slash', 'upload.image.failed');
      expect(key).not.toContain('/');
      expect(key).toMatch(/^site_with_slash_upload\.image\.failed_\d+$/);
    });
```

- [ ] **Step 2: Jalankan test untuk verify FAIL**

```bash
cd clicker-platform-v2 && pnpm vitest run lib/logger.test.ts 2>&1 | tail -8
```

Expected: FAIL — test baru gagal karena slash belum di-sanitize.

- [ ] **Step 3: Fix `buildDedupeKey` di `lib/logger.ts`**

Cari fungsi `buildDedupeKey` (baris ~20):

```ts
// SEBELUM:
export function buildDedupeKey(siteId: string, event: string): string {
  const window = Math.floor(Date.now() / 300_000);
  return `${siteId}_${event}_${window}`;
}

// SESUDAH:
export function buildDedupeKey(siteId: string, event: string): string {
  const windowSlot = Math.floor(Date.now() / 300_000);
  const safeSiteId = siteId.replace(/\//g, '_');
  return `${safeSiteId}_${event}_${windowSlot}`;
}
```

- [ ] **Step 4: Tambah komentar quota atomicity di `writeToFirestore`**

Cari bagian quota guard di `writeToFirestore` (sekitar baris 71–80). Tambah komentar sebelum `if (writesToday >= 500)`:

```ts
    // Known limitation: quota check is not atomic — concurrent requests can both
    // pass this check during a spike. FieldValue.increment ensures count accuracy,
    // but writes may slightly exceed 500/day. Acceptable given the low cost impact.
    if (writesToday >= 500) return;
```

- [ ] **Step 5: Jalankan test untuk verify PASS**

```bash
cd clicker-platform-v2 && pnpm vitest run lib/logger.test.ts 2>&1 | tail -8
```

Expected: 10 tests pass (9 existing + 1 baru).

- [ ] **Step 6: Commit**

```bash
git add clicker-platform-v2/lib/logger.ts clicker-platform-v2/lib/logger.test.ts
git commit -m "fix(logger): rename window→windowSlot, sanitize siteId slashes, document quota limitation"
```

---

## Task 2: Fix Firestore Query Order di `useMonitoringLogs.ts` + Hapus Dead Code

**Files:**
- Modify: `backyard/lib/useMonitoringLogs.ts`

**Issues yang di-fix:**
- #3: Urutan constraint salah — `where` harus sebelum `orderBy`
- #9: `useUnreadLogCount` di-export tapi tidak pernah dipakai — hapus

- [ ] **Step 1: Baca file untuk context**

```bash
cat backyard/lib/useMonitoringLogs.ts
```

- [ ] **Step 2: Fix urutan constraint**

Cari bagian `useEffect` yang membangun constraints. Ganti:

```ts
// SEBELUM:
const constraints: QueryConstraint[] = [
  orderBy('ts', 'desc'),
  limit(maxItems),
];

if (siteId) constraints.push(where('siteId', '==', siteId));
if (level) constraints.push(where('level', '==', level));
if (event) constraints.push(where('event', '==', event));

// SESUDAH:
const constraints: QueryConstraint[] = [];

if (siteId) constraints.push(where('siteId', '==', siteId));
if (level) constraints.push(where('level', '==', level));
if (event) constraints.push(where('event', '==', event));

constraints.push(orderBy('ts', 'desc'));
constraints.push(limit(maxItems));
```

- [ ] **Step 3: Hapus fungsi `useUnreadLogCount`**

Hapus seluruh fungsi `useUnreadLogCount` dari file (baris ~65–69):

```ts
// HAPUS seluruh blok ini:
export function useUnreadLogCount(lastSeenAt: Date | null): number {
  const { logs } = useMonitoringLogs({ level: 'error', maxItems: 100 });
  if (!lastSeenAt) return logs.length;
  return logs.filter((l) => l.ts.toDate() > lastSeenAt).length;
}
```

- [ ] **Step 4: Verify tidak ada import `useUnreadLogCount` yang tersisa**

```bash
grep -rn "useUnreadLogCount" backyard/
```

Expected: tidak ada output (fungsi tidak dipakai di mana pun).

- [ ] **Step 5: Commit**

```bash
git add backyard/lib/useMonitoringLogs.ts
git commit -m "fix(monitoring): correct Firestore constraint order, remove unused useUnreadLogCount"
```

---

## Task 3: Fix Backyard Sidebar `console.error`

**Files:**
- Modify: `backyard/components/Sidebar.tsx`

**Issue yang di-fix:**
- #4: `console.error('Logout failed', error)` di baris 56 — Backyard tidak pakai `lib/logger` dari platform, jadi ganti ke structured format yang konsisten tanpa import

- [ ] **Step 1: Baca baris sekitar logout handler**

```bash
grep -n "console\.\|handleLogout\|signOut" backyard/components/Sidebar.tsx | head -15
```

- [ ] **Step 2: Ganti `console.error` logout menjadi structured**

Cari:
```ts
console.error('Logout failed', error);
```

Ganti dengan:
```ts
console.error('[backyard] logout.failed', { error: error instanceof Error ? error.message : String(error) });
```

Ini konsisten tanpa perlu import logger dari platform (Backyard adalah app terpisah).

- [ ] **Step 3: Verify**

```bash
grep -n "console\." backyard/components/Sidebar.tsx
```

Expected: hanya satu baris tersisa — yang baru dengan format structured.

- [ ] **Step 4: Commit**

```bash
git add backyard/components/Sidebar.tsx
git commit -m "fix(backyard): structured console.error in Sidebar logout handler"
```

---

## Task 4: Migrate File WhatsApp yang Terlewat

**Files:**
- Modify: `clicker-platform-v2/lib/whatsapp/webhook-processor.ts`
- Modify: `clicker-platform-v2/lib/whatsapp/message-router.ts`

**Issue yang di-fix:**
- #5: Dua file server-side WA terlewat dari migrasi

- [ ] **Step 1: Migrate `lib/whatsapp/webhook-processor.ts`**

```bash
grep -n "console\." clicker-platform-v2/lib/whatsapp/webhook-processor.ts
```

Tambah import logger:
```ts
import { logger } from '@/lib/logger';
```

Ganti baris 164:
```ts
// SEBELUM:
console.error('[WA] Owner command routing failed:', err)

// SESUDAH:
logger.error('wa.command.routing.failed', { siteId: siteId ?? 'platform', error: err });
```

Pastikan `siteId` tersedia di scope. Jika tidak, baca context fungsi dan gunakan variabel yang tersedia atau `'platform'`.

- [ ] **Step 2: Migrate `lib/whatsapp/message-router.ts`**

```bash
grep -n "console\." clicker-platform-v2/lib/whatsapp/message-router.ts
```

Tambah import logger. Ganti baris 29:
```ts
// SEBELUM:
console.error('[WA] Command handler error:', err);

// SESUDAH:
logger.error('wa.command.handler.failed', { siteId: siteId ?? 'platform', error: err });
```

- [ ] **Step 3: Verify bersih**

```bash
grep -n "console\." \
  clicker-platform-v2/lib/whatsapp/webhook-processor.ts \
  clicker-platform-v2/lib/whatsapp/message-router.ts
```

Expected: tidak ada output.

- [ ] **Step 4: Commit**

```bash
git add \
  clicker-platform-v2/lib/whatsapp/webhook-processor.ts \
  clicker-platform-v2/lib/whatsapp/message-router.ts
git commit -m "fix(logger): migrate missed WA server-side files to structured logger"
```

---

## Task 5: Migrate `lib/templates/service.ts` dan `lib/systemBlocks.ts`

**Files:**
- Modify: `clicker-platform-v2/lib/templates/service.ts`
- Modify: `clicker-platform-v2/lib/systemBlocks.ts`

**Issues yang di-fix:**
- #6: `lib/templates/service.ts` — 5x `console.error`
- #7: `lib/systemBlocks.ts` — 1x `console.warn` server-side

- [ ] **Step 1: Migrate `lib/templates/service.ts`**

```bash
grep -n "console\." clicker-platform-v2/lib/templates/service.ts
```

Tambah import logger. Ganti semua `console.error`:

```ts
// Error fetching templates
logger.error('template.fetch.failed', { siteId: siteId ?? 'platform', error });

// Error fetching template (single)
logger.error('template.fetch.failed', { siteId: siteId ?? 'platform', error });

// Error saving template
logger.error('template.save.failed', { siteId: siteId ?? 'platform', error });

// Error deleting template
logger.error('template.delete.failed', { siteId: siteId ?? 'platform', error });

// Error assigning template
logger.error('template.assign.failed', { siteId: siteId ?? 'platform', error });
```

Gunakan `siteId` yang tersedia di scope masing-masing fungsi. Baca file untuk tahu nama parameter yang dipakai.

- [ ] **Step 2: Migrate `lib/systemBlocks.ts`**

```bash
grep -n "console\." clicker-platform-v2/lib/systemBlocks.ts
```

Tambah import logger. Ganti baris 72:
```ts
// SEBELUM:
console.warn(`Unknown system block ID: ${blockId}`)

// SESUDAH:
logger.warn('content.block.unknown', { siteId: 'platform', error: blockId });
```

- [ ] **Step 3: Verify bersih**

```bash
grep -n "console\." \
  clicker-platform-v2/lib/templates/service.ts \
  clicker-platform-v2/lib/systemBlocks.ts
```

Expected: tidak ada output.

- [ ] **Step 4: Commit**

```bash
git add \
  clicker-platform-v2/lib/templates/service.ts \
  clicker-platform-v2/lib/systemBlocks.ts
git commit -m "fix(logger): migrate templates/service.ts and systemBlocks.ts to structured logger"
```

---

## Task 6: Migrate Remaining Client Hooks

**Files:**
- Modify: `clicker-platform-v2/lib/use-admin-unread-counts.ts`
- Modify: `clicker-platform-v2/lib/user-context.tsx`
- Modify: `clicker-platform-v2/lib/hooks/useNavigationConfig.ts`

**Issue yang di-fix:**
- #6: Client hooks yang terlewat dari migrasi

> **Catatan:** File ini berjalan di browser. `logger` akan hanya menulis ke `console.*` (tidak ada Firestore write dari client).

- [ ] **Step 1: Migrate `lib/use-admin-unread-counts.ts`**

```bash
grep -n "console\." clicker-platform-v2/lib/use-admin-unread-counts.ts
```

Tambah import logger. Ganti 3x `console.error`:

```ts
// Inbox listener error
logger.error('admin.inbox.listener.failed', { siteId, error: err });

// Bookings listener error
logger.error('admin.bookings.listener.failed', { siteId, error: err });

// Setup error
logger.error('admin.unread.setup.failed', { siteId: 'platform', error: e });
```

Gunakan `siteId` yang tersedia di scope hook. Baca file untuk context.

- [ ] **Step 2: Migrate `lib/user-context.tsx`**

```bash
grep -n "console\." clicker-platform-v2/lib/user-context.tsx
```

Tambah import logger. Ganti `console.error` yang aktif (bukan yang commented):

```ts
// Error fetching site owner data
logger.error('user.owner.fetch.failed', { siteId: siteId ?? 'platform', error: err });

// Firestore listener error
logger.error('user.context.listener.failed', { siteId: siteId ?? 'platform', error });
```

Hapus baris comment `// console.log('[UserContext] Realtime Update:...')` jika masih ada.

- [ ] **Step 3: Migrate `lib/hooks/useNavigationConfig.ts`**

```bash
grep -n "console\." clicker-platform-v2/lib/hooks/useNavigationConfig.ts
```

Tambah import logger. Ganti:

```ts
// Firestore error
logger.error('nav.config.fetch.failed', { siteId: siteId ?? 'platform', error: err });
```

- [ ] **Step 4: Verify bersih**

```bash
grep -n "console\." \
  clicker-platform-v2/lib/use-admin-unread-counts.ts \
  clicker-platform-v2/lib/user-context.tsx \
  clicker-platform-v2/lib/hooks/useNavigationConfig.ts
```

Expected: tidak ada output.

- [ ] **Step 5: Commit**

```bash
git add \
  clicker-platform-v2/lib/use-admin-unread-counts.ts \
  clicker-platform-v2/lib/user-context.tsx \
  clicker-platform-v2/lib/hooks/useNavigationConfig.ts
git commit -m "fix(logger): migrate remaining client hooks to structured logger"
```

---

## Task 7: Verifikasi Final

- [ ] **Step 1: Full console.* audit**

```bash
grep -rn "console\." \
  clicker-platform-v2/app/ \
  clicker-platform-v2/lib/ \
  backyard/app/ \
  backyard/lib/ \
  backyard/components/ \
  2>/dev/null | grep -v "node_modules\|\.next\|\.test\.\|logger\.test\|firebase-admin\.ts"
```

Expected: tidak ada output (atau hanya `firebase-admin.ts:58` dan `Sidebar.tsx` yang sudah structured).

- [ ] **Step 2: Jalankan logger tests**

```bash
cd clicker-platform-v2 && pnpm vitest run lib/logger.test.ts 2>&1 | tail -6
```

Expected: 10 tests pass.

- [ ] **Step 3: TypeScript check**

```bash
cd clicker-platform-v2 && pnpm tsc --noEmit 2>&1 | grep -v "VideoEmbedExtension\|suite[0-9]\|toBeInTheDocument\|toHaveAttribute\|toBeEmptyDOMElement\|submitForApproval\|moveToInProgress"
```

Expected: tidak ada output.

- [ ] **Step 4: Commit jika ada perubahan dari verification**

```bash
git status
# Jika ada perubahan:
git add -A
git commit -m "fix(logger): review fixes verification cleanup"
```
