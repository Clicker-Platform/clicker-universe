# Resend Email Foundation — Design Spec

**Date:** 2026-05-02
**Status:** Implemented (ratified 2026-05-09 — see addendum below)
**Scope:** Foundational email transport layer using Resend, usable by all apps in the monorepo (platform, auth-gateway, future Cloud Functions).

---

## Addendum (2026-05-09) — Ratified deviation: Resend-hosted templates

The implementation that landed deliberately diverges from this spec on **decisions #3 and #4**:

- **No React Email.** `sender.ts` calls Resend with `template: { id, variables }` — templates live in the Resend dashboard, not in code.
- **No module-owned templates on disk.** There is no `lib/modules/{name}/emails/` directory and no `EmailLayout` shell or `render.ts`.

**Why ratified:** keeps the foundation simple, lets non-devs edit copy, removes a build-time dependency. Acceptable trade for v1.

**What is forwarded to every Resend template** (set in `sender.ts`): `businessName`, `logoUrl`, `primaryColor`, `siteUrl` from the resolved `EmailContext.brand`, plus all caller-supplied `variables`. Template authors can use these for tenant branding without code changes.

**Templates that must exist in the Resend dashboard:** `form-submission`, `password-reset`, `email-verification`.

**When to revisit React Email:** if a template needs dynamic per-tenant branding the hosted templates can't express, or if version-controlled templates become a hard requirement.

---

## 1. Goals & Non-Goals

### Goals

- Establish a single, typed email transport (`sendEmail()`) used by all apps and modules.
- Send branded, multi-tenant transactional emails (password reset, email verification, form notifications, future module-driven sends) via Resend.
- Provide a foundation that supports future enhancements (retry worker, per-tenant domains, admin email log UI, bulk digest) without reshaping its core API.
- Replace the existing inline `sendFormNotification` in [`lib/email.ts`](../../clicker-platform-v2/lib/email.ts) with the new system, keeping the forms feature working end-to-end.
- Add password reset and email verification flows in `auth-gateway/` that send via Resend with branded templates instead of Firebase's default emails.

### Non-Goals (deliberate, parked for future phases)

- Retry worker or queue for failed sends (schema leaves room).
- Per-tenant verified domains (single shared domain for now — see Section 9).
- Admin UI to view the email audit log.
- Bulk send / batching primitives (e.g. for the planned daily email digest — separate spec).
- Per-tenant template overrides.
- Localization (i18n) of templates.
- Other channels: in-app notifications, push, WhatsApp.

---

## 2. Decisions Summary

| # | Decision                                       | Choice                                                  |
|---|------------------------------------------------|---------------------------------------------------------|
| 1 | Sender domain & branding                       | Single platform domain with per-tenant friendly name    |
| 2 | Where the email module lives                   | `clicker-platform-v2/lib/email/`, copied into auth-gateway |
| 3 | Template system                                | React Email                                             |
| 4 | Module integration model                       | Direct import of `sendEmail`; modules own their templates |
| 5 | Delivery & failure handling                    | Sync send + audit log; retry deferred                   |
| 6 | Tenant context resolution                      | Caller passes `siteId`; transport fetches & caches      |
| 7 | Password reset                                 | Firebase generates link, Resend sends branded email     |
| 8 | Dev safety & config                            | Dev-mode allowlist guard + env-driven sender resolution |

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  Callers                                                    │
│  ─ API routes (e.g. forms/submit)                           │
│  ─ Auth-gateway (password reset, verification)              │
│  ─ Module servers (e.g. POS order confirmation)             │
│  ─ Cloud Functions (future: daily digest)                   │
└──────────────────┬──────────────────────────────────────────┘
                   │ sendEmail({ to, subject, template, siteId, ... })
                   ▼
┌─────────────────────────────────────────────────────────────┐
│  lib/email/  (core transport — single source of truth)      │
│                                                             │
│  ├─ sender.ts     ← sendEmail() entry point                 │
│  ├─ context.ts    ← resolves tenant from siteId (cached)    │
│  ├─ render.ts     ← React Email → HTML + text               │
│  ├─ guard.ts      ← dev allowlist                           │
│  ├─ log.ts        ← writes sites/{siteId}/emailLog/{id}     │
│  ├─ config.ts     ← from address, env detection             │
│  └─ templates/    ← core templates (layout shell + system)  │
│      ├─ EmailLayout.tsx                                     │
│      ├─ components/                                         │
│      └─ system/                                             │
│          ├─ PasswordReset.tsx                               │
│          ├─ EmailVerification.tsx                           │
│          ├─ FormSubmission.tsx                              │
│          └─ SystemAlert.tsx                                 │
└──────────────────┬──────────────────────────────────────────┘
                   │ resend.emails.send()
                   ▼
