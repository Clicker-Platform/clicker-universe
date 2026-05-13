# Registration Email + Modules Activation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementasi flow email Resend untuk semua transisi registrasi (submit, activate, send-credentials, reject), aktivasi modul di form Create Tenant Backyard via Firestore catalog, password generator dengan kontrol admin, event log dengan TTL 7 hari, dan UI cleanup form Create Tenant.

**Architecture:** Backyard panggil Resend langsung via Next.js API route (no Cloud Function). Platform-v2 reuse `lib/email/sender.ts` existing. Module catalog disimpan di Firestore `platformConfig/modules` sebagai single source of truth. Event log koleksi baru `registrationEvents/` dengan field `expireAt` untuk TTL.

**Tech Stack:** Next.js 16 App Router (Backyard + Platform-v2), Firebase client SDK + Admin SDK, Resend API, Vitest (platform-v2 only — Backyard tidak ada test runner saat ini), TypeScript strict.

**Spec:** `dev/superpowers/specs/2026-05-09-registration-email-and-modules-design.md`

---

## File Structure

### NEW Files

| Path | Responsibility |
|---|---|
| `dev/backyard/lib/email/resend-client.ts` | POST ke Resend API + parse response |
| `dev/backyard/lib/email/guard.ts` | Dev allowlist check |
| `dev/backyard/lib/email/log.ts` | Tulis ke `email_logs/` Firestore |
| `dev/backyard/lib/email/send.ts` | Orchestrator: validate → send → log |
| `dev/backyard/lib/email/types.ts` | TypeScript types untuk email input/output |
| `dev/backyard/lib/registrations/password-generator.ts` | Generate password 8 char (charset aman) |
| `dev/backyard/lib/registrations/event-log.ts` | Tulis ke `registrationEvents/` dengan TTL 7 hari |
| `dev/backyard/lib/platform-config/modules-catalog.ts` | Fetch & cache `platformConfig/modules` |
| `dev/backyard/components/tenants/ModuleSelector.tsx` | Checkbox grid 2 kolom + loading/error state |
| `dev/backyard/app/api/registrations/[id]/send-credentials/route.ts` | API: kirim email kredensial + update flag |
| `dev/backyard/app/api/registrations/[id]/reject/route.ts` | API: update status + kirim email reject |
| `dev/clicker-platform-v2/lib/registration/__tests__/email-hooks.test.ts` | Unit test email hooks di submit-action |
| `scripts/seed-platform-config.ts` | One-time seeder untuk Firestore module catalog |

### MODIFIED Files

| Path | Lines (approx) | Change |
|---|---|---|
| `dev/backyard/app/tenants/page.tsx` | 1-353 | Tambah state modules, ModuleSelector, password auto-gen, regenerate/copy, hosting label, placeholder netral, kirim modules ke CF |
| `dev/backyard/app/registrations/[id]/page.tsx` | 30-90 | Tambah tombol Kirim Kredensial (conditional render) |
| `dev/backyard/app/registrations/[id]/RejectModal.tsx` | (full file) | POST ke API route baru, bukan setStatus langsung |
| `dev/backyard/app/api/registrations/[id]/activate/route.ts` | (full file) | Simpan tempPassword, write event log activated, log promo error |
| `dev/backyard/lib/registrations/types.ts` | (full file) | Tambah field tempPassword, credentialsSent, credentialsSentAt |
| `dev/backyard/.env.development.local` | append | Tambah RESEND_API_KEY, EMAIL_*, RESEND_TEMPLATE_REG_*, ADMIN_NOTIFICATION_EMAIL |
| `dev/clicker-platform-v2/lib/registration/submit-action.ts` | 48-58 | Tambah pemanggilan sendEmail (confirmation + admin notif) |
| `dev/clicker-platform-v2/lib/email/config.ts` | 26-33 | Tambah getRegistrationTemplateAliases() |
| `dev/clicker-platform-v2/.env.development.local` | append | Tambah RESEND_TEMPLATE_REG_*, ADMIN_NOTIFICATION_EMAIL |

---

## Tasks

### Task 1: Password Generator (Backyard)

**Files:**
- Create: `dev/backyard/lib/registrations/password-generator.ts`

- [ ] **Step 1: Create file dengan implementation**

```ts
// dev/backyard/lib/registrations/password-generator.ts
const UPPER  = 'ABCDEFGHJKLMNPQRSTUVWXYZ';   // hindari I, O
const LOWER  = 'abcdefghjkmnpqrstuvwxyz';     // hindari i, l, o
const DIGIT  = '23456789';                    // hindari 0, 1
const SYMBOL = '-_+=!@#$%&';                  // hindari karakter problematik

const ALL = UPPER + LOWER + DIGIT + SYMBOL;

function pick(charset: string): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return charset[buf[0] % charset.length];
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    const j = buf[0] % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function generatePassword(length = 8): string {
  if (length < 4) {
    throw new Error('Password length must be at least 4 to satisfy charset requirements');
  }
  const required = [pick(UPPER), pick(LOWER), pick(DIGIT), pick(SYMBOL)];
  const rest = Array.from({ length: length - required.length }, () => pick(ALL));
  return shuffle([...required, ...rest]).join('');
}
```

- [ ] **Step 2: Verify file kompilasi (Backyard tidak ada vitest)**

Run: `cd dev/backyard && pnpm build 2>&1 | head -20`
Expected: tidak ada error TypeScript untuk file ini.

- [ ] **Step 3: Manual smoke test via Node REPL**

Run: `cd dev/backyard && node --input-type=module -e "const { generatePassword } = await import('./lib/registrations/password-generator.ts'); console.log(generatePassword());"`

Expected: output 8-char string seperti `Kx7-mP2$`.

(Catatan: jika node tidak support .ts import, skip step ini. Verifikasi visual akan dilakukan di Task 8 saat form open.)

- [ ] **Step 4: Commit**

```bash
git add dev/backyard/lib/registrations/password-generator.ts
git commit -m "feat(backyard): tambah password generator 8 char dengan charset aman"
```

---

### Task 2: Update Registration Types (Backyard)

**Files:**
- Modify: `dev/backyard/lib/registrations/types.ts`

- [ ] **Step 1: Read existing types**

Run: `cat dev/backyard/lib/registrations/types.ts`

- [ ] **Step 2: Tambah field baru**

Edit file, tambah 3 field optional di interface `RegistrationRequest` (sebelum penutup `}`):

```ts
  tempPassword?: string | null;
  credentialsSent?: boolean;
  credentialsSentAt?: Timestamp | null;
```

- [ ] **Step 3: Verify file kompilasi**

Run: `cd dev/backyard && pnpm build 2>&1 | grep -i "error" | head`
Expected: tidak ada error baru terkait types.ts.

- [ ] **Step 4: Update `toRegistration()` di api.ts**

File: `dev/backyard/lib/registrations/api.ts`

Tambah baris di dalam fungsi `toRegistration()` sebelum `};`:

