# Architecture — Clicker Universe

> High-level architecture for agents and contributors. For deep-dive, see [`clicker-platform-v2/Docs/ARCHITECTURE.md`](clicker-platform-v2/Docs/ARCHITECTURE.md).

---

## System Overview

Clicker Universe is a **multi-tenant SaaS platform**. Each tenant (business) gets:
- A public biolink/website at `/{tenantSlug}` or `{tenantSlug}.clicker.id`
- An admin dashboard at `/admin` (subdomain-enforced in production)
- Optional add-on **modules** toggled per tenant

---

## Monorepo Layout

```
main/
├── clicker-platform-v2/     ← Next.js App Router platform (primary)
│   ├── app/                 ← Routes (admin + public tenant pages)
│   ├── lib/
│   │   ├── core/            ← Universal features (all tenants)
│   │   └── modules/         ← Opt-in add-ons
│   ├── components/          ← Shared UI components
│   ├── hooks/               ← Custom React hooks
│   └── scripts/             ← DB seeding + utilities
├── auth-gateway/            ← Centralized auth (login/register)
├── backyard/                ← Super-admin dashboard (internal)
├── clicker-website/         ← Marketing site
├── functions/               ← Firebase Cloud Functions
└── scripts/                 ← Monorepo-level scripts
```

---

## Multi-Tenancy

```
Request → middleware.ts
  ├── Subdomain? → resolve siteId from subdomain
  └── Path? → resolve siteId from slug
       ↓
  Firestore: sites/{siteId}/...
```

All tenant data is scoped under `sites/{siteId}`. The `useSite()` context provides `siteId` to all client components.

---

## Core vs. Module Boundary

```
Core (lib/core/)              Modules (lib/modules/)
─────────────────             ──────────────────────
Always enabled                Toggled per tenant in DB
Free imports within           NO cross-module imports
app/admin/ routes             Registered in definitions.ts
```

**Module data path:** `sites/{siteId}/modules/{module_name}/{collection}`

---

## Request Flow

```
Browser
  ↓
Next.js middleware (tenant resolution)
  ↓
Server Component (firebase-admin, no client SDK)
  ↓ props
Client Component ('use client', Firebase client SDK)
  ↓
Firestore / Storage / Auth
```

---

## Authentication & RBAC

- Firebase Auth manages sessions.
- Roles: `owner | editor | viewer | staff`
- `useUser()` provides `role`, `hasAccess(moduleId, routeId)`, `canEdit(moduleId, routeId)`
- All write operations in client components must call `canEdit()` first.

---

## Module Registration

Every new module requires changes to:
1. `lib/modules/definitions.ts`
2. `lib/modules/components.tsx`
3. `scripts/seed-modules.ts`
4. `backyard/lib/modules/definitions.ts`

---

## Key Technologies

| Concern | Technology |
|---------|-----------|
| Framework | Next.js App Router + React 19 |
| Database | Firebase Firestore (NoSQL) |
| Auth | Firebase Authentication |
| Storage | Firebase Storage |
| Styling | Tailwind CSS v4 |
| Testing | Vitest + jsdom |
| Deployment | Firebase Hosting + Functions |
| Package manager | pnpm (workspace) |
