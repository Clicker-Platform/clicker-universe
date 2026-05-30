# Member Identity Tier — Plan 2: Cutover & Drop-and-Replace

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-point the purchase flow to write the canonical `accounts/{uid}` member, port the Library entry viewer + Order Status into the member dashboard, then DELETE the legacy per-module buyer system (`buyers/`, `/store/login`, `app/[tenant]/library/*`, `__buyer_session`, profile/onboarding buyer routes) and the `__session` JWT-shape stopgap. The storefront (`/store/[slug]` + `/checkout`) stays canvas-built; only its identity wiring changes.

**Architecture:** The member uid (Firebase) is already the key for orders/library (`buyerId` field holds it). Cutover swaps the *source* of that uid from the buyer-session/`buyers` doc to the member-session/`accounts` doc, and the *read* routes from `app/[tenant]/library/*` to `app/[tenant]/account/*`. Then the now-unreferenced buyer code is removed.

**Tech Stack:** Next.js App Router, Firebase Auth, Firestore (admin + client), Vitest.

**Reference spec:** `superpowers/specs/2026-05-29-member-tier-dashboard-design.md`
**Precondition:** Plan 1 merged (member tier + dashboard + Library surface working additively).

---

## File Structure

**Modify (re-point identity, keep file):**
- `app/[tenant]/store/[slug]/checkout/page.tsx` — resolve member from `__member_session`, not buyer session
- `app/[tenant]/store/[slug]/checkout/CheckoutClient.tsx` — redirect unauthenticated to `/account/login`, not `/store/login`
- `app/api/digital-goods/checkout/route.ts` — ensure `accounts/{uid}` instead of `upsertBuyerAdmin`
- `app/api/digital-goods/files/[fileId]/route.ts` — read `__member_session`, not `__buyer_session`

**Create (port viewers into dashboard):**
- `app/[tenant]/account/library/[entryId]/page.tsx` + client (entry viewer/player)
- `app/[tenant]/account/orders/[orderId]/page.tsx` + client (order status)

**Create (tenant-facing members list):**
- `lib/account/admin-api.ts` — list accounts for a site (admin SDK)
- `app/admin/(dashboard)/members/page.tsx` (or module-appropriate location — pin during execution)

**Delete (drop-and-replace):**
- `lib/modules/digital_goods/buyers.ts`
- `lib/modules/digital_goods/session.ts`
- `app/[tenant]/store/login/` (page, client, verify)
- `app/[tenant]/library/` (entire subtree)
- `app/[tenant]/profile/`, `app/[tenant]/onboarding/` (buyer-session-gated)
- `app/api/digital-goods/auth/[action]/route.ts` (buyer magic-link route)
- `COLLECTION_BUYERS` + `publicRoutes.login/loginVerify/library/...` in `constants.ts`
- `upsertBuyerAdmin` + buyer reads in `server-api.ts`
- `getBuyerSessionCookie` usages in `app/[tenant]/layout.tsx`
- `proxy.ts` JWT-shape `__session` stopgap + `readAdminSessionCookie` helper

---

## Phase 1 — Re-point purchase flow to `accounts/`

### Task 1: Checkout server page resolves member session

**Files:**
- Modify: `app/[tenant]/store/[slug]/checkout/page.tsx:6,20`

- [ ] **Step 1: Read current file** to see how `getBuyerSessionCookie()` → uid is used to gate/prefill checkout.

- [ ] **Step 2: Replace buyer-session resolution with member-session**

Replace:
```ts
import { getBuyerSessionCookie } from '@/lib/modules/digital_goods/session';
// ...
const sessionCookie = await getBuyerSessionCookie();
```
with a member-session read (verify `__member_session` idToken via adminAuth → uid/email). Extract a small helper `getMemberSession()`:

```ts
// lib/account/session.ts
import 'server-only';
import { cookies } from 'next/headers';
import { adminAuth } from '@/lib/firebase-admin';

export async function getMemberSession(): Promise<{ uid: string; email: string } | null> {
  const store = await cookies();
  const idToken = store.get('__member_session')?.value;
  if (!idToken) return null;
  try {
    const d = await adminAuth.verifyIdToken(idToken);
    return d.email ? { uid: d.uid, email: d.email } : null;
  } catch { return null; }
}
```
Use `getMemberSession()` in the checkout page. If null → checkout proceeds as anonymous (email entered in form); if present → prefill/skip auth (spec §3.5).

