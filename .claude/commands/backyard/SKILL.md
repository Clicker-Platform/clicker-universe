---
name: backyard
description: >
  Work with the Clicker Platform Backyard — the superadmin God Mode dashboard.
  Use this skill whenever adding screens, fixing bugs, modifying tenant management,
  user/identity management, module toggling, permission editing, or debugging
  Backyard-specific issues.
  Trigger on: "backyard", "god mode", "superadmin", "tenant forge", "hard delete tenant",
  "update tenant url", "backyard forge", "manage team", "manage modules",
  or any request touching backyard/.
---

# /backyard — Clicker Platform Superadmin Dashboard

You are working on **Backyard** — the internal God Mode dashboard for Clicker Platform. It is a **standalone Next.js app** (separate from `clicker-platform-v2`) that gives superadmins full control over all tenants, users, and platform configuration.

This skill is invoked as `/backyard [action]`.

---

## 1. Architecture Overview

### Location & Stack
```
backyard/
  app/                    ← Next.js App Router pages
    layout.tsx            ← Root layout (Inter font, Sonner toaster)
    page.tsx              ← Login screen + God Mode dashboard home
    tenants/page.tsx      ← Tenant Forge + tenant list + all tenant dialogs
    users/page.tsx        ← Identity management (all Firebase users)
    monitoring/page.tsx   ← System health (placeholder, coming soon)
    settings/page.tsx     ← Global config (placeholder, coming soon)
  components/
    Sidebar.tsx           ← Fixed left nav (Overview, Tenants, Identities, Monitoring, Settings)
    PermissionEditor.tsx  ← Granular module + route access level editor
    SeedTool.tsx          ← Developer tool: seed demo data to any site
    ui/
      confirmation-dialog.tsx  ← Reusable confirm modal (danger/warning/primary variants)
  lib/
    firebase.ts           ← Firebase client SDK init ('use client')
    modules/
      definitions.ts      ← STATIC_MODULE_DEFINITIONS + SYSTEM_MODULES (must match platform)
      types.ts            ← ModuleDefinition, AdminRoute, ModuleAccess interfaces
  package.json            ← Standalone deps (firebase, next 16, lucide-react, sonner, tailwind 4)
  firebase.json           ← Hosting: site=clicker-backyard-app
```

### Key Differences from `clicker-platform-v2`
| | Backyard | Platform |
|---|---|---|
| Auth | Firebase client SDK direct | Firebase client SDK + `useSite()` / `useUser()` |
| All-client | Yes — every page is `'use client'` | Mixed Server + Client components |
| Tenant context | None (superadmin sees all) | Always scoped to `siteId` |
| Data access | Via Cloud Functions (`httpsCallable`) | Direct Firestore client + `useSite()` |
| RBAC | No — superadmin only | Yes — `canEdit()` / `hasAccess()` |
| Port (dev) | `3011` | `3000` |

### Cloud Functions Used
All data operations go through Firebase Cloud Functions — Backyard never writes directly to Firestore (except the team dialog which uses `onSnapshot` for real-time member list):

| Function | Purpose |
|---|---|
| `getTenants` | Fetch all tenants list |
| `createTenant` | Create new tenant + owner account |
| `suspendTenant` | Toggle tenant status active/suspended |
| `updateTenantModules` | Enable/disable modules for a tenant |
| `hardDeleteTenant` | Permanently delete tenant data + auth accounts |
| `updateTenantSlug` | Change tenant's public URL slug |
| `createUser` | Create/add user to a site with role + permissions |
| `removeUserFromSite` | Remove user from site (Firestore + claims) |
| `seedSiteData` | Reset/seed demo data for a site |
| `getUsers` | Fetch all Firebase Auth users (users page) |

---

## 2. Module Definitions Parity Rule

`backyard/lib/modules/definitions.ts` **MUST be kept in strict parity** with `clicker-platform-v2/lib/modules/definitions.ts`.

**Backyard-specific additions** (not in platform):
- `displayName` and `description` fields on each module (used by UI)
- `SYSTEM_MODULES` export helper at bottom of file

**Rule:** Any time routes change in the platform definitions, update backyard definitions AND `scripts/seed-modules.ts` to match. All three must be identical in paths and componentKeys.

