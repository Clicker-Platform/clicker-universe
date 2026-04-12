---
name: module
description: >
  Scaffold, audit, and manage Clicker Platform modules. Use this skill whenever
  working with the module system, even if the user doesn't say "module" explicitly —
  adding a new feature area, wiring up a new admin page, checking why a route isn't
  appearing in the sidebar, or reviewing what's registered all qualify.
  Trigger on: "create module", "add module", "new feature module", "add a route", "add an
  admin page", "module not showing", "audit module", "module status", "register component",
  or any request touching lib/modules/, definitions.ts, components.tsx, client-registry.tsx,
  or the module registry.
---

> **Architecture Reference:** Always read [`docs/ARCHITECTURE.md`](../../../clicker-platform-v2/docs/ARCHITECTURE.md) before making any changes.


# /module — Clicker Platform Module Workflow Skill

You are helping work with the Clicker Platform module system.

This skill is invoked as `/module [action] [moduleId]`

---

## Actions

| Action | Usage | Purpose |
|--------|-------|---------|
| `create` | `/module create {moduleId}` | Scaffold a new module end-to-end |
| `audit` | `/module audit {moduleId}` | Check all registration points for completeness |
| `add-route` | `/module add-route {moduleId}` | Add a new admin route to an existing module |
| `status` | `/module status` | Cross-reference all registered modules |

---

## Action: `create`

### Step 0 — Confirm Spec First

Before writing any code, collect from the user:

1. **Module ID** — snake_case (e.g. `events`)
2. **Display name** — human label (e.g. `Events`)
3. **Description** — one sentence
4. **Icon** — choose from: `dashboard`, `calendar`, `box`, `user`, `users`, `settings`, `credit-card`, `file-text`, `shopping-bag`, `clipboard-list`, `monitor-dot`, `trophy`, `bot`, `qr-code`, `list`, `bar-chart-3`, `car`, `wrench`, `bell`, `plus`, `utensils`
5. **Admin routes** — for each: label, full path (e.g. `/admin/events/list`), component name
6. **Public routes?** — path + component name if yes
7. **Page builder blocks?** — block type + component name if yes
8. **Dashboard widgets?** — location + component name if yes
9. **Depends on other modules?** — e.g. `['inventory']`
10. **Firestore collections this module owns?**

### Step 1 — Create Module Files

**`dev/clicker-platform-v2/lib/modules/{moduleId}/types.ts`**
- Define all TypeScript interfaces for module data models
- Reference pattern: `lib/modules/membership/types.ts` or `lib/modules/reservation/types.ts`

**`dev/clicker-platform-v2/lib/modules/{moduleId}/constants.ts`**

- Define all Firestore collection path strings here as named constants
- Never hardcode path strings inline in components or api files

```typescript
export const MODULE_ID = '{moduleId}';
export const ITEMS_COLLECTION = 'modules/{moduleId}/items';
export const SETTINGS_DOC = 'modules/{moduleId}/settings/config';
```

**`dev/clicker-platform-v2/lib/modules/{moduleId}/api.ts`**
- Client-side Firestore operations using Firebase Client SDK only
- Import path constants from `./constants` — do not redeclare them here
- Import from `firebase/firestore` and `@/lib/firebase`
- Do not import `firebase-admin` — this file runs on the client
- Reference pattern: `lib/modules/byod_pos/api.ts`

**`dev/clicker-platform-v2/lib/modules/{moduleId}/admin/{Name}Page.tsx`**

- Add `'use client'` at top — required because these pages use hooks
- Import `useSite` from `@/lib/site-context` for siteId
- Import `usePermission` from `@/lib/hooks/use-permission` for edit/view checks (see RBAC section below)
- Reference pattern: `lib/modules/membership/admin/MemberListPage.tsx`

### Step 2 — Register Routes (TWO FILES, both required)

**File A:** `dev/clicker-platform-v2/lib/modules/definitions.ts`

Add to `STATIC_MODULE_DEFINITIONS`:
```typescript
'{moduleId}': {
    adminRoutes: [
        {
            label: '{Label}',
            path: '/admin/{prefix}/{routeId}',
            icon: '{iconKey}',
            componentKey: '{moduleId}:{ComponentName}'
        },
        // Settings route pattern:
        {
            label: 'Settings',
            path: '/admin/{prefix}/settings',
            icon: 'settings',
            permission: 'settings',
            componentKey: '{moduleId}:Settings'
        }
    ]
},
```

