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

### Module Registration Files

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

### AI Admin Endpoints

| Endpoint | Purpose |
|---|---|
| `GET /api/admin/ai-credits` | Current balance + recent ledger entries (admin UI) |
| `GET /api/admin/ai-usage` | Daily aggregate for charts (admin UI) |
| `GET /api/admin/ai/credits` | Legacy alias — being consolidated into the path above |

> Backyard (superadmin) owns model/pricing configuration; the platform consumes it read-only.

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

### WhatsApp Admin Endpoints

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

## 14. Registration Flow

Public self-service registration at `clicker.id/register`. A prospect submits a form (business profile + bundle/modules + optional promo code). The submission writes a **pending** registration request to Firestore for human review in Backyard — no site is provisioned automatically.

> **Status:** Implemented end-to-end. Form, server action, validation, rate limiting, promo revalidation, dual email notifications, and event log are all live. Activation (turning a registration into a real tenant) happens in Backyard.

### What Registration Does

- Collect lead contact + business profile + module/bundle interest in one form.
- Validate input with Zod, rate-limit by client IP (in-memory bucket).
- Re-validate any promo code server-side at submit time (separate site `sites/go/modules/promo/promos` holds registration-eligible promo codes).
- Persist to `registrationRequests` collection for human review.
- Fire two transactional emails (fire-and-forget): confirmation to applicant, notification to admin.
- Append events to a TTL-bounded event log for debugging.

### Registration Files

| File | Role |
|---|---|
| `lib/registration/submit-action.ts` | `submitRegistration()` server action — rate limit, validate, persist, email |
| `lib/registration/api-server.ts` | `createRegistrationRequest()`, `validatePromoCode()` (Firebase Admin) |
| `lib/registration/schema.ts` | Zod schemas: `registrationInputSchema`, `businessTypeSchema`; `RegistrationInput` type |
| `lib/registration/bundles.ts` | `BUNDLES` catalogue (`restaurant-starter`, `auto-detailing`, `beauty-spa`) + `getBundleById` |
| `lib/registration/modules-catalog.ts` | Module catalog for the picker UI |
| `lib/registration/rate-limit.ts` | `createRateLimiter()` (in-memory) + exported `submitLimiter` (5/hr) + `validatePromoLimiter` (30/hr) |
| `lib/registration/slug.ts` | `suggestSlug()` — slug suggestion from business name |
| `lib/registration/event-log.ts` | `writeEvent()` with 7-day TTL — events like `email.failed`, `registration.activated`, `registration.rejected` |
| `lib/registration/constants.ts` | `REGISTRATION_REQUESTS_COLLECTION = 'registrationRequests'` |
| `lib/registration/types.ts` | `RegistrationRequestInput`, `Bundle`, etc. |

### Public Route

- `app/(public)/register/page.tsx` — the form UI (`/(public)` is a Next.js route group; the URL is `/register` per §3 special routes).

### Submit Flow

```text
[Form] → server action submitRegistration(input)
   │
   ├── 1. Rate limit: submitLimiter.check(clientIp)
   │      → 5 submissions per IP per hour, in-memory
   │
   ├── 2. Zod validation: registrationInputSchema.safeParse(input)
   │      → on failure: return { ok: false, error, fieldErrors }
   │      → enforces: name+email+phone, Indonesian phone regex,
   │        businessName/Type/city/expectedOutlets, modules>0 OR customRequest
   │
   ├── 3. Promo revalidation (if input.promoCode provided)
   │      → validatePromoCode() reads sites/go/modules/promo/promos
   │      → sets promoCodeValidAtSubmit = true|false
   │
   ├── 4. createRegistrationRequest() → Firestore add()
   │      → registrationRequests/{id} with full input + timestamps
   │
   ├── 5. Fire-and-forget email pair:
   │      ├── Confirmation to applicant (template alias 'regConfirmation')
   │      └── Notification to ADMIN_NOTIFICATION_EMAIL (if set)
   │         Includes a deep link to backyard/registrations/{id}
   │      → Failures write event 'email.failed' but don't fail the submit
   │
   └── Return { ok: true, id }
```

### Validation Rules

`registrationInputSchema` (`schema.ts`) enforces:

- `name`: 1–120 chars
- `email`: RFC + max 200 chars
- `phone`: `/^(\+62|62|0)[0-9]{8,13}$/` (Indonesian only)
- `businessName`: 2–120 chars
- `businessType`: one of `fnb`, `auto-detailing`, `beauty-spa`, `retail`, `service`, `other`
- `city`: 1–80 chars
- `expectedOutlets`: integer 1–10000
- `bundle`: string or null
- `modules`: array of strings, max 50
- `customRequest`: string up to 2000 chars
- `promoCode`: string up to 80 chars or null
- `promoCodeValidAtSubmit`: boolean (re-validated server-side)
- `source`: string up to 500 chars or null
- **Refinement:** must have at least one module OR a non-empty `customRequest`.

### Bundles Catalogue

Source: `bundles.ts`.

| Bundle ID | Name | Modules |
|---|---|---|
| `restaurant-starter` | Restaurant Starter | `byod_pos`, `inventory` |
| `auto-detailing` | Auto Detailing Pro | `service_records`, `membership`, `promo` |
| `beauty-spa` | Beauty / Spa | `reservation`, `membership`, `promo` |

The picker UI lets a user either select a bundle (which preselects modules) or freely toggle individual modules from the catalog.

### Promo Code on Registration

Registration promos live in a separate "platform-site" at `sites/go/modules/promo/promos` (note: `siteId = 'go'`). This isolates platform-level promo codes (signup discounts) from per-tenant promos. The validation is server-side; client-side promoCodeValidAtSubmit is treated as a hint and always re-checked at submit time.

### Rate Limiting

`rate-limit.ts` uses an **in-memory token bucket** keyed by client IP — not Upstash Redis. This means rate limits are per-process: if the server is scaled horizontally, each instance has its own bucket. For low-volume registration flow this is acceptable; if abuse surfaces, swap to Upstash.

| Limiter | Max | Window |
|---|---|---|
| `submitLimiter` | 5 | 1 hour |
| `validatePromoLimiter` | 30 | 1 hour |

### Registration Firestore Paths

| Path | Purpose |
|---|---|
| `registrationRequests/{id}` | Pending registration; reviewed in Backyard |
| `registrationEvents/{eventId}` | Operational events (7-day TTL): `email.failed`, `registration.activated`, `registration.credentials_sent`, `registration.rejected`, `promo.commit.failed` |
| `sites/go/modules/promo/promos` | Platform-level promo codes valid at registration time |