Current modules (as of last sync):
```
byod_pos, membership, inventory, reservation, ai_sales, sales_pipeline, service_records
```

---

## 3. Page Reference

### `app/page.tsx` — Login + Dashboard Home
- Shows login screen if no Firebase auth session
- Shows dashboard overview (stat cards) after login
- Dev-only button to bootstrap superadmin account via `createUser` Cloud Function
- Auth listener: `onAuthStateChanged(auth, ...)`

### `app/tenants/page.tsx` — Tenant Forge (main page)
All tenant operations live here. Dialogs:

| Dialog | State var | Trigger |
|---|---|---|
| Create tenant form | inline in Forge panel | Always visible |
| Manage Modules | `moduleDialogOpen` | Grid icon button |
| Manage Team | `teamDialogOpen` | Users icon button |
| Suspend/Activate | `confirmOpen` (ConfirmationDialog) | Power/PowerOff icon |
| Update URL / Slug | `updateUrlDialogOpen` | Pencil icon |
| Hard Delete | `deleteDialogOpen` | Trash2 icon |

**Hard Delete flow:** requires typing exact `siteId` to unlock — calls `hardDeleteTenant`.
**Update URL flow:** sanitizes input to `[a-z0-9-]` — calls `updateTenantSlug`.
**Team dialog:** uses `onSnapshot` on `sites/{siteId}/members` for real-time member list.

### `app/users/page.tsx` — Identity Management
- Lists all Firebase Auth users platform-wide
- Create user, assign role to site, revoke access
- Search/filter by email or display name

### `components/PermissionEditor.tsx`
Renders per-module, per-route access level controls (`none` / `view` / `full`).
- Grouped into categories: **Operations**, **Management**, **AI & Sales**, **Other**
- Presets: **Cashier** (byod_pos cashier + orders full, menu view)
- `getRouteId(path)` extracts last segment of path as routeId
- Only shows modules enabled for the selected tenant (`siteModules` prop)

---

## 4. Audit Checklist

Before modifying Backyard, verify:

- [ ] `lib/modules/definitions.ts` is in parity with `clicker-platform-v2/lib/modules/definitions.ts`
- [ ] All `componentKey` values used in definitions exist in platform's `MODULE_COMPONENTS`
- [ ] No `firebase-admin` imports anywhere — Backyard is all-client
- [ ] All API calls use `httpsCallable(functions, 'functionName')` — never direct Firestore writes (except `onSnapshot` reads)
- [ ] No `useSite()` or `useUser()` imports — these are platform-only contexts
- [ ] Every page has `'use client'` directive
- [ ] New Cloud Functions called from Backyard are documented in the table above

---

## 5. ICON_MAP Reference

`PermissionEditor.tsx` has a local `ICON_MAP` that must contain all icons used as `icon` fields in `definitions.ts`. Current map:

```ts
'credit-card': CreditCard
'monitor-dot': MonitorDot
'clipboard-list': ClipboardList
'utensils': Utensils
'settings': Settings
'user': User
'users': Users
'box': Box
'calendar': Calendar
'list': List
'layout-dashboard': LayoutDashboard
'file-text': FileText
'bar-chart-3': BarChart3
'trophy': Trophy
'car': Car
'wrench': Wrench
'bell': Bell
'plus': Plus
'bot': Bot
```

When adding a new module route with a new icon, add both:
1. The icon to `ICON_MAP` in `PermissionEditor.tsx`
2. The Lucide import at the top of that file

---

## 6. Adding a New Page to Backyard

1. Create `app/{page-name}/page.tsx` with `'use client'` at top
2. Import and render `<Sidebar />` as fixed left nav
3. Use `ml-64` on main content wrapper to offset sidebar
4. Add the route to `Sidebar.tsx` `menuItems` array:
   ```ts
   { name: 'Page Name', icon: SomeIcon, href: '/page-name' }
   ```
5. Pattern for page shell:
   ```tsx
   'use client';
   import Sidebar from '@/components/Sidebar';
   
   export default function NewPage() {
       return (
           <div className="min-h-screen bg-gray-50/50 flex font-sans">
               <Sidebar />
               <div className="flex-1 ml-64 p-8">
                   <header className="mb-8">
                       <h1 className="text-3xl font-black text-brand-dark flex items-center gap-3">
                           <Icon className="w-8 h-8" />
                           PAGE TITLE
                       </h1>
                       <p className="text-gray-500 font-medium">Subtitle</p>
                   </header>
                   {/* content */}
               </div>
           </div>
       );
   }
   ```

