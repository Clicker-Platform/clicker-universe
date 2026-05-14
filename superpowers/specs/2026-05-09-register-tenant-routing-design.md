# Register Tenant Routing Refactor — Design Spec

**Date:** 2026-05-09
**Status:** Draft (awaiting user review)
**Scope:** Refactor `/register` dari standalone public route jadi tenant-scoped route `[tenant]/register`. Hapus hardcode `'go'` di kode, ganti pakai Firestore config (`platformConfig/registration`). Konsisten dengan multi-tenant architecture existing dan Cloudflare Worker apex tenant routing.

---

## 1. Goals & Non-Goals

### Goals

- URL register konsisten dengan multi-tenant pattern: `[tenant]/register` di-route via Next.js dynamic route.
- Hapus hardcode `REGISTRATION_PROMO_SITE_ID = 'go'` dari Platform-v2 + Backyard. Pakai Firestore config sebagai single source of truth.
- Tenant `go` sebagai landing brand untuk akuisisi pendaftar baru tetap pakai apex domain di production (`clicker.id/register` via Cloudflare Worker rewrite).
- Konsisten dengan pattern Firestore config existing (`platformConfig/modules`).
- Future-proof: kalau besok perlu register untuk tenant lain (mis. franchise), tinggal update Firestore doc.

### Non-Goals

- Multi-tenant register simultan (saat ini hanya 1 tenant aktif untuk register: `go`).
- Mengubah Cloudflare Worker — sudah handle apex tenant routing dengan benar.
- Mengubah `worker.js` `staticPaths` atau `apexPassThroughPaths` — `register` sudah handled correctly via auto-prefix `/go`.
- Mengubah collection schema `registrationRequests` (tidak perlu field `siteId` karena hanya 1 tenant).
- UI redesign form register (separate concern).
- Mengubah `RESERVED_SLUGS` di slug-validation.ts — `'go'` harus tetap reserved untuk mencegah duplikat.

---

## 2. Decisions Summary

| # | Decision | Choice |
|---|----------|--------|
| 1 | URL pattern register | `[tenant]/register` (Next.js dynamic route) |
| 2 | Validation tenant | Hardcode-style via Firestore config (Approach A) |
| 3 | Source of truth `registrationTenant` | Firestore `platformConfig/registration` |
| 4 | Cache strategy | In-memory cache per app instance (pattern dari `modules-catalog.ts`) |
| 5 | Tenant lain akses `[other-tenant]/register` | Return 404 |
| 6 | Backward compat `/register` (root) | 404 (refactor breaking change, masih staging) |
| 7 | Backyard cross-app access ke config | Pakai Firestore client SDK (same Firebase project) |
| 8 | API parameter `siteId` | Required di `/api/public/validate-promo`, validate match config |
| 9 | Server action signature | `submitRegistration(tenant, input)` (tenant first param) |
| 10 | Cloudflare Worker change | None (sudah handle apex routing) |
| 11 | `registrationRequests` schema | Tidak ada field tenant (implicit dari config) |

---

## 3. Architecture

### Single Source of Truth

```
Firestore: platformConfig/registration
{
  registrationTenant: "go",
  updatedAt: <timestamp>
}
```

Konsumen:

```
┌─────────────────────────────────────────────┐
│ platformConfig/registration                 │
└──────────────┬──────────────┬───────────────┘
               │              │
   fetch+cache (admin SDK)   fetch+cache (client SDK)
               ▼              ▼
   ┌──────────────────┐ ┌──────────────────┐
   │ Platform-v2      │ │ Backyard         │
   │  - register page │ │  - PromoCard     │
   │  - validatePromo │ │  - commitPromo   │
   │  - submitReg     │ │                  │
   └──────────────────┘ └──────────────────┘
```

### URL Routing Flow

**Production (clicker.id apex domain):**

```
User: https://clicker.id/register
   │
   ▼ Cloudflare Worker (worker.js line 190)
   Apex domain detected → prefix path /go
   Proxy ke: https://clickerapps.web.app/go/register
   │
   ▼ Firebase Hosting → Next.js
   Middleware: 'register' BUKAN special route (sudah dihapus dari array)
   Path /go/register match → app/[tenant]/register/page.tsx
   params.tenant = 'go'
   │
   ▼ Page validate
   const { registrationTenant } = await fetchRegistrationConfig();
   if (tenant !== registrationTenant) notFound();
   │
   ▼ Render <RegisterForm tenant="go" />
```

**Production (legacy go.clicker.id):**

