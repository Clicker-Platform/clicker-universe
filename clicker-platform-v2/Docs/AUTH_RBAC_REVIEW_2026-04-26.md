# Auth & RBAC Comprehensive Review

**Date:** 2026-04-26
**Scope:** `clicker-platform-v2` — Authentication flow, RBAC model, server/client boundary, multi-tenancy, security gaps
**Supersedes (in part):** `Docs/RBAC_ANALYSIS.md` (2026-01-09 — POS-era, narrower scope)

---

## TL;DR

The auth/RBAC architecture is **well-designed in principle** — the resolution chain (loading → owner → granular `moduleAccess` → alias → legacy `permissions[]`) is sound, the Firestore rules mirror the client-side checks, and the cross-origin auth-callback relay correctly handles Firebase Auth's per-origin IndexedDB.

The **execution has serious gaps** — multiple admin API routes have no auth at all, several have auth blocks that were commented out and never restored, `siteId` is accepted from the request body in cross-tenant-vulnerable ways, and one route ships a "TEMPORARY BYPASS for MVP" comment in production handling the global Gemini API key.

The Firestore rules are a strong server-side gate, but **routes using `adminDb` bypass them entirely** — so missing route-level auth is a full bypass regardless of how good the rules are.

---

## 1. Authentication Flow

### Current State

```
External Auth Gateway
      │
      ▼ (custom token via URL fragment)
/admin/auth/callback
      │
      ▼ signInWithCustomToken
Firebase Auth (per-origin IndexedDB)
      │
      ▼
__session cookie ← stores siteId only (NOT auth token)
      │
      ▼
middleware.ts reads cookie → sets x-site-id header
      │
      ▼
UserProvider resolves role via Firestore onSnapshot
```

**Strengths:**
- Token transit via URL fragment (`#token=`) keeps it out of server logs — [auth/callback/page.tsx:41-44](../app/admin/auth/callback/page.tsx)
- Cross-origin relay correctly handles Firebase Auth's per-origin IndexedDB (sign-in must happen at the target subdomain)
- Timeouts (10s on `signInWithCustomToken`, 5s on `getUserSites`) prevent infinite hangs
- Middleware enforces gateway redirect when no `__session` cookie present
- `__session` cookie carries only the `siteId`, not the auth token (auth lives in Firebase Auth IndexedDB)

### Issues

| ID | Severity | File | Issue |
|---|---|---|---|
| 1.1 | Medium | [auth/callback/page.tsx:44](../app/admin/auth/callback/page.tsx) | `?token=` query fallback means tokens land in browser history, proxy logs, Referer headers. Custom tokens are short-lived but still sensitive. |
| 1.2 | Low | [auth/callback/page.tsx:92-109](../app/admin/auth/callback/page.tsx) | `decodeJwtPayload` extracts `siteId` claim without verifying signature, then constructs relay URL. Crafted slug could phish via the relay UI. Mitigated because `signInWithCustomToken` will fail at target. |
| 1.3 | Low | [admin-auth.ts:127](../lib/admin-auth.ts) | `console.log("[getUserSites] Returning sites:", sites)` leaks site list (siteId/slug/role) to browser devtools in production. |
| 1.4 | Low | [admin-auth.ts:80-104](../lib/admin-auth.ts) | Nested duplicate try/catch wrapping the same `getDoc`. Dead code from a partial refactor. |

### Fixes

```typescript
// 1.1 — remove query fallback in auth/callback/page.tsx
const token = fragmentToken; // no `|| searchParams.get('token')`

// 1.2 — validate slug before relay
const SAFE_SLUG = /^[a-z0-9-]{2,64}$/;
if (siteId && SAFE_SLUG.test(siteId)) {
    // ...build relay URL
} else {
    setError('Invalid token claims');
    return;
}

// 1.3 — remove console.log
// 1.4 — collapse to single try/catch
```

---

## 2. RBAC Model

### Current State

**Two parallel layers:**

| Layer | File | Purpose | Used For |
|---|---|---|---|
| System roles | [lib/rbac.ts](../lib/rbac.ts) | Coarse role→permission map | `manage_site`, `manage_users` checks |
| Module access | [lib/user-context.tsx](../lib/user-context.tsx) | Granular `moduleAccess[moduleId][routeId]` | Per-route view/full/none distinctions |

