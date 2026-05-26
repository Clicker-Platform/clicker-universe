# Resend Magic Link — Design Spec

**Date:** 2026-05-26
**Branch:** dev
**Author:** brainstorm session with Claude
**Status:** approved (pending user review)

## Goal

Replace Firebase Auth `sendSignInLinkToEmail` with a custom magic link mechanism delivered via Resend. Apply across all modules that use passwordless email sign-in (`digital_goods`, `membership`), via a shared `lib/auth/magic-link/` utility.

## Motivation

Firebase native magic link email is hardcoded to project ID (`Sign in to clicker-universe-stagging…`) and cannot be customized in language, tone, or branding. The `%APP_NAME%` placeholder doesn't apply to the magic link sign-in template. Buyer-facing emails should be branded "Clicker" in Bahasa Indonesia, not Firebase-generated English with the staging project ID exposed.

## Non-goals

- Replacing Firebase Auth as the identity provider. Firebase Auth users are still the canonical identity (UID, custom token, session cookie).
- Replacing the auth-gateway flow (`email-verification`, `password-reset`) — those serve a different purpose and stay on the existing Resend templates.
- Migrating existing buyer records. Existing Firebase Auth users are reused via `getUserByEmail` fallback.
- Building a session/cookie layer from scratch. The existing `/api/{module}/buyer/init` route mints the session cookie and stays unchanged.
- IP-based rate limiting (per-email only in this iteration; IP defer if abuse is observed).
- Scheduled cleanup of expired `signInTokens` docs (defer to ops task).

## Architecture

```
┌──────────────┐    POST /api/{module}/auth/request    ┌──────────────────────┐
│  LoginClient │ ────────────────────────────────────▶│ requestMagicLink()   │
│  (Browser)   │  {email, next}                         │ - rate limit check   │
└──────────────┘                                        │ - gen 32-char token  │
                                                        │ - save Firestore     │
                                                        │ - send Resend email  │
                                                        └──────────┬───────────┘
                                                                   │ email
                                                                   ▼
                                                        ┌──────────────────────┐
                                                        │  Buyer's Gmail       │
                                                        │  link: /{tenant}/.../│
                                                        │  verify?token=XXX    │
                                                        └──────────┬───────────┘
                                                                   │ click
                                                                   ▼
┌──────────────┐    POST /api/{module}/auth/verify     ┌──────────────────────┐
│ VerifyClient │ ────────────────────────────────────▶│ verifyMagicLink()    │
│              │  {token}                               │ - lookup Firestore   │
│              │                                        │ - check expired/used │
│              │                                        │ - mark used          │
│              │                                        │ - getOrCreate user   │
│              │                                        │ - mint custom token  │
│              │ ◀────────────────────────────────────│ {customToken, ...}   │
│              │                                        └──────────────────────┘
│              │ signInWithCustomToken(customToken)
│              │ ────────────────────────────────────▶ Firebase Auth (client)
│              │ getIdToken()
│              │ POST /api/{module}/buyer/init {idToken}  ── existing route
│              │ redirect(next)
└──────────────┘
```

Three layers:
1. **Shared library** `lib/auth/magic-link/` — token generation, email send, verify, route factory
2. **Module thin wrappers** — `app/api/{module}/auth/[action]/route.ts` (1-liner re-export from factory)
3. **Existing flow reused** — `/api/{module}/buyer/init`, session cookie, buyer auto-provision

## Components

### `lib/auth/magic-link/`

```
constants.ts       # TTL (15min), rate limit (3/email/15min), Firestore paths
types.ts           # MagicLinkInput, VerifyResult, MagicLinkToken doc shape
tokens.ts          # generateToken(), hashEmail()
rate-limit.ts      # checkAndIncrementEmailLimit(emailHash) — Firestore transaction
send.ts            # requestMagicLink({email, siteId, module, purpose, redirectUrl, tenantName})
verify.ts          # verifyMagicLink({token, siteId, module})
routes.ts          # createMagicLinkRoutes({module, defaultPurpose, getRedirectUrl})
__tests__/         # unit tests per file
```

### `send.ts` — `requestMagicLink`

Signature:
```ts
async function requestMagicLink(input: {
  email: string;
  siteId: string;
  module: string;
  purpose: string;        // e.g. "masuk ke store"
  redirectUrl: string;    // post-login destination (validated by caller)
  tenantName: string;     // for email template variable
}): Promise<void>         // always void (anti-enumeration)
```