```
User: https://go.clicker.id/register
   │
   ▼ Cloudflare Worker (worker.js line 86-89)
   subdomain === 'go' → 301 redirect
   Location: https://clicker.id/register
   │
   ▼ Same as Production above
```

**Staging (Firebase default domain):**

```
User: https://stg-clicker-core.web.app/go/register
   │
   ▼ Direct (no Cloudflare proxy)
   Firebase Hosting → Next.js
   Middleware: isFirebaseDefaultDomain → no subdomain rewrite
   Path /go/register match → app/[tenant]/register/page.tsx
   │
   ▼ Validate, render
```

**Localhost (dev):**

```
User: http://localhost:3000/go/register
   │
   ▼ Same flow as staging (path-based)
   Match → app/[tenant]/register/page.tsx
   params.tenant = 'go'
```

---

## 4. Data Flow & API Contract

### 4.1 Validate Promo

**Endpoint:** `GET /api/public/validate-promo?code={code}&siteId={siteId}`

**Sebelum (current):**
```
GET /api/public/validate-promo?code=MORECLICK
   └─ Hardcode siteId='go' di api-server.ts
```

**Sesudah:**
```
GET /api/public/validate-promo?code=MORECLICK&siteId=go
   │
   ▼ Validation chain:
   1. Rate limit check (existing)
   2. Validate `code` required → 400 if missing
   3. Validate `siteId` required → 400 if missing
   4. Fetch registrationTenant dari config (cached)
   5. if (siteId !== registrationTenant) → 403 Forbidden { reason: 'Tenant not allowed' }
   6. Query: sites/{siteId}/modules/promo/promos WHERE code=MORECLICK
   7. Return: { valid, name?, kind?, value?, maxDiscount?, reason? }
```

**Response shape:** unchanged from existing.

**CORS:** unchanged (already configured for `clicker.id`, `stg-clicker-*.web.app`, `localhost:*`, `backyard.clicker.id`).

### 4.2 Submit Registration (Server Action)

**Signature:** `submitRegistration(tenant: string, input: RegistrationInput) => Promise<SubmitResult>`

**Form pattern (Next.js bind):**
```tsx
// app/[tenant]/register/RegisterForm.tsx
'use client';
function RegisterForm({ tenant }: { tenant: string }) {
  const [pending, startTransition] = useTransition();

  async function onSubmit(data: RegistrationInput) {
    startTransition(async () => {
      const result = await submitRegistration(tenant, data);
      // ...
    });
  }
  // ...
}
```

**Server action validation:**
```
1. Validate tenant param exists
2. Fetch registrationTenant dari config (admin SDK)
3. if (tenant !== registrationTenant) return { ok: false, error: 'Invalid tenant' }
4. Re-validate promo dengan tenant
5. Create registrationRequests/{id} (no tenant field — implicit)
6. Send 2 email (existing flow)
7. Log event jika fail (existing flow)
```

### 4.3 Commit Promo (Backyard Activate)

**Signature change:** `commitRegistrationPromo(code: string)` (parameter `_targetSiteId` dihapus karena confusing & ignored).

**Flow:**
```
Backyard /api/registrations/[id]/activate
   │
   ▼ Process activation (create tenant, etc.)
   │
   ▼ commitRegistrationPromo(reg.promoCode)
       │
       ▼ Fetch registrationTenant dari config (cached)
       ▼ Query: sites/{registrationTenant}/modules/promo/promos
       ▼ Increment usageCount via Firestore transaction
```

**Note:** promo source SELALU `registrationTenant` (tenant `go`), bukan tenant baru yang dibuat. Ini intentional karena promo terdaftar di brand `go`.

### 4.4 PromoCard (Backyard Detail Registrasi)

**Sebelum:**
```tsx
fetch(`${platformBaseUrl}/api/public/validate-promo?code=${code}`)
```

**Sesudah:**
```tsx
// page.tsx (parent) fetch config
const { registrationTenant } = await fetchRegistrationConfig();
return <PromoCard code={...} siteId={registrationTenant} platformBaseUrl={...} />;

// PromoCard.tsx (child)
fetch(`${platformBaseUrl}/api/public/validate-promo?code=${code}&siteId=${siteId}`)
```

---

## 5. File Changes Detail

### 5.1 NEW Files

| Path | Responsibility |
|---|---|
| `clicker-platform-v2/lib/platform-config/registration-config.ts` | Fetch & cache `platformConfig/registration` (Firebase Admin SDK, server-side). Pattern `modules-catalog.ts`. |
| `backyard/lib/platform-config/registration-config.ts` | Fetch & cache `platformConfig/registration` (Firebase Client SDK). Pattern same. |