**Resolution order in `getAccessLevel`:**
1. `loading` guard → `'none'`
2. `isOwner` override → `'full'`
3. `moduleAccess[moduleId][routeId]` (granular, **final** if module key exists)
4. Alias fallback (`pos` ↔ `byod_pos`)
5. Legacy `permissions[]` array (`'*'` or module name)

The Firestore rules **mirror this logic** server-side via `hasWritePermission(siteId, moduleId, routeId)` in [firestore.rules:66-85](../firestore.rules) — this is the actual authorization gate.

### Issues

| ID | Severity | File | Issue |
|---|---|---|---|
| 2.1 | Cleanup | [user-context.tsx:58](../lib/user-context.tsx) | Dead variable `let targetModuleId = moduleId` — assigned, never read. |
| 2.2 | Medium | [user-context.tsx:143-169](../lib/user-context.tsx) | Pure-owner detection (no `members` doc, only matched by `ownerId`/`ownerEmail`) is a one-time `getDoc`, not realtime. Ownership transfers don't propagate until refresh. |
| 2.3 | Medium | Team admin UI | `moduleAccess[m] = {}` (empty object) silently locks user out — documented in skill but not surfaced in the team-permissions UI. |
| 2.4 | Medium | [PermissionGuard.tsx](../components/admin/PermissionGuard.tsx) | Only blocks rendering — exposes `isViewOnly` via context but most consumers don't read it. UX regression: viewer sees an edit button, clicks it, gets `permission-denied`. (Server-side rules catch this, so not a security hole.) |
| 2.5 | Medium | Multiple panels | Inconsistent guard pattern: [LinksPanel:126-127](../components/admin/blocks/panels/LinksPanel.tsx) uses `canEdit('content', 'links')` correctly; [ServiceCatalogClient:543](../app/admin/(dashboard)/services/ServiceCatalogClient.tsx) uses raw `isOwner` (excludes editor/staff); [BrandingPanel](../components/admin/blocks/panels/BrandingPanel.tsx), [ProductsPanel](../components/admin/blocks/panels/ProductsPanel.tsx), [FormsPanel](../components/admin/blocks/panels/FormsPanel.tsx), [PageStudioContext](../components/admin/blocks/PageStudioContext.tsx), [WASettings](../components/admin/whatsapp/WASettings.tsx), [WAInbox](../components/admin/whatsapp/WAInbox.tsx) — no client-side check at all. |
| 2.6 | Cleanup | [rbac.ts](../lib/rbac.ts) | `editor` and `viewer` roles are in the `Role` type and `PERMISSIONS` map but unused — no UI assigns them, no code path reaches them. Confuses readers. |

---

## 3. Server/Client Boundary

### Current State

`firebase-admin` is correctly server-only. The client SDK (`@/lib/firebase`) is correctly client-only — **except for two routes that mix them**.

### Issues

| ID | Severity | File | Issue |
|---|---|---|---|
| 3.1 | Medium | [forms/submit/route.ts:1-2](../app/api/forms/submit/route.ts) | API route imports `db` from `@/lib/firebase` (client SDK) and uses it server-side. Bundles client SDK into server bundle; runs anonymously and is subject to Firestore rules from a server context. Works only because the `inbox` rule allows `create: if true`. |
| 3.2 | Medium | [analytics/track/route.ts:2-3](../app/api/analytics/track/route.ts) | Same pattern. Has error-handling code (L78-85) that *expects* `permission-denied` errors and silently swallows them — strong signal this should be `adminDb`. |
| 3.3 | Low | [admin/seed-templates/route.ts:5](../app/api/admin/seed-templates/route.ts) | Imports `Timestamp` from `firebase/firestore` (client SDK) inside a server route. Should use `Timestamp` from `firebase-admin/firestore`. |

### Fix

Switch all three to `adminDb` / admin Timestamp. Keep the `inbox/create: if true` rule in Firestore (still needed if direct-from-browser submissions are ever introduced).

---

## 4. Multi-Tenancy / siteId Isolation

### Current State

