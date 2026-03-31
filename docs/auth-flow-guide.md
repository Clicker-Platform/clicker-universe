# Auth Flow — Technical Guide

> Dokumentasi lengkap untuk sistem autentikasi multi-tenant Clicker Platform.

---

## Daftar Isi

1. [Gambaran Umum](#gambaran-umum)
2. [Komponen Utama](#komponen-utama)
3. [Alur Login Lengkap](#alur-login-lengkap)
4. [Alur Logout](#alur-logout)
5. [Cross-Origin Relay](#cross-origin-relay)
6. [Cookie & Session Management](#cookie--session-management)
7. [Token Lifecycle](#token-lifecycle)
8. [Middleware Routing](#middleware-routing)
9. [getUserSites — Resolving Tenant Access](#getusersites--resolving-tenant-access)
10. [claim-admin — POS Admin Utility](#claim-admin--pos-admin-utility)
11. [Security Considerations](#security-considerations)
12. [Troubleshooting](#troubleshooting)
13. [Firestore Index Requirements](#firestore-index-requirements)
14. [Known Issues & Fixes](#known-issues--fixes)

---

## Gambaran Umum

Clicker Platform menggunakan sistem **Federated Auth** berbasis Firebase dengan arsitektur multi-tenant subdomain. Auth tidak ditangani di satu domain, melainkan terdistribusi:

| Domain | Peran |
|--------|-------|
| `auth.clicker.id` | Auth Gateway — login form |
| `clicker.id` | Platform root — callback penerima token |
| `{siteId}.clicker.id` | Tenant subdomain — target akhir autentikasi |

**Masalah inti:** Firebase Auth menyimpan state di **IndexedDB per-origin**. Login di `auth.clicker.id` tidak otomatis share auth state ke `{siteId}.clicker.id`. Karena itu digunakan mekanisme **handoff token + cross-origin relay**.

---

## Komponen Utama

### 1. Auth Gateway (`main/auth-gateway/app/page.tsx`)

Login form dan entry point autentikasi. Bertanggung jawab:
- Menerima email + password
- Memanggil Cloud Function `generateHandoffToken`
- Meneruskan (redirect) ke callback dengan token

### 2. Auth Callback (`main/clicker-platform-v2/app/admin/auth/callback/page.tsx`)

Handler token satu kali. Bertanggung jawab:
- Menerima handoff token dari URL param
- Decode JWT untuk ekstrak `siteId`
- Relay ke subdomain yang tepat jika perlu
- `signInWithCustomToken` di origin yang benar
- Set `__session` cookie
- Redirect ke dashboard

### 3. Cloud Function — `generateHandoffToken` (`main/functions/src/index.ts`)

Firebase Callable Function. Bertanggung jawab:
- Validasi user sudah terautentikasi
- Ambil custom claims dari Firebase Auth (`siteId`, `role`)
- Generate `customToken` dengan claims tersebut
- Return token ke client

### 4. Middleware (`main/clicker-platform-v2/middleware.ts`)

Next.js Edge Middleware. Bertanggung jawab:
- Proteksi route `/admin/*` — cek `__session` cookie
- Multi-tenant routing (subdomain → path rewrite)
- Redirect unauthenticated ke auth gateway

### 5. `getUserSites` (`main/clicker-platform-v2/lib/admin-auth.ts`)

Firestore lookup. Bertanggung jawab:
- Cari sites di mana user adalah **owner** (`ownerId` atau `ownerEmail`)
- Cari sites di mana user adalah **staff** (collectionGroup `members`)
- Return array `UserSite[]`

---

## Alur Login Lengkap

```
┌─────────────────────────────────────────────────────────────────────┐
│                          LOGIN FLOW                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. User buka auth.clicker.id                                        │
│     └─ auth-gateway/app/page.tsx                                     │
│                                                                      │
│  2. Cek auto-login (onAuthStateChanged)                              │
│     ├─ User sudah login → performHandoff() [langsung]                │
│     └─ Belum login → tampil form                                     │
│                                                                      │
│  3. User input email + password → handleLogin()                      │
│     ├─ signInWithEmailAndPassword(auth, email, password)             │
│     └─ performHandoff() [dipanggil sekali — guard flag aktif]        │
│                                                                      │
│  4. performHandoff()                                                 │
│     ├─ generateHandoffToken() [Cloud Function]                       │
│     │   └─ admin.auth().createCustomToken(uid, claims)               │
│     ├─ Resolve platformUrl:                                          │
│     │   1. Dari ?redirect param (jika HTTP URL)                      │
│     │   2. Dari __tenant cookie                                      │
│     │   3. Fallback: clicker.id                                      │
│     └─ Redirect → {platformUrl}/admin/auth/callback?token=XXX        │
│                                                                      │
│  5. Callback handler (callback/page.tsx)                             │
│     ├─ Decode JWT → extract siteId                                   │
│     ├─ [Production] currentHost ≠ targetHost?                        │
│     │   └─ Relay → https://{siteId}.clicker.id/admin/auth/callback  │
│     ├─ signInWithCustomToken(auth, token) [+ 10s timeout]            │
│     ├─ getUserSites(uid, email) [+ 5s timeout]                       │
│     ├─ Set __session cookie [Domain=.clicker.id]                     │
│     └─ Redirect → /admin                                             │
│                                                                      │
│  6. Middleware cek __session                                          │
│     ├─ Ada → lanjut ke dashboard                                     │
│     └─ Tidak ada → redirect ke auth gateway                          │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Alur Logout

### Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          LOGOUT FLOW                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. User trigger logout dari dashboard                               │
│     └─ Redirect → auth.clicker.id/logout                            │
│                                                                      │
│  2. auth-gateway/app/logout/page.tsx (performLogout)                 │
│     ├─ signOut(auth)  ← clear Firebase Auth state di origin ini      │
│     ├─ Clear __session cookie (tanpa Domain) ← current origin only  │
│     ├─ [Production] Clear __session cookie (Domain=.clicker.id)      │
│     │   └─ Efektif di semua subdomain                                │
│     ├─ localStorage.clear()                                          │
│     └─ Redirect → / (halaman login)                                  │
│                                                                      │
│  3. auth-gateway/app/page.tsx                                        │
│     └─ onAuthStateChanged → user null → tampil form login            │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Catatan Penting

- **Firebase Auth IndexedDB** di subdomain tenant (`{siteId}.clicker.id`) **tidak** di-clear secara eksplisit saat logout dari auth gateway. Firebase Auth di origin subdomain akan expire secara natural atau ter-clear saat user login ulang dengan `signInWithCustomToken`.
- **`__session` cookie** yang di-clear dengan `Domain=.clicker.id` berlaku untuk semua subdomain — sehingga middleware akan redirect kembali ke login gateway meski Firebase Auth di subdomain masih ada.
- Jika `signOut()` gagal, ada fallback: `window.location.href = '/'` — menghindari stuck di halaman logout.

### Trigger Logout dari Dashboard

Logout harus diarahkan ke `auth.clicker.id/logout`, bukan memanggil `signOut()` langsung dari subdomain, agar cookie domain-level ter-clear dengan benar.

```typescript
// Dari dashboard tenant (bukan dari auth gateway):
window.location.href = `${process.env.NEXT_PUBLIC_AUTH_GATEWAY_URL}/logout`;
```

---

## Cross-Origin Relay

### Mengapa Diperlukan

Firebase Auth IndexedDB bersifat **per-origin**. Jika `signInWithCustomToken` dipanggil di `clicker.id`, maka:
- `clicker.id` → punya auth state ✓
- `{siteId}.clicker.id` → **tidak** punya auth state ✗

AdminGuard di subdomain tidak bisa "lihat" auth state dari origin lain.

### Mekanisme Relay

```
clicker.id/admin/auth/callback?token=XXX
    │
    ├─ Decode JWT → siteId = "quattro"
    ├─ targetHost = "quattro.clicker.id"
    ├─ currentHost = "clicker.id" ≠ targetHost
    │
    └─ Relay → https://quattro.clicker.id/admin/auth/callback?token=XXX
                    │
                    ├─ currentHost = "quattro.clicker.id" = targetHost ✓
                    ├─ signInWithCustomToken di origin yang benar
                    ├─ getUserSites → resolve sites
                    ├─ Set __session cookie (Domain=.clicker.id)
                    └─ Redirect → /admin
```

### Syarat Relay Berhasil

1. Token harus mengandung `claims.siteId` yang valid
2. DNS untuk `{siteId}.clicker.id` harus pointing ke Firebase Hosting
3. `NEXT_PUBLIC_BASE_DOMAIN` harus di-set ke `clicker.id`
4. `NEXT_PUBLIC_FIREBASE_PROJECT_ID` harus `clicker-universe`

---

## Cookie & Session Management

### `__session` Cookie

```
__session={siteId};
path=/;
max-age=2592000;     // 30 hari
SameSite=Lax;
Secure;              // Production only
Domain=.clicker.id   // Wildcard — semua subdomain bisa baca
```

**Penting:** `Domain=.clicker.id` (dengan dot prefix) membuat cookie readable oleh semua subdomain.

### `__tenant` Cookie

Digunakan di auth-gateway untuk remember subdomain terakhir saat performHandoff. Tidak di-set oleh callback.

### Clear Cookie (Manual)

```javascript
// Hapus session
document.cookie = '__session=; path=/; max-age=0; SameSite=Lax; Secure';
document.cookie = '__session=; path=/; max-age=0; Domain=.clicker.id; SameSite=Lax; Secure';

// Hapus tenant
document.cookie = '__tenant=; path=/; max-age=0; SameSite=Lax';
```

---

## Token Lifecycle

### Tipe Token dan Masa Berlaku

| Token | Dibuat di | Expire | Tujuan |
|-------|-----------|--------|--------|
| Firebase ID Token | Firebase Auth | **1 jam** | Autentikasi Firebase service (Firestore, dll) |
| Custom Token (Handoff) | `generateHandoffToken` Cloud Function | **1 jam** | Single-use — relay auth state antar origin |
| `__session` Cookie | callback/page.tsx | **30 hari** | Middleware guard — menandai user terautentikasi |

### Firebase ID Token Refresh

Firebase SDK secara **otomatis** me-refresh ID Token sebelum expire (tanpa interaksi user). Tidak diperlukan logika refresh manual.

```
Token expire setiap 1 jam
    ↓
Firebase SDK background refresh (auto)
    ↓
Token baru tersedia secara transparan
```

### Custom Token (Handoff) — Single-Use Behavior

Custom token yang dibuat oleh `generateHandoffToken` bersifat **single-use secara praktis** karena:
1. Setelah `signInWithCustomToken` berhasil, token tidak bisa dipakai untuk sign in ulang (Firebase akan reject token yang sudah dipakai di session yang sama).
2. URL dibersihkan segera setelah token diterima:

```typescript
// callback/page.tsx — URL dibersihkan sebelum signIn
window.history.replaceState(null, '', window.location.pathname);
```

> **Penting:** Custom token tetap valid secara kriptografis selama 1 jam. Jika token bocor dari URL sebelum URL dibersihkan, token tersebut bisa dipakai oleh pihak lain. Mitigasi: URL di-clean segera di langkah pertama callback.

### `__session` Cookie Expiry

Cookie expire setelah **30 hari**. Tidak ada refresh otomatis untuk cookie ini. Setelah expire:
- Middleware akan mendeteksi tidak ada `__session`
- User di-redirect ke auth gateway untuk login ulang
- Flow login normal akan men-generate `__session` baru

---

## Middleware Routing

### Route Protection

```typescript
// Protected routes (require __session):
/admin/*

// Exempt routes (no auth check):
/admin/auth/callback
/admin/auth/claim-admin
```

### Multi-Tenant Path Rewrite

Di production dengan subdomain custom, middleware merewrite path:

```
Request:  quattro.clicker.id/admin/dashboard
Rewrites: clicker.id/quattro/admin/dashboard (internal)
Headers:  x-site-id: quattro
          x-tenant-slug: quattro
```

### Environment Variables Required

| Variable | Value | Keterangan |
|----------|-------|------------|
| `NEXT_PUBLIC_BASE_DOMAIN` | `clicker.id` | Domain utama platform |
| `NEXT_PUBLIC_AUTH_GATEWAY_URL` | `https://auth.clicker.id` | URL auth gateway |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `clicker-universe` | Firebase project ID |

---

## getUserSites — Resolving Tenant Access

### Strategi Lookup (Berurutan)

```
1. Owner by UID
   sites WHERE ownerId == userId

2. Owner by Email
   sites WHERE ownerEmail == email

3. Staff via collectionGroup
   collectionGroup('members') WHERE email == email
   → fetch parent site document untuk metadata
```

### Fallback Jika getUserSites Gagal

Jika `getUserSites` timeout (>5s) atau throw error, callback fallback ke **custom token claims**:

```typescript
const claims = (await user.getIdTokenResult()).claims;
if (claims.siteId) {
    sites = [{
        siteId: claims.siteId,
        slug: claims.siteId,
        role: claims.role || 'owner',
        name: 'My Site'
    }];
}
```

**Catatan:** Fallback ini hanya bekerja jika user memiliki `siteId` di custom claims Firebase Auth.

---

## claim-admin — POS Admin Utility

**File:** `main/clicker-platform-v2/app/admin/claim-admin/page.tsx`

### Fungsi

Halaman utilitas untuk menambahkan user yang sudah terautentikasi ke daftar admin modul POS (`modules/byod_pos/admins/{uid}`). Digunakan untuk menyelesaikan error permission pada modul kasir.

### Mengapa Exempt dari Auth Middleware

Route `/admin/claim-admin` **tidak memerlukan `__session` cookie** dan dikecualikan dari middleware redirect:

```typescript
// middleware.ts
if (!activeSite && !pathname.startsWith('/admin/auth/callback') && !pathname.startsWith('/admin/claim-admin')) {
    // redirect ke auth gateway
}
```

**Alasan:** User mungkin sudah Firebase-authenticated (punya akun) tapi belum punya `__session` cookie yang valid. Halaman ini perlu diakses untuk men-grant akses tanpa masuk ke loop redirect.

### Cara Kerja

```
1. User buka /admin/claim-admin
2. onAuthStateChanged → cek apakah user sudah login Firebase
3. checkExistingStatus(uid)
   └─ getDoc('modules/byod_pos/admins/{uid}')
   ├─ Exists → tampil "Already an admin"
   └─ Tidak ada → tampil tombol "Grant Admin Access"
4. handleClaim()
   └─ setDoc('modules/byod_pos/admins/{uid}', { email, role: 'admin', grantedAt })
      └─ Diizinkan oleh Firestore Rules: request.auth.uid == docId
5. Sukses → tombol "Go to Cashier" → /admin/pos/cashier
```

### Kapan Digunakan

- User baru yang diinvite sebagai staff kasir tapi belum ada di koleksi `admins`
- Troubleshoot error permission `PERMISSION_DENIED` di modul POS
- Setup awal sebelum admin manual ditambahkan melalui dashboard

---

## Security Considerations

### Token di URL Parameter

Custom token dikirim via URL query param `?token=XXX`. Ini berisiko jika:
- Browser history menyimpan URL dengan token
- Server log mencatat URL

**Mitigasi yang sudah diimplementasikan:**
```typescript
// callback/page.tsx — URL dibersihkan SEBELUM sign in
window.history.replaceState(null, '', window.location.pathname);
```
URL dibersihkan di langkah pertama callback, sebelum operasi async `signInWithCustomToken` dimulai.

### `SameSite=Lax` untuk Cookie

`__session` menggunakan `SameSite=Lax`, bukan `Strict`. Ini **disengaja** agar:
- Redirect cross-site dari auth gateway ke tenant subdomain tetap membawa cookie
- Flow: `auth.clicker.id` → `{siteId}.clicker.id/admin` berfungsi tanpa friction

`SameSite=Strict` akan memblokir cookie saat redirect dari domain berbeda, sehingga login selalu gagal di redirect pertama.

### Cookie `Secure` Flag — Dev vs Production

```typescript
// callback/page.tsx
const isProduction = !!baseDomain &&
    projectId === 'clicker-universe' &&
    window.location.hostname.includes(baseDomain) &&
    !window.location.hostname.includes('web.app');

const secureAttribute = isProduction ? '; Secure' : '';
```

Di **localhost/development**: `Secure` flag tidak di-set — cookie bisa dibaca di HTTP. Ini diperlukan agar development berjalan tanpa HTTPS.

Di **production** (`clicker-universe` project, non `.web.app`): `Secure` flag aktif — cookie hanya dikirim via HTTPS.

### JWT Decode di Client — Tanpa Verifikasi

```typescript
// callback/page.tsx
function decodeJwtPayload(token: string): any {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
}
```

Decode dilakukan **tanpa verifikasi signature** — hanya untuk membaca `claims.siteId` guna menentukan relay target. Verifikasi kriptografis terjadi saat `signInWithCustomToken` dipanggil (di Firebase Auth server). Jangan gunakan data dari decode ini untuk keputusan keamanan — hanya untuk routing.

### Subdomain Isolation

Setiap tenant subdomain (`{siteId}.clicker.id`) memiliki **Firebase Auth IndexedDB terpisah**. Ini berarti:
- User yang login di `quattro.clicker.id` tidak bisa mengakses auth state `lima.clicker.id`
- Session isolation antar tenant terjamin secara browser level
- `__session` cookie dengan `Domain=.clicker.id` hanya menyimpan `siteId` — bukan Firebase token

---

## Troubleshooting

### Stuck di "Processing login..." / "Memverifikasi token..."

**Kemungkinan sebab:**

| Penyebab | Cara Diagnosa | Solusi |
|----------|---------------|--------|
| Token tanpa `siteId` claims | DevTools Console → lihat `[Auth Callback]` logs | Set custom claims di Firebase Console → Auth → User |
| Firestore index missing | Console → Firebase error `FAILED_PRECONDITION` | Buat composite index (lihat bagian Firestore Index) |
| Firebase Auth timeout | Console → `Koneksi timeout (10s)` | Cek koneksi, coba lagi |
| Double token generation | Network tab → 2x `generateHandoffToken` | Fixed via `handoffInProgress` guard |

### Redirect Loop (Callback ↔ Auth Gateway)

**Kemungkinan sebab:**
1. `__session` cookie tidak ter-set (cek Application → Cookies)
2. Relay ke subdomain yang tidak exist (DNS tidak terdaftar)
3. Middleware redirect sebelum cookie propagate

**Solusi:**
1. Buka DevTools → Application → Storage → Clear site data
2. Coba login ulang di Incognito window
3. Verifikasi DNS subdomain di Cloudflare

### Error "Tidak ditemukan keanggotaan situs"

**Kemungkinan sebab:**
1. User tidak punya `siteId` di custom claims
2. Firestore collectionGroup index belum dibuat
3. Email user tidak match dengan data di Firestore

**Cara cek custom claims:**
```javascript
// Di browser console setelah login:
firebase.auth().currentUser.getIdTokenResult().then(r => console.log(r.claims))
```

### Clear Cache Saat Stuck

**Step by step:**

1. **Hard refresh:** `Cmd+Shift+R` (Mac) / `Ctrl+Shift+R` (Windows)

2. **Clear cookies + IndexedDB:**
   ```
   DevTools → Application → Storage → Clear site data
   Centang: Cookies ✓ + IndexedDB ✓ + Local Storage ✓
   ```

3. **Hapus IndexedDB manual:**
   ```
   DevTools → Application → IndexedDB
   → firebaseLocalStorageDb → firebaseLocalStorage
   → Hapus entry: firebase:authUser:{apiKey}:{projectId}
   ```

4. **Clear .next cache (development only):**
   ```bash
   cd main/clicker-platform-v2
   rm -rf .next
   npm run dev
   ```

5. **Nuclear (jika semua gagal):**
   - Buka Incognito window
   - Coba login dari awal

---

## Firestore Index Requirements

### Required Indexes

| Collection Group | Field | Type | Scope |
|-----------------|-------|------|-------|
| `members` | `email` | Ascending | Collection group |

### Cara Membuat Index

1. Buka [Firebase Console](https://console.firebase.google.com) → pilih project `clicker-universe`
2. Firestore Database → **Indexes** → tab **Composite**
3. Klik **Add Index**
4. Isi:
   - Collection group: `members`
   - Fields: `email` (Ascending)
   - Query scope: **Collection group**
5. Klik **Create index** → tunggu status `Enabled`

### Verifikasi Index

```javascript
// Test di browser console setelah login:
import { collectionGroup, query, where, getDocs } from 'firebase/firestore';

const q = query(collectionGroup(db, 'members'), where('email', '==', 'user@example.com'));
getDocs(q).then(snap => console.log('Found:', snap.size, 'memberships'));
```

---

## Known Issues & Fixes

### Fix 1: Double `performHandoff` Race Condition (Fixed)

**Masalah:** `onAuthStateChanged` dan `handleLogin` keduanya memanggil `performHandoff()` hampir bersamaan setelah `signInWithEmailAndPassword`. Menghasilkan 2 token — salah satu invalid.

**Fix (auth-gateway/app/page.tsx):**
```typescript
const handoffInProgress = useRef(false);

const performHandoff = async () => {
  if (handoffInProgress.current) return; // Guard
  handoffInProgress.current = true;
  try {
    // ... handoff logic
  } finally {
    handoffInProgress.current = false;
  }
};
```

### Fix 2: signInWithCustomToken Tanpa Timeout (Fixed)

**Masalah:** Jika Firebase Auth service lambat, callback hang selamanya di status "Menghubungkan akun...".

**Fix (callback/page.tsx):**
```typescript
const userCredential = await Promise.race([
    signInWithCustomToken(auth, token),
    new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Koneksi timeout (10s). Silakan coba login kembali.')), 10000)
    )
]);
```

### Fix 3: signOut Race Condition Setelah Error (Fixed)

**Masalah:** URL error param di-clear sebelum `signOut()` selesai, menyebabkan `onAuthStateChanged` re-trigger dan auto-handoff lagi.

**Fix (auth-gateway/app/page.tsx):**
- URL cleanup dipindah ke atas (sync) — sebelum `signOut()` dipanggil
- Cookie clearing tetap di dalam `.then()` setelah `signOut` selesai

---

*Dibuat: 2026-03-31 | Diperbarui: 2026-03-31 | Auth System v2 | clicker-universe/main*
