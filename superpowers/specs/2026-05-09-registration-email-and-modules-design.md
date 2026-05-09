# Registration Email Flow + Module Activation — Design Spec

**Date:** 2026-05-09
**Status:** Draft (awaiting user review)
**Scope:** Lanjutan dari `2026-05-08-registration-flow-design.md`. Menambahkan (1) email notifications via Resend untuk semua transisi registrasi, (2) module activation di form Create Tenant Backyard, (3) password generator dengan kontrol admin, (4) event log dengan TTL 7 hari, (5) UI cleanup form Create Tenant.

---

## 1. Goals & Non-Goals

### Goals

- Email otomatis ke pendaftar saat submit register, dengan janji review max **3 jam**.
- Email otomatis ke superadmin (`clickerplatform@gmail.com`) saat ada registrasi baru.
- Email kredensial **manual-trigger** (admin klik tombol setelah testing login) — bukan auto saat aktivasi.
- Email penolakan otomatis saat admin reject.
- Form Create Tenant punya section "Modules" dengan source data Firestore (single source of truth).
- Password tenant auto-generate (8 karakter, charset aman), editable, regenerate, copy, **selalu visible** di Backyard.
- Event log untuk audit dengan TTL 7 hari (hemat Firestore).
- UI cleanup: hosting label `clickerapps`, placeholder netral.

### Non-Goals

- Per-tenant override email template (template global di Resend).
- Backyard UI untuk edit template Resend (pakai resend.com langsung).
- Migration `MODULES_CATALOG` static di platform-v2 form register ke Firestore (separate task — di luar scope).
- Hide/show toggle untuk password (tetap visible).
- Email dengan format React Email rendered di code (pakai `templateAlias + variables` pattern existing).

---

## 2. Decisions Summary

| # | Decision | Choice |
|---|----------|--------|
| 1 | Email service | Resend (sudah ada API key di platform-v2) |
| 2 | Backyard ↔ Resend | **Direct call** (no Cloud Function), Backyard punya `RESEND_API_KEY` sendiri |
| 3 | Email logging | Tulis ke koleksi Firestore `email_logs/` yang sama (untuk monitoring) |
| 4 | Email template format | Resend dashboard managed (alias + variables, no React Email) |
| 5 | Sender domain | `noreply@clicker.id` (existing setup) |
| 6 | Admin notif email | `clickerplatform@gmail.com` (env: `ADMIN_NOTIFICATION_EMAIL`) |
| 7 | Send credentials trigger | Manual button "Kirim Kredensial" di detail registrasi (setelah admin verify login) |
| 8 | Module catalog source | Firestore `platformConfig/modules` (single source of truth) |
| 9 | Module UI in form | Checkbox grid 2 kolom |
| 10 | Module prefill from registration | Yes, resolve bundle dulu (`beauty-spa` → `[reservation, membership, promo]`) |
| 11 | Password length | 8 karakter |
| 12 | Password charset | `A-Z` (no I/O), `a-z` (no i/l/o), `2-9`, `-_+=!@#$%&` |
| 13 | Password storage | Plaintext di `registrationRequests/{id}.tempPassword`, dihapus setelah email kredensial sukses terkirim |
| 14 | Password visibility | Always visible (no hide/show toggle) |
| 15 | Event log collection | New collection `registrationEvents/` (root-level) |
| 16 | Event log scope | Hanya event krusial (5 types, lihat §6) |
| 17 | Event log TTL | 7 hari, via Firestore TTL policy on field `expireAt` |
| 18 | Hosting label | `clickerapps` (single button, future-ready) |

---

## 3. Architecture

