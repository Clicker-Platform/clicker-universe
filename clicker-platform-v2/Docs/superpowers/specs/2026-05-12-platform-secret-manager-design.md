# Platform Secret Manager + API Keys UI — Design Spec
**Date:** 2026-05-12  
**Status:** Approved  
**Scope:** Konsolidasi semua platform secrets ke GCP Secret Manager + Backyard API Keys management screen

---

## Vision

Semua platform-level secrets (API keys, tokens) disimpan di **GCP Secret Manager** — bukan env vars, bukan Firestore. Config non-sensitif yang sering berubah (Resend template IDs) dipindah ke **Firestore** agar configurable via Backyard tanpa redeploy. Backyard mendapat satu screen untuk manage semua ini.

---

## Build Order

```
Phase 1: lib/secrets/ layer       ← fondasi, dependency Phase 2 & 3
Phase 2: AI Core migration        ← pakai lib/secrets/ untuk OPENROUTER_API_KEY
Phase 3: Backyard API Keys UI     ← manage secrets + Resend config + health check
```

Phase 2 (AI Core) sudah punya spec terpisah: `2026-05-12-ai-core-foundation-design.md`

---

## Phase 1 — `lib/secrets/` Layer

### Struktur

```
lib/secrets/
├── index.ts       ← public API
├── client.ts      ← GCP Secret Manager client, in-memory cache
└── types.ts       ← SecretKey enum, SecretsMap
```

### Secret Registry

```ts
// types.ts — semua known secrets terdaftar di sini
export const SECRET_KEYS = {
  OPENROUTER_API_KEY:     'OPENROUTER_API_KEY',
  RESEND_API_KEY:         'RESEND_API_KEY',
  WA_WEBHOOK_VERIFY_TOKEN:'WA_WEBHOOK_VERIFY_TOKEN',
  META_APP_SECRET:        'META_APP_SECRET',
  WA_ENCRYPTION_KEY:      'WA_ENCRYPTION_KEY',
  UPSTASH_REDIS_REST_TOKEN:'UPSTASH_REDIS_REST_TOKEN',
} as const;

export type SecretKey = keyof typeof SECRET_KEYS;
```

### Public API (`index.ts`)

```ts
// Get secret value — cached TTL 10 menit
export async function getSecret(key: SecretKey): Promise<string>

// Check if secret exists (no value returned) — untuk health check UI
export async function secretExists(key: SecretKey): Promise<boolean>

// Set/rotate secret value — dipanggil dari Backyard API route
export async function setSecret(key: SecretKey, value: string): Promise<void>

// Delete secret
export async function deleteSecret(key: SecretKey): Promise<void>

// List all registered secrets with existence status
export async function listSecrets(): Promise<{ key: SecretKey; exists: boolean }[]>
```

### Caching Strategy

- Per-key in-memory cache, TTL 10 menit
- `setSecret` invalidate cache untuk key tersebut immediately
- Server restart = cache cleared (fresh fetch)
- Tidak ada cross-instance cache sharing (stateless, tiap instance fetch sendiri)

### GCP Setup (One-Time)

1. Enable Secret Manager API di GCP project
2. Grant `Secret Manager Secret Accessor` + `Secret Manager Admin` roles ke Firebase service account
3. Add package `@google-cloud/secret-manager`
4. Create secrets via GCP Console atau `gcloud` untuk initial values

### Env Var Migration

Setelah `lib/secrets/` jadi, ganti semua `process.env.X` ke `getSecret('X')`:

| Env Var | Secret Key | Status setelah migrasi |
|---------|-----------|----------------------|
| `RESEND_API_KEY` | `RESEND_API_KEY` | Hapus dari env |
| `WA_WEBHOOK_VERIFY_TOKEN` | `WA_WEBHOOK_VERIFY_TOKEN` | Hapus dari env |
| `META_APP_SECRET` | `META_APP_SECRET` | Hapus dari env |
| `WA_ENCRYPTION_KEY` | `WA_ENCRYPTION_KEY` | Hapus dari env |
| `UPSTASH_REDIS_REST_TOKEN` | `UPSTASH_REDIS_REST_TOKEN` | Hapus dari env |
| `GEMINI_API_KEY` | — | **Hapus total** (diganti OpenRouter) |