- Middleware sets `x-site-id` header from `__session` cookie or subdomain — **trusted source**
- Firestore rules scope all writes to `sites/{siteId}/...` paths and require `isValidUser(siteId)` checks
- `useSite()` is used consistently in client components
- `isPending` correctly treats `''`, `'pending'`, and `'default'` as not-yet-resolved

### Issues

**4.1 — `siteId` accepted from request body (cross-tenant write vector)** — High

These routes read `siteId` from the request body or URL params instead of the trusted `x-site-id` header:

| Route | Source |
|---|---|
| [auth/check-access](../app/api/auth/check-access/route.ts) | body |
| [forms/submit](../app/api/forms/submit/route.ts) | body |
| [forms/create](../app/api/forms/create/route.ts) | body |
| [forms/update](../app/api/forms/update/route.ts) | body |
| [forms/delete](../app/api/forms/delete/route.ts) | query param |
| [forms/route.ts (GET)](../app/api/forms/route.ts) | query param |
| [submissions/update](../app/api/submissions/update/route.ts) | body |
| [admin/whatsapp/connect](../app/api/admin/whatsapp/connect/route.ts) | body |
| [admin/whatsapp/disconnect](../app/api/admin/whatsapp/disconnect/route.ts) | body |
| [admin/whatsapp/send](../app/api/admin/whatsapp/send/route.ts) | body |
| [admin/whatsapp/test](../app/api/admin/whatsapp/test/route.ts) | body |

**Threat:** An authenticated user of site A who sends `siteId: "siteB"` in the body writes to site B's data — these routes use `adminDb`, which **bypasses Firestore rules entirely**.

**Fix:** Source `siteId` from `req.headers.get('x-site-id')`. If body also carries one, assert equality.

**4.2 — `analytics/track`** — Low. Body siteId is acceptable here because the rule `match /analytics_shards` constrains writes to specific fields.

---

## 5. Security Gaps

### Severity-rated findings

| Severity | Route / File | Issue | Mitigated by Rules? |
|---|---|---|---|
| 🔴 Critical | [admin/whatsapp/send](../app/api/admin/whatsapp/send/route.ts) | No auth + siteId from body. Anyone can send WhatsApp messages from any tenant's connected number, exhausting Meta quota and impersonating the business. | **No** — `adminDb` bypasses rules |
| 🔴 Critical | [admin/whatsapp/connect](../app/api/admin/whatsapp/connect/route.ts) | No auth. Anyone can overwrite tenant's WA config (encrypted token store). | **No** |
| 🔴 Critical | [admin/whatsapp/disconnect](../app/api/admin/whatsapp/disconnect/route.ts) | No auth. DoS — disconnect any tenant's WhatsApp. | **No** |
| 🔴 Critical | [admin/whatsapp/test](../app/api/admin/whatsapp/test/route.ts) | No auth. Reads/decrypts WA config and exposes status. Information disclosure. | **No** |
| 🔴 Critical | [auth/check-access](../app/api/auth/check-access/route.ts) | No verification that caller's UID matches body `uid`. Caller supplies own uid+email+siteId; route promotes them to active member. Invitation self-promotion attack. | **No** |
| 🔴 Critical | [admin/knowledge/sync](../app/api/admin/knowledge/sync/route.ts) | No auth + **SSRF** (server fetches arbitrary URLs from request body). Attacker hits `http://169.254.169.254/...` (GCP metadata server) → service-account credential exfiltration. | **No** |
| 🔴 Critical | [admin/modules/ai-sales-agent/config](../app/api/admin/modules/ai-sales-agent/config/route.ts) | **Auth code commented out**, labeled "TEMPORARY BYPASS for MVP" (L34-50). Anyone can write the global Gemini API key at `modules/ai-sales-agent/private/config`. | **No** |
| 🟠 High | [submissions/update](../app/api/submissions/update/route.ts) | Auth block commented out. Cross-tenant inbox tampering. | **No** |
| 🟠 High | [forms/{create,update,delete}](../app/api/forms/) | Auth blocks commented out. Cross-tenant CRUD on forms. | **No** |
| 🟠 High | [upload/{image,avatar}](../app/api/upload/) | No auth. `siteId` from header (untrusted from middleware perspective when cookie is forged?). Storage flood / malicious content hosting. | Partial — `adminStorage` bypasses storage rules |
| 🟠 High | [admin/seed-templates](../app/api/admin/seed-templates/route.ts) | GET with no auth. Anyone can trigger reseed of system templates. | **No** |
| 🟠 High | [storage.rules:17-19](../storage.rules) | `match /sites/{siteId}/{allPaths=**} { allow write: if isAuthenticated(); }` — **any authenticated user can write to any tenant's Storage path**. No ownership check. | n/a |
| 🟠 High | [firestore.rules:46-51](../firestore.rules) | `hasRole(siteId, allowedRoles)` calls `get(.../members/{uid})` without `exists()` check. Pure owners (no `members` doc) cannot write via Firestore client SDK because the rule throws. Inconsistent with `hasWritePermission` which checks owner first. |
| 🟡 Medium | All admin routes accepting body siteId | After auth is added, must validate authenticated user belongs to supplied `siteId`. | **No** |
| 🟢 Low | [admin-auth.ts:127](../lib/admin-auth.ts) | Site list leaked to browser console. | n/a |
| 🟢 Low | [user-context.tsx:58](../lib/user-context.tsx) | Dead variable cleanup. | n/a |

