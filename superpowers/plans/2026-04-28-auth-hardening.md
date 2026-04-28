# Auth Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tambah autentikasi ke semua admin API routes yang saat ini terbuka, dengan dua helper bersama — `requireOwner` (config routes) dan `requireAuthedMember` (operational routes) — plus SSRF guard, Firestore/Storage rules fix, dan client SDK → adminDb migration.

**Architecture:** Satu file `lib/api-auth.ts` berisi `resolveSession` (internal), `requireOwner`, dan `requireAuthedMember`. Setiap route cukup memanggil 2 baris. `siteId` selalu dari `x-site-id` header (trusted, di-set middleware dari cookie) — tidak pernah dari body. Firestore dan Storage rules diperketat sebagai server-side gate.

**Tech Stack:** Next.js 14 App Router, Firebase Admin SDK (`adminAuth`, `adminDb`), Firestore Rules, Storage Rules

---

## File Map

| File | Action |
|---|---|
| `lib/api-auth.ts` | Create — dua exported helpers + internal resolver |
| `lib/ssrf-guard.ts` | ~~Create~~ — removed, tidak relevan untuk konteks ini |
| `app/api/admin/whatsapp/connect/route.ts` | Modify — add requireAuthedMember, switch siteId from body → session |
| `app/api/admin/whatsapp/disconnect/route.ts` | Modify — add requireAuthedMember, NextRequest, siteId from session |
| `app/api/admin/knowledge/sync/route.ts` | Modify — add requireAuthedMember + SSRF guard before fetch |
| `app/api/admin/knowledge/verify/route.ts` | Modify — add requireAuthedMember |
| `app/api/admin/modules/ai-sales-agent/config/route.ts` | Modify — remove bypass comment, add requireOwner |
| `app/api/admin/seed-templates/route.ts` | Modify — add req param + requireOwner |
| `app/api/forms/create/route.ts` | Modify — restore/replace commented auth → requireAuthedMember |
| `app/api/forms/update/route.ts` | Modify — restore/replace commented auth → requireAuthedMember |
| `app/api/forms/delete/route.ts` | Modify — restore/replace commented auth → requireAuthedMember |
| `app/api/admin/whatsapp/send/route.ts` | Modify — add requireAuthedMember, siteId from session |
| `app/api/admin/whatsapp/test/route.ts` | Modify — add requireAuthedMember |
| `app/api/submissions/update/route.ts` | Modify — replace commented auth → requireAuthedMember |
| `app/api/upload/image/route.ts` | Modify — add requireAuthedMember |
| `app/api/upload/avatar/route.ts` | Modify — add requireAuthedMember |
| `app/api/auth/check-access/route.ts` | Modify — add uid+email token assertion |
| `app/api/forms/submit/route.ts` | Modify — client SDK → adminDb |
| `app/api/analytics/track/route.ts` | Modify — client SDK → adminDb |
| `firestore.rules` | Modify — fix hasRole pure owner bug |
| `storage.rules` | Modify — tighten write to site membership |

---

## Task 1: Buat lib/api-auth.ts dan lib/ssrf-guard.ts

**Files:**
- Create: `lib/api-auth.ts`
- Create: `lib/ssrf-guard.ts`

Working directory: `/Users/mac/Documents/AI Project/clicker-platform/dev/clicker-platform-v2`

- [ ] **Step 1: Buat lib/ssrf-guard.ts**

```typescript
// lib/ssrf-guard.ts
const BLOCKED_PATTERNS = [
    /^https?:\/\/localhost/i,
    /^https?:\/\/127\./,
    /^https?:\/\/169\.254\./,
    /^https?:\/\/10\./,
    /^https?:\/\/172\.(1[6-9]|2\d|3[01])\./,
    /^https?:\/\/192\.168\./,
    /metadata\.google\.internal/i,
];

export function isSsrfBlocked(url: string): boolean {
    return BLOCKED_PATTERNS.some(p => p.test(url));
}
```