```ts
    tempPassword: (data.tempPassword as string | null) ?? null,
    credentialsSent: (data.credentialsSent as boolean) ?? false,
    credentialsSentAt: (data.credentialsSentAt as Timestamp | null) ?? null,
```

- [ ] **Step 5: Commit**

```bash
git add dev/backyard/lib/registrations/types.ts dev/backyard/lib/registrations/api.ts
git commit -m "feat(backyard): tambah tempPassword, credentialsSent, credentialsSentAt ke RegistrationRequest"
```

---

### Task 3: Event Log Helper (Backyard)

**Files:**
- Create: `dev/backyard/lib/registrations/event-log.ts`

- [ ] **Step 1: Create file**

```ts
// dev/backyard/lib/registrations/event-log.ts
import { collection, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export type EventType =
  | 'registration.activated'
  | 'registration.credentials_sent'
  | 'registration.rejected'
  | 'email.failed'
  | 'promo.commit.failed';

const TTL_DAYS = 7;

export interface WriteEventInput {
  type: EventType;
  registrationId: string;
  actorEmail?: string;
  payload?: Record<string, unknown>;
}

export async function writeEvent(input: WriteEventInput): Promise<void> {
  const isError = input.type === 'email.failed' || input.type === 'promo.commit.failed';
  const expireAt = Timestamp.fromMillis(Date.now() + TTL_DAYS * 24 * 60 * 60 * 1000);

  try {
    await addDoc(collection(db, 'registrationEvents'), {
      type: input.type,
      level: isError ? 'error' : 'info',
      registrationId: input.registrationId,
      actorEmail: input.actorEmail ?? null,
      payload: input.payload ?? {},
      createdAt: serverTimestamp(),
      expireAt,
    });
  } catch (err) {
    console.error('[event-log] Failed to write event:', err);
  }
}
```

- [ ] **Step 2: Verify build**

Run: `cd dev/backyard && pnpm build 2>&1 | grep -i "error" | head`
Expected: tidak ada error baru.

- [ ] **Step 3: Commit**

```bash
git add dev/backyard/lib/registrations/event-log.ts
git commit -m "feat(backyard): event log helper dengan TTL 7 hari"
```

---

### Task 4: Email Library — Types & Guard (Backyard)

**Files:**
- Create: `dev/backyard/lib/email/types.ts`
- Create: `dev/backyard/lib/email/guard.ts`

- [ ] **Step 1: Create types.ts**

```ts
// dev/backyard/lib/email/types.ts
export interface SendEmailInput {
  to: string;
  templateAlias: string;
  variables: Record<string, string>;
  registrationId?: string;
}

export type SendEmailResult =
  | { ok: true; resendId: string }
  | { ok: false; error: string };

export interface ResendApiResponse {
  id?: string;
  message?: string;
  name?: string;
  statusCode?: number;
}
```

- [ ] **Step 2: Create guard.ts**

```ts
// dev/backyard/lib/email/guard.ts
function getAllowlist(): string[] {
  const raw = process.env.EMAIL_DEV_ALLOWLIST ?? '@clicker.id,@resend.dev,@gmail.com';
  return raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
}

export function isAllowedInDev(email: string): boolean {
  if (process.env.NODE_ENV === 'production') return true;
  const allowlist = getAllowlist();
  const lower = email.toLowerCase();
  return allowlist.some((suffix) => lower.endsWith(suffix));
}
```

- [ ] **Step 3: Verify build**

Run: `cd dev/backyard && pnpm build 2>&1 | grep -i "error" | head`
Expected: tidak ada error baru.

- [ ] **Step 4: Commit**

```bash
git add dev/backyard/lib/email/types.ts dev/backyard/lib/email/guard.ts
git commit -m "feat(backyard): email types + dev allowlist guard"
```

---

### Task 5: Email Library — Resend Client + Log (Backyard)

**Files:**
- Create: `dev/backyard/lib/email/resend-client.ts`
- Create: `dev/backyard/lib/email/log.ts`

- [ ] **Step 1: Create resend-client.ts**

```ts
// dev/backyard/lib/email/resend-client.ts
import type { ResendApiResponse } from './types';

export interface ResendCallInput {
  from: string;
  to: string;
  templateAlias: string;
  variables: Record<string, string>;
  replyTo?: string;
}

export async function callResend(input: ResendCallInput): Promise<ResendApiResponse> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY is not set');

  const body: Record<string, unknown> = {
    from: input.from,
    to: input.to,
    template_alias: input.templateAlias,
    variables: input.variables,
  };
  if (input.replyTo) body.reply_to = input.replyTo;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as ResendApiResponse;
  if (!res.ok) {
    throw new Error(data.message ?? `Resend API error: ${res.status}`);
  }
  return data;
}
```

- [ ] **Step 2: Create log.ts**

```ts
// dev/backyard/lib/email/log.ts
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface EmailLogInput {
  to: string;
  templateAlias: string;
  fromAddress: string;
  status: 'sent' | 'failed' | 'dev_blocked';
  resendId: string | null;
  error: string | null;
  registrationId?: string;
}

export async function logEmail(input: EmailLogInput): Promise<void> {
  try {
    await addDoc(collection(db, 'email_logs'), {
      to: [input.to],
      cc: null,
      bcc: null,
      subject: input.templateAlias,
      fromName: process.env.EMAIL_SYSTEM_FROM_NAME ?? 'Clicker Platform',
      fromAddress: input.fromAddress,
      replyTo: null,
      siteId: 'platform',
      tags: input.registrationId
        ? [{ name: 'registrationId', value: input.registrationId }]
        : [],
      status: input.status === 'dev_blocked' ? 'sent' : input.status,
      resendId: input.resendId,
      error: input.error,
      errorCode: null,
      attemptCount: 1,
      createdAt: serverTimestamp(),
      sentAt: input.status === 'sent' ? serverTimestamp() : null,
    });
  } catch (err) {
    console.error('[email-log] Failed to write log:', err);
  }
}
```

- [ ] **Step 3: Verify build**

Run: `cd dev/backyard && pnpm build 2>&1 | grep -i "error" | head`
Expected: tidak ada error baru.

- [ ] **Step 4: Commit**

```bash
git add dev/backyard/lib/email/resend-client.ts dev/backyard/lib/email/log.ts
git commit -m "feat(backyard): Resend API client + email log writer"
```

---

### Task 6: Email Library — Orchestrator (Backyard)

**Files:**
- Create: `dev/backyard/lib/email/send.ts`

- [ ] **Step 1: Create send.ts**

