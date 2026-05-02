# Resend Email Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a multi-tenant email transport at `clicker-platform-v2/lib/email/` using Resend + React Email, migrate the existing form notification email to it, then sync to `auth-gateway/` and add password-reset / email-verification flows.

**Architecture:** Single `sendEmail()` entry point per app. Tenant context (`fromName`, branding) resolved from `siteId` once per call with a 5-minute in-memory cache. Templates are React Email components wrapped in a shared `<EmailLayout>`. Every send writes one audit log doc to Firestore. Dev-mode allowlist guards against accidentally emailing real customers. The `lib/email/` directory is duplicated into auth-gateway via a sync script + CI diff check until the monorepo grows a shared-packages story.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, `resend@^6`, `@react-email/components`, `@react-email/render`, `react-email` (dev-only preview), Firebase Admin SDK, Firestore, Vitest + jsdom.

**Spec:** [`superpowers/specs/2026-05-02-resend-email-foundation-design.md`](../specs/2026-05-02-resend-email-foundation-design.md)

---

## File Structure

### Created — `clicker-platform-v2/lib/email/`

| File                                  | Responsibility                                                          |
|---------------------------------------|-------------------------------------------------------------------------|
| `config.ts`                           | Read env vars; resolve sender domain/local-part; system defaults.       |
| `context.ts`                          | `getEmailContext(siteId)` — fetch site doc, build `EmailContext`, cache.|
| `guard.ts`                            | `isAllowedInDev(to)` — dev allowlist suffix matcher.                    |
| `render.ts`                           | `renderTemplate(template, context)` → `{ html, text }`.                 |
| `log.ts`                              | `writeEmailLog(doc)` — write audit doc to Firestore.                    |
| `sender.ts`                           | `sendEmail(input)` — orchestrates context → render → guard → send → log.|
| `types.ts`                            | `SendEmailInput`, `SendEmailResult`, `EmailContext`, `EmailLogDoc`.     |
| `templates/EmailLayout.tsx`           | Shared shell: header (logo, business name), body, footer.               |
| `templates/components/Button.tsx`     | Button with tenant primary-color accent.                                |
| `templates/components/Heading.tsx`    | Standard heading style.                                                 |
| `templates/components/DataTable.tsx`  | Two-column key/value table (replaces inline HTML in old email.ts).      |
| `templates/system/PasswordReset.tsx`  | Password-reset email body.                                              |
| `templates/system/EmailVerification.tsx` | Email-verification body.                                             |
| `templates/system/FormSubmission.tsx` | Form submission notification (replaces inline HTML).                    |
| `templates/system/SystemAlert.tsx`    | Generic system alert template.                                          |
| `__tests__/config.test.ts`            | Env resolution behavior.                                                |
| `__tests__/context.test.ts`           | Site doc → context, cache TTL, null fallback.                           |
| `__tests__/guard.test.ts`             | Allowlist suffix matching, env-aware behavior.                          |
| `__tests__/sender.test.ts`            | Mock Resend; verify log writes; dev-block tag.                          |
| `__tests__/render.test.ts`            | Template snapshot tests.                                                |

### Modified

| File                                                            | Change                                                            |
|-----------------------------------------------------------------|-------------------------------------------------------------------|
| `clicker-platform-v2/package.json`                              | Add `@react-email/components`, `@react-email/render`, dev `react-email`. |
| `clicker-platform-v2/app/api/forms/submit/route.ts`             | Replace `import('@/lib/email')` with new `sendEmail()` + template.|
| `clicker-platform-v2/lib/email.ts`                              | **DELETE** (replaced by `lib/email/`).                            |

### Created — sync infrastructure

| File                                                            | Responsibility                                                    |
|-----------------------------------------------------------------|-------------------------------------------------------------------|
| `scripts/sync-email-module.sh`                                  | Copy `clicker-platform-v2/lib/email/` → `auth-gateway/lib/email/`.|
| `.github/workflows/email-module-sync-check.yml`                 | CI: `diff -r` between the two; fail if drift.                     |

### Created — auth-gateway

| File                                                            | Responsibility                                                    |
|-----------------------------------------------------------------|-------------------------------------------------------------------|
| `auth-gateway/lib/email/` (entire directory)                    | Synced copy of platform `lib/email/`.                             |
| `auth-gateway/lib/email/templates/system/PasswordReset.tsx`     | (in synced dir)                                                   |
| `auth-gateway/lib/email/templates/system/EmailVerification.tsx` | (in synced dir)                                                   |
| `auth-gateway/lib/resolve-site-from-email.ts`                   | Lookup `siteId` from email via existing patterns.                 |
| `auth-gateway/lib/rate-limit.ts`                                | Simple in-memory IP rate limiter (5/hour).                        |
| `auth-gateway/app/api/password-reset/route.ts`                  | `POST` endpoint: link gen + send.                                 |
| `auth-gateway/app/api/email-verification/route.ts`              | `POST` endpoint: link gen + send.                                 |
| `auth-gateway/app/forgot-password/page.tsx`                     | Forgot-password form UI.                                          |
| `auth-gateway/package.json`                                     | Add Resend + React Email runtime deps.                            |

---

## Phase 1 — Foundation: `lib/email/` skeleton + config + types

### Task 1: Install dependencies and add scripts

**Files:**
- Modify: `clicker-platform-v2/package.json`

- [ ] **Step 1: Install runtime deps**

Run:
```bash
cd clicker-platform-v2 && pnpm add @react-email/components @react-email/render
```
Expected: `pnpm-lock.yaml` updated, both packages added to `dependencies`.

- [ ] **Step 2: Install dev preview**

Run:
```bash
cd clicker-platform-v2 && pnpm add -D react-email
```
Expected: `react-email` in `devDependencies`.

- [ ] **Step 3: Add `email:dev` script**

Edit `clicker-platform-v2/package.json` `scripts` section, adding:
```json
"email:dev": "email dev --dir lib/email/templates --port 3001"
```

- [ ] **Step 4: Verify install**

Run:
```bash
cd clicker-platform-v2 && pnpm list resend @react-email/components @react-email/render react-email
```
Expected: all four packages listed with versions.

- [ ] **Step 5: Commit**

```bash
git add clicker-platform-v2/package.json clicker-platform-v2/pnpm-lock.yaml
git commit -m "chore(email): add react-email runtime + dev preview deps"
```

---

### Task 2: Define types

**Files:**
- Create: `clicker-platform-v2/lib/email/types.ts`

- [ ] **Step 1: Write the file**

Create `clicker-platform-v2/lib/email/types.ts`:
```ts
import type { ReactElement } from 'react';
import type { Timestamp } from 'firebase-admin/firestore';

export type EmailTag = { name: string; value: string };

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  template: ReactElement;
  siteId: string | null;
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
  tags?: EmailTag[];
};

export type SendEmailResult =
  | { ok: true; id: string; logId: string }
  | { ok: false; error: string; logId: string };

export type EmailContext = {
  fromName: string;
  fromAddress: string;
  replyTo: string | null;
  brand: {
    businessName: string;
    logoUrl: string | null;
    primaryColor: string | null;
    siteUrl: string;
  };
};

export type EmailLogStatus = 'sent' | 'failed';

export type EmailLogDoc = {
  to: string[];
  cc: string[] | null;
  bcc: string[] | null;
  subject: string;
  fromName: string;
  fromAddress: string;
  replyTo: string | null;
  siteId: string | null;
  tags: EmailTag[];
  status: EmailLogStatus;
  resendId: string | null;
  error: string | null;
  errorCode: string | null;
  attemptCount: number;
  createdAt: Timestamp;
  sentAt: Timestamp | null;
};
```

- [ ] **Step 2: Verify TypeScript compiles**

Run:
```bash
cd clicker-platform-v2 && pnpm tsc --noEmit
```
Expected: no errors mentioning `lib/email/types.ts`.

- [ ] **Step 3: Commit**

```bash
git add clicker-platform-v2/lib/email/types.ts
git commit -m "feat(email): add core types (SendEmailInput, EmailContext, EmailLogDoc)"
```

---

### Task 3: Config — sender resolution from env

**Files:**
- Create: `clicker-platform-v2/lib/email/config.ts`
- Test: `clicker-platform-v2/lib/email/__tests__/config.test.ts`

- [ ] **Step 1: Write failing tests**

