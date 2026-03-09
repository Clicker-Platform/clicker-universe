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
- `isPending`: True if the `siteId` is still loading or equals `'default'`. **Always guard data fetches with `if (isPending) return;`**

### `useUser()` (`@/lib/user-context.tsx`)

Provides the Firebase Auth user AND their specific permissions for the current `siteId`.

- `user`: Standard Firebase Auth `User` object.
- `loading`: True while Auth or Firestore permissions are fetching.
- **RBAC Roles & Permissions:**
  - `role`: The user's role on the current site (`'owner' | 'editor' | 'viewer' | 'staff'`).
  - `isOwner`: Boolean shortcut for `role === 'owner'`.
  - `hasAccess(moduleId, routeId)`: Returns `true` if the user can at least *view* the route.
  - `canEdit(moduleId, routeId)`: Returns `true` if the user has `full` access (can save/modify data).

---

## 2. Role-Based Access Control (RBAC) Hierarchy

The platform uses a combination of legacy roles and granular module access.

### The Resolution Order (How `canEdit` works)

1. **Owner Override:** If `isOwner` is true, they have `full` access to everything.
2. **Granular `moduleAccess`:** Checks if the user has a specific rule for the module/route (e.g., `moduleAccess['byod_pos']['cashier'] === 'full'`).
3. **Legacy `permissions` Array:** Fallback. If the user has `'*'` or `'byod_pos'` in their array, they get full access.

### How to Protect a Client Component

Always check `canEdit` before executing a Firestore `updateDoc` or `setDoc` inside a dashboard screen:

```typescript
import { useUser } from '@/lib/user-context';

export default function MySettingsScreen() {
    const { canEdit } = useUser();
    
    const handleSave = async () => {
        if (!canEdit('my_module', 'settings')) {
            alert('You do not have permission to edit these settings.');
            return;
        }
        // ... proceed with Firebase write
    };
}
```

---

## 3. Server-Side Authentication (`admin-auth.ts`)

When fetching data server-side (in API Routes or Server Components), you cannot use `useUser()`.

Use `getUserSites(userId, email)` to determine which tenants a user belongs to.

- **Owners:** Checked via the `ownerId` or `ownerEmail` field on the `sites` collection.
- **Staff/Members:** Checked via a Firestore `collectionGroup('members')` query matching the user's `email`.
- *Note:* If a collectionGroup query fails, it's usually because the `members` index is missing in the Firebase Console.

---

## 4. Modifying Roles & Permissions

If you need to add a new system role or global permission:

1. Update `lib/rbac.ts` (export `Role` type, `PERMISSIONS` map, and `ROLES` constant).
2. If adding a new granular module permission, ensure the UI in `/admin/(dashboard)/business/team` is updated to allow assigning that permission to staff members.

## Common Gotchas

- **Alias Modules:** `pos` and `byod_pos` are often treated as aliases in the permissions checking logic. If a user has access to `pos`, the system automatically grants them access to `byod_pos` to maintain backward compatibility.
- **Pending State:** Always check `loading` from `useUser()` or `isPending` from `useSite()` before rendering access-denied screens, otherwise the user will see a flash of "Access Denied" on initial load.