### Activation

Activation (turning a `registrationRequest` into a real tenant) is a **Backyard-only** flow. The platform repo does not auto-provision sites from registrations.

### Registration Rules

- **Never auto-provision a site from a registration.** A human approves in Backyard.
- **Always re-validate promo codes at submit.** The client's `promoCodeValidAtSubmit` is a hint, not authoritative.
- **Emails are fire-and-forget.** A submit that creates the Firestore doc but fails to email is still considered successful — emails surface failures via `registrationEvents`.
- **Phone regex is Indonesia-only** — if you need to expand, update both `schema.ts` and the form's client-side validation.

---

## 15. Promo Engine Facade

The Promo Engine is a **sanctioned cross-module facade** (§6) — one of two modules whose `api/` is explicitly importable from other modules. It owns promo/voucher CRUD, evaluation (does this cart qualify for this code?), and commit/reverse (record usage at checkout / undo on void).

### What Promo Engine Does

- Tenant-owned promos and vouchers — codes, auto-apply rules, conditions (min subtotal, audience targeting, expiry, max usage per member).
- Evaluates a cart context against a code or auto-rule → returns either a discount preview or an `EvaluationFailure` with a reason.
- Tracks per-member usage counts to enforce limits.
- Commits a redemption record at checkout; supports reversing on order void.
- Generates and grants vouchers to specific members (e.g. loyalty redemption).

### Why a Facade Exception

Promo logic touches POS (cashier subtotals), Reservation (booking fees), and Service Records (service totals). Duplicating the evaluator in each module would create drift between how a `WEEKEND20` code applies on each surface. The facade keeps evaluation in one place; consumers pass a cart/booking context in and get a single discount number out.

### Promo Files

```text
lib/modules/promo/
├── api.ts                   ← Public facade — the ONLY file other modules may import
├── api/
│   ├── claim.ts             ← claimVoucher(), grantVoucher()
│   ├── commit.ts            ← commitPromoUsage(), reversePromoUsage()
│   ├── discount.ts          ← calculateDiscount(input, subtotal) → number
│   ├── evaluator.ts         ← evaluatePromo(), findAutoApplicable()
│   ├── promos.ts            ← Promo CRUD + getMemberUsageCount, listClaimablePromos
│   ├── settings.ts          ← getPromoSettings, updatePromoSettings
│   └── vouchers.ts          ← Voucher CRUD + revokeVoucher, findVoucherByUsedRef
├── components/              ← Admin UI + PromoApplicator client component
├── code-generator.ts        ← Voucher code generator (4-char alphanumeric blocks)
├── sources.ts               ← Promo source/audience helpers
├── constants.ts             ← PROMOS_COLLECTION, VOUCHERS_COLLECTION, SETTINGS_DOC, defaults
├── types.ts                 ← Promo, Voucher, PromoSettings, EvaluationResult, AppliedPromo
└── __tests__/
```

### Facade Public API

The complete surface exported by `lib/modules/promo/api.ts`. Other modules import only from this file (or its directory equivalent `@/lib/modules/promo/api`).

| Export | Type | Purpose |
|---|---|---|
| `getPromoSettings(siteId)` | `() => Promise<PromoSettings>` | Read site-level promo config |
| `updatePromoSettings(siteId, patch)` | `() => Promise<void>` | Partial update |
| `listPromos(siteId)` | `() => Promise<Promo[]>` | All promos for a site |
| `getPromo(siteId, promoId)` | `() => Promise<Promo \| null>` | By ID |
| `findPromoByCode(siteId, code)` | `() => Promise<Promo \| null>` | Lookup by user-entered code |
| `createPromo`, `updatePromo`, `setPromoStatus`, `deletePromo` | CRUD | Admin operations |
| `listClaimablePromos(siteId, memberId)` | `() => Promise<Promo[]>` | Promos a member can claim |
| `getMemberUsageCount(...)` | `() => Promise<number>` | Per-member redemption count |
| `listAllVouchers(siteId)` | `() => Promise<Voucher[]>` | All vouchers |
| `listMemberVouchers(siteId, memberId)` | `() => Promise<Voucher[]>` | Member's vouchers |
| `findVoucherByCode`, `getVoucher`, `findVoucherByUsedRef` | Lookups | |
| `setVoucherStatus(siteId, voucherId, status)`, `revokeVoucher(...)` | Mutations | |
| `calculateDiscount(input, subtotal)` | `(DiscountInput, number) => number` | Pure discount math (percent vs fixed, max-cap) |
| `evaluatePromo(input)` | `(EvaluateInput) => Promise<EvaluationResult>` | Evaluate code+context → discount preview or failure |
| `findAutoApplicable(...)` | Discover | Returns auto-apply promos that match cart context |
| `commitPromoUsage(input)` | `(CommitInput) => Promise<void>` | Record redemption at checkout |
| `reversePromoUsage(input)` | `(CommitInput) => Promise<void>` | Undo on void/refund |
| `claimVoucher(input)` | `(ClaimVoucherInput) => Promise<Voucher>` | Member-initiated claim |
| `grantVoucher(input)` | Admin-initiated grant | |

Re-exported types: `Promo`, `Voucher`, `PromoSettings`, `PromoSource`, `PromoKind`, `PromoStatus`, `PromoTrigger`, `PromoAudience`, `PromoConditions`, `VoucherStatus`, `VoucherIssuedVia`, `EvaluationResult`, `EvaluationFailure`, `AppliedPromo`.

### Typical Consumer Pattern

A POS checkout flow:

```typescript
import { evaluatePromo, commitPromoUsage, reversePromoUsage, type AppliedPromo } from '@/lib/modules/promo/api';

// 1. User enters code at cart
const result = await evaluatePromo({
    siteId,
    code,
    subtotal,
    memberId,        // optional
    moduleContext: { kind: 'pos', orderId },
});

if (result.ok) {
    // result.applied: AppliedPromo — show discount preview in UI
} else {
    // result.reason: EvaluationFailure — show error message
}

// 2. On payment success, record the usage
await commitPromoUsage({
    siteId, promoId: result.applied.promoId,
    voucherId: result.applied.voucherId,
    memberId, moduleContext: { kind: 'pos', orderId },
});

// 3. On void, reverse
await reversePromoUsage({ siteId, promoId, voucherId, memberId, moduleContext });
```

### Current Consumers (Cross-Module Imports)