Create `clicker-platform-v2/lib/email/__tests__/config.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolveDefaultSender, getDevAllowlistSuffixes, getSystemDefaults } from '../config';

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  delete process.env.EMAIL_SENDER_DOMAIN;
  delete process.env.EMAIL_SENDER_LOCAL_PART;
  delete process.env.EMAIL_SYSTEM_FROM_NAME;
  delete process.env.EMAIL_DEV_ALLOWLIST;
  delete process.env.EMAIL_PLATFORM_LOGO_URL;
  delete process.env.EMAIL_PLATFORM_URL;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('resolveDefaultSender', () => {
  it('falls back to onboarding@resend.dev in dev with no EMAIL_SENDER_DOMAIN', () => {
    process.env.NODE_ENV = 'development';
    expect(resolveDefaultSender()).toEqual({ localPart: 'onboarding', domain: 'resend.dev' });
  });

  it('uses configured domain and default local-part in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.EMAIL_SENDER_DOMAIN = 'clicker.id';
    expect(resolveDefaultSender()).toEqual({ localPart: 'noreply', domain: 'clicker.id' });
  });

  it('respects EMAIL_SENDER_LOCAL_PART override', () => {
    process.env.NODE_ENV = 'production';
    process.env.EMAIL_SENDER_DOMAIN = 'clicker.id';
    process.env.EMAIL_SENDER_LOCAL_PART = 'hello';
    expect(resolveDefaultSender()).toEqual({ localPart: 'hello', domain: 'clicker.id' });
  });
});

describe('getDevAllowlistSuffixes', () => {
  it('returns built-in defaults when EMAIL_DEV_ALLOWLIST unset', () => {
    expect(getDevAllowlistSuffixes()).toEqual(['@clicker.id', '@resend.dev']);
  });

  it('parses comma-separated EMAIL_DEV_ALLOWLIST', () => {
    process.env.EMAIL_DEV_ALLOWLIST = '@example.com, @test.io';
    expect(getDevAllowlistSuffixes()).toEqual(['@example.com', '@test.io']);
  });
});

describe('getSystemDefaults', () => {
  it('uses fallback values when env vars unset', () => {
    const d = getSystemDefaults();
    expect(d.fromName).toBe('Clicker Platform');
    expect(d.platformUrl).toBe('https://clicker.id');
    expect(d.logoUrl).toBeNull();
  });

  it('reads EMAIL_SYSTEM_FROM_NAME, EMAIL_PLATFORM_URL, EMAIL_PLATFORM_LOGO_URL', () => {
    process.env.EMAIL_SYSTEM_FROM_NAME = 'Custom Name';
    process.env.EMAIL_PLATFORM_URL = 'https://example.com';
    process.env.EMAIL_PLATFORM_LOGO_URL = 'https://example.com/logo.png';
    const d = getSystemDefaults();
    expect(d.fromName).toBe('Custom Name');
    expect(d.platformUrl).toBe('https://example.com');
    expect(d.logoUrl).toBe('https://example.com/logo.png');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd clicker-platform-v2 && pnpm vitest run lib/email/__tests__/config.test.ts`
Expected: FAIL — module `'../config'` does not exist.

- [ ] **Step 3: Write the implementation**

Create `clicker-platform-v2/lib/email/config.ts`:
```ts
export type SenderParts = { localPart: string; domain: string };

export function resolveDefaultSender(): SenderParts {
  const isDev = process.env.NODE_ENV !== 'production';
  const domain = process.env.EMAIL_SENDER_DOMAIN ?? (isDev ? 'resend.dev' : 'clicker.id');
  const fallbackLocal = domain === 'resend.dev' ? 'onboarding' : 'noreply';
  const localPart = process.env.EMAIL_SENDER_LOCAL_PART ?? fallbackLocal;
  return { localPart, domain };
}

export function getDevAllowlistSuffixes(): string[] {
  const raw = process.env.EMAIL_DEV_ALLOWLIST ?? '@clicker.id,@resend.dev';
  return raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
}

export function getSystemDefaults() {
  return {
    fromName: process.env.EMAIL_SYSTEM_FROM_NAME ?? 'Clicker Platform',
    platformUrl: process.env.EMAIL_PLATFORM_URL ?? 'https://clicker.id',
    logoUrl: process.env.EMAIL_PLATFORM_LOGO_URL ?? null,
  };
}

export function formatFrom(fromName: string, parts: SenderParts): string {
  return `${fromName} <${parts.localPart}@${parts.domain}>`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd clicker-platform-v2 && pnpm vitest run lib/email/__tests__/config.test.ts`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add clicker-platform-v2/lib/email/config.ts clicker-platform-v2/lib/email/__tests__/config.test.ts
