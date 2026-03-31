# Auth Gateway — Diagnosis: Stuck di "Processing login..."

**Tanggal:** 2026-03-31
**Symptom:** User stuck di `clicker.id/admin/auth/callback?token=...` dengan status "Processing login..." tidak berubah.

---

## Auth Flow Overview

```
auth.clicker.id (auth-gateway)
    ↓ signInWithEmailAndPassword
    ↓ generateHandoffToken() [Cloud Function]
    ↓ redirect → clicker.id/admin/auth/callback?token=XXX
        ↓ decodeJwt → extract siteId
        ↓ [relay] → {siteId}.clicker.id/admin/auth/callback?token=XXX
        ↓ signInWithCustomToken
        ↓ getUserSites()
        ↓ set __session cookie
        ↓ redirect → /admin
            ↓ middleware checks __session
            ↓ dashboard
```

---

## Root Causes Teridentifikasi

### 🔴 RC-1: Double `performHandoff` — Race Condition (HIGH)

**File:** `main/auth-gateway/app/page.tsx`

```typescript
// handleLogin():
await signInWithEmailAndPassword(auth, email, password);
setIsChecking(true);
await performHandoff(); // ← Call #2

// Tapi JUGA, onAuthStateChanged listener fire setelah signIn:
auth.onAuthStateChanged(async (user) => {
    if (user) await performHandoff(); // ← Call #1 (hampir bersamaan)
});
```

**Dampak:** Dua custom token di-generate hampir bersamaan. Firebase custom token bersifat one-time-use — token pertama di-consume oleh satu `signInWithCustomToken`, yang kedua menjadi invalid dan throw `auth/invalid-custom-token` di callback. User stuck atau melihat error.

**Fix:** Tambah flag guard agar `performHandoff` hanya dipanggil sekali:

```typescript
const handoffInProgress = useRef(false);

const safePerformHandoff = async () => {
  if (handoffInProgress.current) return;
  handoffInProgress.current = true;
  await performHandoff();
};

// Ganti semua performHandoff() → safePerformHandoff()
```

---

### 🔴 RC-2: Firestore collectionGroup Index Belum Dibuat (HIGH)

**File:** `main/clicker-platform-v2/lib/admin-auth.ts`

```typescript
const membersQuery = query(
    collectionGroup(db, 'members'),
    where('email', '==', email)
);
const memberSnap = await getDocs(membersQuery); // ← Butuh Composite Index!
```

**Dampak:** Jika Composite Index belum ada di Firebase Console, query throw error → di-catch → `sites = []`. Untuk user yang hanya staff (bukan owner), tidak ada situs yang ditemukan → callback tampil error "Tidak ditemukan keanggotaan situs."

**Fix (Manual — Firebase Console):**
1. Buka Firebase Console → Firestore → Indexes → tab **Collection group**
2. Klik **Add Index**
3. Collection group: `members`
4. Field: `email` → Mode: Ascending
5. Query scope: Collection group
6. Klik **Create**

---

### 🔴 RC-3: Token Claims Kosong — siteId Undefined (HIGH)

**File:** `main/functions/src/index.ts`

```typescript
const userRecord = await admin.auth().getUser(uid);
const claims = userRecord.customClaims || {};
const customToken = await admin.auth().createCustomToken(uid, claims);
```

**Dampak:** Jika user belum pernah di-assign custom claims `siteId` (misalnya akun baru atau akun yang belum di-setup), token dibuat tanpa `siteId`. Di callback:
- Relay logic skip (tidak tahu ke subdomain mana)
- Fallback `claims.siteId` juga kosong
- `sites = []` → error

**Cara cek:** Di Firebase Console → Authentication → pilih user → lihat Custom Claims. Harus ada `{"siteId": "xxx", "role": "owner"}`.

---

### 🟡 RC-4: Auto-Handoff Loop Setelah Error (MEDIUM)

**File:** `main/auth-gateway/app/page.tsx`

