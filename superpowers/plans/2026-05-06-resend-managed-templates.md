# Resend-Managed Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrasi `sendEmail()` dari render React Email di kode ke Resend-managed templates — template diedit di resend.com dashboard, kode hanya kirim `templateAlias` + `variables`.

**Architecture:** Hapus `template: ReactElement` + render step dari `lib/email/`. Ganti dengan `templateAlias: string` + `variables: Record<string, string>`. Tenant context (`businessName`) tetap di-resolve dari Firestore dan diinjeksi otomatis sebagai variable. Audit log, dev allowlist, dan semua mekanisme foundation tetap berjalan.

**Tech Stack:** Next.js 16, TypeScript, `resend@^6`, Vitest, Firebase Admin SDK.

**Spec:** [`superpowers/specs/2026-05-06-resend-managed-templates-design.md`](../specs/2026-05-06-resend-managed-templates-design.md)

---

## File Structure

### Dimodifikasi — `clicker-platform-v2/lib/email/`

| File | Perubahan |
|------|-----------|
| `types.ts` | Hapus `ReactElement` import + `subject`/`template` field; tambah `templateAlias` + `variables` |
| `config.ts` | Tambah `getTemplateAliases()` |
| `sender.ts` | Hapus render step + render import; kirim `templateAlias` + `variables` ke Resend |
| `index.ts` | Hapus export template components |
| `__tests__/config.test.ts` | Tambah tests untuk `getTemplateAliases()` |
| `__tests__/sender.test.tsx` | Rewrite — assert `templateAlias`/`variables`, hapus render mock |

### Dihapus — `clicker-platform-v2/lib/email/`

| File/Folder |
|-------------|
| `templates/` (seluruh folder) |
| `render.ts` |
| `email-context-provider.tsx` |
| `__tests__/render.test.tsx` |

### Dimodifikasi — callers

| File | Perubahan |
|------|-----------|
| `clicker-platform-v2/app/api/forms/submit/route.ts` | Ganti `sendEmail({ template: createElement(...) })` → `sendEmail({ templateAlias, variables })` |
| `auth-gateway/app/api/password-reset/route.ts` | Ganti ke `templateAlias` + `variables` |
| `auth-gateway/app/api/email-verification/route.ts` | Ganti ke `templateAlias` + `variables` |

### Sync

| File |
|------|
| `auth-gateway/lib/email/` — di-sync via `./scripts/sync-email-module.sh` |

---

## Phase 1 — Update types + config

### Task 1: Update `types.ts`

**Files:**
- Modify: `clicker-platform-v2/lib/email/types.ts`

- [ ] **Step 1: Rewrite file**

Ganti isi `clicker-platform-v2/lib/email/types.ts` menjadi:

