# Member Identity Tier — Plan 1: Foundation (Additive Build)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the per-tenant member identity tier (`accounts/{uid}`), the separate member dashboard shell at `app/[tenant]/account/`, the registry-driven `memberSurface` contract, and re-express digital_goods Library as a member surface — all ADDITIVELY, deleting nothing. The existing buyer system keeps working in parallel until Plan 2 cuts over.

**Architecture:** Reuse the existing `@/lib/auth/magic-link` primitive (`createMagicLinkRoutes`) configured for a new `member` module scope. Member identity is a site-level Firestore doc `sites/{siteId}/accounts/{uid}` (never `members/`, which is staff RBAC). The dashboard is a standalone Next.js route group that reads the module registry, evaluates each module's optional `memberSurface` (`isGranted ?? hasData`), and composes a sidebar + routes. No core→module imports.

**Tech Stack:** Next.js App Router, Firebase Auth (custom-token sign-in), Firestore (client SDK reads / admin SDK writes), existing magic-link infra, Vitest.

**Reference spec:** `superpowers/specs/2026-05-29-member-tier-dashboard-design.md`

**Precondition:** none (Plan 1 is additive; Project A — `membership`→`Loyalty` rename — is NOT required for Plan 1).

---

## File Structure

**New — platform identity:**
- `lib/account/constants.ts` — collection path + module scope id
- `lib/account/types.ts` — `MemberAccount` type
- `lib/account/server-api.ts` — admin-SDK read/upsert (server)
- `lib/account/api.ts` — client-SDK read (client)
- `lib/account/__tests__/server-api.test.ts`

**New — auth route + tenant-url relocation:**
- `lib/auth/tenant-url.ts` — `resolveTenantBaseUrl` relocated out of digital_goods (platform-owned)
- `app/api/account/auth/[action]/route.ts` — magic-link request/verify for member scope
- `app/api/account/session/route.ts` — sets member session after custom-token sign-in (resolves/creates `accounts/{uid}`, flips status)

**New — registry contract:**
- `lib/modules/types.ts` (MODIFY) — add `MemberSurfaceDefinition` + `memberSurface?` field
- `lib/account/surfaces.ts` — composition: read enabled modules → evaluate access → return visible surfaces
- `lib/account/__tests__/surfaces.test.ts`

**New — dashboard shell:**
- `app/[tenant]/account/layout.tsx` — member shell (sidebar + auth guard)
- `app/[tenant]/account/page.tsx` — Home overview
- `app/[tenant]/account/login/page.tsx` + `login/LoginClient.tsx`
- `app/[tenant]/account/login/verify/page.tsx` + `verify/VerifyClient.tsx`
- `app/[tenant]/account/[surface]/page.tsx` — dynamic surface mount
- `components/account/MemberSidebar.tsx` — sidebar primitive
- `components/account/MemberAuthProvider.tsx` — client auth/session context

**New — digital_goods member surface (additive; old buyer Library untouched):**
- `lib/modules/digital_goods/surface.ts` — `hasData` + library fetch keyed by member uid
- `lib/modules/digital_goods/components/LibrarySurface.tsx` — the surface component
- `lib/modules/digital_goods/definitions` registration (MODIFY `lib/modules/definitions.ts`)
- `lib/modules/client-registry` MODIFY — register `digital_goods:LibrarySurface` component key

---

## Phase 1 — Member identity model

### Task 1: Account constants + types

**Files:**
- Create: `lib/account/constants.ts`
- Create: `lib/account/types.ts`

- [ ] **Step 1: Write constants**

```ts
// lib/account/constants.ts
// Platform-level member identity tier. NOT the loyalty module.
// NOT sites/{siteId}/members (that is staff RBAC) — see admin-auth.ts.
export const COLLECTION_ACCOUNTS = 'accounts'; // sites/{siteId}/accounts/{uid}
export const ACCOUNT_MODULE_SCOPE = 'member';  // magic-link `module` scope id for this tier

// Dashboard accent presets (member-chosen; default 'coral'). Each = a CSS-var triple.
export const ACCENT_PRESETS = {
  yellow: { accent: '#FFD93D', fg: '#1a1a1a', soft: '#FFF7D6' },
  green:  { accent: '#22C55E', fg: '#ffffff', soft: '#DCFCE7' },
  coral:  { accent: '#FF6B5E', fg: '#ffffff', soft: '#FFE7E3' },
  indigo: { accent: '#6366F1', fg: '#ffffff', soft: '#EEF0FF' },
} as const;
export type AccentPresetId = keyof typeof ACCENT_PRESETS;
export const DEFAULT_ACCENT_PRESET: AccentPresetId = 'coral';
```

- [ ] **Step 2: Write types**

```ts
// lib/account/types.ts
import type { Timestamp } from 'firebase/firestore';

import type { AccentPresetId } from './constants';

export type MemberAccountStatus = 'pending' | 'active';
export type MemberAccountCreatedVia = 'register' | 'purchase';

export interface MemberAccount {
  uid: string;            // matches doc id; Firebase Auth UID
  email: string;
  fullName?: string;
  status: MemberAccountStatus;        // 'pending' until first real login, then 'active'
  createdVia: MemberAccountCreatedVia;
  accentPreset?: AccentPresetId;      // member-chosen dashboard accent; unset → DEFAULT_ACCENT_PRESET ('coral')
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/account/constants.ts lib/account/types.ts
git commit -m "feat(account): add member identity tier constants and types"
```

---

### Task 2: Server-side account API (admin SDK)

