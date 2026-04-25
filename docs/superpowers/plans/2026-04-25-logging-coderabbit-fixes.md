# Logging CodeRabbit Review Fixes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix semua valid findings dari CodeRabbit/manual code review sehingga branch `dev-logging` siap merge tanpa issues.

**Findings yang di-fix:**
- #3 Critical: Sidebar badge resets tapi `lastSeenAt` tidak update → badge langsung muncul lagi
- #5 Warning: Multi-field filter queries di monitoring page akan fail karena missing composite Firestore indexes
- #7 Warning: `event` string tidak di-sanitize slash di `buildDedupeKey`
- #8 Warning: Spinner di monitoring page selalu animate (cosmetic/UX)
- #15 Info: Event filter input label menyesatkan (implies substring, tapi equality-only)

**Findings yang di-SKIP (dengan alasan):**
- #1 (`server-only` guard): Akan break semua client hooks yang import logger — by design, runtime guard sudah cukup
- #2 (`forms/submit` client SDK): Pre-existing issue, out of scope
- #4 (non-atomic quota): Acknowledged dengan comment, acceptable
- #6 (no auth precheck Sidebar): Firestore rules sudah restrict, low risk
- #9 (new events missing from whitelist): Design decision
- #10 (test JSON parse): Tidak ada bug — Vitest set NODE_ENV=test by default, 10/10 pass confirmed
- #11–#14: Info/cosmetic, tidak perlu fix sebelum merge

**Tech Stack:** TypeScript, Next.js 14, Firestore, React

**Worktree:** `dev/.worktrees/dev-logging` (branch: `dev-logging`)

---

## File Map

| File | Perubahan |
|------|-----------|
| `backyard/components/Sidebar.tsx` | Fix `lastSeenAt` state — tambah setter, update on click |
| `clicker-platform-v2/firestore.indexes.json` | Tambah 4 composite indexes untuk multi-field filter |
| `clicker-platform-v2/lib/logger.ts` | Sanitize `event` slash di `buildDedupeKey` |
| `clicker-platform-v2/lib/logger.test.ts` | Update test `buildDedupeKey` untuk cover event sanitization |
| `backyard/app/monitoring/page.tsx` | Fix spinner UX + event filter placeholder text |

---

## Task 1: Fix Sidebar Badge Loop (`lastSeenAt` never updates)

**File:** `backyard/components/Sidebar.tsx`

**Problem:** `lastSeenAt` di-init dari `useState` tapi setter tidak dipanggil saat `handleMonitoringClick`. Akibatnya Firestore snapshot berikutnya (datang dalam hitungan detik) langsung restore badge ke nilai lama karena filter masih compare ke `lastSeenAt` yang sama.

**Current code (WRONG):**
```ts
const [lastSeenAt] = useState<Date>(() => {
    if (typeof window === 'undefined') return new Date(0);
    const stored = localStorage.getItem('monitoring_last_seen');
    return stored ? new Date(stored) : new Date(0);
});

const handleMonitoringClick = () => {
    localStorage.setItem('monitoring_last_seen', new Date().toISOString());
    setUnreadCount(0);
};
```

- [ ] **Step 1: Fix `lastSeenAt` state**

Buka `backyard/components/Sidebar.tsx`. Ganti baris `const [lastSeenAt] =` menjadi:

```ts
const [lastSeenAt, setLastSeenAt] = useState<Date>(() => {
    if (typeof window === 'undefined') return new Date(0);
    const stored = localStorage.getItem('monitoring_last_seen');
    return stored ? new Date(stored) : new Date(0);
});
```

- [ ] **Step 2: Update `handleMonitoringClick` untuk update state**

Ganti `handleMonitoringClick`:

```ts
const handleMonitoringClick = () => {
    const now = new Date();
    localStorage.setItem('monitoring_last_seen', now.toISOString());
    setLastSeenAt(now);
    setUnreadCount(0);
};
```

- [ ] **Step 3: Verify**

```bash
grep -n "lastSeenAt\|setLastSeenAt\|handleMonitoringClick" backyard/components/Sidebar.tsx
```

Expected: `setLastSeenAt` muncul di dua tempat — destructure dan di dalam handleMonitoringClick.

- [ ] **Step 4: Commit**

```bash
cd /Users/mac/Documents/AI\ Project/clicker-platform/dev/.worktrees/dev-logging
git add backyard/components/Sidebar.tsx
git commit -m "fix(backyard): update lastSeenAt state on monitoring click to prevent badge loop"
```

