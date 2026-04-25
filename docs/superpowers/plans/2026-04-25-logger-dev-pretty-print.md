# Logger Dev Pretty-Print Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tambah dev-readable format ke `lib/logger.ts` — di development output plain string `[ERROR] event | key: value` di terminal DAN browser DevTools. Di production tetap JSON untuk GCP.

**Architecture:** Tambah fungsi `formatDev(payload)` di `logger.ts` yang menghasilkan plain readable string. Fungsi `log()` cek `process.env.NODE_ENV === 'development'` untuk memilih format. Berlaku untuk server (terminal) dan client (browser DevTools) karena sama-sama mudah dibaca. Tidak ada dependency baru, tidak ada perubahan pada consumer.

**Tech Stack:** TypeScript, plain string formatting (no deps)

**Worktree:** `dev/.worktrees/dev-logging` (branch: `dev-logging`)

**Output format:**
```
[ERROR] upload.image.failed | siteId: quattro | error: permission-denied
[WARN]  analytics.invalid.siteId | siteId: platform
[INFO]  reservation.loyalty.awarded | siteId: quattro | points: 100
```

---

## File Map

| File | Perubahan |
|------|-----------|
| `clicker-platform-v2/lib/logger.ts` | Tambah `formatDev()` + branch di `log()` |
| `clicker-platform-v2/lib/logger.test.ts` | Tambah 3 tests untuk dev format |

---

## Task 1: Tambah Dev Pretty-Print ke `lib/logger.ts`

**Files:**
- Modify: `clicker-platform-v2/lib/logger.ts`
- Modify: `clicker-platform-v2/lib/logger.test.ts`

- [ ] **Step 1: Tulis failing tests**

Buka `clicker-platform-v2/lib/logger.test.ts`. Tambahkan describe block berikut di dalam `describe('logger', ...)` — letakkan setelah describe block `buildDedupeKey` yang sudah ada (sebelum penutup `});` terakhir dari describe logger):

```ts
  describe('formatDev', () => {
    it('returns readable string with level, event, siteId', async () => {
      const { formatDev } = await import('@/lib/logger');
      const payload = {
        level: 'error' as const,
        event: 'upload.image.failed',
        service: 'clicker-platform',
        siteId: 'quattro',
        ts: '2026-04-25T10:00:00.000Z',
        meta: { error: 'permission-denied' },
      };
      const result = formatDev(payload);
      expect(result).toBe('[ERROR] upload.image.failed | siteId: quattro | error: permission-denied');
    });

    it('includes all meta fields as key: value pairs', async () => {
      const { formatDev } = await import('@/lib/logger');
      const payload = {
        level: 'warn' as const,
        event: 'analytics.invalid.siteId',
        service: 'clicker-platform',
        siteId: 'platform',
        ts: '2026-04-25T10:00:00.000Z',
        meta: { endpoint: '/api/track', detail: 'missing' },
      };
      const result = formatDev(payload);
      expect(result).toBe('[WARN]  analytics.invalid.siteId | siteId: platform | endpoint: /api/track | detail: missing');
    });

    it('omits meta section when meta is empty', async () => {
      const { formatDev } = await import('@/lib/logger');
      const payload = {
        level: 'info' as const,
        event: 'some.event',
        service: 'clicker-platform',
        siteId: 'platform',
        ts: '2026-04-25T10:00:00.000Z',
        meta: {},
      };
      const result = formatDev(payload);
      expect(result).toBe('[INFO]  some.event | siteId: platform');
    });
  });
```

- [ ] **Step 2: Jalankan test untuk verify FAIL**

```bash
cd clicker-platform-v2 && pnpm vitest run lib/logger.test.ts 2>&1 | tail -8
```

Expected: FAIL — `formatDev is not a function` atau not exported.

- [ ] **Step 3: Tambah `formatDev` ke `lib/logger.ts`**

Buka `clicker-platform-v2/lib/logger.ts`. Tambahkan fungsi berikut tepat setelah fungsi `buildPayload` (sebelum `async function writeToFirestore`):

```ts
export function formatDev(payload: LogPayload): string {
  const level = `[${payload.level.toUpperCase()}]`.padEnd(7);
  const metaEntries = Object.entries(payload.meta);
  const metaPart = metaEntries.length > 0
    ? ' | ' + metaEntries.map(([k, v]) => `${k}: ${String(v)}`).join(' | ')
    : '';
  return `${level} ${payload.event} | siteId: ${payload.siteId}${metaPart}`;
}
```

- [ ] **Step 4: Update fungsi `log()` di `lib/logger.ts`**

Di dalam fungsi `log()`, ganti bagian console output. Cari baris:

```ts
  if (level === 'error') console.error(json);
  else if (level === 'warn') console.warn(json);
  else console.log(json);
```

Ganti dengan:

```ts
  const isDev = typeof process !== 'undefined' && process.env.NODE_ENV === 'development';
  const output = isDev ? formatDev(payload) : json;

  if (level === 'error') console.error(output);
  else if (level === 'warn') console.warn(output);
  else console.log(output);
```

- [ ] **Step 5: Jalankan test untuk verify PASS**

```bash
cd clicker-platform-v2 && pnpm vitest run lib/logger.test.ts 2>&1 | tail -8
```

Expected: semua tests pass (6 existing + 3 baru = 9 total).

- [ ] **Step 6: TypeScript check**

```bash
cd clicker-platform-v2 && pnpm tsc --noEmit 2>&1 | grep -v "VideoEmbedExtension\|suite[0-9]\|toBeInTheDocument\|toHaveAttribute\|toBeEmptyDOMElement\|submitForApproval\|moveToInProgress"
```

Expected: tidak ada output (tidak ada TypeScript error baru).

- [ ] **Step 7: Commit**

```bash
git add clicker-platform-v2/lib/logger.ts clicker-platform-v2/lib/logger.test.ts
git commit -m "feat(logger): pretty-print readable output in development, JSON in production"
```