git commit -m "feat(email): add config — sender resolution, allowlist, system defaults"
```

---

### Task 4: Dev allowlist guard

**Files:**
- Create: `clicker-platform-v2/lib/email/guard.ts`
- Test: `clicker-platform-v2/lib/email/__tests__/guard.test.ts`

- [ ] **Step 1: Write failing tests**

Create `clicker-platform-v2/lib/email/__tests__/guard.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isAllowedInDev } from '../guard';

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  delete process.env.EMAIL_DEV_ALLOWLIST;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('isAllowedInDev', () => {
  it('allows everything in production regardless of address', () => {
    process.env.NODE_ENV = 'production';
    expect(isAllowedInDev(['random@example.com'])).toBe(true);
  });

  it('blocks non-allowlisted in dev', () => {
    process.env.NODE_ENV = 'development';
    expect(isAllowedInDev(['random@example.com'])).toBe(false);
  });

  it('allows @clicker.id in dev (default)', () => {
    process.env.NODE_ENV = 'development';
    expect(isAllowedInDev(['hello@clicker.id'])).toBe(true);
  });

  it('allows @resend.dev in dev (default)', () => {
    process.env.NODE_ENV = 'development';
    expect(isAllowedInDev(['test@resend.dev'])).toBe(true);
  });

  it('allows configured suffixes via EMAIL_DEV_ALLOWLIST', () => {
    process.env.NODE_ENV = 'development';
    process.env.EMAIL_DEV_ALLOWLIST = '@example.com';
    expect(isAllowedInDev(['user@example.com'])).toBe(true);
    expect(isAllowedInDev(['user@clicker.id'])).toBe(false);
  });

  it('returns false if ANY recipient is non-allowlisted', () => {
    process.env.NODE_ENV = 'development';
    expect(isAllowedInDev(['ok@clicker.id', 'bad@example.com'])).toBe(false);
  });

  it('case-insensitive matching', () => {
    process.env.NODE_ENV = 'development';
    expect(isAllowedInDev(['User@CLICKER.ID'])).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd clicker-platform-v2 && pnpm vitest run lib/email/__tests__/guard.test.ts`
Expected: FAIL — module `'../guard'` does not exist.

- [ ] **Step 3: Write the implementation**

Create `clicker-platform-v2/lib/email/guard.ts`:
```ts
import { getDevAllowlistSuffixes } from './config';

export function isAllowedInDev(to: string[]): boolean {
  if (process.env.NODE_ENV === 'production') return true;
  const suffixes = getDevAllowlistSuffixes();
  return to.every((addr) =>
    suffixes.some((suffix) => addr.toLowerCase().endsWith(suffix))
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd clicker-platform-v2 && pnpm vitest run lib/email/__tests__/guard.test.ts`
Expected: all 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add clicker-platform-v2/lib/email/guard.ts clicker-platform-v2/lib/email/__tests__/guard.test.ts
git commit -m "feat(email): add dev allowlist guard"
```

---

### Task 5: Tenant context resolution with cache

**Files:**
- Create: `clicker-platform-v2/lib/email/context.ts`
- Test: `clicker-platform-v2/lib/email/__tests__/context.test.ts`

- [ ] **Step 1: Write failing tests**

Create `clicker-platform-v2/lib/email/__tests__/context.test.ts`:
```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockGet = vi.fn();
vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: () => ({ doc: () => ({ get: mockGet }) }),
  },
}));

beforeEach(() => {
  vi.useFakeTimers();
  mockGet.mockReset();
  process.env.EMAIL_SENDER_DOMAIN = 'clicker.id';
  process.env.EMAIL_SYSTEM_FROM_NAME = 'Clicker Platform';
});

describe('getEmailContext', () => {
  it('returns system defaults for null siteId', async () => {
    const { getEmailContext, _resetEmailContextCache } = await import('../context');
    _resetEmailContextCache();
    const ctx = await getEmailContext(null);
    expect(ctx.fromName).toBe('Clicker Platform');
    expect(ctx.fromAddress).toBe('noreply@clicker.id');
    expect(ctx.brand.businessName).toBe('Clicker Platform');
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('reads site doc and builds context', async () => {
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        name: 'Acme Coffee',
        ownerEmail: 'owner@acme.com',
        slug: 'acme',
        logoUrl: 'https://cdn/acme-logo.png',
        primaryColor: '#ff6600',
      }),
    });
    const { getEmailContext, _resetEmailContextCache } = await import('../context');
    _resetEmailContextCache();
    const ctx = await getEmailContext('site-1');
    expect(ctx.fromName).toBe('Acme Coffee');
    expect(ctx.fromAddress).toBe('noreply@clicker.id');
    expect(ctx.replyTo).toBe('owner@acme.com');
    expect(ctx.brand.businessName).toBe('Acme Coffee');
    expect(ctx.brand.logoUrl).toBe('https://cdn/acme-logo.png');
    expect(ctx.brand.primaryColor).toBe('#ff6600');
  });

  it('falls back to system defaults if site doc missing', async () => {
    mockGet.mockResolvedValueOnce({ exists: false });
    const { getEmailContext, _resetEmailContextCache } = await import('../context');
    _resetEmailContextCache();
    const ctx = await getEmailContext('missing-site');
    expect(ctx.fromName).toBe('Clicker Platform');
  });

  it('caches result for 5 minutes', async () => {
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({ name: 'Acme Coffee' }),
    });
    const { getEmailContext, _resetEmailContextCache } = await import('../context');
    _resetEmailContextCache();

    await getEmailContext('site-1');
    await getEmailContext('site-1');
    expect(mockGet).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    await getEmailContext('site-1');
    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  it('falls back to system on Firestore error and logs warning', async () => {
    mockGet.mockRejectedValueOnce(new Error('boom'));
    const { getEmailContext, _resetEmailContextCache } = await import('../context');
    _resetEmailContextCache();
    const ctx = await getEmailContext('site-error');
    expect(ctx.fromName).toBe('Clicker Platform');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd clicker-platform-v2 && pnpm vitest run lib/email/__tests__/context.test.ts`
Expected: FAIL — module `'../context'` does not exist.

- [ ] **Step 3: Write the implementation**

Create `clicker-platform-v2/lib/email/context.ts`:
```ts
import { adminDb } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';
import { resolveDefaultSender, getSystemDefaults } from './config';
import type { EmailContext } from './types';

const CACHE_TTL_MS = 5 * 60 * 1000;
type CacheEntry = { value: EmailContext; expiresAt: number };
const cache = new Map<string, CacheEntry>();

const SYSTEM_KEY = '__system__';

export function _resetEmailContextCache() {
  cache.clear();
}

function buildSystemContext(): EmailContext {
  const defaults = getSystemDefaults();
  const sender = resolveDefaultSender();
  return {
    fromName: defaults.fromName,
    fromAddress: `${sender.localPart}@${sender.domain}`,
    replyTo: null,
    brand: {
      businessName: defaults.fromName,
      logoUrl: defaults.logoUrl,
      primaryColor: null,
      siteUrl: defaults.platformUrl,
    },
  };
}

function buildTenantContext(
  siteId: string,
  data: Record<string, unknown>
): EmailContext {
  const sender = resolveDefaultSender();
  const businessName =
    (data.name as string | undefined) ??
    (data.businessName as string | undefined) ??
    'Clicker Platform';
  const slug = (data.slug as string | undefined) ?? siteId;
  const platformUrl = getSystemDefaults().platformUrl;
  const siteUrl = `https://${slug}.${platformUrl.replace(/^https?:\/\//, '')}`;
  return {
    fromName: businessName,
    fromAddress: `${sender.localPart}@${sender.domain}`,
    replyTo: (data.ownerEmail as string | undefined) ?? null,
    brand: {
      businessName,
      logoUrl: (data.logoUrl as string | undefined) ?? null,
      primaryColor: (data.primaryColor as string | undefined) ?? null,
      siteUrl,
    },
  };
}

export async function getEmailContext(
  siteId: string | null
): Promise<EmailContext> {
  const key = siteId ?? SYSTEM_KEY;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  let value: EmailContext;
  if (siteId === null) {
    value = buildSystemContext();
  } else {
    try {
      const snap = await adminDb.collection('sites').doc(siteId).get();
      if (!snap.exists) {
        logger.warn('email.context.site.missing', { siteId });
        value = buildSystemContext();
      } else {
        value = buildTenantContext(siteId, snap.data() ?? {});
      }
    } catch (error) {
      logger.warn('email.context.fetch.failed', { siteId, error });
      value = buildSystemContext();
    }
  }

  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd clicker-platform-v2 && pnpm vitest run lib/email/__tests__/context.test.ts`
Expected: all 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add clicker-platform-v2/lib/email/context.ts clicker-platform-v2/lib/email/__tests__/context.test.ts
git commit -m "feat(email): add tenant context resolver with 5min cache"
```

---

## Phase 2 — Templates and Render

### Task 6: Build `EmailLayout` and shared components

**Files:**
- Create: `clicker-platform-v2/lib/email/templates/EmailLayout.tsx`
- Create: `clicker-platform-v2/lib/email/templates/components/Heading.tsx`
- Create: `clicker-platform-v2/lib/email/templates/components/Button.tsx`
- Create: `clicker-platform-v2/lib/email/templates/components/DataTable.tsx`

- [ ] **Step 1: Write `Heading.tsx`**

Create `clicker-platform-v2/lib/email/templates/components/Heading.tsx`:
```tsx
import { Heading as REHeading } from '@react-email/components';
import type { ReactNode } from 'react';

export function Heading({ children }: { children: ReactNode }) {
  return (
    <REHeading
      as="h2"
      style={{ margin: 0, color: '#f8fafc', fontSize: '18px', fontWeight: 600 }}
    >
      {children}
    </REHeading>
  );
}
```

- [ ] **Step 2: Write `Button.tsx`**

Create `clicker-platform-v2/lib/email/templates/components/Button.tsx`:
```tsx
import { Button as REButton } from '@react-email/components';
import type { ReactNode } from 'react';

type Props = {
  href: string;
  primaryColor?: string | null;
  children: ReactNode;
};

export function Button({ href, primaryColor, children }: Props) {
  const bg = primaryColor ?? '#0a0a0a';
  return (
    <REButton
      href={href}
      style={{
        backgroundColor: bg,
        color: '#ffffff',
        padding: '12px 24px',
        borderRadius: '8px',
        fontWeight: 600,
        textDecoration: 'none',
        display: 'inline-block',
      }}
    >
      {children}
    </REButton>
  );
}
```

- [ ] **Step 3: Write `DataTable.tsx`**

Create `clicker-platform-v2/lib/email/templates/components/DataTable.tsx`:
```tsx
type Row = { label: string; value: string };

export function DataTable({ rows }: { rows: Row[] }) {
  return (
    <table
      style={{
        width: '100%',
        borderCollapse: 'collapse',
        border: '1px solid #e5e7eb',
        borderRadius: '12px',
        overflow: 'hidden',
      }}
    >
      <tbody>
        {rows.map((r) => (
          <tr key={r.label}>
            <td
              style={{
                padding: '8px 12px',
                fontWeight: 600,
                color: '#374151',
                borderBottom: '1px solid #f3f4f6',
                width: '140px',
              }}
            >
              {r.label}
            </td>
            <td
              style={{
                padding: '8px 12px',
                color: '#111827',
                borderBottom: '1px solid #f3f4f6',
              }}
            >
              {r.value || '—'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 4: Write `EmailLayout.tsx`**

Create `clicker-platform-v2/lib/email/templates/EmailLayout.tsx`:
```tsx
import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Section,
  Text,
  Img,
  Link,
} from '@react-email/components';
import type { ReactNode } from 'react';
import type { EmailContext } from '../types';

type Props = {
  context: EmailContext;
  preview: string;
  children: ReactNode;
};

export function EmailLayout({ context, preview, children }: Props) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{
          backgroundColor: '#f9fafb',
          fontFamily:
            "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
          margin: 0,
          padding: '24px 0',
        }}
      >
        <Container style={{ maxWidth: '520px', margin: '0 auto' }}>
          <Section
            style={{
              backgroundColor: '#0a0a0a',
              padding: '24px 28px',
              borderRadius: '12px 12px 0 0',
            }}
          >
            {context.brand.logoUrl ? (
              <Img
                src={context.brand.logoUrl}
                alt={context.brand.businessName}
                height="24"
                style={{ display: 'block' }}
              />
            ) : (
              <Text
                style={{ margin: 0, color: '#f8fafc', fontSize: '16px', fontWeight: 600 }}
              >
                {context.brand.businessName}
              </Text>
            )}
          </Section>
          <Section
            style={{
              backgroundColor: '#ffffff',
              padding: '28px',
              border: '1px solid #e5e7eb',
              borderTop: 'none',
              borderRadius: '0 0 12px 12px',
            }}
          >
            {children}
          </Section>
          <Text
            style={{
              margin: '20px 0 0',
              color: '#9ca3af',
              fontSize: '11px',
              textAlign: 'center',
            }}
          >
            Sent by{' '}
            <Link
              href={context.brand.siteUrl}
              style={{ color: '#9ca3af', textDecoration: 'underline' }}
            >
              {context.brand.businessName}
            </Link>{' '}
            via Clicker Platform
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
```

- [ ] **Step 5: Verify TypeScript**

Run:
```bash
cd clicker-platform-v2 && pnpm tsc --noEmit
```
Expected: no errors in `lib/email/templates/`.

- [ ] **Step 6: Commit**

```bash
git add clicker-platform-v2/lib/email/templates/
git commit -m "feat(email): add EmailLayout shell + shared components"
```

---

### Task 7: System templates — `FormSubmission`, `PasswordReset`, `EmailVerification`, `SystemAlert`

**Files:**
- Create: `clicker-platform-v2/lib/email/templates/system/FormSubmission.tsx`
- Create: `clicker-platform-v2/lib/email/templates/system/PasswordReset.tsx`
- Create: `clicker-platform-v2/lib/email/templates/system/EmailVerification.tsx`
- Create: `clicker-platform-v2/lib/email/templates/system/SystemAlert.tsx`

- [ ] **Step 1: Write `FormSubmission.tsx`**

Create `clicker-platform-v2/lib/email/templates/system/FormSubmission.tsx`:
```tsx
import { Text } from '@react-email/components';
import { EmailLayout } from '../EmailLayout';
import { Heading } from '../components/Heading';
import { DataTable } from '../components/DataTable';
import type { EmailContext } from '../../types';

type Props = {
  context: EmailContext;
  formTitle: string;
  data: Record<string, string>;
  fieldLabels?: Record<string, string>;
};

export function FormSubmission({ context, formTitle, data, fieldLabels }: Props) {
  const rows = Object.entries(data).map(([key, value]) => ({
    label: fieldLabels?.[key] ?? key,
    value,
  }));

  return (
    <EmailLayout context={context} preview={`New submission: ${formTitle}`}>
      <Heading>New Submission</Heading>
      <Text style={{ margin: '6px 0 16px', color: '#6b7280', fontSize: '13px' }}>
        {formTitle}
      </Text>
      <DataTable rows={rows} />
    </EmailLayout>
  );
}
```

- [ ] **Step 2: Write `PasswordReset.tsx`**

Create `clicker-platform-v2/lib/email/templates/system/PasswordReset.tsx`:
```tsx
import { Text } from '@react-email/components';
import { EmailLayout } from '../EmailLayout';
import { Heading } from '../components/Heading';
import { Button } from '../components/Button';
import type { EmailContext } from '../../types';

type Props = {
  context: EmailContext;
  resetUrl: string;
};

export function PasswordReset({ context, resetUrl }: Props) {
  return (
    <EmailLayout context={context} preview="Reset your password">
      <Heading>Reset your password</Heading>
      <Text style={{ margin: '12px 0 20px', color: '#374151', fontSize: '14px', lineHeight: 1.6 }}>
        We received a request to reset the password for your account. Click the button below to choose a new one. If you didn&apos;t request this, you can safely ignore this email.
      </Text>
      <Button href={resetUrl} primaryColor={context.brand.primaryColor}>
        Reset password
      </Button>
      <Text style={{ margin: '20px 0 0', color: '#9ca3af', fontSize: '12px' }}>
        This link expires in 1 hour.
      </Text>
    </EmailLayout>
  );
}
```

- [ ] **Step 3: Write `EmailVerification.tsx`**

Create `clicker-platform-v2/lib/email/templates/system/EmailVerification.tsx`:
```tsx
import { Text } from '@react-email/components';
import { EmailLayout } from '../EmailLayout';
import { Heading } from '../components/Heading';
import { Button } from '../components/Button';
import type { EmailContext } from '../../types';

type Props = {
  context: EmailContext;
  verifyUrl: string;
};

export function EmailVerification({ context, verifyUrl }: Props) {
  return (
    <EmailLayout context={context} preview="Verify your email address">
      <Heading>Verify your email</Heading>
      <Text style={{ margin: '12px 0 20px', color: '#374151', fontSize: '14px', lineHeight: 1.6 }}>
        Please confirm your email address to activate your account.
      </Text>
      <Button href={verifyUrl} primaryColor={context.brand.primaryColor}>
        Verify email
      </Button>
    </EmailLayout>
  );
}
```

- [ ] **Step 4: Write `SystemAlert.tsx`**

Create `clicker-platform-v2/lib/email/templates/system/SystemAlert.tsx`:
```tsx
import { Text } from '@react-email/components';
import { EmailLayout } from '../EmailLayout';
import { Heading } from '../components/Heading';
import type { EmailContext } from '../../types';

type Props = {
  context: EmailContext;
  title: string;
  body: string;
};

export function SystemAlert({ context, title, body }: Props) {
  return (
    <EmailLayout context={context} preview={title}>
      <Heading>{title}</Heading>
      <Text style={{ margin: '12px 0 0', color: '#374151', fontSize: '14px', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
        {body}
      </Text>
    </EmailLayout>
  );
}
```

- [ ] **Step 5: Verify TypeScript**

Run:
```bash
cd clicker-platform-v2 && pnpm tsc --noEmit
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add clicker-platform-v2/lib/email/templates/system/
git commit -m "feat(email): add system templates — form, reset, verify, alert"
```

---

### Task 8: Render module

**Files:**
- Create: `clicker-platform-v2/lib/email/render.ts`
- Test: `clicker-platform-v2/lib/email/__tests__/render.test.ts`

- [ ] **Step 1: Write failing test**

Create `clicker-platform-v2/lib/email/__tests__/render.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { renderTemplate } from '../render';
import { FormSubmission } from '../templates/system/FormSubmission';
import type { EmailContext } from '../types';

const ctx: EmailContext = {
  fromName: 'Acme Coffee',
  fromAddress: 'noreply@clicker.id',
  replyTo: null,
  brand: {
    businessName: 'Acme Coffee',
    logoUrl: null,
    primaryColor: null,
    siteUrl: 'https://acme.clicker.id',
  },
};

describe('renderTemplate', () => {
  it('renders FormSubmission to HTML and text', async () => {
    const out = await renderTemplate(
      <FormSubmission
        context={ctx}
        formTitle="Contact form"
        data={{ name: 'Jane', email: 'jane@example.com' }}
      />
    );
    expect(out.html).toContain('<html');
    expect(out.html).toContain('Contact form');
    expect(out.html).toContain('Jane');
    expect(out.html).toContain('Acme Coffee');
    expect(out.text).toContain('Contact form');
    expect(out.text).toContain('Jane');
  });

  it('uses field labels when provided', async () => {
    const out = await renderTemplate(
      <FormSubmission
        context={ctx}
        formTitle="Contact"
        data={{ field_1: 'Hello' }}
        fieldLabels={{ field_1: 'Message' }}
      />
    );
    expect(out.html).toContain('Message');
    expect(out.html).toContain('Hello');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd clicker-platform-v2 && pnpm vitest run lib/email/__tests__/render.test.ts`
Expected: FAIL — module `'../render'` does not exist.

- [ ] **Step 3: Write the implementation**

Create `clicker-platform-v2/lib/email/render.ts`:
```ts
import { render } from '@react-email/render';
import type { ReactElement } from 'react';

export async function renderTemplate(
  template: ReactElement
): Promise<{ html: string; text: string }> {
  const [html, text] = await Promise.all([
    render(template),
    render(template, { plainText: true }),
  ]);
  return { html, text };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd clicker-platform-v2 && pnpm vitest run lib/email/__tests__/render.test.ts`
Expected: both tests PASS.

- [ ] **Step 5: Commit**

```bash
git add clicker-platform-v2/lib/email/render.ts clicker-platform-v2/lib/email/__tests__/render.test.ts
git commit -m "feat(email): add render module (HTML + plaintext)"
```

---

## Phase 3 — Audit Log + Sender

### Task 9: Audit log writer

**Files:**
- Create: `clicker-platform-v2/lib/email/log.ts`

- [ ] **Step 1: Write the file**

Create `clicker-platform-v2/lib/email/log.ts`:
```ts
import { adminDb, FieldValue } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';
import type { EmailLogDoc } from './types';

export type LogPath = { collection: string; siteId: string | null };

export function getLogCollection(siteId: string | null) {
  if (siteId === null) {
    return adminDb.collection('system').doc('email').collection('emailLog');
  }
  return adminDb.collection('sites').doc(siteId).collection('emailLog');
}

export function newLogDocRef(siteId: string | null) {
  return getLogCollection(siteId).doc();
}

type WriteInput = Omit<EmailLogDoc, 'createdAt' | 'sentAt'> & {
  sentAt: Date | null;
};

export async function writeEmailLog(
  ref: FirebaseFirestore.DocumentReference,
  doc: WriteInput
): Promise<void> {
  try {
    await ref.set({
      ...doc,
      createdAt: FieldValue.serverTimestamp(),
      sentAt: doc.sentAt
        ? doc.sentAt
        : null,
    });
  } catch (error) {
    logger.warn('email.log.write.failed', { siteId: doc.siteId, error });
  }
}
```

Note: log-write failure is itself logged but not propagated — never let logging break a successful send.

- [ ] **Step 2: Verify TypeScript**

Run:
```bash
cd clicker-platform-v2 && pnpm tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add clicker-platform-v2/lib/email/log.ts
git commit -m "feat(email): add audit log writer"
```

---

### Task 10: Resend client wrapper

**Files:**
- Create: `clicker-platform-v2/lib/email/resend-client.ts`

- [ ] **Step 1: Write the file**

Create `clicker-platform-v2/lib/email/resend-client.ts`:
```ts
import { Resend } from 'resend';

let _client: Resend | null = null;

export function getResendClient(): Resend {
  if (_client) return _client;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not set');
  }
  _client = new Resend(apiKey);
  return _client;
}

export function _resetResendClient() {
  _client = null;
}
```

- [ ] **Step 2: Commit**

```bash
git add clicker-platform-v2/lib/email/resend-client.ts
git commit -m "feat(email): add Resend client singleton"
```

---

### Task 11: `sendEmail` orchestrator

**Files:**
- Create: `clicker-platform-v2/lib/email/sender.ts`
- Test: `clicker-platform-v2/lib/email/__tests__/sender.test.ts`

- [ ] **Step 1: Write failing tests**

Create `clicker-platform-v2/lib/email/__tests__/sender.test.ts`:
```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockSend = vi.fn();
const mockSetLog = vi.fn();
const mockGetCtx = vi.fn();

vi.mock('../resend-client', () => ({
  getResendClient: () => ({ emails: { send: mockSend } }),
}));

vi.mock('../log', () => ({
  newLogDocRef: () => ({ id: 'log-id-123', set: mockSetLog }),
  writeEmailLog: async (ref: any, doc: any) => mockSetLog(doc),
  getLogCollection: () => ({}),
}));

vi.mock('../context', () => ({
  getEmailContext: (...args: any[]) => mockGetCtx(...args),
}));

vi.mock('../render', () => ({
  renderTemplate: async () => ({ html: '<html></html>', text: 'plain' }),
}));

beforeEach(() => {
  vi.resetModules();
  mockSend.mockReset();
  mockSetLog.mockReset();
  mockGetCtx.mockReset();
  mockGetCtx.mockResolvedValue({
    fromName: 'Acme',
    fromAddress: 'noreply@clicker.id',
    replyTo: null,
    brand: {
      businessName: 'Acme',
      logoUrl: null,
      primaryColor: null,
      siteUrl: 'https://acme.clicker.id',
    },
  });
  process.env.NODE_ENV = 'production';
  process.env.RESEND_API_KEY = 'test-key';
});

describe('sendEmail', () => {
  it('returns ok and writes sent log on success', async () => {
    mockSend.mockResolvedValueOnce({ data: { id: 'resend-msg-1' }, error: null });
    const { sendEmail } = await import('../sender');
    const result = await sendEmail({
      to: 'jane@example.com',
      subject: 'Hello',
      template: <div>x</div>,
      siteId: 'site-1',
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.id).toBe('resend-msg-1');
    expect(mockSetLog).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'sent', resendId: 'resend-msg-1' })
    );
  });

  it('returns failure and writes failed log on Resend error', async () => {
    mockSend.mockResolvedValueOnce({
      data: null,
      error: { message: 'Rate limited', name: 'rate_limit' },
    });
    const { sendEmail } = await import('../sender');
    const result = await sendEmail({
      to: 'jane@example.com',
      subject: 'Hello',
      template: <div>x</div>,
      siteId: 'site-1',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('Rate limited');
    expect(mockSetLog).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed', errorCode: 'rate_limit' })
    );
  });

  it('blocks dev allowlist violations and tags log', async () => {
    process.env.NODE_ENV = 'development';
    process.env.EMAIL_DEV_ALLOWLIST = '@clicker.id';
    const { sendEmail } = await import('../sender');
    const result = await sendEmail({
      to: 'random@example.com',
      subject: 'Hello',
      template: <div>x</div>,
      siteId: 'site-1',
    });
    expect(result.ok).toBe(true);
    expect(mockSend).not.toHaveBeenCalled();
    expect(mockSetLog).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'sent',
        tags: expect.arrayContaining([{ name: 'dev_blocked', value: 'true' }]),
      })
    );
  });

  it('normalizes string to/cc/bcc into arrays in the log doc', async () => {
    mockSend.mockResolvedValueOnce({ data: { id: 'r2' }, error: null });
    const { sendEmail } = await import('../sender');
    await sendEmail({
      to: 'a@clicker.id',
      cc: 'b@clicker.id',
      subject: 's',
      template: <div>x</div>,
      siteId: null,
    });
    expect(mockSetLog).toHaveBeenCalledWith(
      expect.objectContaining({ to: ['a@clicker.id'], cc: ['b@clicker.id'] })
    );
  });

  it('passes through tags into Resend and log', async () => {
    mockSend.mockResolvedValueOnce({ data: { id: 'r3' }, error: null });
    const { sendEmail } = await import('../sender');
    await sendEmail({
      to: 'a@clicker.id',
      subject: 's',
      template: <div>x</div>,
      siteId: null,
      tags: [{ name: 'module', value: 'forms' }],
    });
    const sendCall = mockSend.mock.calls[0]![0];
    expect(sendCall.tags).toEqual([{ name: 'module', value: 'forms' }]);
    expect(mockSetLog).toHaveBeenCalledWith(
      expect.objectContaining({ tags: [{ name: 'module', value: 'forms' }] })
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd clicker-platform-v2 && pnpm vitest run lib/email/__tests__/sender.test.ts`
Expected: FAIL — module `'../sender'` does not exist.

- [ ] **Step 3: Write the implementation**

Create `clicker-platform-v2/lib/email/sender.ts`:
```ts
import { logger } from '@/lib/logger';
import { getResendClient } from './resend-client';
import { getEmailContext } from './context';
import { renderTemplate } from './render';
import { isAllowedInDev } from './guard';
import { newLogDocRef, writeEmailLog } from './log';
import { formatFrom, resolveDefaultSender } from './config';
import type { SendEmailInput, SendEmailResult, EmailTag } from './types';

function toArray(v: string | string[] | undefined): string[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const toList = toArray(input.to);
  const ccList = toArray(input.cc);
  const bccList = toArray(input.bcc);

  const context = await getEmailContext(input.siteId);
  const sender = resolveDefaultSender();
  const fromHeader = formatFrom(context.fromName, sender);
  const replyTo = input.replyTo ?? context.replyTo ?? undefined;

  const logRef = newLogDocRef(input.siteId);
  const baseLog = {
    to: toList,
    cc: ccList.length ? ccList : null,
    bcc: bccList.length ? bccList : null,
    subject: input.subject,
    fromName: context.fromName,
    fromAddress: context.fromAddress,
    replyTo: replyTo ?? null,
    siteId: input.siteId,
    tags: input.tags ?? [],
    attemptCount: 1,
  };

  // Dev guard: short-circuit before render or send.
  if (!isAllowedInDev(toList)) {
    const devTags: EmailTag[] = [
      ...(input.tags ?? []),
      { name: 'dev_blocked', value: 'true' },
    ];
    await writeEmailLog(logRef, {
      ...baseLog,
      tags: devTags,
      status: 'sent',
      resendId: null,
      error: null,
      errorCode: null,
      sentAt: new Date(),
    });
    logger.info('email.dev.blocked', { to: toList, subject: input.subject });
    return { ok: true, id: 'dev_blocked', logId: logRef.id };
  }

  let html: string;
  let text: string;
  try {
    const rendered = await renderTemplate(input.template);
    html = rendered.html;
    text = rendered.text;
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await writeEmailLog(logRef, {
      ...baseLog,
      status: 'failed',
      resendId: null,
      error: `Template render failed: ${error}`,
      errorCode: 'render_error',
      sentAt: null,
    });
    logger.error('email.render.failed', { siteId: input.siteId, error });
    return { ok: false, error: `Template render failed: ${error}`, logId: logRef.id };
  }

  try {
    const client = getResendClient();
    const resp = await client.emails.send({
      from: fromHeader,
      to: toList,
      cc: ccList.length ? ccList : undefined,
      bcc: bccList.length ? bccList : undefined,
      replyTo: replyTo,
      subject: input.subject,
      html,
      text,
      tags: input.tags ?? [],
    });

    if (resp.error) {
      const error = resp.error.message ?? 'Unknown Resend error';
      const errorCode =
        (resp.error as { name?: string; statusCode?: number }).name ?? null;
      await writeEmailLog(logRef, {
        ...baseLog,
        status: 'failed',
        resendId: null,
        error,
        errorCode,
        sentAt: null,
      });
      logger.error('email.send.failed', { siteId: input.siteId, error, errorCode });
      return { ok: false, error, logId: logRef.id };
    }

    const resendId = resp.data?.id ?? null;
    await writeEmailLog(logRef, {
      ...baseLog,
      status: 'sent',
      resendId,
      error: null,
      errorCode: null,
      sentAt: new Date(),
    });
    return { ok: true, id: resendId ?? '', logId: logRef.id };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await writeEmailLog(logRef, {
      ...baseLog,
      status: 'failed',
      resendId: null,
      error,
      errorCode: 'exception',
      sentAt: null,
    });
    logger.error('email.send.exception', { siteId: input.siteId, error });
    return { ok: false, error, logId: logRef.id };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd clicker-platform-v2 && pnpm vitest run lib/email/__tests__/sender.test.ts`
Expected: all 5 tests PASS.

- [ ] **Step 5: Run full email module tests**

Run: `cd clicker-platform-v2 && pnpm vitest run lib/email`
Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add clicker-platform-v2/lib/email/sender.ts clicker-platform-v2/lib/email/__tests__/sender.test.ts
git commit -m "feat(email): add sendEmail orchestrator with audit logging"
```

---

### Task 12: Public barrel export

**Files:**
- Create: `clicker-platform-v2/lib/email/index.ts`

- [ ] **Step 1: Write the file**

Create `clicker-platform-v2/lib/email/index.ts`:
```ts
export { sendEmail } from './sender';
export { getEmailContext } from './context';
export type {
  SendEmailInput,
  SendEmailResult,
  EmailContext,
  EmailLogDoc,
  EmailTag,
} from './types';
export { FormSubmission } from './templates/system/FormSubmission';
export { PasswordReset } from './templates/system/PasswordReset';
export { EmailVerification } from './templates/system/EmailVerification';
export { SystemAlert } from './templates/system/SystemAlert';
```

- [ ] **Step 2: Verify TypeScript**

Run:
```bash
cd clicker-platform-v2 && pnpm tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add clicker-platform-v2/lib/email/index.ts
git commit -m "feat(email): add public barrel"
```

---

## Phase 4 — Migrate existing form notification

### Task 13: Migrate `forms/submit` to new transport

**Files:**
- Modify: `clicker-platform-v2/app/api/forms/submit/route.ts`
- Delete: `clicker-platform-v2/lib/email.ts`

- [ ] **Step 1: Update the route**

Edit `clicker-platform-v2/app/api/forms/submit/route.ts`:

Replace:
```ts
                if (emailTo) {
                    const { sendFormNotification } = await import('@/lib/email');
                    await sendFormNotification(emailTo, formTitle, data, fieldLabels);
                }
```

With:
```ts
                if (emailTo) {
                    const { sendEmail, FormSubmission } = await import('@/lib/email');
                    await sendEmail({
                        to: emailTo,
                        siteId,
                        subject: `New submission: ${formTitle}`,
                        template: <FormSubmission
                            context={await (await import('@/lib/email')).getEmailContext(siteId)}
                            formTitle={formTitle}
                            data={data}
                            fieldLabels={fieldLabels}
                        />,
                        tags: [
                            { name: 'module', value: 'core_crm' },
                            { name: 'template', value: 'form-submission' },
                        ],
                    });
                }
```

Wait — the template needs `context`, but `sendEmail` already resolves context internally and the `EmailLayout` *currently* takes context as a prop. There are two approaches: (a) pass context twice (caller passes once for the body template, sender resolves again — wasteful); (b) refactor templates to read context from a React context provider injected by the renderer.

Approach (b) keeps callers simple. **Refactor first** — split into Step 1a/1b. (See Task 13a below — corrected.) Skip this step; proceed to Task 13a.

- [ ] **Step 2: (skipped — see 13a)**

---

### Task 13a: Refactor templates to receive context via React Context, then migrate the route

**Files:**
- Modify: `clicker-platform-v2/lib/email/render.ts`
- Modify: `clicker-platform-v2/lib/email/templates/EmailLayout.tsx`
- Create: `clicker-platform-v2/lib/email/email-context-provider.tsx`
- Modify: `clicker-platform-v2/lib/email/templates/system/FormSubmission.tsx` (remove `context` prop)
- Modify: `clicker-platform-v2/lib/email/templates/system/PasswordReset.tsx` (remove `context` prop)
- Modify: `clicker-platform-v2/lib/email/templates/system/EmailVerification.tsx` (remove `context` prop)
- Modify: `clicker-platform-v2/lib/email/templates/system/SystemAlert.tsx` (remove `context` prop)
- Modify: `clicker-platform-v2/lib/email/sender.ts` (wrap template with provider before render)
- Modify: `clicker-platform-v2/lib/email/__tests__/render.test.ts` (use context provider)
- Modify: `clicker-platform-v2/app/api/forms/submit/route.ts` (caller no longer threads context)
- Delete: `clicker-platform-v2/lib/email.ts`

- [ ] **Step 1: Create context provider**

Create `clicker-platform-v2/lib/email/email-context-provider.tsx`:
```tsx
import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import type { EmailContext } from './types';

const Ctx = createContext<EmailContext | null>(null);

export function EmailContextProvider({
  context,
  children,
}: {
  context: EmailContext;
  children: ReactNode;
}) {
  return <Ctx.Provider value={context}>{children}</Ctx.Provider>;
}

export function useEmailContext(): EmailContext {
  const value = useContext(Ctx);
  if (!value) {
    throw new Error('useEmailContext must be used inside EmailContextProvider');
  }
  return value;
}
```

- [ ] **Step 2: Update `EmailLayout` to read context from provider**

Replace top of `clicker-platform-v2/lib/email/templates/EmailLayout.tsx`:
```tsx
import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Section,
  Text,
  Img,
  Link,
} from '@react-email/components';
import type { ReactNode } from 'react';
import { useEmailContext } from '../email-context-provider';

type Props = {
  preview: string;
  children: ReactNode;
};

export function EmailLayout({ preview, children }: Props) {
  const context = useEmailContext();
  return (
    // ... rest unchanged from Task 6
```

(Body of the component stays the same; just remove `context` from props.)

- [ ] **Step 3: Update each system template — remove `context` prop**

For `FormSubmission.tsx`, `PasswordReset.tsx`, `EmailVerification.tsx`, `SystemAlert.tsx`:
- Remove `context: EmailContext` from `Props`.
- Remove `context` from destructure.
- Drop `context={context}` from `<EmailLayout>` usage.
- Where they previously used `context.brand.primaryColor` (Button), import `useEmailContext`:

For `PasswordReset.tsx`:
```tsx
import { Text } from '@react-email/components';
import { EmailLayout } from '../EmailLayout';
import { Heading } from '../components/Heading';
import { Button } from '../components/Button';
import { useEmailContext } from '../../email-context-provider';

type Props = { resetUrl: string };

export function PasswordReset({ resetUrl }: Props) {
  const ctx = useEmailContext();
  return (
    <EmailLayout preview="Reset your password">
      <Heading>Reset your password</Heading>
      <Text style={{ margin: '12px 0 20px', color: '#374151', fontSize: '14px', lineHeight: 1.6 }}>
        We received a request to reset the password for your account. Click the button below to choose a new one. If you didn&apos;t request this, you can safely ignore this email.
      </Text>
      <Button href={resetUrl} primaryColor={ctx.brand.primaryColor}>
        Reset password
      </Button>
      <Text style={{ margin: '20px 0 0', color: '#9ca3af', fontSize: '12px' }}>
        This link expires in 1 hour.
      </Text>
    </EmailLayout>
  );
}
```

Apply the analogous change to `EmailVerification.tsx`, `FormSubmission.tsx`, `SystemAlert.tsx`.

- [ ] **Step 4: Update render module to wrap with provider**

Replace `clicker-platform-v2/lib/email/render.ts`:
```ts
import { render } from '@react-email/render';
import type { ReactElement } from 'react';
import { createElement } from 'react';
import { EmailContextProvider } from './email-context-provider';
import type { EmailContext } from './types';

export async function renderTemplate(
  template: ReactElement,
  context: EmailContext
): Promise<{ html: string; text: string }> {
  const wrapped = createElement(EmailContextProvider, { context }, template);
  const [html, text] = await Promise.all([
    render(wrapped),
    render(wrapped, { plainText: true }),
  ]);
  return { html, text };
}
```

- [ ] **Step 5: Update sender to pass context to render**

Edit `clicker-platform-v2/lib/email/sender.ts` — change:
```ts
    const rendered = await renderTemplate(input.template);
```
to:
```ts
    const rendered = await renderTemplate(input.template, context);
```

- [ ] **Step 6: Update render test to pass context**

Edit `clicker-platform-v2/lib/email/__tests__/render.test.ts`:

Both `renderTemplate(...)` calls become `renderTemplate(<FormSubmission ... />, ctx)`. Drop `context={ctx}` from the FormSubmission props.

```ts
  it('renders FormSubmission to HTML and text', async () => {
    const out = await renderTemplate(
      <FormSubmission
        formTitle="Contact form"
        data={{ name: 'Jane', email: 'jane@example.com' }}
      />,
      ctx
    );
    // ...
  });
```

- [ ] **Step 7: Update form submit route**

Edit `clicker-platform-v2/app/api/forms/submit/route.ts`:

The file is currently a `.ts` route. Templates are JSX, so the route file must be `.tsx`. Two options: rename to `route.tsx`, or build the element via `createElement`. Use `createElement` to keep `.ts` extension and minimize file rename churn.

Replace the email block (lines 31–46):
```ts
        // Email notification — fetch form to get emailNotificationTo
        try {
            if (!formId) throw new Error('formId missing');
            const formDoc = await adminDb.collection('sites').doc(siteId).collection('forms').doc(formId).get();
            if (formDoc.exists) {
                const emailTo = formDoc.data()?.emailNotificationTo;
                if (emailTo) {
                    const { sendEmail, FormSubmission } = await import('@/lib/email');
                    const { createElement } = await import('react');
                    await sendEmail({
                        to: emailTo,
                        siteId,
                        subject: `New submission: ${formTitle}`,
                        template: createElement(FormSubmission, { formTitle, data, fieldLabels }),
                        tags: [
                            { name: 'module', value: 'core_crm' },
                            { name: 'template', value: 'form-submission' },
                        ],
                    });
                }
            } else {
                logger.warn('form.not.found', { siteId, formId });
            }
        } catch (emailError) {
            // Email failure should not block the submission
            logger.warn('form.email.notify.failed', { siteId, error: emailError });
        }
```

- [ ] **Step 8: Delete old email module**

Run:
```bash
rm clicker-platform-v2/lib/email.ts
```

- [ ] **Step 9: Run all email tests**

Run: `cd clicker-platform-v2 && pnpm vitest run lib/email`
Expected: all tests PASS.

- [ ] **Step 10: Run typecheck**

Run: `cd clicker-platform-v2 && pnpm tsc --noEmit`
Expected: no errors. If `route.ts` complains about JSX in `createElement`, that's fine — `createElement` is plain TS.

- [ ] **Step 11: Smoke test — submit a form locally**

Run dev server: `cd clicker-platform-v2 && pnpm dev`
Manually: visit a tenant page with a form, fill it out, submit it.
Verify in Firebase console:
- New doc in `sites/{siteId}/inbox/`
- New doc in `sites/{siteId}/emailLog/` with `status: 'sent'` (or `sent` + `dev_blocked` tag if email is non-allowlisted)

- [ ] **Step 12: Commit**

```bash
git add clicker-platform-v2/lib/email/ \
        clicker-platform-v2/app/api/forms/submit/route.ts
git rm clicker-platform-v2/lib/email.ts
git commit -m "refactor(email): migrate form submission to new transport; drop inline email.ts"
```

---

### Task 14: Add `email:dev` smoke check

**Files:**
- (no file changes; verification only)

- [ ] **Step 1: Run preview server**

Run: `cd clicker-platform-v2 && pnpm email:dev`
Expected: server starts at `http://localhost:3001`. Browser shows all four system templates rendering.

- [ ] **Step 2: Visually inspect**

Open each of `FormSubmission`, `PasswordReset`, `EmailVerification`, `SystemAlert` in the preview and verify layout looks correct (header, body, footer).

Note: the preview tool uses **dummy** context values since templates now read from React context. Add a wrapper file under `lib/email/templates/_preview.tsx` if needed:

```tsx
import type { ReactElement } from 'react';
import { EmailContextProvider } from '../email-context-provider';
import type { EmailContext } from '../types';

const previewContext: EmailContext = {
  fromName: 'Acme Coffee',
  fromAddress: 'noreply@clicker.id',
  replyTo: null,
  brand: {
    businessName: 'Acme Coffee',
    logoUrl: null,
    primaryColor: '#ff6600',
    siteUrl: 'https://acme.clicker.id',
  },
};

export function withPreviewContext(template: ReactElement) {
  return <EmailContextProvider context={previewContext}>{template}</EmailContextProvider>;
}
```

If the preview tool can't handle missing context out of the box, wrap each system template's preview-default in this helper. (React Email picks up `export default` from each template file.)

- [ ] **Step 3: No commit — verification only**

---

## Phase 5 — Sync infrastructure

### Task 15: Sync script

**Files:**
- Create: `scripts/sync-email-module.sh`

- [ ] **Step 1: Write the script**

Create `scripts/sync-email-module.sh`:
```bash
#!/usr/bin/env bash
# Syncs lib/email/ from the platform into auth-gateway.
# Run after any edit to lib/email/. CI will fail if drift exists.

set -euo pipefail

SRC="clicker-platform-v2/lib/email"
DST="auth-gateway/lib/email"

if [ ! -d "$SRC" ]; then
  echo "Source directory $SRC not found. Run from repo root." >&2
  exit 1
fi

# Wipe destination __tests__ — auth-gateway doesn't run vitest yet.
rm -rf "$DST"
mkdir -p "$DST"
cp -R "$SRC/." "$DST/"

# Drop tests; auth-gateway has no vitest setup.
rm -rf "$DST/__tests__"

echo "Synced $SRC -> $DST (tests excluded)."
```

- [ ] **Step 2: Make executable**

Run: `chmod +x scripts/sync-email-module.sh`

- [ ] **Step 3: Commit**

```bash
git add scripts/sync-email-module.sh
git commit -m "chore(email): add sync script for platform -> auth-gateway"
```

---

### Task 16: CI drift check

**Files:**
- Create: `.github/workflows/email-module-sync-check.yml`

- [ ] **Step 1: Write the workflow**

Create `.github/workflows/email-module-sync-check.yml`:
```yaml
name: Email Module Sync Check

on:
  pull_request:
    paths:
      - 'clicker-platform-v2/lib/email/**'
      - 'auth-gateway/lib/email/**'
      - 'scripts/sync-email-module.sh'

jobs:
  diff:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Compare directories (excluding __tests__)
        run: |
          if [ ! -d auth-gateway/lib/email ]; then
            echo "auth-gateway/lib/email does not exist yet — skipping."
            exit 0
          fi
          # Build temp copy of platform without __tests__, diff against auth-gateway/lib/email.
          tmp=$(mktemp -d)
          cp -R clicker-platform-v2/lib/email/. "$tmp/"
          rm -rf "$tmp/__tests__"
          if ! diff -r "$tmp" auth-gateway/lib/email; then
            echo ""
            echo "::error::lib/email/ is out of sync between platform and auth-gateway."
            echo "Run: ./scripts/sync-email-module.sh"
            exit 1
          fi
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/email-module-sync-check.yml
git commit -m "ci(email): add drift check for synced lib/email"
```

---

## Phase 6 — Auth-gateway integration

### Task 17: Sync `lib/email/` into auth-gateway

**Files:**
- Created (via script): `auth-gateway/lib/email/` (full directory)

- [ ] **Step 1: Run sync**

Run: `./scripts/sync-email-module.sh`
Expected: `auth-gateway/lib/email/` populated, `__tests__/` absent.

- [ ] **Step 2: Verify presence**

Run: `ls auth-gateway/lib/email/`
Expected: `config.ts`, `context.ts`, `guard.ts`, `index.ts`, `log.ts`, `render.ts`, `resend-client.ts`, `sender.ts`, `templates/`, `types.ts`, `email-context-provider.tsx`. No `__tests__/`.

- [ ] **Step 3: Commit**

```bash
git add auth-gateway/lib/email
git commit -m "feat(auth-gateway): sync lib/email/ from platform"
```

---

### Task 18: Install Resend + React Email in auth-gateway

**Files:**
- Modify: `auth-gateway/package.json`

- [ ] **Step 1: Install runtime deps**

Run:
```bash
cd auth-gateway && pnpm add resend @react-email/components @react-email/render
```

- [ ] **Step 2: Verify**

Run: `cd auth-gateway && pnpm list resend @react-email/components @react-email/render`
Expected: all three listed.

- [ ] **Step 3: Verify build still works**

Run: `cd auth-gateway && pnpm build`
Expected: build succeeds. Note: `@/lib/firebase-admin` and `@/lib/logger` imports inside synced files must resolve.

If `@/lib/logger` is missing in auth-gateway, this is the moment to add a minimal local logger. Check:
```bash
ls auth-gateway/lib/logger.ts 2>/dev/null
```

If absent, create a minimal one (Step 4).

- [ ] **Step 4: Add minimal logger to auth-gateway (only if missing)**

If `auth-gateway/lib/logger.ts` does not exist, create it:
```ts
type LogContext = Record<string, unknown>;

function log(level: 'error' | 'warn' | 'info', event: string, ctx?: LogContext) {
  const payload = { level, event, ts: new Date().toISOString(), ...ctx };
  if (level === 'error') console.error(JSON.stringify(payload));
  else if (level === 'warn') console.warn(JSON.stringify(payload));
  else console.log(JSON.stringify(payload));
}

export const logger = {
  error: (event: string, ctx?: LogContext) => log('error', event, ctx),
  warn: (event: string, ctx?: LogContext) => log('warn', event, ctx),
  info: (event: string, ctx?: LogContext) => log('info', event, ctx),
};
```

- [ ] **Step 5: Adjust `firebase-admin` import in synced files (if needed)**

Auth-gateway's `firebase-admin.ts` exports `adminApp` and `adminAuth` but **not** `adminDb` or `FieldValue`. The synced `log.ts` and `context.ts` need both.

Edit `auth-gateway/lib/firebase-admin.ts` to add the missing exports:
```ts
import * as admin from 'firebase-admin';
// ... existing code ...
export const adminApp = getAdminApp();
export const adminAuth = admin.auth(adminApp);
export const adminDb = admin.firestore(adminApp);
export const FieldValue = admin.firestore.FieldValue;
export const Timestamp = admin.firestore.Timestamp;
```

- [ ] **Step 6: Re-run build**

Run: `cd auth-gateway && pnpm build`
Expected: build succeeds.

- [ ] **Step 7: Commit**

```bash
git add auth-gateway/package.json auth-gateway/pnpm-lock.yaml auth-gateway/lib/firebase-admin.ts
# Also stage logger.ts only if it was created in Step 4.
[ -f auth-gateway/lib/logger.ts ] && git add auth-gateway/lib/logger.ts
git commit -m "feat(auth-gateway): install email deps; export adminDb/FieldValue"
```

---

### Task 19: `resolveSiteFromEmail` helper

**Files:**
- Create: `auth-gateway/lib/resolve-site-from-email.ts`

- [ ] **Step 1: Write the helper**

Create `auth-gateway/lib/resolve-site-from-email.ts`:
```ts
import { adminDb } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';

/**
 * Best-effort lookup: given an email, find the most relevant siteId.
 * Strategy:
 * 1. sites where ownerEmail == email → first match.
 * 2. members across sites (collectionGroup) where email matches → first match.
 * Returns null if not found.
 */
export async function resolveSiteFromEmail(email: string): Promise<string | null> {
  try {
    const ownerSnap = await adminDb
      .collection('sites')
      .where('ownerEmail', '==', email)
      .limit(1)
      .get();
    if (!ownerSnap.empty) return ownerSnap.docs[0]!.id;

    const memberSnap = await adminDb
      .collectionGroup('members')
      .where('email', '==', email)
      .limit(1)
      .get();
    if (!memberSnap.empty) {
      const ref = memberSnap.docs[0]!.ref;
      const siteRef = ref.parent.parent;
      return siteRef ? siteRef.id : null;
    }
    return null;
  } catch (error) {
    logger.warn('auth.resolve.site.failed', { email, error });
    return null;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add auth-gateway/lib/resolve-site-from-email.ts
git commit -m "feat(auth-gateway): add resolveSiteFromEmail helper"
```

---

### Task 20: In-memory rate limiter

**Files:**
- Create: `auth-gateway/lib/rate-limit.ts`

- [ ] **Step 1: Write the limiter**

Create `auth-gateway/lib/rate-limit.ts`:
```ts
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitResult = { ok: true } | { ok: false; retryAfter: number };

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  if (bucket.count >= limit) {
    return { ok: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  bucket.count += 1;
  return { ok: true };
}

export function _resetRateLimit() {
  buckets.clear();
}
```

- [ ] **Step 2: Commit**

```bash
git add auth-gateway/lib/rate-limit.ts
git commit -m "feat(auth-gateway): add in-memory rate limiter"
```

---

### Task 21: Password-reset endpoint

**Files:**
- Create: `auth-gateway/app/api/password-reset/route.ts`

- [ ] **Step 1: Write the route**

Create `auth-gateway/app/api/password-reset/route.ts`:
```ts
import { NextResponse } from 'next/server';
import { createElement } from 'react';
import { adminAuth } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';
import { sendEmail, PasswordReset } from '@/lib/email';
import { resolveSiteFromEmail } from '@/lib/resolve-site-from-email';
import { rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const GATEWAY_URL =
  process.env.NEXT_PUBLIC_AUTH_GATEWAY_URL ?? 'http://localhost:3012';

export async function POST(request: Request) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown';

  const limit = rateLimit(`pwreset:${ip}`, 5, 60 * 60 * 1000);
  if (!limit.ok) {
    return NextResponse.json(
      { ok: true },
      { status: 200, headers: { 'Retry-After': String(limit.retryAfter) } }
    );
  }

  let email: string | undefined;
  try {
    const body = await request.json();
    email = body?.email;
  } catch {
    return NextResponse.json({ ok: true });
  }

  if (!email || typeof email !== 'string') {
    return NextResponse.json({ ok: true });
  }

  // Email enumeration safety: always return ok regardless of existence.
  try {
    await adminAuth.getUserByEmail(email);
  } catch {
    logger.info('auth.password.reset.unknown', { email });
    return NextResponse.json({ ok: true });
  }

  try {
    const resetUrl = await adminAuth.generatePasswordResetLink(email, {
      url: `${GATEWAY_URL}/`,
      handleCodeInApp: false,
    });
    const siteId = await resolveSiteFromEmail(email);
    await sendEmail({
      to: email,
      siteId,
      subject: 'Reset your password',
      template: createElement(PasswordReset, { resetUrl }),
      tags: [
        { name: 'flow', value: 'auth' },
        { name: 'template', value: 'password-reset' },
      ],
    });
  } catch (error) {
    logger.error('auth.password.reset.failed', { email, error });
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Verify build**

Run: `cd auth-gateway && pnpm build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add auth-gateway/app/api/password-reset/route.ts
git commit -m "feat(auth-gateway): add POST /api/password-reset endpoint"
```

---

### Task 22: Email-verification endpoint

**Files:**
- Create: `auth-gateway/app/api/email-verification/route.ts`

- [ ] **Step 1: Write the route**

Create `auth-gateway/app/api/email-verification/route.ts`:
```ts
import { NextResponse } from 'next/server';
import { createElement } from 'react';
import { adminAuth } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';
import { sendEmail, EmailVerification } from '@/lib/email';
import { resolveSiteFromEmail } from '@/lib/resolve-site-from-email';
import { rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const GATEWAY_URL =
  process.env.NEXT_PUBLIC_AUTH_GATEWAY_URL ?? 'http://localhost:3012';

export async function POST(request: Request) {
  // Auth required: caller must present a Firebase ID token via Authorization: Bearer <token>.
  const authHeader = request.headers.get('authorization') ?? '';
  const m = authHeader.match(/^Bearer (.+)$/i);
  if (!m) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let callerUid: string;
  let callerEmail: string | null;
  try {
    const decoded = await adminAuth.verifyIdToken(m[1]);
    callerUid = decoded.uid;
    callerEmail = decoded.email ?? null;
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const limit = rateLimit(`verify:${ip}:${callerUid}`, 5, 60 * 60 * 1000);
  if (!limit.ok) {
    return NextResponse.json(
      { ok: true },
      { status: 200, headers: { 'Retry-After': String(limit.retryAfter) } }
    );
  }

  let email: string | undefined;
  try {
    const body = await request.json();
    email = body?.email ?? callerEmail ?? undefined;
  } catch {
    email = callerEmail ?? undefined;
  }

  if (!email) {
    return NextResponse.json({ error: 'Email required' }, { status: 400 });
  }

  // Only allow self-verification unless caller is admin.
  // For the foundation: caller's email must match the requested email.
  if (email !== callerEmail) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const verifyUrl = await adminAuth.generateEmailVerificationLink(email, {
      url: `${GATEWAY_URL}/`,
      handleCodeInApp: false,
    });
    const siteId = await resolveSiteFromEmail(email);
    await sendEmail({
      to: email,
      siteId,
      subject: 'Verify your email address',
      template: createElement(EmailVerification, { verifyUrl }),
      tags: [
        { name: 'flow', value: 'auth' },
        { name: 'template', value: 'email-verification' },
      ],
    });
  } catch (error) {
    logger.error('auth.email.verify.failed', { email, error });
    return NextResponse.json({ error: 'Failed to send' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Verify build**

Run: `cd auth-gateway && pnpm build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add auth-gateway/app/api/email-verification/route.ts
git commit -m "feat(auth-gateway): add POST /api/email-verification endpoint"
```

---

### Task 23: Forgot-password page UI

**Files:**
- Create: `auth-gateway/app/forgot-password/page.tsx`

- [ ] **Step 1: Write the page**

Create `auth-gateway/app/forgot-password/page.tsx`:
```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || loading) return;
    setLoading(true);
    try {
      await fetch('/api/password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
    } catch {
      // Always show the same message — do not leak existence.
    }
    setSubmitted(true);
    setLoading(false);
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
      <div className="w-full max-w-sm bg-white p-6 rounded-lg border border-gray-200">
        <h1 className="text-lg font-semibold text-gray-900 mb-1">Forgot password</h1>
        <p className="text-sm text-gray-600 mb-4">
          Enter your account email. If it&apos;s registered, we&apos;ll send a reset link.
        </p>
        {submitted ? (
          <div className="text-sm text-gray-700">
            If <strong>{email}</strong> is registered, a reset link has been sent.
            Please check your inbox (and spam folder).
            <div className="mt-4">
              <Link href="/" className="text-sm text-gray-900 underline">
                Back to login
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-2 bg-gray-900 text-white rounded-md text-sm font-medium disabled:opacity-60"
            >
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
            <Link
              href="/"
              className="block text-center text-xs text-gray-600 hover:underline"
            >
              Back to login
            </Link>
          </form>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Add link from login page**

Edit `auth-gateway/app/page.tsx` to include a "Forgot password?" link near the password input. Locate the password field, then add below it:

```tsx
<Link href="/forgot-password" className="text-xs text-gray-600 hover:underline">
  Forgot password?
</Link>
```

(Add `import Link from 'next/link';` to the top of the file if not already present.)

- [ ] **Step 3: Verify build**

Run: `cd auth-gateway && pnpm build`
Expected: build succeeds.

- [ ] **Step 4: Smoke test**

Run dev: `cd auth-gateway && pnpm dev`
Open `http://localhost:3012/forgot-password`. Submit with a known email (allowlisted in dev). Verify:
- Confirmation message shown.
- `sites/{siteId}/emailLog/` (or `system/email/emailLog/`) has a doc with `status: 'sent'` and `tags` containing `{flow: auth, template: password-reset}`.
- Email arrives at the test inbox.

- [ ] **Step 5: Commit**

```bash
git add auth-gateway/app/forgot-password/page.tsx auth-gateway/app/page.tsx
git commit -m "feat(auth-gateway): add forgot-password page + login link"
```

---

### Task 24: Sync check passes

**Files:**
- (no file changes)

- [ ] **Step 1: Run sync script one more time**

Run: `./scripts/sync-email-module.sh`

- [ ] **Step 2: Verify no diff**

Run:
```bash
tmp=$(mktemp -d) && cp -R clicker-platform-v2/lib/email/. "$tmp/" && rm -rf "$tmp/__tests__" && diff -r "$tmp" auth-gateway/lib/email && echo "in sync"
```
Expected: prints `in sync` with no diff output.

- [ ] **Step 3: Commit any sync deltas**

```bash
git add -A auth-gateway/lib/email
if ! git diff --cached --quiet; then
  git commit -m "chore(email): re-sync auth-gateway/lib/email with platform"
fi
```

---

## Phase 7 — Documentation

### Task 25: Add a brief README to `lib/email/`

**Files:**
- Create: `clicker-platform-v2/lib/email/README.md`

- [ ] **Step 1: Write README**

Create `clicker-platform-v2/lib/email/README.md`:
```markdown
# lib/email — Resend email transport

Single entry point: `sendEmail({ to, subject, template, siteId, ... })`.

- Templates live in `templates/system/` (core) or `lib/modules/{name}/emails/` (module-owned).
- All templates wrap `<EmailLayout>` and read tenant context via `useEmailContext()`.
- Every send writes one audit doc to `sites/{siteId}/emailLog/{id}` (or `system/email/emailLog` for `siteId: null`).
- Dev allowlist guard prevents accidental sends to non-allowlisted addresses.

## Usage

```ts
import { sendEmail, FormSubmission } from '@/lib/email';
import { createElement } from 'react';

const result = await sendEmail({
  to: 'owner@acme.com',
  siteId: 'site-1',
  subject: 'New submission: Contact form',
  template: createElement(FormSubmission, { formTitle, data, fieldLabels }),
  tags: [{ name: 'module', value: 'core_crm' }],
});
```

## Env vars

See `superpowers/specs/2026-05-02-resend-email-foundation-design.md` Section 9.

## Sync to auth-gateway

After editing this directory, run from repo root:

```bash
./scripts/sync-email-module.sh
```

CI fails on PRs if the two copies drift.

## Preview templates locally

```bash
pnpm email:dev
```

Opens at `http://localhost:3001`.
```

- [ ] **Step 2: Commit**

```bash
git add clicker-platform-v2/lib/email/README.md
git commit -m "docs(email): add lib/email README"
```

---

## Final Verification

### Task 26: Full test + build sweep

- [ ] **Step 1: Run all tests**

Run: `cd clicker-platform-v2 && pnpm test`
Expected: all tests pass (existing + new email module tests).

- [ ] **Step 2: Lint**

Run: `cd clicker-platform-v2 && pnpm lint`
Expected: no errors.

- [ ] **Step 3: Build platform**

Run: `cd clicker-platform-v2 && pnpm build`
Expected: build succeeds.

- [ ] **Step 4: Build auth-gateway**

Run: `cd auth-gateway && pnpm build`
Expected: build succeeds.

- [ ] **Step 5: Verify CI sync workflow lints**

Run: `node -e "require('js-yaml').load(require('fs').readFileSync('.github/workflows/email-module-sync-check.yml', 'utf8'))"` (or use any YAML validator).
Expected: parses without error.

- [ ] **Step 6: Final commit if anything was missed**

```bash
git status
# If any tracked changes remain, commit them with a clear message.
```

---

## Out of Scope (explicit non-goals; do not implement here)

- Retry worker / scheduled Cloud Function for failed sends.
- Per-tenant verified domains.
- Admin UI to view email logs.
- Bulk send / batching primitives.
- Per-tenant template overrides.
- Localization (i18n).
- Other channels (in-app, push, WhatsApp).

These are all noted in the spec and left as deliberate parking-lot items with concrete extension points already in place (`status` union extends, `tags` field allows filtering, etc.).