```ts
import type { Timestamp } from 'firebase-admin/firestore';

export type EmailTag = { name: string; value: string };

export type SendEmailInput = {
  to: string | string[];
  templateAlias: string;
  variables: Record<string, string>;
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

Note: `subject` tetap ada di `EmailLogDoc` untuk audit log — diisi dari `templateAlias` karena subject asli tidak diketahui sebelum Resend render.

- [ ] **Step 2: Verify TypeScript**

Run:
```bash
cd clicker-platform-v2 && pnpm tsc --noEmit 2>&1 | grep "lib/email/types" | head -5
```
Expected: tidak ada error dari `lib/email/types.ts`.

---

### Task 2: Tambah `getTemplateAliases()` ke `config.ts`

**Files:**
- Modify: `clicker-platform-v2/lib/email/config.ts`
- Modify: `clicker-platform-v2/lib/email/__tests__/config.test.ts`

- [ ] **Step 1: Tambah failing test**

Append ke `clicker-platform-v2/lib/email/__tests__/config.test.ts`:

```ts
describe('getTemplateAliases', () => {
  it('returns hardcoded defaults when env vars not set', () => {
    delete process.env.RESEND_TEMPLATE_PASSWORD_RESET;
    delete process.env.RESEND_TEMPLATE_EMAIL_VERIFY;
    delete process.env.RESEND_TEMPLATE_FORM_SUBMISSION;
    delete process.env.RESEND_TEMPLATE_SYSTEM_ALERT;
    const aliases = getTemplateAliases();
    expect(aliases.passwordReset).toBe('password-reset');
    expect(aliases.emailVerification).toBe('email-verification');
    expect(aliases.formSubmission).toBe('form-submission');
    expect(aliases.systemAlert).toBe('system-alert');
  });

  it('reads from env vars when set', () => {
    process.env.RESEND_TEMPLATE_PASSWORD_RESET = 'pw-reset-v2';
    process.env.RESEND_TEMPLATE_EMAIL_VERIFY = 'verify-v2';
    const aliases = getTemplateAliases();
    expect(aliases.passwordReset).toBe('pw-reset-v2');
    expect(aliases.emailVerification).toBe('verify-v2');
  });
});
```

Tambah `getTemplateAliases` ke import di atas file test:
```ts
import { resolveDefaultSender, getDevAllowlistSuffixes, getSystemDefaults, getTemplateAliases } from '../config';
```

- [ ] **Step 2: Run test untuk verify fail**

Run: `cd clicker-platform-v2 && pnpm vitest run lib/email/__tests__/config.test.ts`
Expected: FAIL — `getTemplateAliases is not a function`.

- [ ] **Step 3: Tambah implementasi ke `config.ts`**

Append ke `clicker-platform-v2/lib/email/config.ts`:

```ts
export function getTemplateAliases() {
  return {
    passwordReset: process.env.RESEND_TEMPLATE_PASSWORD_RESET ?? 'password-reset',
    emailVerification: process.env.RESEND_TEMPLATE_EMAIL_VERIFY ?? 'email-verification',
    formSubmission: process.env.RESEND_TEMPLATE_FORM_SUBMISSION ?? 'form-submission',
    systemAlert: process.env.RESEND_TEMPLATE_SYSTEM_ALERT ?? 'system-alert',
  };
}
```

- [ ] **Step 4: Run test untuk verify pass**

Run: `cd clicker-platform-v2 && pnpm vitest run lib/email/__tests__/config.test.ts`
Expected: semua tests PASS.

---

## Phase 2 — Rewrite `sender.ts`

### Task 3: Rewrite `sender.ts` + tests

**Files:**
- Modify: `clicker-platform-v2/lib/email/sender.ts`
- Modify: `clicker-platform-v2/lib/email/__tests__/sender.test.tsx`

- [ ] **Step 1: Rewrite test file**

Ganti seluruh isi `clicker-platform-v2/lib/email/__tests__/sender.test.tsx`:

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
  writeEmailLog: async (_ref: unknown, doc: unknown) => mockSetLog(doc),
  getLogCollection: () => ({}),
}));

vi.mock('../context', () => ({
  getEmailContext: (...args: unknown[]) => mockGetCtx(...args),
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
      templateAlias: 'password-reset',
      variables: { resetLink: 'https://example.com/reset' },
      siteId: 'site-1',
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.id).toBe('resend-msg-1');
    expect(mockSetLog).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'sent', resendId: 'resend-msg-1' })
    );
  });

  it('sends templateAlias and merged variables to Resend', async () => {
    mockSend.mockResolvedValueOnce({ data: { id: 'r1' }, error: null });
    const { sendEmail } = await import('../sender');
    await sendEmail({
      to: 'jane@example.com',
      templateAlias: 'password-reset',
      variables: { resetLink: 'https://example.com/reset' },
      siteId: 'site-1',
    });
    const sendCall = mockSend.mock.calls[0]![0];
    expect(sendCall.templateAlias).toBe('password-reset');
    expect(sendCall.variables).toMatchObject({
      resetLink: 'https://example.com/reset',
      businessName: 'Acme',
    });
    expect(sendCall.html).toBeUndefined();
    expect(sendCall.text).toBeUndefined();
  });

  it('returns failure and writes failed log on Resend error', async () => {
    mockSend.mockResolvedValueOnce({
      data: null,
      error: { message: 'Rate limited', name: 'rate_limit' },
    });
    const { sendEmail } = await import('../sender');
    const result = await sendEmail({
      to: 'jane@example.com',
      templateAlias: 'password-reset',
      variables: {},
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
      templateAlias: 'password-reset',
      variables: {},
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
      templateAlias: 'system-alert',
      variables: {},
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
      templateAlias: 'form-submission',
      variables: {},
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

- [ ] **Step 2: Run tests untuk verify fail**

Run: `cd clicker-platform-v2 && pnpm vitest run lib/email/__tests__/sender.test.tsx`
Expected: FAIL — `templateAlias` tidak ada di `SendEmailInput`.

- [ ] **Step 3: Rewrite `sender.ts`**

Ganti seluruh isi `clicker-platform-v2/lib/email/sender.ts`:

```ts
import { logger } from '@/lib/logger';
import { getResendClient } from './resend-client';
import { getEmailContext } from './context';
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
    subject: input.templateAlias,
    fromName: context.fromName,
    fromAddress: context.fromAddress,
    replyTo: replyTo ?? null,
    siteId: input.siteId,
    tags: input.tags ?? [],
    attemptCount: 1,
  };

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
    logger.info('email.dev.blocked', { to: toList.join(','), templateAlias: input.templateAlias });
    return { ok: true, id: 'dev_blocked', logId: logRef.id };
  }

  try {
    const client = getResendClient();
    const resp = await client.emails.send({
      from: fromHeader,
      to: toList,
      cc: ccList.length ? ccList : undefined,
      bcc: bccList.length ? bccList : undefined,
      replyTo,
      // @ts-expect-error — resend SDK types may not yet expose templateAlias; it works at runtime
      templateAlias: input.templateAlias,
      variables: {
        ...input.variables,
        businessName: context.fromName,
      },
      tags: input.tags ?? [],
    });

    if (resp.error) {
      const error = resp.error.message ?? 'Unknown Resend error';
      const errorCode = (resp.error as { name?: string }).name ?? null;
      await writeEmailLog(logRef, {
        ...baseLog,
        status: 'failed',
        resendId: null,
        error,
        errorCode,
        sentAt: null,
      });
      logger.error('email.send.failed', { siteId: input.siteId ?? undefined, error });
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
    logger.error('email.send.exception', { siteId: input.siteId ?? undefined, error });
    return { ok: false, error, logId: logRef.id };
  }
}
```

- [ ] **Step 4: Run tests untuk verify pass**

Run: `cd clicker-platform-v2 && pnpm vitest run lib/email/__tests__/sender.test.tsx`
Expected: semua 6 tests PASS.

- [ ] **Step 5: Run semua email tests**

Run: `cd clicker-platform-v2 && pnpm vitest run lib/email`
Expected: semua tests PASS (render test akan dihapus di Task berikutnya, untuk sekarang mungkin fail — skip jika hanya render test yang fail).

---

## Phase 3 — Hapus React Email

### Task 4: Hapus templates, render, context-provider + uninstall deps

**Files:**
- Delete: `clicker-platform-v2/lib/email/templates/`
- Delete: `clicker-platform-v2/lib/email/render.ts`
- Delete: `clicker-platform-v2/lib/email/email-context-provider.tsx`
- Delete: `clicker-platform-v2/lib/email/__tests__/render.test.tsx`
- Modify: `clicker-platform-v2/lib/email/index.ts`
- Modify: `clicker-platform-v2/package.json`

- [ ] **Step 1: Hapus files**

Run:
```bash
cd clicker-platform-v2 && \
  rm -rf lib/email/templates && \
  rm -f lib/email/render.ts && \
  rm -f lib/email/email-context-provider.tsx && \
  rm -f lib/email/__tests__/render.test.tsx
