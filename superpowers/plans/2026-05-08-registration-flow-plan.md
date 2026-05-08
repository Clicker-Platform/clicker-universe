# Registration Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a public registration form (`clicker.id/register`) where prospects submit interest with module/bundle selection, custom requests, and an optional promo code; submissions land in a new Backyard screen where the superadmin manually activates them via the existing tenant forge. Promo usage commits on activation only.

**Architecture:** Public Next.js page in `clicker-platform-v2` writes to a root-level `registrationRequests` Firestore collection via a server action with Zod validation and IP rate limiting. A new `validate-promo` public API route uses the promo facade (`findPromoByCode`) for read-only existence checks. Backyard adds a `/registrations` list + detail view; clicking Activate hands a `?fromRegistration={id}` query param to the existing `createTenant` forge, which after success calls a Backyard API route that updates the registration row and commits promo usage best-effort.

**Tech Stack:** Next.js 15 (App Router), Firebase (Firestore, Auth, Cloud Functions, Admin SDK), TypeScript, Zod, Tailwind, Vitest. Existing modules: `lib/modules/promo` (facade with `findPromoByCode`, `commitPromoUsage`), `lib/modules/registry`, Backyard's `createTenant` Cloud Function callable.

**Working directory:** `/Users/andre/Repository/clicker-universe/dev`

**Conventions to follow:**
- All Firestore paths from `lib/registration/constants.ts`, never raw strings
- Server-only Firebase Admin imports stay out of client components
- `pnpm` workspaces — run commands from each app dir (`clicker-platform-v2/`, `backyard/`)
- Frequent commits per step

---

## File Structure

### `clicker-platform-v2/`

| File | Responsibility |
|------|----------------|
| `lib/registration/constants.ts` | Firestore collection path constant |
| `lib/registration/types.ts` | `RegistrationRequest` TS interface, `BusinessType` union |
| `lib/registration/bundles.ts` | `BUNDLES` constant + `Bundle` interface |
| `lib/registration/schema.ts` | Zod schemas for input validation |
| `lib/registration/slug.ts` | Pure `suggestSlug(businessName)` helper |
| `lib/registration/api-server.ts` | Server-only: `createRegistrationRequest`, `validatePromoCode` (uses Admin SDK + promo facade) |
| `lib/registration/rate-limit.ts` | Server-only in-memory LRU IP rate limiter |
| `lib/registration/__tests__/bundles.test.ts` | Test: bundle resolution |
| `lib/registration/__tests__/schema.test.ts` | Test: Zod validation cases |
| `lib/registration/__tests__/slug.test.ts` | Test: slug suggestion |
| `lib/registration/__tests__/rate-limit.test.ts` | Test: rate limiter |
| `app/(public)/register/page.tsx` | Server component shell, renders form |
| `app/(public)/register/RegisterForm.tsx` | Client form with sections |
| `app/(public)/register/sections/ContactSection.tsx` | Name/email/phone/businessName fields |
| `app/(public)/register/sections/BusinessSection.tsx` | Type/city/outlets fields |
| `app/(public)/register/sections/ModulesSection.tsx` | Bundle cards + individual checkboxes |
| `app/(public)/register/sections/CustomRequestSection.tsx` | Textarea |
| `app/(public)/register/sections/PromoCodeSection.tsx` | Input with live validation |
| `app/(public)/register/ThankYou.tsx` | Success state |
| `app/(public)/register/submit-action.ts` | Server action: validate + write |
| `app/api/public/validate-promo/route.ts` | Public GET endpoint |

### `backyard/`

| File | Responsibility |
|------|----------------|
| `lib/registrations/types.ts` | Re-export of platform types (or local copy) |
| `lib/registrations/constants.ts` | Path constant (mirrors platform) |
| `lib/registrations/api.ts` | Client-SDK reads (list, get, update status, save notes) |
| `app/registrations/page.tsx` | List view |
| `app/registrations/[id]/page.tsx` | Detail view |
| `app/registrations/[id]/ActivateButton.tsx` | Routes to existing forge with query param |
| `app/registrations/[id]/RejectModal.tsx` | Rejection reason modal |
| `app/registrations/[id]/InternalNotes.tsx` | Autosave notes textarea |
| `app/registrations/[id]/PromoCard.tsx` | Re-validates promo on mount via API |
| `app/api/registrations/[id]/activate/route.ts` | Post-tenant-create hook: status update + promo commit |
| `app/api/registrations/[id]/reject/route.ts` | Reject endpoint |
| `app/api/registrations/[id]/notes/route.ts` | Notes save endpoint |
| `app/tenants/page.tsx` (modify) | Read `?fromRegistration` param, prefill form, call activate API on success |
| `components/registrations/StatusBadge.tsx` | Status pill |
| `components/registrations/ModulesList.tsx` | Module display with friendly names |

### Firestore rules (modify)
| File | Change |
|------|--------|
| `firestore.rules` | Add `match /registrationRequests/{id}` rules |

---

## Task 1: Scaffold registration types, constants, bundles

**Files:**
- Create: `clicker-platform-v2/lib/registration/constants.ts`
- Create: `clicker-platform-v2/lib/registration/types.ts`
- Create: `clicker-platform-v2/lib/registration/bundles.ts`
- Test: `clicker-platform-v2/lib/registration/__tests__/bundles.test.ts`

- [ ] **Step 1: Write failing test for bundles**

```ts
// clicker-platform-v2/lib/registration/__tests__/bundles.test.ts
import { describe, it, expect } from 'vitest';
import { BUNDLES, getBundleById } from '../bundles';

describe('BUNDLES', () => {
  it('contains the three v1 bundles', () => {
    const ids = BUNDLES.map((b) => b.id).sort();
    expect(ids).toEqual(['auto-detailing', 'beauty-spa', 'restaurant-starter']);
  });

  it('every bundle has at least one module', () => {
    for (const b of BUNDLES) {
      expect(b.modules.length).toBeGreaterThan(0);
    }
  });

  it('getBundleById returns the bundle by id', () => {
    expect(getBundleById('restaurant-starter')?.modules).toEqual(['byod_pos', 'inventory']);
  });

  it('getBundleById returns null for unknown id', () => {
    expect(getBundleById('nope')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd clicker-platform-v2 && pnpm test lib/registration/__tests__/bundles.test.ts`
Expected: FAIL — module `../bundles` not found.

- [ ] **Step 3: Create constants.ts**

```ts
// clicker-platform-v2/lib/registration/constants.ts
export const REGISTRATION_REQUESTS_COLLECTION = 'registrationRequests';
```

- [ ] **Step 4: Create types.ts**

```ts
// clicker-platform-v2/lib/registration/types.ts
import type { Timestamp } from 'firebase/firestore';

export type BusinessType =
  | 'fnb'
  | 'auto-detailing'
  | 'beauty-spa'
  | 'retail'
  | 'service'
  | 'other';

export type RegistrationStatus = 'pending' | 'contacted' | 'activated' | 'rejected';

export interface RegistrationRequest {
  id: string;
  name: string;
  email: string;
  phone: string;
  businessName: string;
  businessType: BusinessType;
  city: string;
  expectedOutlets: number;
  bundle: string | null;
  modules: string[];
  customRequest: string;
  promoCode: string | null;
  promoCodeValidAtSubmit: boolean;
  status: RegistrationStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  activatedSiteId: string | null;
  activatedAt: Timestamp | null;
  rejectionReason: string | null;
  internalNotes: string;
  source: string | null;
}
```

- [ ] **Step 5: Create bundles.ts**