**Local dev:** GCP Secret Manager tetap dipakai di local (service account key sudah ada via `GCP_SERVICE_ACCOUNT_KEY`). Tidak perlu fallback ke env var — dev pakai Secret Manager yang sama.

---

## Resend Template Config — Firestore

Template IDs bukan secrets — sering berubah, configurable tanpa redeploy.

**Firestore path:** `platform/email/config`

```ts
// Document structure
{
  templates: {
    passwordReset:    'password-reset',
    emailVerification:'email-verification',
    formSubmission:   'form-submission',
    systemAlert:      'system-alert',
    regConfirmation:  'registration-confirmation',
    regAdminNotif:    'registration-admin-notif',
  },
  sender: {
    domain:    'clicker.id',
    localPart: 'noreply',
    fromName:  'Clicker Platform',
  },
  updatedAt: Timestamp,
  updatedBy: string,  // uid superadmin
}
```

**`lib/email/config.ts`** refactor: `getTemplateAliases()` fetch dari Firestore (cached TTL 5 menit) instead of `process.env`. Fallback ke current default strings kalau Firestore doc belum ada.

Env vars yang dihapus setelah migrasi:
- `RESEND_TEMPLATE_PASSWORD_RESET`
- `RESEND_TEMPLATE_EMAIL_VERIFY`
- `RESEND_TEMPLATE_FORM_SUBMISSION`
- `RESEND_TEMPLATE_SYSTEM_ALERT`
- `RESEND_TEMPLATE_REG_CONFIRMATION`
- `RESEND_TEMPLATE_REG_ADMIN_NOTIF`
- `EMAIL_SENDER_DOMAIN`
- `EMAIL_SENDER_LOCAL_PART`
- `EMAIL_SYSTEM_FROM_NAME`

---

## Phase 3 — Backyard: API Keys Screen

### Navigation

Tambah ke Backyard Sidebar:
```
{ label: 'API Keys', href: '/api-keys' }
```
Posisi: antara `Settings` dan separator terakhir.

### Screen Structure (`/api-keys`)

```
backyard/app/api-keys/
├── page.tsx              ← main screen
├── _components/
│   ├── SecretCard.tsx    ← per-key card: status + test button
│   └── EmailConfigPanel.tsx ← Resend template + sender config
```

### SecretCard UI

Tiap key tampil sebagai card:

```
┌─────────────────────────────────────────────┐
│ 🔑 RESEND_API_KEY                    [✅ Set] │
│ Email delivery service                       │
│                          [Update] [Test]     │
└─────────────────────────────────────────────┘
```

**Status badge:**
- `✅ Set` — secret exists di Secret Manager
- `❌ Missing` — secret not found
- `🔄 Testing...` — live test in progress
- `✅ Connected` / `❌ Failed: <reason>` — live test result

**Update flow:** click Update → modal input value (masked) → confirm → POST `/api/backyard/secrets/set` → invalidate cache.

**Value tidak pernah ditampilkan** — write-only display (tahu exist/tidak, tapi tidak bisa read value).

### Live Test per Key

Tiap key punya test strategy berbeda:

| Key | Test Method |
|-----|-------------|
| `OPENROUTER_API_KEY` | GET `/api/v1/models` di OpenRouter |
| `RESEND_API_KEY` | GET `/domains` di Resend API |
| `WA_WEBHOOK_VERIFY_TOKEN` | Format validation only (no external call) |
| `META_APP_SECRET` | Format validation only |
| `WA_ENCRYPTION_KEY` | Format validation only (length check) |
| `UPSTASH_REDIS_REST_TOKEN` | GET ping ke Upstash REST endpoint |

Test dipanggil via: `POST /api/backyard/secrets/test` `{ key: SecretKey }`

