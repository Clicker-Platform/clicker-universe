---
name: core_auth_rbac
description: >
  Work with the Clicker Platform Authentication, Role-Based Access Control (RBAC),
  and Site/User Contexts. Use this skill when modifying user permissions,
  protecting routes, or dealing with multi-tenant login flows.
  Trigger on: "add permission", "user roles", "auth logic", "login flow",
  "site context", "user context", "admin access", "lib/user-context.tsx",
  "lib/site-context.tsx", "lib/admin-auth.ts", "lib/rbac.ts".
---

> **Architecture Reference:** Always read [`docs/ARCHITECTURE.md`](../../../clicker-platform-v2/docs/ARCHITECTURE.md) before making any changes.


# /core_auth_rbac — Authentication & RBAC

You are working on the **Clicker Platform Authentication & Access System**. This system controls who can log in, which tenant (site) they are viewing, and what modules or actions they have permission to access.

This skill is invoked as `/core_auth_rbac [action]`.

---

## 1. Global Contexts

Never write custom queries to fetch the current user or site in a React component. Always use the built-in contexts.

### `useSite()` (`@/lib/site-context.tsx`)

Resolves the current tenant for the active dashboard or public site.

- `siteId`: The canonical ID (e.g., `'12345'`). Use this for all Firestore paths.
- `tenantSlug`: The readable URL slug (e.g., `'my-restaurant'`).
- `isPending`: True if the `siteId` is still loading, empty, equals `'pending'`, or equals `'default'`. **Always guard data fetches with `if (isPending) return;`**
- `isSubdomain`: True when the site was resolved from a subdomain (vs. slug path).

### `useUser()` (`@/lib/user-context.tsx`)

Provides the Firebase Auth user AND their specific permissions for the current `siteId`.

- `user`: Standard Firebase Auth `User` object.
- `loading`: True while Auth or Firestore permissions are fetching. **Note:** `loading` is set to `false` immediately when `siteId` is still pending — always guard using *both* `loading` and `isPending` together to avoid access-denied flashes.
- **RBAC Roles & Permissions:**
  - `role`: The user's role on the current site (`'owner' | 'editor' | 'viewer' | 'staff'`).
  - `isOwner`: Boolean shortcut for `role === 'owner'`.
  - `hasAccess(moduleId, routeId)`: Returns `true` if the user can at least *view* the route (`'full'` or `'view'` level).
  - `canEdit(moduleId, routeId)`: Returns `true` if the user has `'full'` access (can save/modify data).
  - `getAccessLevel(moduleId, routeId)`: Returns `'full' | 'view' | 'none'`. Use when you need to distinguish read-only vs. editable vs. hidden UI.

---

## 2. Role-Based Access Control (RBAC) Hierarchy

The platform uses a combination of legacy roles and granular module access.

### The Resolution Order (How `getAccessLevel` / `canEdit` works)

1. **Guard:** Returns `'none'` immediately if `loading` is true.
2. **Owner Override:** If `isOwner` is true, returns `'full'` for everything.
3. **Granular `moduleAccess`:** Checks `moduleAccess[moduleId][routeId]` on the member document (e.g., `moduleAccess['byod_pos']['cashier'] === 'full'`). If the module key exists, this result is final.
4. **Alias fallback:** If no key for `moduleId`, checks the alias (`pos` ↔ `byod_pos`) in `moduleAccess`.
5. **Legacy `permissions` Array:** Last resort. If the user has `'*'` or the module ID in their `permissions` array, they get `'full'`. Alias matching applies here too.

### How to Protect a Client Component

Always guard on **both** `loading` (from `useUser`) and `isPending` (from `useSite`) before rendering access-denied UI or executing writes. `loading` becomes `false` early when the siteId is still resolving, so checking only one is insufficient.

```typescript
import { useUser } from '@/lib/user-context';
import { useSite } from '@/lib/site-context';

export default function MySettingsScreen() {
    const { isPending } = useSite();
    const { loading, canEdit } = useUser();

    if (isPending || loading) return null; // avoid access-denied flash

    const handleSave = async () => {
        if (!canEdit('my_module', 'settings')) {
            alert('You do not have permission to edit these settings.');
            return;
        }
        // ... proceed with Firebase write
    };
}
```

Use `getAccessLevel` when you need read-only vs. editable vs. hidden distinctions in the same component:

```typescript
const level = getAccessLevel('inventory', 'stock');
// 'full'  → show edit controls
// 'view'  → show read-only view
// 'none'  → hide the section entirely
```

---

## 3. Site Membership Lookup (`admin-auth.ts`)

`lib/admin-auth.ts` provides `getUserSites(userId, email)` to determine which tenants a user belongs to. It uses the **client Firebase SDK** (not `firebase-admin`) and is safe to call from client-side code (e.g. the login flow or site-picker screen). Do not use it as a server-side admin guard.

- **Owners:** Checked via `ownerId` field, then falls back to `ownerEmail` field on the `sites` collection.
- **Staff/Members:** Checked via a Firestore `collectionGroup('members')` query on the `email` field.
- Returns `UserSite[]` with `{ siteId, slug, role, name }`.
- *Note:* If a collectionGroup query fails, it's usually because the `members` index on `email` is missing in the Firebase Console (Firestore → Indexes → Collection Group).

---

## 4. Modifying Roles & Permissions

If you need to add a new system role or global permission:

1. Update `lib/rbac.ts` — export the updated `Role` type, `PERMISSIONS` map, and `ROLES` constant.
   - `PERMISSIONS` maps permission names to which roles hold them. The `hasPermission(role, permission)` helper checks this map. Note: this is **separate** from the module-level `canEdit`/`hasAccess` system — it's used for coarse-grained system actions (`manage_site`, `manage_users`, etc.), not per-module route guards.
2. For granular module permissions (per-route access levels), update the member document schema and ensure the UI in `/admin/(dashboard)/business/team` allows assigning those permissions to staff members.

## Common Gotchas

- **Alias Modules:** `pos` and `byod_pos` are treated as aliases throughout the permissions resolution chain (both `moduleAccess` lookup and legacy `permissions` array). If a user has `pos` access, they automatically get `byod_pos` access and vice versa.
- **Double guard required:** `loading` from `useUser()` becomes `false` early when `siteId` is still `'pending'` or `'default'`. Always guard on **both** `loading` and `isPending` to prevent access-denied flashes on initial load.
- **Realtime permissions:** Member permission changes take effect immediately without a page refresh — `useUser` uses `onSnapshot` for the member document. Owner fallback (site doc lookup) is a one-time `getDoc` and does not update in real time.
- **`moduleAccess` is final:** If a `moduleAccess` key exists for the module, the legacy `permissions` array is not consulted. A module entry of `{}` (empty routes) will therefore block all access for that module.