```ts
// clicker-platform-v2/lib/registration/bundles.ts
export interface Bundle {
  id: string;
  name: string;
  description: string;
  modules: string[];
}

export const BUNDLES: Bundle[] = [
  {
    id: 'restaurant-starter',
    name: 'Restaurant Starter',
    description: 'Self-order POS + stock management for cafés and restaurants.',
    modules: ['byod_pos', 'inventory'],
  },
  {
    id: 'auto-detailing',
    name: 'Auto Detailing Pro',
    description: 'Service records, warranty cards, and loyalty for detailing shops.',
    modules: ['service_records', 'membership', 'promo'],
  },
  {
    id: 'beauty-spa',
    name: 'Beauty / Spa',
    description: 'Bookings, member loyalty, and promos for beauty salons and spas.',
    modules: ['reservation', 'membership', 'promo'],
  },
];

export function getBundleById(id: string): Bundle | null {
  return BUNDLES.find((b) => b.id === id) ?? null;
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd clicker-platform-v2 && pnpm test lib/registration/__tests__/bundles.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 7: Commit**

```bash
git add clicker-platform-v2/lib/registration/
git commit -m "feat(registration): scaffold types, constants, bundles"
```

---

## Task 2: Slug suggestion helper

**Files:**
- Create: `clicker-platform-v2/lib/registration/slug.ts`
- Test: `clicker-platform-v2/lib/registration/__tests__/slug.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// clicker-platform-v2/lib/registration/__tests__/slug.test.ts
import { describe, it, expect } from 'vitest';
import { suggestSlug } from '../slug';

describe('suggestSlug', () => {
  it('lowercases and kebab-cases', () => {
    expect(suggestSlug('Warung Pak Budi')).toBe('warung-pak-budi');
  });
  it('strips diacritics and non-alnum', () => {
    expect(suggestSlug('Café São Paulo!')).toBe('cafe-sao-paulo');
  });
  it('collapses repeated separators', () => {
    expect(suggestSlug('  Foo   ___ Bar  ')).toBe('foo-bar');
  });
  it('trims leading/trailing dashes', () => {
    expect(suggestSlug('--hi--')).toBe('hi');
  });
  it('returns empty string for input with no alnum', () => {
    expect(suggestSlug('!!!')).toBe('');
  });
});
```

- [ ] **Step 2: Run test, verify FAIL**

Run: `cd clicker-platform-v2 && pnpm test lib/registration/__tests__/slug.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement slug.ts**

```ts
// clicker-platform-v2/lib/registration/slug.ts
export function suggestSlug(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
```

- [ ] **Step 4: Run test, verify PASS**

Run: `cd clicker-platform-v2 && pnpm test lib/registration/__tests__/slug.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add clicker-platform-v2/lib/registration/slug.ts clicker-platform-v2/lib/registration/__tests__/slug.test.ts
git commit -m "feat(registration): add slug suggestion helper"
```

---

## Task 3: Zod schema for submission payload

**Files:**
- Create: `clicker-platform-v2/lib/registration/schema.ts`
- Test: `clicker-platform-v2/lib/registration/__tests__/schema.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// clicker-platform-v2/lib/registration/__tests__/schema.test.ts
import { describe, it, expect } from 'vitest';
import { registrationSubmitSchema } from '../schema';

const valid = {
  name: 'Budi',
  email: 'budi@example.com',
  phone: '+628123456789',
  businessName: 'Warung Pak Budi',
  businessType: 'fnb',
  city: 'Jakarta',
  expectedOutlets: 1,
  bundle: 'restaurant-starter',
  modules: ['byod_pos', 'inventory'],
  customRequest: '',
  promoCode: null,
  source: null,
};

describe('registrationSubmitSchema', () => {
  it('accepts a valid payload', () => {
    expect(registrationSubmitSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects malformed email', () => {
    const r = registrationSubmitSchema.safeParse({ ...valid, email: 'not-an-email' });
    expect(r.success).toBe(false);
  });

  it('rejects too-short business name', () => {
    const r = registrationSubmitSchema.safeParse({ ...valid, businessName: 'A' });
    expect(r.success).toBe(false);
  });

  it('rejects invalid businessType enum', () => {
    const r = registrationSubmitSchema.safeParse({ ...valid, businessType: 'crypto' });
    expect(r.success).toBe(false);
  });

  it('rejects expectedOutlets < 1', () => {
    const r = registrationSubmitSchema.safeParse({ ...valid, expectedOutlets: 0 });
    expect(r.success).toBe(false);
  });

  it('rejects empty intent (no modules and empty customRequest)', () => {
    const r = registrationSubmitSchema.safeParse({ ...valid, modules: [], customRequest: '   ' });
    expect(r.success).toBe(false);
  });

  it('accepts empty modules when customRequest is filled', () => {
    const r = registrationSubmitSchema.safeParse({
      ...valid,
      modules: [],
      bundle: null,
      customRequest: 'I need something custom',
    });
    expect(r.success).toBe(true);
  });

  it('accepts Indonesian phone in 08xx format', () => {
    const r = registrationSubmitSchema.safeParse({ ...valid, phone: '08123456789' });
    expect(r.success).toBe(true);
  });

  it('rejects non-Indonesian phone', () => {
    const r = registrationSubmitSchema.safeParse({ ...valid, phone: 'abc' });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

Run: `cd clicker-platform-v2 && pnpm test lib/registration/__tests__/schema.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement schema.ts**

```ts
// clicker-platform-v2/lib/registration/schema.ts
import { z } from 'zod';

const PHONE_RE = /^(\+62|62|0)[0-9]{8,13}$/;

export const businessTypeSchema = z.enum([
  'fnb',
  'auto-detailing',
  'beauty-spa',
  'retail',
  'service',
  'other',
]);

export const registrationSubmitSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(120),
    email: z.string().trim().email('Invalid email').max(200),
    phone: z.string().trim().regex(PHONE_RE, 'Invalid Indonesian phone number'),
    businessName: z.string().trim().min(2, 'Business name too short').max(120),
    businessType: businessTypeSchema,
    city: z.string().trim().min(1).max(80),
    expectedOutlets: z.number().int().min(1).max(9999),
    bundle: z.string().nullable(),
    modules: z.array(z.string()).max(50),
    customRequest: z.string().max(2000),
    promoCode: z.string().trim().min(1).max(80).nullable(),
    source: z.string().max(500).nullable(),
  })
  .refine(
    (v) => v.modules.length > 0 || v.customRequest.trim().length > 0,
    { message: 'Pick at least one module or describe your custom request', path: ['modules'] },
  );

export type RegistrationSubmitInput = z.infer<typeof registrationSubmitSchema>;
```

- [ ] **Step 4: Run, verify PASS**

Run: `cd clicker-platform-v2 && pnpm test lib/registration/__tests__/schema.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add clicker-platform-v2/lib/registration/schema.ts clicker-platform-v2/lib/registration/__tests__/schema.test.ts
git commit -m "feat(registration): add Zod submission schema"
```

---

## Task 4: In-memory IP rate limiter

**Files:**
- Create: `clicker-platform-v2/lib/registration/rate-limit.ts`
- Test: `clicker-platform-v2/lib/registration/__tests__/rate-limit.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// clicker-platform-v2/lib/registration/__tests__/rate-limit.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRateLimiter } from '../rate-limit';

describe('createRateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  });

  it('allows up to N requests per window', () => {
    const limiter = createRateLimiter({ max: 3, windowMs: 60_000 });
    expect(limiter.check('1.1.1.1')).toBe(true);
    expect(limiter.check('1.1.1.1')).toBe(true);
    expect(limiter.check('1.1.1.1')).toBe(true);
    expect(limiter.check('1.1.1.1')).toBe(false);
  });

  it('isolates by key', () => {
    const limiter = createRateLimiter({ max: 1, windowMs: 60_000 });
    expect(limiter.check('a')).toBe(true);
    expect(limiter.check('b')).toBe(true);
    expect(limiter.check('a')).toBe(false);
  });

  it('resets after window', () => {
    const limiter = createRateLimiter({ max: 1, windowMs: 60_000 });
    expect(limiter.check('x')).toBe(true);
    expect(limiter.check('x')).toBe(false);
    vi.advanceTimersByTime(61_000);
    expect(limiter.check('x')).toBe(true);
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

Run: `cd clicker-platform-v2 && pnpm test lib/registration/__tests__/rate-limit.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement rate-limit.ts**