```
┌──────────────────────────────────────────────────────────┐
│                       BACKYARD :3013                     │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Pages                                              │  │
│  │  /tenants                  (form Create Tenant)    │  │
│  │  /registrations/[id]       (detail + send button)  │  │
│  └─────────────────┬──────────────────────────────────┘  │
│                    │                                     │
│  ┌─────────────────▼──────────────────────────────────┐  │
│  │ API Routes (Next.js)                               │  │
│  │  /api/registrations/[id]/activate (existing)       │  │
│  │  /api/registrations/[id]/send-credentials  (NEW)   │  │
│  │  /api/registrations/[id]/reject            (NEW)   │  │
│  └─────────────────┬──────────────────────────────────┘  │
│                    │                                     │
│  ┌─────────────────▼──────────────────────────────────┐  │
│  │ lib/email/                                         │  │
│  │  send.ts        — orchestrator                     │  │
│  │  resend-client.ts — call Resend API                │  │
│  │  guard.ts       — dev allowlist                    │  │
│  │  log.ts         — write email_logs/                │  │
│  └────────────────────────────────────────────────────┘  │
└────────┬─────────────────────────────────┬───────────────┘
         │                                 │
         │ Resend HTTPS                    │ Firestore
         ▼                                 ▼
   ┌──────────┐              ┌─────────────────────────────┐
   │ Resend   │              │ Firestore (shared)          │
   │ API      │              │  platformConfig/modules     │
   └──────────┘              │  registrationRequests/      │
                             │  registrationEvents/  (TTL) │
                             │  email_logs/                │
                             │  sites/                     │
                             └─────────────────────────────┘
                                          ▲
                                          │
┌─────────────────────────────────────────┴────────────────┐
│                    PLATFORM-V2 :3000                     │
│  ┌────────────────────────────────────────────────────┐  │
│  │ /(public)/register/                                │  │
│  │   submit-action.ts (server action)                 │  │
│  │     ├─ createRegistrationRequest()                 │  │
│  │     ├─ sendEmail(confirmation → pendaftar)         │  │
│  │     └─ sendEmail(notif → admin)                    │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │ lib/email/sender.ts (existing)                     │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

---

## 4. Data Flow

### 4.1 User Submit Register

```
User fill form /register
   │
   ▼
submit-action.ts
   │
   ├─ validate (zod)
   ├─ rate limit check
   ├─ validatePromoCode (re-validate)
   ├─ createRegistrationRequest() → Firestore
   │
   ├─ sendEmail({
   │     to: pendaftar.email,
   │     templateAlias: 'registration-confirmation',
   │     variables: { name, businessName, reviewSla: '3 jam' }
   │   })
   │     └─ on failure: log to registrationEvents/ (level: error)
   │
   └─ sendEmail({
        to: process.env.ADMIN_NOTIFICATION_EMAIL,
        templateAlias: 'registration-admin-notif',
        variables: {
          businessName, name, email, phone, city,
          bundle, modules, promoCode, customRequest,
          backyardUrl: 'https://backyard.clicker.id/registrations/{id}'
        }
      })
        └─ on failure: log to registrationEvents/ (level: error)
```

**Catatan:** kedua email dikirim async (Promise.all), tapi kegagalan email **tidak menggagalkan submit** (registrasi tetap masuk). User dapat success message standar.

### 4.2 Admin Activate

```
Admin klik [Activate] di detail registrasi
   │
   ▼
Redirect ke /tenants?fromRegistration={id}
   │
   ▼
Form Create Tenant terbuka, prefill dari registrasi:
   ├─ name = registration.businessName
   ├─ subdomain = suggestSlug(businessName)
   ├─ ownerEmail = registration.email
   ├─ password = generatePassword()
   ├─ modules = resolveModules(registration.bundle, registration.modules)
   ├─ hostingId = 'clickerapps'
   └─ seedSampleData = true
   │
   ▼
Admin review/edit, click [Create Tenant]
   │
   ▼
Sequenced execution (must be in order):
   │
   ├─ 1. Call createTenant CF (existing) with all fields including modules
   │     │   await result.siteId
   │     └─ on failure: toast error, do NOT call step 2, registrasi tidak di-update
   │
   ▼