### 5.2 MODIFIED Files

**Platform-v2:**

| File | Change |
|---|---|
| `middleware.ts` line 42 | Hapus `'register'` dari `specialRoutes` array |
| `app/(public)/register/` | **MOVE** ke `app/[tenant]/register/` (folder + all subfolders) |
| `app/[tenant]/register/page.tsx` | Add validation `if (tenant !== registrationTenant) notFound()` |
| `app/[tenant]/register/RegisterForm.tsx` | Accept prop `tenant`, pass ke server action |
| `lib/registration/api-server.ts` | `validatePromoCode(code, siteId)` — accept siteId param, remove hardcode |
| `lib/registration/submit-action.ts` | `submitRegistration(tenant, input)` — accept tenant param, validate |
| `app/api/public/validate-promo/route.ts` | Require `?siteId=` query param, validate match config |
| `lib/registration/__tests__/api-server.test.ts` | Update mocks: add `fetchRegistrationConfig` mock + siteId in tests |
| `lib/registration/__tests__/email-hooks.test.ts` | Update test signature `submitRegistration('go', input)` |
| `scripts/seed-platform-config.ts` | Tambah seed untuk `platformConfig/registration` |

**Backyard:**

| File | Change |
|---|---|
| `lib/promo/api.ts` | `commitRegistrationPromo(code)` — remove `_targetSiteId` param, fetch siteId dari config |
| `app/api/registrations/[id]/activate/route.ts` | Update call: `commitRegistrationPromo(reg.promoCode)` (no siteId) |
| `app/registrations/[id]/PromoCard.tsx` | Accept prop `siteId`, append to fetch URL |
| `app/registrations/[id]/page.tsx` | Fetch config, pass `siteId` to `<PromoCard>` |

**Auth Gateway:**

| File | Change |
|---|---|
| `app/page.tsx` | Update link "Daftar Sekarang": `/register` → `/go/register` (atau pakai apex domain di prod) |

### 5.3 UNCHANGED (intentional)

- `worker.js` — sudah handle apex tenant routing perfect
- `backyard/lib/registrations/slug-validation.ts` `RESERVED_SLUGS` — `'go'` harus tetap di list
- `backyard/app/sync/page.tsx` — fitur lain, di luar scope
- `registrationRequests` Firestore schema — tidak ada field tenant baru
- `firestore.rules` — `platformConfig` sudah `allow read: if true` (existing)
- `firestore.indexes.json` — tidak ada query baru yang perlu index

---

## 6. Implementation Detail

### 6.1 `lib/platform-config/registration-config.ts` (Platform-v2 server)

```ts
import { adminDb } from '@/lib/firebase-admin';

export interface RegistrationConfig {
  registrationTenant: string;
}

let cache: RegistrationConfig | null = null;

export async function fetchRegistrationConfig(): Promise<RegistrationConfig> {
  if (cache) return cache;
  const snap = await adminDb.doc('platformConfig/registration').get();
  if (!snap.exists) {
    throw new Error('platformConfig/registration not found. Run seeder.');
  }
  const data = snap.data();
  if (!data?.registrationTenant) {
    throw new Error('platformConfig/registration missing registrationTenant field.');
  }
  cache = { registrationTenant: data.registrationTenant as string };
  return cache;
}

export function clearRegistrationConfigCache(): void {
  cache = null;
}
```

### 6.2 `lib/platform-config/registration-config.ts` (Backyard client)

```ts
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface RegistrationConfig {
  registrationTenant: string;
}

let cache: RegistrationConfig | null = null;

export async function fetchRegistrationConfig(): Promise<RegistrationConfig> {
  if (cache) return cache;
  const ref = doc(db, 'platformConfig', 'registration');
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    throw new Error('platformConfig/registration not found. Run seeder.');
  }
  const data = snap.data();
  if (!data?.registrationTenant) {
    throw new Error('platformConfig/registration missing registrationTenant field.');
  }
  cache = { registrationTenant: data.registrationTenant as string };
  return cache;
}

export function clearRegistrationConfigCache(): void {
  cache = null;
}
```

### 6.3 `app/[tenant]/register/page.tsx`