**File B:** `dev/backyard/lib/modules/definitions.ts`

Add the SAME routes entry. Backyard also needs `displayName` and `description`:
```typescript
'{moduleId}': {
    displayName: '{Display Name}',
    description: '{Description}',
    adminRoutes: [ /* identical to File A */ ]
},
```

### Step 3 — Register Components

**`dev/clicker-platform-v2/lib/modules/components.tsx`**

Add dynamic import near top of file:
```typescript
const {ComponentName} = dynamic(() => import('@/lib/modules/{moduleId}/admin/{ComponentName}'));
```

Add to `MODULE_COMPONENTS` object:
```typescript
'{moduleId}:{ComponentName}': {ComponentName},
```

**`dev/clicker-platform-v2/lib/modules/client-registry.tsx`** — only for dashboard widgets and page builder block components that must run in a pure client context (e.g., inside `MemberDashboard`). Admin route components do NOT need to be registered here — only in `MODULE_COMPONENTS`.

```typescript
// client-registry.tsx — only if registering a widget or block component
'{moduleId}:{WidgetName}': {WidgetName},
```

### Step 4 — Seed Firestore

**`dev/clicker-platform-v2/scripts/seed-modules.ts`**

Add to the `MODULES` array:
```typescript
{
    id: '{moduleId}',
    displayName: '{Display Name}',
    description: '{Description}',
    icon: '{iconKey}',
    version: '1.0.0',
    enabled: true,
    adminRoutes: [ /* same as STATIC_MODULE_DEFINITIONS */ ],
    publicRoutes: [],
    requires: [],
    blocks: [],
    settings: {}
},
```

**`dev/functions/src/admin/modules/seeding.ts`** (if sample data needed)

```typescript
export async function seed{ModuleId}Data(db: admin.firestore.Firestore, siteId: string) {
    console.log(`[Seeding] {ModuleId} for ${siteId}`);
    const batch = db.batch();
    // add sample records to batch...
    await batch.commit();
}
```

---

## Action: `audit`

Read the following files and check each point for `{moduleId}`:

**Checklist (report pass/fail with file path for each):**

1. Directory `lib/modules/{moduleId}/` exists with at least `types.ts`, `constants.ts`, `api.ts`, `admin/`
2. Entry exists in `lib/modules/definitions.ts` → `STATIC_MODULE_DEFINITIONS`
3. Entry exists in `dev/backyard/lib/modules/definitions.ts` (parity check)
4. Every `componentKey` in adminRoutes has a matching key in `MODULE_COMPONENTS` (`lib/modules/components.tsx`)
5. Every registered component has a `dynamic(() => import(...))` at the top of `components.tsx`
6. Module entry exists in `scripts/seed-modules.ts` MODULES array
7. All route `path` values match their full URL — the catch-all resolves by full path lookup, and permission checks use the last segment. Both single-segment (`/admin/pos/cashier`) and multi-segment (`/admin/service-records/records`) paths are valid.
8. No `firebase-admin` imports in `components.tsx` or `client-registry.tsx`
9. All admin components have `'use client'` directive
10. All Firestore path strings are defined in `constants.ts` — not hardcoded inline

---

## Action: `add-route`

To add a new admin route to an existing module `{moduleId}`:

1. Create component: `lib/modules/{moduleId}/admin/{NewComponent}.tsx` (must be `'use client'`)
2. Add dynamic import in `lib/modules/components.tsx`
3. Add to `MODULE_COMPONENTS`: `'{moduleId}:{NewComponent}': {NewComponent}`
4. Add route to `STATIC_MODULE_DEFINITIONS['{moduleId}'].adminRoutes` in `lib/modules/definitions.ts`
5. Mirror route in `dev/backyard/lib/modules/definitions.ts`

---

## Action: `status`

Read these files and produce a cross-reference table:
- `lib/modules/definitions.ts` — all moduleIds and their routes + componentKeys
- `lib/modules/components.tsx` — all keys in MODULE_COMPONENTS