2. POST /api/registrations/[id]/activate
   │   body: { siteId, tempPassword }
   │   (only invoked if step 1 succeeds)
   │
   ├─ setStatus(id, 'activated', { activatedSiteId: siteId })
   ├─ Firestore: registrationRequests/{id}.tempPassword = password
   ├─ commitRegistrationPromo() (best-effort, log error if fails)
   └─ writeEvent('registration.activated', { siteId, modules })
```

### 4.3 Admin Test Login (manual)

Admin buka `auth.clicker.id`, login pakai email + password yang di-display di detail registrasi.
Tidak ada automation di tahap ini — pure manual untuk verify akun jalan.

### 4.4 Admin Click "Kirim Kredensial"

```
Admin klik [Kirim Kredensial] di detail registrasi
   │
   ▼
POST /api/registrations/[id]/send-credentials
   │
   ├─ Read registrationRequests/{id}
   │     ├─ verify status === 'activated'
   │     │     └─ if not: return 400 "Registrasi belum di-activate"
   │     ├─ verify credentialsSent !== true
   │     │     └─ if true: return 409 "Kredensial sudah pernah dikirim"
   │     ├─ verify tempPassword exists
   │     │     └─ if missing: return 400 "Password tidak tersedia (mungkin sudah dihapus)"
   │     └─ read tempPassword + activatedSiteId + email
   │
   ├─ sendEmail({
   │     to: registration.email,
   │     templateAlias: 'registration-activated',
   │     variables: {
   │       name, businessName,
   │       loginEmail: email,
   │       password: tempPassword,
   │       slug: activatedSiteId,
   │       authUrl: 'https://auth.clicker.id',
   │       tenantUrl: 'https://{slug}.clicker.id'
   │     }
   │   })
   │
   ├─ on success:
   │     ├─ update registrationRequests/{id}: { credentialsSent: true, credentialsSentAt: now, tempPassword: null }
   │     └─ writeEvent('registration.credentials_sent', { to: email })
   │
   └─ on failure:
         └─ writeEvent('email.failed', { type: 'credentials', error })
```

### 4.5 Admin Reject

```
Admin click [Reject] → modal input alasan
   │
   ▼
POST /api/registrations/[id]/reject
   body: { reason }
   │
   ├─ setStatus(id, 'rejected', { rejectionReason: reason })
   │
   ├─ sendEmail({
   │     to: registration.email,
   │     templateAlias: 'registration-rejected',
   │     variables: { name, businessName, reason }
   │   })
   │
   ├─ on success:
   │     └─ writeEvent('registration.rejected', { reason })
   │
   └─ on failure:
         └─ writeEvent('email.failed', { type: 'rejected', error })
```

---

## 5. Form Create Tenant — UI Changes

### 5.1 Final Wireframe (from-registration state)

(Nilai field di bawah adalah **contoh** dari registrasi pendaftar bernama "Sample Business"; bukan placeholder. Placeholder kosong ditampilkan di §5.2.)

```
┌─────────────────────────────────────────────────────────────────┐
│ Tenants                                          [+ New Tenant] │
├─────────────────────────────────────────────────────────────────┤
│ ┌─ ⚡ ACTIVATING REGISTRATION ──────────────────────────────┐   │
│ │ Sample Business — owner@sample.com                        │   │
│ │ Promo: MORECLICK    Bundle: beauty-spa                    │   │
│ └───────────────────────────────────────────────────────────┘   │
│                                                                 │
│ ┌─ NEW TENANT ──────────────────────────────────────────────┐   │
│ │  Tenant Name              │  Subdomain (ID)               │   │
│ │  [Sample Business      ]  │  [sample-business         ]   │   │
│ │                           │  Preview: sample-business.    │   │
│ │                           │           clicker.id ✓ ok     │   │
│ │                                                           │   │
│ │  Owner Email              │  Owner Password               │   │
│ │  [owner@sample.com     ]  │  [Kx7-mP2$         ] [🔄][📋]│   │
│ │                                                           │   │
│ │  Hosting                  │  ☑ Seed sample data           │   │
│ │  [CLICKERAPPS]            │                               │   │
│ │                                                           │   │
│ │  ┌─ MODULES TO ENABLE ─────────────────────────────────┐  │   │
│ │  │ ☐ Self Order POS       │ ☐ Inventory               │  │   │
│ │  │ ☑ Reservation          │ ☑ Membership              │  │   │
│ │  │ ☑ Promo Engine         │ ☐ Service Records         │  │   │
│ │  │ ☐ Sales Pipeline       │ ☐ AI Sales Agent          │  │   │
│ │  │ ☐ AI Marketing         │                           │  │   │
│ │  └─────────────────────────────────────────────────────┘  │   │
│ │                                                           │   │
│ │                                          [Create Tenant]  │   │
│ └───────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Empty State (manual create)

