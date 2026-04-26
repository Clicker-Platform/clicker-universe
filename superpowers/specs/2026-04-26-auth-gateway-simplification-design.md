# Auth Gateway Simplification Design

**Date:** 2026-04-26  
**Status:** Awaiting review  
**Related:**
- `Docs/TEAM_SIMPLIFICATION_PLAN.md`
- `Docs/AUTH_RBAC_REVIEW_2026-04-26.md`

---

## Problem Statement

Auth-gateway sekarang punya flow 7 langkah dengan dua masalah utama:

1. **Callback page terlihat oleh user** — user melihat loading spinner di `/admin/auth/callback` sebelum masuk dashboard. Ini terjadi karena `signInWithCustomToken` adalah operasi client-side async yang tidak bisa dilakukan di server.

2. **Terlalu banyak fallback path** — `resolvePlatformUrl` punya 4 cara untuk menemukan `siteId` karena gateway tidak punya sumber kebenaran tunggal. Ini menyebabkan kompleksitas yang tidak perlu dan potensi bug saat fallback chain berubah.

**Flow sekarang (7 langkah, ~3-4 detik terasa oleh user):**
```
gateway: signInWithEmailAndPassword
       → generateHandoffToken (CF cold start ~1-2s)
       → resolvePlatformUrl (4 fallback path)
       → redirect ke slug.clicker.id/admin/auth/callback#token=
callback: decodeJwtPayload (baca siteId dari JWT claims)
        → relay ke subdomain yang benar jika origin salah
        → signInWithCustomToken
        → getUserSites
        → set __session cookie
        → redirect ke /admin
```

---

## Keputusan Desain: Opsi B+ (Silent Login)

### Prinsip

- `getUserSites` adalah **satu-satunya source of truth** untuk "user ini milik tenant mana"
- Gateway harus tahu tujuan redirect **sebelum** mengirim user ke platform
- User tidak perlu melihat halaman perantara (callback page)
- Firebase Auth state di client (IndexedDB) **tetap dipertahankan** karena banyak komponen platform bergantung pada `auth.currentUser.getIdToken()` untuk Bearer token di API calls

### Kenapa Opsi C (session cookie) tidak dipilih

`auth.currentUser` dipakai luas di platform:
- `lib/admin/purgeCache.ts` — `auth.currentUser.getIdToken()`
- `lib/modules/inventory/api.ts` — `auth.currentUser.getIdToken()`
- `lib/modules/ai-marketing/**` — 11 titik `auth.currentUser?.getIdToken()`
- `lib/modules/byod_pos/components/POSWidget.tsx` — `auth.currentUser?.uid`

Menghapus Firebase Auth state di client membutuhkan audit dan refactor semua titik ini — di luar scope simplifikasi ini.

---

## Flow Baru (5 langkah, ~2 detik, callback tidak terlihat)

```
GATEWAY:
  1. signInWithEmailAndPassword (Firebase Auth)
  2. getUserSites(uid, email)   → dapat siteSlug langsung dari Firestore
  3. generateHandoffToken(uid)  → custom token (tanpa claims)
  4. set __session=siteId cookie (Domain=.clicker.id)
  5. redirect → https://slug.clicker.id/admin#token=xyz

PLATFORM (background, user tidak melihat):
  middleware: ada __session cookie → lolos ke /admin
  AdminGuard: ada #token di URL fragment
            → signInWithCustomToken (background)
            → hapus fragment dari URL
            → user sudah di dashboard
```

---

## Perubahan Per File

### 1. `auth-gateway/app/page.tsx`

**Dihapus:**
- `resolvePlatformUrl` import dan usage
- `__tenant` cookie read/write
- Loop detection (`handoff_loop_count` di sessionStorage)
- `handoffInProgress` ref guard (tidak perlu karena flow linear)

**Diubah:**
- `performHandoff` menjadi linear: `getUserSites` → token → set cookie → redirect
- Redirect target: `https://${site.slug}.${baseDomain}/admin#token=${token}` langsung ke `/admin`, bukan `/admin/auth/callback`
- Error handling: jika `getUserSites` return empty → redirect ke gateway dengan `?error=no_membership`

**Estimasi:** 231 baris → ~100 baris

---

### 2. `auth-gateway/lib/resolve-platform-url.ts`

**Dihapus total.** Fungsinya digantikan oleh `getUserSites` di `page.tsx`.

---

### 3. `functions/src/index.ts` — `generateHandoffToken`

**Diubah:** Hapus `getUser(uid)` dan `claims` passthrough. Token dibuat tanpa custom claims.

```typescript
// SEBELUM (~30 baris):
const userRecord = await admin.auth().getUser(uid);
const claims = userRecord.customClaims || {};
const customToken = await admin.auth().createCustomToken(uid, claims);

// SESUDAH (~8 baris):
const customToken = await admin.auth().createCustomToken(uid);
return { token: customToken };
```

**Alasan:** Custom claims (`siteId`, `role`) tidak diperlukan di dalam token karena:
- Gateway sudah set `__session` cookie sebelum redirect
- Platform resolve role dari Firestore (`getUserSites`), bukan dari JWT claims
- Menghapus claims dari token menghilangkan `getUser` call (satu round-trip ke Firebase Auth berkurang)

---

### 4. `clicker-platform-v2/app/admin/(dashboard)/layout.tsx` — Token Bootstrap

**Kenapa layout, bukan AdminGuard:**

`AdminGuard` membaca state dari `UserProvider` (`useUser()`). `UserProvider` menunggu `onAuthStateChanged` resolve. Jika token di-process di AdminGuard, ada race: `UserProvider` resolve dulu dengan `null` → AdminGuard redirect ke gateway sebelum token sempat diproses.

