# Admin Path-Based Tenant — Design Spec

**Date:** 2026-05-26
**Branch:** dev
**Author:** brainstorm session with Claude
**Status:** approved (pending user review)

## Goal

Remove the cookie-based tenant carrier from admin routes by moving the
active `siteId` into the URL path (`/admin/{tenant}/...`). The `__session`
cookie name is reserved for the Firebase Auth session JWT only, eliminating
the conflict that breaks the digital-goods buyer login flow whenever a
stale admin `__session=<siteId>` cookie shadows the buyer JWT.

## Motivation

Firebase Hosting only forwards a single cookie name (`__session`) to the
Cloud Functions backend. The admin code currently overloads that cookie to
carry the active `siteId` (e.g. `__session=mrb`), while the digital-goods
buyer flow writes the Firebase Auth session JWT to the same cookie name.

Symptom in production today: a user who has previously visited any admin
tenant still has `__session=mrb` (host-only, `Path=/`, 30-day expiry) in
their browser. When the same user later goes through the buyer login flow,
the JWT cookie set by `/api/digital-goods/buyer/init` is shadowed by the
stale 3-character `mrb` value on the next request to `/store/.../checkout`,
`verifySessionCookie` rejects it as "not a valid JWT", and the user is
redirected back to the login form — an infinite loop.

This is a structural conflict, not a one-off bug: any second consumer of
`__session` will collide with the admin carrier the same way.

## Non-goals

- Database migration. `siteId` values and Firestore structure stay the same.
- Renaming any tenant or modifying the Firebase Auth user model.
- Refactoring the buyer flow (digital_goods/membership). It already uses
  `__session` correctly for the Firebase Auth JWT — only the admin side is
  changing.
- Backyard superadmin. Backyard runs on a separate hosting target
  (`stg-clicker-backyard.web.app`) with its own cookie scope and does not
  share `__session` with the core hosting target.
- Subdomain-based tenant routing as the primary mechanism. Custom domain
  tenants (e.g. `go.clicker.id`) keep their pretty URL via the existing
  Cloudflare Worker masking; the worker is updated to inject the tenant
  segment when forwarding to the origin.

## Architecture

```
Before (today)                                After (this spec)
──────────────────                            ──────────────────────────
URL:    clicker.id/admin/dashboard            URL: clicker.id/admin/mrb/dashboard
                                                    (or pretty:
                                                       go.clicker.id/admin/dashboard,
                                                     CF Worker rewrites to
                                                       /admin/go/dashboard at origin)

proxy.ts: reads cookie __session=mrb          proxy.ts: reads path segments[1]=mrb
          (overloaded)                                  (single source of truth)

TokenBootstrap: document.cookie =             TokenBootstrap: signInWithCustomToken only.
                __session=mrb                                  Tenant is in the URL the
                                                                gateway redirected to.

__session cookie holds: siteId string         __session cookie holds: Firebase Auth JWT
                        (admin)               OR is empty (admin doesn't touch it)
                        OR JWT
                        (digital_goods)
                        ⇒ COLLISION                 (no collision)
```

Three layers change:

1. **Middleware (`proxy.ts`)** — stops reading the `__session` cookie to
   determine `siteId`. Parses the URL path for admin routes.
2. **App router structure** — admin pages live under
   `app/admin/(dashboard)/[tenant]/...`. Every admin page receives `tenant`
   as a route param.
3. **Auth handoff (gateway + TokenBootstrap)** — gateway resolves the
   user's site(s), redirects to `/admin/{site}/dashboard#token=...`.
   TokenBootstrap consumes the token client-side and no longer writes
   `__session`.

## Components

### Middleware — `proxy.ts`

Today (excerpt from `proxy.ts`):

```ts
if (segments[0] === 'admin') {
  const activeSite = request.cookies.get('__session')?.value;
  if (activeSite) siteId = activeSite;
  // ...build redirect via gateway if missing
}
```

New behavior:

```ts
if (segments[0] === 'admin') {
  // /admin/{tenant}/...
  const tenantFromPath = segments[1];
  if (tenantFromPath && isLikelySiteId(tenantFromPath)) {
    siteId = tenantFromPath;
  } else {
    // /admin without tenant → bounce to gateway to resolve siteId
    return redirectToGateway(request, '/admin');
  }
  requestHeaders.set('x-site-id', siteId);
  // No cookie reads. No backwards-compat shim.
}
```

`isLikelySiteId(s)` rejects reserved path segments (`login`, `select-site`,
`logout`, etc.) so they pass through to their pages instead of being
treated as a tenant id.

### App router — `app/admin/(dashboard)/[tenant]/...`

Restructure existing admin pages so every dashboard page sits below a new
`[tenant]` dynamic segment. The `(dashboard)` route group keeps the
shared layout (sidebar, top bar, guard) above it.

Page signatures change from:

```ts
export default async function Page({ params }: { params: Promise<{...}> }) {
  // siteId came from useSite() context that read the cookie
}
```