**Files:**
- Create: `lib/account/server-api.ts`
- Test: `lib/account/__tests__/server-api.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/account/__tests__/server-api.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const docMock = vi.fn();
const getMock = vi.fn();
const setMock = vi.fn();

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: { doc: (...a: unknown[]) => { docMock(...a); return { get: getMock, set: setMock }; } },
  Timestamp: { now: () => ({ _now: true }) },
}));

import { getAccount, ensureAccount, markAccountActive } from '../server-api';

beforeEach(() => { docMock.mockReset(); getMock.mockReset(); setMock.mockReset(); });

describe('getAccount', () => {
  it('returns null when missing', async () => {
    getMock.mockResolvedValue({ exists: false });
    expect(await getAccount('site1', 'uid1')).toBeNull();
    expect(docMock).toHaveBeenCalledWith('sites/site1/accounts/uid1');
  });
  it('returns account when present', async () => {
    getMock.mockResolvedValue({ exists: true, data: () => ({ email: 'a@b.com', status: 'active' }) });
    const acc = await getAccount('site1', 'uid1');
    expect(acc?.email).toBe('a@b.com');
    expect(acc?.uid).toBe('uid1');
  });
});

describe('ensureAccount', () => {
  it('creates a pending account when absent', async () => {
    getMock.mockResolvedValue({ exists: false });
    await ensureAccount('site1', 'uid1', { email: 'a@b.com', createdVia: 'purchase' });
    expect(setMock).toHaveBeenCalledTimes(1);
    const written = setMock.mock.calls[0][0];
    expect(written.status).toBe('pending');
    expect(written.createdVia).toBe('purchase');
    expect(written.uid).toBe('uid1');
  });
  it('does not overwrite an existing account', async () => {
    getMock.mockResolvedValue({ exists: true, data: () => ({ email: 'a@b.com', status: 'active' }) });
    await ensureAccount('site1', 'uid1', { email: 'a@b.com', createdVia: 'purchase' });
    expect(setMock).not.toHaveBeenCalled();
  });
});

describe('markAccountActive', () => {
  it('merges status active', async () => {
    await markAccountActive('site1', 'uid1');
    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'active' }),
      { merge: true },
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test lib/account/__tests__/server-api.test.ts`
Expected: FAIL — "Cannot find module '../server-api'".

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/account/server-api.ts
import 'server-only';
import { adminDb, Timestamp } from '@/lib/firebase-admin';
import { COLLECTION_ACCOUNTS } from './constants';
import type { MemberAccount, MemberAccountCreatedVia } from './types';

function accountPath(siteId: string, uid: string) {
  return `sites/${siteId}/${COLLECTION_ACCOUNTS}/${uid}`;
}

export async function getAccount(siteId: string, uid: string): Promise<MemberAccount | null> {
  const snap = await adminDb.doc(accountPath(siteId, uid)).get();
  if (!snap.exists) return null;
  return { uid, ...(snap.data() as Omit<MemberAccount, 'uid'>) };
}

// Create a pending account if absent. Never overwrites an existing one.
export async function ensureAccount(
  siteId: string,
  uid: string,
  data: { email: string; fullName?: string; createdVia: MemberAccountCreatedVia },
): Promise<void> {
  const ref = adminDb.doc(accountPath(siteId, uid));
  const existing = await ref.get();
  if (existing.exists) return;
  const now = Timestamp.now();
  await ref.set({
    uid,
    email: data.email,
    ...(data.fullName ? { fullName: data.fullName } : {}),
    status: 'pending',
    createdVia: data.createdVia,
    createdAt: now,
    updatedAt: now,
  });
}

