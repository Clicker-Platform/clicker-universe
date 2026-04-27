# Changelog: Auth Gateway Simplification
**Branch:** `dev` | **Period:** 2026-04-26 – 2026-04-27

---

## Ringkasan

Refactor besar auth-gateway dari flow 7-step dengan callback page yang terlihat user, menjadi **Opsi B+ Silent Handoff** — login langsung ke dashboard tanpa halaman perantara.

**Net result:**
- −462 baris kode (hapus callback page 276 baris, resolve-platform-url 51 baris, dll)
- Eliminasi Cloud Function cold start (~2-3s) → ganti API route lokal
- Loop redirect lokal diperbaiki
- Status teknis tidak terlihat user

---

## Perubahan per Commit

### `8578e52` — feat(auth): simplify login flow — silent handoff, no callback page
**Perubahan utama (Opsi B+):**

| File | Action | Keterangan |
|------|--------|------------|
| `auth-gateway/app/page.tsx` | Rewrite | Hapus resolvePlatformUrl, loop detection, __tenant cookie |
| `auth-gateway/lib/get-user-sites.ts` | New | Single source of truth untuk resolve tenant |
| `auth-gateway/lib/resolve-platform-url.ts` | Deleted | Digantikan get-user-sites |
| `clicker-platform-v2/components/admin/TokenBootstrap.tsx` | New | Process token dari gateway di background |
| `clicker-platform-v2/app/admin/(dashboard)/layout.tsx` | Edit | Tambah `<TokenBootstrap />` sebelum UserProvider |
| `clicker-platform-v2/app/admin/auth/callback/page.tsx` | Deleted | User tidak pernah lihat callback page lagi |
| `clicker-platform-v2/middleware.ts` | Edit | Hapus dua referensi `/admin/auth/callback` |
| `functions/src/index.ts` | Edit | Slim generateHandoffToken — hapus getUser() round-trip |

**Flow baru:**
```
Gateway → redirect: /admin#token=xxx&siteId=yyy
Platform: TokenBootstrap proses token di background
          → dashboard langsung tanpa callback page
```

---

### `8c052ac` — fix(auth-gateway): remove dead typeof window check
- `auth-gateway/app/page.tsx`: Hapus `typeof window !== 'undefined'` guard di client component (`'use client'` sudah guarantee browser environment)

---

### `e5829fb` — style(auth-gateway): use canonical Tailwind classes
- `border-[2px]` → `border-2`
- `hover:translate-x-[2px]` → `hover:translate-x-0.5`
- `hover:translate-y-[2px]` → `hover:translate-y-0.5`

---

### `bb5e0e1` — perf(auth): eliminate CF cold start — token via gateway API route, parallel fetch
**Masalah:** `generateHandoffToken` Cloud Function cold start 2-3 detik setiap login.

**Solusi:**

| File | Action | Keterangan |
|------|--------|------------|
| `auth-gateway/app/api/token/route.ts` | New | API route lokal, Firebase Admin `createCustomToken` |
| `auth-gateway/lib/firebase-admin.ts` | New | Init Firebase Admin dengan service account |
| `auth-gateway/app/page.tsx` | Edit | Ganti `httpsCallable` → `fetch('/api/token')` |
| `auth-gateway/app/page.tsx` | Edit | `getUserSites` + `/api/token` → `Promise.all` (parallel) |

**Penghematan:** ~2-3s CF cold start + ~500ms dari parallelisasi.

---

### `39dadeb` — perf(cache): add in-process memory cache (REVERTED)
- Tambah memory cache di `lib/cache/redis.ts`
- **Di-rollback** di commit `d1b8910` — cache tidak sesuai untuk admin dashboard (data harus fresh)

---

### `fa202d5` — perf(admin): skip Upstash/Firestore fetch for admin routes (REVERTED)
- Root layout skip `fetchSiteSettings` untuk admin routes via `x-is-admin` header
- **Di-rollback** di commit `d1b8910` — perlu approval lebih lanjut, ThemeRegistry masih dipakai admin

---

### `d1b8910` — revert(admin): rollback layout + middleware changes
- Rollback `fa202d5` dan `39dadeb`
- `middleware.ts` dan `app/layout.tsx` dikembalikan ke state sebelumnya

