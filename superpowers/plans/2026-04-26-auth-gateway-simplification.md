# Implementation Plan: Auth Gateway Simplification (Opsi B+ Silent Login)

**Date:** 2026-04-26  
**Spec:** `superpowers/specs/2026-04-26-auth-gateway-simplification-design.md`  
**Branch:** `dev` → buat `feature/auth-gateway-simplification` sebelum mulai  
**Estimated:** ~2-3 jam  

---

## Overview

Menyederhanakan auth flow dari 7 langkah menjadi 5 langkah, menghapus callback page
yang terlihat user, dan menjadikan `getUserSites` satu-satunya source of truth untuk
tenant resolution. Net result: −462 baris, login ~2 detik, tidak ada halaman perantara.

---

## Phase 1 — Cloud Function: Slim `generateHandoffToken`

**File:** `functions/src/index.ts`  
**Tujuan:** Hapus `getUser` round-trip dan custom claims dari token.

### Step 1.1 — Ganti implementasi `generateHandoffToken`

Ganti seluruh body fungsi:

```typescript
export const generateHandoffToken = functions.https.onCall(async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    }
    try {
        const customToken = await admin.auth().createCustomToken(request.auth.uid);
        return { token: customToken };
    } catch (error: any) {
        throw new functions.https.HttpsError('internal', error.message);
    }
});
```

**Apa yang dihapus:** `getUser(uid)`, `claims` passthrough, semua `console.log`.  
**Kenapa aman:** Gateway sudah set `__session` cookie; platform resolve role dari Firestore, bukan dari JWT claims.

**Deploy:** `firebase deploy --only functions:generateHandoffToken`

---

## Phase 2 — Gateway: Rewrite `page.tsx`, Hapus `resolve-platform-url.ts`

**Files:**
- `auth-gateway/app/page.tsx` — rewrite
- `auth-gateway/lib/resolve-platform-url.ts` — hapus

### Step 2.1 — Hapus `resolve-platform-url.ts`

Delete file `auth-gateway/lib/resolve-platform-url.ts`.

### Step 2.2 — Rewrite `auth-gateway/app/page.tsx`

Ganti seluruh file dengan implementasi baru. Logic utama `performHandoff`:

```typescript
const performHandoff = async () => {
    if (handoffInProgress.current) return;
    handoffInProgress.current = true;

    try {
        setStatus('Mencari akses tenant...');

        // 1. Resolve tenant dari Firestore — satu-satunya source of truth
        const currentUser = auth.currentUser;
        if (!currentUser) throw new Error('Sesi tidak ditemukan.');

        const sites = await Promise.race([
            getUserSites(currentUser.uid, currentUser.email),
            new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Timeout resolving tenant (5s).')), 5000)
            ),
        ]);

        if (!sites || sites.length === 0) {
            await auth.signOut();
            window.location.href = `${window.location.origin}?error=no_membership`;
            return;
        }

        const site = sites[0];
        setStatus('Membuat token akses...');

        // 2. Generate handoff token (slim — tanpa claims)
        const result = await Promise.race([
            httpsCallable(functions, 'generateHandoffToken')(),
            new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Token timeout (15s).')), 15000)
            ),
        ]);

        const { token } = result.data as { token: string };
        if (!token) throw new Error('Token tidak diterima.');

        // 3. Set __session cookie — terbaca di semua *.clicker.id
        const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN || 'clicker.id';
        const isSecure = window.location.protocol === 'https:';
        const domainAttr = isSecure ? `; Domain=.${baseDomain}` : '';
        const secureAttr = isSecure ? '; Secure' : '';
        document.cookie = `__session=${site.siteId}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax${secureAttr}${domainAttr}`;

        // 4. Redirect langsung ke /admin di subdomain tenant — token di fragment
        setStatus('Mengalihkan ke dashboard...');
        const isFirebaseDefaultDomain = baseDomain.includes('.web.app');
        const targetOrigin = isFirebaseDefaultDomain
            ? `https://${baseDomain}/${site.slug}`
            : isSecure
                ? `https://${site.slug}.${baseDomain}`
                : `http://localhost:3000`;

        const nextPath = redirectTo && redirectTo !== '/'
            ? (redirectTo.startsWith('http') ? new URL(redirectTo).pathname : redirectTo)
            : '/admin';

        window.location.href = `${targetOrigin}${nextPath}#token=${encodeURIComponent(token)}`;

    } catch (err: any) {
        setError(`Gagal login: ${err.message}`);
        setIsChecking(false);
    } finally {
        handoffInProgress.current = false;
    }
};
```

**Yang dihapus dari page.tsx lama:**
- Import dan usage `resolvePlatformUrl`
- `__tenant` cookie read/write
- Loop detection (`handoff_loop_count` sessionStorage)
- `handoffInProgress` masih ada tapi hanya untuk guard double-invocation

**`getUserSites` di gateway:** Gateway pakai Firebase **client SDK** yang sudah sign in,
sehingga bisa query Firestore langsung dengan akun user. Copy/port fungsi `getUserSites`
dari platform ke `auth-gateway/lib/get-user-sites.ts` — atau buat versi minimal yang
hanya butuh `ownerId`/`ownerEmail` + `members` collectionGroup.

### Step 2.3 — Port `getUserSites` ke gateway

Buat `auth-gateway/lib/get-user-sites.ts`:

```typescript
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, collectionGroup, getDoc, doc } from 'firebase/firestore';