```
Tenant Name              Subdomain (ID)
[My Business         ]   [my-business           ]
                          (no preview until typed)

Owner Email              Owner Password
[owner@business.com  ]   [Hg4-nR8!         ] [🔄][📋]
                          (auto-generated on form open)

Hosting                  ☑ Seed sample data
[CLICKERAPPS]

MODULES TO ENABLE
☐ Self Order POS       ☐ Inventory
☐ Reservation          ☐ Membership
☐ Promo Engine         ☐ Service Records
☐ Sales Pipeline       ☐ AI Sales Agent
☐ AI Marketing
                                     [Create Tenant]
```

### 5.3 Loading State (Module Catalog)

```
MODULES TO ENABLE
   ⏳ Memuat katalog modul...
```

### 5.4 Error State (Catalog Fetch Failed)

```
MODULES TO ENABLE
   ⚠ Gagal memuat katalog modul.
   Periksa koneksi atau hubungi superadmin.
                                          [Retry]
```

---

## 6. Event Log Schema

**Collection:** `registrationEvents/{eventId}` (root-level Firestore)

```ts
interface RegistrationEvent {
  id: string;
  type:
    | 'registration.activated'
    | 'registration.credentials_sent'
    | 'registration.rejected'
    | 'email.failed'
    | 'promo.commit.failed';
  level: 'info' | 'error';
  registrationId: string;
  actorEmail?: string;       // dari Firebase Auth admin
  payload: Record<string, unknown>;
  createdAt: Timestamp;
  expireAt: Timestamp;        // createdAt + 7 days
}
```

**Tidak di-log** (untuk hemat Firestore):
- `registration.submitted` — sudah ada di `registrationRequests` itu sendiri
- `email.sent` (sukses) — ada di `email_logs/` (existing)

**TTL setup:** Firebase Console → Firestore → koleksi `registrationEvents` → field `expireAt` → enable TTL policy. **Manual setup sekali oleh user**, tidak ada automation di code.

---

## 7. Module Catalog Schema

**Document:** `platformConfig/modules` (single doc)

```ts
interface PlatformModulesConfig {
  catalog: ModuleCatalogEntry[];
  updatedAt: Timestamp;
}

interface ModuleCatalogEntry {
  id: string;            // matches MODULES_CATALOG[].id (existing)
  name: string;
  description: string;
  defaultEnabled?: boolean;  // optional, untuk masa depan
}
```

**Initial seed (one-time script):**

```ts
// scripts/seed-platform-config.ts
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

await db.doc('platformConfig/modules').set({ catalog, updatedAt: now });
```

**Tambah modul baru di masa depan:** edit doc Firestore via Firebase Console (atau script lain). **Tidak perlu deploy.**

**Cache strategy:** Backyard fetch sekali saat form Create Tenant terbuka, simpan di module-level variable. Reload halaman = fresh fetch. Tidak pakai SWR / React Query.

---

## 8. Password Generator

**File:** `dev/backyard/lib/registrations/password-generator.ts`

```ts
const UPPER  = 'ABCDEFGHJKLMNPQRSTUVWXYZ';   // hindari I, O
const LOWER  = 'abcdefghjkmnpqrstuvwxyz';     // hindari i, l, o
const DIGIT  = '23456789';                    // hindari 0, 1
const SYMBOL = '-_+=!@#$%&';                  // hindari . , " ' ` * ( ) [ ] { } < > / \ | : ; ?

