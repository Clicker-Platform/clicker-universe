---
name: module
description: >
  Scaffold, audit, and manage Clicker Platform modules. Use this skill whenever
  working with the module system: creating a new module, adding routes to an existing
  module, auditing module registration, or checking module status.
  Trigger on: "create module", "add module", "audit module", "add route to", "module status",
  or any request touching lib/modules/, definitions.ts, components.tsx, or the module registry.
---

# /module — Clicker Platform Module Workflow Skill

You are helping work with the Clicker Platform module system.

**Full architecture reference:** `memory/modularity.md`

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
4. **Icon** — choose from: `dashboard`, `calendar`, `box`, `user`, `users`, `settings`, `credit-card`, `file-text`, `shopping-bag`, `clipboard-list`, `monitor-dot`, `trophy`, `bot`, `qr-code`, `list`
5. **Admin routes** — for each: label, path suffix (e.g. `/admin/events/list`), component name
6. **Public routes?** — path + component name if yes
7. **Page builder blocks?** — block type + component name if yes
8. **Dashboard widgets?** — location + component name if yes
9. **Depends on other modules?** — e.g. `['inventory']`
10. **Firestore collections this module owns?**

### Step 1 — Create Module Files

**`dev/clicker-platform-v2/lib/modules/{moduleId}/types.ts`**
- Define all TypeScript interfaces for module data models
- Reference pattern: `lib/modules/membership/types.ts` or `lib/modules/reservation/types.ts`

**`dev/clicker-platform-v2/lib/modules/{moduleId}/api.ts`**
- Client-side Firestore operations using Firebase Client SDK only
- Export collection path constants at top: `export const ITEMS_COLLECTION = 'modules/{moduleId}/items';`
- Import from `firebase/firestore` and `@/lib/firebase`
- NEVER import `firebase-admin`
- Reference pattern: `lib/modules/membership/api.ts`

**`dev/clicker-platform-v2/lib/modules/{moduleId}/admin/{Name}Page.tsx`**
- MUST have `'use client'` at top
- Import `useSite` from `@/lib/site-context` for siteId
- Import `usePermission` from `@/lib/hooks/use-permission` for edit/view checks
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

If component uses React hooks without server features, also add to `CLIENT_MODULE_COMPONENTS` in `lib/modules/client-registry.tsx`.

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

1. Directory `lib/modules/{moduleId}/` exists with at least `types.ts`, `api.ts`, `admin/`
2. Entry exists in `lib/modules/definitions.ts` → `STATIC_MODULE_DEFINITIONS`
3. Entry exists in `dev/backyard/lib/modules/definitions.ts` (parity check)
4. Every `componentKey` in adminRoutes has a matching key in `MODULE_COMPONENTS` (`lib/modules/components.tsx`)
5. Every registered component has a `dynamic(() => import(...))` at the top of `components.tsx`
6. Module entry exists in `scripts/seed-modules.ts` MODULES array
7. All route `path` values end in a single-word segment (no trailing slashes, no nested dynamic params)
8. No `firebase-admin` imports in `components.tsx` or `client-registry.tsx`
9. All admin components have `'use client'` directive

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
  lib/modules/types.ts                              ← type interfaces
  lib/modules/definitions.ts                        ← STATIC_MODULE_DEFINITIONS
  lib/modules/registry.ts                           ← runtime lookup
  lib/modules/components.tsx                        ← MODULE_COMPONENTS
  lib/modules/client-registry.tsx                   ← CLIENT_MODULE_COMPONENTS
  scripts/seed-modules.ts                           ← Firestore seed
  app/admin/(dashboard)/[...slug]/page.tsx          ← catch-all route
  app/admin/(dashboard)/AdminSidebar.tsx            ← sidebar nav
  components/modules/ModuleLoader.tsx               ← component resolver
  components/admin/PermissionGuard.tsx              ← access guard
  lib/hooks/use-permission.ts                       ← usePermission() hook
  lib/user-context.tsx                              ← moduleAccess state
  lib/site-context.tsx                              ← useSite() / siteId

BACKYARD (dev/backyard/):
  lib/modules/definitions.ts                        ← must mirror platform

FUNCTIONS (dev/functions/):
  src/admin/tenant.ts                               ← createTenant / updateTenantModules
  src/admin/modules/seeding.ts                      ← sample data seeding
```

---

## Architecture Rules (never violate)

- `componentKey` format is strictly `{moduleId}:{ComponentName}` — must match exactly in both definitions and MODULE_COMPONENTS
- `routeId` = last URL path segment only — plan paths with this in mind
- All admin page components must have `'use client'` at top
- Never import `firebase-admin` in `components.tsx` or `client-registry.tsx`
- Both `definitions.ts` files (platform + backyard) must always be updated together
- Per-site `sites/{siteId}.modules[moduleId]` must be `true` for module to appear in sidebar — global `enabled` alone is not enough
