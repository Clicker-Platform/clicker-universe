# Team Settings Simplification Plan

**Date:** 2026-04-26
**Status:** Approved scope, ready to implement
**Related:** [AUTH_RBAC_REVIEW_2026-04-26.md](./AUTH_RBAC_REVIEW_2026-04-26.md)

---

## Context

Today's `/admin/settings/team` page exposes an enterprise-grade ACL matrix:
4 category tabs × N modules × M sub-routes × 3 access levels (none/view/full).
For a typical Indonesian F&B SME (1–10 locations) adding a single cashier, this is ~50 binary decisions.

This UI does not match the user — Indonesian F&B SMEs have two roles in practice: **Owner** and **Staff**. The matrix is solving a problem the segment does not have.

Investigation across the auth/RBAC review surfaced two facts that informed this plan:

1. **The role system is already a binary** — Owner (stored on `sites/{siteId}` doc as `ownerId`/`ownerEmail`) vs Staff (stored at `sites/{siteId}/members/{uid}` with `role: 'staff'` hardcoded). The `editor`, `viewer`, `admin` strings appearing in type definitions are dead surface area; no code path creates members with those values.
2. **The matrix is the complexity, not the role model** — every staff member is `role: 'staff'` and the only thing that differentiates them is `moduleAccess`/`permissions[]`. The matrix lets owners construct an infinite number of unnamed roles via checkbox combination.

The simplification target is therefore the matrix itself, not the role model.

---

## Goal

When a tenant owner adds a staff member, the entire permission UI is a checkbox per enabled module. Nothing more.

```
Add Member
  ├── Email
  ├── Password
  └── Modules this staff can access:
       ☐ POS
       ☐ Inventory
       ☐ Reservations
       ☐ Loyalty
[Add Member]
```

No view/full distinction. No tabs. No presets. No role dropdown (it stays hardcoded `'staff'` because nothing reads it).

---

## Scope decisions (settled)

| # | Question | Decision |
|---|---|---|
| Q1 | Are F&B SME roles really just Owner + Staff? | Yes. Confirmed by user. |
| Q2 | Can staff manage other staff? | No — only owner manages team. Expand later if needed. |
| Q3 | Read-only access tier (view-only)? | Not now. Future, no timeline. |
| Q4 | Co-owner support? | Not now. Ownership is singular. |
| Q5 | Named staff presets (Cashier / Sales)? | Not now. User declined — wants module-level access first, role types come later "based on type of modules." |
| Q6 | Out-of-scope items (see below) | Confirmed. |
| Q7 | Where to define presets if any? | N/A — no presets in this phase. |
| Q8 | Module-level access only, no sub-routes? | Yes. Staff with module access gets all routes inside it. |

### Explicitly out of scope

- ❌ View-only tier (Q3)
- ❌ Co-owner role (Q4)
- ❌ Staff managing other staff (Q2)
- ❌ Migration of existing members (their old `moduleAccess` stays untouched until edited; on edit, it gets collapsed)
- ❌ Cleaning up dead `'admin' | 'editor' | 'viewer'` strings in `rbac.ts` and `team/page.tsx` (separate cleanup)
- ❌ Fixing P0 auth holes from the auth/RBAC review (separate work)
- ❌ Backyard `/users` page role dropdown — see "Backyard implications" below

---

## Data model

### What gets written when owner saves "POS + Reservations"

```json
{
  "email": "cashier@store.com",
  "displayName": "...",
  "role": "staff",
  "permissions": ["byod_pos", "reservation"],
  "moduleAccess": {},
  "status": "active"
}
```

**Why `moduleAccess: {}` (explicitly empty):**