```ts
// clicker-platform-v2/lib/registration/rate-limit.ts
interface Bucket {
  count: number;
  resetAt: number;
}

export interface RateLimiter {
  check(key: string): boolean;
}

export function createRateLimiter(opts: { max: number; windowMs: number }): RateLimiter {
  const buckets = new Map<string, Bucket>();
  return {
    check(key: string): boolean {
      const now = Date.now();
      const b = buckets.get(key);
      if (!b || now >= b.resetAt) {
        buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
        return true;
      }
      if (b.count >= opts.max) return false;
      b.count += 1;
      return true;
    },
  };
}

export const submitLimiter = createRateLimiter({ max: 5, windowMs: 60 * 60 * 1000 });
export const validatePromoLimiter = createRateLimiter({ max: 30, windowMs: 60 * 60 * 1000 });
```

- [ ] **Step 4: Run, verify PASS**

Run: `cd clicker-platform-v2 && pnpm test lib/registration/__tests__/rate-limit.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add clicker-platform-v2/lib/registration/rate-limit.ts clicker-platform-v2/lib/registration/__tests__/rate-limit.test.ts
git commit -m "feat(registration): add in-memory IP rate limiter"
```

---

## Task 5: Server-side API helpers (create + promo validation)

**Files:**
- Create: `clicker-platform-v2/lib/registration/api-server.ts`

- [ ] **Step 1: Implement api-server.ts**

```ts
// clicker-platform-v2/lib/registration/api-server.ts
import 'server-only';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { findPromoByCode } from '@/lib/modules/promo/api';
import { REGISTRATION_REQUESTS_COLLECTION } from './constants';
import type { RegistrationSubmitInput } from './schema';

export interface PromoValidationResult {
  valid: boolean;
  name?: string;
  reason?: string;
}

/**
 * Read-only promo existence/validity check. Does not increment usage.
 * Searches across all sites for a matching code (registration is pre-tenant).
 */
export async function validatePromoCode(code: string): Promise<PromoValidationResult> {
  const trimmed = code.trim();
  if (!trimmed) return { valid: false, reason: 'empty' };

  const db = getAdminDb();
  const snap = await db
    .collectionGroup('promos')
    .where('code', '==', trimmed.toUpperCase())
    .where('status', '==', 'active')
    .limit(1)
    .get();

  if (snap.empty) return { valid: false, reason: 'not-found' };

  const promo = snap.docs[0].data() as { name?: string; expiresAt?: { toMillis(): number } };
  if (promo.expiresAt && promo.expiresAt.toMillis() < Date.now()) {
    return { valid: false, reason: 'expired' };
  }
  return { valid: true, name: promo.name };
}

export async function createRegistrationRequest(
  input: RegistrationSubmitInput,
  promoValidAtSubmit: boolean,
): Promise<string> {
  const db = getAdminDb();
  const ref = await db.collection(REGISTRATION_REQUESTS_COLLECTION).add({
    ...input,
    promoCodeValidAtSubmit: promoValidAtSubmit,
    status: 'pending',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    activatedSiteId: null,
    activatedAt: null,
    rejectionReason: null,
    internalNotes: '',
  });
  return ref.id;
}
```

- [ ] **Step 2: Verify the imports resolve**

Run: `cd clicker-platform-v2 && pnpm tsc --noEmit -p tsconfig.json 2>&1 | grep -E "registration/api-server" | head -10`
Expected: no errors mentioning api-server.ts. If `getAdminDb` does not exist, check `lib/firebase-admin.ts` for the actual export name and fix the import. If `findPromoByCode` accepts `siteId` as the first arg, switch to a direct `collectionGroup` query — the snippet already does.

- [ ] **Step 3: Commit**

```bash
git add clicker-platform-v2/lib/registration/api-server.ts
git commit -m "feat(registration): add server API helpers for create + promo validation"
```

---

## Task 6: Public promo validation API route

**Files:**
- Create: `clicker-platform-v2/app/api/public/validate-promo/route.ts`

- [ ] **Step 1: Implement route**

```ts
// clicker-platform-v2/app/api/public/validate-promo/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { validatePromoCode } from '@/lib/registration/api-server';
import { validatePromoLimiter } from '@/lib/registration/rate-limit';

export const runtime = 'nodejs';

function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  if (!validatePromoLimiter.check(ip)) {
    return NextResponse.json({ valid: false, reason: 'rate-limited' }, { status: 429 });
  }
  const code = req.nextUrl.searchParams.get('code');
  if (!code) {
    return NextResponse.json({ valid: false, reason: 'missing-code' }, { status: 400 });
  }
  const result = await validatePromoCode(code);
  return NextResponse.json(result);
}
```

- [ ] **Step 2: Smoke-test manually**

Run: `cd clicker-platform-v2 && pnpm dev` then in another shell:
`curl 'http://localhost:3000/api/public/validate-promo?code=NOPE'`
Expected: `{"valid":false,"reason":"not-found"}` (or `expired`/`rate-limited`).

Stop dev server.

- [ ] **Step 3: Commit**

```bash
git add clicker-platform-v2/app/api/public/validate-promo/
git commit -m "feat(registration): add public promo validation endpoint"
```

---

## Task 7: Submit server action

**Files:**
- Create: `clicker-platform-v2/app/(public)/register/submit-action.ts`

- [ ] **Step 1: Implement server action**

```ts
// clicker-platform-v2/app/(public)/register/submit-action.ts
'use server';

import { headers } from 'next/headers';
import { registrationSubmitSchema } from '@/lib/registration/schema';
import { createRegistrationRequest, validatePromoCode } from '@/lib/registration/api-server';
import { submitLimiter } from '@/lib/registration/rate-limit';

export interface SubmitResult {
  ok: boolean;
  id?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function submitRegistration(rawInput: unknown): Promise<SubmitResult> {
  const h = await headers();
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip') ?? 'unknown';
  if (!submitLimiter.check(ip)) {
    return { ok: false, error: 'Too many requests. Try again later.' };
  }

  const parsed = registrationSubmitSchema.safeParse(rawInput);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = issue.path.join('.') || '_root';
      fieldErrors[k] = issue.message;
    }
    return { ok: false, error: 'Invalid form', fieldErrors };
  }

  let promoValid = true;
  if (parsed.data.promoCode) {
    const r = await validatePromoCode(parsed.data.promoCode);
    if (!r.valid) {
      return {
        ok: false,
        error: 'Invalid promo code',
        fieldErrors: { promoCode: r.reason ?? 'invalid' },
      };
    }
    promoValid = r.valid;
  }

  const id = await createRegistrationRequest(parsed.data, promoValid);
  return { ok: true, id };
}
```

- [ ] **Step 2: Commit**

```bash
git add clicker-platform-v2/app/\(public\)/register/submit-action.ts
git commit -m "feat(registration): add submit server action"
```

---

## Task 8: Public registration form UI

**Files:**
- Create: `clicker-platform-v2/app/(public)/register/page.tsx`
- Create: `clicker-platform-v2/app/(public)/register/RegisterForm.tsx`
- Create: `clicker-platform-v2/app/(public)/register/sections/ContactSection.tsx`
- Create: `clicker-platform-v2/app/(public)/register/sections/BusinessSection.tsx`
- Create: `clicker-platform-v2/app/(public)/register/sections/ModulesSection.tsx`
- Create: `clicker-platform-v2/app/(public)/register/sections/CustomRequestSection.tsx`
- Create: `clicker-platform-v2/app/(public)/register/sections/PromoCodeSection.tsx`
- Create: `clicker-platform-v2/app/(public)/register/ThankYou.tsx`