Source: `grep -rn "@/lib/modules/promo/api" lib/modules/`.

| Module | What it uses |
|---|---|
| `byod_pos` | `evaluatePromo`, `commitPromoUsage`, `reversePromoUsage`, `AppliedPromo` (cashier + POS client + payment dialog) |
| `reservation` | `commitPromoUsage`, `AppliedPromo` (booking wizard, public booking form, details step) |

`service_records` does not currently consume the promo facade (per current grep results) but may in the future.

### Public Endpoint

| Endpoint | Purpose |
|---|---|
| `POST /api/public/validate-promo` | Unauthenticated cart-side validation (called from public booking, etc.) |

### Promo Firestore Paths

| Path | Purpose |
|---|---|
| `sites/{siteId}/modules/promo/promos/{promoId}` | Promo definitions |
| `sites/{siteId}/modules/promo/vouchers/{voucherId}` | Vouchers (per-member or guest) |
| `sites/{siteId}/modules/promo/settings/config` | Site-level promo settings |

> The `sites/go/modules/promo/promos` collection is **separate** — used by registration (§14) for platform-level signup promos. Same shape, different site ID.

### Voucher Code Generation

`code-generator.ts` generates 4-character alphanumeric blocks (e.g. `VCH-A3K7-9MZQ`). The prefix (`VCH` by default) comes from `PromoSettings.voucherCodePrefix`. Default voucher expiry is 30 days (`defaultVoucherExpiryDays`).

### Promo Engine Rules

- **Import from `@/lib/modules/promo/api`, never from internal files.** The facade is the contract.
- **Always `evaluatePromo` before showing a discount.** Client-side `calculateDiscount` alone misses condition checks (audience, member limits, expiry).
- **Always `commitPromoUsage` on successful payment** — without it, usage counts drift and members can over-redeem.
- **Reverse on void/refund** — otherwise a returned order still counts against the member's limit.
- **Member-targeted promos require `memberId`** in the evaluate/commit calls — anonymous carts can only redeem `allowGuestCodes` promos.

---

## 16. Core Business Primitives

`lib/core/` hosts cross-module business primitives — tenant-level data that multiple modules need to read or write, but that doesn't belong inside any one module. Promoting these to `lib/core/` avoids the cross-module imports forbidden by §6.

### What Core Primitives Owns

Two primitives currently live in `lib/core/`:

- **Business Hours** — week schedule (open/closed per day, time ranges, breaks). Read by public site (Hours block, Operating Hours block) and used implicitly by reservation availability and POS open/close gating.
- **Service Catalog** — tenant-level catalog of bookable/serviceable items (`ServiceCatalogItem`) with categories. Shared by Reservation, Service Records, and the admin Services page.

Both are **core-owned**: any module that needs them imports from `@/lib/core/...` — never from another module.

### Core Files

```text
lib/core/
├── types.ts                    ← Shared types: TimeRange, DaySchedule
├── businessHours/
│   └── utils.ts                ← isBusinessOpen(date, schedule), getOperatingWindows(date, schedule)
└── serviceCatalog/
    ├── types.ts                ← ServiceCatalogItem, ServiceCategoryConfig, DEFAULT_SERVICE_CATEGORIES
    ├── api.ts                  ← Client CRUD (Firestore client SDK) + SERVICE_CATALOG = 'serviceCatalog'
    └── serverApi.ts            ← Server-side fetcher (firebase-admin) for Server Components
```

### Shared Time Types (`lib/core/types.ts`)

```typescript
export interface TimeRange {
    start: string;  // "09:00"
    end: string;    // "17:00"
}

export interface DaySchedule {
    dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday
    isOpen: boolean;
    hours: TimeRange[];
    breaks?: TimeRange[];
}
```

A tenant's weekly schedule is `DaySchedule[]` (length 7). Stored on the site doc (consult `firestore.rules` and the actual write site).

### Business Hours API

`lib/core/businessHours/utils.ts`:

| Function | Purpose |
|---|---|
| `isBusinessOpen(date: Date, schedule: DaySchedule[])` | Returns `true` if `date` falls in an open hours range and not in a break |
| `getOperatingWindows(date: Date, schedule: DaySchedule[])` | Returns the `TimeRange[]` of open windows for that date |

These are **pure functions** — no Firestore reads. Callers fetch `schedule` once and pass it in.

### Service Catalog API

Per-site catalog stored at `sites/{siteId}/serviceCatalog/{itemId}`. Categories live in a separate doc/collection (consult `serviceCatalog/api.ts:95`).

| Function | Side | Purpose |
|---|---|---|
| `getServiceCatalog(siteId)` | Client | List all catalog items |
| `getServiceCatalogItem(siteId, id)` | Client | Single item |
| `createServiceCatalogItem(...)`, `updateServiceCatalogItem(...)`, `deleteServiceCatalogItem(siteId, id)` | Client | Mutations (admin) |
| `getServiceCategories(siteId)` | Client | Category list |
| `saveServiceCategories(siteId, categories)` | Client | Bulk replace |
| `fetchServiceCatalog(...)` | Server | Server Component version using `firebase-admin` |

### Core Consumers

Source: `grep -rn "@/lib/core/" lib/modules/ components/ app/`.

| Consumer | What it uses |
|---|---|
| Admin Services page (`app/admin/(dashboard)/services/`) | Full service catalog CRUD |
| `components/blocks/public/DefaultOperatingHoursBlock.tsx` | `isBusinessOpen()` for "Open Now" badge |
| `components/blocks/mrb/MrbOperatingHours.tsx` | Same — MRB template variant |
| `reservation` module (`api.ts`, booking detail panel) | Service catalog lookups |
| `service_records` module (`api.ts`, `types.ts`, Service Types page) | Service catalog + category types |

Notable: `reservation` and `service_records` both depend on the **same** service catalog — exactly the use case `lib/core/` exists to handle. If this code lived inside one of the modules, the other would be forced into a cross-module import.

### When to Add Something to `lib/core/`

Promote logic from a module to `lib/core/` when:

1. Two or more modules need to read or write the same business primitive, AND
2. The primitive is **tenant-level data**, not a feature-specific abstraction, AND
3. The interface is small enough to be a single API surface (a folder with `api.ts` + `types.ts`).

If only one module currently needs it, leave it in that module — promote when the second consumer appears, not preemptively.

### Core Primitives Rules

- **No business logic that's specific to a single module** — that belongs in the module.
- **No coupling to a module's internals** — `lib/core/` may not import from `lib/modules/`.
- **Server vs client split is per-primitive** — Service Catalog has both `api.ts` (client) and `serverApi.ts` (server). Match whichever the consumer needs.

