# AGENTS.md — Clicker Universe Monorepo

Universal agent instructions for all AI tools (Claude, Gemini, Cursor, Copilot, etc.) working in this repository.

---

## Project Overview

**Clicker Universe** is a multi-tenant SaaS platform monorepo. Each tenant (business) gets a public biolink/website and an admin dashboard with optional add-on modules.

**Monorepo Structure:**
```
clicker-universe/main/
├── clicker-platform-v2/    ← Main Next.js platform (primary codebase)
├── auth-gateway/           ← Centralized authentication service
├── backyard/               ← Super-admin dashboard (Clicker staff only)
├── clicker-website/        ← Marketing website
├── functions/              ← Firebase Cloud Functions
└── scripts/                ← Deployment & utility scripts
```

---

## Build & Run

```bash
# Main platform
cd clicker-platform-v2
pnpm install
pnpm dev          # port 3000
pnpm build        # production build
pnpm lint         # ESLint
pnpm test         # Vitest

# Auth gateway
cd auth-gateway
pnpm dev          # port 3012
```

---

## Architecture Rules (MUST follow)

### 1. Core vs. Module Boundary
- **Core** (`app/admin/`, `lib/core/`): Universal features for every tenant.
- **Modules** (`lib/modules/{module_name}/`): Opt-in add-ons. A module MUST NOT import directly from another module.
- Inter-module interaction requires a dynamic check that the target module is enabled.

### 2. Server vs. Client Code
- Server components / API routes → use `firebase-admin`, import from `@/lib/firebase-admin`.
- Client components (`'use client'`) → use Firebase client SDK, import from `@/lib/firebase`.
- Never import `firebase-admin` in a client component — it will crash.

### 3. Multi-Tenancy
- All tenant data lives under `sites/{siteId}/...`
- Always use `siteId` from `useSite()` context. Never hardcode tenant identifiers.
- Module data path: `sites/{siteId}/modules/{module_name}/{collection}`

### 4. RBAC (Security)
- Before any write operation in a client component, check:
  ```ts
  const { canEdit } = useUser();
  if (!canEdit('module_name', 'route_id')) return;
  ```

### 5. Database Paths
- Define all Firestore paths in a `constants.ts` file inside the module. Never hardcode strings.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js App Router (v16+), React 19 |
| Language | TypeScript (strict mode) |
| Backend | Firebase (Firestore, Auth, Storage) |
| Styling | Tailwind CSS v4 |
| Testing | Vitest + jsdom |
| Package Manager | pnpm |
| Drag & Drop | @dnd-kit |
| Rich Text | Tiptap v3 |

---

## Style Conventions

- Admin UI uses neutral productivity-dashboard aesthetic (Figma/Linear style).
- Cards: `bg-white p-6 rounded-lg border border-gray-200`
- Primary button: `bg-brand-dark text-white px-6 py-3 rounded-lg font-bold`
- Never use `border-[2px]`, `border-[3px]`, `shadow-sticker`, or `hover:-translate-y-1` in admin UI.
- Never use `shadow-*` properties or heavy corner radiuses in admin components to maintain a flat aesthetic.
- Dividers: `border-t border-gray-100` (never `border-t-2`)

---

## What NOT to Do

- Do not add features beyond what is asked.
- Do not introduce new frameworks or libraries without discussion.
- Do not commit `.env` files or service account keys.
- Do not mock Firebase in tests — use real Firestore emulator or integration approach.
- Do not bypass TypeScript strict mode.
- Do not create files in `dev/` worktree from `main/` context (separate branches).

---

## Key Files

| File | Purpose |
|------|---------|
| `clicker-platform-v2/lib/modules/definitions.ts` | Module registry |
| `clicker-platform-v2/lib/modules/components.tsx` | Dynamic component map |
| `clicker-platform-v2/lib/site-context.tsx` | `useSite()` + `setSiteId()` — tenant context |
| `clicker-platform-v2/lib/user-context.tsx` | `useUser()` — auth + RBAC |
| `clicker-platform-v2/middleware.ts` | Tenant routing + auth gate |
| `clicker-platform-v2/components/admin/TokenBootstrap.tsx` | Process handoff token from gateway |
| `auth-gateway/app/page.tsx` | Login form + performHandoff |
| `auth-gateway/app/api/token/route.ts` | Create custom token (Firebase Admin) |
| `auth-gateway/lib/get-user-sites.ts` | Resolve tenant from Firestore |
| `auth-gateway/lib/firebase-admin.ts` | Firebase Admin SDK init |
| `scripts/seed-modules.ts` | DB seeding for modules |

---

## Auth Flow (Opsi B+ Silent Handoff)

```
1. User → auth-gateway:3012 (login form)
2. Gateway: signInWithEmailAndPassword
            → getUserSites ∥ /api/token (parallel Firestore + Admin SDK)
            → set __session cookie (gateway origin)
            → redirect platform/admin#token=xxx&siteId=yyy
3. Platform: TokenBootstrap reads hash
             → set __session cookie (platform origin) + setSiteId()
             → signInWithCustomToken (background, Firebase client SDK)
             → UserProvider loads member/role from Firestore
             → AdminGuard renders dashboard
```

**Rules:**
- Gateway hanya auth — tidak ada bisnis logic
- `/api/token` route (gateway) menggantikan `generateHandoffToken` Cloud Function — jangan pakai CF lagi
- `app/admin/auth/callback/` sudah dihapus — tidak ada callback page
- Middleware skip `__session` gate saat `isLocal` (localhost) — TokenBootstrap set cookie client-side

---

## New Module Checklist (3-Way Parity Rule)

When adding a new module, touch ALL of these — missing any one causes routing, permission, or seed failures:

1. `lib/modules/definitions.ts` — add definition + adminRoutes (platform source of truth)
2. `backyard/lib/modules/definitions.ts` — **must match platform exactly** (same paths, same componentKeys) + add `displayName` and `description` for Backyard UI
3. `lib/modules/components.tsx` — add `dynamic(() => import(...))` for every admin screen
4. `scripts/seed-modules.ts` — add to seed array (routes must match definitions.ts exactly)
5. Create `lib/modules/{name}/constants.ts` for all DB paths

> **Parity Rule:** After any route change in `definitions.ts`, always update `backyard/lib/modules/definitions.ts` AND `scripts/seed-modules.ts` to match. All three must be identical in paths and componentKeys at all times.

### Backyard (Super-Admin Dashboard)

- **Location:** `backyard/` — standalone Next.js app, port `3011`
- Every page is `'use client'` — no Server Components
- No `useSite()` / `useUser()` — superadmin sees all tenants
- **Destructive ops** (createTenant, suspendTenant, hardDeleteTenant, seedSiteData) use `httpsCallable(functions, 'functionName')` — Cloud Functions as authority layer
- **Read & management ops** (access control, monitoring, sync, WA manager) use Firebase client SDK directly against Firestore
- Key Cloud Functions: `getTenants`, `createTenant`, `suspendTenant`, `hardDeleteTenant`, `seedSiteData`
- Key pages: Overview, Tenants, Access Control (Users + Roles), Monitoring (Health + Logs), Seed Tools, Sync Control, WhatsApp Manager