- [ ] **Step 3: Typecheck**

Run: `pnpm tsc --noEmit` → no errors.

- [ ] **Step 4: Commit**

```bash
git add lib/account/session.ts "app/[tenant]/store/[slug]/checkout/page.tsx"
git commit -m "feat(digital_goods): checkout resolves member session (accounts) not buyer"
```

---

### Task 2: Checkout API ensures `accounts/{uid}`

**Files:**
- Modify: `app/api/digital-goods/checkout/route.ts`

- [ ] **Step 1: Read current route** — note it calls `upsertBuyerAdmin(...)` then `createOrderAdmin(...)` with `buyerId`.

- [ ] **Step 2: Replace `upsertBuyerAdmin` with `ensureAccount`**

```ts
// before:
import { upsertBuyerAdmin, createOrderAdmin } from '@/lib/modules/digital_goods/server-api';
// ...
const uid = await /* resolve uid from email (getOrCreateFirebaseUser-style) */;
await upsertBuyerAdmin(siteId, uid, { email });
// after:
import { createOrderAdmin } from '@/lib/modules/digital_goods/server-api';
import { ensureAccount } from '@/lib/account/server-api';
// ...
const uid = await /* same uid resolution */;
await ensureAccount(siteId, uid, { email, createdVia: 'purchase' });
```
Keep `createOrderAdmin(siteId, { buyerId: uid, ... })` — `buyerId` now holds the member uid. (Field name unchanged to avoid a data migration; it is the member's uid.)

- [ ] **Step 3: Typecheck + run digital_goods tests**

Run: `pnpm test lib/modules/digital_goods && pnpm tsc --noEmit`
Expected: pass. Update any test that asserted `upsertBuyerAdmin` was called → assert `ensureAccount` instead.

- [ ] **Step 4: Commit**

```bash
git add app/api/digital-goods/checkout/route.ts lib/modules/digital_goods/__tests__/
git commit -m "feat(digital_goods): checkout creates member account (accounts/) on purchase"
```

---

### Task 3: File download route reads member session

**Files:**
- Modify: `app/api/digital-goods/files/[fileId]/route.ts:21`

- [ ] **Step 1: Replace cookie read**

```ts
// before:
const sessionCookie = req.cookies.get('__buyer_session')?.value;
// after:
const sessionCookie = req.cookies.get('__member_session')?.value;
```
Verify the downstream uid verification still applies (it verifies the idToken → uid → checks library entitlement). The entitlement check keys on `buyerId == uid`, unchanged.

- [ ] **Step 2: Typecheck**

Run: `pnpm tsc --noEmit` → no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/digital-goods/files/[fileId]/route.ts
git commit -m "feat(digital_goods): PDF download authorizes via member session"
```

---

## Phase 2 — Port Library entry viewer + Order Status into the dashboard

### Task 4: Library entry viewer under /account

**Files:**
- Create: `app/[tenant]/account/library/[entryId]/page.tsx`
- Create: `app/[tenant]/account/library/[entryId]/LibraryEntryClient.tsx`

- [ ] **Step 1: Read the existing viewer** `app/[tenant]/library/[entryId]/page.tsx` + `LibraryEntryClient.tsx` to reuse its rendering (PDF link via signed URL, YouTube embed).

- [ ] **Step 2: Recreate under `/account`**, swapping the auth source from `getBuyerSessionCookie()` to `getMemberSession()` (Task 1 helper), and entitlement check to `entry.buyerId === session.uid`. Keep the rendering logic identical.

- [ ] **Step 3: Manual smoke** — `pnpm dev`, open a library entry from the surface list → content renders for the owning member; a non-owner uid is denied.

- [ ] **Step 4: Commit**

```bash
git add "app/[tenant]/account/library/[entryId]"
git commit -m "feat(account): library entry viewer under member dashboard"
```

---

### Task 5: Order status under /account

**Files:**
- Create: `app/[tenant]/account/orders/[orderId]/page.tsx`
- Create: `app/[tenant]/account/orders/[orderId]/OrderStatusClient.tsx`

- [ ] **Step 1: Read** `app/[tenant]/library/orders/[orderId]/page.tsx` + `OrderStatusClient.tsx`.

- [ ] **Step 2: Recreate under `/account/orders/[orderId]`**, auth via `getMemberSession()`, entitlement `order.buyerId === session.uid`. Update the checkout success redirect (in `CheckoutClient.tsx`) to point at `/${tenant}/account/orders/${orderId}` instead of `/library/orders/...`.

- [ ] **Step 3: Typecheck + manual smoke** — place a test order → redirected to `/account/orders/[id]` → status shows.

- [ ] **Step 4: Commit**

```bash
git add "app/[tenant]/account/orders" "app/[tenant]/store/[slug]/checkout/CheckoutClient.tsx"
git commit -m "feat(account): order status under member dashboard + checkout redirect"
```

---

## Phase 3 — Tenant-facing read-only members list

### Task 6: Admin list API

**Files:**
- Create: `lib/account/admin-api.ts`
- Test: `lib/account/__tests__/admin-api.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/account/__tests__/admin-api.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
const getMock = vi.fn();
vi.mock('@/lib/firebase-admin', () => ({
  adminDb: { collection: () => ({ orderBy: () => ({ get: getMock }) }) },
}));
import { listAccounts } from '../admin-api';
beforeEach(() => getMock.mockReset());

describe('listAccounts', () => {
  it('maps docs to accounts', async () => {
    getMock.mockResolvedValue({ docs: [{ id: 'u1', data: () => ({ email: 'a@b.com', status: 'active' }) }] });
    const r = await listAccounts('s1');
    expect(r[0]).toEqual(expect.objectContaining({ uid: 'u1', email: 'a@b.com', status: 'active' }));
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test lib/account/__tests__/admin-api.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement**

```ts
// lib/account/admin-api.ts
import 'server-only';
import { adminDb } from '@/lib/firebase-admin';
import { COLLECTION_ACCOUNTS } from './constants';
import type { MemberAccount } from './types';

export async function listAccounts(siteId: string): Promise<MemberAccount[]> {
  const snap = await adminDb.collection(`sites/${siteId}/${COLLECTION_ACCOUNTS}`).orderBy('createdAt', 'desc').get();
  return snap.docs.map(d => ({ uid: d.id, ...(d.data() as Omit<MemberAccount, 'uid'>) }));
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test lib/account/__tests__/admin-api.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/account/admin-api.ts lib/account/__tests__/admin-api.test.ts
git commit -m "feat(account): admin list accounts for tenant members view"
```

---

### Task 7: Members list admin page

**Files:**
- Create: `app/admin/(dashboard)/members/page.tsx` (PIN exact location during execution — see note)

> **Pin during execution:** This is tenant-facing admin. Decide placement by matching conventions (CLAUDE.md rule 9): is it a core admin page (`app/admin/(dashboard)/members`) or surfaced via a module? Since the member tier is platform-core (not a module), `app/admin/(dashboard)/members` is correct. Open `app/admin/(dashboard)/settings/team/page.tsx` and `lib/modules/promo/components/PromoListPage.tsx` to match the list-page shell, table styling, empty state, dark-mode classes, and `useSite()` usage.

- [ ] **Step 1: Build a read-only list** using `useSite()` for siteId, calling a small server action / route that wraps `listAccounts(siteId)`. Columns: email, status, createdVia, createdAt. No grant/revoke (deferred). Match the reference list-page styling exactly.

- [ ] **Step 2: Manual smoke** — page lists the test tenant's members; reflects status correctly.

- [ ] **Step 3: Commit**

```bash
git add "app/admin/(dashboard)/members"
git commit -m "feat(account): read-only tenant members list"
```

---

## Phase 4 — Drop the legacy buyer system

> Do this LAST, only after Phases 1–3 verified working. Each deletion step ends with a build to catch dangling imports.

### Task 8: Remove buyer read routes & pages

**Files:**
- Delete: `app/[tenant]/store/login/` (entire dir)
- Delete: `app/[tenant]/library/` (entire dir)
- Delete: `app/[tenant]/profile/`, `app/[tenant]/onboarding/`
- Delete: `app/api/digital-goods/auth/[action]/route.ts`

- [ ] **Step 1: Delete the directories/files**

```bash
git rm -r "app/[tenant]/store/login" "app/[tenant]/library" "app/[tenant]/profile" "app/[tenant]/onboarding" "app/api/digital-goods/auth"
```

- [ ] **Step 2: Build to find dangling references**

Run: `pnpm build`
Expected: failures point to imports of deleted routes / `publicRoutes.library` etc. Fix each (next steps cover the known ones).

- [ ] **Step 3: Commit (after Task 9-10 resolve dangles, or commit together)**

---

### Task 9: Remove buyer session + identity code

**Files:**
- Delete: `lib/modules/digital_goods/buyers.ts`, `lib/modules/digital_goods/session.ts`
- Modify: `app/[tenant]/layout.tsx` — remove `getBuyerSessionCookie` import + usage
- Modify: `lib/modules/digital_goods/server-api.ts` — remove `upsertBuyerAdmin` + buyer reads (keep order/library/product/settings + the `resolveTenantBaseUrl` re-export)
- Modify: `lib/modules/digital_goods/constants.ts` — remove `COLLECTION_BUYERS`, and `login/loginVerify/library/libraryEntry/orderStatus/profile/onboarding` from `publicRoutes` (keep `store/storeItem/checkout`)

- [ ] **Step 1: Delete files**

```bash
git rm lib/modules/digital_goods/buyers.ts lib/modules/digital_goods/session.ts
```

- [ ] **Step 2: Clean `app/[tenant]/layout.tsx`** — remove the buyer-session import and the block that used `sessionCookie`. (Read it first; the layout likely passed buyer context to children — remove that prop threading.)

- [ ] **Step 3: Clean `constants.ts` `publicRoutes`** to:
```ts
export const publicRoutes = (tenant: string) => ({
  store:     `/${tenant}/store`,
  storeItem: (slug: string) => `/${tenant}/store/${slug}`,
  checkout:  (slug: string) => `/${tenant}/store/${slug}/checkout`,
});
```
Remove `COLLECTION_BUYERS`.

- [ ] **Step 4: Clean `server-api.ts`** — delete `upsertBuyerAdmin` and buyer-doc reads; fix the imports line (`COLLECTION_BUYERS` removed).

- [ ] **Step 5: Build + full test suite**

Run: `pnpm build && pnpm test`
Expected: green. Remove/repair any test referencing deleted buyer functions.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(digital_goods): drop legacy buyer identity/session system"
```

---

### Task 10: Remove the `__session` JWT-shape stopgap

**Files:**
- Modify: `proxy.ts` (or wherever `readAdminSessionCookie` / the JWT-shape guard lives — grep first)

- [ ] **Step 1: Locate**

Run: `grep -rn "readAdminSessionCookie\|eyJ\|__buyer_session\|length > 80\|length > 100" proxy.ts middleware.ts lib/ 2>/dev/null`

- [ ] **Step 2: Remove the stopgap.** The admin cookie reader no longer needs to defend against a buyer JWT in `__session`, because buyers never write `__session` anymore (they use `__member_session`). Restore the admin session read to the plain pre-stopgap form (read `__session` as the siteId slug). Keep any unrelated logic.

> **Pin during execution:** confirm NO remaining writer puts a JWT into `__session`. Grep: `grep -rn "__session" app/ lib/ | grep -i set`. The only `__session` writer should be admin TokenBootstrap (slug). If a member writer still touches `__session`, fix that first.

- [ ] **Step 3: Build + manual smoke (the original bug)**

Run: `pnpm build`. Then manually: in one browser, log into admin for tenant A AND log into the member dashboard for tenant A. Confirm admin nav still resolves the correct siteId (no JWT-as-slug, no Access Denied). This is the collision that the whole rethink retires.

- [ ] **Step 4: Commit**

```bash
git add proxy.ts
git commit -m "refactor(auth): remove __session JWT-shape stopgap (collision retired structurally)"
```

---

## Plan 2 Done — Exit criteria

- Purchase (logged-in member → skip auth; anonymous → email → `accounts/{uid}` created `createdVia:purchase`) works; orders/library key on member uid.
- Library entry viewer + order status live under `/account`; storefront still canvas-built.
- Tenant sees a read-only members list.
- Legacy buyer system fully removed: no `buyers/`, no `/store/login`, no `app/[tenant]/library`, no `__buyer_session`, no `__session` JWT stopgap.
- `pnpm build && pnpm test && pnpm tsc --noEmit` all green.
- The original same-browser admin+member collision is gone (verified manually in Task 10).

**Deferred to later phases (NOT in these plans):** Loyalty surface (needs Project A rename), Google auth, Backyard platform member view, explicit grant/revoke UI, buyer-origin split.