---

### `bb5e0e1` (lanjutan) — fix: localhost loop redirect
**Masalah:** Loop antara `localhost:3000/admin` ↔ `localhost:3012` karena:
1. `__session` cookie di-set di gateway (port 3012) tidak terbaca platform (port 3000)
2. `onAuthStateChanged(null)` fire sebelum `signInWithCustomToken` selesai (race condition)
3. `siteId = 'platform'` dari middleware karena cookie belum ada di first request

**Solusi multi-layer:**

| File | Fix |
|------|-----|
| `auth-gateway/app/page.tsx` | Sertakan `siteId` di hash redirect: `#token=xxx&siteId=yyy` |
| `clicker-platform-v2/components/admin/TokenBootstrap.tsx` | Set `__session` cookie di platform origin + `setSiteId()` langsung |
| `clicker-platform-v2/lib/site-context.tsx` | Tambah `setSiteId()` — client-side override tanpa page reload |
| `clicker-platform-v2/lib/user-context.tsx` | Guard `sessionStorage.__token_bootstrapping` — tahan loading sampai token selesai |
| `clicker-platform-v2/middleware.ts` | Skip `__session` gate saat `isLocal` (localhost) |
| `.env.development.local` (gateway & platform) | Fix port: `3010` → `3012` |
| `.env.development.local` (gateway) | Fix path: `GCP_SERVICE_ACCOUNT_KEY` → `../scripts/...` |

---

### `d2da465` — ux(auth-gateway): remove technical status messages, parallelize owner queries
**UX:**
- Hapus `status` state machine (Mencari akses tenant, Membuat token akses, Mengalihkan ke dashboard)
- Loading screen: spinner + satu teks tetap *"Mempersiapkan dashboard..."*

**Performance:**
- `get-user-sites.ts`: query `ownerId` + `ownerEmail` sekarang parallel (`Promise.all`)
- Staff member query hanya jalan jika bukan owner (guard lebih jelas)
- Hemat ~200ms untuk user dengan email-based ownership

---

## File Baru (Net)

| File | Keterangan |
|------|------------|
| `auth-gateway/app/api/token/route.ts` | POST endpoint — buat custom token via Firebase Admin |
| `auth-gateway/lib/firebase-admin.ts` | Firebase Admin SDK init (service account / ADC) |
| `auth-gateway/lib/get-user-sites.ts` | Resolve tenant dari Firestore (3-level fallback) |
| `clicker-platform-v2/components/admin/TokenBootstrap.tsx` | Handle token dari gateway, set cookie + siteId |

## File Dihapus (Net)

| File | Keterangan |
|------|------------|
| `auth-gateway/lib/resolve-platform-url.ts` | Digantikan get-user-sites |
| `clicker-platform-v2/app/admin/auth/callback/` | Seluruh direktori — callback page tidak diperlukan |

## File Dimodifikasi (Signifikan)

| File | Perubahan |
|------|-----------|
| `auth-gateway/app/page.tsx` | Rewrite: hapus CF call, parallel fetch, hapus status messages |
| `clicker-platform-v2/lib/site-context.tsx` | Tambah `setSiteId()` — mutable site context |
| `clicker-platform-v2/lib/user-context.tsx` | Guard bootstrapping flag |
| `clicker-platform-v2/middleware.ts` | isLocal exception + hapus callback refs |
| `functions/src/index.ts` | Slim generateHandoffToken (masih ada tapi tidak dipakai) |

---

## Pending / Tidak Diimplementasi

- **Admin render speed** — `fetchSiteSettings` (Upstash) masih jalan untuk semua route termasuk admin. Solusi (skip untuk admin routes) di-rollback karena perlu diskusi lebih lanjut tentang ThemeRegistry dependency.
- **generateHandoffToken CF** — masih ada di `functions/src/index.ts` tapi tidak dipakai. Bisa dihapus saat deploy functions berikutnya.
- **Firebase Session Cookie** — opsi lebih cepat (eliminasi `signInWithCustomToken` di client) — masuk roadmap, belum diimplementasi.