export async function markAccountActive(siteId: string, uid: string): Promise<void> {
  await adminDb.doc(accountPath(siteId, uid)).set(
    { status: 'active', updatedAt: Timestamp.now() },
    { merge: true },
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test lib/account/__tests__/server-api.test.ts`
Expected: PASS (all assertions).

- [ ] **Step 5: Commit**

```bash
git add lib/account/server-api.ts lib/account/__tests__/server-api.test.ts
git commit -m "feat(account): server-side account read/ensure/markActive (admin SDK)"
```

---

### Task 3: Client-side account read

**Files:**
- Create: `lib/account/api.ts`

- [ ] **Step 1: Write implementation** (thin client read; no test — mirrors digital_goods/buyers.ts client read pattern)

```ts
// lib/account/api.ts
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTION_ACCOUNTS } from './constants';
import type { MemberAccount } from './types';

export async function getAccountClient(siteId: string, uid: string): Promise<MemberAccount | null> {
  const snap = await getDoc(doc(db, 'sites', siteId, COLLECTION_ACCOUNTS, uid));
  if (!snap.exists()) return null;
  return { uid, ...(snap.data() as Omit<MemberAccount, 'uid'>) };
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/account/api.ts
git commit -m "feat(account): client-side account read"
```

---

## Phase 2 — Auth route (reuse magic-link primitive)

### Task 4: Relocate `resolveTenantBaseUrl` to a platform location

**Why:** `lib/auth/magic-link/routes.ts` currently imports `resolveTenantBaseUrl` from `@/lib/modules/digital_goods/server-api` — a platform primitive depending on a module. The member auth route needs it too, and Plan 2 deletes digital_goods buyer code. Relocate now.

**Files:**
- Create: `lib/auth/tenant-url.ts`
- Modify: `lib/auth/magic-link/routes.ts:4`
- Modify: `lib/modules/digital_goods/server-api.ts` (re-export for back-compat until Plan 2)

- [ ] **Step 1: Read the current implementation**

Run: `grep -n "resolveTenantBaseUrl" lib/modules/digital_goods/server-api.ts`
Then read the full function body (it resolves a tenant's base URL from the site doc / host).

- [ ] **Step 2: Move the function verbatim to `lib/auth/tenant-url.ts`**

```ts
// lib/auth/tenant-url.ts
import 'server-only';
// PASTE the exact resolveTenantBaseUrl implementation from digital_goods/server-api.ts here,
// including its imports (adminDb, etc). Export it:
export async function resolveTenantBaseUrl(siteId: string, host?: string): Promise<string> {
  // ... moved body ...
}
```

- [ ] **Step 3: Re-point the magic-link import**

In `lib/auth/magic-link/routes.ts`, change line 4:
```ts
// before:
import { resolveTenantBaseUrl } from '@/lib/modules/digital_goods/server-api';
// after:
import { resolveTenantBaseUrl } from '@/lib/auth/tenant-url';
```

- [ ] **Step 4: Keep digital_goods compiling**

In `lib/modules/digital_goods/server-api.ts`, replace the original definition with a re-export:
```ts
export { resolveTenantBaseUrl } from '@/lib/auth/tenant-url';
```

- [ ] **Step 5: Verify build/typecheck**

Run: `pnpm build` (or `pnpm tsc --noEmit` if available)
Expected: no errors referencing `resolveTenantBaseUrl`.

- [ ] **Step 6: Commit**

```bash
git add lib/auth/tenant-url.ts lib/auth/magic-link/routes.ts lib/modules/digital_goods/server-api.ts
git commit -m "refactor(auth): relocate resolveTenantBaseUrl to platform lib/auth"
```

---

### Task 5: Member magic-link auth route

**Files:**
- Create: `app/api/account/auth/[action]/route.ts`

- [ ] **Step 1: Write the route** (mirrors `app/api/digital-goods/auth/[action]/route.ts`, scoped to `member`)

```ts
// app/api/account/auth/[action]/route.ts
import { NextRequest } from 'next/server';
import { createMagicLinkRoutes } from '@/lib/auth/magic-link';
import { ACCOUNT_MODULE_SCOPE } from '@/lib/account/constants';

export const runtime = 'nodejs';

const { POST_request, POST_verify } = createMagicLinkRoutes({
  module: ACCOUNT_MODULE_SCOPE,
  defaultPurpose: 'masuk ke akun kamu',
  verifyPath: '/account/login/verify',
  getRedirectUrl: (next, tenant) => {
    if (next && next.startsWith('/') && !next.startsWith('//')) return next;
    return `/${tenant}/account`;
  },
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ action: string }> }): Promise<Response> {
  const { action } = await ctx.params;
  if (action === 'request') return POST_request(req);
  if (action === 'verify') return POST_verify(req);
  return new Response('not found', { status: 404 });
}
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/account/auth/[action]/route.ts
git commit -m "feat(account): member magic-link auth route (member scope)"
```

---

### Task 6: Member session endpoint (ensure account + flip status)

**Why:** After the client signs in with the custom token from `/verify`, it calls this endpoint. The endpoint resolves/creates `accounts/{uid}` and flips `status` to `active`. This is the doc-based role resolution seam (spec §6).

**Files:**
- Create: `app/api/account/session/route.ts`
- Test: `lib/account/__tests__/session-handler.test.ts`

- [ ] **Step 1: Write the failing test for the handler logic**

Extract the logic into a testable function `applyMemberSession`.

```ts
// lib/account/__tests__/session-handler.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const ensureAccount = vi.fn();
const markAccountActive = vi.fn();
vi.mock('../server-api', () => ({ ensureAccount, markAccountActive, getAccount: vi.fn() }));

import { applyMemberSession } from '../session-handler';

beforeEach(() => { ensureAccount.mockReset(); markAccountActive.mockReset(); });

describe('applyMemberSession', () => {
  it('ensures account (register) then marks active', async () => {
    await applyMemberSession({ siteId: 's1', uid: 'u1', email: 'a@b.com' });
    expect(ensureAccount).toHaveBeenCalledWith('s1', 'u1', { email: 'a@b.com', createdVia: 'register' });
    expect(markAccountActive).toHaveBeenCalledWith('s1', 'u1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test lib/account/__tests__/session-handler.test.ts`
Expected: FAIL — "Cannot find module '../session-handler'".

- [ ] **Step 3: Write the handler + route**

```ts
// lib/account/session-handler.ts
import 'server-only';
import { ensureAccount, markAccountActive } from './server-api';

// Login through magic-link is, by definition, a member arriving on their own.
// If no account doc exists yet (register-first who never finished, or a buyer
// whose account was made at purchase), ensureAccount is a safe no-op-or-create.
export async function applyMemberSession(input: { siteId: string; uid: string; email: string }): Promise<void> {
  await ensureAccount(input.siteId, input.uid, { email: input.email, createdVia: 'register' });
  await markAccountActive(input.siteId, input.uid);
}
```

```ts
// app/api/account/session/route.ts
import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { applyMemberSession } from '@/lib/account/session-handler';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
const NO_STORE = { 'Cache-Control': 'private, no-store, max-age=0' };

export async function POST(req: NextRequest): Promise<Response> {
  const siteId = req.headers.get('x-site-id');
  if (!siteId) return NextResponse.json({ error: 'no_site' }, { status: 400, headers: NO_STORE });

  let body: { idToken?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad_body' }, { status: 400, headers: NO_STORE }); }

  const idToken = (body.idToken ?? '').trim();
  if (!idToken) return NextResponse.json({ error: 'no_token' }, { status: 400, headers: NO_STORE });

  let decoded;
  try { decoded = await adminAuth.verifyIdToken(idToken); }
  catch (e) { logger.error('account.session.verify_failed', { siteId, error: e }); return NextResponse.json({ error: 'invalid_token' }, { status: 401, headers: NO_STORE }); }

  const email = decoded.email;
  if (!email) return NextResponse.json({ error: 'no_email' }, { status: 400, headers: NO_STORE });

  await applyMemberSession({ siteId, uid: decoded.uid, email });

  // Member session cookie. Name is member-scoped and deliberately NOT __session
  // (admin) — see spec §3.4. Plan 2 removes the legacy __buyer_session/__session
  // overload; this is the clean replacement.
  const res = NextResponse.json({ ok: true }, { status: 200, headers: NO_STORE });
  res.cookies.set('__member_session', idToken, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/',
  });
  return res;
}
```

> **NOTE (pin during execution):** confirm against current `middleware.ts` whether `__member_session` survives the Firebase Hosting CDN (which strips non-`__session` cookies). If it does NOT survive in production, fall back to the same CDN-tolerant approach the buyer flow used, BUT keep it member-scoped and distinct from the admin slug value. This is the spec's one flagged open detail. For localhost dev the custom cookie works as-is.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test lib/account/__tests__/session-handler.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/account/session-handler.ts app/api/account/session/route.ts lib/account/__tests__/session-handler.test.ts
git commit -m "feat(account): member session endpoint ensures account + flips status active"
```

---

## Phase 3 — `memberSurface` registry contract + composition

### Task 7: Add `memberSurface` to ModuleDefinition

**Files:**
- Modify: `lib/modules/types.ts:39` (inside `ModuleDefinition`)

- [ ] **Step 1: Add the type + field**

Append the interface before `ModuleWidgetDefinition`:
```ts
export interface MemberSurfaceDefinition {
  id: string;                 // unique surface id, e.g. 'library'
  label: string;              // sidebar label, e.g. "My Library"
  icon: string;               // icon key (same icon-map keys as AdminRoute.icon)
  route: string;              // e.g. '/library' → mounts at /[tenant]/account/library
  componentKey: string;       // key in the client component registry
  // Explicit grant. If set, it decides visibility. If unset, falls back to hasData.
  isGranted?: (ctx: MemberSurfaceContext) => boolean | Promise<boolean>;
  // Implicit-by-data check used when isGranted is unset.
  // If BOTH are unset, the surface is hidden (no way to know access).
  hasData?: (ctx: MemberSurfaceContext) => boolean | Promise<boolean>;
}

export interface MemberSurfaceContext {
  siteId: string;
  uid: string;
}
```

Inside `ModuleDefinition`, add:
```ts
    memberSurface?: MemberSurfaceDefinition; // member-dashboard surface (spec 2026-05-29)
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm tsc --noEmit`
Expected: no errors (purely additive optional field).

- [ ] **Step 3: Commit**

```bash
git add lib/modules/types.ts
git commit -m "feat(modules): add optional memberSurface to ModuleDefinition"
```

---

### Task 8: Surface composition logic

**Files:**
- Create: `lib/account/surfaces.ts`
- Test: `lib/account/__tests__/surfaces.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/account/__tests__/surfaces.test.ts
import { describe, it, expect } from 'vitest';
import { resolveVisibleSurfaces } from '../surfaces';
import type { ModuleDefinition } from '@/lib/modules/types';

const ctx = { siteId: 's1', uid: 'u1' };

function mod(id: string, surface?: Partial<ModuleDefinition['memberSurface']>): ModuleDefinition {
  return { id, displayName: id, icon: 'box', version: '1', enabled: true,
    ...(surface ? { memberSurface: { id: surface.id ?? id, label: 'L', icon: 'box', route: '/x', componentKey: 'k', ...surface } } : {}) } as ModuleDefinition;
}

describe('resolveVisibleSurfaces', () => {
  it('skips modules without a memberSurface', async () => {
    expect(await resolveVisibleSurfaces([mod('a')], ctx)).toEqual([]);
  });
  it('hides a surface when both isGranted and hasData are unset', async () => {
    expect(await resolveVisibleSurfaces([mod('a', {})], ctx)).toEqual([]);
  });
  it('shows when isGranted returns true (ignores hasData)', async () => {
    const r = await resolveVisibleSurfaces([mod('a', { isGranted: () => true, hasData: () => false })], ctx);
    expect(r).toHaveLength(1);
  });
  it('falls back to hasData when isGranted unset', async () => {
    const yes = await resolveVisibleSurfaces([mod('a', { hasData: () => true })], ctx);
    const no  = await resolveVisibleSurfaces([mod('b', { hasData: () => false })], ctx);
    expect(yes).toHaveLength(1);
    expect(no).toHaveLength(0);
  });
  it('supports async predicates', async () => {
    const r = await resolveVisibleSurfaces([mod('a', { hasData: async () => true })], ctx);
    expect(r).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test lib/account/__tests__/surfaces.test.ts`
Expected: FAIL — "Cannot find module '../surfaces'".

- [ ] **Step 3: Write implementation**

```ts
// lib/account/surfaces.ts
import type { ModuleDefinition, MemberSurfaceContext, MemberSurfaceDefinition } from '@/lib/modules/types';

export interface VisibleSurface {
  moduleId: string;
  surface: MemberSurfaceDefinition;
}

// Core composer. Imports NO module — operates only on registry definitions.
// Visibility: enabled module AND (isGranted() ?? hasData()). Both unset = hidden.
export async function resolveVisibleSurfaces(
  modules: ModuleDefinition[],
  ctx: MemberSurfaceContext,
): Promise<VisibleSurface[]> {
  const out: VisibleSurface[] = [];
  for (const m of modules) {
    if (!m.enabled) continue;
    const s = m.memberSurface;
    if (!s) continue;
    let visible = false;
    if (s.isGranted) visible = await s.isGranted(ctx);
    else if (s.hasData) visible = await s.hasData(ctx);
    if (visible) out.push({ moduleId: m.id, surface: s });
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test lib/account/__tests__/surfaces.test.ts`
Expected: PASS (all 5).

- [ ] **Step 5: Commit**

```bash
git add lib/account/surfaces.ts lib/account/__tests__/surfaces.test.ts
git commit -m "feat(account): registry-driven member surface composition"
```

---

## Phase 4 — Dashboard shell

> NOTE: Before writing each UI file, open the corresponding admin equivalent and the existing buyer login (`app/[tenant]/store/login/`) to match conventions (CLAUDE.md rule 9). The login/verify clients below mirror `LoginClient.tsx` / `VerifyClient.tsx` but POST to `/api/account/auth/*` and `/api/account/session`.

> **VISUAL DIRECTION (validated via wireframes 2026-05-29; reference mockups in `.superpowers/brainstorm/51697-*/content/`):** Build to these, not default Tailwind.
> - **Shell (Task 11):** sidebar-only, NO top bar. Lighter consumer feel, distinct from admin. The `MemberShell` skeleton below already omits a top bar — keep it that way.
> - **Login (Task 10):** branded split — hero panel (tenant brand color + tagline) beside the form; neutral fallback when no brand color set. The minimal-card skeleton below is a starting point; upgrade the page wrapper to the split layout.
> - **Empty Home (Task 11, page.tsx):** friendly centered empty state — greeting + single CTA back to the storefront — shown when the member has zero visible surfaces. (Library cover-led cards live in Task 13.)

### Task 9: Member auth provider (client session context)

**Files:**
- Create: `components/account/MemberAuthProvider.tsx`

- [ ] **Step 1: Implement** (mirrors how the buyer flow signs in with custom token, then posts to the session endpoint)

```tsx
// components/account/MemberAuthProvider.tsx
'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/lib/firebase';

type MemberAuthState = { user: User | null; loading: boolean };
const Ctx = createContext<MemberAuthState>({ user: null, loading: true });

export function useMemberAuth() { return useContext(Ctx); }

export function MemberAuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<MemberAuthState>({ user: null, loading: true });
  useEffect(() => onAuthStateChanged(auth, (user) => setState({ user, loading: false })), []);
  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}
```

- [ ] **Step 2: Commit**

```bash
git add components/account/MemberAuthProvider.tsx
git commit -m "feat(account): client member auth provider"
```

---

### Task 10: Login + verify pages

**Files:**
- Create: `app/[tenant]/account/login/page.tsx`
- Create: `app/[tenant]/account/login/LoginClient.tsx`
- Create: `app/[tenant]/account/login/verify/page.tsx`
- Create: `app/[tenant]/account/login/verify/VerifyClient.tsx`

- [ ] **Step 1: Login page (server) + client**

```tsx
// app/[tenant]/account/login/page.tsx
import { Suspense } from 'react';
import { LoginClient } from './LoginClient';
export const dynamic = 'force-dynamic';
export default async function AccountLoginPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant } = await params;
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-md bg-white rounded-xl shadow border border-gray-200 p-8">
        <Suspense fallback={<div className="text-sm text-gray-500">Loading...</div>}>
          <LoginClient tenant={tenant} />
        </Suspense>
      </div>
    </main>
  );
}
```

```tsx
// app/[tenant]/account/login/LoginClient.tsx
'use client';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Mail, Loader2, CheckCircle2 } from 'lucide-react';
import { logger } from '@/lib/logger-edge';

export function LoginClient({ tenant }: { tenant: string }) {
  const searchParams = useSearchParams();
  const raw = searchParams.get('next') || `/${tenant}/account`;
  const next = (raw.startsWith('/') && !raw.startsWith('//')) ? raw : `/${tenant}/account`;
  const [email, setEmail] = useState('');
  const [step, setStep] = useState<'INPUT' | 'SENT'>('INPUT');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) { setError('Email diperlukan.'); return; }
    setSubmitting(true); setError(null);
    try {
      const res = await fetch('/api/account/auth/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-site-id': tenant },
        body: JSON.stringify({ email, next }),
      });
      if (!res.ok) throw new Error('Gagal mengirim link login.');
      window.localStorage.setItem('memberEmailForSignIn', email);
      setStep('SENT');
    } catch (e: unknown) {
      logger.error('account.login.send.failed', { error: e });
      setError(e instanceof Error ? e.message : 'Gagal mengirim link login.');
    } finally { setSubmitting(false); }
  }

  if (step === 'SENT') {
    return (
      <div className="text-center">
        <CheckCircle2 className="mx-auto text-green-600 mb-3" size={32} />
        <h1 className="text-xl font-bold text-gray-900">Cek email kamu</h1>
        <p className="text-sm text-gray-600 mt-2">Kami sudah mengirim link login ke <strong>{email}</strong>.</p>
        <p className="text-xs text-gray-400 mt-3">Link berlaku 15 menit. Cek folder spam bila perlu.</p>
      </div>
    );
  }
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="text-center mb-6">
        <Mail className="mx-auto text-gray-400 mb-2" size={28} />
        <h1 className="text-2xl font-bold text-gray-900">Masuk</h1>
        <p className="text-sm text-gray-500 mt-1">Kami akan kirim link login ke email kamu.</p>
      </div>
      <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="you@example.com" />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={submitting}
        className="w-full bg-studio-blue text-white px-6 py-3 rounded-lg font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
        {submitting && <Loader2 className="animate-spin w-4 h-4" />} Kirim link login
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Verify page (server) + client**

```tsx
// app/[tenant]/account/login/verify/page.tsx
import { Suspense } from 'react';
import { VerifyClient } from './VerifyClient';
export const dynamic = 'force-dynamic';
export default async function AccountVerifyPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant } = await params;
  return <Suspense fallback={null}><VerifyClient tenant={tenant} /></Suspense>;
}
```

```tsx
// app/[tenant]/account/login/verify/VerifyClient.tsx
'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { logger } from '@/lib/logger-edge';

export function VerifyClient({ tenant }: { tenant: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = params.get('token');
    if (!token) { setError('Link tidak valid.'); return; }
    (async () => {
      try {
        const res = await fetch('/api/account/auth/verify', {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'x-site-id': tenant },
          body: JSON.stringify({ token }),
        });
        if (!res.ok) throw new Error('verify_failed');
        const { customToken, redirectUrl } = await res.json();
        const cred = await signInWithCustomToken(auth, customToken);
        const idToken = await cred.user.getIdToken();
        const sres = await fetch('/api/account/session', {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'x-site-id': tenant },
          body: JSON.stringify({ idToken }),
        });
        if (!sres.ok) throw new Error('session_failed');
        router.replace(redirectUrl || `/${tenant}/account`);
      } catch (e) {
        logger.error('account.verify.failed', { error: e });
        setError('Gagal masuk. Coba minta link baru.');
      }
    })();
  }, [params, router, tenant]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="text-sm text-gray-600">{error ?? 'Memverifikasi link...'}</div>
    </main>
  );
}
```

- [ ] **Step 3: Verify typecheck**

Run: `pnpm tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "app/[tenant]/account/login"
git commit -m "feat(account): member magic-link login + verify pages"
```

---

### Task 11: Member sidebar + shell layout + Home + dynamic surface route

**Files:**
- Create: `components/account/MemberSidebar.tsx`
- Create: `app/[tenant]/account/layout.tsx`
- Create: `app/[tenant]/account/page.tsx`
- Create: `app/[tenant]/account/[surface]/page.tsx`

- [ ] **Step 1: Sidebar primitive**

```tsx
// components/account/MemberSidebar.tsx
'use client';
import Link from 'next/link';
import { Home } from 'lucide-react';

export interface MemberNavItem { label: string; href: string; }

export function MemberSidebar({ tenant, items }: { tenant: string; items: MemberNavItem[] }) {
  return (
    <aside className="w-60 shrink-0 border-r border-gray-200 bg-white p-4 z-40">
      <nav className="space-y-1">
        <Link href={`/${tenant}/account`} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100">
          <Home size={16} /> Home
        </Link>
        {items.map((it) => (
          <Link key={it.href} href={it.href} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100">
            {it.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
```

- [ ] **Step 2: Shell layout** (server component resolves enabled modules + visible surfaces, then renders shell; client auth guard redirects to login)

```tsx
// app/[tenant]/account/layout.tsx
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { MemberAuthProvider } from '@/components/account/MemberAuthProvider';
import { MemberShell } from '@/components/account/MemberShell';

export const dynamic = 'force-dynamic';

export default async function AccountLayout({
  children, params,
}: { children: React.ReactNode; params: Promise<{ tenant: string }> }) {
  const { tenant } = await params;
  return (
    <MemberAuthProvider>
      <MemberShell tenant={tenant}>{children}</MemberShell>
    </MemberAuthProvider>
  );
}
```

> The login/verify routes sit UNDER `account/` but must NOT require auth. Implement `MemberShell` to render children full-bleed (no sidebar, no guard) when the current path is `/account/login*`; otherwise guard + sidebar. Read the current pathname via `usePathname()` in `MemberShell`.

```tsx
// components/account/MemberShell.tsx
'use client';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useMemberAuth } from './MemberAuthProvider';
import { MemberSidebar, MemberNavItem } from './MemberSidebar';

export function MemberShell({ tenant, children }: { tenant: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useMemberAuth();
  const isAuthRoute = pathname?.includes('/account/login');
  const [items, setItems] = useState<MemberNavItem[]>([]);

  useEffect(() => {
    if (isAuthRoute || loading) return;
    if (!user) { router.replace(`/${tenant}/account/login?next=${encodeURIComponent(pathname || '')}`); return; }
    // Fetch visible surfaces for sidebar (server route added in Step 4 below)
    fetch(`/api/account/surfaces`, { headers: { 'x-site-id': tenant } })
      .then(r => r.json())
      .then((d: { items: MemberNavItem[] }) => setItems(d.items ?? []))
      .catch(() => setItems([]));
  }, [isAuthRoute, loading, user, router, tenant, pathname]);

  if (isAuthRoute) return <>{children}</>;
  if (loading || !user) return <div className="min-h-screen flex items-center justify-center text-sm text-gray-500">Loading...</div>;
  return (
    <div className="min-h-screen flex bg-gray-50">
      <MemberSidebar tenant={tenant} items={items} />
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
```

- [ ] **Step 3: Home overview + dynamic surface mount**

```tsx
// app/[tenant]/account/page.tsx
export const dynamic = 'force-dynamic';
export default async function AccountHome({ params }: { params: Promise<{ tenant: string }> }) {
  await params;
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Akun Saya</h1>
      <p className="text-sm text-gray-500">Pilih layanan dari menu di samping.</p>
    </div>
  );
}
```

```tsx
// app/[tenant]/account/[surface]/page.tsx
import { notFound } from 'next/navigation';
import { getEnabledModuleDefinitions } from '@/lib/modules/registry';
import { MODULE_COMPONENTS } from '@/lib/modules/client-registry';

export const dynamic = 'force-dynamic';

export default async function SurfacePage({ params }: { params: Promise<{ tenant: string; surface: string }> }) {
  const { tenant, surface } = await params;
  const mods = await getEnabledModuleDefinitions(); // returns ModuleDefinition[] (enabled)
  const match = mods.find(m => m.memberSurface && m.memberSurface.route === `/${surface}`);
  if (!match || !match.memberSurface) notFound();
  const Component = MODULE_COMPONENTS[match.memberSurface.componentKey];
  if (!Component) notFound();
  return <Component tenant={tenant} />;
}
```

> **Pin during execution:** confirm the exact exported name for "get enabled module definitions" in `lib/modules/registry.ts` (the file already queries `modules` WHERE enabled==true — reuse that; do not add a new query). Confirm the client component map export name in `client-registry.tsx`. Adjust imports to match.

- [ ] **Step 4: Surfaces API (sidebar data)**

```ts
// app/api/account/surfaces/route.ts
import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getEnabledModuleDefinitions } from '@/lib/modules/registry';
import { resolveVisibleSurfaces } from '@/lib/account/surfaces';
import { adminAuth } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

export async function GET(req: NextRequest): Promise<Response> {
  const siteId = req.headers.get('x-site-id');
  if (!siteId) return NextResponse.json({ items: [] });
  // uid resolution: read member session cookie/idToken (pin mechanism per Task 6 note)
  const idToken = req.cookies.get('__member_session')?.value;
  if (!idToken) return NextResponse.json({ items: [] });
  let uid: string;
  try { uid = (await adminAuth.verifyIdToken(idToken)).uid; } catch { return NextResponse.json({ items: [] }); }

  const mods = await getEnabledModuleDefinitions();
  const visible = await resolveVisibleSurfaces(mods, { siteId, uid });
  return NextResponse.json({
    items: visible.map(v => ({ label: v.surface.label, href: `/${siteId}/account${v.surface.route}` })),
  });
}
```

- [ ] **Step 5: Verify typecheck + manual smoke**

Run: `pnpm tsc --noEmit` → no errors.
Manual: `pnpm dev`, visit `/<tenant>/account` → redirected to `/account/login` when logged out. (Full surface render verified in Task 13.)

- [ ] **Step 6: Commit**

```bash
git add "app/[tenant]/account" "app/api/account/surfaces" components/account/MemberShell.tsx components/account/MemberSidebar.tsx
git commit -m "feat(account): member dashboard shell, sidebar, home, dynamic surface route"
```

---

## Phase 5 — digital_goods Library as a member surface (additive)

### Task 12: Library surface data (hasData + fetch by member uid)

**Files:**
- Create: `lib/modules/digital_goods/surface.ts`
- Test: `lib/modules/digital_goods/__tests__/surface.test.ts`

> The existing `library.ts` keys library entries by `buyerId`. In the member model the member's `uid` IS the key (same Firebase uid). `hasData` returns true when the member has ≥ 1 library entry under their uid.

- [ ] **Step 1: Write the failing test**

```ts
// lib/modules/digital_goods/__tests__/surface.test.ts
import { describe, it, expect, vi } from 'vitest';
const getDocs = vi.fn();
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(), query: vi.fn(), where: vi.fn(), limit: vi.fn(), orderBy: vi.fn(),
  getDocs: (...a: unknown[]) => getDocs(...a),
}));
vi.mock('@/lib/firebase', () => ({ db: {} }));
import { libraryHasData } from '../surface';

describe('libraryHasData', () => {
  it('true when entries exist', async () => {
    getDocs.mockResolvedValue({ empty: false });
    expect(await libraryHasData({ siteId: 's1', uid: 'u1' })).toBe(true);
  });
  it('false when none', async () => {
    getDocs.mockResolvedValue({ empty: true });
    expect(await libraryHasData({ siteId: 's1', uid: 'u1' })).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test lib/modules/digital_goods/__tests__/surface.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// lib/modules/digital_goods/surface.ts
import { collection, query, where, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTION_LIBRARY } from './constants';
import { getLibraryForBuyer } from './library';
import type { MemberSurfaceContext } from '@/lib/modules/types';
import type { LibraryEntry } from './types';

export async function libraryHasData(ctx: MemberSurfaceContext): Promise<boolean> {
  const q = query(
    collection(db, 'sites', ctx.siteId, COLLECTION_LIBRARY),
    where('buyerId', '==', ctx.uid),
    limit(1),
  );
  const snap = await getDocs(q);
  return !snap.empty;
}

// Member uid is the library key (same Firebase uid the order was placed under).
export async function getLibraryForMember(ctx: MemberSurfaceContext): Promise<LibraryEntry[]> {
  return getLibraryForBuyer(ctx.siteId, ctx.uid);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test lib/modules/digital_goods/__tests__/surface.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/modules/digital_goods/surface.ts lib/modules/digital_goods/__tests__/surface.test.ts
git commit -m "feat(digital_goods): library member-surface data (hasData + fetch by uid)"
```

---

### Task 13: Library surface component + registration

**Files:**
- Create: `lib/modules/digital_goods/components/LibrarySurface.tsx`
- Modify: `lib/modules/definitions.ts:90-97` (add `memberSurface` to `digital_goods`)
- Modify: client component registry (register `digital_goods:LibrarySurface`)

> Match the existing buyer Library UI (`app/[tenant]/library/page.tsx`) for card layout, empty state, dark mode (CLAUDE.md rule 9). Read it first.

- [ ] **Step 1: Surface component** (client; reads member auth uid, fetches entries)

```tsx
// lib/modules/digital_goods/components/LibrarySurface.tsx
'use client';
import { useEffect, useState } from 'react';
import { useMemberAuth } from '@/components/account/MemberAuthProvider';
import { getLibraryForMember } from '../surface';
import type { LibraryEntry } from '../types';

export default function LibrarySurface({ tenant }: { tenant: string }) {
  const { user } = useMemberAuth();
  const [entries, setEntries] = useState<LibraryEntry[] | null>(null);
  useEffect(() => {
    if (!user) return;
    getLibraryForMember({ siteId: tenant, uid: user.uid }).then(setEntries).catch(() => setEntries([]));
  }, [user, tenant]);

  if (entries === null) return <div className="text-sm text-gray-500">Loading...</div>;
  if (entries.length === 0) return <div className="text-sm text-gray-500">Belum ada produk di library kamu.</div>;
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">My Library</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {entries.map(e => (
          <a key={e.id} href={`/${tenant}/account/library/${e.id}`} className="block rounded-xl border border-gray-200 bg-white p-4 hover:shadow">
            <div className="font-semibold text-gray-900">{e.productSnapshot.title}</div>
            <div className="text-xs text-gray-500 mt-1">{e.productSnapshot.contentKind.toUpperCase()}</div>
          </a>
        ))}
      </div>
    </div>
  );
}
```

> NOTE: the per-entry route `/account/library/[entryId]` (the entry viewer/player) is a follow-up; for Plan 1, listing is sufficient to prove the surface. Entry viewer can reuse the existing `LibraryEntryClient` logic in Plan 2 cutover.

- [ ] **Step 2: Register the component key**

Open the client component registry (grep: `grep -rn "digital_goods:OrdersList\|MODULE_COMPONENTS" lib/modules/client-registry*`). Add:
```ts
'digital_goods:LibrarySurface': dynamic(() => import('@/lib/modules/digital_goods/components/LibrarySurface')),
```
Match the existing dynamic-import registration style in that file exactly.

- [ ] **Step 3: Declare the memberSurface**

In `lib/modules/definitions.ts`, update the `digital_goods` entry:
```ts
    'digital_goods': {
        adminRoutes: [
            { label: 'Products', path: '/admin/digital-goods',          icon: 'shopping-bag', componentKey: 'digital_goods:ProductsList' },
            { label: 'Orders',   path: '/admin/digital-goods/orders',   icon: 'receipt',      componentKey: 'digital_goods:OrdersList'  },
            { label: 'Settings', path: '/admin/digital-goods/settings', icon: 'settings',     componentKey: 'digital_goods:Settings',    permission: 'settings' }
        ],
        dashboardAction: { label: 'View Products', href: '/admin/digital-goods' },
        memberSurface: {
            id: 'library',
            label: 'My Library',
            icon: 'box',
            route: '/library',
            componentKey: 'digital_goods:LibrarySurface',
            // no isGranted → implicit-by-data via hasData
            hasData: (ctx) => import('@/lib/modules/digital_goods/surface').then(m => m.libraryHasData(ctx)),
        },
    },
```

> **Pin during execution:** `STATIC_MODULE_DEFINITIONS` is typed `Record<string, Partial<ModuleDefinition>>` and `memberSurface.hasData` is a function. Confirm the registry merges static defs into the Firestore-backed `ModuleDefinition` at the point where `getEnabledModuleDefinitions` returns — i.e. the function predicates come from STATIC defs, not Firestore (Firestore can't hold functions). If `getEnabledModuleDefinitions` does NOT currently merge `STATIC_MODULE_DEFINITIONS`, add that merge so `memberSurface` (with its function predicates) is present on the returned definitions. This is the one integration point to verify carefully.

- [ ] **Step 4: Manual smoke test**

Run: `pnpm dev`.
1. Ensure `digital_goods` enabled for a test tenant with ≥1 existing library entry whose `buyerId` matches a Firebase uid.
2. Log in at `/<tenant>/account/login` with that uid's email → magic link → land on `/account`.
3. Sidebar shows "My Library". Click → entries render.
4. Tenant with no library entries for that member → "My Library" absent from sidebar.

- [ ] **Step 5: Run full test suite + typecheck**

Run: `pnpm test && pnpm tsc --noEmit`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add lib/modules/digital_goods/components/LibrarySurface.tsx lib/modules/definitions.ts lib/modules/client-registry.tsx
git commit -m "feat(digital_goods): register Library as a member-dashboard surface"
```

---

## Plan 1 Done — Exit criteria

- New member tier works end-to-end: register/login via magic link → `accounts/{uid}` created/activated → dashboard shell → Library surface lists purchased items, gated by `hasData`.
- NOTHING deleted: old `/store/login`, `buyers/`, `app/[tenant]/library/*`, `__buyer_session`, proxy stopgap all still present and functional.
- All new logic unit-tested; suite + typecheck green.

**Next:** Plan 2 (`2026-05-29-member-tier-plan-2-cutover.md`) — re-point checkout to write `accounts/`, port the Library entry viewer, then delete the legacy buyer system and the `__session` stopgap.