Flow:
1. Validate email format (basic regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`)
2. Check rate limit per email — if exceeded, return silently after logging
3. Generate 32-char random token via `crypto.randomBytes(24).toString('base64url')`
4. Save Firestore doc `signInTokens/{token}` = `{email, emailHash, siteId, module, redirectUrl, expiresAt: now+15min, used: false, createdAt: serverTimestamp()}`
5. Build URL: `${baseUrl}/{tenant}/auth/verify?token={token}` where `baseUrl = await resolveTenantBaseUrl(siteId, fallbackHost)`
6. Send via `sendEmail({to: email, siteId, templateAlias: aliases.authMagicLink, variables: {signinUrl, tenantName, purpose, expiresInMinutes: 15}, tags: [{name: 'module', value: module}, {name: 'event', value: 'magic_link'}]})`
7. Log success or send failure; never throw to caller

### `verify.ts` — `verifyMagicLink`

Signature:
```ts
async function verifyMagicLink(input: {
  token: string;
  siteId: string;
  module: string;
}): Promise<{
  customToken: string;
  redirectUrl: string;
  email: string;
}>
```

Flow (single Firestore transaction):
1. Lookup `signInTokens/{token}`
2. If not exists → throw `'invalid_token'`
3. If `used === true` → throw `'used'`
4. If `expiresAt < now` → throw `'expired'`
5. If `siteId mismatch` or `module mismatch` → throw `'mismatch'`
6. Mark `used: true, usedAt: serverTimestamp()` in the same transaction
7. (Outside transaction) `getOrCreateFirebaseUser(email)`:
   - Try `admin.getUserByEmail(email)` → reuse existing UID
   - On not-found → `admin.createUser({email, emailVerified: true})`
8. `admin.createCustomToken(uid)` — TTL 1 hour (Firebase default)
9. Return `{customToken, redirectUrl: data.redirectUrl, email}`

### `routes.ts` — `createMagicLinkRoutes`

Signature:
```ts
export function createMagicLinkRoutes(config: {
  module: string;
  defaultPurpose: string;
  getRedirectUrl: (next: string | null, tenant: string) => string;
}): {
  POST_request: (req: NextRequest, ctx: { params: Promise<{tenant: string}> }) => Promise<Response>;
  POST_verify:  (req: NextRequest, ctx: { params: Promise<{tenant: string}> }) => Promise<Response>;
};
```

`POST_request`:
- Parse `{email, next}` from body
- Resolve tenant from URL params → siteId = tenant
- Resolve tenant name from `sites/{siteId}.name`
- Build redirectUrl via `config.getRedirectUrl(next, tenant)` — the factory consumer (module wrapper) is responsible for validating `next` (relative-path check, no `//`) inside `getRedirectUrl`. The shared library trusts the returned string.
- Call `requestMagicLink({email, siteId, module, purpose: config.defaultPurpose, redirectUrl, tenantName})`
- Always return `{ok: true}` HTTP 200 (anti-enumeration)

`POST_verify`:
- Parse `{token}` from body
- Resolve tenant from URL → siteId
- Call `verifyMagicLink({token, siteId, module})`
- On success: return `{customToken, redirectUrl, email}` HTTP 200
- On error: return `{error: code}` HTTP 400 (or 500 for unexpected)

### Module wrapper — `app/api/digital-goods/auth/[action]/route.ts`

```ts
import { createMagicLinkRoutes } from '@/lib/auth/magic-link/routes';
import { publicRoutes } from '@/lib/modules/digital_goods/constants';

const { POST_request, POST_verify } = createMagicLinkRoutes({
  module: 'digital_goods',
  defaultPurpose: 'masuk ke store',
  getRedirectUrl: (next, tenant) => {
    if (next?.startsWith('/') && !next.startsWith('//')) return next;
    return publicRoutes(tenant).store;
  },
});

export async function POST(req: NextRequest, ctx: { params: Promise<{tenant: string; action: string}> }) {
  const { action } = await ctx.params;
  if (action === 'request') return POST_request(req, ctx as any);
  if (action === 'verify')  return POST_verify(req, ctx as any);
  return new Response('not found', { status: 404 });
}
```

Same pattern for `app/api/membership/auth/[action]/route.ts` with `module: 'membership'`, different `defaultPurpose`, and `getRedirectUrl` pointing to membership-specific landing.

### Client side

**`LoginClient.tsx`** (digital_goods + membership equivalent):
- Drop `sendSignInLinkToEmail` import
- On submit: `fetch('/api/{module}/auth/request', {method: 'POST', body: JSON.stringify({email, next})})`
- Always navigate to "Cek email Anda" step (no error distinction client-side)
- Persist email in localStorage for verify page to display

**`VerifyClient.tsx`** (digital_goods + membership equivalent):
- Drop `isSignInWithEmailLink` and `signInWithEmailLink` imports
- Read `token` from URL `searchParams.get('token')`
- `fetch('/api/{module}/auth/verify', {method: 'POST', body: JSON.stringify({token})})`
- On success: `signInWithCustomToken(auth, customToken)` → `getIdToken()` → POST to `/api/{module}/buyer/init {idToken}` → `router.replace(redirectUrl)`
- On error: display message keyed by error code with appropriate CTA (link to login, optionally pre-filled email from localStorage)

## Data flow

### Firestore schema

```
signInTokens/{token}                  # token = 32-char base64url (doc ID)
  email: string
  emailHash: string                    # sha256 lowercase email — for rate-limit lookup correlation
  siteId: string
  module: string                       # "digital_goods" | "membership"
  redirectUrl: string
  expiresAt: Timestamp
  used: boolean
  usedAt: Timestamp | null
  createdAt: Timestamp

rateLimits/email/{emailHash}
  count: number
  windowStart: Timestamp               # rolling 15-min window
  updatedAt: Timestamp
```

### Firestore rules

```
match /signInTokens/{tokenId} {
  allow read, write: if false;         # Admin SDK only
}
match /rateLimits/{type}/{key} {
  allow read, write: if false;
}
```

### Rate limit logic

Transaction on `rateLimits/email/{emailHash}`:
```
if no doc OR windowStart < now - 15min:
    set { count: 1, windowStart: now, updatedAt: now }
else if count >= 3:
    throw 'rate_limited' (caller swallows)
else:
    increment count, updatedAt: now
```

Window: 15 minutes rolling per email. Limit: 3 requests per window.

## Error handling

| Source | Error | User-facing | Logged | HTTP |
|---|---|---|---|---|
| `requestMagicLink` invalid email | silent | nothing (always 200) | warn | 200 |
| `requestMagicLink` rate limited | silent | nothing | warn | 200 |
| `requestMagicLink` Resend send fail | silent | nothing | error | 200 |
| `verifyMagicLink` token not found | explicit | "Link tidak valid" | warn | 400 |
| `verifyMagicLink` expired | explicit | "Link expired, kirim ulang" + CTA | warn | 400 |
| `verifyMagicLink` used | explicit | "Link sudah dipakai, kirim ulang" + CTA | warn | 400 |
| `verifyMagicLink` siteId/module mismatch | explicit | "Link tidak valid" | warn | 400 |
| `verifyMagicLink` getOrCreateUser fail | explicit | "Gagal proses login, coba lagi" | error | 500 |
| `signInWithCustomToken` fail (client) | explicit | "Gagal proses login, coba lagi" + retry | console.error | — |
| `buyer/init` fail (client) | explicit | "Gagal init sesi, coba lagi" | error | 500 |

### Edge cases

1. **Double-click link** — first request marks `used: true`, second returns code `used` with CTA to request new link.
2. **Expired token in stale tab** — verify fails with code `expired`, CTA pre-fills email from localStorage and returns to login.
3. **Cross-device click (submit in browser A, click in browser B)** — token is not device-bound, verify succeeds in B. Acceptable.
4. **Typo email** — silent success, email never arrives. UX mitigation: success page text "Kalau dalam 5 menit ga datang, cek typo email atau spam folder. [Coba email lain]".
5. **Rate limit hit on genuine retries** — silent swallow. After 15-min window, user can retry. Confusing UX, but tolerable trade-off for anti-abuse.
6. **Existing Firebase Auth user from old Firebase magic link** — `getUserByEmail` returns existing UID, custom token uses that UID, all Firestore data (`buyers/{uid}`, `library/`) remains accessible. Zero data migration.
7. **Firestore growth of `signInTokens`** — docs persist after `used: true` for audit. Cleanup via scheduled CF (out of scope).
8. **Open redirect prevention** — `getRedirectUrl` in route factory validates `next` starts with `/` and not `//`. Defense at factory level, not in shared lib.

## Email template

**Template alias:** `auth-magic-link` (new in Resend dashboard, manual setup)

**Variables:**
- `signinUrl` — full URL to verify endpoint with token
- `tenantName` — display name from site doc
- `purpose` — context-aware string (e.g. "masuk ke store {{tenantName}}")
- `expiresInMinutes` — `15`

**Suggested copy (Bahasa Indonesia):**

Subject: `Link masuk ke {{tenantName}}`

Body:
```
Halo,

Klik link di bawah untuk {{purpose}}:

[Masuk ke {{tenantName}}]({{signinUrl}})

Link berlaku {{expiresInMinutes}} menit. Jangan share dengan siapapun.

Kalau bukan kamu yang request, abaikan email ini.
```

**Wiring:**
- `lib/email/config.ts` DEFAULTS map: add `authMagicLink: 'auth-magic-link'`
- Backyard panel: add entry `authMagicLink` → `auth-magic-link` for override capability

## Testing strategy

**Unit tests** (`lib/auth/magic-link/__tests__/`):
- `tokens.test.ts` — `generateToken` produces 32-char base64url with sufficient entropy; `hashEmail` deterministic + lowercase-normalized
- `rate-limit.test.ts` — counter increment, window reset on stale window, limit threshold reached throws
- `send.test.ts` — happy path saves token doc + calls sendEmail; rate-limit returns silently; invalid email returns silently
- `verify.test.ts` — happy path returns customToken; expired throws; used throws; mismatch throws; `getOrCreateFirebaseUser` paths (existing user, new user)

Mock strategy: `vi.mock('firebase-admin/firestore')` and `vi.mock('@/lib/email')`. Pattern matches existing `lib/email/__tests__/`.

**Integration tests** — out of scope for first cut.

**Manual smoke test**:
1. Submit login with new email → email arrives → click link → land on redirect → session active
2. Spam same email 4× in 1 minute → 4th request silently rejected (verify via log, no email)
3. Submit, click link, click again → first succeeds, second shows "Link sudah dipakai" CTA
4. Submit, wait 16 minutes, click → "Link expired" CTA
5. Submit nonexistent email → success page, no email arrives
6. Existing buyer (Firebase Auth user from old flow) logs in via new Resend link → library entries still accessible (UID consistent)
7. Submit in digital_goods, manually tamper URL to swap module → verify rejects `mismatch`

## Migration plan

### Pre-flight

- Create `auth-magic-link` template in Resend dashboard
- Update backyard `platform/settings/email/config.templates` add `authMagicLink: 'auth-magic-link'`
- Add `authMagicLink` to `lib/email/config.ts` DEFAULTS map
- Deploy `firestore.rules` update (deny `signInTokens` + `rateLimits` to client)

### Cutover

All-in, no parallel mode. Existing buyers with Firebase Auth users keep their UID via `getUserByEmail` fallback — no data migration needed.

### Implementation order

1. Library — `lib/auth/magic-link/` (constants, types, tokens, rate-limit, send, verify, routes)
2. Unit tests for library
3. Firestore rules deploy
4. `digital_goods` migration:
   - Create `app/api/digital-goods/auth/[action]/route.ts`
   - Rewrite `app/[tenant]/store/login/LoginClient.tsx`
   - Rewrite `app/[tenant]/store/login/verify/VerifyClient.tsx`
   - Manual E2E smoke test
5. `membership` migration:
   - Create `app/api/membership/auth/[action]/route.ts`
   - Rewrite `lib/modules/membership/components/public/LoginPage.tsx`
   - Rewrite `lib/modules/membership/components/public/VerifyPage.tsx`
   - Manual E2E smoke test
6. (Optional) Disable Firebase Auth "Email link (passwordless sign-in)" toggle if no other consumer
7. Commit + push

### Rollback

- Code → revert commits on dev (single PR ideally)
- Firestore rules → revert rules deploy
- Data → non-destructive; `signInTokens` and `rateLimits` are new collections, Firebase Auth users untouched
- Resend template → leave; no harm
- Backyard config → revert entry if needed

### Estimated effort

- Lib + tests: ~3-4 hours
- digital_goods migration + test: ~1.5 hours
- membership migration + test: ~1.5 hours
- Total: ~6-7 hours (1 large session or 2 medium)