```ts
// dev/backyard/lib/email/send.ts
import { isAllowedInDev } from './guard';
import { logEmail } from './log';
import { callResend } from './resend-client';
import type { SendEmailInput, SendEmailResult } from './types';

function getFromHeader(): string {
  const name = process.env.EMAIL_SYSTEM_FROM_NAME ?? 'Clicker Platform';
  const local = process.env.EMAIL_SENDER_LOCAL_PART ?? 'noreply';
  const domain = process.env.EMAIL_SENDER_DOMAIN ?? 'clicker.id';
  return `${name} <${local}@${domain}>`;
}

function getFromAddress(): string {
  const local = process.env.EMAIL_SENDER_LOCAL_PART ?? 'noreply';
  const domain = process.env.EMAIL_SENDER_DOMAIN ?? 'clicker.id';
  return `${local}@${domain}`;
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const fromHeader = getFromHeader();
  const fromAddress = getFromAddress();

  if (!isAllowedInDev(input.to)) {
    await logEmail({
      to: input.to,
      templateAlias: input.templateAlias,
      fromAddress,
      status: 'dev_blocked',
      resendId: null,
      error: null,
      registrationId: input.registrationId,
    });
    return { ok: true, resendId: 'dev_blocked' };
  }

  try {
    const result = await callResend({
      from: fromHeader,
      to: input.to,
      templateAlias: input.templateAlias,
      variables: input.variables,
    });
    await logEmail({
      to: input.to,
      templateAlias: input.templateAlias,
      fromAddress,
      status: 'sent',
      resendId: result.id ?? null,
      error: null,
      registrationId: input.registrationId,
    });
    return { ok: true, resendId: result.id ?? '' };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    await logEmail({
      to: input.to,
      templateAlias: input.templateAlias,
      fromAddress,
      status: 'failed',
      resendId: null,
      error: errorMessage,
      registrationId: input.registrationId,
    });
    return { ok: false, error: errorMessage };
  }
}
```

- [ ] **Step 2: Verify build**

Run: `cd dev/backyard && pnpm build 2>&1 | grep -i "error" | head`
Expected: tidak ada error baru.

- [ ] **Step 3: Commit**

```bash
git add dev/backyard/lib/email/send.ts
git commit -m "feat(backyard): email send orchestrator dengan dev guard + log"
```

---

### Task 7: Module Catalog Fetch (Backyard)

**Files:**
- Create: `dev/backyard/lib/platform-config/modules-catalog.ts`

- [ ] **Step 1: Create file**

```ts
// dev/backyard/lib/platform-config/modules-catalog.ts
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface ModuleCatalogEntry {
  id: string;
  name: string;
  description: string;
  defaultEnabled?: boolean;
}

let cache: ModuleCatalogEntry[] | null = null;

export async function fetchModulesCatalog(): Promise<ModuleCatalogEntry[]> {
  if (cache) return cache;

  const ref = doc(db, 'platformConfig', 'modules');
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    throw new Error('platformConfig/modules not found. Run seeder script.');
  }

  const data = snap.data();
  const catalog = (data?.catalog as ModuleCatalogEntry[]) ?? [];

  if (!Array.isArray(catalog) || catalog.length === 0) {
    throw new Error('platformConfig/modules.catalog is empty or invalid.');
  }

  cache = catalog;
  return catalog;
}

export function clearCatalogCache(): void {
  cache = null;
}
```

- [ ] **Step 2: Verify build**

Run: `cd dev/backyard && pnpm build 2>&1 | grep -i "error" | head`
Expected: tidak ada error baru.

- [ ] **Step 3: Commit**

```bash
git add dev/backyard/lib/platform-config/modules-catalog.ts
git commit -m "feat(backyard): fetch module catalog dari Firestore platformConfig"
```

---

### Task 8: Module Selector Component (Backyard)

**Files:**
- Create: `dev/backyard/components/tenants/ModuleSelector.tsx`

- [ ] **Step 1: Create file**

```tsx
// dev/backyard/components/tenants/ModuleSelector.tsx
'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  fetchModulesCatalog,
  clearCatalogCache,
  type ModuleCatalogEntry,
} from '@/lib/platform-config/modules-catalog';

interface Props {
  value: Record<string, boolean>;
  onChange: (next: Record<string, boolean>) => void;
}

export function ModuleSelector({ value, onChange }: Props) {
  const [catalog, setCatalog] = useState<ModuleCatalogEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchModulesCatalog();
      setCatalog(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function toggle(id: string) {
    onChange({ ...value, [id]: !value[id] });
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-400 text-sm py-4">
        <Loader2 className="w-4 h-4 animate-spin" />
        Memuat katalog modul...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border-2 border-red-200 bg-red-50 p-3 text-sm text-red-700">
        <p className="font-bold">⚠ Gagal memuat katalog modul</p>
        <p className="mt-1">{error}</p>
        <button
          type="button"
          onClick={() => {
            clearCatalogCache();
            load();
          }}
          className="mt-2 px-3 py-1 rounded-lg border border-red-300 text-xs font-bold hover:bg-red-100"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!catalog || catalog.length === 0) {
    return (
      <p className="text-sm text-gray-500 py-2">Tidak ada modul tersedia.</p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      {catalog.map((m) => (
        <label
          key={m.id}
          className="flex items-start gap-2 rounded-lg border-2 border-gray-200 p-2 cursor-pointer hover:border-brand-dark transition-colors"
        >
          <input
            type="checkbox"
            checked={!!value[m.id]}
            onChange={() => toggle(m.id)}
            className="mt-1 w-4 h-4 accent-brand-dark"
          />
          <div>
            <div className="text-sm font-bold text-brand-dark">{m.name}</div>
            <div className="text-xs text-gray-500">{m.description}</div>
          </div>
        </label>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd dev/backyard && pnpm build 2>&1 | grep -i "error" | head`
Expected: tidak ada error baru.

- [ ] **Step 3: Commit**

```bash
git add dev/backyard/components/tenants/ModuleSelector.tsx
git commit -m "feat(backyard): ModuleSelector checkbox grid 2 kolom"
```

---

### Task 9: Seed Platform Config Script

**Files:**
- Create: `scripts/seed-platform-config.ts`

- [ ] **Step 1: Create file**

```ts
// scripts/seed-platform-config.ts
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as path from 'path';

const SERVICE_ACCOUNT_PATH = process.env.GCP_SERVICE_ACCOUNT_KEY
  ?? path.resolve(__dirname, '..', 'clicker-universe-stagging-firebase-adminsdk-fbsvc-e9c7e1b2e5.json');

const catalog = [
  { id: 'byod_pos',        name: 'Self Order POS',  description: 'Cashier, KDS, transactions, menu, and reports.' },
  { id: 'inventory',       name: 'Inventory',        description: 'Stock management with audit trails.' },
  { id: 'reservation',     name: 'Reservation',      description: 'Booking and scheduling for services.' },
  { id: 'membership',      name: 'Membership',       description: 'Loyalty program and member profiles.' },
  { id: 'promo',           name: 'Promo Engine',     description: 'Discount codes, vouchers, and auto-apply rules.' },
  { id: 'service_records', name: 'Service Records',  description: 'Vehicle service history, warranty, and reminders.' },
  { id: 'sales_pipeline',  name: 'Sales Pipeline',   description: 'CRM Kanban board for leads and deals.' },
  { id: 'ai_sales',        name: 'AI Sales Agent',   description: 'Gemini-powered chatbot and lead capture.' },
  { id: 'ai_marketing',    name: 'AI Marketing',     description: 'AI-assisted marketing campaigns and content.' },
];

async function main() {
  initializeApp({ credential: cert(SERVICE_ACCOUNT_PATH) });
  const db = getFirestore();

  await db.doc('platformConfig/modules').set({
    catalog,
    updatedAt: FieldValue.serverTimestamp(),
  });

  console.log(`✓ Seeded platformConfig/modules dengan ${catalog.length} modul.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Seeder failed:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Run seeder**