```

- [ ] **Step 2: Update `index.ts`**

Ganti seluruh isi `clicker-platform-v2/lib/email/index.ts`:

```ts
export { sendEmail } from './sender';
export { getEmailContext } from './context';
export { getTemplateAliases } from './config';
export type {
  SendEmailInput,
  SendEmailResult,
  EmailContext,
  EmailLogDoc,
  EmailTag,
} from './types';
```

- [ ] **Step 3: Uninstall React Email deps**

Run:
```bash
cd clicker-platform-v2 && pnpm remove @react-email/components @react-email/render react-email
```
Expected: packages removed dari `package.json` dan `pnpm-lock.yaml`.

- [ ] **Step 4: Run semua email tests**

Run: `cd clicker-platform-v2 && pnpm vitest run lib/email`
Expected: semua tests PASS (render test sudah dihapus).

- [ ] **Step 5: Verify TypeScript**

Run: `cd clicker-platform-v2 && pnpm tsc --noEmit 2>&1 | grep "lib/email" | grep -v "__tests__" | head -10`
Expected: tidak ada error dari `lib/email/`.

---

## Phase 4 — Update callers

### Task 5: Update form submit route

**Files:**
- Modify: `clicker-platform-v2/app/api/forms/submit/route.ts`

- [ ] **Step 1: Update email block di route**

Di `clicker-platform-v2/app/api/forms/submit/route.ts`, cari blok email notification dan ganti:

```ts
// SEBELUM
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

// SESUDAH
const { sendEmail } = await import('@/lib/email');
const formDataStr = Object.entries(data as Record<string, string>)
    .map(([k, v]) => `${fieldLabels?.[k] ?? k}: ${v}`)
    .join('\n');
