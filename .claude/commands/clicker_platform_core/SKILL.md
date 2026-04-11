---
name: clicker_platform_core
description: >
  Work with the core architecture of the Clicker Platform. Use this skill
  whenever adding a new core feature, creating a new module, modifying
  navigation, or dealing with global authentication, contexts, or database rules.
  Trigger on: "add new page", "new module", "core feature", "architecture",
  "auth issue", "site context", "user context", "how does routing work",
  "admin layout", "add a feature", "create a feature", "add a module",
  "create a module", "app/admin", "system design", "platform core",
  or any request touching lib/site-context.tsx, lib/user-context.tsx, or app/admin/.
---

> **Architecture Reference:** Always read [`docs/ARCHITECTURE.md`](../../../clicker-platform-v2/docs/ARCHITECTURE.md) before making any changes.


# /clicker_platform_core — System Architecture & Core Rules

You are working on the **Clicker Platform**, a multi-tenant SaaS application. This document defines the strict architectural boundaries and rules for the system.

This skill is invoked as `/clicker_platform_core [action]` or automatically on architectural queries.

---

## 1. Core vs. Modules: The Golden Boundary

The Clicker Platform is strictly divided into two types of features:

### Core Features (`app/admin/(dashboard)/` and `lib/`)

- Universal features that apply to **every** tenant (e.g., appearance, site settings, CRM, product catalogs, Canvas Studio).
- Built statically into the Next.js `app/` router under `app/admin/(dashboard)/`.
- Core logic lives in `lib/` at the root level (contexts, templates, systemBlocks, etc.).
- `lib/core/` is a minor subdirectory for service catalog and business hours types only — it is **not** the main home for core logic.
- Imports can move freely within core directories.

### Modules (`lib/modules/{module_name}/`)

- Opt-in, add-on features (e.g., POS, Inventory, Reservations, Sales Pipeline).
- Code inside a module **MUST NOT** directly import code from another module.
- If a module needs to interact with another module (e.g., POS deducting Inventory stock), it MUST use `isModuleEnabled()` from `lib/modules/registry.ts` before calling into the other module.

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
- **`lib/modules/components.tsx` and `lib/modules/client-registry.tsx` must NEVER import `firebase-admin`** — they are bundled for the browser.

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
- `loading`: Boolean — true while auth state is resolving.
- `permissions`: `string[]` — raw permissions array for the current user.
- `moduleAccess`: `Record<string, Record<string, string>>` — per-module, per-route access map.
- `hasAccess(moduleId, routeId)`: Returns `true` if the user has `'full'` or `'view'` access.
- `canEdit(moduleId, routeId)`: Returns `true` if the user has `'full'` access only.
- `getAccessLevel(moduleId, routeId)`: Returns `'full' | 'view' | 'none'` — use this for fine-grained UI control (e.g., showing read-only state vs. hiding entirely).

> **Alias:** `byod_pos` and `pos` are treated as aliases in `user-context.tsx` for backward compatibility.

### `useAdminTheme()` (`@/lib/use-admin-theme.tsx`)

Controls the admin dashboard light/dark mode. Used in `AdminSidebar` and the admin layout.

- `isDark`: Boolean — current theme state.
- `toggle()`: Switches between light and dark mode.

Always wrap new admin pages in the existing `AdminThemeProvider` (already done at the layout level — no action needed per page).

---

## 4. Module Registration Checklist

To create or register a new Module, you MUST touch **all** of the following files:

1. **Definitions — Platform:** `lib/modules/definitions.ts`
   - Add to `STATIC_MODULE_DEFINITIONS` with `adminRoutes` array.
   - Each route needs: `label`, `path`, `icon`, `componentKey` (format: `module_id:ComponentName`).

2. **Definitions — Backyard:** `backyard/lib/modules/definitions.ts`
   - Mirror the same routes. Also add `displayName` and `description` (required by Backyard UI).