- [ ] **Step 2: Buat lib/api-auth.ts**

```typescript
// lib/api-auth.ts
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export interface AuthedSession {
    uid: string;
    email: string;
    siteId: string;
    role: 'owner' | 'staff';
    isOwner: boolean;
}

type AuthResult =
    | { ok: true; session: AuthedSession }
    | { ok: false; res: NextResponse };

async function resolveSession(req: NextRequest): Promise<AuthResult> {
    const siteId = req.headers.get('x-site-id');
    if (!siteId) {
        return { ok: false, res: NextResponse.json({ error: 'Missing x-site-id' }, { status: 400 }) };
    }

    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        return { ok: false, res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    }

    let decoded: { uid: string; email?: string };
    try {
        decoded = await adminAuth.verifyIdToken(authHeader.split('Bearer ')[1]);
    } catch {
        return { ok: false, res: NextResponse.json({ error: 'Invalid token' }, { status: 401 }) };
    }

    const siteDoc = await adminDb.collection('sites').doc(siteId).get();
    if (!siteDoc.exists) {
        return { ok: false, res: NextResponse.json({ error: 'Site not found' }, { status: 404 }) };
    }
    const siteData = siteDoc.data()!;

    const isOwner =
        siteData.ownerId === decoded.uid || siteData.ownerEmail === decoded.email;

    if (isOwner) {
        return {
            ok: true,
            session: {
                uid: decoded.uid,
                email: decoded.email ?? '',
                siteId,
                role: 'owner',
                isOwner: true,
            },
        };
    }

    const memberDoc = await adminDb
        .collection('sites').doc(siteId)
        .collection('members').doc(decoded.uid)
        .get();

    if (!memberDoc.exists || memberDoc.data()?.status !== 'active') {
        return { ok: false, res: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
    }

    return {
        ok: true,
        session: {
            uid: decoded.uid,
            email: decoded.email ?? '',
            siteId,
            role: 'staff',
            isOwner: false,
        },
    };
}

export async function requireOwner(req: NextRequest): Promise<AuthResult> {
    const result = await resolveSession(req);
    if (!result.ok) return result;
    if (!result.session.isOwner) {
        return { ok: false, res: NextResponse.json({ error: 'Owner access required' }, { status: 403 }) };
    }
    return result;
}

export async function requireAuthedMember(req: NextRequest): Promise<AuthResult> {
    return resolveSession(req);
}
```

- [ ] **Step 3: Verify TypeScript bersih**

```bash
cd "/Users/mac/Documents/AI Project/clicker-platform/dev/clicker-platform-v2" && pnpm tsc --noEmit 2>&1 | grep -E "api-auth|ssrf-guard"
```

Expected: tidak ada error untuk kedua file baru ini.

---

## Task 2: Apply requireAuthedMember — whatsapp/connect dan whatsapp/disconnect

**Files:**
- Modify: `app/api/admin/whatsapp/connect/route.ts`
- Modify: `app/api/admin/whatsapp/disconnect/route.ts`

- [ ] **Step 1: Update whatsapp/connect/route.ts**

