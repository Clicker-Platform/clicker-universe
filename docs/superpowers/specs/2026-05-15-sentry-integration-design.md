# Sentry Integration Design — Clicker Platform

**Date:** 2026-05-15  
**Scope:** clicker-platform-v2, backyard, auth-gateway  
**Status:** Approved

---

## 1. Goals

- Capture JS errors + unhandled exceptions across all 3 apps
- Monitor performance (page load, API latency, Core Web Vitals)
- Upload source maps for readable production stack traces
- Environments: `production` and `staging` only (dev disabled)
- No user PII except `uid` (no email captured)

---

## 2. Sentry Project Structure

3 separate Sentry projects (free tier, 3 × 5,000 errors/month + 3 × 10,000 perf transactions/month):

| App | Sentry Project | DSN Env Var |
|-----|---------------|-------------|
| `clicker-platform-v2` | `clicker-platform` | `NEXT_PUBLIC_SENTRY_DSN` |
| `backyard` | `clicker-backyard` | `NEXT_PUBLIC_SENTRY_DSN` |
| `auth-gateway` | `clicker-auth` | `NEXT_PUBLIC_SENTRY_DSN` |

Each app has its own `.env.local` with its respective DSN.

---

## 3. Shared Config Package

Location: `main/packages/sentry-config/`

Added to `pnpm-workspace.yaml` (to be created at `main/`):
```yaml
packages:
  - 'clicker-platform-v2'
  - 'backyard'
  - 'auth-gateway'
  - 'packages/*'
```

Package exports:
- `sharedSentryOptions` — init options (sample rates, environment, enabled flag)
- `sharedWebpackOptions` — withSentryConfig options (source maps, auth token)

Each app installs `@sentry/nextjs` and `@clicker/sentry-config` (local workspace dep).

---

## 4. Per-App Config Files

Each app gets 4 files:

```
sentry.client.config.ts   — browser-side init
sentry.server.config.ts   — Node.js server-side init
sentry.edge.config.ts     — Edge runtime init
next.config.[mjs|ts]      — wrapped with withSentryConfig
```

### 4.1 Shared Init Options

```typescript
// packages/sentry-config/index.ts
export const sharedSentryOptions = {
  tracesSampleRate: 1.0,         // staging: 1.0, production: lower to 0.1
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  environment: process.env.SENTRY_ENV ?? 'development',
  enabled: process.env.NODE_ENV !== 'development',
}

export const sharedWebpackOptions = {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: true,
  hideSourceMaps: true,
  disableLogger: true,
}
```

### 4.2 Auth-Gateway — beforeSend (strip sensitive data)

```typescript
// auth-gateway/sentry.client.config.ts
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  ...sharedSentryOptions,
  beforeSend(event) {
    if (event.request?.cookies) delete event.request.cookies
    if (event.request?.headers?.authorization) {
      delete event.request.headers.authorization
    }
    return event
  },
})
```

### 4.3 User Context (platform + backyard)

```typescript
// After successful login
Sentry.setUser({ id: user.uid })

// After logout
Sentry.setUser(null)
```

No email, no other PII.

---

## 5. Error Boundaries

Wrap root layout of each app:

```tsx
// app/layout.tsx
import * as Sentry from '@sentry/nextjs'

export default function RootLayout({ children }) {
  return (
    <Sentry.ErrorBoundary fallback={<ErrorFallback />}>
      {children}
    </Sentry.ErrorBoundary>
  )
}
```

---

## 6. Source Maps

- Uploaded during `next build` via `withSentryConfig` webpack plugin
- Requires `SENTRY_AUTH_TOKEN` in build environment (CI/CD)
- `hideSourceMaps: true` — maps not exposed to browser
- Dev builds: auth token not required, upload skipped automatically

---

## 7. Environment Variables

### Required in each app's `.env.local` (dev/staging):
```
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
SENTRY_ENV=staging
```

### Required in CI/CD (production build):
```
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
SENTRY_AUTH_TOKEN=...
SENTRY_ORG=your-org-slug
SENTRY_PROJECT=clicker-platform|clicker-backyard|clicker-auth
SENTRY_ENV=production
```

### Per-app `SENTRY_PROJECT` values:
| App | Value |
|-----|-------|
| clicker-platform-v2 | `clicker-platform` |
| backyard | `clicker-backyard` |
| auth-gateway | `clicker-auth` |

---

## 8. Manual Prerequisites (before implementation)

1. Create account at sentry.io
2. Create 3 projects (platform: Next.js):
   - `clicker-platform`
   - `clicker-backyard`
   - `clicker-auth`
3. Copy DSN for each project (Settings → Client Keys)
4. Generate Auth Token (Settings → Auth Tokens → Create New)

---

## 9. Out of Scope (Phase 1)

- Sentry Crons (job monitoring)
- Custom dashboards / alerts config (done manually in Sentry UI)
- Session replay beyond default config
- Rate limiting / quota management automation

## 10. Phase 2 (Future)

**Sentry tab di Backyard `/monitoring` page**

Backyard sudah punya monitoring page dengan tabs (Health, Logs, PostHog, Resend). Phase 2 tambah tab "Sentry" yang menampilkan:
- Recent errors per-app (platform / backyard / auth)
- Error count 24h / 7d
- Link langsung ke issue di Sentry dashboard

Implementation notes:
- Fetch via Sentry REST API dengan `SENTRY_AUTH_TOKEN` di backyard server
- Cache response 5 menit di server (hindari rate limit)
- Tidak block Phase 1 — bisa dikerjakan setelah foundation stabil