- [ ] **Step 1: Server-component shell page**

```tsx
// clicker-platform-v2/app/(public)/register/page.tsx
import { STATIC_MODULE_DEFINITIONS } from '@/lib/modules/definitions';
import { RegisterForm } from './RegisterForm';

export const metadata = { title: 'Register Interest — Clicker' };

interface SearchParams { utm_source?: string; utm_medium?: string; utm_campaign?: string; ref?: string }

export default async function RegisterPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const source = [sp.utm_source, sp.utm_medium, sp.utm_campaign, sp.ref].filter(Boolean).join('|') || null;

  const allModules = Object.entries(STATIC_MODULE_DEFINITIONS).map(([id, def]) => ({
    id,
    name: (def.displayName as string | undefined) ?? id,
    description: (def.description as string | undefined) ?? '',
  }));

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-semibold">Register your business with Clicker</h1>
      <p className="mt-2 text-gray-600">Tell us about your business and we'll get you set up within 24 hours.</p>
      <RegisterForm allModules={allModules} source={source} />
    </main>
  );
}
```

- [ ] **Step 2: Client form (skeleton wiring)**

```tsx
// clicker-platform-v2/app/(public)/register/RegisterForm.tsx
'use client';

import { useState, useTransition } from 'react';
import { BUNDLES, getBundleById } from '@/lib/registration/bundles';
import { ContactSection } from './sections/ContactSection';
import { BusinessSection } from './sections/BusinessSection';
import { ModulesSection } from './sections/ModulesSection';
import { CustomRequestSection } from './sections/CustomRequestSection';
import { PromoCodeSection } from './sections/PromoCodeSection';
import { ThankYou } from './ThankYou';
import { submitRegistration } from './submit-action';

export interface ModuleOption { id: string; name: string; description: string }

interface Props { allModules: ModuleOption[]; source: string | null }

export function RegisterForm({ allModules, source }: Props) {
  const [pending, startTransition] = useTransition();
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [contact, setContact] = useState({ name: '', email: '', phone: '', businessName: '' });
  const [business, setBusiness] = useState({ businessType: 'fnb' as const, city: '', expectedOutlets: 1 });
  const [bundle, setBundle] = useState<string | null>(null);
  const [modules, setModules] = useState<string[]>([]);
  const [customRequest, setCustomRequest] = useState('');
  const [promoCode, setPromoCode] = useState('');

  function onPickBundle(id: string | null) {
    setBundle(id);
    if (id) {
      const b = getBundleById(id);
      if (b) setModules(b.modules);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    startTransition(async () => {
      const result = await submitRegistration({
        ...contact,
        ...business,
        bundle,
        modules,
        customRequest,
        promoCode: promoCode.trim() ? promoCode.trim() : null,
        source,
      });
      if (result.ok && result.id) {
        setSubmittedId(result.id);
      } else {
        setErrors(result.fieldErrors ?? { _root: result.error ?? 'Submission failed' });
      }
    });
  }

  if (submittedId) return <ThankYou />;

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-8">
      <ContactSection value={contact} onChange={setContact} errors={errors} />
      <BusinessSection value={business} onChange={setBusiness} errors={errors} />
      <ModulesSection
        bundles={BUNDLES}
        allModules={allModules}
        bundle={bundle}
        modules={modules}
        onBundleChange={onPickBundle}
        onModulesChange={(m) => { setModules(m); setBundle(null); }}
        errors={errors}
      />
      <CustomRequestSection value={customRequest} onChange={setCustomRequest} />
      <PromoCodeSection value={promoCode} onChange={setPromoCode} errors={errors} />
      {errors._root && <p className="text-red-600">{errors._root}</p>}
      <button type="submit" disabled={pending} className="rounded bg-orange-500 px-6 py-3 text-white disabled:opacity-50">
        {pending ? 'Submitting…' : 'Register interest'}
      </button>
    </form>
  );
}
```

- [ ] **Step 3: ContactSection**

```tsx
// clicker-platform-v2/app/(public)/register/sections/ContactSection.tsx
'use client';

interface Value { name: string; email: string; phone: string; businessName: string }
interface Props { value: Value; onChange: (v: Value) => void; errors: Record<string, string> }

export function ContactSection({ value, onChange, errors }: Props) {
  const set = (k: keyof Value) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...value, [k]: e.target.value });
  return (
    <fieldset className="space-y-3">
      <legend className="text-lg font-medium">Contact</legend>
      <Field label="Full name" error={errors.name}>
        <input value={value.name} onChange={set('name')} className="input" required />
      </Field>
      <Field label="Email" error={errors.email}>
        <input type="email" value={value.email} onChange={set('email')} className="input" required />
      </Field>
      <Field label="Phone (Indonesian)" error={errors.phone}>
        <input value={value.phone} onChange={set('phone')} placeholder="08xxxxxxxxxx" className="input" required />
      </Field>
      <Field label="Business name" error={errors.businessName}>
        <input value={value.businessName} onChange={set('businessName')} className="input" required />
      </Field>
    </fieldset>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {error && <span className="block text-sm text-red-600">{error}</span>}
    </label>
  );
}
```

- [ ] **Step 4: BusinessSection**

```tsx
// clicker-platform-v2/app/(public)/register/sections/BusinessSection.tsx
'use client';

import type { BusinessType } from '@/lib/registration/types';

interface Value { businessType: BusinessType; city: string; expectedOutlets: number }
interface Props { value: Value; onChange: (v: Value) => void; errors: Record<string, string> }

const TYPES: { id: BusinessType; label: string }[] = [
  { id: 'fnb', label: 'Food & Beverage' },
  { id: 'auto-detailing', label: 'Auto Detailing' },
  { id: 'beauty-spa', label: 'Beauty / Spa' },
  { id: 'retail', label: 'Retail' },
  { id: 'service', label: 'Service' },
  { id: 'other', label: 'Other' },
];

export function BusinessSection({ value, onChange, errors }: Props) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-lg font-medium">Business</legend>
      <label className="block">
        <span className="text-sm font-medium">Business type</span>
        <select
          value={value.businessType}
          onChange={(e) => onChange({ ...value, businessType: e.target.value as BusinessType })}
          className="input"
        >
          {TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
        {errors.businessType && <span className="block text-sm text-red-600">{errors.businessType}</span>}
      </label>
      <label className="block">
        <span className="text-sm font-medium">City</span>
        <input value={value.city} onChange={(e) => onChange({ ...value, city: e.target.value })} className="input" required />
        {errors.city && <span className="block text-sm text-red-600">{errors.city}</span>}
      </label>
      <label className="block">
        <span className="text-sm font-medium">Expected number of outlets</span>
        <input
          type="number" min={1} value={value.expectedOutlets}
          onChange={(e) => onChange({ ...value, expectedOutlets: Math.max(1, Number(e.target.value) || 1) })}
          className="input"
        />
        {errors.expectedOutlets && <span className="block text-sm text-red-600">{errors.expectedOutlets}</span>}
      </label>
    </fieldset>
  );
}
```

- [ ] **Step 5: ModulesSection**