3. **Components Registry:** `lib/modules/components.tsx`
   - Add a `dynamic(() => import(...))` const at the top for each admin component.
   - Add to `MODULE_COMPONENTS` object: `'module_id:ComponentName': ComponentName`.
   - If the component uses hooks without server features, also add to `CLIENT_MODULE_COMPONENTS` in `lib/modules/client-registry.tsx`.

4. **Runtime Registry:** `lib/modules/registry.ts`
   - No code changes needed here — this file provides `findModuleForAdminRoute()`, `isModuleEnabled()`, and `subscribeToEnabledModules()` dynamically from Firestore. Just be aware it exists and is the source of truth for what modules are active per tenant.

5. **Seed Script:** `scripts/seed-modules.ts`
   - Add the module to the `MODULES` array so it can be enabled in Firestore.

---

## 5. Database Path Rules

All tenant-specific data must be stored under the tenant's exact `siteId`.

### Core Data Path

`sites/{siteId}/{collection_name}`

### Module Data Path

`sites/{siteId}/modules/{module_name}/{collection_name}`

> **Always define paths as constants in `lib/modules/{module_id}/constants.ts`. Never hardcode strings inline.**

### Exception: `sales_pipeline` leads

The `sales_pipeline` module stores lead documents at `sites/{siteId}/leads/{leadId}` (root-level on the site, not under `modules/`). Pipeline config is stored at `sites/{siteId}/modules/sales_pipeline/settings/config`. This is intentional — leads are a CRM primitive, not module-scoped data.

---

## 6. Admin UI Style Conventions

The admin dashboard uses a **neutral productivity-dashboard aesthetic** — clean, minimal, similar to Figma or Linear. It supports **both light and dark mode** via CSS variables and `dark:` Tailwind variants.

### Card / Container pattern

```tsx
<div className="bg-white dark:bg-neutral-900 p-6 rounded-2xl border border-gray-200 dark:border-neutral-800 shadow-sm">
```

### Input fields

```tsx
<input className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-gray-400 outline-none" />
```

### Action buttons (primary)

```tsx
<button className="bg-brand-dark text-white px-6 py-3 rounded-xl font-bold hover:bg-brand-dark/90 shadow-sm transition-all">
```

### Status/badge pattern

```tsx
<div className={`px-3 py-1 rounded-full text-xs font-semibold border ${
  isActive ? 'bg-green-50 border-green-200 text-green-700'
           : 'bg-gray-100 dark:bg-neutral-800 border-gray-200 dark:border-neutral-700 text-gray-400'
}`}>
```

### Rules

- **Never use** `border-[3px]`, `border-[2px]`, `border-brand-dark` on admin containers or cards
- **Never use** `shadow-sticker` or offset box-shadows in admin UI
- **Never use** `hover:-translate-y-1` lift effects on admin cards
- Border: always `border border-gray-200` (1px), dark: `dark:border-neutral-800`
- Shadow: always `shadow-sm` at rest, `shadow-md` on hover (for interactive cards)
- Focus: always `focus:border-gray-400` on inputs
- Dividers: `border-t border-gray-100 dark:border-neutral-800` (not `border-t-2`)
- Dark text: `text-gray-900 dark:text-neutral-200` for headings, `text-gray-500 dark:text-neutral-500` for secondary
- Note: `shadow-sticker` and `border-brand-dark` ARE used on the **public tenant site** (via templates). This rule applies to admin UI only.

---

## 7. Security Rules

Before executing **any write operation** inside a client component dashboard screen, always check RBAC:

```typescript
import { useUser } from '@/lib/user-context';

export default function MyScreen() {
    const { canEdit, getAccessLevel } = useUser();

    const handleSave = async () => {
        if (!canEdit('my_module', 'my_route')) {
            alert('View-only access');
            return;
        }
        // ... execute save
    };

    // For granular UI control (e.g., show read-only vs. hide):
    const access = getAccessLevel('my_module', 'my_route'); // 'full' | 'view' | 'none'
}
```