to:

```ts
export default async function Page({
  params,
}: { params: Promise<{ tenant: string; /* page-specific params */ }> }) {
  const { tenant } = await params;
  // siteId === tenant; no context needed for SSR
}
```

Layout file at `app/admin/(dashboard)/[tenant]/layout.tsx` reads
`params.tenant` once and passes it down via `<SiteProvider siteId={tenant}>`
for client components that still call `useSite()`.

### Auth gateway — `auth-gateway/`

`getUserSites()` already returns the user's accessible sites. The handoff
URL builder changes:

```ts
// Before:
const handoffUrl = `${platformUrl}/admin#token=${token}&siteId=${siteId}`;

// After:
const handoffUrl = `${platformUrl}/admin/${siteId}/dashboard#token=${token}`;
// (siteId in URL fragment dropped — redundant with the path)
```

If the user has multiple sites, gateway shows the existing picker and
includes the chosen `siteId` in the redirect path.

### Platform — `TokenBootstrap.tsx`

```diff
- document.cookie = `__session=${siteId}; path=/; max-age=...`;
  await signInWithCustomToken(auth, customToken);
+ // No cookie write. Tenant is already in the URL the user landed on.
```

`AdminGuard` reads `siteId` from `useParams()` (Next.js client hook), not
from cookies.

### Admin pages — sidebar / topbar / tenant switcher

- `AdminSidebar`: link generation uses `/admin/${siteId}/{path}` prefix.
- `AdminTopBar`: tenant switcher does `router.push('/admin/${newTenant}/${suffix}')`.
  No more `document.cookie = __session=newTenant`.
- Logout: `document.cookie = __session=; max-age=0` stays only as a
  defensive cleanup of any residual cookie from before the migration.

### Cloudflare Worker (production custom domains)

Pretty URLs like `go.clicker.id/admin/dashboard` must be rewritten to
`/admin/go/dashboard` before reaching the origin. Two equivalent ways:

1. **Worker rewrites path** when forwarding (`origin.fetch(rewritten)`).
2. **Worker forwards as-is, origin middleware detects host** — if
   `Host: go.clicker.id`, `siteId = 'go'`, and the path is treated as
   `/admin/dashboard` without an explicit tenant segment.

Choice for this spec: **option 1 (worker rewrites path)** so the origin
has one consistent rule (siteId always from path). Staging has no worker
and is path-only.

## Data flow

### First-time admin login (no active session)

```
1. User → clicker.id/admin
2. proxy.ts: segments=['admin'], no tenant → redirect to gateway
3. gateway login form → user enters email+password
4. gateway: getUserSites(uid, email) → e.g. [{siteId:'mrb', ...}]
5. gateway: createCustomToken(uid)
6. gateway → 302 to clicker.id/admin/mrb/dashboard#token=xxx
7. /admin/mrb/dashboard layout renders TokenBootstrap
8. TokenBootstrap: signInWithCustomToken(token), clear URL fragment
9. AdminGuard reads params.tenant = 'mrb' → renders dashboard
10. Subsequent server requests carry __session JWT (set later by buyer
    flow OR via separate /api/admin/init route if we ever need server-side
    cookie for admin — out of scope for this spec)
```

### Existing user, bookmark on old URL

```
1. User → clicker.id/admin/dashboard (old bookmark)
2. proxy.ts: segments=['admin','dashboard']
   - 'dashboard' is in RESERVED_NON_TENANT_SEGMENTS
   - → treat as no-tenant → redirect to gateway with next=/admin/dashboard
3. gateway resolves siteId, redirects to /admin/{siteId}/dashboard
4. Same as first-time flow from step 7
```

### Tenant switcher in AdminTopBar

```
1. User on /admin/mrb/orders selects "Switch to Go"
2. AdminTopBar: router.push('/admin/go/orders')
3. Next.js client-side navigation, params change, useSite() updates
4. Pages re-render with siteId='go'
```

### Buyer flow (unaffected, included for completeness)

```
1. User → /go/store/login
2. /api/digital-goods/auth/request → Resend email
3. User clicks magic link → /go/store/login/verify?token=...
4. VerifyClient: POST /auth/verify → custom token →
   signInWithCustomToken → form POST /buyer/init
5. /buyer/init: createSessionCookie, set Set-Cookie: __session=<JWT>
   ← no collision now, admin doesn't set __session anymore
