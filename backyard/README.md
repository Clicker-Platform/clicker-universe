# Backyard — Clicker Platform Superadmin Dashboard

**God Mode** internal tool for Clicker staff. Manages all tenants, users, and platform configuration.

> For full development reference, use the `/backyard` Claude Code skill.

---

## Stack

- **Framework:** Next.js App Router (standalone, port `3011`)
- **Auth:** Firebase client SDK — `onAuthStateChanged` (superadmin only)
- **Data:** All writes via Firebase Cloud Functions (`httpsCallable`) — never direct Firestore
- **Styling:** Tailwind CSS v4

## Run Locally

```bash
cd backyard
pnpm install
pnpm dev    # http://localhost:3011
```

## Key Pages

| Route | Description |
|-------|-------------|
| `/` | Login + dashboard overview |
| `/tenants` | Tenant Forge — create, suspend, manage modules, hard delete, update URL |
| `/users` | Identity management — all Firebase Auth users platform-wide |
| `/monitoring` | System health (coming soon) |
| `/settings` | Global config (coming soon) |

## Architecture Rules

- Every page has `'use client'` at the top — no Server Components
- No `useSite()` or `useUser()` imports (platform-only contexts)
- No `firebase-admin` imports (client SDK only)
- All Firestore writes go through Cloud Functions
- Module definitions in `lib/modules/definitions.ts` must stay in **strict parity** with `clicker-platform-v2/lib/modules/definitions.ts`

## Cloud Functions

| Function | Purpose |
|---|---|
| `getTenants` | Fetch all tenants |
| `createTenant` | Create tenant + owner account |
| `suspendTenant` | Toggle tenant active/suspended |
| `updateTenantModules` | Enable/disable modules |
| `hardDeleteTenant` | Permanently delete tenant data + auth accounts |
| `updateTenantSlug` | Change tenant public URL slug |
| `createUser` | Create user + assign role to site |
| `removeUserFromSite` | Remove user from site |
| `seedSiteData` | Reset/seed demo data |
| `getUsers` | Fetch all Firebase Auth users |

## Firebase Deployment

```bash
firebase deploy --only hosting:clicker-backyard-app
```