---

## 17. Storage & Upload

File and image uploads to **Firebase Storage**. Two parallel paths exist — a **client-direct** upload (preferred for most cases) and a **server-side route** (used when sharp-based processing is needed). Both write to tenant-scoped paths under `sites/{siteId}/...`.

### What Storage & Upload Owns

- Client-side image conversion to WebP/AVIF before upload (smaller files, no server round-trip).
- Server-side image processing with `sharp` for resize/format pipelines.
- Tenant-scoped storage paths.
- Size and MIME validation (10 MB cap, image-only for image endpoints).

### Upload Files

| File | Role |
|---|---|
| `lib/upload.ts` | Client direct-to-storage helper: `uploadToStorage({ file, folder, siteId, convertToWebP })` |
| `lib/imageUtils.ts` | Client image processing helpers: `resizeAndConvert`, `convertToWebP`, `validateImageFile` |
| `lib/media/recommendations.ts` | Recommended dimensions per aspect ratio (16:9, 4:3, square, 3:4, free) + `isBelowRecommended()` quality check |
| `app/api/upload/avatar/route.ts` | Server upload — avatar (no resize, MIME validation, auth required) |
| `app/api/upload/image/route.ts` | Server upload — generic image (sharp resize, auth required) |
| `storage.rules` | Firebase Storage security rules |

### Client-Direct Upload (Preferred)

```typescript
import { uploadToStorage } from '@/lib/upload';

const downloadUrl = await uploadToStorage({
    file,                       // File object from <input type="file">
    folder: 'gallery',          // Subfolder under the storage prefix
    siteId,                     // Required for tenant scoping; omit for platform-level
    convertToWebP: true,        // Default true for images
    webpQuality: 0.85,          // 0–1
});
```

**Storage path:** `sites/{siteId}/{folder}/{timestamp}_{random}.{ext}` (or `{folder}/...` if no siteId).

**Why client-direct exists.** The server-side `firebase-admin` SDK has a Turbopack hashing issue that breaks dev builds. The client direct path bypasses this entirely.

### Client-Side Image Conversion

In `uploadToStorage`, images are converted before upload:

1. Draw the source image to an off-screen canvas.
2. `canvas.toBlob('image/webp', quality)` — preferred.
3. Fallback to `canvas.toBlob('image/avif', quality)` if WebP unsupported.
4. Reject if neither is supported.
5. Non-image files and GIFs are uploaded as-is.

This pushes encoding to the client (no server CPU cost) and produces files 30–60% smaller than the source JPEG/PNG.

### Server Upload Routes

Used when the client cannot easily produce the right output (server-side resize, document/PDF processing, etc.).

| Endpoint | Sharp? | Folder | Notes |
|---|---|---|---|
| `POST /api/upload/avatar` | No | implicit avatar folder | MIME allowlist `image/jpeg`, `image/png`, `image/webp`, `image/gif`; 10 MB cap |
| `POST /api/upload/image?folder={folder}` | Yes | configurable via query | Same MIME + size caps; sharp pipeline for resize/format |

Both routes:

- Require authentication via `requireAuthedMember(req)` from `lib/api-auth.ts` → returns `{ siteId }` from the session.
- Validate MIME against an allowlist.
- Reject files over **10 MB**.
- Log failures via `logger.warn('upload.invalid.type', ...)` / `'upload.size.exceeded'`.

### Media Recommendations

`lib/media/recommendations.ts` provides per-aspect-ratio recommended sizes for the admin Canvas Studio's media picker:

| Aspect ratio | Recommended | Label |
|---|---|---|
| `16:9` | 1280×720 | `1280×720` |
| `4:3` | 1024×768 | `1024×768` |
| `square` | 1024×1024 | `1024×1024` |
| `3:4` | 768×1024 | `768×1024` |
| `free` | 1280×960 | `1280×960` |

`isBelowRecommended(natural, aspectRatio)` — returns `true` if either dimension is below 50% of the recommended size. Used to surface a "low quality" warning in the editor.

### Storage Rules (`storage.rules`)

```text
service firebase.storage {
  match /b/{bucket}/o {
    function isAuthenticated() { return request.auth != null; }

    // Default: public read
    match /{allPaths=**} {
      allow read: if true;
    }

    // Tenant paths: public read, authenticated write
    match /sites/{siteId}/{allPaths=**} {
      allow read: if true;
      allow write: if isAuthenticated();
    }

    // Legacy paths
    match /products/{allPaths=**} { allow write: if isAuthenticated(); }
    match /uploads/{allPaths=**}  { allow write: if isAuthenticated(); }
  }
}
```

> **Tenant isolation is NOT enforced at the rules layer.** Any authenticated user could write to any tenant's path. Tenant scoping is enforced in application code via `requireAuthedMember(req)` (server routes) and via the `siteId` in `useSite()` (client uploads). If a stronger guarantee is needed, tighten `storage.rules` to require `request.auth.token.siteId == siteId` (only works once custom claims are set).

### Image Validation (Client Side)

`validateImageFile(file, maxSizeMB = 10)` from `lib/imageUtils.ts`:

- Rejects files > `maxSizeMB`.
- Rejects non-image MIME.
- Returns an error string or `null`.

Always call this before `uploadToStorage` in admin forms to give the user a fast error path.

### Storage Rules of Thumb

- **Use client-direct (`uploadToStorage`) by default.** Falls back to native browser encoding; no server CPU.
- **Use server routes** when you need sharp's pipeline (resize-to-fit, generate thumbnails, convert from DOC/PDF) or when the upload must happen as part of a server action.
- **Pass `siteId` whenever the file is tenant-owned.** Forgetting it puts the file at the bucket root, where it'll never be cleaned up if the tenant is deleted.
- **Stick to the 10 MB cap.** Larger files should use direct Firebase Storage uploads with a resumable session, not the standard helpers.
- **Watch the storage rules.** Today they are intentionally permissive — any change should preserve public read but consider tightening write scoping.

---

## 18. Global Contexts

Five React contexts wrap the admin tree. All are mounted at or near the admin layout root. Two (`useSite`, `useUser`) are detailed in earlier sections (§3, §5) and summarized here; three (`useAdminTheme`, `useInboxPanel`, `useTopBarSlots`) are admin-UI specific.

### `useSite()` — `lib/site-context.tsx`

Current tenant. See §3 for tenant resolution, §4 for the `setSiteId` setter used in the auth handoff.