6. 302 → /go/store/.../checkout → __session JWT verified → render
```

### Database

No schema changes. `sites/{siteId}` and all subcollections are untouched.
`siteId` values stay identical (e.g. `mrb`, `go`, `aletraid`).

## Backwards compatibility

Three legacy artifacts to consider:

1. **Old bookmark URLs** (`/admin/dashboard`) — middleware bounces them
   through the gateway, which redirects to the new path. Transparent for
   the user (one extra hop on first visit only).

2. **Residual `__session=<siteId>` cookies** in user browsers from before
   the migration — proxy.ts no longer reads them, so they're harmless.
   They auto-expire 30 days after the user's last admin visit, or get
   overwritten the next time the buyer flow writes a JWT.

3. **In-flight sessions during deploy** — user has admin page open while
   we deploy. After deploy, navigating in the SPA may hit a route that no
   longer exists at the cookie-derived path. Next.js gives a 404 → user
   refreshes → middleware bounces to gateway → re-login picks up where
   they left off (Firebase Auth IndexedDB persists, no password prompt).
   ~5 second disruption, acceptable for an admin tool.

No feature flag is needed: the cookie is simply ignored as soon as the
new middleware ships, and the new app router structure forces the new
URL shape. The only thing that has to ship together (atomically) is the
gateway redirect URL change so that newly-issued handoff URLs target the
new path.

## Error handling

| Source | Condition | Behavior |
|---|---|---|
| `proxy.ts` | URL `/admin/{tenant}/...` but tenant in reserved list | Treat as no-tenant, redirect to gateway |
| `proxy.ts` | URL `/admin/{tenant}/...` with valid-looking tenant | Forward with `x-site-id`; tenant existence verified downstream |
| `AdminGuard` | User has no membership in the tenant from the URL | Redirect to `/admin/{firstSiteOfUser}/dashboard` |
| `AdminGuard` | User has zero sites | Render "No site access" message; logout button |
| Gateway | User has zero sites | Existing "no-site" page (unchanged) |
| Gateway | User has multiple sites | Existing picker (unchanged) |
| CF Worker | Subdomain doesn't match any tenant doc | Fall through to default origin → 404 from Next.js |
| TokenBootstrap | `signInWithCustomToken` fails (expired/invalid) | Logout, redirect to gateway |

## Testing strategy

**Manual smoke tests** (pre-deploy):

1. Fresh browser → clicker.id/admin → gateway login → land on
   `/admin/{site}/dashboard` → URL shape correct, dashboard renders.
2. Multi-site user → gateway picker → choose tenant B → land on
   `/admin/B/dashboard`.
3. Tenant switcher in AdminTopBar → `/admin/B/orders` → switch to A →
   `/admin/A/orders` → page re-renders with A's data.
4. Old URL `/admin/dashboard` (bookmark) → redirected to
   `/admin/{site}/dashboard`.
5. Buyer login flow on a browser that has `__session=mrb` set (planted
   manually via DevTools) → buyer login succeeds, JWT replaces the
   carrier value, checkout renders.
6. Logout from admin → cookie cleanup → re-login goes through gateway
   fresh.
7. Custom domain (prod only): `go.clicker.id/admin/dashboard` →
   worker rewrites → origin sees `/admin/go/dashboard` → renders.

**Automated** (lightweight):

- Unit test `isLikelySiteId` (reject reserved words, accept tenant slugs).
- Unit test middleware `proxy.ts` siteId resolution: extract from path,
  not cookie.
- Snapshot test handoff URL generation in `auth-gateway`.

## Migration plan

### Pre-flight

- Audit every `app/admin/(dashboard)/**/page.tsx` route and list which
  files need `[tenant]` insertion (~50-80 files).
- Verify CF Worker access for the prod update.
- Communicate with team: short admin disruption during deploy.

### Implementation order

1. Spec (this doc) + commit.
2. Implementation plan in `docs/superpowers/plans/`.
3. Refactor in feature branch (or directly on `dev` since we already use
   dev as the staging branch):
   - Middleware (`proxy.ts`) path parsing.
   - Move admin pages under `[tenant]` segment (mechanical rename).
   - Update `TokenBootstrap`, `AdminGuard`, `AdminSidebar`, `AdminTopBar`,
     `lib/site-context.tsx`.
   - Update `auth-gateway` handoff URL.
   - Update backyard handoff URL (if any).
4. Local `pnpm build` until green.
5. Deploy `dev` → staging → smoke test full admin flow.
6. Update CF Worker for prod → deploy worker → smoke test prod.
7. Merge `dev` → `main` → prod hosting deploy.
8. Communicate completion; existing cookies expire naturally over the
   next 30 days.

### Rollback

- Code: `git revert` the merge commit. Re-deploy.
- CF Worker: keep the old worker version in a separate Cloudflare deploy;
  one-click revert.
- Data: nothing to roll back — no schema or data changes.
- Cookies: nothing to clean up; legacy cookies were already harmless under
  both old and new middleware.

### Estimated effort

- Spec + plan: ~30 min.
- Implementation: ~3-4 hours of focused work (most of it mechanical
  file moves + signature changes).
- Manual QA: ~1 hour.
- Deploy + worker update + verification: ~1 hour.
- **Total: half a day to a full working day.**

## Open questions

None at this point. The user has aligned on:

- Path-based tenant in admin URLs.
- Gateway as the single entry point for resolving siteId.
- CF Worker continues to mask pretty URLs in production.
- No feature flag; ship atomically.
- Backyard out of scope.