export function generatePassword(length = 8): string {
  // Guarantee minimal: 1 upper + 1 lower + 1 digit + 1 symbol
  // Sisanya random dari ALL charset
  // Gunakan crypto.getRandomValues (bukan Math.random)
}
```

**Digunakan di:** form Create Tenant Backyard (auto-isi saat form open).

**Tombol:**
- 🔄 Regenerate → panggil `generatePassword()` lagi
- 📋 Copy → `navigator.clipboard.writeText(password)`

**Field:**
- Type: `text` (selalu visible)
- Editable: ya (admin bisa overwrite manual)
- Required: ya

---

## 9. Email Templates (Resend Dashboard)

User akan create 4 template di Resend dashboard dengan alias berikut:

| Alias | To | Subject (di Resend) | Variables |
|---|---|---|---|
| `registration-confirmation` | Pendaftar | "Terima kasih, {{businessName}} — kami review max 3 jam" | `name, businessName, reviewSla` |
| `registration-admin-notif` | Admin internal | "Registrasi baru: {{businessName}}" | `businessName, name, email, phone, city, bundle, modules, promoCode, customRequest, backyardUrl` |
| `registration-activated` | Pendaftar | "Akun {{businessName}} sudah aktif" | `name, businessName, loginEmail, password, slug, authUrl, tenantUrl` |
| `registration-rejected` | Pendaftar | "Registrasi {{businessName}}" | `name, businessName, reason` |

**Variable encoding:** semua dikirim sebagai string. Array `modules` dikonversi jadi comma-separated (e.g., `"reservation, membership, promo"`).

---

## 10. Files Affected

### NEW Files

```
dev/backyard/lib/email/
  ├─ resend-client.ts         (POST ke Resend API)
  ├─ guard.ts                 (dev allowlist check)
  ├─ log.ts                   (write email_logs/)
  └─ send.ts                  (orchestrator: send + log + error handling)

dev/backyard/lib/registrations/
  ├─ password-generator.ts    (8 char, charset aman)
  └─ event-log.ts             (write registrationEvents/ dengan TTL)

dev/backyard/lib/platform-config/
  └─ modules-catalog.ts       (fetch dari Firestore + cache)

dev/backyard/components/tenants/
  └─ ModuleSelector.tsx       (checkbox grid 2 kolom + loading/error state)

dev/backyard/app/api/registrations/[id]/
  ├─ send-credentials/route.ts
  └─ reject/route.ts

scripts/
  └─ seed-platform-config.ts  (one-time seeder)
```

### MODIFIED Files

```
dev/backyard/app/tenants/page.tsx
  ├─ tambah state modules + integrasi <ModuleSelector>
  ├─ prefill modules dari registration (resolve bundle)
  ├─ password auto-generate saat form open + tombol regenerate/copy
  ├─ password type="text" (visible)
  ├─ Hosting label "CLICKERAPPS" + state default 'clickerapps'
  ├─ placeholder netral
  └─ kirim modules ke createTenant CF (saat ini kosong {})

dev/backyard/app/registrations/[id]/page.tsx
  └─ tambah tombol [Kirim Kredensial] (jika activated && !credentialsSent)

dev/backyard/app/registrations/[id]/RejectModal.tsx
  └─ POST ke /api/registrations/[id]/reject (saat ini panggil setStatus langsung)

dev/backyard/app/api/registrations/[id]/activate/route.ts
  └─ tambah simpan tempPassword
  └─ writeEvent('registration.activated')
  └─ on promo error: writeEvent('promo.commit.failed')

dev/backyard/lib/registrations/types.ts
  └─ tambah field tempPassword?: string
  └─ tambah field credentialsSent?: boolean
  └─ tambah field credentialsSentAt?: Timestamp

dev/backyard/.env.development.local
  └─ tambah RESEND_API_KEY, EMAIL_*, RESEND_TEMPLATE_REG_*, ADMIN_NOTIFICATION_EMAIL

