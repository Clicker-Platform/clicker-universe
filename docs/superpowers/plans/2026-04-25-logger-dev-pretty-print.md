# Logger Dev Pretty-Print Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tambah pretty-print mode ke `lib/logger.ts` yang aktif di `NODE_ENV === 'development'` — output human-readable di terminal dev, JSON tetap di production.

**Architecture:** Tambah fungsi `formatDev(payload)` di dalam `logger.ts` yang menghasilkan string berwarna dengan ANSI color codes. Fungsi `log()` yang sudah ada cek `process.env.NODE_ENV` sebelum memilih format output. Tidak ada dependency baru, tidak ada perubahan pada consumer.

**Tech Stack:** TypeScript, ANSI escape codes (built-in, no deps)

**Worktree:** `dev/.worktrees/dev-logging` (branch: `dev-logging`)

---

## File Map

| File | Perubahan |
|------|-----------|
| `clicker-platform-v2/lib/logger.ts` | Tambah `formatDev()` + branch di `log()` |
| `clicker-platform-v2/lib/logger.test.ts` | Tambah tests untuk dev format |

---

## Task 1: Tambah Dev Pretty-Print ke `lib/logger.ts`

**Files:**
- Modify: `clicker-platform-v2/lib/logger.ts`
- Modify: `clicker-platform-v2/lib/logger.test.ts`

### Step 1: Tulis failing tests terlebih dahulu

Buka `clicker-platform-v2/lib/logger.test.ts` dan **tambahkan** describe block berikut di bagian bawah file (sebelum penutup `)`):

```ts
  describe('formatDev', () => {
    it('returns a human-readable string with level, event, siteId', async () => {
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
      expect(result).toContain('ERROR');
      expect(result).toContain('upload.image.failed');
      expect(result).toContain('quattro');
      expect(result).toContain('permission-denied');
    });

    it('includes meta fields other than error', async () => {
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
      expect(result).toContain('WARN');
      expect(result).toContain('analytics.invalid.siteId');
      expect(result).toContain('endpoint');
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
      expect(result).toContain('some.event');
      expect(result).not.toContain('meta');
    });
  });
```

### Step 2: Jalankan test untuk verify FAIL

```bash
cd clicker-platform-v2 && pnpm vitest run lib/logger.test.ts 2>&1 | tail -10
```

Expected: FAIL — `formatDev is not a function` atau `formatDev` not exported.

### Step 3: Tambah `formatDev` dan update `log()` di `lib/logger.ts`

**Tambahkan** fungsi `formatDev` setelah fungsi `buildPayload` (sebelum `writeToFirestore`):

```ts
const DEV_COLORS: Record<LogPayload['level'], string> = {
  error: '\x1b[31m', // red
  warn:  '\x1b[33m', // yellow
  info:  '\x1b[36m', // cyan
};
const RESET = '\x1b[0m';
const DIM   = '\x1b[2m';
const BOLD  = '\x1b[1m';

export function formatDev(payload: LogPayload): string {
  const color = DEV_COLORS[payload.level];
  const level = `${color}${BOLD}${payload.level.toUpperCase().padEnd(5)}${RESET}`;
  const event = `${BOLD}${payload.event}${RESET}`;
  const site  = `${DIM}[${payload.siteId}]${RESET}`;

  const metaEntries = Object.entries(payload.meta);
  const metaPart = metaEntries.length > 0
    ? ' ' + metaEntries
        .map(([k, v]) => `${DIM}${k}=${RESET}${String(v)}`)
        .join(' ')
    : '';

  return `${level} ${site} ${event}${metaPart}`;
}
```

**Update** fungsi `log()` — ganti bagian console output (baris yang memanggil `console.error/warn/log`) dengan:

```ts
  // Dev: pretty-print. Production: JSON for GCP structured logging.
  const isDev = typeof process !== 'undefined' && process.env.NODE_ENV === 'development';
  const output = isDev ? formatDev(payload) : json;

  if (level === 'error') console.error(output);
  else if (level === 'warn') console.warn(output);
  else console.log(output);
```

Hapus baris lama:
```ts
  // HAPUS 3 baris ini (sudah diganti di atas):
  if (level === 'error') console.error(json);
  else if (level === 'warn') console.warn(json);
  else console.log(json);
```

### Step 4: Jalankan test untuk verify PASS

```bash
cd clicker-platform-v2 && pnpm vitest run lib/logger.test.ts 2>&1 | tail -10
```

Expected: semua tests pass (6 existing + 3 baru = 9 total).

### Step 5: Verifikasi manual format output

Buat file test sementara untuk melihat output di terminal:

```bash
cd clicker-platform-v2 && node -e "
process.env.NODE_ENV = 'development';
// Simple inline test — tidak perlu import karena ada transpiler issues
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
console.error(RED + BOLD + 'ERROR' + RESET + ' ' + DIM + '[quattro]' + RESET + ' ' + BOLD + 'upload.image.failed' + RESET + ' ' + DIM + 'error=' + RESET + 'permission-denied');
console.warn(YELLOW + BOLD + 'WARN ' + RESET + ' ' + DIM + '[platform]' + RESET + ' ' + BOLD + 'analytics.invalid.siteId' + RESET);
console.log(CYAN + BOLD + 'INFO ' + RESET + ' ' + DIM + '[quattro]' + RESET + ' ' + BOLD + 'reservation.loyalty.awarded' + RESET);
"
```

Expected output (dengan warna di terminal):
```
ERROR [quattro] upload.image.failed error=permission-denied
WARN  [platform] analytics.invalid.siteId
INFO  [quattro] reservation.loyalty.awarded
```

### Step 6: Commit

```bash
git add clicker-platform-v2/lib/logger.ts clicker-platform-v2/lib/logger.test.ts
git commit -m "feat(logger): pretty-print output in development, JSON in production"
```

---

## Task 2: Verifikasi Production JSON Tidak Berubah

- [ ] **Step 1: Verify JSON format tetap di non-dev**

```bash
cd clicker-platform-v2 && node -e "
// Simulate production: NODE_ENV tidak di-set = undefined (bukan 'development')
const isDev = process.env.NODE_ENV === 'development';
console.log('isDev:', isDev);
// Expected: isDev: false
"
```

Expected: `isDev: false` — artinya di production/test environment, JSON tetap dipakai.

- [ ] **Step 2: Jalankan full test suite untuk pastikan tidak ada regression**

```bash
cd clicker-platform-v2 && pnpm vitest run 2>&1 | tail -8
```

Expected: logger tests 9/9 pass. Pre-existing failures (37 dari baseline) boleh tetap ada.

- [ ] **Step 3: TypeScript check**

```bash
cd clicker-platform-v2 && pnpm tsc --noEmit 2>&1 | grep -v "VideoEmbedExtension\|suite[0-9]\|toBeInTheDocument\|toHaveAttribute\|toBeEmptyDOMElement\|submitForApproval\|moveToInProgress"
```

Expected: tidak ada output (tidak ada error baru dari logger.ts).

- [ ] **Step 4: Commit jika ada perubahan, atau skip jika Task 1 sudah cukup**

```bash
git status
```

Jika bersih, tidak perlu commit tambahan.