Ketika callback redirect balik ke auth-gateway dengan `?error=no_membership`:
1. `auth.signOut()` dipanggil (async)
2. URL param di-clear (sync — sebelum signOut selesai)
3. `onAuthStateChanged` bisa fire sebelum signOut complete
4. Jika Firebase masih consider user sebagai logged-in → auto-handoff lagi → loop

**Fix:** Tunggu `signOut()` selesai sebelum check auth state lagi.

---

### 🟡 RC-5: Middleware Redirect Loop (MEDIUM)

**File:** `main/clicker-platform-v2/middleware.ts`

Race condition antara:
- Callback set `__session` cookie → redirect ke `/admin`
- Middleware check cookie di request baru → jika cookie belum propagate → redirect ke auth-gateway
- Auth-gateway auto-handoff → balik ke callback → **loop**

**Symptom tambahan:** User terlihat flash antara halaman callback dan auth-gateway secara berulang.

---

### 🟡 RC-6: `signInWithCustomToken` Tanpa Timeout (MEDIUM)

**File:** `main/clicker-platform-v2/app/admin/auth/callback/page.tsx`

```typescript
// Tidak ada timeout!
const userCredential = await signInWithCustomToken(auth, token);
```

Jika Firebase Auth service lambat atau unresponsive, callback hang di status "Authenticating..." selamanya.

**Fix:**

```typescript
const userCredential = await Promise.race([
    signInWithCustomToken(auth, token),
    new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Auth timeout. Silakan coba lagi.')), 10000)
    )
]);
```

---

## Status Messages Tidak Informatif

**File:** `main/clicker-platform-v2/app/admin/auth/callback/page.tsx`

Initial status adalah `'Processing login...'` dan **tidak berubah** sampai `setStatus('Authenticating...')` di line 115. Tapi sebelum itu ada beberapa async operations. Jika user stuck sebelum line 115, status tetap "Processing login..." → tidak ada clue apa yang terjadi.

**Fix:** Tambah status update lebih awal:

```typescript
// Sebelum relay check:
setStatus('Memverifikasi token...');

// Setelah relay decision:
setStatus('Menghubungkan ke tenant...');
```

---

## Quick Debug Checklist

Sebelum code change, cek dulu hal-hal ini:

- [ ] **Browser Console** — Buka DevTools saat stuck, lihat ada error apa
- [ ] **Cek custom claims user** — Firebase Console → Auth → user → Custom Claims
  - Harus ada `siteId` dan `role`
- [ ] **Cek Firestore index** — Firebase Console → Firestore → Indexes → Collection group
  - Harus ada index untuk `members.email`
- [ ] **Cek Functions logs** — Firebase Console → Functions → `generateHandoffToken` → Logs
  - Ada error? Cold start timeout?
- [ ] **Network tab** — Berapa kali `generateHandoffToken` dipanggil? (Harusnya 1x)
- [ ] **Cookie** — Setelah callback, buka DevTools → Application → Cookies → apakah `__session` ada?

---

## Fix Priority

| Priority | Root Cause | File | Action |
|----------|-----------|------|--------|
| 🔴 1 | Double performHandoff | `auth-gateway/app/page.tsx` | Tambah guard flag |
| 🔴 2 | Firestore index missing | Firebase Console | Buat composite index |
| 🔴 3 | Token tanpa siteId claims | Firebase Console → Auth | Set custom claims |
| 🟡 4 | signInWithCustomToken tanpa timeout | `callback/page.tsx` | Wrap dengan Promise.race |
| 🟡 5 | Auto-handoff loop setelah error | `auth-gateway/app/page.tsx` | Tunggu signOut selesai |
| 🟢 6 | Status messages tidak informatif | `callback/page.tsx` | Tambah setStatus lebih awal |

---

## Files Yang Perlu Dimodifikasi

```
main/
├── auth-gateway/app/page.tsx           ← Fix RC-1, RC-4
├── clicker-platform-v2/
│   ├── app/admin/auth/callback/page.tsx ← Fix RC-6, RC-6 (timeout + status)
│   └── lib/admin-auth.ts               ← No code change, butuh Firestore index
└── [Firebase Console]                  ← RC-2 (index) + RC-3 (custom claims)
```