| Property / Method | Type | Purpose |
|---|---|---|
| `siteId` | `string` | Canonical tenant ID |
| `tenantSlug` | `string` | URL slug |
| `isPending` | `boolean` | True until `siteId` resolves |
| `isSubdomain` | `boolean` | Accessed via subdomain (vs path-based) |
| `setSiteId(id)` | `(string) => void` | Client-side tenant switch without reload — used by `TokenBootstrap` (§4) |

### `useUser()` — `lib/user-context.tsx`

Auth state + RBAC. See §5 for full role/permission semantics.

| Property / Method | Type | Purpose |
|---|---|---|
| `user` | `User \| null` | Firebase Auth user |
| `role` | `Role \| null` | `'owner' \| 'editor' \| 'viewer' \| 'staff'` |
| `permissions` | `string[]` | Legacy permission strings (`['*']` for owner shortcut) |
| `moduleAccess` | `Record<string, ModuleAccess>` | Granular per-module-route grants |
| `loading` | `boolean` | Auth state still resolving |
| `isOwner` | `boolean` | Shortcut for `role === 'owner'` |
| `hasAccess(moduleId, routeId)` | `(string, string) => boolean` | `true` if `full` or `view` — for render gating |
| `canEdit(moduleId, routeId)` | `(string, string) => boolean` | `true` only if `full` — for write gating |
| `getAccessLevel(moduleId, routeId)` | `(string, string) => 'full' \| 'view' \| 'none'` | Raw access level |

`UserProvider` uses `onSnapshot` on `sites/{siteId}/members/{uid}` — permission changes apply in real time.

### `useAdminTheme()` — `lib/use-admin-theme.tsx`

Admin dashboard light/dark mode. The toggle persists to `localStorage`.

```typescript
const { isDark, toggle } = useAdminTheme();
```

| Property / Method | Type |
|---|---|
| `isDark` | `boolean` |
| `toggle()` | `() => void` |

Consumed by admin components via the `dark:` Tailwind prefix pattern — see §21.

### `useInboxPanel()` — `lib/inbox-panel-context.tsx`

Global state for the right-side **Inbox panel** (admin-wide drawer for form submissions, etc.).

```typescript
const {
    isOpen,
    activeTab, setActiveTab,           // 'inbox' | ...
    filterStatus, setFilterStatus,     // 'all' | ...
    selectedSubmissionId, setSelectedSubmissionId,
    openPanel, closePanel, togglePanel,
} = useInboxPanel();
```

The state lives at the layout level so any admin page can open the inbox without prop-drilling. Initial state: closed, tab `'inbox'`, filter `'all'`, no submission selected.

### `useTopBarSlots()` — `lib/top-bar-slot-context.tsx`

Slot-based injection into the admin **top bar**. Any page can set the left / center / right slot content from inside its own component tree without reaching into the layout.

```typescript
const { slots, setLeftSlot, setCenterSlot, setRightSlot, clearSlots } = useTopBarSlots();

// In a page:
useEffect(() => {
    setRightSlot(<SaveButton />);
    return clearSlots;
}, []);
```

| Slot | Typical contents |
|---|---|
| `left` | Page title, back button |
| `center` | Mode switcher, breadcrumbs |
| `right` | Primary action button(s) |

Always `clearSlots()` on unmount so slot contents don't leak into the next page.

### Provider Stack

The expected admin provider order (outer → inner):

```text
<SiteProvider>          ← from middleware-injected x-site-id
  <UserProvider>        ← needs siteId to query members/{uid}
    <AdminThemeProvider>
      <PostHogProvider> ← needs siteId for super-property (§12)
        <InboxPanelProvider>
          <TopBarSlotProvider>
            {children}
          </TopBarSlotProvider>
        </InboxPanelProvider>
      </PostHogProvider>
    </AdminThemeProvider>
  </UserProvider>
</SiteProvider>
```

`SiteProvider` and `UserProvider` are also used outside `/admin` (public tenant pages and member portal) — but they hydrate from URL/cookie rather than from the auth handoff.

### Global Contexts Rules

- **Never hardcode `siteId`.** Always read from `useSite()`.
- **Never gate writes on `hasAccess` alone.** Use `canEdit` — `view` access must not call writes.
- **Provider order matters.** `UserProvider` reads `siteId` from `SiteProvider`; PostHog needs both. If you reshuffle providers, verify the dependency chain.
- **Top-bar slots are page-scoped.** Clear them on unmount.

---

## 19. Database Paths

Firestore is the only operational database. Paths follow two patterns:

- **Core data:** `sites/{siteId}/{collection}/{docId}` — top-level per-tenant.
- **Module data:** `sites/{siteId}/modules/{module_id}/{collection}/{docId}` — namespaced under the module ID.

**Path constants live in module `constants.ts` (or `api.ts` for modules without a dedicated constants file).** Never hardcode path strings in components or random files. See per-module breakdown below for the canonical constants.

### Core Data (Tenant-Level)

| Path | Constant location | Purpose |
|---|---|---|
| `sites/{siteId}` | — | Tenant root doc (template choice, business profile, etc.) |
| `sites/{siteId}/members/{uid}` | — | Member records (role, moduleAccess) — see §5 |
| `sites/{siteId}/pages/{pageId}` | — | Custom pages (Canvas Studio output) |
| `sites/{siteId}/pages/{pageId}/blocks/{blockId}` | — | Block array for a page |
| `sites/{siteId}/links/{linkId}` | — | Link-in-bio items |
| `sites/{siteId}/products/{productId}` | — | Base product catalog (used by Products block, POS menu) |
| `sites/{siteId}/forms/{formId}` | `lib/fetchData.ts` references | Form definitions |
| `sites/{siteId}/submissions/{subId}` | — | Form submissions |
| `sites/{siteId}/serviceCatalog/{itemId}` | `lib/core/serviceCatalog/api.ts` (`SERVICE_CATALOG = 'serviceCatalog'`) | Tenant-level service catalog (§16) |
| `sites/{siteId}/emailLog/{logId}` | `lib/email/log.ts` | Email log (§11) |
| `sites/{siteId}/platform/aiCredits` | `lib/ai/credits.ts` | AI Kredit balance (§10) |
| `sites/{siteId}/platform/aiCreditLedger/daily/{YYYY-MM-DD}` | `lib/ai/credits.ts` | AI daily usage aggregate (§10) |
| `sites/{siteId}/platform/aiCreditLedger/entries/{entryId}` | `lib/ai/credits.ts` | AI topup log (append-only) (§10) |
| `sites/{siteId}/wa/config` | `lib/whatsapp/constants.ts` | WhatsApp config (§13) |
| `sites/{siteId}/wa/main/...` | `lib/whatsapp/constants.ts` | WhatsApp threads, contacts, raw messages, etc. (§13) |

