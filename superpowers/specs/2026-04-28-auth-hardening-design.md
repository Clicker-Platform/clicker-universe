# Auth Hardening — Design Spec

**Date:** 2026-04-28
**Status:** Approved — ready for implementation plan
**Source doc:** `clicker-platform-v2/Docs/AUTH_RBAC_REVIEW_2026-04-26.md`
**Approach:** Simplified — single helper `requireAuthedMember` for all protected routes + P1 rule fixes

---

## Problem

~15 admin API routes have no authentication at all. Several use `adminDb` which bypasses Firestore rules entirely — meaning any unauthenticated request can read/write tenant data. The most critical: `whatsapp/send` allows anyone to send WhatsApp messages from any tenant's connected number.

---

## Access Model

**Owner + Staff** — full access to all admin routes
**Public** — form submission + incoming webhooks only (no auth, by design)

---

## Architecture

### Core helper: `lib/api-auth.ts`

Single file, one exported function, one internal resolver.

```typescript
export interface AuthedSession {
    uid: string;
    email: string;
    siteId: string;
    role: 'owner' | 'staff';
    isOwner: boolean;
}

type AuthResult =
    | { ok: true; session: AuthedSession }
    | { ok: false; res: NextResponse };

// All protected routes — owner OR active staff
export async function requireAuthedMember(req: NextRequest): Promise<AuthResult>
```

**Flow:**
1. Read `siteId` from `x-site-id` header (set by middleware from `__session` cookie — trusted source)
2. Read `Authorization: Bearer <token>` header → `adminAuth.verifyIdToken(token)`
3. Check owner: `sites/{siteId}.ownerId === uid` OR `sites/{siteId}.ownerEmail === email`
4. If owner → return session with `isOwner: true`
5. If not → check `sites/{siteId}/members/{uid}`, `status === 'active'` → return session with `isOwner: false`
6. If neither → 403

**Usage pattern (2 lines per route):**
```typescript
const auth = await requireAuthedMember(req);
if (!auth.ok) return auth.res;
const { siteId } = auth.session;
```

No caching — each request does 1–2 Firestore reads. Acceptable for admin dashboard usage.

---

## Route Coverage

### `requireAuthedMember` — all protected routes (owner + staff, full access)

| Route | Current State |
|---|---|
| `app/api/admin/whatsapp/connect/route.ts` | No auth ✓ done |
| `app/api/admin/whatsapp/disconnect/route.ts` | No auth ✓ done |
| `app/api/admin/whatsapp/send/route.ts` | No auth |
| `app/api/admin/whatsapp/test/route.ts` | No auth |
| `app/api/admin/knowledge/sync/route.ts` | No auth ✓ done |
| `app/api/admin/knowledge/verify/route.ts` | No auth ✓ done |
| `app/api/admin/modules/ai-sales-agent/config/route.ts` | Auth commented out ("TEMPORARY BYPASS") |
| `app/api/admin/seed-templates/route.ts` | No auth |
| `app/api/forms/create/route.ts` | Auth commented out |
| `app/api/forms/update/route.ts` | Auth commented out |
| `app/api/forms/delete/route.ts` | Auth commented out |
| `app/api/submissions/update/route.ts` | Auth commented out |
| `app/api/upload/image/route.ts` | No auth |
| `app/api/upload/avatar/route.ts` | No auth |

### Special: `auth/check-access`

This route is called during login flow — the user promotes themselves to active member. Fix is not `requireOwner` but a uid+email assertion:

```typescript
const decoded = await adminAuth.verifyIdToken(bearerToken);
if (decoded.uid !== body.uid || decoded.email !== body.email) {
    return NextResponse.json({ error: 'Token mismatch' }, { status: 403 });
}
```

