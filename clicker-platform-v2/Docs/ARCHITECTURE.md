# Clicker Platform — Global Architecture Reference

> **Purpose:** Single source of truth for the Clicker Platform architecture. Read this before adding any feature, module, or template.
> **Last updated:** 2026-05-14

---

## Table of Contents

### Part I — Foundation
1. [System Overview](#1-system-overview)
2. [Repository Structure](#2-repository-structure)
3. [Multi-Tenant Routing](#3-multi-tenant-routing)
4. [Authentication & Session Handoff](#4-authentication--session-handoff)
5. [RBAC & Roles](#5-rbac--roles)

### Part II — Extension Points
6. [Core vs. Module Boundary](#6-core-vs-module-boundary)
7. [Module System](#7-module-system)
8. [Template & Theme System](#8-template--theme-system)
9. [Block System (Canvas Studio)](#9-block-system-canvas-studio)

### Part III — Cross-Cutting Subsystems
10. [AI Platform & Kredit](#10-ai-platform--kredit)
11. [Email (Resend)](#11-email-resend)
12. [Analytics (PostHog)](#12-analytics-posthog)
13. [WhatsApp Integration](#13-whatsapp-integration)
14. [Registration Flow](#14-registration-flow)
15. [Promo Engine Facade](#15-promo-engine-facade)
16. [Core Business Primitives](#16-core-business-primitives)
17. [Storage & Upload](#17-storage--upload)

### Part IV — Conventions & References
18. [Global Contexts](#18-global-contexts)
19. [Database Paths](#19-database-paths)
20. [API Routes](#20-api-routes)
21. [Admin UI Conventions](#21-admin-ui-conventions)
22. [Key File Index](#22-key-file-index)
23. [Data Flow Diagrams](#23-data-flow-diagrams)
24. [Appendices](#24-appendices)

---

## 1. System Overview

The **Clicker Platform** is a multi-tenant SaaS where each tenant (a business) gets:

- A **public biolink/website** at `/{tenantSlug}` (path-based) or `{tenantSlug}.clicker.id` (subdomain).
- An **admin dashboard** at `/admin` (subdomain-enforced in production via auth gateway).
- A choice of **template/theme** from 6 prebuilt designs (see §8).
- A library of **opt-in modules** — 12 registered (POS, Membership, Inventory, Stocklens, Reservation, AI Sales, Sales Pipeline, Service Records, FinTrack, Promo, AI Marketing, plus the in-progress AI Platform module — see §7).

The platform is delivered as part of a small monorepo (`clicker-platform-v2/`) with two sibling apps for auth and superadmin and a Firebase Functions service. See §2 for the repo layout.

### Tech Stack

Versions reflect `clicker-platform-v2/package.json` as of 2026-05-14.

| Layer | Library | Version |
|---|---|---|
| Framework | Next.js | 16.1.6 (App Router, webpack build) |
| | React | 19.2.3 |
| | TypeScript | 5.x |
| | Node | 22 (pinned in `engines`) |
| Data | `firebase` (client SDK) | 12.7.0 |
| | `firebase-admin` (server SDK) | 13.6.0 |
| Styling | Tailwind CSS | v4 (+ `@tailwindcss/postcss`, `@tailwindcss/typography`) |
| UI primitives | `@dnd-kit/core`, `/sortable`, `/utilities` | drag & drop |
| | `lucide-react` | icons |
| | `sonner` | toasts |
| | `qrcode.react` | QR rendering |
| | `lottie-react` | animations |
| Content | `@tiptap/*` | v3 (rich text — core, react, starter-kit, image, link, placeholder) |
| | `isomorphic-dompurify` | HTML sanitization |
| AI | `@google/generative-ai` | 0.24.x (Gemini — see §10) |
| Analytics | `posthog-js` | 1.372.x (see §12) |
| PDF | `@react-pdf/renderer` | warranty card generation |
| | `pdf-parse` | knowledge ingest |
| Image | `sharp` | server-side resize (pinned 0.33.5) |
| Cache / rate-limit | `@upstash/redis` | Upstash (registration rate-limit, etc.) |
| Knowledge sync | `cheerio` | HTML scraping for AI knowledge base |
| Utilities | `date-fns`, `date-fns-tz`, `clsx`, `tailwind-merge`, `uuid`, `dotenv` | |
| Testing | Vitest, @testing-library/react, jsdom | unit + component |

> **Email** (Resend) is invoked over HTTP from the platform but the SDK lives in `auth-gateway/` and `functions/` — see §11.

### Monorepo Siblings

| App | Port | Purpose |
|---|---|---|
| `clicker-platform-v2/` | 3000 | This app — the multi-tenant platform |
| `auth-gateway/` | 3012 | Centralized login; mints custom tokens (§4) |
| `backyard/` | 3011 | Internal superadmin (tenants, modules, identities) |
| `functions/` | — | Firebase Cloud Functions (legacy + email + cron) |

---

## 2. Repository Structure

### Monorepo Root (`clicker-universe/dev/`)

```
clicker-universe/dev/
├── clicker-platform-v2/    ← Main platform (THIS document scopes here)
├── auth-gateway/           ← Centralized login (auth.clicker.id, port 3012) — §4
├── backyard/               ← Superadmin God Mode dashboard (port 3011)
├── functions/              ← Firebase Cloud Functions (legacy + cron + email)
├── scripts/                ← Deployment & utility scripts
├── docs/                   ← Cross-repo notes (separate from clicker-platform-v2/docs/)
├── superpowers/            ← Brainstorm, spec, plan, audit-note output (per CLAUDE.md)
├── tests/                  ← Cross-repo integration tests
├── CLAUDE.md, AGENTS.md    ← Agent guidance (defer to this doc — see CLAUDE.md preamble)
├── Makefile, package.json, pnpm-lock.yaml, firebase.json
```

### Platform Top-Level (`clicker-platform-v2/`)

```
clicker-platform-v2/
├── app/                    ← Next.js App Router (all routes — §3, §20)
├── components/             ← React components
├── lib/                    ← Business logic, contexts, modules, templates, subsystems
├── data/                   ← Static mock/seed data
├── hooks/                  ← Shared custom React hooks
├── scripts/                ← DB seed & admin scripts
├── docs/                   ← This document + related architecture notes
├── public/                 ← Static assets
├── patches/, legacy/       ← Migration / legacy artifacts
├── middleware.ts           ← Multi-tenant routing logic (§3)
├── firestore.rules         ← Firestore security rules
├── storage.rules           ← Firebase Storage security rules
├── next.config.mjs, tsconfig.json, eslint.config.mjs, vitest.config.ts, postcss.config.mjs
├── package.json            ← See §1 for full dependency inventory
```

### `lib/` Subsystem Inventory

`lib/` is the most fragmented part of the codebase — it holds business logic, global contexts, subsystem implementations, and module definitions. **Subdirectories** (top-level `lib/{name}/`):

| Path | Purpose | Reference |
|---|---|---|
| `lib/admin/` | Admin-only helpers (server-action wrappers, etc.) | — |
| `lib/ai/` | Gemini client, Kredit accounting, model selection, pricing | §10 |
| `lib/analytics/` | PostHog provider + `useAnalytics()` | §12 |
| `lib/cache/` | Cache invalidation helpers (Upstash + in-memory) | — |
| `lib/core/` | Cross-module business primitives (business hours, service catalog) | §16 |
| `lib/email/` | Resend integration (`sendEmail()`, guard, log) | §11 |
| `lib/forms/` | Form schema/validation helpers (used by Forms + Inbox + Registration) | — |
| `lib/hooks/` | Shared React hooks not bound to a specific subsystem | — |
| `lib/media/` | Media recommendations (sizing/aspect guidance) | §17 |
| `lib/modules/` | All module definitions, registry, and per-module code | §7 |
| `lib/registration/` | Public lead capture (`/register`) — bundles, modules catalog, slug, rate-limit | §14 |
| `lib/secrets/` | Firebase secret resolution helpers | — |
| `lib/templates/` | Template definitions and runtime registry | §8 |
| `lib/utils/` | Generic utilities | — |
| `lib/whatsapp/` | WA Cloud API: gateway, webhook processor, message router, encryption | §13 |

**Top-level files** (`lib/*.ts(x)`):

| File | Purpose |
|---|---|
| `admin-auth.ts` | Admin route auth gating helpers |
| `api-auth.ts` | API route auth (server-side identity resolution) |
| `fetchData.ts` | Shared data-fetching helpers |
| `firebase.ts` | Firebase client SDK init (client components) |
| `firebase-admin.ts` | Firebase Admin SDK init (server / API routes) |
| `imageUtils.ts` | Client-side image preview / compression |
| `inbox-panel-context.tsx` | Global state for the right-side inbox panel (§18) |
| `logger.ts`, `logger-edge.ts` | Structured logging (edge-safe variant for middleware) |
| `rbac.ts` | Roles, PERMISSIONS map (§5) |
| `resolveNavHref.ts` | Module/route nav href resolution |
| `sanitizeHtml.ts` | Wrapper around isomorphic-dompurify |
| `site-context.tsx` | `useSite()` provider — current tenant (§18) |
| `systemBlocks.ts` | System block definitions (used by Homepage block layout) |
| `top-bar-slot-context.tsx` | Admin top-bar slot injection (§18) |
| `upload.ts` | Client-side storage upload helpers (§17) |
| `use-admin-theme.tsx` | Admin light/dark mode (§18, §21) |
| `use-admin-nav-groups.ts` | Sidebar nav grouping |
| `use-admin-unread-counts.ts` | Sidebar unread badges |
| `user-context.tsx` | `useUser()` provider — auth + RBAC (§5, §18) |
| `utils.ts` | Generic helpers |

---

## 3. Multi-Tenant Routing

All routing decisions live in [`middleware.ts`](../middleware.ts). The middleware:

1. Resolves the tenant from host or path.
2. Bypasses tenant logic for **special routes**.
3. Rewrites subdomains to internal `/[tenant]` paths.
4. Gates `/admin` behind the auth gateway (`__session` cookie) — see §4.
5. Sanitizes double-prefix URLs (`/quattro/quattro/...` → `/quattro/...`).
6. Sets `x-site-id` (and on subdomains, `x-clicker-is-subdomain`) so Server Components know the tenant.

### Tenant Identification

| Scenario | URL example | How tenant resolves |
|---|---|---|
| Subdomain (production custom domains) | `quattro.clicker.id/about` | Host → subdomain segment |
| Path-based (root domain) | `clicker.id/quattro/about` | First path segment |
| Path-based (Firebase default `.web.app`) | `stg-clicker-core.web.app/stagging/admin` | First path segment (subdomains not supported here) |
| Admin subdomain (post-auth) | `quattro.clicker.id/admin` | `__session` cookie value (overrides subdomain) |

### Host Detection Precedence

Cloudflare/Firebase reverse-proxy headers complicate this. The middleware checks in order:

1. `x-clicker-original-host` (Cloudflare's original host before Firebase rewrites it)
2. `x-forwarded-host`
3. `host`

A `forwardedHost` value containing `.web.app` is **discarded** (Firebase Hosting overrides the real host with its own) — the resolver falls back to the next option.

### Required Environment Variables

| Variable | Purpose | Behavior if missing |
|---|---|---|
| `NEXT_PUBLIC_BASE_DOMAIN` | Domain used for subdomain detection (`.clicker.id` in prod) | Middleware returns **HTTP 500** |
| `NEXT_PUBLIC_AUTH_GATEWAY_URL` | Where `/admin` redirects when unauthenticated | Middleware returns **HTTP 500** on `/admin` |

### Special Routes (Bypass Tenant Logic)

These first-segment values are reserved — they never resolve to a tenant:

```
admin, auth, member, catalog, login, register, invite, setup, dashboard, api, _next, warranty
```

Requests starting with one of these segments skip the subdomain-rewrite branch and are routed by Next.js directly. The `x-site-id` header is still set (from `__session` cookie for `/admin`, or from the subdomain for everything else).

### Subdomain Rewrite

`quattro.clicker.id/about` is internally rewritten to `/quattro/about`. Three exceptions skip the rewrite:

- Subdomain is `admin` or `auth` (handled by other branches).
- Path already starts with a special route segment (so `quattro.clicker.id/api/...` stays as `/api/...`).
- Path already starts with the subdomain name (defensive — prevents double prefix).

### Firebase Default Domain Behavior (`.web.app`)

Firebase Hosting default domains (e.g. `stg-clicker-core.web.app`) **do not support custom subdomains**. The middleware detects these (`isFirebaseDefaultDomain = baseDomain.includes('.web.app')`) and forces **path-based routing** in three places:

1. No subdomain rewrite is performed.
2. `/admin` strict-tenant redirect (which would push `/admin` to `tenant.clicker.id/admin`) is skipped.
3. Tenant-admin paths like `/stagging/admin/...` are rewritten in place rather than redirected to a subdomain.

The `__session` cookie is also cross-origin on `.web.app`, so the middleware lets `TokenBootstrap` (§4) set it client-side on first load rather than redirecting to the gateway.

### Localhost Behavior

In development, the middleware:

- Treats any `localhost` or `/^\d{1,3}(\.\d{1,3}){3}(:\d+)?$/` (LAN IP) host as local.
- Rewrites `kasisehat.localhost:3000` → `kasisehat.{baseDomain}` internally for subdomain detection.
- Skips the gateway redirect when no `__session` cookie is present (`TokenBootstrap` handles it).
- Skips the strict subdomain redirect (lets `localhost:3000/demo/admin` work for path-based dev flows).

### Double-Prefix Sanitizer

If a path arrives as `/{tenant}/{tenant}/...` (can happen if Cloudflare prepends a subdomain and the URL already contains it), the middleware redirects:

- **On subdomain hosts**: drops both prefixes (`/demo/demo/admin` → `/admin`), because Cloudflare will prepend the first one again.
- **On root domain**: drops one prefix (`/demo/demo/about` → `/demo/about`).

### Admin Auth Gate (Summary)

For `/admin/*` requests:

- Reads `__session` cookie → that value (not subdomain) is the canonical `siteId`.
- If missing AND not on localhost AND not on a callback path (`/admin/claim-admin*`) AND not on `.web.app` → redirects to `NEXT_PUBLIC_AUTH_GATEWAY_URL?redirect=...`.
- If a cookie exists but the request is on the wrong host (e.g. cookie says `quattro` but URL is `clicker.id/admin`), redirects to `quattro.clicker.id/admin`.
- `/admin/login` directly redirects to the gateway (legacy paths are not served).

Full handoff flow including custom-token bootstrap is documented in §4.

### Headers Injected by Middleware

| Header | When set | Read by |
|---|---|---|
| `x-site-id` | All non-root requests | Server Components, API routes |
| `x-tenant-slug` | Tenant routes (`/{tenant}/...`) | Server Components |
| `x-clicker-is-subdomain` | Subdomain hosts (and tenant-admin rewrites) | Server Components |

### App Router Roots

| Path | Purpose |
|---|---|
| `app/(public)/register/page.tsx` | Public registration flow (§14) — route group, no `/(public)` segment in URL |
| `app/[tenant]/page.tsx` | Public tenant home (biolink/website) |
| `app/[tenant]/[...slug]/page.tsx` | Public tenant subpages (custom pages, Canvas Studio output) |
| `app/admin/(dashboard)/layout.tsx` | Admin shell with sidebar |
| `app/admin/(dashboard)/[...slug]/page.tsx` | Module route catch-all (§7) |
| `app/admin/(dashboard)/{settings,forms,inbox,pages,products,canvas,…}/` | Core admin pages |
| `app/api/.../route.ts` | All API routes (§20) |
| `app/catalog/` | Public catalog routes |
| `app/member/` | Public member-portal routes |
| `app/warranty/[warrantyCode]/page.tsx` | Public warranty card view (Service Records) |

---

## 4. Authentication & Session Handoff

Authentication is split across two apps:

- **Auth Gateway** (`auth-gateway/`, port 3012, deployed at `auth.clicker.id`) — owns the login UI, the `signInWithEmailAndPassword` call, and the **custom-token mint** (`/api/token`).
- **Platform** (`clicker-platform-v2/`, port 3000) — owns the admin dashboard, reads the custom token in a URL fragment, and bootstraps the Firebase client session locally.

The gateway is intentionally **thin**: it knows nothing about tenants beyond "which `siteId` does this user belong to." All tenant business logic lives in the platform.

### High-Level Diagram

```text
┌────────────────────┐                   ┌──────────────────────┐
│  auth.clicker.id   │                   │  {slug}.clicker.id   │
│  (auth-gateway)    │                   │  (platform admin)    │
├────────────────────┤                   ├──────────────────────┤
│ 1. Email/password  │                   │ 5. TokenBootstrap    │
│ 2. Firebase Auth   │                   │    reads #token      │
│ 3. getUserSites    │                   │    sets __session    │
│ 3. POST /api/token │── custom token ──▶│    signInWithCustom  │
│ 4. Redirect with   │   in URL fragment │ 6. UserProvider      │
│    #token=...&     │                   │    resolves role     │
│    siteId=...      │                   │ 7. AdminGuard renders│
└────────────────────┘                   └──────────────────────┘
```

### Login Flow (First Visit / Logged Out)

1. **User opens the gateway** at `auth.clicker.id` (or `localhost:3012` in dev).
2. **Gateway authenticates** via `signInWithEmailAndPassword(email, password)` — Firebase Auth verifies the credential.
3. **Gateway runs in parallel** (`Promise.all` with timeouts — 5 s for site resolve, 10 s for token):
   - `getUserSites(uid, email)` — Firestore lookup that resolves which tenant(s) this user owns or is a member of (see [`auth-gateway/lib/get-user-sites.ts`](../../auth-gateway/lib/get-user-sites.ts)).
   - `POST /api/token { uid }` — mints a Firebase **custom token** via `adminAuth.createCustomToken(uid)` ([`auth-gateway/app/api/token/route.ts`](../../auth-gateway/app/api/token/route.ts)).
4. **Gateway sets `__session` cookie** on `.clicker.id` (visible to all subdomains) with the resolved `siteId`. Cookie attributes: `path=/; max-age=30d; SameSite=Lax; Secure` (on HTTPS); `Domain=.clicker.id` (on HTTPS only — localhost stays origin-scoped).
5. **Gateway redirects** the browser to the platform with the custom token in the **URL fragment**, not the query string:

   ```
   https://{slug}.clicker.id/admin#token={customToken}&siteId={siteId}
   ```

   - URL fragments are **not sent to the server** — so the token does not appear in HTTP access logs.
   - Path-based variant for `.web.app`: `https://stg-clicker-core.web.app/{slug}/admin#token=...&siteId=...`.
6. **Platform loads.** The admin layout includes [`<TokenBootstrap />`](../components/admin/TokenBootstrap.tsx) which runs its `useEffect`:
   - Reads `token` and `siteId` from `window.location.hash`.
   - Sets `sessionStorage.__token_bootstrapping = '1'` — a flag that tells `UserProvider` not to redirect to the gateway while the handoff is in progress (see `lib/user-context.tsx:117`).
   - Removes the hash from the URL via `history.replaceState` so the token never enters browser history.
   - Sets the `__session` cookie at the platform origin (necessary on localhost where ports differ; redundant but harmless in production where the gateway already set it on `.clicker.id`).
   - Calls `setSiteId(siteId)` on `SiteContext` — updates the tenant client-side without a full reload (`lib/site-context.tsx:10`).
   - Calls `signInWithCustomToken(auth, token)` — the Firebase client SDK exchanges the custom token for a real ID token cached in IndexedDB.
   - On success: clears the sessionStorage flag.
   - On failure: clears the flag and redirects back to the gateway with `?error=auth_failed`.
7. **`onAuthStateChanged`** fires inside `UserProvider`, which then queries `sites/{siteId}/members/{uid}` to resolve the user's role. `AdminGuard` sees a user + role and renders the dashboard.

### Subsequent Visits

For users with a cached Firebase session in IndexedDB and a valid `__session` cookie:

1. Request hits `middleware.ts` → reads `__session` cookie → sets `x-site-id` header → no redirect.
2. Firebase client SDK rehydrates the session from IndexedDB → `onAuthStateChanged(user)` fires immediately.
3. Dashboard renders without ever touching the gateway.

If the cookie is missing AND the user has no IndexedDB session (e.g. cleared browser), middleware redirects to the gateway, which auto-runs `performHandoff()` via `onAuthStateChanged` if a session exists, or shows the login form otherwise.

### Why a URL Fragment

- **Fragments are client-only** — `window.location.hash` is never transmitted to the server, so the token cannot appear in HTTP access logs, CDN logs, or reverse-proxy logs.
- Browser history is sanitized by `history.replaceState` before `signInWithCustomToken` resolves.

### Why the `__token_bootstrapping` SessionStorage Flag

Between steps 6 (URL parse) and 7 (`signInWithCustomToken` resolves), `UserProvider`'s `onAuthStateChanged` would otherwise see `user === null` and trigger an `AdminGuard` redirect back to the gateway — an immediate redirect loop.

The flag tells `UserProvider`: "don't conclude `loading=false` yet, a handoff is in progress." Once `signInWithCustomToken` resolves (success or failure), the flag is cleared.

### Cookie Details

| Aspect | Value |
|---|---|
| Name | `__session` |
| Why this name | Firebase Hosting strips all cookies **except** `__session` on cached responses — using any other name would break in prod |
| Value | The active `siteId` (tenant ID) |
| Scope | `Domain=.clicker.id` on HTTPS (all subdomains); origin-scoped on HTTP/localhost |
| Max-age | 30 days |
| `SameSite` | `Lax` |
| Read by | `middleware.ts` (sets `x-site-id` header), `TokenBootstrap` (idempotent set) |
| Cross-origin caveat | On Firebase default `.web.app` domains, the cookie cannot be set cross-origin from the gateway — `TokenBootstrap` sets it on first load |

### Strict Tenant Subdomain Redirect

If a user lands on `clicker.id/admin` (root domain) with a `__session` cookie pointing at `quattro`, the middleware redirects to `quattro.clicker.id/admin` to enforce that admin is always tenant-scoped. Skipped on localhost and `.web.app` domains.

### Deprecation Note

The previous `generateHandoffToken` **Cloud Function** has been **replaced** by `auth-gateway/app/api/token/route.ts`. The gateway now mints custom tokens directly via Firebase Admin SDK — no Cloud Function call is involved. Do not add new auth code that calls the deprecated Cloud Function.

### File Index for the Auth Flow

**Auth Gateway:**

| File | Role |
|---|---|
| `auth-gateway/app/page.tsx` | Login form + `performHandoff()` orchestration |
| `auth-gateway/app/api/token/route.ts` | `POST /api/token` → `adminAuth.createCustomToken(uid)` |
| `auth-gateway/lib/firebase-admin.ts` | Firebase Admin init with service account |
| `auth-gateway/lib/get-user-sites.ts` | Tenant resolution: `ownerId` ∥ `ownerEmail` → `members/{uid}` lookup |
| `auth-gateway/lib/session.ts` | Cookie helpers (clear stale sessions) |
| `auth-gateway/.env.development.local` | `GCP_SERVICE_ACCOUNT_KEY`, `NEXT_PUBLIC_AUTH_GATEWAY_URL` |

**Platform:**

| File | Role |
|---|---|
| `clicker-platform-v2/middleware.ts` | Reads `__session` cookie; redirects to gateway if missing on `/admin` |
| `clicker-platform-v2/components/admin/TokenBootstrap.tsx` | Reads `#token`, sets cookie, calls `setSiteId`, `signInWithCustomToken` |
| `clicker-platform-v2/lib/site-context.tsx` | Exposes `setSiteId()` for client-side tenant switching |
| `clicker-platform-v2/lib/user-context.tsx` | Honors `__token_bootstrapping` flag; resolves role via `members/{uid}` |
| `clicker-platform-v2/lib/firebase.ts` | Firebase client SDK init (IndexedDB session persistence) |

### Rules

- **Do not put tenant business logic in the gateway.** Its only job is authenticate + resolve minimum siteId for the cookie.
- **Do not introduce new auth paths that bypass `TokenBootstrap`.** Any new login surface must mint a custom token and use the fragment-based handoff.
- **Do not call the deprecated `generateHandoffToken` Cloud Function** — it is being removed.
- **Do not log the custom token.** It is short-lived but treat it as a secret. Fragment-based delivery is mandatory.

---

## 5. RBAC & Roles

The platform combines a **coarse role** (one of four) with a **granular per-module-route access map** stored on each member doc. The role gives broad access; `moduleAccess` overrides on a per-module-per-route basis.

Source files:

- [`lib/rbac.ts`](../lib/rbac.ts) — role enum + `PERMISSIONS` map
- [`lib/user-context.tsx`](../lib/user-context.tsx) — runtime access resolution (`hasAccess`, `canEdit`, `getAccessLevel`)

### Roles

`type Role = 'owner' | 'editor' | 'viewer' | 'staff'` (`lib/rbac.ts:1`).

| Role | Typical use | Default capabilities |
|---|---|---|
| `owner` | Tenant owner / superuser | Full access. `permissions: ['*']` bypasses all granular checks |
| `editor` | Trusted operator | `manage_content`, `view_analytics` |
| `viewer` | Read-only / analyst | `view_analytics` only |
| `staff` | Frontline operator (cashier, kitchen, etc.) | Defaults to **no access** — must be granted per-module-route via `moduleAccess` |

### Coarse Permissions (`PERMISSIONS` map)

These are role-derived capabilities used for **non-module** features (site settings, team management, content authoring). Read via `hasPermission(role, permission)`.

| Permission | Roles allowed |
|---|---|
| `manage_site` | `owner` |
| `manage_users` | `owner` |
| `manage_content` | `owner`, `editor` |
| `view_analytics` | `owner`, `editor`, `viewer` |

The exhaustive list lives in `lib/rbac.ts:3-8`. Add new coarse permissions there.

### Granular `moduleAccess` Map

Stored on each member doc at `sites/{siteId}/members/{uid}`:

```json
{
  "role": "staff",
  "moduleAccess": {
    "byod_pos": {
      "cashier": "full",
      "transactions": "view",
      "settings": "none"
    },
    "membership": {
      "list": "view"
    }
  }
}
```

Three access levels per route:

- `full` — read + write
- `view` — read only
- `none` — no access (default for unlisted routes)

### Access Resolution (`getAccessLevel`)

`getAccessLevel(moduleId, routeId)` in `lib/user-context.tsx:53` runs this sequence:

1. **If `loading`** → return `none` (don't leak access while bootstrapping).
2. **If `isOwner`** → return `full` (owner shortcut, skip everything else).
3. **Granular check**: if `moduleAccess[moduleId][routeId]` exists, return it. If not, check the **alias** (see below).
4. **Backward-compatible `permissions` array**: if the user has `permissions: ['*']` or a permission matching the module (`'pos'`, `'pos:cashier'`), return `full`.
5. Otherwise → `none`.

Two derived helpers wrap this:

- `hasAccess(moduleId, routeId)` → `true` if level is `full` or `view`. Use for **render gating**.
- `canEdit(moduleId, routeId)` → `true` only if level is `full`. Use **before every write**.

### Module ID Alias: `byod_pos ↔ pos`

Some legacy code (and the `permissions` array format) uses `'pos'`, while the canonical module ID is `'byod_pos'`. The resolver handles both directions:

```typescript
// In getAccessLevel, lib/user-context.tsx:66-71
if (moduleId === 'pos' && moduleAccess['byod_pos']) {
    return moduleAccess['byod_pos'][routeId] || 'none';
}
if (moduleId === 'byod_pos' && moduleAccess['pos']) {
    return moduleAccess['pos'][routeId] || 'none';
}

// And in the permissions-array fallback, lib/user-context.tsx:78-79
if (moduleId === 'byod_pos' && (p === 'pos' || p.startsWith('pos:'))) return true;
if (moduleId === 'pos' && (p === 'byod_pos' || p.startsWith('byod_pos:'))) return true;
```

No other module IDs are aliased.

### RBAC Guard Pattern (Client Components)

```tsx
'use client';
import { useUser } from '@/lib/user-context';

export function PriceEditor() {
    const { canEdit, hasAccess } = useUser();

    if (!hasAccess('byod_pos', 'menu')) return null; // hide entirely

    const handleSave = async () => {
        if (!canEdit('byod_pos', 'menu')) {
            // toast or alert — never call the write
            return;
        }
        await saveMenuItem(/* ... */);
    };

    return /* ... */;
}
```

### Real-Time Permission Changes

`UserProvider` subscribes to `sites/{siteId}/members/{uid}` via `onSnapshot` — when an owner edits a staff member's `moduleAccess`, the change applies in the staff member's session immediately, no reload required.

### Where to Guard

- **Render gating** — `hasAccess()` to show/hide UI.
- **Before every write** — `canEdit()` in any function that mutates Firestore.
- **Server-side enforcement** — `firestore.rules` is the final line of defense. Client-side checks are for UX; server-side rules are for security.

---

## 6. Core vs. Module Boundary

This is the **most important architectural rule** in the codebase. Violating it produces tightly coupled module graphs that are impossible to disable per-tenant.

```text
┌─────────────────────────────────────────────────────────────────┐
│  CORE  (always enabled for every tenant)                        │
│  app/admin/(dashboard)/                                         │
│    settings/   pages/   links/   forms/   inbox/                │
│    products/   canvas/   template/   services/                  │
│    + module-anchored dirs: pos/ promo/ service-records/         │
│                            whatsapp/ ai-usage/ seed-modules/    │
├─────────────────────────────────────────────────────────────────┤
│  MODULES  (opt-in per tenant)                                   │
│  lib/modules/{module_id}/                                       │
│    byod_pos/ membership/ inventory/ stocklens/                  │
│    reservation/ ai-sales-agent/ sales-pipeline/                 │
│    service-records/ fintrack/ promo/ ai-marketing/              │
│    ai-platform/                                                 │
└─────────────────────────────────────────────────────────────────┘
```

> **Why some admin directories are named after modules.** Most modules are served entirely via the `[...slug]` catch-all (§7). A handful (`pos/`, `promo/`, `service-records/`, `whatsapp/`, `ai-usage/`, `seed-modules/`) have fixed core directories instead — typically because they need shared layouts, server actions, or routes that aren't part of the module's admin route map. These dirs live in **core space** but their contents may delegate into the module.

### The Golden Rules

1. **Core can import from Core.** Core NEVER imports from a module — not even via dynamic import. If core code needs module data, it consults the **module registry** (§7) to check `isModuleEnabled` first, then dispatches through the registered component or runtime API.

2. **Modules MUST NOT import from other modules.** Cross-module logic uses either:
   - `isModuleEnabled(moduleId)` from `lib/modules/registry.ts` — for conditional features.
   - The **sanctioned facade exceptions** (rule 3) — for shared business primitives that span modules.

3. **Sanctioned facade exceptions.** Two facades are explicitly allowed to be imported across module boundaries:

   | Facade | Used for | Live consumers |
   |---|---|---|
   | `@/lib/modules/promo/api` | Discount evaluation, voucher commit, applied-promo types | `byod_pos`, `reservation` |
   | `@/lib/modules/membership/api` | Member lookup, point accrual, member creation | `byod_pos`, `reservation`, `service-records` |

   These exist because the underlying logic (promo evaluation, loyalty accrual) is genuinely cross-cutting — duplicating it per module would create drift. Both are **facade-only**: consumers may import the entry points the facade exposes, never the module's internal files. See §15 for promo facade details.

   No other cross-module imports are permitted. If you need another shared primitive, promote it to `lib/core/` (§16) or `lib/{subsystem}/` (Part III).

4. **Module components are registered, not imported.** Module admin pages are exposed via `lib/modules/components.tsx` (dynamic imports keyed by `{moduleId}:{ComponentKey}`). Core code that needs to render a module component looks it up by key — it never imports the file directly.

5. **Module admin routes are served via the catch-all.** `app/admin/(dashboard)/[...slug]/page.tsx` resolves the route through `findModuleForAdminRoute()` and renders the matching component from the registry. Module developers do not add `app/admin/(dashboard)/{module}/page.tsx` files unless they have a justified reason (see "Why some admin directories are named after modules" above).

### Enforcement

There is no automated lint rule for cross-module imports today. Reviewers should check for:

- `from '@/lib/modules/{other_module}/...'` in any module file (allowed only for the two facades in rule 3).
- Module names appearing in core code outside the registry/components files.

When in doubt: if removing module `X` from a tenant would break module `Y`, the import is violating rule 2.

---

## 7. Module System

Modules are opt-in feature packages that add admin routes, dashboard widgets, blocks, and Firestore collections to a tenant. A module is **dynamically loaded** at runtime — disabling it for a tenant removes its admin routes and widgets without rebuilding the app.

### Registration Files

A module is wired up by editing **five** files (the fifth is new since the previous architecture doc):

| File | Purpose |
|---|---|
| `lib/modules/definitions.ts` | Static admin route map per module (`adminRoutes`, `dashboardAction`, widgets) |
| `lib/modules/components.tsx` | Server/admin dynamic-import registry (`MODULE_COMPONENTS[{moduleId}:{Key}]`) |
| `lib/modules/client-registry.tsx` | Client-side component registry (used by client-only renderers) |
| `lib/modules/registry.ts` | Runtime resolution: `findModuleForAdminRoute()`, `isModuleEnabled()` (merges Firestore module docs with static defs) |
| `scripts/seed-modules.ts` | Firestore seed (run once per environment) |

### Three-Way Parity Rule

When adding or renaming a module route, **three files must change together**:

1. `clicker-platform-v2/lib/modules/definitions.ts`
2. `backyard/lib/modules/definitions.ts`
3. `clicker-platform-v2/scripts/seed-modules.ts`

All three must agree on `path`, `componentKey`, and `id`. The Backyard superadmin tool reads its own copy of `definitions.ts` to render module-management UI; the seed script writes the Firestore doc that the runtime registry merges with the static defs.

### Module Folder Structure

The aspirational layout for `lib/modules/{module_id}/`:

```text
lib/modules/{module_id}/
├── admin/          ← Admin page components (loaded via registry)
├── public/         ← Public-facing pages/widgets
├── components/     ← Shared UI within this module
├── api.ts          ← Client-side Firestore operations
├── api-admin.ts    ← Admin-specific operations (not all modules)
├── api-server.ts   ← Server-side operations (uses firebase-admin)
├── api-reports.ts  ← Reporting queries (byod_pos, service-records, etc.)
├── constants.ts    ← DB path strings (NEVER hardcode paths inline)
├── types.ts        ← TypeScript types for this module
└── utils.ts        ← Helpers
```

**Not every module has every file** — only `byod_pos` implements all of them. Minimum: `types.ts` + at least one of `api.ts` or `api-server.ts`.

### Facade Pattern (Promo)

Modules that expose a **cross-module API** (the sanctioned facade exceptions in §6) replace the flat `api.ts` with an `api/` subdirectory:

```text
lib/modules/promo/
├── api/
│   ├── claim.ts        ← Voucher claim
│   ├── commit.ts       ← commitPromoUsage()
│   ├── discount.ts     ← Discount math
│   ├── evaluator.ts    ← evaluatePromo()
│   ├── promos.ts       ← CRUD
│   ├── settings.ts     ← CRUD
│   └── vouchers.ts     ← CRUD
├── constants.ts
├── types.ts
└── ...
```

Consumers import from `@/lib/modules/promo/api` (the directory, resolved to `index.ts` if present, or via explicit per-file paths). See §15 for the full facade contract.

### Module ID Naming

- **Canonical IDs** use underscores when multi-word: `byod_pos`, `ai_sales`, `ai_marketing`, `service_records`, `sales_pipeline`, `manage_users`. Single-word IDs have no separator: `promo`, `fintrack`, `stocklens`, `inventory`, `membership`, `reservation`.
- **Directory names** sometimes use hyphens or longer forms for readability: `lib/modules/ai-sales-agent/` hosts module ID `ai_sales`; `lib/modules/service-records/` hosts `service_records`; `lib/modules/sales-pipeline/` hosts `sales_pipeline`.
- The **canonical identifier** used in Firestore (`sites/{siteId}/modules/{module_id}/...`), in RBAC `moduleAccess` keys, and in `componentKey` prefixes is always the module ID, not the directory name.

### Registered Modules (12)

Source: [`lib/modules/definitions.ts`](../lib/modules/definitions.ts). Hidden routes (`hidden: true`) are not shown in the sidebar but resolvable directly.

| Module ID | Directory | Admin routes |
|---|---|---|
| `byod_pos` | `byod_pos/` | Cashier, Kitchen, Transactions, Menu, Configuration (`permission: settings`), Reports (`permission: view_reports`) |
| `membership` | `membership/` | Members, Settings |
| `inventory` | `inventory/` | Items |
| `stocklens` | `stocklens/` | Scanner, Vault, Settings |
| `reservation` | `reservation/` | Bookings, Services, Staff (hidden), Settings |
| `ai_sales` | `ai-sales-agent/` | Overview, Settings |
| `sales_pipeline` | `sales-pipeline/` | Pipeline Board, Settings |
| `service_records` | `service-records/` | Service, Reports, New Record (hidden), Record Detail (hidden), Vehicles, Vehicle Detail (hidden), Service Types, Reminders, Settings |
| `fintrack` | `fintrack/` | Dashboard, Entries, Wallets, New Entry (hidden), Advanced, Settings |
| `promo` | `promo/` | Promotions, Vouchers, Settings — plus member-dashboard widgets `MemberRewardsWidget`, `MyVouchersWidget` |
| `ai_marketing` | `ai-marketing/` | Dashboard, Generate, Assets, Asset Detail, Campaigns, Campaign Detail, Analytics, Settings (**all hidden** — feature is dashboard-launched, not sidebar-navigated) |

> **`ai-platform`** exists on the filesystem (`lib/modules/ai-platform/admin/`) but is **not** registered in `definitions.ts`. It is either in-progress scaffolding or has been intentionally excluded — confirm with the module owner before adding routes.

### `ModuleDefinition` Type

Source: [`lib/modules/types.ts`](../lib/modules/types.ts).

```typescript
interface ModuleDefinition {
    id: string;
    displayName: string;
    description?: string;
    icon: string;
    version: string;
    enabled: boolean;

    adminRoutes?: AdminRoute[];
    publicRoutes?: PublicRouteDefinition[];

    // Capabilities
    collections?: string[];          // Firestore collections this module owns
    requires?: string[];             // Other module IDs this depends on
    blocks?: ModuleBlockDefinition[];           // Custom blocks (§9)
    dashboardWidgets?: ModuleWidgetDefinition[]; // Member dashboard widgets
    settings?: Record<string, any>;             // Module-specific config
    dashboardAction?: { label: string; href: string };
    adminDashboardWidget?: { componentKey: string };
}

interface AdminRoute {
    path: string;
    label: string;
    icon?: string;
    componentKey?: string;
    hidden?: boolean;
    permission?: string;            // e.g. 'settings', 'view_reports'
}
```

### How Module Routes Are Served

```text
Request: /admin/pos/cashier
  │
  └─► app/admin/(dashboard)/[...slug]/page.tsx
        │
        └─► findModuleForAdminRoute('/admin/pos/cashier')
              │  (merges Firestore module doc with STATIC_MODULE_DEFINITIONS)
              └─► Returns componentKey: 'byod_pos:Cashier'
                    │
                    └─► MODULE_COMPONENTS['byod_pos:Cashier']
                          └─► dynamic(() => import('.../CashierClient'))
```

### Module Enable Check (Cross-Module Dispatch)

```typescript
import { isModuleEnabled } from '@/lib/modules/registry';

const inventoryOn = await isModuleEnabled(siteId, 'inventory');
if (inventoryOn) {
    // deduct stock via dynamic import — but only via the inventory module's
    // public API, not by reaching into its internals
}
```

This is the canonical pattern when one module's behavior depends on whether another is enabled. Combine with the facade exceptions (§6) only if the target module is `promo` or `membership`.

---

## 8. Template & Theme System

A **template** is the visual skin applied to a tenant's public site (biolink/website). Each template ships with a color palette, font pair, layout config, card style, and (optionally) custom header + block renderers. Tenants pick one in admin → Appearance.

### Six Built-in Templates

Source: [`lib/templates/definitions.ts`](../lib/templates/definitions.ts).

| ID | Name | Card style | Card variant | Container width | Nav mode | Bottom nav | Header component |
|---|---|---|---|---|---|---|---|
| `classic` | Sunnyside Original | `brutalist` | `shadow` | narrow | mobile-only | — | `ClassicProfileHeader` |
| `modern` | Modern Clean | `clean` | `shadow` | boxed | adaptive | — | `ModernProfileHeader` |
| `sojourner` | Sojourner | `clean` | `outlined` | full | adaptive | — | `ModernProfileHeader` (reused) |
| `shuvo` | Shuvo Real Estate | `clean` | `flat` | tablet | adaptive | ✓ | `ShuvoHeader` |
| `mrb` | Mr Brightside | `glass` | `outlined` | boxed | adaptive | ✓ | `MrbHeader` |
| `mrb-light` | Mr Brightside Light | `clean` | `shadow` | boxed | adaptive | ✓ | `MrbHeader` (reused) |

> **Header reuse.** Only 4 distinct header components exist (`ClassicProfileHeader`, `ModernProfileHeader`, `ShuvoHeader`, `MrbHeader`). `sojourner` reuses `ModernProfileHeader`; `mrb-light` reuses `MrbHeader`. The header is selected by the template's entry in `templateComponents` in `lib/templates/registry.ts`, not by template ID convention.

### Template Files

```text
lib/templates/
├── definitions.ts   ← TemplateDefinition objects for all 6 templates
├── registry.ts      ← Maps template ID → header/background/block components
├── layoutUtils.ts   ← containerWidth, navMode, grid helpers
├── service.ts       ← Template load/merge logic (used by Server Components)
└── types.ts         ← TemplateDefinition, ThemeColors, ThemeFonts, etc.
```

### `TemplateConfig` Shape

Excerpted from `lib/templates/types.ts` — the canonical type:

```typescript
interface TemplateConfig {
    colors: ThemeColors;          // primary, accent, background, foreground, surface, border, +extended tokens
    fonts: ThemeFonts;            // heading, body
    borderRadius: string;
    cardStyle: 'brutalist' | 'clean' | 'glass';        // Deprecated in favor of cardVariant
    cardVariant: 'shadow' | 'outlined' | 'flat';        // Explicit card surface treatment
    backgroundElements?: BackgroundElement[];           // Decorative icons (classic only)
    allowThemeColorOverride?: boolean;                  // Default true — user-picked theme color wins
    headerLayout: 'center' | 'left' | 'minimal';
    homeButtonStyle: 'pill' | 'text' | 'icon';
    homeButtonColor: 'primary' | 'foreground' | 'glass';
    taglineStyle: 'contrast' | 'gentle' | 'outline';
    layout?: TemplateLayoutConfig;                      // { containerWidth, navMode, showBottomNav, grid }
    defaultBlockLayouts?: Record<string, string>;       // Per-block default layout variant
    custom?: Record<string, any>;                       // Template-specific options (e.g. Shuvo, MRB)
    decorations?: {
        surfaceStyle?: 'glass' | 'soft' | 'outline' | 'solid';
        accentGlow?: boolean;
        neutralTone?: 'warm' | 'cool' | 'neutral';
    };
}
```

### Template-Specific Block Overrides

A template can replace the default renderer for a block type. Registered in `templateComponents` in `lib/templates/registry.ts`:

**MRB and MRB-Light** override three blocks:

- `hero` → `MrbHero` (`components/blocks/mrb/MrbHero.tsx`)
- `quick_actions` → `MrbQuickActions`
- `hours` → `MrbOperatingHours`

The override chain (template → module → default) is described in §9.

### Background Decorations

`backgroundElements` is a list of decorative icons positioned with Tailwind classes — used only by `classic`. Other templates pass `[]` (or a `Background: () => null` component) to suppress decorations entirely.

### Adding a New Template

Quick checklist (full version in §24):

1. Append a `TemplateDefinition` entry to `lib/templates/definitions.ts`.
2. Register components (header, background, optional block overrides) in `lib/templates/registry.ts`.
3. Create the header component under `components/headers/` if not reusing an existing one.
4. Create any custom block renderers under `components/blocks/{templateId}/`.

---

## 9. Block System (Canvas Studio)

**Blocks** are the unit of content composition for tenant pages. The admin renders them in **Canvas Studio** (the WYSIWYG page builder); the public site renders them through `BlockRenderer`. Every page in `sites/{siteId}/pages/{pageId}` stores an ordered array of blocks.

### Block Types (18)

Source: `BLOCK_OPTIONS` in [`components/admin/blocks/blockDefinitions.ts`](../components/admin/blocks/blockDefinitions.ts).

| Type | Purpose |
|---|---|
| `hero` | Hero / banner section (often the LCP element — see "LCP rule" below) |
| `text` | Rich-text content (Tiptap) |
| `content_showcase` | Two-column image + text showcase (one of the newer blocks) |
| `image` | Single image with optional caption |
| `button` | CTA button |
| `products` | Product list (pulls from core product catalog) |
| `faq` | Accordion FAQ |
| `link` | Link card (single link tile) |
| `map` | Google Maps embed |
| `image_gallery` | Photo gallery |
| `social_embed` | Embedded social media post (Instagram, TikTok, YouTube) |
| `quick_actions` | Grid of action buttons (call, WhatsApp, directions, etc.) |
| `hours` | Operating hours display (consumes `lib/core/businessHours/` — §16) |
| `featured_product` | Featured product card |
| `branches` | Branch locations list |
| `inline_form` | Inline form embed (consumes a `forms/{formId}`) |
| `heading` | Section heading |
| `feature_cards` | Grid of feature cards |

> **Orphan renderer.** `components/blocks/public/DefaultProductGalleryBlock.tsx` exists on disk but is **not** referenced by `BlockRenderer` or `BLOCK_OPTIONS`. Treat it as legacy/dead code pending confirmation from the block-system owner before removing.
> **Module-injected blocks.** `ReservationBlock` is dispatched by `BlockRenderer` but does not appear in `BLOCK_OPTIONS` — it is contributed by the `reservation` module via its `blocks` array (see `ModuleBlockDefinition` in §7). Module-contributed blocks are rendered through `<ModuleBlockLoader />` and don't need a `BLOCK_OPTIONS` entry.

### Canvas Studio File Layout

```text
components/admin/blocks/
├── CanvasStudio.tsx        ← Main editor shell
├── BlockManager.tsx        ← Block list + drag-to-reorder (@dnd-kit)
├── BlockFormRenderer.tsx   ← Right-panel property editor (per-block form)
├── EditorContext.tsx       ← Editor state (selected block, page, etc.)
├── PageStudioContext.tsx   ← Page-level state
├── StudioTopBar.tsx        ← Save / publish controls
├── blockDefinitions.ts     ← BLOCK_OPTIONS + getDefaultData()
├── forms/                  ← Per-block-type property forms
└── panels/                 ← Left sidebar panels (links, products, etc.)
```

### Public Block Renderer File Layout

```text
components/blocks/
├── BlockRenderer.tsx          ← Main switch — dispatches block.type → renderer
├── SafeBlockRenderer.tsx      ← Error-boundary wrapper
├── PageBackground.tsx         ← Page-wide background (template-driven)
├── content-showcase/          ← Subcomponents for content_showcase block
├── feature-cards/             ← Subcomponents for feature_cards block
├── mrb/                       ← MRB-template-specific block overrides
├── shared/                    ← Shared block subcomponents (cards, etc.)
└── public/                    ← Default block renderers (Default{Type}Block.tsx)
    ├── DefaultHeroBlock.tsx, DefaultTextBlock.tsx, ...
    ├── LinkBlockClient.tsx, LinkCard.tsx           ← Client-side helpers
    ├── MediaView.tsx                                ← Shared media renderer
    ├── ProductsBlockClient.tsx                      ← Client-side products
    ├── ReservationBlock.tsx                         ← Module-injected (reservation)
    ├── cardStyles.ts                                ← Shared card style tokens
    └── __tests__/                                   ← Vitest suites
```

### Override Chain

When rendering a block, `BlockRenderer.tsx` resolves the component in this order:

1. **Template-specific override** — `templateComponents[templateId].Blocks.{Name}` (§8). E.g. MRB's `MrbHero` replaces the default `hero` renderer.
2. **Module-contributed block** — modules can register block types via `ModuleBlockDefinition.blocks[]` (§7). Rendered through `<ModuleBlockLoader />`.
3. **Default renderer** — `components/blocks/public/Default{Type}Block.tsx`.

Source: switch statement in `BlockRenderer.tsx` reads `fullTemplate.components?.Blocks` first, then falls back to defaults.

### LCP Rule

If a block can render the page's largest contentful element (typically `hero` and the first `image`/`image_gallery`), it accepts an `isFirst` prop. The block component is responsible for forwarding `priority` / `fetchPriority` to its `next/image` calls only when `isFirst === true`. New blocks that render above-the-fold images **must** follow this pattern — otherwise LCP regresses.

### System Blocks vs Page Blocks

A small set of blocks (`quick_actions`, `hours`, `branches`, `featured_product`, `link`-list) are also rendered on the homepage outside of Canvas Studio (driven by `lib/systemBlocks.ts`). The same default renderers serve both contexts, but page-block instances carry per-tenant configuration while system blocks pull from core data (business hours, links, branches).

---

## 10. AI Platform & Kredit

A unified server-side AI invocation layer used by every AI-powered feature (AI Sales, AI Marketing, Stocklens knowledge sync, etc.). All AI calls go through `lib/ai/index.ts`, which performs **preflight credit check → upstream call → post-deduct ledger write**. The platform calls AI providers via **OpenRouter** (not the Google SDK directly, despite `@google/generative-ai` being in `package.json`).

### What AI Platform Does

- One call site (`invokeAI`, `invokeVision`, `invokeWithTools`) for every AI feature.
- Per-tenant Kredit (USD-denominated) accounting — every call deducts cost, every topup is logged.
- Model selection centralized in Firestore, configurable per environment via Backyard.
- Daily aggregate of cost per site for analytics.

### AI Files

| File | Role |
|---|---|
| `lib/ai/index.ts` | Public API: `invokeAI`, `invokeVision`, `invokeWithTools` + re-exports |
| `lib/ai/client.ts` | OpenRouter HTTP client: `callText`, `callVision`, `callWithTools` |
| `lib/ai/credits.ts` | Ledger: `deductCredits`, `getCreditBalance`, daily aggregate, topup entries |
| `lib/ai/models.ts` | Model selection from Firestore (`modules/ai-platform/config/models`) |
| `lib/ai/pricing.ts` | Per-model rate table (Firestore + OpenRouter fallback rates) |
| `lib/ai/context.ts` | Tenant context enrichment (`buildTenantContext`, cache invalidation) |
| `lib/ai/types.ts` | `AIRequest`, `VisionRequest`, `ToolRequest`, `AICallOptions`, `ModelConfig`, etc. |

### AI Public API

All three call modes follow the same shape: a **request** (model + messages + parameters) and an **options** object that carries billing metadata (`siteId`, `moduleId`, `skillId`, `uid`).

```typescript
import { invokeAI, invokeVision, invokeWithTools } from '@/lib/ai';

// Text generation
const text = await invokeAI(
    { model, messages, max_tokens, temperature },
    { siteId, moduleId: 'ai_sales', skillId: 'greet', uid }
);

// Vision (image + prompt)
const result = await invokeVision(
    { model, messages /* with image parts */ },
    { siteId, moduleId, skillId, uid }
);

// Tool/function-calling
const result = await invokeWithTools(
    { model, messages, tools },
    { siteId, moduleId, skillId, uid }
);
```

### AI Call Lifecycle

```text
1. preflightCheck(siteId)
   └── getCreditBalance → throw 'insufficient_credits:{balance}:0' if <= 0

2. callText / callVision / callWithTools
   └── POST openrouter.ai/api/v1/chat/completions
       └── Bearer OPENROUTER_API_KEY (from lib/secrets)
       └── Returns: { content, inputTokens, outputTokens, model }

3. postDeduct(result, options)
   ├── calculateCost(model, inputTokens, outputTokens)  ← from Firestore pricing or fallback
   └── deductCredits(siteId, costUSD, meta)
       ├── Firestore transaction on sites/{siteId}/platform/aiCredits
       │   ├── reads balance
       │   ├── re-throws 'insufficient_credits' if balance < costUSD
       │   └── writes balance = balance - costUSD (rounded to 6 decimals)
       │       and lifetimeUsed = lifetimeUsed + costUSD
       └── Updates daily aggregate (sites/{siteId}/platform/aiCreditLedger/daily/{YYYY-MM-DD})
```

If the upstream call succeeds but `deductCredits` fails (e.g. another concurrent call exhausted the balance), the response is still returned to the caller — but `ai.billing.deduct.failed` is logged. This is intentional: a one-off over-spend is preferable to throwing away a paid AI response.

### Model Configuration

`getModel(useCase)` returns a model slug like `'google/gemini-2.5-pro'` from a Firestore doc at `modules/ai-platform/config/models`:

```json
{
  "llm":    "google/gemini-2.5-pro",
  "vision": "google/gemini-2.5-pro"
}
```

`ModelConfig` exposes five use cases (`chat`, `tools`, `fast`, `quality`, `vision`) but currently all non-vision slots point at the same `llm` slug. If the doc is missing, the call throws `model_config_not_set` — operators must configure models in **Backyard → AI Settings → Models** before any AI call works.

### Pricing

Pricing lives in `modules/ai-platform/config/pricing` (Firestore), cached for 5 minutes. If a model isn't in the Firestore table, `lib/ai/pricing.ts` falls back to a hardcoded `OPENROUTER_FALLBACK_RATES` map covering Google, OpenAI, Anthropic, DeepSeek, Qwen, and Meta models. If neither has the model, `calculateCost` throws `model_not_priced:{model}` — the upstream call has already succeeded, so this just skips the ledger write.

### Credit Ledger (Firestore Paths)

| Path | Purpose |
|---|---|
| `sites/{siteId}/platform/aiCredits` | `{ balance, lifetimeUsed }` — single doc, transactionally updated |
| `sites/{siteId}/platform/aiCreditLedger/daily/{YYYY-MM-DD}` | Per-day aggregate: `{ date, totalCost, totalCalls, byModule[] }` (etc.) |
| `sites/{siteId}/platform/aiCreditLedger/entries` | Topup-only log (one doc per topup, append-only) |

The terminology "Kredit" (Indonesian for "credit") is used in the admin UI and product copy. Internally everything is USD cost rounded to 6 decimals.

### Admin Endpoints

| Endpoint | Purpose |
|---|---|
| `GET /api/admin/ai-credits` | Current balance + recent ledger entries (admin UI) |
| `GET /api/admin/ai-usage` | Daily aggregate for charts (admin UI) |
| `GET /api/admin/ai/credits` | Legacy alias — being consolidated into the path above |

Backyard (superadmin) owns model/pricing configuration; the platform consumes it read-only.

### AI Integration Points

- `ai_sales` module — chat agent (`/api/ai-sales-agent/chat`)
- `ai_marketing` module — content generation, asset analysis
- `stocklens` module — image-based SKU scanning, knowledge sync
- Anywhere else that needs AI — call `invokeAI` directly with appropriate `moduleId` and `skillId`

### AI Rules

- **Never call OpenRouter / Gemini directly.** Always go through `lib/ai/index.ts` so credit accounting stays consistent.
- **Always pass `moduleId` and `skillId`** in `AICallOptions` — they drive per-feature usage analytics.
- **Use `getModel(useCase)` not hardcoded model slugs.** Model upgrades happen via Backyard, not code changes.
- **`OPENROUTER_API_KEY`** is read from `lib/secrets/` (Google Secret Manager in prod; env var in dev).

---

## 11. Email (Resend)

Transactional email is delivered via **Resend**, using **hosted templates** identified by alias (not React Email components rendered server-side). Every send goes through one function — `sendEmail()` — which orchestrates context enrichment, dev-allowlist gating, the Resend API call, and a Firestore log write.

### What Email Does

- One call site (`sendEmail`) for every email — registration confirmations, AI follow-ups, etc.
- Resend's hosted-template system keeps copy editable by non-engineers (no redeploy).
- Per-tenant `emailLog` for delivery auditing and debugging.
- Dev safety: outbound email is allowlisted by recipient domain in non-prod.

### Email Files

| File | Role |
|---|---|
| `lib/email/index.ts` | Public exports: `sendEmail`, `getEmailContext`, `getTemplateAliases` |
| `lib/email/sender.ts` | The `sendEmail()` function — orchestrator |
| `lib/email/config.ts` | Platform email config (Firestore-cached): sender domain, fromName, template aliases |
| `lib/email/context.ts` | Per-site context: tenant brand (businessName, logoUrl, primaryColor, siteUrl) |
| `lib/email/guard.ts` | `isAllowedInDev()` — recipient allowlist gate |
| `lib/email/log.ts` | Firestore writer: `newLogDocRef`, `writeEmailLog` |
| `lib/email/types.ts` | `SendEmailInput`, `SendEmailResult`, `EmailContext`, `EmailLogDoc`, `EmailTag` |

### Email Public API

```typescript
import { sendEmail } from '@/lib/email';

const result = await sendEmail({
    to: 'user@example.com',                 // string or string[]
    templateAlias: 'welcome',               // Resend hosted-template alias
    variables: { firstName: 'Andre' },      // template-specific vars
    siteId: 'quattro',                      // null for platform-level emails
    cc: ['team@example.com'],               // optional
    bcc: undefined,                          // optional
    replyTo: 'support@example.com',          // optional — overrides context.replyTo
    tags: [{ name: 'flow', value: 'onboarding' }], // optional Resend tags
});

if (result.ok) {
    // result.id = Resend message ID, result.logId = Firestore doc ID
} else {
    // result.error = string, result.logId = Firestore doc ID (still written)
}
```

`sendEmail` **never throws** — failures resolve to `{ ok: false, error, logId }`.

### Email Send Lifecycle

```text
1. Resolve EmailContext via getEmailContext(siteId)
   └── Pulls tenant brand: businessName, logoUrl, primaryColor, siteUrl

2. Resolve default sender via resolveDefaultSender()
   └── From platform/settings/email/config { sender: { domain, localPart, fromName } }
   └── Format: "fromName <localPart@domain>"  (e.g. "Quattro <noreply@clicker.id>")

3. Pre-write a Firestore log doc (status undetermined yet)
   └── sites/{siteId}/emailLog/{logId}   OR   system/email/emailLog/{logId} if siteId is null

4. Dev guard: isAllowedInDev(toList)
   └── In production: always allowed
   └── In dev: recipients must end with a suffix in EMAIL_DEV_ALLOWLIST
       (default: '@clicker.id,@resend.dev')
   └── If blocked: write log with tag 'dev_blocked', return { ok: true, id: 'dev_blocked' }
       — caller sees success but no email goes out

5. POST https://api.resend.com/emails
   └── Bearer RESEND_API_KEY (from lib/secrets — Google Secret Manager in prod)
   └── Body uses Resend's hosted template: { template: { id: alias, variables } }
   └── Auto-injected variables: businessName, logoUrl, primaryColor, siteUrl

6. Write final log status
   └── Success: status='sent', resendId, sentAt=now
   └── Failure: status='failed', error, errorCode, sentAt=null
```

### Firestore Paths

| Path | Purpose |
|---|---|
| `sites/{siteId}/emailLog/{logId}` | Per-tenant email log |
| `system/email/emailLog/{logId}` | Platform-level emails (when `siteId === null`) |
| `platform/settings/email/config` | Sender domain + localPart + fromName + template aliases (5-min cache) |

### Template Aliases

Resend templates are referenced by **alias**, not by template body. The aliases live in `platform/settings/email/config.templates` as `{ aliasKey: resendTemplateId }`. Code passes the alias key:

```typescript
sendEmail({ ..., templateAlias: 'welcome' });
```

Operators add/edit templates in Resend, then update the alias map in Backyard — no code change.

### Dev Allowlist

Set `EMAIL_DEV_ALLOWLIST` (comma-separated suffixes) to control which recipient domains can actually receive mail in development:

```bash
EMAIL_DEV_ALLOWLIST=@clicker.id,@resend.dev,@example.com
```

Default is `@clicker.id,@resend.dev`. Blocked recipients still get a log entry tagged `dev_blocked`, so test runs are auditable.

### Cross-App Usage

The Resend integration code in `clicker-platform-v2/lib/email/` is the **canonical implementation**. `auth-gateway/` and `functions/` each maintain their own thin Resend clients for emails they own (e.g. password reset, registration confirmation). The contract documented here applies to platform code; sibling apps follow the same shape but live independently.

### Email Rules

- **Always go through `sendEmail()`** — never call the Resend API directly from feature code.
- **Use `templateAlias`, not raw HTML.** Hosted templates are the unit of versioning.
- **Pass `siteId` whenever an email is tenant-scoped.** Use `null` only for cross-tenant/platform-level emails.
- **`RESEND_API_KEY`** is read from `lib/secrets/` — never inline.

---

## 12. Analytics (PostHog)

Client-side product analytics via PostHog. **Production-only** — analytics is a no-op in staging and dev. Every event is automatically tagged with the active `siteId` as a super-property so PostHog dashboards can filter by tenant without per-call wiring.

### What Analytics Does

- Per-tenant funnel and feature usage tracking, identified by `siteId`.
- Manual pageview capture on route changes (auto-capture is disabled to avoid duplicate events from Next.js client-side nav).
- Module-scoped event names (e.g. `pos.order_completed`, `reservation.booking_created`).

### Analytics Files

| File | Role |
|---|---|
| `lib/analytics/PostHogProvider.tsx` | Provider + pageview tracker (mounted in root layout) |
| `lib/analytics/useAnalytics.ts` | `useAnalytics()` hook — returns `{ capture(event, properties?) }` |

### Provider Mount

`<PostHogProvider>` wraps the app in the root layout. It:

1. Initializes `posthog` with `capture_pageview: false` and `persistence: 'localStorage'` — **only if `NEXT_PUBLIC_POSTHOG_KEY` is set**, which gates on `NEXT_PUBLIC_FIREBASE_PROJECT_ID === 'clicker-universe'` (production project).
2. Registers `siteId` as a super-property whenever the site context resolves: `posthog.register({ siteId })`.
3. Renders `<PostHogPageviewTracker />` — fires `$pageview` events on `usePathname()` changes, with `siteId` and full URL.

In non-prod environments, the provider returns `<>{children}</>` without ever loading PostHog. No events are emitted; no network calls happen.

### Two Capture Patterns

Two call patterns are used in the codebase. **Both are valid**, but they differ in where `siteId` comes from:

**1. Hook-based (`useAnalytics`) — client components only**

```tsx
'use client';
import { useAnalytics } from '@/lib/analytics/useAnalytics';

function CashierClient() {
    const { capture } = useAnalytics();
    useEffect(() => { capture('pos.cashier_opened'); }, []);
}
```

The hook injects `siteId` from `useSite()` automatically. Use this from React components.

**2. Direct `posthog.capture` — non-component code (api.ts, helpers)**

```typescript
import posthog from 'posthog-js';

export async function createOrder(siteId: string, ...) {
    // ...
    posthog.capture('pos.order_completed', { siteId, orderId, paymentMethod });
}
```

Pass `siteId` explicitly — there is no hook context outside React. Always include `siteId` in the properties payload.

> **Either way, `siteId` ends up on the event** — directly via the hook or explicitly via the second-arg properties (which override or add to the super-property scope).

### Event Catalogue

Source: `grep -rn "capture(" lib/modules/ lib/analytics/`. Current events:

| Event name | Site (where fired) | Properties (beyond `siteId`) |
|---|---|---|
| `$pageview` | `PostHogPageviewTracker` (every route change) | `$current_url` |
| `pos.cashier_opened` | `lib/modules/byod_pos/admin/CashierClient.tsx` | — |
| `pos.order_completed` | `lib/modules/byod_pos/api.ts` | `orderId`, `paymentMethod` |
| `inventory.stock_updated` | `lib/modules/inventory/admin/AdjustStockDialog.tsx` | — |
| `reservation.booking_created` | `lib/modules/reservation/api.ts` | `bookingId`, `serviceId` |
| `sales_pipeline.deal_moved` | `lib/modules/sales-pipeline/api.ts` | `leadId`, `toStage`, `fromStage` |
| `membership.member_added` | `lib/modules/membership/api.ts` | — |
| `promo.code_applied` | `lib/modules/promo/components/PromoApplicator.tsx` | `promoCode` |

**Naming convention:** `{moduleId}.{action_past_tense}` — `pos.order_completed`, not `pos_complete_order` or `PosOrderCompleted`. Keep new events consistent.

### Server-Side Tracking

There is currently **no server-side analytics endpoint**. `app/api/analytics/track/` exists as an empty directory; no `route.ts` is implemented. Server-side capture would require either:

- A Next.js Server Action that imports a server-only PostHog client (`posthog-node`, not currently in deps), or
- A POST endpoint that fan-outs to PostHog's `/capture` HTTP API.

Until either is added, **only client-side code can emit events.** Module API functions that `import posthog from 'posthog-js'` and call `capture` rely on being invoked from client components — they will be no-ops if called from Server Components.

### Analytics Rules

- **Production only.** Never expect events in dev/staging dashboards — the provider doesn't initialize.
- **Always pass `siteId`.** Hook callers get it automatically; direct callers must include it.
- **Event names use dot.snake_case:** `module_id.action_past_tense`.
- **Don't track PII.** No emails, no phone numbers, no full names in event properties — use Firestore IDs (`uid`, `memberId`, `orderId`).

---

## 13. WhatsApp Integration

A bidirectional WhatsApp Cloud API integration (via Meta Graph API v19) that handles:

- **Outbound** messages from admin UI and from modules (with a safeguard against accidental customer auto-replies).
- **Inbound** webhook → actor classification → split routing into staff command threads or customer threads.
- **Owner commands** — natural-language regex matching (sales report, stock query, booking, member info) replied in-thread.

### What WhatsApp Integration Does

- Per-tenant WA connection (each site provides its own Meta Phone Number ID, WABA ID, access token, webhook verify token).
- Encrypted access tokens at rest (AES-256-CBC with key from Google Secret Manager).
- Three-actor model: **owner / staff / customer** — first two route to a "staff commands" thread, customers route to a per-contact "customer threads" inbox.
- Owner/staff commands are pattern-matched against a small handler map (Indonesian + English keywords).
- Customer-targeted outbound sends **require `human_triggered: true`** — a deliberate safeguard against modules accidentally messaging customers.

### WhatsApp Files

| File | Role |
|---|---|
| `lib/whatsapp/constants.ts` | Firestore subcollection paths under `sites/{siteId}/wa/main/...`; Meta API base + messages endpoint |
| `lib/whatsapp/types.ts` | `WAConfig`, `WAContact`, `WAMessage`, `WAThread`, `WACommand`, `WATemplate`, `OutboundMessage`, Meta webhook payload shapes, `WAActorType` |
| `lib/whatsapp/gateway.ts` | `WhatsAppGateway` class implementing `MessagingGateway` (send, getThread, markRead); `getWAConfig()` reader |
| `lib/whatsapp/webhook-processor.ts` | `processIncomingMessage()` — fan-out from Meta payload to raw store + classifier + router |
| `lib/whatsapp/contact-classifier.ts` | `classifyActor(siteId, phone)` → `'owner' \| 'staff' \| 'customer' \| 'unknown'` |
| `lib/whatsapp/message-router.ts` | `routeCommand()` — regex-pattern command dispatch; calls handler then replies via gateway |
| `lib/whatsapp/encryption.ts` | `encryptToken()` / `decryptToken()` — AES-256-CBC, key from `WA_ENCRYPTION_KEY` secret |
| `lib/whatsapp/phone.ts` | `normalizePhone()`, `formatPhoneE164()`, `isValidE164()` |

### WhatsApp Outbound Flow

```text
Caller (admin UI / module)
   │
   ├── getWAConfig(siteId) → WAConfig (status must be 'connected')
   ├── new WhatsAppGateway(siteId, config)
   └── gateway.send({ to, type, content, human_triggered })
         │
         ├── SAFEGUARD: customer target AND !human_triggered → throw
         │   (Prevents modules from leaking internal data to customers)
         │
         └── POST graph.facebook.com/v19.0/{phoneNumberId}/messages
               Authorization: Bearer {decrypted accessToken}
```

### WhatsApp Inbound Flow

```text
Meta → POST /api/webhook/whatsapp (Next.js route, see §20)
   │
   └── processIncomingMessage(siteId, MetaWebhookPayload)
         │
         For each inbound message:
         │
         ├── 1. storeRawMessage()                ← antifragility: write raw first
         │      → sites/{siteId}/wa/main/raw_messages/{id}
         │
         ├── 2. classifyActor(siteId, msg.from)
         │      ├── Match config.ownerPhone     → 'owner'
         │      ├── Match config.staffPhones[]  → 'staff'
         │      ├── Match contacts (by phone)   → contact.type
         │      └── Otherwise                    → 'unknown'
         │
         └── 3. Route by actor type:
                │
                ├── owner | staff → routeToStaffCommands()
                │      → sites/{siteId}/wa/main/staff_commands/{threadId}
                │      → routeCommand() pattern-matches against COMMAND_MAP
                │      → replies via gateway.send()
                │
                └── customer | unknown → ensureContact() + routeToCustomerThread()
                       → sites/{siteId}/wa/main/customer_threads/{contactId}/messages
                       → surfaces in admin Inbox (no auto-reply)
```

### Owner Command Patterns

From `message-router.ts:COMMAND_MAP`:

| Regex pattern | Handler |
|---|---|
| `/laporan\s*(penjualan\|sales\|harian)?/i` | `handleSalesReport` |
| `/stok\|stock\|inventory\|gudang/i` | `handleStockQuery` |
| `/booking\|reservasi\|jadwal\|appointment/i` | `handleBookingQuery` |
| `/member\|membership\|poin\|points\|loyalty/i` | `handleMemberQuery` |

No match → returns a help message listing available commands.

### Firestore Layout (under `sites/{siteId}/wa/main/...`)

| Path | Purpose |
|---|---|
| `sites/{siteId}/wa/config` | `WAConfig` — phoneNumberId, wabaId, encrypted accessToken, webhookVerifyToken, ownerPhone, staffPhones, status |
| `sites/{siteId}/wa/main/raw_messages/{id}` | Every inbound payload, written before any processing |
| `sites/{siteId}/wa/main/customer_threads/{contactId}` | Per-customer thread doc; `messages` subcollection holds the conversation |
| `sites/{siteId}/wa/main/staff_commands/{threadId}` | Per-staff-actor command thread; `messages` subcollection holds command + response pairs |
| `sites/{siteId}/wa/main/contacts/{contactId}` | Known contacts (linked to CRM via `linkedCrmId`) |
| `sites/{siteId}/wa/main/templates/{templateId}` | Approved Meta templates (HEADER / BODY / FOOTER / BUTTONS components) |

> **Two-level pattern.** Config sits directly under `sites/{siteId}/wa/config`; everything else nests under an anchor doc `wa/main/...` to keep the per-site Firestore tree shallow.

### Admin Endpoints

| Endpoint | Purpose |
|---|---|
| `POST /api/admin/whatsapp/connect` | Save Meta credentials (encrypts `accessToken` before write); set `status: 'connected'` |
| `POST /api/admin/whatsapp/disconnect` | Mark `status: 'disconnected'`; clear sensitive fields |
| `POST /api/admin/whatsapp/send` | Send a one-off message from admin (always sets `human_triggered: true`) |
| `POST /api/admin/whatsapp/test` | Send a sandbox/test message to verify connection |
| `POST /api/webhook/whatsapp` | Meta webhook receiver (verify-token GET handshake + POST event delivery) |

### Phone Number Handling

All phone comparisons use `normalizePhone()` which strips everything except digits — so `+62 812-3456-7890` and `628123456789` and `08123456789` (after E.164 formatting) compare equal. Always pass through `formatPhoneE164()` before storing.

### Customer-Target Safeguard

The `WhatsAppGateway.send()` method **throws** if the target is a customer and `human_triggered` is not `true`. This is a deliberate guard:

```typescript
if (isCustomerTarget && !message.human_triggered) {
    throw new Error('Cannot send to customer without human_triggered: true. ...');
}
```

Modules that need to message customers (e.g. service reminders, booking confirmations) must set `human_triggered: true` explicitly — which forces the author to reason about whether the message is appropriate. Internal messages to owner/staff don't need the flag.

### WhatsApp Rules

- **Always read `WAConfig` first** and check `status === 'connected'` before sending.
- **Set `human_triggered: true`** on every customer-targeted send.
- **Encrypt access tokens** via `encryptToken()` before writing to Firestore; decrypt server-side only.
- **Never bypass the gateway** — direct `fetch` to Meta's API skips the safeguard and the config read.
- **Webhook auth:** Meta's webhook signature must be verified in `/api/webhook/whatsapp` before invoking `processIncomingMessage` (see route implementation).

---

<!-- Sections to be filled in by subsequent tasks -->