Run: `cd /Users/mac/Documents/AI\ Project/clicker-platform && pnpm tsx scripts/seed-platform-config.ts`

Expected output: `✓ Seeded platformConfig/modules dengan 9 modul.`

- [ ] **Step 3: Verify in Firestore**

Buka Firebase Console → Firestore → koleksi `platformConfig` → doc `modules`. Verify field `catalog` berisi array 9 entry.

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-platform-config.ts
git commit -m "chore: seed script untuk platformConfig/modules"
```

---

### Task 10: Backyard Env Vars

**Files:**
- Modify: `dev/backyard/.env.development.local`

- [ ] **Step 1: Append baris berikut ke file**

```env

# === Resend (added 2026-05-09) ===
RESEND_API_KEY=
EMAIL_SENDER_DOMAIN=clicker.id
EMAIL_SENDER_LOCAL_PART=noreply
EMAIL_SYSTEM_FROM_NAME=Clicker Platform
EMAIL_DEV_ALLOWLIST=@clicker.id,@resend.dev,@gmail.com

# Resend template aliases
RESEND_TEMPLATE_REG_CONFIRMATION=registration-confirmation
RESEND_TEMPLATE_REG_ADMIN_NOTIF=registration-admin-notif
RESEND_TEMPLATE_REG_ACTIVATED=registration-activated
RESEND_TEMPLATE_REG_REJECTED=registration-rejected

# Notifikasi admin
ADMIN_NOTIFICATION_EMAIL=clickerplatform@gmail.com