Tambah import di baris pertama:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireAuthedMember } from '@/lib/api-auth';
```

Ubah signature fungsi dari `req: Request` → `req: NextRequest`:
```typescript
export async function POST(req: NextRequest) {
```

Ganti baris `const { siteId, ... } = await req.json()` dengan pattern berikut (letakkan sebelum `req.json()`):
```typescript
const auth = await requireAuthedMember(req);
if (!auth.ok) return auth.res;
const { siteId } = auth.session;

const { phoneNumberId, wabaId, accessToken, ownerPhone } = await req.json();

if (!phoneNumberId || !wabaId || !accessToken || !ownerPhone) {
    return NextResponse.json({ error: 'Semua field wajib diisi.' }, { status: 400 });
}
```

Hapus validasi `!siteId` yang lama (siteId sekarang dari auth.session, pasti ada).

- [ ] **Step 2: Update whatsapp/disconnect/route.ts**

File saat ini:
```typescript
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { siteId } = await req.json();
    if (!siteId) return NextResponse.json({ error: 'Missing siteId.' }, { status: 400 });
    ...
```

Ganti menjadi:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireAuthedMember } from '@/lib/api-auth';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthedMember(req);
    if (!auth.ok) return auth.res;
    const { siteId } = auth.session;

    const { adminDb } = await import('@/lib/firebase-admin');
    await adminDb.doc(`sites/${siteId}/wa/config`).update({
      status: 'disconnected',
      accessToken: '',
      phoneNumberId: '',
      wabaId: '',
      webhookVerifyToken: '',
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('wa.disconnect.failed', { siteId: 'platform', error: err });
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
```

- [ ] **Step 3: TypeScript check**

```bash
cd "/Users/mac/Documents/AI Project/clicker-platform/dev/clicker-platform-v2" && pnpm tsc --noEmit 2>&1 | grep -E "whatsapp/(connect|disconnect)"
```

Expected: tidak ada error.

---

## Task 3: Apply requireAuthedMember — knowledge/sync (+ SSRF) dan knowledge/verify

**Files:**
- Modify: `app/api/admin/knowledge/sync/route.ts`
- Modify: `app/api/admin/knowledge/verify/route.ts`

- [ ] **Step 1: Update knowledge/sync — tambah auth + SSRF guard**

Tambah import di baris pertama (file sudah pakai `NextRequest`):
```typescript
import { requireAuthedMember } from '@/lib/api-auth';
import { isSsrfBlocked } from '@/lib/ssrf-guard';
```

Ubah awal fungsi POST — ganti blok `siteId` check yang ada:
```typescript
// HAPUS:
const siteId = req.headers.get('x-site-id');
if (!siteId) {
    return NextResponse.json({ success: false, error: 'Site ID is required for knowledge sync' }, { status: 400 });
}

// GANTI DENGAN:
const auth = await requireAuthedMember(req);
if (!auth.ok) return auth.res;
const { siteId } = auth.session;
```

Tambah SSRF check di dalam blok URL scraping, sebelum `fetch(url, ...)`:
```typescript
if (urlsString) {
    const urls = urlsString.split('\n').map((u: string) => u.trim()).filter((u: string) => u.length > 0);

    const scrapePromises = urls.map(async (url: string) => {
        // TAMBAH BARIS INI:
        if (isSsrfBlocked(url)) {
            return `[BLOCKED: ${url} is not an allowed URL]`;
        }
        try {
            const response = await fetch(url, {
```

- [ ] **Step 2: Update knowledge/verify — tambah auth**

Baca file `app/api/admin/knowledge/verify/route.ts`. Tambah import:
```typescript
import { requireAuthedMember } from '@/lib/api-auth';
```

Ubah signature ke `NextRequest` jika belum. Tambah di awal handler (sebelum siteId atau body read):
```typescript
const auth = await requireAuthedMember(req);
if (!auth.ok) return auth.res;
const { siteId } = auth.session;
```

Hapus siteId check manual yang lama.

- [ ] **Step 3: TypeScript check**

```bash
cd "/Users/mac/Documents/AI Project/clicker-platform/dev/clicker-platform-v2" && pnpm tsc --noEmit 2>&1 | grep -E "knowledge/(sync|verify)"
```

Expected: tidak ada error.

---

## Task 4: Apply requireAuthedMember — forms/create, forms/update, forms/delete

**Files:**
- Modify: `app/api/forms/create/route.ts`
- Modify: `app/api/forms/update/route.ts`
- Modify: `app/api/forms/delete/route.ts`

- [ ] **Step 1: Baca ketiga file untuk lihat current state**

```bash
head -20 "/Users/mac/Documents/AI Project/clicker-platform/dev/clicker-platform-v2/app/api/forms/create/route.ts"
head -20 "/Users/mac/Documents/AI Project/clicker-platform/dev/clicker-platform-v2/app/api/forms/update/route.ts"
head -20 "/Users/mac/Documents/AI Project/clicker-platform/dev/clicker-platform-v2/app/api/forms/delete/route.ts"
```

- [ ] **Step 2: Untuk setiap file — hapus auth yang di-comment, tambah requireAuthedMember**

Pattern yang sama untuk ketiga file:

1. Tambah import:
```typescript
import { NextRequest, NextResponse } from 'next/server'; // jika belum NextRequest
import { requireAuthedMember } from '@/lib/api-auth';
```

2. Ubah signature: `req: Request` → `req: NextRequest` (atau `request: NextRequest`)

3. Di awal handler, hapus semua blok auth yang di-comment (blok `// const session = ...` dst), ganti dengan:
```typescript
const auth = await requireAuthedMember(req);
if (!auth.ok) return auth.res;
const { siteId } = auth.session;
```

4. Hapus siteId extraction dari body/header yang lama — gunakan `auth.session.siteId`.

- [ ] **Step 3: TypeScript check**

```bash
cd "/Users/mac/Documents/AI Project/clicker-platform/dev/clicker-platform-v2" && pnpm tsc --noEmit 2>&1 | grep -E "forms/(create|update|delete)"
```

Expected: tidak ada error.

---

## Task 5: Apply requireAuthedMember — ai-sales-agent/config dan seed-templates

**Files:**
- Modify: `app/api/admin/modules/ai-sales-agent/config/route.ts`
- Modify: `app/api/admin/seed-templates/route.ts`

- [ ] **Step 1: Update ai-sales-agent/config — hapus bypass, tambah requireAuthedMember**

Baca file. Cari blok yang di-comment (bertanda "TEMPORARY BYPASS for MVP" sekitar line 34-50). Hapus seluruh blok tersebut.

Tambah import:
```typescript
import { requireAuthedMember } from '@/lib/api-auth';
```

Tambah di awal setiap handler (GET dan POST jika ada):
```typescript
const auth = await requireAuthedMember(req);
if (!auth.ok) return auth.res;
const { siteId } = auth.session;
```

Pastikan signature handler menggunakan `req: NextRequest`.

- [ ] **Step 2: Update seed-templates — tambah req param + requireAuthedMember**

File saat ini: `export async function GET()` tanpa parameter.

Ubah menjadi:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireAuthedMember } from '@/lib/api-auth';