---

## 7. Adding a New Tenant Action (Dialog Pattern)

When adding a new action button + dialog to `tenants/page.tsx`:

1. Add state: `const [xyzDialogOpen, setXyzDialogOpen] = useState(false)`
2. Add handler function: `const openXyzDialog = (tenant: any) => { setSelectedTenant(tenant); ... }`
3. Add action function: `const handleXyz = async () => { ... httpsCallable(functions, 'xyzFunction') ... }`
4. Add icon button in the action column (after existing buttons in the `<div className="flex items-center gap-1">` group)
5. Add dialog JSX before the closing `</div>` of the page, after existing dialogs
6. Document the new Cloud Function in the table in section 1

---

## 8. Common Bug Patterns & Fixes

### Bug: Module toggle shows wrong state after save
**Root cause:** `saveModules` was not updating local tenant state — it only called `fetchTenants` (async, causes flicker).
**Fix:** After successful `updateTenantModules`, immediately call:
```ts
setTenants(prev => prev.map(t =>
    t.id === selectedTenant.id ? { ...t, modules: managingModules } : t
));
```

### Bug: Module dialog opens with all toggles OFF
**Root cause:** `tenant.modules` from Cloud Function may have missing keys for newer modules.
**Fix:** Merge with default-all-false map before setting state:
```ts
const defaultModules: Record<string, boolean> = {};
SYSTEM_MODULES.forEach(mod => { defaultModules[mod.id] = false; });
const currentModules = { ...defaultModules, ...(tenant.modules || {}) };
setManagingModules(currentModules);
```

### Bug: Duplicate tenants in list
**Root cause:** `fetchTenants` can be called multiple times during auth state changes.
**Fix:** Deduplicate by `id` before setting state:
```ts
const seen = new Set();
const unique = result.data.list.filter(t => seen.has(t.id) ? false : seen.add(t.id));
```

### Bug: PermissionEditor shows no modules (all in "Other" category)
**Root cause:** `CATEGORIES` map had stale module IDs (`sales-pipeline` instead of `sales_pipeline`).
**Fix:** Keep CATEGORIES map in sync with actual module IDs from `definitions.ts`:
```ts
const CATEGORIES = {
    'Operations': ['byod_pos'],
    'Management': ['inventory', 'reservation', 'membership', 'sales_pipeline', 'service_records'],
    'AI & Sales': ['ai_sales'],
};
```

### Bug: Icon renders as fallback Box in PermissionEditor
**Root cause:** Icon key from `definitions.ts` not present in `ICON_MAP`.
**Fix:** Add missing icon to ICON_MAP (see Section 5).

### Bug: Hard Delete button has no confirmation — immediate delete
**Design intent:** The delete dialog requires typing exact `siteId` before button unlocks:
```tsx
disabled={deleteLoading || deleteConfirmText !== selectedTenant.id}
```
Never remove this guard.

---

## 9. File Map

```
PAGES:
  app/page.tsx                        ← Login + dashboard home (auth gate + stat cards)
  app/tenants/page.tsx                ← Tenant Forge — all tenant CRUD operations
  app/users/page.tsx                  ← Identity management (all auth users)
  app/monitoring/page.tsx             ← Coming soon placeholder
  app/settings/page.tsx               ← Coming soon placeholder

COMPONENTS:
  components/Sidebar.tsx              ← Fixed nav (Overview, Tenants, Identities, Monitoring, Settings)
  components/PermissionEditor.tsx     ← Module/route access level editor (none/view/full)
  components/SeedTool.tsx             ← Dev tool: seed demo data by siteId
  components/ui/confirmation-dialog.tsx ← Reusable modal (variant: danger/warning/primary)

LIB:
  lib/firebase.ts                     ← Firebase client init (auth, db, functions)
  lib/modules/definitions.ts         ← Module route definitions (parity with platform)
  lib/modules/types.ts                ← ModuleDefinition, AdminRoute, ModuleAccess

CONFIG:
  package.json                        ← next dev -p 3011
  firebase.json                       ← site: clicker-backyard-app
  next.config.ts                      ← reactCompiler: true
```