### EmailConfigPanel UI

Section terpisah di bawah secrets list:

```
┌─ Email Configuration ──────────────────────┐
│ Sender Domain:     [clicker.id          ]  │
│ Sender Local Part: [noreply             ]  │
│ From Name:         [Clicker Platform    ]  │
│                                            │
│ Template IDs:                              │
│ Password Reset:    [password-reset      ]  │
│ Email Verify:      [email-verification  ]  │
│ Form Submission:   [form-submission     ]  │
│ System Alert:      [system-alert        ]  │
│ Reg Confirmation:  [registration-conf.. ]  │
│ Reg Admin Notif:   [registration-admin..]  │
│                                            │
│                          [Save Changes]    │
└────────────────────────────────────────────┘
```

Save → POST `/api/backyard/email-config/update` → write ke Firestore `platform/email/config`.

### Backyard API Routes

```
backyard/app/api/
├── secrets/
│   ├── list/route.ts    ← GET: list semua keys + existence status
│   ├── set/route.ts     ← POST: set/rotate key value
│   ├── delete/route.ts  ← DELETE: remove key
│   └── test/route.ts    ← POST: live test connection
└── email-config/
    ├── get/route.ts     ← GET: fetch dari Firestore
    └── update/route.ts  ← POST: save ke Firestore
```

Semua routes: Cloud Functions only (Backyard pattern), tidak ada Firebase Admin SDK direct di client.

---

## Security

- Backyard routes dijaga auth layer yang sudah ada (superadmin only)
- Secret values **tidak pernah** di-return ke client — hanya boolean `exists`
- `setSecret` hanya callable dari server-side Backyard API routes
- Audit log: setiap set/delete/test dicatat di Firestore `platform/auditLog/{id}`

---

## Files Affected

### New Files
- `lib/secrets/index.ts`
- `lib/secrets/client.ts`
- `lib/secrets/types.ts`
- `backyard/app/api-keys/page.tsx`
- `backyard/app/api-keys/_components/SecretCard.tsx`
- `backyard/app/api-keys/_components/EmailConfigPanel.tsx`
- `backyard/app/api/secrets/list/route.ts`
- `backyard/app/api/secrets/set/route.ts`
- `backyard/app/api/secrets/delete/route.ts`
- `backyard/app/api/secrets/test/route.ts`
- `backyard/app/api/email-config/get/route.ts`
- `backyard/app/api/email-config/update/route.ts`

### Modified Files
- `lib/email/config.ts` — fetch dari Firestore instead of env vars
- `lib/email/sender.ts` — `getSecret('RESEND_API_KEY')` instead of env var
- `lib/whatsapp/encryption.ts` — `getSecret('WA_ENCRYPTION_KEY')`
- `lib/cache/redis.ts` — `getSecret('UPSTASH_REDIS_REST_TOKEN')`
- `app/api/webhook/whatsapp/route.ts` — `getSecret('WA_WEBHOOK_VERIFY_TOKEN')` + `getSecret('META_APP_SECRET')`
- `backyard/components/Sidebar.tsx` — tambah nav item API Keys

### Deleted (after migration complete)
- Env vars dari `.env` files (semua yang dimigrasikan)

---

## Dependencies

| Package | Action |
|---------|--------|
| `@google-cloud/secret-manager` | **Add** (shared dengan AI Core) |

---

## Success Criteria

- [ ] `grep -r "process.env.RESEND_API_KEY"` returns 0 results
- [ ] `grep -r "process.env.WA_"` returns 0 results
- [ ] `grep -r "process.env.UPSTASH"` returns 0 results
- [ ] `grep -r "process.env.RESEND_TEMPLATE"` returns 0 results
- [ ] Backyard `/api-keys` screen loads, shows all 6 keys with status
- [ ] Test Connection works for OpenRouter, Resend, Redis
- [ ] Email config editable via Backyard, changes reflected without redeploy
- [ ] Secret values never returned to client (write-only)
- [ ] Audit log entry created for every set/delete operation