```tsx
import { notFound } from 'next/navigation';
import { fetchRegistrationConfig } from '@/lib/platform-config/registration-config';
import RegisterForm from './RegisterForm';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Daftar — Clicker Universe',
  description: 'Daftarkan bisnis Anda untuk mulai menggunakan Clicker.',
};

export default async function RegisterPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant } = await params;
  const { registrationTenant } = await fetchRegistrationConfig();
  if (tenant !== registrationTenant) notFound();

  return (
    <main className="min-h-screen bg-neutral-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold text-neutral-900">Daftar Clicker</h1>
          <p className="mt-2 text-neutral-600">
            Isi form di bawah untuk mengajukan akses. Tim kami akan meninjau dan
            mengaktifkan akun Anda.
          </p>
        </header>
        <RegisterForm tenant={tenant} />
      </div>
    </main>
  );
}
```

### 6.4 `lib/registration/api-server.ts`

```ts
import { adminDb } from '@/lib/firebase-admin';

export async function validatePromoCode(
  rawCode: string,
  siteId: string
): Promise<PromoValidationResult> {
  const code = (rawCode ?? '').trim().toUpperCase();
  if (!code) return { valid: false, reason: 'Code is empty' };

  const snap = await adminDb
    .collection('sites').doc(siteId)
    .collection('modules').doc('promo')
    .collection('promos')
    .where('code', '==', code)
    .limit(1)
    .get();

  if (snap.empty) return { valid: false, reason: 'Promo code not found' };

  const data = snap.docs[0].data();
  return {
    valid: true,
    name: data.name,
    kind: data.kind,
    value: data.value,
    maxDiscount: data.maxDiscount,
  };
}
```

### 6.5 `app/api/public/validate-promo/route.ts`

Logic baru:
```ts
const code = searchParams.get('code') ?? '';
const siteId = searchParams.get('siteId') ?? '';

if (!code) return 400 { reason: 'Missing code' };
if (!siteId) return 400 { reason: 'Missing siteId' };

const { registrationTenant } = await fetchRegistrationConfig();
if (siteId !== registrationTenant) return 403 { reason: 'Tenant not allowed' };

const result = await validatePromoCode(code, siteId);
return result;
```

### 6.6 `backyard/lib/promo/api.ts`

```ts
import { fetchRegistrationConfig } from '@/lib/platform-config/registration-config';

export async function commitRegistrationPromo(code: string): Promise<void> {
  const { registrationTenant: siteId } = await fetchRegistrationConfig();
  const promoCode = code.trim().toUpperCase();
  // ...rest unchanged (query path, transaction)
}
```

### 6.7 `seed-platform-config.ts` (extend existing)

Tambah doc kedua di seeder:
```ts
await db.doc('platformConfig/registration').set({
  registrationTenant: 'go',
  updatedAt: FieldValue.serverTimestamp(),
});
```

---

## 7. Testing Strategy

### 7.1 Unit Tests (Platform-v2 — Vitest)

**Modified:**

`lib/registration/__tests__/api-server.test.ts`:
- Update mock: tambah mock untuk `fetchRegistrationConfig` (return `{ registrationTenant: 'go' }`)
- Update test: `validatePromoCode('CODE', 'go')` → expect query path correct
- New test: `validatePromoCode('CODE', 'wrong-tenant')` → expect handles correctly (validation di route, not in api-server)

`lib/registration/__tests__/email-hooks.test.ts`:
- Update signature: `submitRegistration('go', validInput)` instead of `submitRegistration(validInput)`
- Test invalid tenant: `submitRegistration('quattro', input)` → return error

**NEW:**

`lib/platform-config/__tests__/registration-config.test.ts`:
- Test fetch + cache hit
- Test cache miss → Firestore read
- Test missing doc → throw with helpful message
- Test missing `registrationTenant` field → throw

### 7.2 Manual Integration Tests

| # | Scenario | Expected |
|---|---|---|
| 1 | Localhost: `http://localhost:3000/go/register` | Render form ✓ |
| 2 | Localhost: `http://localhost:3000/quattro/register` | 404 |
| 3 | Localhost: `http://localhost:3000/register` | 404 (root path tidak ada) |
| 4 | Staging: `stg-clicker-core.web.app/go/register` | Render form ✓ |
| 5 | Staging: `stg-clicker-core.web.app/register` | 404 |
| 6 | Production: `clicker.id/register` | Render form ✓ (worker rewrite) |
| 7 | Production: `go.clicker.id/register` | 301 → `clicker.id/register` |
| 8 | API: `/api/public/validate-promo?code=X&siteId=go` | 200 valid result |
| 9 | API: `/api/public/validate-promo?code=X&siteId=invalid` | 403 |
| 10 | API: `/api/public/validate-promo?code=X` | 400 missing siteId |
| 11 | API: `/api/public/validate-promo?siteId=go` | 400 missing code |