### Platform-Level (Not Per-Tenant)

| Path | Purpose |
|---|---|
| `modules/{module_id}` | Global module enable/version/publicRoutes registry — read by `lib/modules/registry.ts` |
| `modules/ai-platform/config/models` | AI model selection (§10) |
| `modules/ai-platform/config/pricing` | AI per-model pricing (§10) |
| `platform/settings/email/config` | Email sender + template aliases (§11) |
| `registrationRequests/{id}` | Pending registrations from `/register` (§14) |
| `registrationEvents/{eventId}` | Registration operational events (7-day TTL) (§14) |
| `system/email/emailLog/{logId}` | Email log for platform-level emails (`siteId === null`) (§11) |

### Module Data

All modules namespace under `sites/{siteId}/modules/{module_id}/...`. The `{module_id}` uses underscores when multi-word (e.g. `byod_pos`, `service_records`, `sales_pipeline`) — see §7 for the naming convention.

#### `byod_pos` (Self-Order POS)

| Path | Constant |
|---|---|
| `sites/{siteId}/modules/byod_pos/orders/{orderId}` | `ORDERS_COLLECTION` in `byod_pos/constants.ts` |
| `sites/{siteId}/modules/byod_pos/menu_items/{itemId}` | (inline in `api-admin.ts`, `api-server.ts`) |
| `sites/{siteId}/modules/byod_pos/settings/config` | `SETTINGS_DOC` |

#### `membership`

| Path | Constant |
|---|---|
| `sites/{siteId}/modules/membership/members/{memberId}` | `MEMBERS_COLLECTION` in `membership/api.ts` |
| `sites/{siteId}/modules/membership/transactions/{txnId}` | `TRANSACTIONS_COLLECTION` |
| `sites/{siteId}/modules/membership/settings/config` | `SETTINGS_DOC` |
| `sites/{siteId}/modules/membership/settings/counter` | `COUNTER_DOC` (member code counter) |

#### `inventory`

| Path | Constant |
|---|---|
| `sites/{siteId}/modules/inventory/items/{itemId}` | `INVENTORY_COLLECTION` in `inventory/api.ts` |
| `sites/{siteId}/modules/inventory/transactions/{txnId}` | `TRANSACTIONS_COLLECTION` |

#### `reservation`

| Path | Constant |
|---|---|
| `sites/{siteId}/modules/reservation/bookings/{bookingId}` | `BOOKINGS_COLLECTION` in `reservation/api.ts` |
| `sites/{siteId}/modules/reservation/settings/config` | `SETTINGS_DOC` |

#### `sales_pipeline`

| Path | Constant |
|---|---|
| `sites/{siteId}/modules/sales_pipeline/leads/{leadId}` | `MODULE_ID + COLLECTION_LEADS` in `sales-pipeline/constants.ts` (`MODULE_ID = 'sales_pipeline'`, `COLLECTION_LEADS = 'leads'`) |
| `sites/{siteId}/modules/sales_pipeline/settings/{...}` | `COLLECTION_CONFIG = 'settings'` |

#### `service_records`

All paths prefixed `sites/{siteId}/modules/service_records/...`. From `service-records/constants.ts`:

| Path (suffix) | Constant |
|---|---|
| `serviceRecords/{recordId}` | `SR_RECORDS` |
| `vehicles/{vehicleId}` | `SR_VEHICLES` |
| `serviceTypes/{typeId}` | `SR_SERVICE_TYPES` |
| `warrantyCards/{cardId}` | `SR_WARRANTY_CARDS` (also indexed for collection-group lookup by warrantyCode) |
| `reminderQueue/{reminderId}` | `SR_REMINDER_QUEUE` |
| `serviceConfig` | `SR_CONFIG` |
| `carCatalog/{carId}` | `SR_CAR_CATALOG` |

> **Multi-outlet readiness.** Service Records uses an `outletId` field on records (see `OUTLET_ID_V1(siteId) = siteId`). In v1 single-outlet, `outletId === siteId`. When multi-outlet ships, replace with actual outlet resolution.

#### `promo`

| Path | Constant |
|---|---|
| `sites/{siteId}/modules/promo/promos/{promoId}` | `PROMOS_COLLECTION` in `promo/constants.ts` |
| `sites/{siteId}/modules/promo/vouchers/{voucherId}` | `VOUCHERS_COLLECTION` |
| `sites/{siteId}/modules/promo/settings/config` | `SETTINGS_DOC` |
| `sites/go/modules/promo/promos/{promoId}` | Platform-level registration promos (siteId = `'go'`) — see §14 |

#### `fintrack`

From `fintrack/constants.ts` (8 collections):

| Path (under `sites/{siteId}/`) | Constant |
|---|---|
| `modules/fintrack/wallets/{walletId}` | `FT_WALLETS` |
| `modules/fintrack/entries/{entryId}` | `FT_ENTRIES` |
| `modules/fintrack/transfers/{transferId}` | `FT_TRANSFERS` |
| `modules/fintrack/categories/{categoryId}` | `FT_CATEGORIES` |
| `modules/fintrack/budgets/{budgetId}` | `FT_BUDGETS` |
| `modules/fintrack/goals/{goalId}` | `FT_GOALS` |
| `modules/fintrack/debts/{debtId}` | `FT_DEBTS` |
| `modules/fintrack/recurring/{recurringId}` | `FT_RECURRING` |
| `modules/fintrack/private/config` | `FT_CONFIG` |

#### `stocklens`

| Path | Constant |
|---|---|
| `sites/{siteId}/modules/stocklens/skus/{skuId}` | `STOCKLENS_SKUS` |
| `sites/{siteId}/modules/stocklens/private/config` | `STOCKLENS_CONFIG` |

#### `ai_marketing`

From `ai-marketing/constants.ts` (5 collections, all using underscored module ID `ai_marketing`):

| Path (under `sites/{siteId}/`) | Constant |
|---|---|
| `modules/ai_marketing/settings` | `COLLECTION_SETTINGS` |
| `modules/ai_marketing/assets/{assetId}` | `COLLECTION_ASSETS` |
| `modules/ai_marketing/generations/{genId}` | `COLLECTION_GENERATIONS` |
| `modules/ai_marketing/saved_content/{savedId}` | `COLLECTION_SAVED` |
| `modules/ai_marketing/campaigns/{campaignId}` | `COLLECTION_CAMPAIGNS` |