┌─────────────────────────────────────────────────────────────┐
│  Resend HTTP API                                            │
└─────────────────────────────────────────────────────────────┘
```

Modules own their own templates under `lib/modules/{name}/emails/` (e.g. `lib/modules/byod_pos/emails/OrderConfirmation.tsx`) and call `sendEmail()` from core. Auth-gateway imports a copied version of `lib/email/` until the monorepo grows a shared-packages story.

---

## 4. Public API

### `sendEmail` — single entry point

```ts
// lib/email/sender.ts

import type { ReactElement } from 'react';

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  template: ReactElement;        // React Email component
  siteId: string | null;          // null = system email (no tenant)
  replyTo?: string;               // overrides tenant default
  cc?: string | string[];
  bcc?: string | string[];
  tags?: { name: string; value: string }[];  // for module/template attribution
};

export type SendEmailResult =
  | { ok: true; id: string; logId: string }
  | { ok: false; error: string; logId: string };

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult>;
```

### Behaviors

- **Always returns** — never throws. Callers decide whether a failure is fatal (auth flows) or best-effort (form notifications). Result includes `logId` for later reference.
- **`siteId: null`** is the explicit system path — uses platform default branding.
- **`tags`** flow into both Resend's tagging system and the audit log doc.
- **No `from` parameter** — derived by core from tenant context (Section 6). Future per-tenant verified domains would extend this internally.

### Module-specific senders (typed wrappers)

```ts
// lib/modules/byod_pos/emails/sendOrderConfirmation.ts
export async function sendOrderConfirmation(args: {
  siteId: string;
  to: string;
  order: PosOrder;
}) {
  return sendEmail({
    to: args.to,
    siteId: args.siteId,
    subject: `Order #${args.order.number} confirmed`,
    template: <OrderConfirmation order={args.order} />,
    tags: [
      { name: 'module', value: 'byod_pos' },
      { name: 'template', value: 'order-confirmation' },
    ],
  });
}
```

---

## 5. Tenant Context

```ts
// lib/email/context.ts

export type EmailContext = {
  fromName: string;        // "Acme Coffee" or "Clicker Platform" for system
  fromAddress: string;     // "noreply@clicker.id" (single shared domain)
  replyTo: string | null;  // tenant's contact email, or null
  brand: {
    businessName: string;
    logoUrl: string | null;
    primaryColor: string | null;  // for layout accent
    siteUrl: string;              // "https://acme.clicker.id" — for footer links
  };
};

export async function getEmailContext(siteId: string | null): Promise<EmailContext>;
```

### Resolution

| `siteId`     | Source                                                                 |
|--------------|------------------------------------------------------------------------|
| `null`       | Static system defaults (`Clicker Platform`, brand logo, `clicker.id`)  |
| `<siteId>`   | Read `sites/{siteId}` doc → derive name, logo, colors, URL             |

### Caching

- In-process `Map<siteId, { value, expiresAt }>` with **5-minute TTL**.
- Cache key: `siteId | "__system__"`.
- Per-process; no cross-process invalidation. Acceptable: tenant business-name changes propagate within 5 minutes.
- On Firestore read error (deleted/404 site): fall back to system defaults and log warning at `warn` level. Email still sends.

The full `EmailContext` is passed to React Email templates as a prop on `<EmailLayout>` so templates render with consistent branding without each one knowing how to fetch a site.

---

## 6. Template System (React Email)

### Folder layout

```
clicker-platform-v2/lib/email/templates/
├── EmailLayout.tsx          ← shared shell (header, footer, container)
├── components/              ← reusable building blocks
│   ├── Button.tsx
│   ├── DataTable.tsx
│   └── Heading.tsx
└── system/                  ← core/system emails
    ├── PasswordReset.tsx
    ├── EmailVerification.tsx
    ├── FormSubmission.tsx
    └── SystemAlert.tsx