### 7.3 E2E Flow Test

1. Buka `localhost:3000/go/register`
2. Isi form, input promo `MORECLICK`
3. Klik "Cek kode" → verify diskon info muncul
4. Submit form → verify `registrationRequests/{id}` di Firestore
5. Buka `localhost:3013/registrations/{id}` (Backyard)
6. Verify PromoCard render dengan diskon info
7. Klik Activate → form Create Tenant prefilled
8. Create Tenant → verify `sites/go/modules/promo/promos/{id}.usageCount` increment
9. Klik Kirim Kredensial → verify email kirim

### 7.4 Build Verification

```bash
cd clicker-platform-v2 && pnpm build  # No TS error
cd backyard && pnpm build              # No TS error
cd clicker-platform-v2 && pnpm test    # All tests pass
```

---

## 8. Migration & Rollout

### 8.1 Pre-Deploy Setup (one-time)

**Seed `platformConfig/registration`:**
```bash
cd clicker-platform-v2
pnpm dlx tsx scripts/seed-platform-config.ts
```

Verifikasi di Firebase Console:
- Collection `platformConfig`, doc `registration`
- Field: `registrationTenant: "go"`

**No rules update needed** — `platformConfig` rules sudah `allow read: if true` dari refactor sebelumnya.

**No worker.js change** — sudah handle apex routing.

### 8.2 Deploy Order (bertahap)

```bash
cd dev
firebase use staging

# 1. Platform-v2 (most changes)
firebase deploy --only hosting:core

# Verifikasi:
#   - https://stg-clicker-core.web.app/go/register → 200
#   - https://stg-clicker-core.web.app/register → 404
#   - GET /api/public/validate-promo?code=MORECLICK&siteId=go → 200
#   - GET /api/public/validate-promo?code=X (no siteId) → 400

# 2. Backyard
firebase deploy --only hosting:backyard

# Verifikasi:
#   - PromoCard render dengan diskon info
#   - Activate → tenant created + promo committed

# 3. Auth gateway
firebase deploy --only hosting:auth

# Verifikasi:
#   - "Daftar Sekarang" link → /go/register
```

### 8.3 Rollback Plan

**Quick rollback** via Firebase Hosting UI:
- Console → Hosting → site → Release history → "Rollback" pada release sebelumnya

**Atau git revert:**
```bash
git revert <commit-hash>
git push origin dev
firebase deploy --only hosting
```

**Tidak perlu rollback Firestore** — config doc additive, tidak destructive.

### 8.4 Backward Compatibility

**Breaking change**: bookmark `/register` (root) akan 404 setelah deploy.

**Acceptable risk**: feature baru deploy hari, bookmark belum tersebar.

**Production safe**: `clicker.id/register` (apex) tetap work via Cloudflare Worker rewrite.

### 8.5 Post-Deploy Monitoring

```bash
# Cloud Run logs
firebase functions:log --only ssrstgclickercore --lines 50

# Cek error rate
gcloud logging read 'resource.type="cloud_run_revision" AND severity>=ERROR' --limit 20 --project clicker-universe-stagging
```

Cek tab "Registrations" di Backyard Monitoring untuk event log.

---

## 9. Error Handling

| Scenario | Behavior |
|---|---|
| `platformConfig/registration` doc tidak ada | Throw error dengan instruksi run seeder, log to Firestore |
| Invalid tenant access `/{other}/register` | Next.js `notFound()` → 404 page |
| API call tanpa `siteId` | 400 Bad Request `{ reason: 'Missing siteId' }` |
| API call siteId mismatch config | 403 Forbidden `{ reason: 'Tenant not allowed' }` |
| Firestore read fail (network) | Page render shows error state with retry |
| Cache stale (config changed mid-instance) | Acceptable — config rarely changes, deploy auto-restart |

---

## 10. Open Questions / Future Work

- **Multi-tenant register** (jika perlu di masa depan): tinggal ubah `registrationTenant` di Firestore jadi `registrationTenants: ['go', 'franchise-1', ...]`. Logic validation accept array.
- **Backyard UI untuk edit `registrationTenant`**: saat ini edit via Firebase Console. Future: admin page.
- **Self-serve register di tenant operasional** (mis. owner kasisehat invite staff via register): probably better via dedicated `/invite` flow, bukan `/register` publik.

---

**End of spec.**