### SSRF detail (knowledge/sync)

[admin/knowledge/sync/route.ts:29-38](../app/api/admin/knowledge/sync/route.ts) loops over `urlsString.split('\n')` and calls `fetch(url)` with no allowlist, no blocklist, no auth. Attack flow:

```
POST /api/admin/knowledge/sync
Content-Type: multipart/form-data
urls: http://169.254.169.254/computeMetadata/v1/instance/service-accounts/default/token
```

The route fetches the URL, scrapes content with cheerio, and **stores it in Firestore at `sites/{siteId}/modules/ai-sales-agent`**. The attacker then reads it back via `/api/ai-sales-agent/chat` (which serves `knowledgeBaseContent` to the model) or directly via Firestore.

### Firestore rule logic bug detail

```
function hasRole(siteId, allowedRoles) {
  return isGlobalAdmin() || (
    get(/databases/$(database)/documents/sites/$(siteId)/members/$(request.auth.uid)).data.role in allowedRoles
  );
}
```

If the member doc doesn't exist (pure owner case), `get(...)` throws and the rule denies. Line 135 (`/members/{memberId}` create/update) calls `hasRole(siteId, ['owner'])`, so a pure owner without a `members` doc cannot add team members via the Firestore client SDK. Only the `team/add` API path works (because it uses `isSiteOwner` check via site doc `ownerId`).

**Fix:**
```
function hasRole(siteId, allowedRoles) {
  return isGlobalAdmin() || isSiteOwner(siteId) || (
    exists(/databases/$(database)/documents/sites/$(siteId)/members/$(request.auth.uid)) &&
    get(/databases/$(database)/documents/sites/$(siteId)/members/$(request.auth.uid)).data.role in allowedRoles
  );
}
```

---

## Priority Fix List

### P0 — fix today (auth bypass on writes)

1. Add `verifyIdToken` + member check to:
   - `whatsapp/{connect,disconnect,send,test}`
   - `auth/check-access`
   - `admin/knowledge/{sync,verify}`
   - `upload/{image,avatar}`
   - `submissions/update`
   - `forms/{create,update,delete}`
   - `admin/seed-templates`
   - `admin/modules/ai-sales-agent/config` (remove "TEMPORARY BYPASS")
2. In `auth/check-access`: assert `decodedToken.uid === body.uid && decodedToken.email === body.email`
3. In every admin API route: source `siteId` from `x-site-id` header. If body provides one, require equality
4. Validate `siteId` membership in every route: caller must be in `sites/{siteId}/members/{uid}` or be the owner
5. SSRF block in `knowledge/sync`: reject RFC1918, `169.254.0.0/16`, `127.0.0.0/8`, `localhost`, and `metadata.google.internal`

### P1 — same week