---

## Task 2: Tambah Composite Firestore Indexes untuk Multi-Filter Queries

**File:** `clicker-platform-v2/firestore.indexes.json`

**Problem:** `useMonitoringLogs` bisa combine hingga 3 `where` clauses (siteId, level, event) + `orderBy('ts', 'desc')`. Firestore butuh composite index untuk setiap kombinasi. Saat ini hanya ada single-field compound indexes (siteId+ts, level+ts, event+ts). Kombinasi dua filter atau lebih akan throw `failed-precondition` di production.

Tambahkan 4 composite indexes berikut ke dalam array `"indexes"` di `firestore.indexes.json`, tepat setelah entry `platform_logs` yang sudah ada:

- [ ] **Step 1: Tambah 4 composite indexes**

Buka `clicker-platform-v2/firestore.indexes.json`. Di dalam array `"indexes"`, setelah entry `platform_logs` event+ts yang sudah ada, tambahkan:

```json
{
    "collectionGroup": "platform_logs",
    "queryScope": "COLLECTION",
    "fields": [
        { "fieldPath": "siteId", "order": "ASCENDING" },
        { "fieldPath": "level", "order": "ASCENDING" },
        { "fieldPath": "ts", "order": "DESCENDING" }
    ]
},
{
    "collectionGroup": "platform_logs",
    "queryScope": "COLLECTION",
    "fields": [
        { "fieldPath": "siteId", "order": "ASCENDING" },
        { "fieldPath": "event", "order": "ASCENDING" },
        { "fieldPath": "ts", "order": "DESCENDING" }
    ]
},
{
    "collectionGroup": "platform_logs",
    "queryScope": "COLLECTION",
    "fields": [
        { "fieldPath": "level", "order": "ASCENDING" },
        { "fieldPath": "event", "order": "ASCENDING" },
        { "fieldPath": "ts", "order": "DESCENDING" }
    ]
},
{
    "collectionGroup": "platform_logs",
    "queryScope": "COLLECTION",
    "fields": [
        { "fieldPath": "siteId", "order": "ASCENDING" },
        { "fieldPath": "level", "order": "ASCENDING" },
        { "fieldPath": "event", "order": "ASCENDING" },
        { "fieldPath": "ts", "order": "DESCENDING" }
    ]
}
```

- [ ] **Step 2: Verify JSON valid**

```bash
cd /Users/mac/Documents/AI\ Project/clicker-platform/dev/.worktrees/dev-logging
node -e "require('./clicker-platform-v2/firestore.indexes.json'); console.log('JSON valid')"
```

Expected: `JSON valid`

- [ ] **Step 3: Verify 4 new entries ada**

```bash
grep -c "platform_logs" clicker-platform-v2/firestore.indexes.json
```

Expected: `7` (3 lama + 4 baru)

- [ ] **Step 4: Commit**

```bash
git add clicker-platform-v2/firestore.indexes.json
git commit -m "fix(firestore): add composite indexes for multi-field platform_logs queries"
```

---

## Task 3: Sanitize `event` Slash di `buildDedupeKey` + Update Test

**Files:**
- `clicker-platform-v2/lib/logger.ts`
- `clicker-platform-v2/lib/logger.test.ts`

**Problem:** `siteId` sudah di-sanitize (fix dari review sebelumnya), tapi `event` string tidak. Jika future event name mengandung `/`, akan membuat Firestore subcollection path bukan document ID. Konsisten dengan fix siteId.

**Current code:**
```ts
export function buildDedupeKey(siteId: string, event: string): string {
  const windowSlot = Math.floor(Date.now() / 300_000);
  const safeSiteId = siteId.replace(/\//g, '_');
  return `${safeSiteId}_${event}_${windowSlot}`;
}
```

- [ ] **Step 1: Tulis failing test dulu (TDD)**

Buka `clicker-platform-v2/lib/logger.test.ts`. Di dalam `describe('buildDedupeKey', ...)`, tambahkan test baru setelah test `sanitizes siteId containing slashes`:

```ts
    it('sanitizes event containing slashes', async () => {
      const { buildDedupeKey } = await import('@/lib/logger');
      const key = buildDedupeKey('platform', 'some/nested/event');
      expect(key).not.toContain('/');
      expect(key).toMatch(/^platform_some_nested_event_\d+$/);
    });
```

- [ ] **Step 2: Jalankan test untuk verify FAIL**