await sendEmail({
    to: emailTo,
    siteId,
    templateAlias: 'form-submission',
    variables: {
        formTitle: formTitle ?? '',
        formData: formDataStr,
    },
    tags: [
        { name: 'module', value: 'core_crm' },
        { name: 'template', value: 'form-submission' },
    ],
});
```

- [ ] **Step 2: Verify TypeScript**

Run: `cd clicker-platform-v2 && pnpm tsc --noEmit 2>&1 | grep "forms/submit" | head -5`
Expected: tidak ada error.

---

### Task 6: Update auth-gateway routes

**Files:**
- Modify: `auth-gateway/app/api/password-reset/route.ts`
- Modify: `auth-gateway/app/api/email-verification/route.ts`

- [ ] **Step 1: Update password-reset route**

Ganti seluruh isi `auth-gateway/app/api/password-reset/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { resolveSiteFromEmail } from '@/lib/resolve-site-from-email';
import { sendEmail } from '@/lib/email';

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for') ?? 'unknown';
  if (!checkRateLimit(`password-reset:${ip}`)) {
    return NextResponse.json({ ok: true });
  }

  try {
    const { email } = await request.json();
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ ok: true });
    }

    const gatewayUrl = process.env.NEXT_PUBLIC_AUTH_GATEWAY_URL ?? 'http://localhost:3012';
    let resetLink: string;
    try {
      resetLink = await adminAuth.generatePasswordResetLink(email, {
        url: `${gatewayUrl}/reset-callback`,
        handleCodeInApp: false,
      });
    } catch {
      return NextResponse.json({ ok: true });
    }

    const siteId = await resolveSiteFromEmail(email);

    await sendEmail({
      to: email,
      siteId,
      templateAlias: 'password-reset',
      variables: { resetLink },
      tags: [{ name: 'template', value: 'password-reset' }],
    });
  } catch (error) {
    logger.error('auth.password-reset.failed', { error });
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Update email-verification route**

Ganti seluruh isi `auth-gateway/app/api/email-verification/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { resolveSiteFromEmail } from '@/lib/resolve-site-from-email';
import { sendEmail } from '@/lib/email';

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for') ?? 'unknown';
  if (!checkRateLimit(`email-verification:${ip}`)) {
    return NextResponse.json({ ok: true });
  }

  try {
    const { email } = await request.json();
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ ok: true });
    }

    let verifyLink: string;
    try {
      verifyLink = await adminAuth.generateEmailVerificationLink(email);
    } catch {
      return NextResponse.json({ ok: true });
    }

    const siteId = await resolveSiteFromEmail(email);

    await sendEmail({
      to: email,
      siteId,
      templateAlias: 'email-verification',
      variables: { verifyLink },
      tags: [{ name: 'template', value: 'email-verification' }],
    });
  } catch (error) {
    logger.error('auth.email-verification.failed', { error });
  }

  return NextResponse.json({ ok: true });
}
```

---

## Phase 5 — Sync + verify

### Task 7: Sync ke auth-gateway + verifikasi akhir

**Files:**
- Sync: `auth-gateway/lib/email/` via script

- [ ] **Step 1: Run sync script**

Run dari repo root:
```bash
./scripts/sync-email-module.sh
```
Expected: `Synced clicker-platform-v2/lib/email -> auth-gateway/lib/email (tests excluded).`

- [ ] **Step 2: Verify auth-gateway tidak ada reference ke React Email**

Run:
```bash
grep -r "react-email\|@react-email" auth-gateway/lib/email/ 2>/dev/null
```
Expected: tidak ada output.

- [ ] **Step 3: Uninstall React Email dari auth-gateway**

Run:
```bash
cd auth-gateway && pnpm remove @react-email/components @react-email/render 2>/dev/null; echo "done"
```
Expected: packages removed (atau "already not installed").

- [ ] **Step 4: Run semua email tests sekali lagi**

Run: `cd clicker-platform-v2 && pnpm vitest run lib/email`
Expected: semua tests PASS.

- [ ] **Step 5: Run TypeScript check platform**

Run: `cd clicker-platform-v2 && pnpm tsc --noEmit 2>&1 | grep "error" | grep -v "__tests__" | grep -v "DocumentReference\|Transaction\|Mock" | head -10`
Expected: tidak ada error di source files.

- [ ] **Step 6: Commit semua perubahan**

Konfirmasi ke user sebelum commit.

```bash
git add \
  clicker-platform-v2/lib/email/ \
  clicker-platform-v2/app/api/forms/submit/route.ts \
  clicker-platform-v2/package.json \
  clicker-platform-v2/pnpm-lock.yaml \
  auth-gateway/lib/email/ \
  auth-gateway/app/api/password-reset/route.ts \
  auth-gateway/app/api/email-verification/route.ts \
  auth-gateway/package.json \
  auth-gateway/pnpm-lock.yaml
git commit -m "feat(email): migrate to Resend-managed templates — remove React Email"
```

---

## Checklist Setup Manual (dilakukan oleh superadmin setelah deploy)

Ini bukan bagian dari kode — langkah satu kali di resend.com:

1. Login ke resend.com → Templates → Create Template
2. Buat 4 templates dengan alias persis:
   - `password-reset` — variables: `{{businessName}}`, `{{resetLink}}`
   - `email-verification` — variables: `{{businessName}}`, `{{verifyLink}}`
   - `form-submission` — variables: `{{businessName}}`, `{{formTitle}}`, `{{formData}}`
   - `system-alert` — variables: `{{businessName}}`, `{{title}}`, `{{body}}`
3. Env vars tidak perlu ditambahkan jika alias sama dengan default — alias default sudah hardcoded sebagai fallback di `getTemplateAliases()`.