```tsx
// clicker-platform-v2/app/(public)/register/sections/ModulesSection.tsx
'use client';

import { useState } from 'react';
import type { Bundle } from '@/lib/registration/bundles';
import type { ModuleOption } from '../RegisterForm';

interface Props {
  bundles: Bundle[];
  allModules: ModuleOption[];
  bundle: string | null;
  modules: string[];
  onBundleChange: (id: string | null) => void;
  onModulesChange: (modules: string[]) => void;
  errors: Record<string, string>;
}

export function ModulesSection({ bundles, allModules, bundle, modules, onBundleChange, onModulesChange, errors }: Props) {
  const [showAll, setShowAll] = useState(false);

  function toggleModule(id: string) {
    if (modules.includes(id)) onModulesChange(modules.filter((m) => m !== id));
    else onModulesChange([...modules, id]);
  }

  return (
    <fieldset className="space-y-4">
      <legend className="text-lg font-medium">What do you need?</legend>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {bundles.map((b) => (
          <button
            key={b.id} type="button"
            onClick={() => onBundleChange(bundle === b.id ? null : b.id)}
            className={`rounded-lg border p-4 text-left ${bundle === b.id ? 'border-orange-500 bg-orange-50' : 'border-gray-200'}`}
          >
            <div className="font-medium">{b.name}</div>
            <div className="mt-1 text-sm text-gray-600">{b.description}</div>
            <div className="mt-2 text-xs text-gray-500">{b.modules.length} modules</div>
          </button>
        ))}
      </div>

      <button type="button" onClick={() => setShowAll((s) => !s)} className="text-sm text-orange-600">
        {showAll ? 'Hide' : 'Or pick individually'}
      </button>

      {showAll && (
        <div className="space-y-2 rounded border p-4">
          {allModules.map((m) => (
            <label key={m.id} className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={modules.includes(m.id)}
                onChange={() => toggleModule(m.id)}
              />
              <span>
                <span className="font-medium">{m.name}</span>
                {m.description && <span className="block text-sm text-gray-600">{m.description}</span>}
              </span>
            </label>
          ))}
        </div>
      )}

      {errors.modules && <p className="text-sm text-red-600">{errors.modules}</p>}
    </fieldset>
  );
}
```

- [ ] **Step 6: CustomRequestSection**

```tsx
// clicker-platform-v2/app/(public)/register/sections/CustomRequestSection.tsx
'use client';

interface Props { value: string; onChange: (v: string) => void }

export function CustomRequestSection({ value, onChange }: Props) {
  return (
    <fieldset>
      <legend className="text-lg font-medium">Custom request (optional)</legend>
      <textarea
        value={value} onChange={(e) => onChange(e.target.value)}
        rows={4} maxLength={2000}
        placeholder="Anything specific you need? Custom features, integrations, questions…"
        className="input mt-2 w-full"
      />
    </fieldset>
  );
}
```

- [ ] **Step 7: PromoCodeSection (with live validation)**

```tsx
// clicker-platform-v2/app/(public)/register/sections/PromoCodeSection.tsx
'use client';

import { useState } from 'react';

interface Props { value: string; onChange: (v: string) => void; errors: Record<string, string> }

export function PromoCodeSection({ value, onChange, errors }: Props) {
  const [status, setStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
  const [reason, setReason] = useState<string>('');

  async function check() {
    if (!value.trim()) { setStatus('idle'); return; }
    setStatus('checking');
    const res = await fetch(`/api/public/validate-promo?code=${encodeURIComponent(value.trim())}`);
    const data = await res.json();
    if (data.valid) { setStatus('valid'); setReason(data.name ?? ''); }
    else { setStatus('invalid'); setReason(data.reason ?? 'invalid'); }
  }

  return (
    <fieldset>
      <legend className="text-lg font-medium">Promo code</legend>
      <div className="mt-2 flex gap-2">
        <input value={value} onChange={(e) => onChange(e.target.value)} onBlur={check} className="input flex-1" placeholder="Optional" />
      </div>
      {status === 'checking' && <p className="text-sm text-gray-500">Checking…</p>}
      {status === 'valid' && <p className="text-sm text-green-600">✓ Valid {reason && `— ${reason}`}</p>}
      {status === 'invalid' && <p className="text-sm text-red-600">Invalid: {reason}</p>}
      {errors.promoCode && <p className="text-sm text-red-600">{errors.promoCode}</p>}
    </fieldset>
  );
}
```

- [ ] **Step 8: ThankYou**

```tsx
// clicker-platform-v2/app/(public)/register/ThankYou.tsx
export function ThankYou() {
  return (
    <div className="mt-8 rounded-lg border border-green-200 bg-green-50 p-6">
      <h2 className="text-xl font-semibold">Thanks — we got your request</h2>
      <p className="mt-2 text-gray-700">We'll review and get back to you within 24 hours.</p>
    </div>
  );
}
```

- [ ] **Step 9: Add minimal `.input` style if not already present**

Check `clicker-platform-v2/app/globals.css` for an `.input` class. If absent, add:

```css
/* clicker-platform-v2/app/globals.css — append */
.input { @apply mt-1 block w-full rounded border border-gray-300 px-3 py-2 focus:border-orange-500 focus:outline-none; }
```

- [ ] **Step 10: Manual smoke test**

Run: `cd clicker-platform-v2 && pnpm dev`. Visit `http://localhost:3000/register`. Fill form, submit. Check Firestore Emulator (or staging) for the new doc in `registrationRequests`. Stop server.

- [ ] **Step 11: Commit**

```bash
git add clicker-platform-v2/app/\(public\)/register/ clicker-platform-v2/app/globals.css
git commit -m "feat(registration): add public registration form UI"
```

---

## Task 9: Firestore security rules for registrationRequests

**Files:**
- Modify: `firestore.rules` (repo root, or wherever the active rules file lives — verify path with `find . -name firestore.rules -maxdepth 4`)

- [ ] **Step 1: Locate the active rules file**

Run: `find /Users/andre/Repository/clicker-universe/dev -name "firestore.rules" -maxdepth 4 -not -path "*/node_modules/*"`
Note the path.

- [ ] **Step 2: Add rules block**

Add inside the `match /databases/{database}/documents` block, before any catch-all:

```
match /registrationRequests/{id} {
  allow create: if
    request.resource.data.status == 'pending'
    && request.resource.data.name is string
    && request.resource.data.email is string
    && request.resource.data.businessName is string
    && request.resource.data.modules is list
    && request.resource.data.activatedSiteId == null;
  allow read, update, delete: if request.auth != null
    && request.auth.token.role == 'superadmin';
}
```

(If your superadmin claim is named differently, e.g. `request.auth.token.superadmin == true`, adjust accordingly — check existing rules for the convention used by Backyard.)

- [ ] **Step 3: Deploy rules to staging**

Run: `firebase deploy --only firestore:rules --project clicker-universe-stagging`
Expected: "Deploy complete!"

- [ ] **Step 4: Commit**

```bash
git add firestore.rules
git commit -m "feat(registration): add security rules for registrationRequests"
```

---

## Task 10: Backyard — registrations list view

**Files:**
- Create: `backyard/lib/registrations/constants.ts`
- Create: `backyard/lib/registrations/types.ts`
- Create: `backyard/lib/registrations/api.ts`
- Create: `backyard/app/registrations/page.tsx`
- Create: `backyard/components/registrations/StatusBadge.tsx`

- [ ] **Step 1: Constants and types**

```ts
// backyard/lib/registrations/constants.ts
export const REGISTRATION_REQUESTS_COLLECTION = 'registrationRequests';
```

```ts
// backyard/lib/registrations/types.ts
import type { Timestamp } from 'firebase/firestore';

export type BusinessType = 'fnb' | 'auto-detailing' | 'beauty-spa' | 'retail' | 'service' | 'other';
export type RegistrationStatus = 'pending' | 'contacted' | 'activated' | 'rejected';

export interface RegistrationRequest {
  id: string;
  name: string;
  email: string;
  phone: string;
  businessName: string;
  businessType: BusinessType;
  city: string;
  expectedOutlets: number;
  bundle: string | null;
  modules: string[];
  customRequest: string;
  promoCode: string | null;
  promoCodeValidAtSubmit: boolean;
  status: RegistrationStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  activatedSiteId: string | null;
  activatedAt: Timestamp | null;
  rejectionReason: string | null;
  internalNotes: string;
  source: string | null;
}
```