```bash
cd /Users/mac/Documents/AI\ Project/clicker-platform/dev/.worktrees/dev-logging/clicker-platform-v2
pnpm vitest run lib/logger.test.ts 2>&1 | tail -8
```

Expected: FAIL — test baru gagal karena event belum di-sanitize.

- [ ] **Step 3: Fix `buildDedupeKey` di `lib/logger.ts`**

Ganti fungsi `buildDedupeKey`:

```ts
export function buildDedupeKey(siteId: string, event: string): string {
  const windowSlot = Math.floor(Date.now() / 300_000);
  const safeSiteId = siteId.replace(/\//g, '_');
  const safeEvent = event.replace(/\//g, '_');
  return `${safeSiteId}_${safeEvent}_${windowSlot}`;
}
```

- [ ] **Step 4: Jalankan test untuk verify PASS**

```bash
pnpm vitest run lib/logger.test.ts 2>&1 | tail -8
```

Expected: 11 tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/mac/Documents/AI\ Project/clicker-platform/dev/.worktrees/dev-logging
git add clicker-platform-v2/lib/logger.ts clicker-platform-v2/lib/logger.test.ts
git commit -m "fix(logger): sanitize event string slashes in buildDedupeKey"
```

---

## Task 4: Fix Monitoring Page — Spinner UX + Filter Placeholder

**File:** `backyard/app/monitoring/page.tsx`

**Problems:**
- #8: `<RefreshCw className="w-3 h-3 animate-spin" />` selalu spin, tidak terikat ke loading state — user tidak bisa bedakan antara "loading" dan "live connected"
- #15: Event filter placeholder `"Filter by event..."` menyesatkan — implies substring search, tapi backend pakai `where('event', '==', event)` (equality only)

- [ ] **Step 1: Fix spinner — animate hanya saat `loading === true`**

Cari baris:
```tsx
<RefreshCw className="w-3 h-3 animate-spin" />
Real-time
```

Ganti dengan:
```tsx
<RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
{loading ? 'Loading...' : 'Live'}
```

Variabel `loading` sudah di-destructure dari `useMonitoringLogs` di baris `const { logs, loading, error } = useMonitoringLogs(...)`.

- [ ] **Step 2: Fix event filter placeholder**

Cari input dengan placeholder event filter. Kemungkinan:
```tsx
placeholder="Filter by event..."
```

Ganti dengan:
```tsx
placeholder="Exact event name (e.g. upload.image.failed)"
```

- [ ] **Step 3: Verify perubahan**

```bash
grep -n "animate-spin\|placeholder.*event\|Live\|Loading" backyard/app/monitoring/page.tsx
```

Expected: `animate-spin` muncul dalam conditional class, placeholder sudah updated.

- [ ] **Step 4: Commit**

```bash
cd /Users/mac/Documents/AI\ Project/clicker-platform/dev/.worktrees/dev-logging
git add backyard/app/monitoring/page.tsx
git commit -m "fix(monitoring): conditional spinner, clarify event filter is exact-match only"
```

---

## Task 5: Final Verification

- [ ] **Step 1: Run logger tests**

```bash
cd /Users/mac/Documents/AI\ Project/clicker-platform/dev/.worktrees/dev-logging/clicker-platform-v2
pnpm vitest run lib/logger.test.ts 2>&1 | tail -6
```

Expected: 11 tests pass.

- [ ] **Step 2: TypeScript check**

```bash
pnpm tsc --noEmit 2>&1 | grep -v "VideoEmbedExtension\|suite[0-9]\|toBeInTheDocument\|toHaveAttribute\|toBeEmptyDOMElement\|submitForApproval\|moveToInProgress"
```

Expected: no output.

- [ ] **Step 3: JSON validity check**

```bash
cd /Users/mac/Documents/AI\ Project/clicker-platform/dev/.worktrees/dev-logging
node -e "require('./clicker-platform-v2/firestore.indexes.json'); console.log('indexes.json valid')"
```

- [ ] **Step 4: Verify Sidebar fix**

```bash
grep -n "setLastSeenAt\|lastSeenAt\|handleMonitoringClick" backyard/components/Sidebar.tsx
```

Expected: `setLastSeenAt` muncul di 3 tempat: destructure, handleMonitoringClick, useEffect deps array.

- [ ] **Step 5: Commit jika ada cleanup**

```bash
git status
# Jika ada perubahan:
git add -A && git commit -m "fix(logger): coderabbit review fixes — final verification cleanup"
```
