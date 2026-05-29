# Member Identity Tier & Unified Member Dashboard — Design

**Date:** 2026-05-29
**Status:** Design approved, ready for implementation planning
**Project:** B (depends on Project A — `membership` → `Loyalty` rename — only for the Loyalty *surface*, not for this build)

---

## 0. Naming & the central concept

A **"member"** is a **per-tenant identity tier**: an authenticated end-user of *one* merchant. A visitor becomes a member of a tenant either by registering first (classic) or by purchasing (purchase-triggered). Membership is scoped to a single tenant — the same person at a different Clicker tenant registers again (different tenant = different membership), even though Firebase identity is shared underneath.

> **CRITICAL: "Member" here is NOT the `membership` module.** It has **nothing** to do with the loyalty/points module currently named `membership`. This is a new platform-level identity tier. The naming collision with that module is incidental and must not lead to any coupling. The loyalty module is touched by this project only later, as one *optional module surface*, never as an identity source.

This turns each tenant account into a platform for its own business: once a member, the end-user can access any service the tenant has enabled and that the member has been granted — Library today; asset management, consultation, chat-based services tomorrow — all through one dashboard, not bespoke per-module pages or canvas blocks.

This also retires the `__session` cookie collision (admin-slug vs buyer-JWT on one origin) structurally, by establishing one coherent member identity tier with its own shell instead of competing per-module identity systems.

---

## 1. Settled decisions (reference)

1. **Member** = per-tenant identity tier (register-first OR purchase-triggered), distinct from loyalty.
2. **Separate member dashboard shell** — own route/namespace, shares extracted UI primitives (sidebar, cards, theme, dark-mode) but NOT admin layout/routing. Safety over duplication cost.
3. **Everything module-based** — a surface appears only when its module is enabled for the merchant AND granted to the member.
4. **`membership` → `Loyalty` rename = separate blocker project (Project A).** This spec designs Project B. The rename blocks only the *Loyalty surface* (v1.1), not the member-tier build — the two run in parallel.
5. **Drop & replace** the existing per-module buyer/member systems — no migration (no production buyer data; current code is test-only and problematic).
6. **Registry-driven member surfaces** — modules self-declare a `memberSurface`; dashboard composes. Core never imports modules (CLAUDE.md rule 1).
7. **Grant model = "A-now, C-ready"** — implicit-by-data default now; optional `isGranted()` predicate for future explicit grants. No rewrite to reach explicit grants.
8. **Canonical member doc** at site level: `sites/{siteId}/accounts/{uid}` (NOT `members/`, which is staff RBAC; NOT inside loyalty paths).
9. **Magic-link v1** — provider-agnostic identity, one-account-per-email, per-tenant Resend branding, tenant-scoped post-login routing, doc-based role resolution. Google auth deferred to v1.1 (zero schema change).
10. **Purchase flow A** — skip auth if already logged in as a member of this tenant; otherwise create member on successful order. `status` field distinguishes never-logged-in from active.
11. **Dashboard IA = persistent shell** — sidebar with Home + one nav entry per granted surface; defaults to Home.
12. **Tenant member admin = read-only members list** in v1 (reads `accounts/`). Manual grant/revoke deferred.
13. **Platform stance (1)** — full Backyard visibility incl. PII drill-down, owned/accessed from Backyard. Data model supports it; dev deferred, no v1 code.

---

## 2. Ground-truth findings (verified against current code 2026-05-29)

- **`sites/{siteId}/members/{uid}` is the staff/admin RBAC primitive.** `lib/admin-auth.ts` runs a `collectionGroup(db, 'members')` query keyed by email to resolve which sites a person can administer. The new customer-member tier **must not** reuse `members/` — it would conflate customers with staff in that query (security boundary violation). → resolved by decision #8 (`accounts/`).
- **`app/member/` is the loyalty (membership) module's portal** — `app/member/dashboard/page.tsx` imports `MemberDashboard` from `lib/modules/membership/` and gates on `isModuleEnabled('membership')`. It is superseded by the new dashboard and folds in during Project A (v1.1). **Left untouched in v1.**
- **digital_goods buyer system is fully built** (the problematic test-only system being replaced): `lib/modules/digital_goods/{buyers,library,session,orders}.ts`, `constants.ts` (`COLLECTION_BUYERS = 'modules/digital_goods/buyers'`, `COLLECTION_LIBRARY = 'modules/digital_goods/library'`), routes `app/[tenant]/store/login/*` and `app/[tenant]/library/*`.
- **Storefront stays:** `app/[tenant]/store/[slug]` + `app/[tenant]/store/[slug]/checkout` are the public canvas-built buy flow that survives (re-pointed to write `accounts/`).