The resolver at [user-context.tsx:60-62](../lib/user-context.tsx#L60-L62) returns immediately if `moduleAccess[moduleId]` exists, never falling through to the legacy `permissions[]` path:

```typescript
if (moduleAccess[moduleId]) {
    return moduleAccess[moduleId][routeId] || 'none';
}
```

If we wrote `moduleAccess: { byod_pos: { '*': 'full' } }`, the per-route lookup `moduleAccess['byod_pos']['cashier']` returns `undefined` → `'none'` → access denied. We must keep `moduleAccess` empty so the resolver falls through to the legacy `permissions[]` array, which already supports module-name match correctly ([user-context.tsx:75-83](../lib/user-context.tsx#L75-L83)).

The Firestore rule at [firestore.rules:79-82](../firestore.rules#L79-L82) has a matching fallback:
```
(moduleAccess == null || moduleAccess[moduleId] == null) &&
permissions.hasAny([moduleId, moduleId + ':full'])
```
With our empty `moduleAccess: {}`, the first condition is true, fallback fires, write allowed. **No rule changes needed.**

### Backward compatibility

- **Existing members** keep their granular `moduleAccess` untouched. They continue working.
- **On edit** of an existing member:
  - The new UI reads back: any module with at least one route at `'full'` or `'view'` → checkbox checked
  - On save, the granular structure is **wiped** and replaced with the simple shape (`permissions[]` populated, `moduleAccess: {}`)
  - One-way migration. No batch migration. No warning dialog (matches "dead simple" intent).

---

## Files to change

### Edited

**1. [`app/admin/(dashboard)/settings/team/page.tsx`](../app/admin/(dashboard)/settings/team/page.tsx)**

- Remove import and usage of `<PermissionEditor>` (lines 10, 365-379)
- Drop state: `memberModuleAccess`, `setMemberModuleAccess` (lines 45, 122, 131, 159, 374)
- Add inline `ModuleCheckboxList` block:
  - Subscribe to enabled modules via `subscribeToEnabledModules` (replicate logic from `PermissionEditor`)
  - Filter to `siteModules[m.id] === true`
  - Render checkbox per module with `module.displayName`
  - Hidden modules: respect `HIDDEN_MODULES = ['pos']` (alias of byod_pos)
- On save:
  - `permissions: [...checkedModuleIds]`
  - `moduleAccess: {}`
- Member list display:
  - Replace badge cluster (lines 285-295) with comma-separated module display names
  - Truncate to 3 modules + "(+N more)" if longer
- Remove dead debug code:
  - Line 75: `console.log('TeamPage: Subscribing to members for site:', siteId)`
  - Lines 208-215: 8s loading-timeout `console.error` block
  - Lines 235-238: fixed-position `siteId` debug pill

**2. [`app/api/admin/team/add/route.ts`](../app/api/admin/team/add/route.ts)**

- No change required. Already accepts `permissions[]` and `moduleAccess` fields. The new shape passes through unchanged.

### Deleted

**3. [`components/admin/settings/PermissionEditor.tsx`](../components/admin/settings/PermissionEditor.tsx)**

Full file deletion. ~307 lines.

### Untouched

- `lib/user-context.tsx` — resolver chain handles both old and new data via legacy `permissions[]` fallback
- `firestore.rules` — `hasWritePermission` fallback already supports legacy permissions
- `lib/rbac.ts` — dead types stay (out of scope per Q6)
- `lib/admin-auth.ts` — unrelated
- All other API routes — unrelated

---

## Estimated change size

| File | Delta |
|---|---|
| `team/page.tsx` | ~50 lines net delta (remove matrix block, add checkbox block, drop debug code) |
| `PermissionEditor.tsx` | -307 lines (deleted) |
| `team/add/route.ts` | 0 |
| **Total** | **~−260 lines** |

Net deletion. The simplest changes are the ones that subtract.

---

## Validation checklist

Before merging:

1. **Add a new staff member with POS only checked**
   - Member doc has `permissions: ['byod_pos']`, `moduleAccess: {}`
   - Staff logs in → can access `/admin/pos/*` routes
   - Staff cannot access `/admin/inventory/*`
   - Sidebar shows only POS items

2. **Edit an existing pre-migration member who has granular `moduleAccess`**
   - Modal opens with checkboxes reflecting their current modules (any route `'full'` or `'view'` → checked)
   - Save without changes still flips them to the new shape
   - Their access is preserved (no module disappears) but granular view/full distinctions are lost
   - Verify via Firestore console that doc matches expected new shape

3. **Test owner unchanged**
   - Owner login still has full access everywhere
   - Owner row in members list shows as "OWNER" with no module list (unchanged)

4. **Firestore rule check**
   - Have a non-owner user try to write to a Firestore path their `permissions[]` doesn't authorize
   - Should be denied (proves rules still work without modification)

5. **Existing canEdit() call sites**
   - Spot-check `canEdit('content', 'links')` in [LinksPanel:127](../components/admin/blocks/panels/LinksPanel.tsx#L127) — staff with `permissions: ['content']` should get `'full'` via legacy fallback
   - Note: `'content'` is not a module ID in the registry, this may already be broken — verify behavior is unchanged, not "fixed"

---

## Backyard implications (scope clarification)

Backyard has two surfaces touching team/role data:

### Surface A — Tenant team management
**File:** [`backyard/app/tenants/page.tsx`](../../backyard/app/tenants/page.tsx) + [`backyard/components/PermissionEditor.tsx`](../../backyard/components/PermissionEditor.tsx)

Same matrix as the platform. **Should be simplified the same way** — same data shape, same Firestore collection. Mirror the platform changes.

**Estimated additional change:** ~50 lines edited in `tenants/page.tsx`, ~280 lines deleted (`PermissionEditor.tsx`).

### Surface B — Cross-tenant role dropdown
**File:** [`backyard/app/users/page.tsx`](../../backyard/app/users/page.tsx)

Different problem. This page writes Firebase Auth **custom claims** (not Firestore docs) via the `setCustomClaims` callable. Its dropdown offers `Staff (Limited) / Owner (Full Site Access) / Admin (Site Manager)`.

Investigation showed: **only `'superadmin'` is read by any code path.** Confirmed across:
- [`firestore.rules:11`](../firestore.rules#L11) — `request.auth.token.role == 'superadmin'`
- [`functions/src/admin/rbac.ts:10,48`](../../functions/src/admin/rbac.ts) — superadmin only
- [`functions/src/admin/system.ts:59`](../../functions/src/admin/system.ts) — superadmin only
- [`functions/src/admin/tenant.ts:15,120,150,175`](../../functions/src/admin/tenant.ts) — all superadmin only
- [`clicker-platform-v2/app/api/admin/cache/purge/route.ts:25`](../app/api/admin/cache/purge/route.ts#L25) — superadmin only

**The dropdown's `staff` and `admin` options write inert claims that no code reads.** `owner` is also non-functional (real ownership lives on `sites/{siteId}` doc).

This is dishonest UI — the "Platform roles are strictly enforced" infobox at the bottom is false.

### Recommendation

Two PRs, sequenced:

**PR 1 — Matrix simplification (Surface A in both apps):**
- Platform: edit `team/page.tsx`, delete `PermissionEditor.tsx`
- Backyard: edit `tenants/page.tsx`, delete `components/PermissionEditor.tsx`
- Single PR touching both apps to honor the 3-way parity rule
- Net: ~−540 lines

**PR 2 — Backyard Users page honesty (Surface B, follow-up):**
- Strip the role dropdown in `backyard/app/users/page.tsx`
- Replace with `[Make Superadmin] [Revoke]` only
- Remove the misleading "Platform roles are strictly enforced" infobox
- Net: ~−30 lines, zero functional change (deleted options were inert)

PR 2 can ship later. It's a lie-removal, not a feature change. No urgency, but worth doing once PR 1 lands so the team UX story is fully aligned.

---

## What's NOT in this plan (deliberately)

- Role presets (Cashier, Sales templates) — declined per Q5
- Removing dead `editor`/`viewer`/`admin` types — separate cleanup
- Fixing `'content'` permission name mismatch in LinksPanel — pre-existing, unrelated
- Auth holes from the security review — tracked separately in [AUTH_RBAC_REVIEW_2026-04-26.md](./AUTH_RBAC_REVIEW_2026-04-26.md)
- Per-module role types (mentioned by user as "later, defined per-module") — future work
- Shared component extraction between platform and Backyard — premature; revisit only if/when the simple checkbox lists meaningfully diverge

---

## Open question before code

The plan above assumes the user will confirm one of:

- **Option 1** — PR 1 only (platform team page simplified, Backyard tenants page left as matrix temporarily)
- **Option 2** — PR 1 covering both platform and Backyard simultaneously (recommended)
- **Option 3** — PR 1 + PR 2 bundled into one (also fine if appetite is there)

Default if not specified: **Option 2.** Honors the 3-way parity rule and avoids the awkward intermediate state where platform owners use checkboxes but superadmins still see a matrix.