# URL untuk link di email
NEXT_PUBLIC_AUTH_URL=http://localhost:3012
NEXT_PUBLIC_TENANT_URL_TEMPLATE=http://{slug}.localhost:3000
```

- [ ] **Step 2: User isi `RESEND_API_KEY`**

Manual: paste API key dari Resend dashboard. **Plan stop di sini sampai user konfirmasi sudah diisi.**

- [ ] **Step 3: Restart dev server Backyard**

Run: `cd dev/backyard && pnpm dev`
Expected: server jalan tanpa error tentang env.

- [ ] **Step 4: Tidak commit** — `.env.development.local` di gitignore.

---

### Task 11: API Route — Send Credentials (Backyard)

**Files:**
- Create: `dev/backyard/app/api/registrations/[id]/send-credentials/route.ts`

- [ ] **Step 1: Create file**

```ts
// dev/backyard/app/api/registrations/[id]/send-credentials/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { sendEmail } from '@/lib/email/send';
import { writeEvent } from '@/lib/registrations/event-log';
import { REGISTRATION_REQUESTS_COLLECTION } from '@/lib/registrations/constants';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ref = doc(db, REGISTRATION_REQUESTS_COLLECTION, id);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
    }

    const data = snap.data();
    if (data.status !== 'activated') {
      return NextResponse.json({ error: 'Registrasi belum di-activate' }, { status: 400 });
    }
    if (data.credentialsSent === true) {
      return NextResponse.json({ error: 'Kredensial sudah pernah dikirim' }, { status: 409 });
    }
    if (!data.tempPassword) {
      return NextResponse.json({ error: 'Password tidak tersedia (mungkin sudah dihapus)' }, { status: 400 });
    }
    if (!data.activatedSiteId || !data.email) {
      return NextResponse.json({ error: 'Data registrasi tidak lengkap' }, { status: 400 });
    }

    const slug = data.activatedSiteId as string;
    const tenantUrlTemplate = process.env.NEXT_PUBLIC_TENANT_URL_TEMPLATE ?? 'https://{slug}.clicker.id';
    const authUrl = process.env.NEXT_PUBLIC_AUTH_URL ?? 'https://auth.clicker.id';

    const result = await sendEmail({
      to: data.email as string,
      templateAlias: process.env.RESEND_TEMPLATE_REG_ACTIVATED ?? 'registration-activated',
      variables: {
        name: (data.name as string) ?? '',
        businessName: (data.businessName as string) ?? '',
        loginEmail: data.email as string,
        password: data.tempPassword as string,
        slug,
        authUrl,
        tenantUrl: tenantUrlTemplate.replace('{slug}', slug),
      },
      registrationId: id,
    });

    if (!result.ok) {
      await writeEvent({
        type: 'email.failed',
        registrationId: id,
        payload: { type: 'credentials', error: result.error },
      });
      return NextResponse.json({ error: `Gagal kirim email: ${result.error}` }, { status: 500 });
    }

    await updateDoc(ref, {
      credentialsSent: true,
      credentialsSentAt: serverTimestamp(),
      tempPassword: null,
      updatedAt: serverTimestamp(),
    });

    await writeEvent({
      type: 'registration.credentials_sent',
      registrationId: id,
      payload: { to: data.email, slug },
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify build**

Run: `cd dev/backyard && pnpm build 2>&1 | grep -i "error" | head`
Expected: tidak ada error baru.

- [ ] **Step 3: Commit**

```bash
git add dev/backyard/app/api/registrations/[id]/send-credentials/route.ts
git commit -m "feat(backyard): API route send-credentials dengan validation + email + event log"
```

---

### Task 12: API Route — Reject (Backyard)

**Files:**
- Create: `dev/backyard/app/api/registrations/[id]/reject/route.ts`

- [ ] **Step 1: Create file**

```ts
// dev/backyard/app/api/registrations/[id]/reject/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { setStatus, getRegistration } from '@/lib/registrations/api';
import { sendEmail } from '@/lib/email/send';
import { writeEvent } from '@/lib/registrations/event-log';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { reason } = await req.json();

    if (!reason || typeof reason !== 'string') {
      return NextResponse.json({ error: 'Reason wajib diisi' }, { status: 400 });
    }

    const reg = await getRegistration(id);
    if (!reg) {
      return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
    }

    await setStatus(id, 'rejected', { rejectionReason: reason });

    const emailResult = await sendEmail({
      to: reg.email,
      templateAlias: process.env.RESEND_TEMPLATE_REG_REJECTED ?? 'registration-rejected',
      variables: {
        name: reg.name,
        businessName: reg.businessName,
        reason,
      },
      registrationId: id,
    });

    if (!emailResult.ok) {
      await writeEvent({
        type: 'email.failed',
        registrationId: id,
        payload: { type: 'rejected', error: emailResult.error },
      });
    }

    await writeEvent({
      type: 'registration.rejected',
      registrationId: id,
      payload: { reason, emailSent: emailResult.ok },
    });

    return NextResponse.json({ success: true, emailSent: emailResult.ok });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify build**

Run: `cd dev/backyard && pnpm build 2>&1 | grep -i "error" | head`
Expected: tidak ada error baru.

- [ ] **Step 3: Commit**

```bash
git add dev/backyard/app/api/registrations/[id]/reject/route.ts
git commit -m "feat(backyard): API route reject dengan email + event log"
```

---

### Task 13: Update Activate Route — Save tempPassword + Event Log (Backyard)

**Files:**
- Modify: `dev/backyard/app/api/registrations/[id]/activate/route.ts`

- [ ] **Step 1: Read existing file**

Run: `cat dev/backyard/app/api/registrations/\[id\]/activate/route.ts`

- [ ] **Step 2: Replace seluruh isi file dengan versi baru**

```ts
// dev/backyard/app/api/registrations/[id]/activate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getRegistration, setStatus } from '@/lib/registrations/api';
import { commitRegistrationPromo } from '@/lib/promo/api';
import { writeEvent } from '@/lib/registrations/event-log';
import { REGISTRATION_REQUESTS_COLLECTION } from '@/lib/registrations/constants';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { siteId, tempPassword } = await req.json();

    if (!siteId) {
      return NextResponse.json({ error: 'Missing siteId' }, { status: 400 });
    }

    const reg = await getRegistration(id);
    if (!reg) {
      return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
    }

    // 1. Update status registrasi
    await setStatus(id, 'activated', { activatedSiteId: siteId });

    // 2. Simpan tempPassword (jika dikirim)
    if (tempPassword) {
      const ref = doc(db, REGISTRATION_REQUESTS_COLLECTION, id);
      await updateDoc(ref, { tempPassword, updatedAt: serverTimestamp() });
    }

    // 3. Promo commit (best-effort)
    if (reg.promoCode) {
      try {
        await commitRegistrationPromo(siteId, reg.promoCode);
      } catch (promoErr: unknown) {
        const msg = promoErr instanceof Error ? promoErr.message : 'Unknown error';
        await writeEvent({
          type: 'promo.commit.failed',
          registrationId: id,
          payload: { promoCode: reg.promoCode, error: msg },
        });
      }
    }

    // 4. Event log: activated
    await writeEvent({
      type: 'registration.activated',
      registrationId: id,
      payload: { siteId, hasPromo: !!reg.promoCode },
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
```

- [ ] **Step 3: Verify build**

Run: `cd dev/backyard && pnpm build 2>&1 | grep -i "error" | head`
Expected: tidak ada error baru.

- [ ] **Step 4: Commit**

```bash
git add dev/backyard/app/api/registrations/[id]/activate/route.ts
git commit -m "feat(backyard): activate route simpan tempPassword + event log"
```

---

### Task 14: Update Reject Modal — Pakai API Route (Backyard)

**Files:**
- Modify: `dev/backyard/app/registrations/[id]/RejectModal.tsx`

- [ ] **Step 1: Read existing file**

Run: `cat dev/backyard/app/registrations/\[id\]/RejectModal.tsx`

- [ ] **Step 2: Identify `setStatus` call dan ganti dengan fetch ke API route**

Cari pemanggilan `setStatus(id, 'rejected', { rejectionReason: reason })` dan ganti dengan:

```ts
const res = await fetch(`/api/registrations/${id}/reject`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ reason }),
});
if (!res.ok) {
  const data = await res.json();
  throw new Error(data.error ?? 'Reject gagal');
}
```

Pastikan import `setStatus` dihapus jika tidak terpakai lagi.

- [ ] **Step 3: Verify build**

Run: `cd dev/backyard && pnpm build 2>&1 | grep -i "error" | head`
Expected: tidak ada error baru.

- [ ] **Step 4: Commit**

```bash
git add dev/backyard/app/registrations/[id]/RejectModal.tsx
git commit -m "feat(backyard): RejectModal pakai API route reject (untuk email + log)"
```

---

### Task 15: Update Tenants Page — Module Selector + Password Generator + Hosting Label (Backyard)

**Files:**
- Modify: `dev/backyard/app/tenants/page.tsx`

Task ini cukup besar, dipecah jadi sub-step.

- [ ] **Step 1: Tambah import**

Di bagian import (atas file), tambah:

```tsx
import { generatePassword } from '@/lib/registrations/password-generator';
import { ModuleSelector } from '@/components/tenants/ModuleSelector';
import { Copy, RefreshCw } from 'lucide-react';
```

- [ ] **Step 2: Update state**

Cari baris `const [hostingId, setHostingId] = useState('quattro');` dan ganti dengan `useState('clickerapps')`.

Tambah state baru setelah `const [seedSampleData, setSeedSampleData] = useState(true);`:

```tsx
    const [modules, setModules] = useState<Record<string, boolean>>({});
```

- [ ] **Step 3: Auto-generate password saat showCreate true**

Tambah `useEffect` setelah `useEffect` yang sudah ada untuk fetchTenants:

```tsx
    useEffect(() => {
        if (showCreate && !password) {
            setPassword(generatePassword());
        }
    }, [showCreate]);
```

- [ ] **Step 4: Resolve modules dari registrasi**

Cari `useEffect` untuk `fromRegistration`. Update body-nya:

```tsx
    useEffect(() => {
        if (!fromRegistration) return;
        getRegistration(fromRegistration).then(async (r) => {
            if (!r) return;
            setRegistration(r);
            setName(r.businessName);
            setOwnerEmail(r.email);
            setSubdomain(suggestSlug(r.businessName));
            setShowCreate(true);

            // Resolve modules dari bundle/registrasi
            const initial: Record<string, boolean> = {};
            const moduleIds: string[] = r.modules ?? [];
            // Bundle resolution: user sudah expand bundle ke modules saat submit register
            // jadi r.modules sudah berisi list ID, tinggal mark true
            for (const id of moduleIds) {
                initial[id] = true;
            }
            setModules(initial);
        });
    }, [fromRegistration]);
```

- [ ] **Step 5: Kirim modules ke createTenant**

Cari baris:
```tsx
const res: any = await fn({ name, ownerEmail, password, subdomain, hostingId, modules: {}, seedSampleData });
```

Ganti dengan:
```tsx
const res: any = await fn({ name, ownerEmail, password, subdomain, hostingId, modules, seedSampleData });
```

- [ ] **Step 6: Kirim tempPassword ke activate route**

Cari fetch ke `/api/registrations/${fromRegistration}/activate` dan update body:

```tsx
body: JSON.stringify({ siteId: newSiteId, tempPassword: password }),
```

- [ ] **Step 7: Update reset state setelah create**

Cari baris reset (`setName(''); setOwnerEmail(''); ...`) dan tambah:

```tsx
setName(''); setOwnerEmail(''); setPassword(''); setSubdomain('');
setHostingId('clickerapps'); setSeedSampleData(true); setShowCreate(false);
setModules({});
setRegistration(null);
```

- [ ] **Step 8: Update placeholder + hosting label di JSX**

Cari `placeholder="Cafe Quattro"` → ganti `placeholder="My Business"`.
Cari `placeholder="cafe-quattro"` → ganti `placeholder="my-business"`.
Cari `placeholder="owner@cafe.com"` → ganti `placeholder="owner@business.com"`.

Cari `{['quattro', 'aletra'].map(h => (` dan ganti dengan:

```tsx
{['clickerapps'].map(h => (
```

- [ ] **Step 9: Update password input — visible + tombol regenerate + copy**

Cari section Owner Password. Replace seluruh `<div>` block-nya dengan:

```tsx
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Owner Password</label>
                            <div className="flex gap-2 mt-1">
                                <input required type="text" value={password} onChange={e => setPassword(e.target.value)}
                                    className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-xl text-sm font-mono outline-none focus:border-brand-dark"
                                    placeholder="••••••••" />
                                <button type="button" onClick={() => setPassword(generatePassword())}
                                    title="Regenerate"
                                    className="px-3 py-2 rounded-xl border-2 border-gray-200 hover:border-brand-dark text-gray-500">
                                    <RefreshCw className="w-4 h-4" />
                                </button>
                                <button type="button" onClick={() => {
                                    navigator.clipboard.writeText(password);
                                    toast.success('Password disalin');
                                }}
                                    title="Copy"
                                    className="px-3 py-2 rounded-xl border-2 border-gray-200 hover:border-brand-dark text-gray-500">
                                    <Copy className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
```

- [ ] **Step 10: Tambah section ModuleSelector di form**

Cari penutup form (`<div className="col-span-2 flex justify-end">`) — tepat **sebelum** baris itu, tambah:

```tsx
                        <div className="col-span-2">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">
                                Modules to Enable
                            </label>
                            <ModuleSelector value={modules} onChange={setModules} />
                        </div>
```

- [ ] **Step 11: Verify build**

Run: `cd dev/backyard && pnpm build 2>&1 | grep -i "error" | head`
Expected: tidak ada error baru.

- [ ] **Step 12: Manual test browser**

1. `pnpm dev` di Backyard
2. Buka `localhost:3013/tenants`, click "+ New Tenant"
3. Verify: form muncul dengan password auto-generated, hosting `[CLICKERAPPS]`, ModuleSelector loading lalu render 9 modul.
4. Click checkbox modul, click Regenerate (password berubah), click Copy (toast muncul).

- [ ] **Step 13: Commit**

```bash
git add dev/backyard/app/tenants/page.tsx
git commit -m "feat(backyard): tambah ModuleSelector, password gen, hosting label CLICKERAPPS, placeholder netral"
```

---

### Task 16: Tombol Kirim Kredensial (Backyard)

**Files:**
- Modify: `dev/backyard/app/registrations/[id]/page.tsx`

- [ ] **Step 1: Read existing file**

Run: `cat dev/backyard/app/registrations/\[id\]/page.tsx`

- [ ] **Step 2: Tambah state untuk loading + tombol**

Di dalam komponen, setelah `const [showReject, setShowReject] = useState(false);`, tambah:

```tsx
  const [sendingCreds, setSendingCreds] = useState(false);

  async function handleSendCredentials() {
    if (!reg) return;
    if (!confirm(`Kirim email kredensial ke ${reg.email}?`)) return;
    setSendingCreds(true);
    try {
      const res = await fetch(`/api/registrations/${reg.id}/send-credentials`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Gagal kirim');
      alert('✓ Email kredensial terkirim');
      setReg({ ...reg, credentialsSent: true, tempPassword: null });
    } catch (err: any) {
      alert(`Gagal: ${err.message}`);
    } finally {
      setSendingCreds(false);
    }
  }
```

- [ ] **Step 3: Render tombol di header dan info password**

Cari header dengan tombol Activate. Setelah `{reg.status === 'activated' ...}` (jika ada), atau di bawah header — render tombol:

```tsx
        {reg.status === 'activated' && reg.tempPassword && !reg.credentialsSent && (
          <div className="mt-4 rounded-lg border-2 border-orange-200 bg-orange-50 p-4">
            <p className="text-sm font-bold text-orange-900">Tenant aktif — kredensial siap dikirim</p>
            <p className="text-xs text-orange-700 mt-1">Login: <span className="font-mono">{reg.email}</span></p>
            <p className="text-xs text-orange-700">Password: <span className="font-mono font-bold">{reg.tempPassword}</span></p>
            <p className="text-xs text-orange-600 mt-2">Test login dulu di auth.clicker.id, lalu klik kirim.</p>
            <button
              onClick={handleSendCredentials}
              disabled={sendingCreds}
              className="mt-3 px-4 py-2 rounded-lg bg-orange-600 text-white text-sm font-bold disabled:opacity-50"
            >
              {sendingCreds ? 'Mengirim...' : 'Kirim Kredensial via Email'}
            </button>
          </div>
        )}
        {reg.status === 'activated' && reg.credentialsSent && (
          <p className="mt-4 text-sm text-green-700">✓ Kredensial sudah dikirim ke {reg.email}</p>
        )}
```

- [ ] **Step 4: Verify build**

Run: `cd dev/backyard && pnpm build 2>&1 | grep -i "error" | head`
Expected: tidak ada error baru.

- [ ] **Step 5: Commit**

```bash
git add dev/backyard/app/registrations/[id]/page.tsx
git commit -m "feat(backyard): tombol Kirim Kredensial di detail registrasi"
```

---

### Task 17: Platform Email Hooks — Test First (Platform-v2)

**Files:**
- Create: `dev/clicker-platform-v2/lib/registration/__tests__/email-hooks.test.ts`

- [ ] **Step 1: Read existing submit-action test untuk pattern**

Run: `cat dev/clicker-platform-v2/lib/registration/__tests__/submit-action.test.ts | head -60`

- [ ] **Step 2: Create test file**

```ts
// dev/clicker-platform-v2/lib/registration/__tests__/email-hooks.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  sendEmail: vi.fn(),
  createRegistrationRequest: vi.fn(),
  validatePromoCode: vi.fn(),
}));

vi.mock('@/lib/email/sender', () => ({ sendEmail: mocks.sendEmail }));
vi.mock('../api-server', () => ({
  createRegistrationRequest: mocks.createRegistrationRequest,
  validatePromoCode: mocks.validatePromoCode,
}));
vi.mock('next/headers', () => ({
  headers: () => Promise.resolve(new Map([['x-forwarded-for', '127.0.0.1']])),
}));
vi.mock('../rate-limit', () => ({
  submitLimiter: { check: () => true },
}));

beforeEach(() => {
  vi.resetAllMocks();
  process.env.ADMIN_NOTIFICATION_EMAIL = 'admin@test.com';
  process.env.RESEND_TEMPLATE_REG_CONFIRMATION = 'reg-confirm';
  process.env.RESEND_TEMPLATE_REG_ADMIN_NOTIF = 'reg-notif';
});

const validInput = {
  name: 'Test User',
  email: 'test@gmail.com',
  phone: '+6281234567890',
  businessName: 'Test Biz',
  businessType: 'fnb' as const,
  city: 'Jakarta',
  expectedOutlets: 1,
  bundle: null,
  modules: ['byod_pos'],
  customRequest: '',
  promoCode: null,
  promoCodeValidAtSubmit: false,
  source: null,
};

describe('submit-action email hooks', () => {
  it('mengirim 2 email saat submit sukses (pendaftar + admin)', async () => {
    mocks.createRegistrationRequest.mockResolvedValue('reg-123');
    mocks.sendEmail.mockResolvedValue({ ok: true, id: 'email-1', logId: 'log-1' });

    const { submitRegistration } = await import('../submit-action');
    const result = await submitRegistration(validInput);

    expect(result.ok).toBe(true);
    expect(mocks.sendEmail).toHaveBeenCalledTimes(2);

    const calls = mocks.sendEmail.mock.calls;
    const toAddresses = calls.map((c) => c[0].to);
    expect(toAddresses).toContain('test@gmail.com');
    expect(toAddresses).toContain('admin@test.com');
  });

  it('submit tetap sukses meski email gagal kirim', async () => {
    mocks.createRegistrationRequest.mockResolvedValue('reg-123');
    mocks.sendEmail.mockRejectedValue(new Error('Resend down'));

    const { submitRegistration } = await import('../submit-action');
    const result = await submitRegistration(validInput);

    expect(result.ok).toBe(true);
    expect(result).toMatchObject({ ok: true, id: 'reg-123' });
  });

  it('tidak kirim notif admin kalau ADMIN_NOTIFICATION_EMAIL tidak diset', async () => {
    delete process.env.ADMIN_NOTIFICATION_EMAIL;
    mocks.createRegistrationRequest.mockResolvedValue('reg-123');
    mocks.sendEmail.mockResolvedValue({ ok: true, id: 'email-1', logId: 'log-1' });

    const { submitRegistration } = await import('../submit-action');
    await submitRegistration(validInput);

    expect(mocks.sendEmail).toHaveBeenCalledTimes(1);
    expect(mocks.sendEmail.mock.calls[0][0].to).toBe('test@gmail.com');
  });
});
```

- [ ] **Step 3: Run test — expected to fail**

Run: `cd dev/clicker-platform-v2 && pnpm test lib/registration/__tests__/email-hooks.test.ts`
Expected: FAIL — semua 3 test fail karena `submit-action.ts` belum panggil `sendEmail`.

- [ ] **Step 4: Commit**

```bash
git add dev/clicker-platform-v2/lib/registration/__tests__/email-hooks.test.ts
git commit -m "test(platform): email hooks di submit-action (gagal dulu)"
```

---

### Task 18: Implement Platform Email Hooks (Platform-v2)

**Files:**
- Modify: `dev/clicker-platform-v2/lib/registration/submit-action.ts`
- Modify: `dev/clicker-platform-v2/lib/email/config.ts`

- [ ] **Step 1: Tambah template aliases di config.ts**

Edit `dev/clicker-platform-v2/lib/email/config.ts` — extend `getTemplateAliases()`:

```ts
export function getTemplateAliases() {
  return {
    passwordReset: process.env.RESEND_TEMPLATE_PASSWORD_RESET ?? 'password-reset',
    emailVerification: process.env.RESEND_TEMPLATE_EMAIL_VERIFY ?? 'email-verification',
    formSubmission: process.env.RESEND_TEMPLATE_FORM_SUBMISSION ?? 'form-submission',
    systemAlert: process.env.RESEND_TEMPLATE_SYSTEM_ALERT ?? 'system-alert',
    regConfirmation: process.env.RESEND_TEMPLATE_REG_CONFIRMATION ?? 'registration-confirmation',
    regAdminNotif: process.env.RESEND_TEMPLATE_REG_ADMIN_NOTIF ?? 'registration-admin-notif',
  };
}
```

- [ ] **Step 2: Update submit-action.ts**

Edit `dev/clicker-platform-v2/lib/registration/submit-action.ts` — setelah `const id = await createRegistrationRequest(...)` dan sebelum `return { ok: true, id }`:

```ts
    // Fire-and-forget email notifications (failure tidak menggagalkan submit)
    void sendRegistrationEmails(id, data).catch((err) => {
      logger.error('registration.submit.emailHook.failed', { error: err });
    });

    return { ok: true, id };
```

Tambah helper function di akhir file (sebelum penutup):

```ts
async function sendRegistrationEmails(
  id: string,
  data: RegistrationInput
): Promise<void> {
  const { sendEmail } = await import('@/lib/email/sender');
  const aliases = (await import('@/lib/email/config')).getTemplateAliases();

  const promises: Promise<unknown>[] = [];

  // Email 1: konfirmasi ke pendaftar
  promises.push(
    sendEmail({
      to: data.email,
      siteId: 'platform',
      templateAlias: aliases.regConfirmation,
      variables: {
        name: data.name,
        businessName: data.businessName,
        reviewSla: '3 jam',
      },
      tags: [{ name: 'registrationId', value: id }],
    })
  );

  // Email 2: notif ke admin (kalau ENV diset)
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
  if (adminEmail) {
    const backyardUrl = process.env.NEXT_PUBLIC_BACKYARD_URL ?? 'http://localhost:3013';
    promises.push(
      sendEmail({
        to: adminEmail,
        siteId: 'platform',
        templateAlias: aliases.regAdminNotif,
        variables: {
          businessName: data.businessName,
          name: data.name,
          email: data.email,
          phone: data.phone,
          city: data.city,
          bundle: data.bundle ?? '',
          modules: (data.modules ?? []).join(', '),
          promoCode: data.promoCode ?? '',
          customRequest: data.customRequest ?? '',
          backyardUrl: `${backyardUrl}/registrations/${id}`,
        },
        tags: [{ name: 'registrationId', value: id }],
      })
    );
  }

  await Promise.allSettled(promises);
}
```

- [ ] **Step 3: Run test**

Run: `cd dev/clicker-platform-v2 && pnpm test lib/registration/__tests__/email-hooks.test.ts`
Expected: PASS untuk 3 test.

- [ ] **Step 4: Run full test suite untuk regressions**

Run: `cd dev/clicker-platform-v2 && pnpm test lib/registration`
Expected: semua test PASS.

- [ ] **Step 5: Commit**

```bash
git add dev/clicker-platform-v2/lib/registration/submit-action.ts dev/clicker-platform-v2/lib/email/config.ts
git commit -m "feat(platform): kirim email konfirmasi + notif admin saat submit register"
```

---

### Task 19: Platform Env Vars

**Files:**
- Modify: `dev/clicker-platform-v2/.env.development.local`

- [ ] **Step 1: Append env vars**

```env

# === Registration email (added 2026-05-09) ===
RESEND_TEMPLATE_REG_CONFIRMATION=registration-confirmation
RESEND_TEMPLATE_REG_ADMIN_NOTIF=registration-admin-notif
ADMIN_NOTIFICATION_EMAIL=clickerplatform@gmail.com
NEXT_PUBLIC_BACKYARD_URL=http://localhost:3013
```

- [ ] **Step 2: Restart platform-v2**

Run: `cd dev/clicker-platform-v2 && pnpm dev`
Expected: server start tanpa error.

- [ ] **Step 3: Tidak commit** — env file di gitignore.

---

### Task 20: Setup Resend Templates (Manual oleh User)

User task — tidak ada code change.

- [ ] **Step 1: Login ke Resend dashboard**

URL: https://resend.com/templates

- [ ] **Step 2: Verify domain `clicker.id` sudah verified**

Resend dashboard → Domains. Status harus `Verified`. Kalau belum, setup DNS records SPF/DKIM/DMARC.

- [ ] **Step 3: Buat 4 template**

Buat template baru dengan alias berikut (di field "Alias"):

| Alias | Subject | Variables |
|---|---|---|
| `registration-confirmation` | "Terima kasih, {{businessName}} — kami review max {{reviewSla}}" | name, businessName, reviewSla |
| `registration-admin-notif` | "Registrasi baru: {{businessName}}" | businessName, name, email, phone, city, bundle, modules, promoCode, customRequest, backyardUrl |
| `registration-activated` | "Akun {{businessName}} sudah aktif" | name, businessName, loginEmail, password, slug, authUrl, tenantUrl |
| `registration-rejected` | "Registrasi {{businessName}}" | name, businessName, reason |

Konten body: tulis sesuai branding (HTML / plaintext).

- [ ] **Step 4: Konfirmasi template aktif**

Test send dari Resend dashboard ke email Anda untuk verifikasi.

---

### Task 21: Setup Firestore TTL Policy (Manual oleh User)

User task — tidak ada code change.

- [ ] **Step 1: Buka Firebase Console**

URL: https://console.firebase.google.com/project/clicker-universe-stagging/firestore/indexes

- [ ] **Step 2: Tab TTL → Add policy**

- Collection: `registrationEvents`
- Field: `expireAt`

- [ ] **Step 3: Confirm**

Tunggu policy aktif (~beberapa menit). Doc dengan `expireAt` di masa lalu akan dihapus dalam 24-48 jam.

---

### Task 22: E2E Manual Test (Final Verification)

User task — verifikasi semua flow.

- [ ] **Step 1: Submit register (pendaftar baru)**

1. Buka `localhost:3000/register`
2. Isi form lengkap dengan email Gmail Anda
3. Submit
4. Verify: email konfirmasi sampai ke inbox Gmail
5. Verify: email notif sampai ke `clickerplatform@gmail.com`

- [ ] **Step 2: Verify Firestore data**

1. Firebase Console → koleksi `registrationRequests` → doc baru muncul dengan status `pending`
2. Koleksi `email_logs` → 2 doc baru muncul (status `sent`)

- [ ] **Step 3: Activate via Backyard**

1. Buka `localhost:3013/registrations/{id}` (id dari step 2)
2. Click [Activate]
3. Form Create Tenant terbuka, prefilled
4. Verify: password ter-isi otomatis (8 char), hosting `[CLICKERAPPS]`, modules sesuai registrasi
5. Click Regenerate password (verify berubah), Copy (toast muncul)
6. Click [Create Tenant]
7. Verify: tenant baru muncul di list, `/sites/{slug}` dibuat di Firestore dengan modules yang dipilih

- [ ] **Step 4: Verify activation state**

Buka kembali `localhost:3013/registrations/{id}`:
- Verify status `activated`
- Verify section orange "Tenant aktif — kredensial siap dikirim" muncul
- Verify password visible

- [ ] **Step 5: Manual login test**

1. Buka `localhost:3012` (auth-gateway)
2. Login pakai email + password dari step 4
3. Verify: redirect ke admin dashboard tenant baru
4. Verify: modul yang dipilih muncul di sidebar admin

- [ ] **Step 6: Send credentials**

1. Kembali ke detail registrasi
2. Click [Kirim Kredensial via Email]
3. Verify: alert success
4. Verify: password hilang dari UI, ganti pesan "✓ Kredensial sudah dikirim"
5. Verify: email kredensial sampai ke inbox pendaftar
6. Firestore: `tempPassword: null`, `credentialsSent: true`

- [ ] **Step 7: Reject flow**

1. Submit registrasi baru lagi (atau pakai yang lama yang masih pending)
2. Click Reject di detail, isi alasan
3. Verify: email penolakan sampai
4. Verify: status `rejected` di Firestore

- [ ] **Step 8: Verify event log**

Firebase Console → `registrationEvents`:
- Doc untuk activated, credentials_sent, rejected harus ada
- Field `expireAt` ter-set ke +7 hari
- Field `level` benar (info untuk sukses, error untuk failure)

---

## Self-Review

✅ **Spec coverage:**
- §1 Goals → covered di Task 1-19
- §2 Decisions → semua 18 keputusan terimplementasi
- §3 Architecture → file structure match (Backyard API routes + lib/email + Platform-v2 hooks)
- §4 Data flow → semua 5 flow diimplementasi (submit→T17-18, activate→T13, test login→manual T22, send credentials→T11+T16, reject→T12+T14)
- §5 UI Form → T15
- §6 Event log → T3 + integrated di T11/T12/T13
- §7 Module catalog → T7 (fetch) + T9 (seed)
- §8 Password generator → T1 + T15
- §9 Email templates → T20 (manual user)
- §10 Files affected → semua tercover di task list
- §11 Env vars → T10, T19
- §12 Error handling → spread across all API routes
- §13 Testing → T17-T18 (platform unit), T22 (manual E2E)
- §14 Migration → T9, T20, T21

✅ **Placeholder scan:** No "TBD", "TODO", "implement later". All code blocks complete.

✅ **Type consistency:**
- `RegistrationRequest.tempPassword` (T2) → digunakan di T11, T13, T15, T16 ✓
- `RegistrationRequest.credentialsSent` (T2) → digunakan di T11, T16 ✓
- `EventType` (T3) → digunakan di T11, T12, T13 ✓
- `SendEmailInput` (T4) → digunakan di T6, T11, T12 ✓
- `ModuleCatalogEntry` (T7) → digunakan di T8 ✓
- `generatePassword()` (T1) → digunakan di T15 ✓

---

## Execution Notes

**Backyard tidak punya test runner** (vitest/jest) — task Backyard pakai `pnpm build` + manual smoke test untuk verifikasi. Future enhancement: setup vitest di Backyard.

**TDD applied di Platform-v2** (Task 17-18) karena ada vitest infrastructure.

**Manual setup tasks** (T9 seeder, T10 env, T19 env, T20 templates, T21 TTL, T22 E2E) **tidak boleh diskip** — sangat critical untuk flow.

**Total: 22 tasks**, estimated 4-6 jam pengerjaan untuk dev berpengalaman + 30 menit setup manual user.

---

**End of plan.**