---

## 3. Architecture

### 3.1 Identity model

Canonical member doc: **`sites/{siteId}/accounts/{uid}`**

| Field | Notes |
|-------|-------|
| `email` | resolved from Firebase identity (email-keyed) |
| `status` | `pending` / `registered` (doc exists, never completed a login session) → `active` (logged in ≥ once) |
| `createdAt` | timestamp |
| `createdVia` | `register` \| `purchase` |
| profile basics | name, etc. (minimal v1) |

- Keyed by Firebase `uid`. Provider-agnostic — no `loginMethod` field gating access.
- One-account-per-email (Firebase "one account per email" / account linking). Adding Google later resolves to the same `uid` → same `accounts/` doc → no duplicate member, zero schema change.
- Site-level. Fully decoupled from the loyalty module and from staff `members/`.

### 3.2 Dashboard shell & routing

Member dashboard lives at **`app/[tenant]/account/`** (tenant-scoped routes live under `app/[tenant]/`, per platform rule):

- `app/[tenant]/account/layout.tsx` — separate shell: member sidebar (Home + one entry per granted surface) + theme + dark-mode. Shares **extracted primitives** with admin (sidebar component, cards, theme tokens) — NOT admin layout/routing. "Shared primitives" is a real extraction step.
- `/[tenant]/account` — Home overview (default landing; persistent Home nav item).
- `/[tenant]/account/login` + `/[tenant]/account/login/verify` — magic-link.
- `/[tenant]/account/{surfaceRoute}` — each granted module surface (e.g. `/[tenant]/account/library`).
- **Forward-compat:** the entire `[tenant]/account` subtree can relocate to a buyer origin as one unit when the origin split happens later. Seam noted; not v1.

**Visual direction (validated via wireframes 2026-05-29; mockups in `.superpowers/brainstorm/`):**
- **Shell:** sidebar-only — NO top bar. Lighter consumer/storefront feel, deliberately distinct from the admin shell.
- **Library surface:** cover-led cards (large cover image per item, store-like/premium), responsive grid. Video items show a play overlay; PDF items show the cover.
- **Login (`/account/login`):** branded split — a hero panel (tenant brand color + tagline) beside the email form. Falls back gracefully to a neutral panel when the tenant has no brand color/theme tokens set.
- **Empty Home (logged in, zero granted surfaces):** friendly centered empty state — illustration + greeting + single CTA back to the storefront ("Lihat produk →"). Must read as intentional, not broken.

### 3.3 `memberSurface` registry contract

A module optionally declares a member-facing surface in its definition (mirrors existing admin-nav registry pattern):

```ts
memberSurface?: {
  id: string;
  label: string;                 // "My Library"
  icon: IconType;
  route: string;                 // "/library" → mounts at /[tenant]/account/library
  component: LazyComponent;      // surface UI
  isGranted?: (ctx) => boolean | Promise<boolean>;   // explicit grant (decision #7); unset = implicit-by-data
  hasData?:   (ctx) => boolean | Promise<boolean>;    // cheap "does this member have anything here?" — used by implicit default
}
```

**Dashboard composition (core-side, imports no module):**
1. Read enabled modules for the tenant (existing registry).
2. For each enabled module with a `memberSurface`, evaluate access:
   - `isGranted` set → call it.
   - `isGranted` unset → call `hasData` (implicit-by-data default).
3. Render sidebar entry + route only for surfaces that pass.

**Visibility rule:** surface appears when **module enabled AND (`isGranted()` ‖ `hasData()`)**. Core stays a dumb composer; modules self-declare; a new module gets a member surface for free by declaring one. No module internals leak into core.

### 3.4 Auth & session