// ... existing imports ...

export async function GET(req: NextRequest) {
    const auth = await requireAuthedMember(req);
    if (!auth.ok) return auth.res;

    try {
        // ... existing seeding logic unchanged ...
```

Juga ganti `import { Timestamp } from 'firebase/firestore'` (client SDK) dengan:
```typescript
import { Timestamp } from '@/lib/firebase-admin';
```

(File ini sudah import client Timestamp — switch ke admin Timestamp karena ini server route)

- [ ] **Step 3: TypeScript check**

```bash
cd "/Users/mac/Documents/AI Project/clicker-platform/dev/clicker-platform-v2" && pnpm tsc --noEmit 2>&1 | grep -E "(ai-sales-agent/config|seed-templates)"
```

Expected: tidak ada error.

---

## Task 6: Apply requireAuthedMember — whatsapp/send dan whatsapp/test

**Files:**
- Modify: `app/api/admin/whatsapp/send/route.ts`
- Modify: `app/api/admin/whatsapp/test/route.ts`

- [ ] **Step 1: Update whatsapp/send**

Tambah import:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireAuthedMember } from '@/lib/api-auth';
```

Ubah signature: `req: Request` → `req: NextRequest`.

Ganti:
```typescript
const { siteId, to, content, threadId, staffUserId } = await req.json();

if (!siteId || !to || !content || !threadId) {
    return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
}
```

Dengan:
```typescript
const auth = await requireAuthedMember(req);
if (!auth.ok) return auth.res;
const { siteId, uid } = auth.session;

const { to, content, threadId } = await req.json();

if (!to || !content || !threadId) {
    return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
}
```

Note: `staffUserId` di body sebelumnya tidak perlu lagi — gunakan `uid` dari `auth.session` untuk mencatat siapa yang mengirim pesan.

- [ ] **Step 2: Update whatsapp/test**

Baca file. Tambah import:
```typescript
import { NextRequest } from 'next/server';
import { requireAuthedMember } from '@/lib/api-auth';
```

Ubah signature ke `NextRequest`. Tambah di awal handler:
```typescript
const auth = await requireAuthedMember(req);
if (!auth.ok) return auth.res;
const { siteId } = auth.session;
```

Hapus siteId extraction dari body/header yang lama.

- [ ] **Step 3: TypeScript check**

```bash
cd "/Users/mac/Documents/AI Project/clicker-platform/dev/clicker-platform-v2" && pnpm tsc --noEmit 2>&1 | grep -E "whatsapp/(send|test)"
```

Expected: tidak ada error.

---

## Task 7: Apply requireAuthedMember — submissions/update, upload/image, upload/avatar

**Files:**
- Modify: `app/api/submissions/update/route.ts`
- Modify: `app/api/upload/image/route.ts`
- Modify: `app/api/upload/avatar/route.ts`

- [ ] **Step 1: Update submissions/update**

File saat ini punya auth yang di-comment. Tambah import:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireAuthedMember } from '@/lib/api-auth';
```

Ubah signature: `request: Request` → `request: NextRequest`.

Hapus blok auth yang di-comment (lines 10-16 berisi `// const session = ...`). Ganti dengan:
```typescript
const auth = await requireAuthedMember(request);
if (!auth.ok) return auth.res;
const { siteId } = auth.session;
```

Ubah body destructuring — hapus `siteId` dari body (sudah dari auth.session):
```typescript
// SEBELUM:
const { id, action, siteId } = body;

// SESUDAH:
const { id, action } = body;
```

- [ ] **Step 2: Update upload/image**

File sudah pakai `NextRequest`. Tambah import:
```typescript
import { requireAuthedMember } from '@/lib/api-auth';
```

Tambah di awal handler (sebelum `formData`):
```typescript
const auth = await requireAuthedMember(req);
if (!auth.ok) return auth.res;
const { siteId } = auth.session;
```

Hapus baris:
```typescript
const siteId = req.headers.get('x-site-id') || 'platform';
```

- [ ] **Step 3: Update upload/avatar**

Baca file. Sama seperti upload/image — tambah import, 2 baris auth, hapus siteId manual.

- [ ] **Step 4: TypeScript check**

```bash
cd "/Users/mac/Documents/AI Project/clicker-platform/dev/clicker-platform-v2" && pnpm tsc --noEmit 2>&1 | grep -E "(submissions/update|upload/(image|avatar))"
```

Expected: tidak ada error.

---

## Task 8: Fix auth/check-access — uid+email token assertion

**Files:**
- Modify: `app/api/auth/check-access/route.ts`

- [ ] **Step 1: Tambah token assertion**

File saat ini: body berisi `{ uid, email, siteId }` tanpa verifikasi bahwa caller adalah user yang dimaksud.

Tambah import:
```typescript
import { adminAuth, adminDb, Timestamp } from '@/lib/firebase-admin';
// adminAuth sudah ada di file ini
```

Di awal handler, setelah destructure body, tambah token verification:
```typescript
const body = await req.json();
const { uid, email, siteId: sid } = body;
siteId = sid;

if (!uid || !email || !siteId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
}

// Verify caller's token matches the uid+email they claim
const authHeader = req.headers.get('authorization');
if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
let decoded: { uid: string; email?: string };
try {
    decoded = await adminAuth.verifyIdToken(authHeader.split('Bearer ')[1]);
} catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
}
if (decoded.uid !== uid || decoded.email !== email) {
    return NextResponse.json({ error: 'Token mismatch' }, { status: 403 });
}

// Lanjutkan ke logika existing (check invitation, promote member)
```

Sisanya (cek invitation, promote member, batch.commit) tidak berubah.

- [ ] **Step 2: TypeScript check**

```bash
cd "/Users/mac/Documents/AI Project/clicker-platform/dev/clicker-platform-v2" && pnpm tsc --noEmit 2>&1 | grep "check-access"
```

Expected: tidak ada error.

---

## Task 9: Switch forms/submit dan analytics/track dari client SDK ke adminDb

**Files:**
- Modify: `app/api/forms/submit/route.ts`
- Modify: `app/api/analytics/track/route.ts`

- [ ] **Step 1: Update forms/submit — switch ke adminDb**

File saat ini menggunakan `db` dari `@/lib/firebase` (client SDK).

Hapus import client SDK:
```typescript
// HAPUS:
import { db } from '@/lib/firebase';
import { collection, addDoc, doc, getDoc, serverTimestamp } from 'firebase/firestore';
```

Tambah import admin:
```typescript
import { adminDb, FieldValue } from '@/lib/firebase-admin';
```

Ubah operasi Firestore:
```typescript
// SEBELUM:
await addDoc(collection(db, 'sites', siteId, 'inbox'), {
    formId,
    formTitle,
    data,
    submittedAt: serverTimestamp(),
    status: 'new'
});

// SESUDAH:
await adminDb.collection('sites').doc(siteId).collection('inbox').add({
    formId,
    formTitle,
    data,
    submittedAt: FieldValue.serverTimestamp(),
    status: 'new'
});
```

Ubah form fetch untuk email notification:
```typescript
// SEBELUM:
const formDoc = await getDoc(doc(db, 'sites', siteId, 'forms', formId));
if (formDoc.exists()) {
    const emailTo = formDoc.data()?.emailNotificationTo;

// SESUDAH:
const formDoc = await adminDb.collection('sites').doc(siteId).collection('forms').doc(formId).get();
if (formDoc.exists) {
    const emailTo = formDoc.data()?.emailNotificationTo;
```

Note: route ini tetap PUBLIC (tidak tambah auth) — end-user submit form dari browser.

- [ ] **Step 2: Update analytics/track — switch ke adminDb**

Baca file lengkap. Hapus import client SDK:
```typescript
// HAPUS:
import { db } from '@/lib/firebase';
import { doc, writeBatch, increment } from 'firebase/firestore';
```

Tambah:
```typescript
import { adminDb, FieldValue } from '@/lib/firebase-admin';
```

Ubah batch operations:
```typescript
// SEBELUM:
batch = writeBatch(db);
// ... batch.update(shardRef, { ... increment(1) ... })

// SESUDAH:
const batch = adminDb.batch();
// ... batch.update(adminDb.doc(shardPath), { ... FieldValue.increment(1) ... })
```

Untuk `analyticsShardRef` — baca fungsinya. Jika mengembalikan client SDK DocumentReference, ganti dengan `adminDb.doc(path)` menggunakan path yang sama. Jika ada helper function, buat versi admin atau inline path-nya.

- [ ] **Step 3: TypeScript check**

```bash
cd "/Users/mac/Documents/AI Project/clicker-platform/dev/clicker-platform-v2" && pnpm tsc --noEmit 2>&1 | grep -E "forms/submit|analytics/track"
```

Expected: tidak ada error. Jika ada error terkait `analyticsShardRef`, baca file counter helper dan sesuaikan.

---

## Task 10: Fix firestore.rules dan storage.rules

**Files:**
- Modify: `firestore.rules`
- Modify: `storage.rules`

- [ ] **Step 1: Fix firestore.rules — hasRole pure owner bug**

File saat ini (`firestore.rules` lines 46-51):
```
function hasRole(siteId, allowedRoles) {
  return isGlobalAdmin() || (
    get(/databases/$(database)/documents/sites/$(siteId)/members/$(request.auth.uid)).data.role in allowedRoles
  );
}
```

Ganti dengan:
```
function hasRole(siteId, allowedRoles) {
  return isGlobalAdmin() || isSiteOwner(siteId) || (
    exists(/databases/$(database)/documents/sites/$(siteId)/members/$(request.auth.uid)) &&
    get(/databases/$(database)/documents/sites/$(siteId)/members/$(request.auth.uid)).data.role in allowedRoles
  );
}
```

- [ ] **Step 2: Fix storage.rules — tighten tenant write**

File saat ini (`storage.rules` lines 17-19):
```
match /sites/{siteId}/{allPaths=**} {
    allow write: if isAuthenticated();
}
```

Ganti dengan:
```
match /sites/{siteId}/{allPaths=**} {
    allow read: if true;
    allow write: if isAuthenticated() && (
        firestore.get(/databases/(default)/documents/sites/$(siteId)).data.ownerId == request.auth.uid ||
        firestore.get(/databases/(default)/documents/sites/$(siteId)).data.ownerEmail == request.auth.token.email ||
        firestore.exists(/databases/(default)/documents/sites/$(siteId)/members/$(request.auth.uid))
    );
}
```

- [ ] **Step 3: Validate rules syntax**

```bash
cd "/Users/mac/Documents/AI Project/clicker-platform/dev/clicker-platform-v2" && firebase --version 2>/dev/null || echo "firebase CLI not in path"
```

Jika firebase CLI tersedia:
```bash
firebase firestore:rules --check firestore.rules 2>&1 | head -20
```

Jika tidak tersedia, review rules secara manual — pastikan tidak ada typo dan semua function calls merujuk ke function yang sudah didefinisikan (`isSiteOwner`, `isGlobalAdmin`).

- [ ] **Step 4: Final TypeScript check seluruh project**

```bash
cd "/Users/mac/Documents/AI Project/clicker-platform/dev/clicker-platform-v2" && pnpm tsc --noEmit 2>&1 | grep "error TS" | grep -v "node_modules" | grep -v "__tests__" | grep -v "\.test\." | head -30
```

Expected: tidak ada error baru di production code (error di test files yang sudah ada sebelumnya bukan tanggung jawab task ini).

---

## Self-Review Checklist

- [x] **Spec coverage:**
  - ✅ `lib/api-auth.ts` dengan `requireOwner` + `requireAuthedMember` → Task 1
  - ✅ `lib/ssrf-guard.ts` → Task 1
  - ✅ `whatsapp/connect`, `whatsapp/disconnect` → Task 2
  - ✅ `knowledge/sync` + SSRF guard → Task 3
  - ✅ `knowledge/verify` → Task 3
  - ✅ `forms/create`, `forms/update`, `forms/delete` → Task 4
  - ✅ `ai-sales-agent/config` (hapus bypass) → Task 5
  - ✅ `seed-templates` → Task 5
  - ✅ `whatsapp/send`, `whatsapp/test` → Task 6
  - ✅ `submissions/update`, `upload/image`, `upload/avatar` → Task 7
  - ✅ `auth/check-access` uid+email assertion → Task 8
  - ✅ `forms/submit` + `analytics/track` → adminDb → Task 9
  - ✅ `firestore.rules` hasRole fix → Task 10
  - ✅ `storage.rules` tighten write → Task 10
  - ✅ Public routes (`forms/submit`, webhook) tetap tanpa auth → Task 9 (no auth added), Task 4 (submit tidak disentuh)

- [x] **Placeholder scan:** Tidak ada TBD/TODO. Task 3 Step 2 dan Task 4 Step 1 mengharuskan implementer membaca file terlebih dahulu karena content-nya bervariasi — ini acceptable karena instruksinya spesifik.

- [x] **Type consistency:** `AuthedSession`, `AuthResult`, `requireOwner`, `requireAuthedMember` konsisten dari Task 1 sampai Task 7. `FieldValue.serverTimestamp()` dan `FieldValue.increment()` konsisten (keduanya dari `@/lib/firebase-admin`).