clicker-platform-v2/lib/modules/{name}/emails/   ← module-owned
├── OrderConfirmation.tsx
└── sendOrderConfirmation.ts
```

### `EmailLayout` contract

```tsx
<EmailLayout context={emailContext} preview="One-line preview shown in inbox">
  {children}
</EmailLayout>
```

Renders:
- **Header** — tenant logo (or platform logo) + business name
- **Body** — `{children}`
- **Footer** — `"Sent by {businessName} via Clicker Platform"` + site URL link
- Uses tenant `primaryColor` as accent (button bg, divider) when present

### Render flow

```ts
// lib/email/render.ts
export async function renderTemplate(
  template: ReactElement,
  context: EmailContext
): Promise<{ html: string; text: string }>;
```

Uses `@react-email/render` to produce both HTML and plaintext fallback automatically. The transport injects `EmailContext` via React context so templates don't need to thread it through props.

### Dev preview tooling

`pnpm email:dev` runs React Email's local preview server, scanning both `lib/email/templates/` and `lib/modules/*/emails/` so designers can view all templates in a browser at `localhost:3001`. Dev-only dependency (`react-email`).

### Dependencies added

| Package                       | Reason                                  | Where                  |
|-------------------------------|-----------------------------------------|------------------------|
| `@react-email/components`     | Tag primitives (Container, Section, …)  | runtime, both apps     |
| `@react-email/render`         | Render JSX → HTML + text                | runtime, both apps     |
| `react-email`                 | Local preview server                    | dev-only, platform     |

---

## 7. Audit Log

Every send writes one document, regardless of outcome.

### Path

- Tenant emails: `sites/{siteId}/emailLog/{autoId}`
- System emails (`siteId: null`): `system/emailLog/{autoId}`

### Schema

```ts
type EmailLogDoc = {
  to: string[];                    // normalized to array
  cc: string[] | null;
  bcc: string[] | null;
  subject: string;
  fromName: string;
  fromAddress: string;
  replyTo: string | null;

  // Attribution
  siteId: string | null;
  tags: { name: string; value: string }[];  // module, template, etc.

  // Status
  status: 'sent' | 'failed';        // foundation: terminal states only
  resendId: string | null;          // Resend's message ID when sent
  error: string | null;             // error message when failed
  errorCode: string | null;         // e.g. 'rate_limit', 'invalid_recipient'

  // Audit
  attemptCount: number;             // always 1 in foundation
  createdAt: Timestamp;
  sentAt: Timestamp | null;
};
```

### Write strategy

1. Generate log doc ID upfront → return to caller in `SendEmailResult.logId`.
2. Call Resend.
3. Single `set()` write with final status (`sent` or `failed`).

One write per send. Trade-off: a process crash mid-Resend-call leaves no trace. Acceptable for foundation; future retry worker can switch to write-then-update if audit completeness becomes critical.

### Future-compatible status field

The `status` field is typed as `'sent' | 'failed'` today. The retry worker (out of scope) will extend the union with `'queued' | 'retrying'` and add a `nextRetryAt` timestamp. No breaking change to existing records.

### Dev allowlist behavior

When dev allowlist blocks a send: log is written with `status: 'sent'`, no Resend call, plus tag `{ name: 'dev_blocked', value: 'true' }`. Dev flows continue normally; failures aren't polluted with dev noise.

---

## 8. Auth Gateway Integration

The auth-gateway gets the email module via Option D from Question 2 — copied into `auth-gateway/lib/email/`. Both copies stay in sync via convention + CI check (Section 11).

### Password reset flow

```
[1] User clicks "Forgot password" on auth-gateway login
[2] auth-gateway: POST /api/password-reset { email }
[3] auth-gateway server:
    a. resolveSiteFromEmail(email) → siteId | null
       (existing logic in get-user-sites.ts: ownerEmail or member doc)
    b. admin.auth().generatePasswordResetLink(email, {
         url: `${gatewayUrl}/reset-callback`,
         handleCodeInApp: false,
       })
    c. sendEmail({
         to: email,
         siteId,
         subject: 'Reset your password',
         template: <PasswordReset link={resetLink} />,
       })
[4] User receives branded email (per Section 5 tenant context)
[5] User clicks link → Firebase reset page → password updated → redirect
```

### Email enumeration safety

The endpoint always returns `{ ok: true }` regardless of whether the email exists in Firebase Auth.

- Email exists → generate link, send.
- Email doesn't exist → no Firestore lookup, no Resend call, no log doc.

User always sees: *"If that email is registered, we sent a reset link."*

### Email verification flow

Same pattern using `admin.auth().generateEmailVerificationLink(email)` and `<EmailVerification>`. Triggered from auth-gateway after signup or via a "resend verification" button.

### New endpoints in auth-gateway

| Method | Path                       | Body          | Auth                          |
|--------|----------------------------|---------------|-------------------------------|
| POST   | `/api/password-reset`      | `{ email }`   | none (rate-limited per IP)    |
| POST   | `/api/email-verification`  | `{ email }`   | the user themselves or admin  |

Both rate-limited per IP (in-memory counter, 5/hour). Future enhancement: promote to Firestore-backed rate limiting if abuse observed.

---

## 9. Configuration & Environment

### Env vars (each app maintains its own)

| Variable                  | Required | Default                              | Notes                                     |
|---------------------------|----------|--------------------------------------|-------------------------------------------|
| `RESEND_API_KEY`          | yes      | —                                    | Resend API key                            |
| `EMAIL_SENDER_DOMAIN`     | no       | `resend.dev` in dev, `clicker.id` in prod | The domain part of the from address       |
| `EMAIL_SENDER_LOCAL_PART` | no       | `noreply`                            | The local part (before `@`)               |
| `EMAIL_SYSTEM_FROM_NAME`  | no       | `Clicker Platform`                   | Used when `siteId` is null                |
| `EMAIL_DEV_ALLOWLIST`     | no       | `@clicker.id,@resend.dev`            | Comma-separated suffixes (dev only)       |
| `EMAIL_PLATFORM_LOGO_URL` | no       | hosted asset URL                     | Logo for system emails                    |
| `EMAIL_PLATFORM_URL`      | no       | `https://clicker.id`                 | Footer link for system emails             |

### Sender resolution at boot

```
NODE_ENV === 'development' && !EMAIL_SENDER_DOMAIN
  → from defaults to "Clicker Platform <onboarding@resend.dev>"
otherwise
  → from is "{businessName | systemFromName} <{localPart}@{senderDomain}>"
```

Zero-config dev: a developer with just `RESEND_API_KEY` set can run the app and email themselves immediately, without DNS verification.

### Dev allowlist guard

```ts
function isAllowedInDev(to: string[]): boolean {
  if (process.env.NODE_ENV === 'production') return true;
  const suffixes = (process.env.EMAIL_DEV_ALLOWLIST ?? '@clicker.id,@resend.dev')
    .split(',').map(s => s.trim().toLowerCase());
  return to.every(addr => suffixes.some(suffix => addr.toLowerCase().endsWith(suffix)));
}
```

Blocked sends: short-circuit (no Resend call), log doc written with `dev_blocked` tag, return `ok: true` so dev flows continue.

### DNS setup checklist (production, one-time)

1. Resend dashboard → Add domain → `clicker.id`
2. Add three DNS records (Resend provides exact values):
   - **SPF**: `TXT @ "v=spf1 include:amazonses.com ~all"` (or merge with existing SPF)
   - **DKIM**: `TXT resend._domainkey "p=..."` (Resend-provided public key)
   - **DMARC**: `TXT _dmarc "v=DMARC1; p=none; rua=mailto:dmarc@clicker.id"` (start `p=none`, tighten to `quarantine` later)
3. Wait for Resend verification (usually <30 min)
4. Set `EMAIL_SENDER_DOMAIN=clicker.id` in production env

### Secret management per environment

| Environment            | Where API key lives                              |
|------------------------|--------------------------------------------------|
| Local dev              | `.env.local` (each app)                          |
| Firebase App Hosting   | Build env config for `clicker-platform-v2`      |
| Auth-gateway           | Its own `.env` / hosting env                     |
| Cloud Functions (future) | `firebase functions:secrets:set RESEND_API_KEY` |

---

## 10. Testing

| Layer              | Strategy                                                                  |
|--------------------|---------------------------------------------------------------------------|
| `render.ts`        | Snapshot tests for each system template; visual review via React Email preview |
| `context.ts`       | Unit test: site doc → context mapping; cache TTL behavior; null fallback  |
| `guard.ts`         | Unit test: allowlist matching, env-aware behavior                         |
| `sender.ts`        | Mock Resend client; assert log doc written with correct status; assert dev-block tag |
| End-to-end         | One smoke test per environment that sends a real email to a known dev address; manual, not in CI |

No mock email server (Mailtrap, Mailpit) in foundation. React Email's preview server covers visual review; unit tests cover transport behavior. Add Mailtrap later if integration coverage gaps emerge.

---

## 11. Code Sync Between Apps

Per Section 3, `lib/email/` is duplicated into `auth-gateway/lib/email/`. To prevent drift:

1. **Source of truth**: `clicker-platform-v2/lib/email/`.
2. **Sync mechanism**: `scripts/sync-email-module.sh` copies the directory to `auth-gateway/lib/email/`. Run manually after changes.
3. **CI check**: GitHub Action runs `diff -r clicker-platform-v2/lib/email auth-gateway/lib/email` and fails if they differ.
4. **Excluded from sync**: module-specific templates under `lib/modules/{name}/emails/` (platform-only). Auth-gateway uses only system templates.

When the monorepo grows a shared-packages story, this directory promotes to `packages/email/` and the script + CI check are removed. The boundary is already clean (no platform-specific imports inside `lib/email/`), so the migration is mechanical.

---

## 12. Migration Plan

Two-step migration to keep form submissions working throughout.

### Step A — Foundation + form notification migration (atomic)

1. Build `lib/email/` foundation (sender, context, render, guard, log, config).
2. Port [`lib/email.ts`](../../clicker-platform-v2/lib/email.ts)'s inline HTML to a React Email template at `lib/email/templates/system/FormSubmission.tsx`.
3. Update [`app/api/forms/submit/route.ts`](../../clicker-platform-v2/app/api/forms/submit/route.ts) to call `sendEmail()` with the new template.
4. Delete old `lib/email.ts` in same commit.

After Step A: platform ships value (form notifications still work, now branded + logged) before auth-gateway work begins.

### Step B — Auth-gateway integration (separate work)

1. Sync `lib/email/` into `auth-gateway/lib/email/` via the sync script.
2. Add `<PasswordReset>` and `<EmailVerification>` templates.
3. Add `POST /api/password-reset` and `POST /api/email-verification` endpoints.
4. Wire forgot-password and signup flows in auth-gateway UI.

Independent timing: Step A is not blocked by Step B.

---

## 13. Out of Scope (Explicit Non-Goals)

These are deliberate parking-lot items. Each has a concrete extension point in the foundation:

| Future feature                            | Extension point in foundation                          |
|-------------------------------------------|--------------------------------------------------------|
| Retry worker for failed sends             | `EmailLogDoc.status` union extends to `'queued'/'retrying'`; `nextRetryAt` field added |
| Per-tenant verified domains               | `getEmailContext()` returns custom `fromAddress` per tenant |
| Admin UI to view email log                | `EmailLogDoc.tags` field allows filtering by module/template |
| Bulk send / batching (daily digest)       | Variant of `sendEmail()` accepts pre-resolved `EmailContext` to avoid N reads |
| Per-tenant template overrides             | Templates loaded from a registry instead of imports    |
| Localization (i18n)                       | Templates read locale from `EmailContext`              |
| In-app notifications, push, WhatsApp      | Separate transport modules; each module's `send*` wrapper picks the channel |

---

## 14. Risks & Mitigations

| Risk                                                          | Mitigation                                              |
|---------------------------------------------------------------|---------------------------------------------------------|
| Drift between platform and auth-gateway copies of `lib/email/` | CI diff check fails the build                          |
| Process crash mid-Resend-call → no log doc written            | Accepted for foundation; documented; future retry worker can switch to write-then-update |
| Dev allowlist accidentally blocks production sends            | Guard explicitly checks `NODE_ENV === 'production'` first; unit-tested |
| Email enumeration attack via password reset endpoint          | Endpoint always returns `{ ok: true }`; no Firestore read for unknown emails |
| Resend rate limits during burst                               | Foundation logs failures cleanly; future retry worker handles transient errors |
| DNS misconfiguration → emails go to spam                      | Setup checklist in Section 9; smoke test before flipping `EMAIL_SENDER_DOMAIN` to prod |
| Tenant logo URL is a hotlink on Firebase Storage              | Logo URL is just an `<img src>`; existing Firebase Storage CDN handles caching; document size limits in template |