- [ ] **Step 2: Client API**

```ts
// backyard/lib/registrations/api.ts
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, getDoc, updateDoc, query, orderBy, where, serverTimestamp } from 'firebase/firestore';
import { REGISTRATION_REQUESTS_COLLECTION } from './constants';
import type { RegistrationRequest, RegistrationStatus } from './types';

export async function listRegistrations(filterStatus?: RegistrationStatus): Promise<RegistrationRequest[]> {
  const col = collection(db, REGISTRATION_REQUESTS_COLLECTION);
  const q = filterStatus
    ? query(col, where('status', '==', filterStatus), orderBy('createdAt', 'desc'))
    : query(col, orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<RegistrationRequest, 'id'>) }));
}

export async function getRegistration(id: string): Promise<RegistrationRequest | null> {
  const ref = doc(db, REGISTRATION_REQUESTS_COLLECTION, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<RegistrationRequest, 'id'>) };
}

export async function setStatus(id: string, status: RegistrationStatus, extra: Partial<RegistrationRequest> = {}) {
  await updateDoc(doc(db, REGISTRATION_REQUESTS_COLLECTION, id), {
    ...extra,
    status,
    updatedAt: serverTimestamp(),
  });
}

export async function saveNotes(id: string, internalNotes: string) {
  await updateDoc(doc(db, REGISTRATION_REQUESTS_COLLECTION, id), {
    internalNotes,
    updatedAt: serverTimestamp(),
  });
}

export async function countPriorByEmail(email: string, excludeId: string): Promise<number> {
  const col = collection(db, REGISTRATION_REQUESTS_COLLECTION);
  const q = query(col, where('email', '==', email), where('status', 'in', ['pending', 'contacted']));
  const snap = await getDocs(q);
  return snap.docs.filter((d) => d.id !== excludeId).length;
}
```

- [ ] **Step 3: StatusBadge component**

```tsx
// backyard/components/registrations/StatusBadge.tsx
import type { RegistrationStatus } from '@/lib/registrations/types';

const STYLES: Record<RegistrationStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  contacted: 'bg-blue-100 text-blue-800',
  activated: 'bg-green-100 text-green-800',
  rejected: 'bg-gray-100 text-gray-700',
};

export function StatusBadge({ status }: { status: RegistrationStatus }) {
  return <span className={`rounded px-2 py-0.5 text-xs ${STYLES[status]}`}>{status}</span>;
}
```

- [ ] **Step 4: List page**