Token harus di-process **di layout, sebelum UserProvider render children** — atau di komponen wrapper paling atas yang mount sebelum AdminGuard.

**Pendekatan:** Tambah `TokenBootstrap` client component di layout admin, mount sebelum `AdminGuard`.

```typescript
// components/admin/TokenBootstrap.tsx  (komponen baru, ~25 baris)
'use client';
export function TokenBootstrap() {
  useEffect(() => {
    const token = new URLSearchParams(window.location.hash.slice(1)).get('token');
    if (!token) return;
    // Hapus dari URL segera
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    // signInWithCustomToken — UserProvider onAuthStateChanged akan fire setelah ini
    signInWithCustomToken(auth, token).catch(() => {
      window.location.href = process.env.NEXT_PUBLIC_AUTH_GATEWAY_URL + '?error=auth_failed';
    });
  }, []);
  return null;
}
```

Layout render order:
```
layout.tsx
  <TokenBootstrap />   ← proses token dari fragment, fire onAuthStateChanged
  <UserProvider>       ← onAuthStateChanged sudah ada user
    <AdminGuard>       ← user tidak null, lolos
      {children}
    </AdminGuard>
  </UserProvider>
```

**Estimasi:** komponen baru ~25 baris, perubahan layout ~3 baris

---

### 5. `clicker-platform-v2/app/admin/auth/callback/page.tsx`

**Dihapus total.** Fungsinya dipindah ke AdminGuard.

**Catatan backward compatibility:** Middleware sudah skip auth check untuk `/admin/auth/callback`. Setelah file ini dihapus, baris skip di middleware juga dihapus.

---

### 6. `clicker-platform-v2/middleware.ts`

**Diubah (minor):** Hapus pengecualian `/admin/auth/callback` dari auth check.

```typescript
// SEBELUM:
if (!activeSite && !pathname.startsWith('/admin/auth/callback') && !pathname.startsWith('/admin/claim-admin')) {

// SESUDAH:
if (!activeSite && !pathname.startsWith('/admin/claim-admin')) {
```

---

## Data Model: Tidak Ada Perubahan

`getUserSites` di gateway menggunakan Firebase **client SDK** (bukan admin SDK) dengan akun yang sudah sign in via `signInWithEmailAndPassword`. Query ini aman karena Firestore rules sudah mengizinkan owner dan member membaca site mereka sendiri.

Cookie `__session` tetap menyimpan `siteId` (bukan slug) sesuai konvensi yang sudah ada di middleware.

---

## Keterkaitan dengan TEAM_SIMPLIFICATION_PLAN

Simplifikasi auth-gateway ini **konsisten dan mendukung** Team Simplification:

| Aspek | Team Simplification | Auth Gateway |
|-------|--------------------|-----------__|
| Source of truth role | Firestore `members/{uid}.role` | `getUserSites` query Firestore |
| Custom claims | Tidak dipakai untuk RBAC | Dihapus dari token |
| siteId resolution | Dari `sites/{siteId}.ownerId` | `getUserSites` — sama |
| Binary role (Owner/Staff) | Hardcoded `'staff'` di member doc | Gateway tidak perlu tahu role |

Gateway tidak perlu tahu role user sama sekali — tugasnya hanya: verifikasi identity, temukan tenant, buat token, redirect. RBAC sepenuhnya di platform.

---

## Keterkaitan dengan AUTH_RBAC_REVIEW

Simplifikasi ini **tidak menyelesaikan** P0 security findings (missing auth di API routes) — itu tetap pekerjaan terpisah. Tapi design ini **tidak memperburuk** postur keamanan:

- Token tetap di URL fragment (tidak masuk server log, tidak masuk referrer header)
- `decodeJwtPayload` tanpa verify dihapus — attack surface berkurang
- Custom claims dihapus dari token — tidak ada lagi `siteId` di JWT yang bisa di-forge untuk relay

---

## Ringkasan Perubahan

| File | Sebelum | Sesudah | Delta |
|------|---------|---------|-------|
| `auth-gateway/app/page.tsx` | 231 baris | ~100 baris | −131 |
| `auth-gateway/lib/resolve-platform-url.ts` | 51 baris | **DIHAPUS** | −51 |
| `functions/src/index.ts` (generateHandoffToken) | ~30 baris | ~8 baris | −22 |
| `platform/app/admin/auth/callback/page.tsx` | 276 baris | **DIHAPUS** | −276 |
| `platform/components/admin/TokenBootstrap.tsx` | tidak ada | ~25 baris (BARU) | +25 |
| `platform/app/admin/(dashboard)/layout.tsx` | existing | +~3 baris | +3 |
| `platform/middleware.ts` | existing | −1 baris | −1 |
| **Total** | **~618 baris** | **~156 baris** | **−462 baris** |

**Login flow:** 7 langkah → 5 langkah  
**Waktu terasa oleh user:** ~3-4 detik → ~2 detik  
**Callback page:** Terlihat → **Tidak ada**

---

## Validasi Checklist (sebelum merge)

1. **Owner login** — masuk ke `slug.clicker.id/admin`, tidak melalui callback page, Firebase Auth state tersedia
2. **Staff login** — sama seperti owner, akses terbatas sesuai `permissions[]`
3. **Token expired/invalid** — AdminGuard redirect ke gateway dengan graceful, tidak loop
4. **No membership** — gateway menampilkan error `no_membership`, tidak crash
5. **Localhost dev** — flow tetap bekerja dengan `localhost:3000`
6. **`auth.currentUser.getIdToken()`** — tersedia setelah AdminGuard process token, tidak ada race condition di komponen yang membutuhkan Bearer token
7. **Existing `__session` cookie** — user yang sudah login tidak di-force re-handoff

---

## Open Questions

Tidak ada — scope dan approach sudah settled.