#### `ai_sales`

No dedicated `constants.ts` — module has no Firestore data of its own (configuration lives at site-level / member-level; chat history is ephemeral in the AI conversation).

### Required Composite Indexes

`service-records/constants.ts` documents the required composite indexes. Index changes must be deployed via `firestore.indexes.json`:

- `serviceRecords`: `outletId + status + updatedAt`, `outletId + status + createdAt`, `outletId + updatedAt`
- `vehicles`: `outletId + plateNumber`
- `reminderQueue`: `status + scheduledAt`
- `warrantyCards` (collection-group): `warrantyCode`

Other modules' index requirements are documented per-module (consult each module's `__tests__/` and any `firestore.indexes.json` entries).

### Path Constants Rules

- **Always define paths in `lib/modules/{module}/constants.ts`** (or for modules without a constants file, at the top of `api.ts` as `const X = '...'`).
- **Never hardcode `'sites/...'` strings** in components, hooks, or pages.
- **Module IDs in paths use underscores** (`byod_pos`, `ai_marketing`). Directory names may differ (e.g. `ai-marketing/`) — the path uses the canonical ID.
- **Composite indexes must be in `firestore.indexes.json`** and deployed before the query is enabled in production.
- **Top-level platform paths (`modules/`, `platform/`, `registrationRequests/`, `system/`)** are global, not per-tenant — handle access control accordingly in `firestore.rules`.

---

## 20. API Routes

Full inventory of `app/api/` route handlers as of 2026-05-14. Generated from `find clicker-platform-v2/app/api -type d`. Authentication conventions: admin routes use `requireAuthedMember(req)` from `lib/api-auth.ts` (returns `{ siteId }` from the `__session` cookie). Public routes are unauthenticated. Webhook routes verify a provider-supplied signature.

### Admin — Authenticated

#### AI Credits & Usage

| Endpoint | Purpose | §Ref |
|---|---|---|
| `GET /api/admin/ai-credits` | Balance + recent ledger entries | §10 |
| `GET /api/admin/ai/credits` | Legacy alias | §10 |
| `GET /api/admin/ai-usage` | Daily aggregate for charts | §10 |

#### Cache

| Endpoint | Purpose |
|---|---|
| `POST /api/admin/cache/purge` | Invalidate per-tenant caches (Upstash + in-memory) |

#### Knowledge Base (AI ingestion)

| Endpoint | Purpose |
|---|---|
| `POST /api/admin/knowledge/sync` | Re-crawl tenant's site/links to refresh AI knowledge |
| `GET /api/admin/knowledge/verify` | Verify what AI has indexed (debug) |

#### Module Admin: AI Marketing

| Endpoint | Purpose |
|---|---|
| `POST /api/admin/modules/ai-marketing/generate` | Content generation (LLM) |
| `POST /api/admin/modules/ai-marketing/assets/upload` | Asset upload + analysis |
| `POST /api/admin/modules/ai-marketing/assets/analyze` | Asset analysis (Vision) |
| `GET\|POST /api/admin/modules/ai-marketing/campaigns` | Campaigns CRUD |
| `GET\|PATCH\|DELETE /api/admin/modules/ai-marketing/campaigns/[id]` | Per-campaign ops |
| `GET\|POST /api/admin/modules/ai-marketing/config` | Module config |
| `POST /api/admin/modules/ai-marketing/export` | Export assets/campaigns |
| `GET /api/admin/modules/ai-marketing/saved` | Saved content list |

#### Module Admin: AI Sales Agent

| Endpoint | Purpose |
|---|---|
| `GET\|PUT /api/admin/modules/ai-sales-agent/config` | Module config (system prompt, agent params) |

#### Templates

| Endpoint | Purpose |
|---|---|
| `POST /api/admin/seed-templates` | Seed template data into a tenant |

#### Team Management

| Endpoint | Purpose |
|---|---|
| `POST /api/admin/team/add` | Add a member (sends invite email via Resend) |
| `POST /api/admin/team/remove` | Remove a member |

#### WhatsApp

| Endpoint | Purpose | §Ref |
|---|---|---|
| `POST /api/admin/whatsapp/connect` | Save Meta credentials (encrypts accessToken) | §13 |
| `POST /api/admin/whatsapp/disconnect` | Mark disconnected, clear sensitive fields | §13 |
| `POST /api/admin/whatsapp/send` | Admin-initiated send (`human_triggered: true`) | §13 |
| `POST /api/admin/whatsapp/test` | Sandbox/test send | §13 |

### Public — Unauthenticated

| Endpoint | Purpose | §Ref |
|---|---|---|
| `POST /api/ai-sales-agent/chat` | Public chat with the AI sales agent | §10 |
| `POST /api/public/validate-promo` | Cart-side promo validation | §15 |
| `GET /api/warranty/[warrantyCode]/pdf` | Service Records warranty card PDF (uses `@react-pdf/renderer`) | — |

### Forms & Submissions

| Endpoint | Purpose |
|---|---|
| `POST /api/forms/create` | Create a form definition |
| `POST /api/forms/update` | Update form |
| `POST /api/forms/delete` | Delete form |
| `POST /api/forms/submit` | Submit a form (public — produces a `submissions/{id}`) |
| `POST /api/submissions/update` | Update submission status (admin) |

### Uploads

| Endpoint | Purpose | §Ref |
|---|---|---|
| `POST /api/upload/avatar` | Avatar upload (MIME validation, no resize) | §17 |
| `POST /api/upload/image` | Generic image upload (sharp resize pipeline) | §17 |

### Auth

| Endpoint | Purpose |
|---|---|
| `GET\|POST /api/auth/check-access` | Server-side access verification utility |

### Webhooks

| Endpoint | Purpose | §Ref |
|---|---|---|
| `POST /api/webhook/whatsapp` | Meta WA Cloud API webhook (handshake on GET, events on POST) | §13 |

### Stocklens (Module-Public Routes)

These live at `/api/stocklens/*` (not under `/api/admin/...`) because they're called from the Stocklens scanner UI, which is admin-side but uses its own route shape.

| Endpoint | Purpose |
|---|---|
| `POST /api/stocklens/check-sku` | Verify a scanned SKU exists in vault |
| `POST /api/stocklens/scan` | Vision-based scan + recognize |
| `GET\|POST /api/stocklens/settings` | Stocklens config |
| `POST /api/stocklens/test-key` | Test API key for Stocklens-specific provider |