export interface UserSite {
    siteId: string;
    slug: string;
    name: string;
}

export async function getUserSites(uid: string, email: string | null): Promise<UserSite[]> {
    const sites: UserSite[] = [];
    const seen = new Set<string>();

    // 1. Owner by ownerId
    const ownerSnap = await getDocs(query(collection(db, 'sites'), where('ownerId', '==', uid)));
    ownerSnap.forEach(d => {
        if (!seen.has(d.id)) {
            seen.add(d.id);
            sites.push({ siteId: d.id, slug: d.data().slug || d.id, name: d.data().name || 'My Site' });
        }
    });

    // 2. Owner by ownerEmail (fallback for seeded data)
    if (email && sites.length === 0) {
        const emailSnap = await getDocs(query(collection(db, 'sites'), where('ownerEmail', '==', email)));
        emailSnap.forEach(d => {
            if (!seen.has(d.id)) {
                seen.add(d.id);
                sites.push({ siteId: d.id, slug: d.data().slug || d.id, name: d.data().name || 'My Site' });
            }
        });
    }

    // 3. Staff member (collectionGroup)
    if (email && sites.length === 0) {
        try {
            const memberSnap = await getDocs(query(collectionGroup(db, 'members'), where('email', '==', email)));
            await Promise.all(memberSnap.docs.map(async memberDoc => {
                const siteRef = memberDoc.ref.parent.parent;
                if (!siteRef || seen.has(siteRef.id)) return;
                seen.add(siteRef.id);
                const siteDoc = await getDoc(doc(db, 'sites', siteRef.id));
                if (siteDoc.exists()) {
                    sites.push({ siteId: siteDoc.id, slug: siteDoc.data().slug || siteDoc.id, name: siteDoc.data().name || 'My Site' });
                }
            }));
        } catch { /* missing index — graceful skip */ }
    }

    return sites;
}
```

---

## Phase 3 — Platform: TokenBootstrap + Hapus Callback Page

**Files:**
- `clicker-platform-v2/components/admin/TokenBootstrap.tsx` — baru
- `clicker-platform-v2/app/admin/(dashboard)/layout.tsx` — tambah TokenBootstrap
- `clicker-platform-v2/app/admin/auth/callback/page.tsx` — hapus
- `clicker-platform-v2/middleware.ts` — hapus pengecualian callback

### Step 3.1 — Buat `TokenBootstrap.tsx`

Buat file baru `components/admin/TokenBootstrap.tsx`:

```typescript
'use client';

import { useEffect } from 'react';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export function TokenBootstrap() {
    useEffect(() => {
        const token = new URLSearchParams(window.location.hash.slice(1)).get('token');
        if (!token) return;

        // Hapus token dari URL segera — tidak boleh ada di browser history
        window.history.replaceState(null, '', window.location.pathname + window.location.search);

        // Sign in background — onAuthStateChanged di UserProvider akan fire setelah ini
        signInWithCustomToken(auth, decodeURIComponent(token)).catch(() => {
            const gatewayUrl = process.env.NEXT_PUBLIC_AUTH_GATEWAY_URL;
            if (gatewayUrl) window.location.href = `${gatewayUrl}?error=auth_failed`;
        });
    }, []);

    return null;
}
```

**Kenapa di layout, bukan AdminGuard:**  
`AdminGuard` bergantung pada `useUser()` dari `UserProvider`. `UserProvider` menunggu
`onAuthStateChanged` resolve. Jika token diproses di AdminGuard, race condition terjadi:
`UserProvider` resolve dengan `null` → AdminGuard redirect ke gateway sebelum token diproses.
`TokenBootstrap` di layout mount **sebelum** `UserProvider` render children, sehingga
`signInWithCustomToken` sudah fire dan `onAuthStateChanged` membawa user saat `UserProvider` resolve.

### Step 3.2 — Tambah `TokenBootstrap` ke layout

File: `app/admin/(dashboard)/layout.tsx`

Tambah import dan render `<TokenBootstrap />` sebagai komponen pertama sebelum `UserProvider`:

```tsx
import { TokenBootstrap } from '@/components/admin/TokenBootstrap';

