# Security Auth Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 5 critical authentication/authorization vulnerabilities across auth-gateway, backyard, clicker-platform-v2, and Cloud Functions.

**Architecture:** Middleware-based Firebase ID token verification per app. All fixes reuse the existing `requireAuthedMember` pattern from `lib/api-auth.ts` where applicable. Backyard gets a new `middleware.ts` (Next.js route-level) + `lib/require-superadmin.ts` helper. Auth gateway `/api/token` ignores caller-supplied UID in favor of verified token identity.

**Tech Stack:** Next.js App Router middleware, Firebase Admin SDK (`adminAuth.verifyIdToken`), Firebase callable functions auth (`request.auth`), TypeScript.

---

## File Map

| File | Action | Responsible for |
|------|--------|----------------|
| `dev/auth-gateway/app/api/token/route.ts` | Modify | Verify ID token, use uid from token (not body) |
| `dev/auth-gateway/app/page.tsx` | Modify | Send `Authorization: Bearer <idToken>` when calling `/api/token` |
| `dev/backyard/lib/firebase-admin.ts` | Modify | Export `adminAuth` (currently missing) |
| `dev/backyard/lib/require-superadmin.ts` | Create | Superadmin verification helper |
| `dev/backyard/middleware.ts` | Create | Block all `/api/*` without valid superadmin token |
| `dev/clicker-platform-v2/app/api/webhook/whatsapp/route.ts` | Modify | Fail-closed HMAC: bail when secret missing |
| `dev/functions/src/admin/site.ts` | Modify | Add superadmin auth check to `seedSiteData` |
| `dev/clicker-platform-v2/app/api/stocklens/scan/route.ts` | Modify | Add `requireAuthedMember` |
| `dev/clicker-platform-v2/app/api/stocklens/check-sku/route.ts` | Modify | Add `requireAuthedMember` |
| `dev/clicker-platform-v2/app/api/stocklens/settings/route.ts` | Modify | Add `requireAuthedMember` |
| `dev/clicker-platform-v2/app/api/admin/ai-credits/route.ts` | Modify | Add `requireAuthedMember` (replace header-only siteId) |
| `dev/clicker-platform-v2/app/api/admin/ai-usage/route.ts` | Modify | Add `requireAuthedMember` (replace header-only siteId) |
| `dev/clicker-platform-v2/app/api/admin/modules/ai-marketing/campaigns/route.ts` | Modify | Replace custom `verify()` with `requireAuthedMember` |
| `dev/clicker-platform-v2/app/api/admin/modules/ai-marketing/campaigns/[id]/route.ts` | Modify | Replace custom `verify()` with `requireAuthedMember` |
| `dev/clicker-platform-v2/app/api/admin/modules/ai-marketing/config/route.ts` | Modify | Replace custom `verify()` with `requireAuthedMember` |
| `dev/clicker-platform-v2/app/api/admin/modules/ai-marketing/saved/route.ts` | Modify | Replace custom `verify()` with `requireAuthedMember` |
| `dev/clicker-platform-v2/app/api/admin/modules/ai-marketing/generate/route.ts` | Modify | Replace custom `verify()` with `requireAuthedMember` |
| `dev/clicker-platform-v2/app/api/admin/modules/ai-marketing/export/route.ts` | Modify | Replace custom `verify()` with `requireAuthedMember` |
| `dev/clicker-platform-v2/app/api/admin/modules/ai-marketing/assets/upload/route.ts` | Modify | Replace custom `verify()` with `requireAuthedMember` |
| `dev/clicker-platform-v2/app/api/admin/modules/ai-marketing/assets/analyze/route.ts` | Modify | Replace custom `verify()` with `requireAuthedMember` |

---

## Task 1: Fix Auth Gateway `/api/token` — Account Takeover Vector

**Files:**
- Modify: `dev/auth-gateway/app/api/token/route.ts`

**Context:** Current code accepts arbitrary `uid` from body and mints a custom token for that uid with zero authentication — full account takeover. Fix: verify the caller's Firebase ID token from `Authorization` header; use the uid from the verified token.