dev/clicker-platform-v2/lib/registration/submit-action.ts
  └─ setelah createRegistrationRequest sukses:
      ├─ sendEmail(confirmation ke pendaftar)
      └─ sendEmail(notif ke admin)
  └─ on email fail: log warning (don't fail submit)

dev/clicker-platform-v2/lib/email/config.ts
  └─ tambah getTemplateAliases() untuk RESEND_TEMPLATE_REG_*

dev/clicker-platform-v2/.env.development.local
  └─ tambah RESEND_TEMPLATE_REG_CONFIRMATION
  └─ tambah RESEND_TEMPLATE_REG_ADMIN_NOTIF
  └─ tambah ADMIN_NOTIFICATION_EMAIL
```

### UNCHANGED Files

- `dev/functions/src/admin/tenant.ts` — sudah terima `modules` param, tidak perlu diubah.
- `dev/clicker-platform-v2/lib/email/sender.ts` — pakai existing `sendEmail()`.
- `dev/clicker-platform-v2/lib/registration/api-server.ts` — `validatePromoCode` sudah ada (modifikasi sebelumnya).

---

## 11. Environment Variables

### Backyard (.env.development.local)

```env
# Resend
RESEND_API_KEY=re_xxx                    # USER_PROVIDED
EMAIL_SENDER_DOMAIN=clicker.id
EMAIL_SENDER_LOCAL_PART=noreply
EMAIL_SYSTEM_FROM_NAME=Clicker Platform
EMAIL_DEV_ALLOWLIST=@clicker.id,@resend.dev,@gmail.com

# Template aliases (sesuai dashboard Resend)
RESEND_TEMPLATE_REG_CONFIRMATION=registration-confirmation
RESEND_TEMPLATE_REG_ADMIN_NOTIF=registration-admin-notif
RESEND_TEMPLATE_REG_ACTIVATED=registration-activated
RESEND_TEMPLATE_REG_REJECTED=registration-rejected

# Notifikasi admin
ADMIN_NOTIFICATION_EMAIL=clickerplatform@gmail.com

# URL untuk link di email
NEXT_PUBLIC_BACKYARD_PUBLIC_URL=http://localhost:3013
NEXT_PUBLIC_AUTH_URL=http://localhost:3012
NEXT_PUBLIC_TENANT_URL_TEMPLATE=http://{slug}.localhost:3000  # dev only
```

### Platform-v2 (.env.development.local) — Tambahan

```env
# Tambahan ke yang sudah ada
RESEND_TEMPLATE_REG_CONFIRMATION=registration-confirmation
RESEND_TEMPLATE_REG_ADMIN_NOTIF=registration-admin-notif
ADMIN_NOTIFICATION_EMAIL=clickerplatform@gmail.com
```

---

## 12. Error Handling

### Email Failures

| Scenario | Behavior |
|---|---|
| User submit, email konfirmasi gagal | Submit tetap sukses, log `email.failed` to `registrationEvents/` |
| User submit, email admin gagal | Submit tetap sukses, log `email.failed`. Admin tetap bisa lihat via dashboard. |
| Send-credentials gagal | Status registrasi tetap, `credentialsSent` tidak di-update. Admin bisa retry. |
| Reject email gagal | Status sudah `rejected`. Log `email.failed`. Admin bisa manual contact. |
| Resend API down | Semua email gagal → log error → tidak ada side effect ke flow utama (kecuali send-credentials yang return error ke admin) |
| Email recipient tidak di allowlist (dev) | Skip kirim, tulis ke `email_logs/` dengan tag `dev_blocked: true` (existing behavior) |

### Module Catalog Failures

| Scenario | Behavior |
|---|---|
| `platformConfig/modules` doc tidak ada | Tampil error state + instruksi run seeder |
| Doc ada, `catalog: []` | Tampil "Tidak ada modul tersedia" |
| Modul di registrasi tidak ada di catalog | Skip + tampil notice "1 modul tidak ditemukan: {id}" |
| Fetch gagal (network) | Error state + tombol Retry |

### Activation Failures

| Scenario | Behavior |
|---|---|
| `createTenant` CF gagal | Toast error, registrasi tidak di-update, admin bisa retry |
| Activate API gagal setelah CF sukses | Tenant sudah dibuat. Toast warning "Tenant created tapi status registrasi tidak ter-update". Admin bisa retry activate API. |
| Promo commit gagal | Tenant + status sudah update (best-effort). Log `promo.commit.failed`. Admin bisa manual fix. |

---

## 13. Testing Plan

### Unit Tests

```
dev/backyard/lib/registrations/__tests__/password-generator.test.ts
  ├─ length === 8
  ├─ contains at least 1 upper, 1 lower, 1 digit, 1 symbol
  ├─ no excluded chars (. , " ' etc)
  └─ statistically distributed (100 generations, no dupes)

dev/backyard/lib/email/__tests__/guard.test.ts
  └─ allowlist enforced in dev

dev/backyard/lib/platform-config/__tests__/modules-catalog.test.ts
  ├─ fetch dari Firestore mock
  └─ cache reused on second call
```

### Manual E2E

```
1. Submit register → cek inbox pendaftar (gmail) + admin (gmail)
2. Open Backyard /registrations/[id] → verify data
3. Click Activate → verify form prefilled (name, slug, email, password, modules)
4. Verify CLICKERAPPS hosting button visible
5. Check checkbox modules sesuai bundle/registrasi
6. Click Create Tenant → verify tenant + modules created in Firestore
7. Login manual ke auth.clicker.id pakai email + password → verify masuk
8. Back to detail registrasi → verify password masih visible
9. Click "Kirim Kredensial" → verify email kredensial sampai ke pendaftar
10. Verify password dihapus dari registrasi (tempPassword: null, credentialsSent: true)
11. Buat registrasi baru, click Reject → verify email penolakan sampai
12. Cek event log di Firestore registrationEvents/ ada 3-4 docs
13. Wait 7+ days (atau set expireAt manual ke past) → verify TTL hapus doc
```

---

## 14. Migration & Rollout

### One-Time Setup

1. **Seed `platformConfig/modules`** doc:
   ```bash
   pnpm tsx scripts/seed-platform-config.ts
   ```
2. **Set Firestore TTL policy** untuk `registrationEvents`:
   - Firebase Console → Firestore → Indexes → TTL → Add policy
   - Collection: `registrationEvents`, Field: `expireAt`
3. **Verify Resend domain `clicker.id`** sudah di-verify (DNS records).
4. **Buat 4 template** di Resend dashboard dengan alias yang sudah ditentukan.
5. **Set env vars** di kedua app (Backyard + Platform-v2).

### Deploy Order

1. Deploy seeder script + run sekali.
2. Deploy platform-v2 dengan submit-action update.
3. Deploy backyard dengan semua perubahan UI + API routes.
4. Manual test E2E.

### Rollback

- Email gagal kirim **tidak menggagalkan flow utama** — registrasi tetap masuk, tenant tetap bisa dibuat.
- Module activation: kalau bug, kembalikan `modules: {}` di `handleCreate` (1 line change).
- Hosting label: ganti string saja.

---

## 15. Open Questions / Future Work

- **Self-serve email sender domain per tenant** — di masa depan tenant mungkin mau pakai domain sendiri. Tidak in scope.
- **Email retry queue** — saat ini fire-and-forget. Future: pakai Pub/Sub atau scheduled retry.
- **Backyard UI untuk edit `platformConfig/modules`** — saat ini edit via Firebase Console. Future: bikin admin page.
- **Migration platform-v2 form register ke Firestore catalog** — saat ini static `MODULES_CATALOG`. Future: replace dengan fetch dari `platformConfig/modules`.
- **Real password reset flow** — saat ini admin set password manual + kirim plaintext. Future: kirim "set password link" + Firebase Auth password reset.

---

**End of spec.**