Output format:
```
Module: {moduleId}
  Route: {path} → componentKey: {key} → Registered: ✓/✗
  ...
Unregistered components (in MODULE_COMPONENTS but no route): ...
Missing components (routes with no MODULE_COMPONENTS entry): ...
```

---

## Critical File Paths

```
PLATFORM (dev/clicker-platform-v2/):
  lib/modules/types.ts                              ← ModuleDefinition type interfaces
  lib/modules/definitions.ts                        ← STATIC_MODULE_DEFINITIONS
  lib/modules/registry.ts                           ← runtime Firestore lookup (findModuleForAdminRoute, isModuleEnabled)
  lib/modules/components.tsx                        ← MODULE_COMPONENTS (all admin + public components)
  lib/modules/client-registry.tsx                   ← CLIENT_MODULE_COMPONENTS (widgets + blocks only)
  scripts/seed-modules.ts                           ← Firestore seed
  app/admin/(dashboard)/[...slug]/page.tsx          ← catch-all route (full path lookup → component render)
  app/admin/(dashboard)/AdminSidebar.tsx            ← sidebar nav (merges Firestore + STATIC_MODULE_DEFINITIONS)
  components/modules/ModuleLoader.tsx               ← component resolver
  components/admin/PermissionGuard.tsx              ← PermissionContext + usePermission() context hook
  lib/hooks/use-permission.ts                       ← usePermission(moduleId, routeId) standalone hook
  lib/user-context.tsx                              ← moduleAccess state, canEdit(), getAccessLevel()
  lib/site-context.tsx                              ← useSite() / siteId

BACKYARD (dev/backyard/):
  lib/modules/definitions.ts                        ← must mirror platform

FUNCTIONS (dev/functions/):
  src/admin/tenant.ts                               ← createTenant / updateTenantModules
  src/admin/modules/seeding.ts                      ← sample data seeding
```

---

## RBAC in Admin Components

Two mechanisms exist — use the right one for context:

**`usePermission(moduleId, routeId)` from `@/lib/hooks/use-permission`** — use this in standalone module admin pages:

```typescript
import { usePermission } from '@/lib/hooks/use-permission';

const { canEdit, canView, checkAccess } = usePermission('my_module', 'my_route');
```

**`useUser()` from `@/lib/user-context`** — use this when you need both auth state and access checks together, or need `getAccessLevel()` for fine-grained UI control:

```typescript
import { useUser } from '@/lib/user-context';

const { canEdit, getAccessLevel } = useUser();
const access = getAccessLevel('my_module', 'my_route'); // 'full' | 'view' | 'none'
```

> Note: `components/admin/PermissionGuard.tsx` also exports a `usePermission` — that is a React context hook for the `PermissionContext`, not the same as `lib/hooks/use-permission`. Do not confuse them.

---

## Architecture Rules

- **`componentKey` format is `{moduleId}:{ComponentName}` — exact match required.** The key in `adminRoutes` and the key in `MODULE_COMPONENTS` must be identical strings. A mismatch causes a silent "component not found" render — no error thrown.
- **Route `path` is the full URL path.** `findModuleForAdminRoute()` in `registry.ts` matches the complete path (e.g. `/admin/sales-pipeline/board`). Permission checks then use the last segment only (`board`). Both single-segment and multi-segment paths work correctly.
- **Admin page components need `'use client'` at top.** These components use hooks (`useSite`, `usePermission`, etc.) — without the directive they'll fail with a server component error.
- **Never import `firebase-admin` in `components.tsx` or `client-registry.tsx`.** These files are bundled for the browser. `firebase-admin` is Node.js-only and will break the client build.
- **Both `definitions.ts` files must be updated together.** Platform (`lib/modules/definitions.ts`) and Backyard (`dev/backyard/lib/modules/definitions.ts`) are separate apps that share the same route definitions. Updating only one causes the other to fall out of sync silently.
- **Per-site module flag controls sidebar visibility.** `sites/{siteId}.modules[moduleId]: true` must be set for the module to appear — the global `enabled` flag in seed data only controls whether the module is available to assign, not whether it shows for a given site.
- **All Firestore paths must live in `constants.ts`.** Never hardcode path strings in components or api files. Import from the module's own `constants.ts`.