### Infrastructure

| Endpoint | Purpose |
|---|---|
| `POST /api/analytics/track` | **Not implemented.** Empty directory; reserved for server-side analytics — see §12 |
| `POST /api/log/client-error` | Client-side error logging (forwards to `logger.error`) |
| `GET /api/proxy/lottie` | Proxy for Lottie animations (CORS workaround) |
| `GET /api/debug-firebase` | Debug endpoint for Firebase connectivity (dev-only) |

### Server Component vs Client SDK Rule

Same rule applies across all of `app/api/`:

| Context | Firebase SDK | Import from |
|---|---|---|
| Server Components / API Routes | `firebase-admin` | `@/lib/firebase-admin` |
| Client Components | Firebase client | `@/lib/firebase`, `firebase/firestore` |

Mixing them produces auth and security bugs — `firebase-admin` operates as the service account and bypasses `firestore.rules`. Always use `firebase-admin` from server-side code so reads/writes are explicit and auditable; use the client SDK only in `'use client'` components where rules enforce per-user access.

### API Route Rules

- **Admin endpoints must call `requireAuthedMember(req)`** before any read/write.
- **Public endpoints** (`/api/public/...`, `/api/ai-sales-agent/chat`, `/api/forms/submit`, `/api/warranty/...`) are intentionally unauthenticated — but must validate input (Zod) and rate-limit if abusable.
- **Server-side AI calls go through `lib/ai/`** — never call OpenRouter directly from a route handler.
- **Webhook endpoints must verify provider signatures** before processing (Meta for WA, etc.).
- **`/api/debug-firebase` is dev-only** — guard with `NODE_ENV` or remove before promotion to production.

---

## 21. Admin UI Conventions

Visual primitives and class patterns for admin pages. These conventions evolved by example — there is no central design system component library; consistency comes from copying these snippets.

### Card / Container

```tsx
<div className="bg-white dark:bg-neutral-900 p-6 rounded-2xl border border-gray-200 dark:border-neutral-700 shadow-sm">
    {/* content */}
</div>
```

### Input Field

```tsx
<input className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 focus:border-gray-400 dark:focus:border-neutral-500 outline-none" />
```

### Primary Action Button

```tsx
<button className="bg-brand-dark text-white px-6 py-3 rounded-xl font-bold hover:bg-brand-dark/90 shadow-sm transition-all">
    Save Changes
</button>
```

### Status Badge

```tsx
<div className={`px-3 py-1 rounded-full text-xs font-semibold border ${
    isActive
        ? 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400'
        : 'bg-gray-100 dark:bg-neutral-800 border-gray-200 dark:border-neutral-700 text-gray-400 dark:text-neutral-500'
}`}>
    {isActive ? 'Active' : 'Inactive'}
</div>
```

### Dark Mode Pattern

`useAdminTheme()` (§18) returns `{ isDark, toggle }` and persists to `localStorage` under `'admin_dark_mode'`. The actual styling is handled entirely via Tailwind's `dark:` prefix — the provider doesn't apply a class to `<html>` itself; that's done in the admin layout.

Conventional dark mode pairings (from `components/admin/AdminTopBar.tsx` and others):

| Light token | Dark equivalent |
|---|---|
| `bg-white` | `dark:bg-neutral-900` (cards) or `dark:bg-neutral-800` (inputs) |
| `bg-gray-50` / `bg-gray-100` | `dark:bg-neutral-800` / `dark:bg-neutral-900` |
| `border-gray-200` | `dark:border-neutral-700` |
| `border-gray-100` (subtle dividers) | `dark:border-neutral-700` (same — divider tone) |
| `text-gray-700` (body) | `dark:text-neutral-200` |
| `text-gray-600` | `dark:text-neutral-300` |
| `text-gray-400` (subdued) | `dark:text-neutral-500` |
| `hover:bg-gray-50` | `dark:hover:bg-neutral-800` |
| Brand accent (`text-studio-blue`, `bg-studio-blue/10`) | Keep or use `dark:` muted variant (e.g. `dark:text-studio-blue-muted`) |

**Rule:** any new admin component **must** include `dark:` pairings for its background, border, and text colors. If you can't see your component clearly in both modes, ship it both modes — don't punt to "we'll fix dark mode later."

### Quick Smoke Test

Before merging an admin UI change:

1. Click the dark mode toggle (top-right of admin top bar).
2. Verify every card, input, and button has visible borders and readable text.
3. Look specifically at: empty states, error messages, modals, dropdowns, hover states.

### Anti-Patterns (NEVER use in admin UI)

| Pattern | Why it's banned |
|---|---|
| `border-[2px]` or `border-[3px]` on cards | Admin uses thin 1px borders — heavy borders are public-site styling |
| `border-brand-dark` on admin containers | Brand accent borders are public-site; admin uses neutral grays |
| `shadow-sticker` | Public-site shadow style |
| `hover:-translate-y-1` lift on cards | Admin is dense and functional — no playful hover transforms |
| Dividers with `border-t-2` | Use `border-t border-gray-200 dark:border-neutral-700` (1px) |
| Hardcoded `bg-white` without `dark:` pairing | Breaks dark mode silently |
| Inline hex colors (`text-[#333]`) | Use Tailwind tokens so dark mode pairing exists |

### Typography

Admin typography uses Tailwind defaults — no custom font scale. Common sizes:

| Class | Use |
|---|---|
| `text-xs font-semibold` | Status badges, labels |
| `text-sm` | Body in dense lists/tables |
| `text-base` | Default body |
| `text-lg font-semibold` | Section subheadings |
| `text-xl font-bold` | Page subheadings |
| `text-2xl font-bold` | Page titles |

### Icons

Use `lucide-react` icons throughout. Sizes default to `w-4 h-4` for inline (with text), `w-5 h-5` for buttons, `w-6 h-6` for large UI affordances.

### Admin UI Rules

- **Always include `dark:` pairings.** No exceptions.
- **Don't introduce new shadow utilities.** Stick to `shadow-sm` for cards.
- **Don't introduce new border weights.** 1px borders only on admin surfaces.
- **Use neutral grays, not warm grays.** Admin = `gray-*` / `neutral-*`; public-site templates use their own palette.
- **Test both themes before merging.** A 30-second toggle catches 90% of dark mode regressions.

---

<!-- Sections to be filled in by subsequent tasks -->