6. Tighten `storage.rules` — require site membership for tenant uploads
7. Fix `firestore.rules` `hasRole` to handle missing member doc (pure owners)
8. Switch `forms/submit` and `analytics/track` from client SDK to `adminDb`
9. Standardize `canEdit()` checks in canvas studio panels (Branding, Products, Forms, PageStudio, WASettings, WAInbox)

### P2 — cleanup

10. Remove `?token=` query fallback in callback
11. Validate slug pattern in `decodeJwtPayload` relay
12. Remove production `console.log` in `getUserSites`
13. Remove dead `targetModuleId` variable
14. Remove unused `editor`/`viewer` roles from `rbac.ts` or actually use them
15. Make pure-owner detection realtime via `onSnapshot` on the site doc
16. Surface "empty `moduleAccess[m]` = locked out" warning in team admin UI

---

## Reference: shared auth helper

To reduce duplication and prevent future "commented-out auth block" regressions, factor the auth verification + tenant membership check into a single helper:

```typescript
// lib/api-auth.ts
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { NextRequest, NextResponse } from 'next/server';

export interface AuthedSession {
    uid: string;
    email: string;
    siteId: string;
    role: 'owner' | 'editor' | 'viewer' | 'staff';
    isOwner: boolean;
}

export async function requireAuthedMember(req: NextRequest): Promise<
    { ok: true; session: AuthedSession } | { ok: false; res: NextResponse }
> {
    const headerSiteId = req.headers.get('x-site-id');
    if (!headerSiteId) {
        return { ok: false, res: NextResponse.json({ error: 'Missing x-site-id' }, { status: 400 }) };
    }

    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        return { ok: false, res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    }

    let decoded;
    try {
        decoded = await adminAuth.verifyIdToken(authHeader.split('Bearer ')[1]);
    } catch {
        return { ok: false, res: NextResponse.json({ error: 'Invalid token' }, { status: 401 }) };
    }

    // Owner check
    const siteDoc = await adminDb.collection('sites').doc(headerSiteId).get();
    if (!siteDoc.exists) {
        return { ok: false, res: NextResponse.json({ error: 'Site not found' }, { status: 404 }) };
    }
    const siteData = siteDoc.data()!;
    const isOwner =
        siteData.ownerId === decoded.uid || siteData.ownerEmail === decoded.email;

    if (isOwner) {
        return {
            ok: true,
            session: {
                uid: decoded.uid,
                email: decoded.email!,
                siteId: headerSiteId,
                role: 'owner',
                isOwner: true,
            },
        };
    }

    // Member check
    const memberDoc = await adminDb
        .collection('sites').doc(headerSiteId)
        .collection('members').doc(decoded.uid)
        .get();

    if (!memberDoc.exists || memberDoc.data()?.status !== 'active') {
        return { ok: false, res: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
    }

    return {
        ok: true,
        session: {
            uid: decoded.uid,
            email: decoded.email!,
            siteId: headerSiteId,
            role: memberDoc.data()!.role,
            isOwner: false,
        },
    };
}
```

Usage in every admin route:

```typescript
const auth = await requireAuthedMember(req);
if (!auth.ok) return auth.res;
const { siteId, uid, isOwner } = auth.session;
// ...proceed
```

---

## Appendix: files reviewed

**Core:**
- [lib/user-context.tsx](../lib/user-context.tsx)
- [lib/site-context.tsx](../lib/site-context.tsx)
- [lib/rbac.ts](../lib/rbac.ts)
- [lib/admin-auth.ts](../lib/admin-auth.ts)
- [middleware.ts](../middleware.ts)
- [components/admin/AdminGuard.tsx](../components/admin/AdminGuard.tsx)
- [components/admin/PermissionGuard.tsx](../components/admin/PermissionGuard.tsx)
- [app/admin/(dashboard)/layout.tsx](../app/admin/(dashboard)/layout.tsx)
- [app/admin/auth/callback/page.tsx](../app/admin/auth/callback/page.tsx)
- [firestore.rules](../firestore.rules)
- [storage.rules](../storage.rules)

**API routes (all 35):** every file under `app/api/**/route.ts`.

**Client components (sampled for canEdit usage):** all files under `components/admin/blocks/panels/`, `components/admin/whatsapp/`, and `app/admin/(dashboard)/`.
