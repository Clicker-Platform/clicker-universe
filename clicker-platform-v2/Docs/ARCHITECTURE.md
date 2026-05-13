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

<!-- Sections to be filled in by subsequent tasks -->
