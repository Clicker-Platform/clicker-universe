# Team Settings Simplification — Design Spec

**Date:** 2026-04-28
**Status:** Approved — ready for implementation plan
**Source docs:** `clicker-platform-v2/Docs/TEAM_SIMPLIFICATION_PLAN.md`, `AUTH_RBAC_REVIEW_2026-04-26.md`
**Approach:** Option B — Surgical + in-scope debug cleanup

---

## Problem

The `/admin/settings/team` page exposes an enterprise-grade ACL matrix: 4 category tabs × N modules × M sub-routes × 3 access levels (none/view/full). For Indonesian F&B SMEs adding a single cashier, this is ~50 binary decisions. The complexity is UI-only — the underlying role model is already binary (Owner vs Staff), and no production member has ever had granular `moduleAccess` set via this UI.

---

## Goal

Replace the matrix with a per-module checkbox list. When an owner adds or edits a staff member, the only permission UI is one checkbox per enabled module.

---

## Scope

**Platform only** — Backyard `tenants/page.tsx` + `PermissionEditor.tsx` already simplified. This PR mirrors that to the platform.

**Out of scope:**
- View-only access tier
- Co-owner / staff-manages-staff
- Named role presets (Cashier, Sales)
- `editor`/`viewer`/`admin` dead type cleanup in `rbac.ts`
- `canEdit()` guard fixes in panels (tracked under RBAC P1)
- Auth P0/P1 fixes (separate workstream)

---

## Before vs After

### Add/Edit Member UI

**Before:** 4-tab matrix, ~50 toggle decisions per member.

**After:**
```
Modules yang bisa diakses staff ini:
  ☐ POS
  ☐ Inventory
  ☐ Reservations
  ☐ Loyalty
```

No tabs, no view/full distinction, no presets.

### Member List Display

**Before:** Badge cluster per permission entry.

**After:** Comma-separated module display names, truncated to 3 + `(+N lagi)` if more.

### Firestore Member Doc Shape

**Before:**
```json
{
  "moduleAccess": {
    "byod_pos": { "cashier": "full", "kds": "view" }
  },
  "permissions": []
}
```

**After:**
```json
{
  "permissions": ["byod_pos", "reservation"],
  "moduleAccess": {}
}
```

---

## Architecture

### Why `moduleAccess: {}` (explicitly empty)

The resolver in `user-context.tsx` short-circuits on `moduleAccess[moduleId]` — if the key exists, it never falls through to `permissions[]`. Writing an explicit module key with sub-route wildcards causes per-route lookups to return `undefined` → `'none'` → access denied.

By keeping `moduleAccess: {}`, the resolver falls through to the legacy `permissions[]` path, which already supports module-name match. No changes to `user-context.tsx` or Firestore rules needed.

### Resolver chain (unchanged)

```
1. loading guard → 'none'
2. isOwner → 'full'
3. moduleAccess[moduleId] exists → use it (empty obj = skip)
4. alias fallback (pos ↔ byod_pos)
5. permissions[] array → module-name match → 'full'
```

### Firestore rules (unchanged)

The `hasWritePermission` fallback at `firestore.rules:79-82` already handles:
```
(moduleAccess == null || moduleAccess[moduleId] == null) &&
permissions.hasAny([moduleId, moduleId + ':full'])
```
With `moduleAccess: {}`, first condition is true → fallback fires → write allowed.

---

## Files Changed

### Edited

**`app/admin/(dashboard)/settings/team/page.tsx`**

Removals:
- Import and usage of `<PermissionEditor>` (lines 10, 365–379)
- State: `memberModuleAccess`, `setMemberModuleAccess` (lines 45, 122, 131, 159, 374)
- Debug: `console.log` line 75
- Debug: 8s loading-timeout `console.error` block (lines 208–215)
- Debug: fixed-position `siteId` debug pill (lines 235–238)

Additions:
- Inline `ModuleCheckboxList` block subscribing to `subscribeToEnabledModules`
- Filter: `siteModules[m.id] === true`, hide `HIDDEN_MODULES = ['pos']`
- Save logic: `permissions: [...checkedModuleIds]`, `moduleAccess: {}`
- Member list: comma-separated display names, truncate to 3 + `(+N lagi)`

**`app/api/admin/team/add/route.ts`** — no change (already accepts both fields).

### Deleted

**`components/admin/settings/PermissionEditor.tsx`** — full deletion (~307 lines).

### Untouched

- `lib/user-context.tsx`
- `firestore.rules`
- `lib/rbac.ts`
- `lib/admin-auth.ts`
- All other API routes

---

## Edit Existing Member Behavior

When owner opens an existing member with granular `moduleAccess`:
- Checkbox state derived from: any route at `'full'` or `'view'` → module checked
- On save: granular structure wiped, replaced with simple shape
- One-way migration, no warning dialog (feature not yet in active use)

---

## Estimated Delta

| File | Change |
|---|---|
| `team/page.tsx` | ~−50 lines net (remove matrix + debug, add checkbox) |
| `PermissionEditor.tsx` | −307 lines (deleted) |
| **Total** | **~−357 lines** |

---

## Validation Checklist

1. **Add staff with POS only** → doc has `permissions: ['byod_pos']`, `moduleAccess: {}` → staff can access `/admin/pos/*`, cannot access `/admin/inventory/*`
2. **Edit existing member with granular moduleAccess** → modal opens with correct checkboxes → save flips to new shape → access preserved
3. **Owner unchanged** → full access everywhere, shows "OWNER" in member list
4. **Firestore rule check** → non-owner user denied write to path not in their `permissions[]`
5. **canEdit() spot-check** → `canEdit('content', 'links')` in LinksPanel — behavior unchanged (verify, not fix)