- [ ] **Step 1: Update `route.ts`**

Replace entire file content:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const decoded = await adminAuth.verifyIdToken(authHeader.slice(7));
        const token = await adminAuth.createCustomToken(decoded.uid);
        return NextResponse.json({ token });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 401 });
    }
}
```

- [ ] **Step 2: Update `app/page.tsx` — send ID token when calling `/api/token`**

In `dev/auth-gateway/app/page.tsx`, inside `performHandoff`, the parallel fetch currently sends:
```typescript
fetch('/api/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ uid: currentUser.uid }),
})
```

Replace with (add `getIdToken()` call and `Authorization` header):
```typescript
fetch('/api/token', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${await currentUser.getIdToken()}`,
  },
  body: JSON.stringify({}),
})
```

Note: The body can be empty now — uid comes from the verified token server-side.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd "/Users/mac/Documents/AI Project/clicker-platform/dev/auth-gateway" && npx tsc --noEmit 2>&1 | head -30
```

Expected: No errors related to these files.

---

## Task 2: Add `adminAuth` Export to Backyard Firebase Admin

**Files:**
- Modify: `dev/backyard/lib/firebase-admin.ts`

**Context:** Backyard's `firebase-admin.ts` only exports `adminDb` and `FieldValue`. We need `adminAuth` to verify ID tokens in the new middleware and helper.

- [ ] **Step 1: Add `adminAuth` export**

In `dev/backyard/lib/firebase-admin.ts`, after line 43 (`export const adminDb...`), add:

```typescript
export const adminAuth = admin.auth(adminApp);
```

Full file after change:
```typescript
import type * as AdminTypes from 'firebase-admin';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const admin = require('firebase-admin') as typeof AdminTypes;

const initializeApp = (opts?: AdminTypes.AppOptions) => admin.initializeApp(opts);
const getApps = () => admin.apps || [];
const cert = (cred: AdminTypes.ServiceAccount) => admin.credential.cert(cred);

import type { App } from 'firebase-admin/app';
import type { Firestore } from 'firebase-admin/firestore';

function initializeAdminApp(): App {
  const apps = getApps();
  if (apps.length > 0) return apps[0] as App;

  const serviceAccountKey = process.env.GCP_SERVICE_ACCOUNT_KEY;
  if (serviceAccountKey) {
    try {
      let credential: AdminTypes.ServiceAccount;
      if (serviceAccountKey.endsWith('.json') || serviceAccountKey.startsWith('/') || serviceAccountKey.startsWith('./')) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const fs = require('fs');
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const path = require('path');
        const keyPath = path.resolve(process.cwd(), serviceAccountKey);
        credential = JSON.parse(fs.readFileSync(keyPath, 'utf-8'));
      } else {
        credential = JSON.parse(serviceAccountKey);
      }
      return initializeApp({
        credential: cert(credential),
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      }) as App;
    } catch (error) {
      console.error('[firebase-admin] Failed to load GCP_SERVICE_ACCOUNT_KEY:', error);
    }
  }

  return initializeApp({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID }) as App;
}

export const adminApp: App = initializeAdminApp();
export const adminDb: Firestore = admin.firestore(adminApp);
export const adminAuth = admin.auth(adminApp);
export const FieldValue = admin.firestore.FieldValue;
```

---

## Task 3: Create Backyard `require-superadmin.ts` Helper

**Files:**
- Create: `dev/backyard/lib/require-superadmin.ts`

**Context:** Reusable per-route helper for superadmin verification. Checks `Authorization: Bearer <idToken>` header, verifies via Firebase Admin, then confirms email matches `SUPER_ADMIN_EMAIL` env var.

- [ ] **Step 1: Create the file**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';

type SuperadminResult =
  | { ok: true; uid: string }
  | { ok: false; res: NextResponse };

export async function requireSuperadmin(req: NextRequest): Promise<SuperadminResult> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { ok: false, res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  let uid: string;
  let email: string | undefined;
  try {
    const decoded = await adminAuth.verifyIdToken(authHeader.slice(7));
    uid = decoded.uid;
    email = decoded.email;
  } catch {
    return { ok: false, res: NextResponse.json({ error: 'Invalid token' }, { status: 401 }) };
  }

  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
  if (!superAdminEmail || email !== superAdminEmail) {
    return { ok: false, res: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { ok: true, uid };
}
```