// Di dalam layout render:
<TokenBootstrap />
<UserProvider siteId={siteId}>
  <AdminGuard>
    {children}
  </AdminGuard>
</UserProvider>
```

### Step 3.3 — Hapus callback page

Delete file: `app/admin/auth/callback/page.tsx`

### Step 3.4 — Update middleware

File: `middleware.ts` — dua lokasi yang menyebut `/admin/auth/callback`:

**Lokasi 1** (sekitar baris 172):
```typescript
// HAPUS: !pathname.startsWith('/admin/auth/callback') &&
if (!activeSite && !pathname.startsWith('/admin/claim-admin')) {
```

**Lokasi 2** (sekitar baris 285):
```typescript
// HAPUS: adminPath.startsWith('/admin/auth/callback') ||
const isCallbackRoute = adminPath.startsWith('/admin/claim-admin');
```

---

## Phase 4 — Cleanup Gateway

### Step 4.1 — Update `auth-gateway/lib/firebase.ts`

Tambah Firestore init (dibutuhkan oleh `getUserSites`):

```typescript
// Pastikan db sudah di-export — cek apakah sudah ada
export { app, db, auth, storage, functions };
```

Firestore sudah di-init di `firebase.ts` gateway (`const db = getFirestore(app)`) — pastikan `db` ter-export.

### Step 4.2 — Hapus `auth-gateway/lib/session.ts` jika tidak terpakai

Cek apakah `clearSessionCookies` masih dipakai setelah rewrite. Jika tidak, hapus file.

---

## Urutan Eksekusi

```
Phase 1  → deploy Cloud Function dulu (backward compatible — token tanpa claims masih valid)
Phase 2  → rewrite gateway (tapi belum deploy — test lokal dulu)
Phase 3  → update platform (TokenBootstrap + hapus callback)
Phase 4  → cleanup
         → test end-to-end (validasi checklist)
         → deploy gateway
         → merge
```

**Kenapa Phase 1 dulu:** `generateHandoffToken` baru (tanpa claims) tetap compatible dengan
callback page lama. Sehingga saat gateway masih lama, tidak ada breaking change. Setelah
Phase 2-3 selesai dan ditest, baru deploy gateway dan platform sekaligus.

---

## Validasi Checklist

- [ ] Owner login via `auth.clicker.id` → masuk `slug.clicker.id/admin` tanpa lihat callback page
- [ ] Owner login via `slug.clicker.id/admin` (redirect ke gateway) → sama
- [ ] Staff login → masuk dengan akses terbatas sesuai `permissions[]`
- [ ] Token expired/invalid → redirect ke gateway dengan `?error=auth_failed`, tidak loop
- [ ] `no_membership` → error message tampil di gateway, tidak crash
- [ ] Localhost dev (`localhost:3000`) → flow bekerja
- [ ] `auth.currentUser` tersedia di komponen setelah login (inventory, ai-marketing, POS)
- [ ] User yang sudah punya `__session` cookie (sudah login) → tidak di-force re-handoff
- [ ] Fragment `#token=` hilang dari URL setelah TokenBootstrap proses
- [ ] Sign out → cookie cleared, redirect ke gateway

---

## File Summary

| File | Action |
|------|--------|
| `functions/src/index.ts` | Edit — slim `generateHandoffToken` |
| `auth-gateway/app/page.tsx` | Rewrite — ~100 baris |
| `auth-gateway/lib/resolve-platform-url.ts` | **DELETE** |
| `auth-gateway/lib/get-user-sites.ts` | **NEW** — port dari platform |
| `platform/components/admin/TokenBootstrap.tsx` | **NEW** — ~25 baris |
| `platform/app/admin/(dashboard)/layout.tsx` | Edit — tambah TokenBootstrap |
| `platform/app/admin/auth/callback/page.tsx` | **DELETE** |
| `platform/middleware.ts` | Edit — hapus 2 referensi callback |