```tsx
// backyard/app/registrations/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { listRegistrations } from '@/lib/registrations/api';
import type { RegistrationRequest, RegistrationStatus } from '@/lib/registrations/types';
import { StatusBadge } from '@/components/registrations/StatusBadge';

const FILTERS: (RegistrationStatus | 'all')[] = ['pending', 'contacted', 'activated', 'rejected', 'all'];

export default function RegistrationsPage() {
  const [filter, setFilter] = useState<RegistrationStatus | 'all'>('pending');
  const [rows, setRows] = useState<RegistrationRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    listRegistrations(filter === 'all' ? undefined : filter)
      .then(setRows)
      .finally(() => setLoading(false));
  }, [filter]);

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold">Registrations</h1>
      <div className="mt-4 flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded px-3 py-1 text-sm ${filter === f ? 'bg-orange-500 text-white' : 'bg-gray-100'}`}
          >
            {f}
          </button>
        ))}
      </div>
      {loading ? <p className="mt-6">Loading…</p> : (
        <table className="mt-6 w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-2">Business</th>
              <th className="p-2">Contact</th>
              <th className="p-2">City</th>
              <th className="p-2">Modules</th>
              <th className="p-2">Promo</th>
              <th className="p-2">Status</th>
              <th className="p-2">Submitted</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t hover:bg-gray-50">
                <td className="p-2"><Link href={`/registrations/${r.id}`} className="font-medium text-orange-600">{r.businessName}</Link></td>
                <td className="p-2">{r.name}<br /><span className="text-gray-500">{r.email}</span></td>
                <td className="p-2">{r.city}</td>
                <td className="p-2">{r.modules.length}</td>
                <td className="p-2">{r.promoCode ?? '—'}</td>
                <td className="p-2"><StatusBadge status={r.status} /></td>
                <td className="p-2">{r.createdAt?.toDate ? r.createdAt.toDate().toLocaleDateString() : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
```

- [ ] **Step 5: Add to Backyard sidebar nav**

Find the Backyard sidebar/nav file (likely `backyard/components/Sidebar.tsx` or similar — `find backyard -name "Sidebar*" -type f`). Add a link entry for `/registrations`. Match existing pattern.

- [ ] **Step 6: Manual test**

Run: `cd backyard && pnpm dev` (port 3011). Login as superadmin, visit `/registrations`. Should list submissions from Task 8 testing.

- [ ] **Step 7: Commit**

```bash
git add backyard/lib/registrations/ backyard/app/registrations/ backyard/components/registrations/
git commit -m "feat(backyard): add registrations list view"
```

---

## Task 11: Backyard — registration detail view

**Files:**
- Create: `backyard/app/registrations/[id]/page.tsx`
- Create: `backyard/app/registrations/[id]/InternalNotes.tsx`
- Create: `backyard/app/registrations/[id]/PromoCard.tsx`
- Create: `backyard/app/registrations/[id]/RejectModal.tsx`
- Create: `backyard/app/registrations/[id]/ActivateButton.tsx`
- Create: `backyard/components/registrations/ModulesList.tsx`

- [ ] **Step 1: ModulesList component**

```tsx
// backyard/components/registrations/ModulesList.tsx
import { STATIC_MODULE_DEFINITIONS } from '@/lib/modules/definitions';

export function ModulesList({ ids }: { ids: string[] }) {
  if (ids.length === 0) return <span className="text-gray-500">None</span>;
  return (
    <ul className="list-disc pl-5">
      {ids.map((id) => {
        const def = STATIC_MODULE_DEFINITIONS[id];
        const name = (def?.displayName as string | undefined) ?? id;
        return <li key={id}>{name}</li>;
      })}
    </ul>
  );
}
```

(If Backyard does not vendor `STATIC_MODULE_DEFINITIONS`, copy the relevant subset to `backyard/lib/modules/definitions.ts` or import from a shared workspace package — check first with `ls backyard/lib/modules/ 2>/dev/null`. Match the existing convention.)

- [ ] **Step 2: PromoCard with live re-validation**

```tsx
// backyard/app/registrations/[id]/PromoCard.tsx
'use client';

import { useEffect, useState } from 'react';

interface Props { code: string | null; platformBaseUrl: string }

export function PromoCard({ code, platformBaseUrl }: Props) {
  const [status, setStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
  const [reason, setReason] = useState<string>('');

  useEffect(() => {
    if (!code) { setStatus('idle'); return; }
    setStatus('checking');
    fetch(`${platformBaseUrl}/api/public/validate-promo?code=${encodeURIComponent(code)}`)
      .then((r) => r.json())
      .then((d) => { if (d.valid) { setStatus('valid'); setReason(d.name ?? ''); } else { setStatus('invalid'); setReason(d.reason ?? ''); } })
      .catch(() => { setStatus('invalid'); setReason('error'); });
  }, [code, platformBaseUrl]);

  if (!code) return <p className="text-gray-500">No promo code</p>;
  return (
    <div className="rounded border p-3">
      <div className="font-mono">{code}</div>
      {status === 'checking' && <p className="text-sm text-gray-500">Checking…</p>}
      {status === 'valid' && <p className="text-sm text-green-600">✓ Valid {reason && `— ${reason}`}</p>}
      {status === 'invalid' && <p className="text-sm text-red-600">✗ {reason || 'Invalid'} — will not be applied</p>}
    </div>
  );
}
```

- [ ] **Step 3: InternalNotes**

```tsx
// backyard/app/registrations/[id]/InternalNotes.tsx
'use client';

import { useEffect, useState } from 'react';
import { saveNotes } from '@/lib/registrations/api';

export function InternalNotes({ id, initial }: { id: string; initial: string }) {
  const [val, setVal] = useState(initial);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (val === initial) return;
    const t = setTimeout(async () => {
      await saveNotes(id, val);
      setSavedAt(Date.now());
    }, 800);
    return () => clearTimeout(t);
  }, [val, id, initial]);

  return (
    <div>
      <textarea value={val} onChange={(e) => setVal(e.target.value)} rows={4} className="w-full rounded border p-2" placeholder="Internal notes…" />
      {savedAt && <p className="text-xs text-gray-500">Saved</p>}
    </div>
  );
}
```

- [ ] **Step 4: RejectModal**

```tsx
// backyard/app/registrations/[id]/RejectModal.tsx
'use client';

import { useState } from 'react';
import { setStatus } from '@/lib/registrations/api';
import { useRouter } from 'next/navigation';

export function RejectModal({ id, onClose }: { id: string; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function submit() {
    setPending(true);
    await setStatus(id, 'rejected', { rejectionReason: reason });
    onClose();
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-lg bg-white p-6">
        <h3 className="text-lg font-semibold">Reject registration</h3>
        <textarea
          value={reason} onChange={(e) => setReason(e.target.value)}
          rows={4} placeholder="Reason (required)"
          className="mt-3 w-full rounded border p-2"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded px-3 py-1">Cancel</button>
          <button
            onClick={submit} disabled={!reason.trim() || pending}
            className="rounded bg-red-600 px-3 py-1 text-white disabled:opacity-50"
          >
            {pending ? 'Rejecting…' : 'Reject'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: ActivateButton**

```tsx
// backyard/app/registrations/[id]/ActivateButton.tsx
'use client';

import { useRouter } from 'next/navigation';

export function ActivateButton({ id }: { id: string }) {
  const router = useRouter();
  return (
    <button
      onClick={() => router.push(`/tenants?fromRegistration=${id}`)}
      className="rounded bg-orange-500 px-4 py-2 text-white"
    >
      Activate →
    </button>
  );
}
```

- [ ] **Step 6: Detail page**

```tsx
// backyard/app/registrations/[id]/page.tsx
'use client';

import { use, useEffect, useState } from 'react';
import { getRegistration, setStatus, countPriorByEmail } from '@/lib/registrations/api';
import type { RegistrationRequest } from '@/lib/registrations/types';
import { StatusBadge } from '@/components/registrations/StatusBadge';
import { ModulesList } from '@/components/registrations/ModulesList';
import { ActivateButton } from './ActivateButton';
import { RejectModal } from './RejectModal';
import { InternalNotes } from './InternalNotes';
import { PromoCard } from './PromoCard';

const PLATFORM_BASE = process.env.NEXT_PUBLIC_PLATFORM_URL ?? 'http://localhost:3000';

export default function RegistrationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [reg, setReg] = useState<RegistrationRequest | null>(null);
  const [priorCount, setPriorCount] = useState(0);
  const [showReject, setShowReject] = useState(false);

  useEffect(() => {
    getRegistration(id).then((r) => {
      setReg(r);
      if (r) countPriorByEmail(r.email, r.id).then(setPriorCount);
    });
  }, [id]);

  if (!reg) return <main className="p-6">Loading…</main>;

  return (
    <main className="mx-auto max-w-4xl p-6">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{reg.businessName}</h1>
          <div className="mt-1 flex items-center gap-2">
            <StatusBadge status={reg.status} />
            <span className="text-sm text-gray-500">{reg.createdAt?.toDate?.().toLocaleString()}</span>
          </div>
          {priorCount > 0 && (
            <p className="mt-2 text-sm text-amber-700">⚠ {priorCount} prior request(s) from this email</p>
          )}
        </div>
        {reg.status !== 'activated' && reg.status !== 'rejected' && (
          <div className="flex gap-2">
            {reg.status === 'pending' && (
              <button onClick={() => setStatus(reg.id, 'contacted').then(() => setReg({ ...reg, status: 'contacted' }))} className="rounded border px-3 py-1">Mark contacted</button>
            )}
            <button onClick={() => setShowReject(true)} className="rounded border border-red-300 px-3 py-1 text-red-700">Reject</button>
            <ActivateButton id={reg.id} />
          </div>
        )}
      </header>

      <section className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card title="Contact">
          <p>{reg.name}</p>
          <p><a href={`mailto:${reg.email}`} className="text-orange-600">{reg.email}</a></p>
          <p><a href={`tel:${reg.phone}`} className="text-orange-600">{reg.phone}</a></p>
        </Card>
        <Card title="Business">
          <p>Type: {reg.businessType}</p>
          <p>City: {reg.city}</p>
          <p>Expected outlets: {reg.expectedOutlets}</p>
        </Card>
        <Card title="Intent">
          {reg.bundle && <p>Bundle: <span className="font-medium">{reg.bundle}</span></p>}
          <ModulesList ids={reg.modules} />
          {reg.customRequest && (
            <div className="mt-3"><p className="font-medium">Custom request:</p><p className="whitespace-pre-wrap">{reg.customRequest}</p></div>
          )}
        </Card>
        <Card title="Promo"><PromoCard code={reg.promoCode} platformBaseUrl={PLATFORM_BASE} /></Card>
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-lg font-medium">Internal notes</h2>
        <InternalNotes id={reg.id} initial={reg.internalNotes} />
      </section>

      {reg.activatedSiteId && (
        <p className="mt-6 text-sm text-green-700">✓ Activated as site <span className="font-mono">{reg.activatedSiteId}</span></p>
      )}
      {reg.rejectionReason && (
        <p className="mt-6 text-sm text-gray-700">Rejection reason: {reg.rejectionReason}</p>
      )}

      {showReject && <RejectModal id={reg.id} onClose={() => setShowReject(false)} />}
    </main>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-4">
      <h3 className="mb-2 text-sm font-semibold uppercase text-gray-500">{title}</h3>
      <div className="text-sm">{children}</div>
    </div>
  );
}
```

- [ ] **Step 7: Add `NEXT_PUBLIC_PLATFORM_URL`**

In `backyard/.env.development.local` add `NEXT_PUBLIC_PLATFORM_URL=http://localhost:3000`. For staging/prod, document the value to be set at deploy time.

- [ ] **Step 8: Manual test**

Run Backyard, click into a registration row, verify all cards render. Click "Mark contacted" → status updates. Click "Reject" → modal works → status updates.

- [ ] **Step 9: Commit**

```bash
git add backyard/app/registrations/\[id\]/ backyard/components/registrations/ModulesList.tsx backyard/.env.development.local
git commit -m "feat(backyard): add registration detail view"
```

---

## Task 12: Tenant forge prefill from registration

**Files:**
- Modify: `backyard/app/tenants/page.tsx` (and any sub-files used by the forge)

- [ ] **Step 1: Read current tenant forge**

Run: `cat backyard/app/tenants/page.tsx`. Note how form state is initialized and where `createTenant` is called.

- [ ] **Step 2: Add `?fromRegistration` handling**

At the top of the forge component, read the search param and load the registration on mount. Prefill state. Keep behavior unchanged when the param is absent.

```tsx
// backyard/app/tenants/page.tsx — additions (paste into existing component)
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getRegistration } from '@/lib/registrations/api';
import { suggestSlug } from '@/lib/registrations/slug';   // new — see Step 3
import type { RegistrationRequest } from '@/lib/registrations/types';

// Inside the component:
const params = useSearchParams();
const fromRegistration = params.get('fromRegistration');
const [registration, setRegistration] = useState<RegistrationRequest | null>(null);

useEffect(() => {
  if (!fromRegistration) return;
  getRegistration(fromRegistration).then((r) => {
    if (!r) return;
    setRegistration(r);
    setBusinessName(r.businessName);          // adapt to actual setter names in this file
    setOwnerEmail(r.email);
    setOwnerName(r.name);
    setSlug(suggestSlug(r.businessName));
    setEnabledModules(r.modules);
  });
}, [fromRegistration]);
```

(Adapt setter names — `setBusinessName`, `setOwnerEmail`, etc. — to whatever the existing forge uses. Read the file first.)

- [ ] **Step 3: Add slug helper to backyard**

```ts
// backyard/lib/registrations/slug.ts
export function suggestSlug(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
```

- [ ] **Step 4: Show "from registration" banner**

Above the form, when `registration` is set:

```tsx
{registration && (
  <div className="mb-4 rounded border border-orange-200 bg-orange-50 p-3 text-sm">
    Activating registration from <strong>{registration.businessName}</strong> ({registration.email}).
    {registration.promoCode && <> Promo <code>{registration.promoCode}</code> will apply on success.</>}
  </div>
)}
```

- [ ] **Step 5: Call activation hook on success**

Locate where `createTenant` callable resolves successfully (around line 72 of current `page.tsx`). After the new `siteId` is known, if `fromRegistration` is set, call:

```tsx
if (fromRegistration) {
  await fetch(`/api/registrations/${fromRegistration}/activate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ siteId: newSiteId }),
  });
}
```

- [ ] **Step 6: Commit**

```bash
git add backyard/app/tenants/page.tsx backyard/lib/registrations/slug.ts
git commit -m "feat(backyard): prefill tenant forge from registration request"
```

---

## Task 13: Backyard activation API route (status update + promo commit)

**Files:**
- Create: `backyard/app/api/registrations/[id]/activate/route.ts`

- [ ] **Step 1: Implement route**

```ts
// backyard/app/api/registrations/[id]/activate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { commitPromoUsage, findPromoByCode } from '@/lib/modules/promo/api';
import { logger } from '@/lib/logger';
import { requireSuperadmin } from '@/lib/auth';   // adapt to existing helper

export const runtime = 'nodejs';

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await requireSuperadmin(req);   // throws/redirects if not superadmin
  const { id } = await ctx.params;
  const { siteId } = (await req.json()) as { siteId: string };
  if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

  const db = getAdminDb();
  const ref = db.collection('registrationRequests').doc(id);
  const snap = await ref.get();
  if (!snap.exists) return NextResponse.json({ error: 'not-found' }, { status: 404 });
  const reg = snap.data() as { promoCode: string | null; status: string };

  await ref.update({
    status: 'activated',
    activatedSiteId: siteId,
    activatedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  let promoCommitted = false;
  let promoError: string | null = null;
  if (reg.promoCode) {
    try {
      const promo = await findPromoByCode(siteId, reg.promoCode);
      if (promo) {
        await commitPromoUsage({ siteId, promoId: promo.id, /* fill in remaining required CommitInput fields per the facade signature */ } as any);
        promoCommitted = true;
      } else {
        promoError = 'promo-not-found-on-tenant';
      }
    } catch (e) {
      promoError = e instanceof Error ? e.message : 'unknown';
      logger.error('registration.activate.promo_commit_failed', { id, siteId, error: promoError });
    }
  }

  return NextResponse.json({ ok: true, promoCommitted, promoError });
}
```

**Note:** The exact `CommitInput` shape is defined in `clicker-platform-v2/lib/modules/promo/api/commit.ts`. Read it first and pass the correct fields (`memberId`, `orderId`/reference, etc.). For registration-driven activation there is no order — pass a synthetic reference like `{ kind: 'registration-activation', registrationId: id }` if the facade allows. If the facade *requires* a memberId/order, this is the moment to coordinate with the promo module owner; do not fake fields. Fall back to logging "manual promo apply needed" instead.

- [ ] **Step 2: Commit**

```bash
git add backyard/app/api/registrations/\[id\]/activate/
git commit -m "feat(backyard): add activation API route with promo commit"
```

---

## Task 14: Auth-gateway link

**Files:**
- Modify: `auth-gateway/app/page.tsx`

- [ ] **Step 1: Find the login form bottom area**

Run: `grep -n "form\|button\|signIn" auth-gateway/app/page.tsx | head -20`

- [ ] **Step 2: Add link below the submit button**

Insert after the Enter Dashboard button:

```tsx
<p className="mt-4 text-center text-sm text-gray-500">
  Don't have an account?{' '}
  <a href={process.env.NEXT_PUBLIC_REGISTER_URL ?? 'https://clicker.id/register'} className="text-orange-600 hover:underline">
    Register interest →
  </a>
</p>
```

- [ ] **Step 3: Add env var**

`auth-gateway/.env.development.local`:
```
NEXT_PUBLIC_REGISTER_URL=http://localhost:3000/register
```

- [ ] **Step 4: Commit**

```bash
git add auth-gateway/app/page.tsx auth-gateway/.env.development.local
git commit -m "feat(auth-gateway): link to registration page"
```

---

## Task 15: End-to-end manual test on staging

- [ ] **Step 1: Deploy to staging**

```bash
firebase deploy --project clicker-universe-stagging
```
Expected: deploy completes for hosting + functions + rules.

- [ ] **Step 2: Submit a registration**

Visit staging `/register`. Fill:
- Name: Test User, Email: test@example.com, Phone: 08123456789
- Business: Warung Test, Type: F&B, City: Jakarta, Outlets: 2
- Bundle: Restaurant Starter
- Custom request: "Need integration with Tokopedia"
- Promo code: a known valid code on staging
Submit. Expect "Thanks" screen.

- [ ] **Step 3: Backyard verification**

Open Backyard staging. Navigate to /registrations. Confirm the new row in pending. Open detail. Confirm all cards populate. Confirm promo card shows ✓.

- [ ] **Step 4: Activate**

Click Activate. Forge opens prefilled. Adjust slug if needed. Click Create. Confirm:
- New tenant exists in `sites` collection
- Registration row → `status=activated`, `activatedSiteId` set
- Promo usage incremented (check promo doc) OR `promoError` logged

- [ ] **Step 5: Edge — empty intent**

Submit with no modules and empty custom request → form blocks submit with the modules error.

- [ ] **Step 6: Edge — invalid promo**

Submit with a fake promo code → blocked with "Invalid: not-found".

- [ ] **Step 7: Rate limit**

Submit 6 times rapidly from same IP → 6th blocked. (In-memory limiter resets on server restart; staging may have 1+ instance — accept that this is best-effort.)

- [ ] **Step 8: Reject flow**

Open a different pending registration → click Reject → enter reason → confirm `status=rejected, rejectionReason=...`.

- [ ] **Step 9: Done**

If anything fails, file as a bug and fix before merging to main. Otherwise ready for PR.

---

## Self-Review Notes (resolved inline)

- ✅ Spec coverage: every section of the spec maps to a task. Bundles → T1; schema/validation → T3; rate limiting → T4; promo validate API → T6; submit action → T7; public form → T8; rules → T9; backyard list → T10; detail → T11; tenant forge prefill → T12; activation hook → T13; gateway link → T14; e2e → T15.
- ✅ Type consistency: `RegistrationRequest` defined identically in T1 (platform) and T10 (backyard); `RegistrationStatus` union matches.
- ✅ No placeholders: every code step shows complete code. The known integration unknown (`commitPromoUsage` exact arg shape) is called out explicitly in T13 with the file path to read first.
- ✅ Module display names use `STATIC_MODULE_DEFINITIONS` consistently in both apps.
- ⚠️ One acknowledged adaptation: T12 setter names ("setBusinessName" etc.) depend on the existing `backyard/app/tenants/page.tsx` shape — read first, adapt.