- **Magic-link v1** at `/[tenant]/account/login` → `/verify`. Reuses Resend foundation; per-tenant branding via `sendEmail({ siteId, to, templateAlias, variables })`.
- **Post-login resolution:** after Firebase auth, resolve `sites/{siteId}/accounts/{uid}`. Exists → flip `status` → `active`. Missing + register-first → create (`createdVia: register`). Provider-agnostic.
- **Tenant-scoped routing:** magic link carries tenant context; verify lands on that tenant's `/[tenant]/account`.
- **Session separation (the collision fix):** member session must NOT reuse the overloaded `__session` admin cookie. The separate `[tenant]/account` shell + a member-scoped session means admin routing (`proxy.ts`) never sees a member JWT. The JWT-shape stopgap in `proxy.ts` and the `__buyer_session` machinery are **removed** under drop-and-replace — structural separation replaces the band-aid.
  - *Open implementation detail (pin during planning, do not guess):* exact member-cookie name/mechanism, verified against current `middleware.ts` / `proxy.ts`.

### 3.5 Purchase flow (decision #10, flow A)

- **Logged-in member of this tenant** → checkout skips auth; order attaches to existing `uid`. Email field pre-filled/hidden.
- **Anonymous visitor** → enters email at checkout → on successful order, resolve/create `uid` + `accounts/{uid}` (`status: pending`, `createdVia: purchase`) → grant Library (implicit-by-data) → later magic-link login to same email lands on same `uid` + doc.
- **Expired session** → behaves like anonymous at point of sale but resolves to the existing `uid` (no duplicate); `status` flips to `active` on next real login.
- Storefront (`/[tenant]/store/[slug]` + `/checkout`) stays canvas-built; re-pointed to write `accounts/`, not `buyers/`.

---

## 4. Drop-and-replace (digital_goods)

**Delete:**
- `lib/modules/digital_goods/buyers.ts` and `COLLECTION_BUYERS`
- `app/[tenant]/store/login/*` (login + verify)
- legacy buyer-Library routes `app/[tenant]/library/*`
- buyer-cookie bits in `session.ts`; `__buyer_session` machinery; `proxy.ts` JWT-shape `__session` stopgap

**Re-point:**
- `orders.ts` / checkout write to `sites/{siteId}/accounts/{uid}` instead of `buyers/`
- `library.ts` stays as the data layer, now read by the new `memberSurface` component mounted at `/[tenant]/account/library`

**Becomes a member surface:**
- Library → digital_goods declares `memberSurface` (`id: 'library'`, `label: "My Library"`, `route: '/library'`, `hasData` = member has ≥ 1 library entry). No `isGranted` (implicit-by-data).

**Untouched in v1:**
- Loyalty's `app/member/` portal — folds into the dashboard during Project A (v1.1).

---

## 5. v1 scope boundary

**v1 ships:**
- `accounts/{uid}` member identity tier
- `app/[tenant]/account/` separate shell — persistent sidebar, Home overview, magic-link login
- `memberSurface` registry contract (`isGranted?` + `hasData?`)
- digital_goods Library re-expressed as a member surface
- purchase flow re-pointed to `accounts/`
- drop-and-replace removals (above)
- storefront stays canvas (unchanged)
- tenant-facing **read-only members list** (reads `accounts/`)

**Deferred (explicitly NOT v1):**
- **Loyalty surface** → v1.1, blocked by Project A (rename). Separate spec; parallelizable with B.
- **Google auth** → v1.1, zero schema change.
- **Backyard platform member visibility (PII drill-down)** → deferred Backyard task; data model supports; stance (1) recorded.
- **Explicit tenant grant/revoke UI** → deferred until a module needs it; `isGranted` path designed-in.
- **Future services** (consultation, asset mgmt, chat) → prove registry extensibility later.
- **Buyer-origin split** → forward-compat seam noted; not v1.

---

## 6. Boundaries & invariants (for implementation)

- Core/dashboard imports **no module** — composition is registry-driven only (CLAUDE.md rule 1).
- New tier never reads/writes `members/` (staff RBAC) — only `accounts/`.
- Member role resolution is **doc-based** (`accounts/{uid}`), never inferred from bare Firebase identity; a member session can never resolve into an admin surface even with a shared `uid`.
- Loyalty module is not an identity source and is not coupled here (CLAUDE.md rule 10).
- Member data nests per existing convention; module per-member data stays under each module's own paths keyed by `uid`.