Prevents invitation self-promotion attack (user A cannot promote user B by supplying B's uid in body).

### Untouched (public, by design)

- `forms/submit` — public form submission from end-users
- `forms` GET — fetch form for public display
- WhatsApp webhook — incoming messages from Meta

---

## P1 Fixes (same PR)

### Firestore rules — `hasRole` pure owner bug

**File:** `firestore.rules`

**Problem:** `hasRole()` calls `get(members/{uid})` without `exists()` check. If the owner has no `members` doc (pure owner), the rule throws → denies write. Owner cannot add team members via client SDK.

**Fix:**
```
function hasRole(siteId, allowedRoles) {
  return isGlobalAdmin() || isSiteOwner(siteId) || (
    exists(/databases/$(database)/documents/sites/$(siteId)/members/$(request.auth.uid)) &&
    get(/databases/$(database)/documents/sites/$(siteId)/members/$(request.auth.uid)).data.role in allowedRoles
  );
}
```

### Storage rules — cross-tenant write

**File:** `storage.rules`

**Problem:** `match /sites/{siteId}/{allPaths=**} { allow write: if isAuthenticated(); }` — any authenticated user can write to any tenant's Storage path.

**Fix:**
```
match /sites/{siteId}/{allPaths=**} {
    allow read: if isAuthenticated();
    allow write: if isAuthenticated() && isSiteOwnerOrMember(siteId);
}
```

Where `isSiteOwnerOrMember` checks `sites/{siteId}/members/{uid}` exists OR uid matches site owner.

### Client SDK → adminDb

**Files:** `app/api/forms/submit/route.ts`, `app/api/analytics/track/route.ts`

**Problem:** Both import `db` from `@/lib/firebase` (client SDK) and use it server-side. Bundles client SDK into server, runs anonymously, bypasses any future server-side validation.

**Fix:** Switch both to `adminDb` from `@/lib/firebase-admin`. Keep `inbox/create: if true` Firestore rule (still needed for potential direct browser submissions).

---

## Files Changed

| File | Action |
|---|---|
| `lib/api-auth.ts` | Create — `requireAuthedMember` helper |
| `app/api/admin/whatsapp/connect/route.ts` | Add `requireAuthedMember` ✓ done |
| `app/api/admin/whatsapp/disconnect/route.ts` | Add `requireAuthedMember` ✓ done |
| `app/api/admin/whatsapp/send/route.ts` | Add `requireAuthedMember` |
| `app/api/admin/whatsapp/test/route.ts` | Add `requireAuthedMember` |
| `app/api/admin/knowledge/sync/route.ts` | Add `requireAuthedMember` ✓ done |
| `app/api/admin/knowledge/verify/route.ts` | Add `requireAuthedMember` ✓ done |
| `app/api/admin/modules/ai-sales-agent/config/route.ts` | Remove bypass comment, add `requireAuthedMember` |
| `app/api/admin/seed-templates/route.ts` | Add `requireAuthedMember` |
| `app/api/forms/create/route.ts` | Add `requireAuthedMember` |
| `app/api/forms/update/route.ts` | Add `requireAuthedMember` |
| `app/api/forms/delete/route.ts` | Add `requireAuthedMember` |
| `app/api/submissions/update/route.ts` | Add `requireAuthedMember` |
| `app/api/upload/image/route.ts` | Add `requireAuthedMember` |
| `app/api/upload/avatar/route.ts` | Add `requireAuthedMember` |
| `app/api/auth/check-access/route.ts` | Add uid+email token assertion |
| `app/api/forms/submit/route.ts` | Switch client SDK → adminDb |
| `app/api/analytics/track/route.ts` | Switch client SDK → adminDb |
| `firestore.rules` | Fix `hasRole` pure owner bug |
| `storage.rules` | Tighten write rule to site membership |

**Total: 20 files** — 1 new, 19 modified.

---

## Out of Scope

- In-memory session cache (YAGNI — add later if perf becomes concern)
- `canEdit()` standardization in UI panels (separate cleanup PR)
- Removing dead `editor`/`viewer` types in `rbac.ts`
- Pure-owner detection via `onSnapshot` (nice to have, not security-critical)
- WhatsApp webhook auth (Meta signature verification — separate concern)