---

## Task 4: Create Backyard `middleware.ts`

**Files:**
- Create: `dev/backyard/middleware.ts`

**Context:** Next.js middleware file at app root. Intercepts all `/api/*` requests and verifies superadmin token before they reach route handlers. This protects all 14 API routes in backyard without touching each file individually.

- [ ] **Step 1: Create the file**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireSuperadmin } from '@/lib/require-superadmin';

export async function middleware(req: NextRequest) {
  const result = await requireSuperadmin(req);
  if (!result.ok) return result.res;
  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
```

- [ ] **Step 2: Update backyard frontend fetch calls to send ID token**

All backyard fetch calls to `/api/*` must send `Authorization: Bearer <idToken>`. The user object is available from `onAuthStateChanged` in `app/page.tsx` as `user` state.

The pattern for every fetch call is:
```typescript
const idToken = await user.getIdToken();
fetch('/api/...', {
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${idToken}`,
  },
  // ... rest of options
})
```

Files that contain fetch calls to `/api/*` (check each):

**`app/api-keys/_components/SecretCard.tsx`** — `handleTest`, `handleSave`, `handleDelete` each call `/api/secrets/*`. This component receives no `user` prop. Need to either:
- Pass `user` as prop from parent, or
- Import `auth` from `@/lib/firebase` and call `auth.currentUser?.getIdToken()`

Use option B (simpler, no prop drilling). Update the three fetch functions:

```typescript
import { auth } from '@/lib/firebase';

async function handleTest() {
  setTesting(true);
  setTestResult(null);
  try {
    const idToken = await auth.currentUser?.getIdToken() ?? '';
    const res = await fetch('/api/secrets/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
      body: JSON.stringify({ key: secretKey }),
    });
    const data = await res.json() as { ok: boolean; message: string };
    setTestResult(data);
  } catch {
    setTestResult({ ok: false, message: 'Network error' });
  } finally {
    setTesting(false);
  }
}

async function handleSave() {
  if (!newValue.trim()) return;
  setSaving(true);
  try {
    const idToken = await auth.currentUser?.getIdToken() ?? '';
    await fetch('/api/secrets/set', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
      body: JSON.stringify({ key: secretKey, value: newValue.trim() }),
    });
    setNewValue('');
    setShowInput(false);
    onRefresh();
  } finally {
    setSaving(false);
  }
}

async function handleDelete() {
  if (!confirm(`Delete ${meta.label}? This will break dependent features.`)) return;
  setDeleting(true);
  try {
    const idToken = await auth.currentUser?.getIdToken() ?? '';
    await fetch('/api/secrets/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
      body: JSON.stringify({ key: secretKey }),
    });
    onRefresh();
  } finally {
    setDeleting(false);
  }
}
```

- [ ] **Step 3: Find all other backyard fetch calls to `/api/*`**

```bash
grep -rn "fetch('/api/" "/Users/mac/Documents/AI Project/clicker-platform/dev/backyard" --include="*.tsx" --include="*.ts" | grep -v node_modules | grep -v ".next"
```

For each result, add `Authorization: Bearer ${await auth.currentUser?.getIdToken() ?? ''}` to the fetch headers. Same pattern as Step 2.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd "/Users/mac/Documents/AI Project/clicker-platform/dev/backyard" && npx tsc --noEmit 2>&1 | head -30
```

Expected: No new errors.

---

## Task 5: Fix WhatsApp Webhook Fail-Closed

**Files:**
- Modify: `dev/clicker-platform-v2/app/api/webhook/whatsapp/route.ts`

**Context:** Current logic `if (appSecret && !validateSignature(...))` skips HMAC validation entirely when `META_APP_SECRET` is missing or throws. Fix: fail-closed — if no secret, log and bail without processing payload.

- [ ] **Step 1: Replace the signature check block**

In `route.ts`, lines 58-64 currently read:
```typescript
let appSecret = '';
try { appSecret = await getSecret('META_APP_SECRET'); } catch { appSecret = ''; }

if (appSecret && !validateSignature(rawBody, signature, appSecret)) {
  logger.warn('wa.webhook.invalid.signature', { siteId: 'platform' });
  return NextResponse.json({ ok: true }); // Still 200 to Meta
}
```

Replace with:
```typescript
let appSecret = '';
try { appSecret = await getSecret('META_APP_SECRET'); } catch { appSecret = ''; }

if (!appSecret) {
  logger.error('wa.webhook.secret.missing', { siteId: 'platform' });
  return NextResponse.json({ ok: true });
}
if (!validateSignature(rawBody, signature, appSecret)) {
  logger.warn('wa.webhook.invalid.signature', { siteId: 'platform' });
  return NextResponse.json({ ok: true });
}
```

---

## Task 6: Fix `seedSiteData` Cloud Function — No Auth

**Files:**
- Modify: `dev/functions/src/admin/site.ts`

**Context:** `seedSiteData` is a Firebase callable function that performs full site data overwrite. Currently has zero auth check — any authenticated user can call it with arbitrary `siteId` and `ownerId`. Fix: add superadmin email check identical to pattern used in other functions like `createTenant`.

- [ ] **Step 1: Add auth check to `seedSiteData`**

In `dev/functions/src/admin/site.ts`, replace line 174 onwards:

```typescript
export const seedSiteData = functions.https.onCall(async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
    }
    const email = request.auth.token.email;
    if (email !== process.env.SUPER_ADMIN_EMAIL) {
        throw new functions.https.HttpsError('permission-denied', 'Superadmin only.');
    }

    const { siteId, ownerId } = request.data;
    if (!siteId) {
        throw new functions.https.HttpsError('invalid-argument', 'siteId is required.');
    }

    const db = admin.firestore();
    try {
        await performSiteSeeding(db, siteId, ownerId);
        return { success: true, siteId, message: "Site seeded successfully" };
    } catch (error: any) {
        console.error("❌ Error seeding site:", error);
        throw new functions.https.HttpsError('internal', `Failed to seed site: ${error.message}`);
    }
});
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "/Users/mac/Documents/AI Project/clicker-platform/dev/functions" && npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors.

---

## Task 7: Fix Stocklens Endpoints — Unauthenticated

**Files:**
- Modify: `dev/clicker-platform-v2/app/api/stocklens/scan/route.ts`
- Modify: `dev/clicker-platform-v2/app/api/stocklens/check-sku/route.ts`
- Modify: `dev/clicker-platform-v2/app/api/stocklens/settings/route.ts`

**Context:** These endpoints accept `siteId` from the request body — IDOR and no auth. Fix: add `requireAuthedMember` at the top of each handler; use `auth.session.siteId` (from verified session) instead of body.

- [ ] **Step 1: Fix `scan/route.ts`**

Replace entire file:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { scanProductImage } from '@/lib/modules/stocklens/server/scanner';
import { requireAuthedMember } from '@/lib/api-auth';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const auth = await requireAuthedMember(req);
  if (!auth.ok) return auth.res;

  try {
    const text = await req.text();
    let body: { base64?: string; mimeType?: string };
    try {
      body = JSON.parse(text);
    } catch {
      logger.error('stocklens.scan.body.parse.failed', { preview: text.slice(0, 80) });
      return NextResponse.json({ error: 'Request body tidak valid' }, { status: 400 });
    }
    const { base64, mimeType } = body;

    if (!base64) {
      return NextResponse.json({ error: 'base64 is required' }, { status: 400 });
    }

    const result = await scanProductImage(auth.session.siteId, base64, mimeType || 'image/jpeg');
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.startsWith('insufficient_credits:')) {
      const [, balance, required] = message.split(':');
      return NextResponse.json(
        { error: 'insufficient_credits', balance: Number(balance), required: Number(required) },
        { status: 402 }
      );
    }
    logger.error('stocklens.scan.route.failed', { error });
    return NextResponse.json({ error: 'Scan gagal. Coba lagi.' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Read and fix `check-sku/route.ts`**

First read the file:
```bash
cat "/Users/mac/Documents/AI Project/clicker-platform/dev/clicker-platform-v2/app/api/stocklens/check-sku/route.ts"
```

Then apply the same pattern: add `requireAuthedMember`, remove `siteId` from body parsing, use `auth.session.siteId`.

- [ ] **Step 3: Read and fix `settings/route.ts`**

First read the file:
```bash
cat "/Users/mac/Documents/AI Project/clicker-platform/dev/clicker-platform-v2/app/api/stocklens/settings/route.ts"
```

Then apply the same pattern.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd "/Users/mac/Documents/AI Project/clicker-platform/dev/clicker-platform-v2" && npx tsc --noEmit 2>&1 | grep -E "stocklens|api-auth" | head -20
```

Expected: No errors from stocklens files.

---

## Task 8: Fix AI Credits/Usage Endpoints — No Auth

**Files:**
- Modify: `dev/clicker-platform-v2/app/api/admin/ai-credits/route.ts`
- Modify: `dev/clicker-platform-v2/app/api/admin/ai-usage/route.ts`

**Context:** Both read `siteId` directly from `x-site-id` header without token verification — no auth at all. Fix: use `requireAuthedMember` which verifies the token and returns `siteId` from the verified session.

- [ ] **Step 1: Fix `ai-credits/route.ts`**

Replace entire file:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getCreditBalance } from '@/lib/ai/credits';
import { requireAuthedMember } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAuthedMember(req);
  if (!auth.ok) return auth.res;

  try {
    const balance = await getCreditBalance(auth.session.siteId);
    return NextResponse.json(balance);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[ai-credits] getCreditBalance failed:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Fix `ai-usage/route.ts`**

Replace entire file:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireAuthedMember } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAuthedMember(req);
  if (!auth.ok) return auth.res;

  const limit = Math.min(Number(new URL(req.url).searchParams.get('limit') ?? 30), 90);

  try {
    const snap = await adminDb
      .collection('sites').doc(auth.session.siteId)
      .collection('platform').doc('aiCreditLedger')
      .collection('daily')
      .orderBy('date', 'desc')
      .limit(limit)
      .get();

    const days = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return NextResponse.json({ days });
  } catch (err: unknown) {
    console.error('[ai-usage] query failed:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
```

---

## Task 9: Fix AI Marketing Endpoints — IDOR via Custom `verify()`

**Files:**
- Modify: `dev/clicker-platform-v2/app/api/admin/modules/ai-marketing/campaigns/route.ts`
- Modify: `dev/clicker-platform-v2/app/api/admin/modules/ai-marketing/campaigns/[id]/route.ts`
- Modify: `dev/clicker-platform-v2/app/api/admin/modules/ai-marketing/config/route.ts`
- Modify: `dev/clicker-platform-v2/app/api/admin/modules/ai-marketing/saved/route.ts`
- Modify: `dev/clicker-platform-v2/app/api/admin/modules/ai-marketing/generate/route.ts`
- Modify: `dev/clicker-platform-v2/app/api/admin/modules/ai-marketing/export/route.ts`
- Modify: `dev/clicker-platform-v2/app/api/admin/modules/ai-marketing/assets/upload/route.ts`
- Modify: `dev/clicker-platform-v2/app/api/admin/modules/ai-marketing/assets/analyze/route.ts`

**Context:** Each file has a local `verify()` function that returns `{ siteId, uid }` — but does NOT verify site membership (IDOR). Anyone with a valid Firebase token can send any `x-site-id` header and access any tenant's campaigns. Fix: replace custom `verify()` with `requireAuthedMember` which verifies token + site membership.

The replacement pattern for every handler:

**Before:**
```typescript
async function verify(req: NextRequest) {
  const siteId = req.headers.get('x-site-id');
  const auth = req.headers.get('authorization');
  if (!siteId || !auth?.startsWith('Bearer ')) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(auth.split('Bearer ')[1]);
    return { siteId, uid: decoded.uid };
  } catch { return null; }
}

export async function GET(req: NextRequest) {
  const session = await verify(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // uses: session.siteId, session.uid
}
```

**After:**
```typescript
import { requireAuthedMember } from '@/lib/api-auth';
// Remove: import { adminAuth, ... } from '@/lib/firebase-admin'; if adminAuth no longer used

export async function GET(req: NextRequest) {
  const auth = await requireAuthedMember(req);
  if (!auth.ok) return auth.res;
  // uses: auth.session.siteId, auth.session.uid
}
```

- [ ] **Step 1: Read all 8 files**

```bash
for f in campaigns/route.ts "campaigns/[id]/route.ts" config/route.ts saved/route.ts generate/route.ts export/route.ts assets/upload/route.ts assets/analyze/route.ts; do
  echo "=== $f ===" && cat "/Users/mac/Documents/AI Project/clicker-platform/dev/clicker-platform-v2/app/api/admin/modules/ai-marketing/$f"
done
```

- [ ] **Step 2: Fix `campaigns/route.ts`**

- Remove the local `verify()` function and `adminAuth` import (keep `adminDb`, `Timestamp` if used)
- Replace `const session = await verify(req)` → `const auth = await requireAuthedMember(req)`
- Replace `if (!session)` → `if (!auth.ok) return auth.res;`
- Replace `session.siteId` → `auth.session.siteId`
- Replace `session.uid` → `auth.session.uid`
- Add `import { requireAuthedMember } from '@/lib/api-auth';`

- [ ] **Step 3: Fix `campaigns/[id]/route.ts`**

Same pattern as Step 2.

- [ ] **Step 4: Fix `config/route.ts`**

Same pattern as Step 2.

- [ ] **Step 5: Fix `saved/route.ts`**

Same pattern as Step 2.

- [ ] **Step 6: Fix `generate/route.ts`**

Same pattern as Step 2.

- [ ] **Step 7: Fix `export/route.ts`**

Same pattern as Step 2.

- [ ] **Step 8: Fix `assets/upload/route.ts`**

Same pattern as Step 2.

- [ ] **Step 9: Fix `assets/analyze/route.ts`**

Same pattern as Step 2.

- [ ] **Step 10: Verify TypeScript compiles**

```bash
cd "/Users/mac/Documents/AI Project/clicker-platform/dev/clicker-platform-v2" && npx tsc --noEmit 2>&1 | grep -E "ai-marketing|api-auth" | head -30
```

Expected: No errors from ai-marketing files.

---

## Task 10: Add `SUPER_ADMIN_EMAIL` Env Var to Backyard

**Files:**
- Check: `dev/backyard/.env.development.local` (or equivalent)

**Context:** `require-superadmin.ts` reads `process.env.SUPER_ADMIN_EMAIL`. This must be set in the backyard env file. The email is currently hardcoded elsewhere in functions — move to env var.

- [ ] **Step 1: Check if env var exists**

```bash
grep -r "SUPER_ADMIN_EMAIL" "/Users/mac/Documents/AI Project/clicker-platform/dev/backyard" 2>/dev/null
grep -r "SUPER_ADMIN_EMAIL" "/Users/mac/Documents/AI Project/clicker-platform/dev/functions" 2>/dev/null
```

- [ ] **Step 2: If missing from backyard env, add it**

Check `dev/backyard/.env.development.local`. If `SUPER_ADMIN_EMAIL` is not there, add:
```
SUPER_ADMIN_EMAIL=<the superadmin email already used in functions>
```

Do not commit this file.

---

## Out of Scope (not in this plan)

- **CBC→GCM migration** (`lib/whatsapp/encryption.ts`) — needs migration strategy for existing encrypted tokens in Firestore
- **Cloud Functions** `createUser/deleteUser/listUsers/removeUserFromSite` — need separate investigation to confirm all callers before adding superadmin check
