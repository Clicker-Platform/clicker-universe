---
name: clicker_platform_core
description: >
  Work with the core architecture of the Clicker Platform. Use this skill
  whenever adding a new core feature, creating a new module, modifying
  navigation, or dealing with global authentication, contexts, or database rules.
  Trigger on: "add new page", "new module", "core feature", "architecture",
  "auth issue", "site context", "user context", "how does routing work",
  "admin layout", "add a feature", "create a feature", "add a module",
  "create a module", "app/admin", "lib/core", "system design", "platform core",
  or any request touching lib/core/, lib/site-context.tsx, or app/admin/.
---

> **Architecture Reference:** Always read [`docs/ARCHITECTURE.md`](../../../clicker-platform-v2/docs/ARCHITECTURE.md) before making any changes.
>
> **CLAUDE.md Rule 9 (mandatory):** Before writing **any** file in `lib/modules/<id>/admin/` (or scaffolding a new module), open an existing module's equivalent file and match its conventions — layout, page wrapper, buttons, colors, forms, tables, dark mode, top-bar reliance.
> Canonical references: `lib/modules/promo/components/PromoListPage.tsx`, `lib/modules/promo/admin/SettingsPage.tsx`, `lib/modules/byod_pos/admin/`. The platform's working code is the source of truth — never infer styling from spec snippets.


# /clicker_platform_core — System Architecture & Core Rules

You are working on the **Clicker Platform**, a multi-tenant SaaS application. This document defines the strict architectural boundaries and rules for the system.

This skill is invoked as `/clicker_platform_core [action]` or automatically on architectural queries.

---

## 1. Core vs. Modules: The Golden Boundary

The Clicker Platform is strictly divided into two types of features:

### Core Features (`app/admin/` and `lib/core/`)

- Universal features that apply to **every** tenant (e.g., appearance, site settings, basic CRM, product catalogs).
- Built statically into the Next.js `app/` router.
- Imports can move freely within core directories.

### Modules (`lib/modules/{module_name}/`)

- Opt-in, add-on features (e.g., POS, Inventory, Reservations).
- Code inside a module **MUST NOT** directly import code from another module.
- If a module needs to interact with another module (e.g., POS deducting Inventory stock), it MUST dynamically check if the target module is enabled first.

---

## 2. Server vs. Client Code

Next.js App Router rules are strictly enforced to prevent hydration errors and security leaks.

### Server Components & API Routes

- Can use `firebase-admin`.
- Import from `@/lib/firebase-admin`.
- Example files: `api-admin.ts`, `api-server.ts`, `page.tsx` (without `'use client'`).

### Client Components (`'use client'`)

- Cannot use `firebase-admin` (will crash the browser).
- Must use standard Firebase client SDK.
- Import from `@/lib/firebase` and `firebase/firestore`.
- Example files: `api.ts`, interactive UI components (`*Client.tsx`).

---

## 3. Global Contexts & State

Never manually fetch the current tenant or user session if a context already provides it.

### `useSite()` (`@/lib/site-context.tsx`)

Provides the current tenant's resolution.

- `siteId`: The canonical ID of the current tenant. **Always use this instead of hardcoding.**
- `tenantSlug`: The readable URL slug.
- `isSubdomain`: Boolean.
- `isPending`: True if the siteId is still resolving or is `'default'`.

### `useUser()` (`@/lib/user-context.tsx`)

Provides the authenticated user's session and Role-Based Access Control (RBAC).

- `user`: The Firebase Auth user object.
- `role`: `'owner' | 'editor' | 'viewer' | 'staff'`.
- `isOwner`: Boolean shortcut.
- `hasAccess(moduleId, routeId)`: Checks if the user can view a specific module screen.
- `canEdit(moduleId, routeId)`: Checks if the user has write permissions (`'full'`) for a module screen.

---

## 4. Module Registration Checklist

To create or register a new Module, you MUST touch **all four** of these files. Missing any one will cause routing, permission, or seed failures:

1. **Platform Definitions:** `lib/modules/definitions.ts`
    - Add the module with `adminRoutes` (paths, labels, icons, componentKeys, permissions).
    - Route paths must be consistent with `MODULE_COMPONENTS` keys.

2. **Backyard Definitions:** `backyard/lib/modules/definitions.ts`
    - Must be **kept in strict parity** with the platform definitions (same paths, same componentKeys, same permissions).
    - Additionally requires `displayName` and `description` fields (used by Backyard UI).
    - The `SYSTEM_MODULES` export helper at the bottom of this file is Backyard-only — do not add it to platform.

3. **Components Registry:** `lib/modules/components.tsx`
    - Create a `dynamic(() => import(...))` mapping for every admin screen.
    - Add to the `MODULE_COMPONENTS` object using the format `module_name:ComponentName`.
    - Every `componentKey` in definitions.ts MUST have a matching entry here.

4. **Seed Script:** `scripts/seed-modules.ts`
    - Add the module to the `MODULES` array so it can be seeded to Firestore and enabled in the DB.
    - Routes in this file must also match definitions.ts exactly — they are what gets written to production Firestore.

> **Parity Rule:** After any route change in `definitions.ts`, always update `backyard/lib/modules/definitions.ts` and `scripts/seed-modules.ts` to match. All three must be identical in paths and componentKeys at all times.

---

## 5. Database Path Rules

All tenant-specific data must be stored under the tenant's exact `siteId`.

### Core Data Path

`sites/{siteId}/{collection_name}`

### Module Data Path

`sites/{siteId}/modules/{module_name}/{collection_name}`
*(Always define these paths in a `constants.ts` file inside the module. Do not hardcode strings.)*

---

## 6. Admin UI Style Conventions

The admin dashboard uses a **neutral productivity-dashboard aesthetic** — clean, minimal, similar to Figma or Linear. Do not introduce brutalist styles.

### Card / Container pattern

```tsx
<div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
```

### Input fields

```tsx
<input className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-gray-400 outline-none" />
```

### Action buttons (primary)

```tsx
<button className="bg-brand-dark text-white px-6 py-3 rounded-xl font-bold hover:bg-brand-dark/90 shadow-sm transition-all">
```

### Status/badge pattern

```tsx
<div className={`px-3 py-1 rounded-full text-xs font-semibold border ${
  isActive ? 'bg-green-50 border-green-200 text-green-700'
           : 'bg-gray-100 border-gray-200 text-gray-400'
}`}>
```

### Rules

- **Never use** `border-[3px]`, `border-[2px]`, `border-brand-dark` on admin containers or cards
- **Never use** `shadow-sticker` or offset box-shadows in admin UI
- **Never use** `hover:-translate-y-1` lift effects on admin cards
- Border: always `border border-gray-200` (1px)
- Shadow: always `shadow-sm` at rest, `shadow-md` on hover (for interactive cards)
- Focus: always `focus:border-gray-400` on inputs
- Dividers: `border-t border-gray-100` (not `border-t-2`)
- Note: `shadow-sticker` and `border-brand-dark` ARE used on the **public tenant site** (via templates). This rule applies to admin UI only.

---

## 7. Security Rules

Before executing **any write operation** inside a client component dashboard screen, always check RBAC:

```typescript
import { useUser } from '@/lib/user-context';

export default function MyScreen() {
    const { canEdit } = useUser();
    
    const handleSave = async () => {
        if (!canEdit('my_module', 'my_route')) {
            alert('View-only access');
            return;
        }
        // ... execute save
    };
}
```
