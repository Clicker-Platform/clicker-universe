# Payment Gateway Infrastructure — Design Spec

**Date:** 2026-05-21
**Status:** Approved

---

## Goal

Bangun shared payment gateway infrastructure di Clicker Platform menggunakan Xendit. Satu sistem yang dipakai semua modul dan semua layer payment. Mendukung dua mode per tenant: Clicker collect (default) atau tenant own-key. Module registry pattern — modul baru tinggal register handler tanpa touch core.

---

## Context: Dua Layer Payment

```
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 1: Owner/Tenant bayar ke Clicker                         │
│  → Beli modul (lifetime, per-modul)                             │
│  → Invoice otomatis saat register, superadmin aktifkan manual   │
│  → Fase 2: aktivasi otomatis setelah bayar                      │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 2: Customer bayar ke Tenant                              │
│  → Beli produk/service milik tenant via modul                   │
│  → POS, Membership/LMS, Reservation, dll                        │
└─────────────────────────────────────────────────────────────────┘
```

Kedua layer pakai infrastruktur yang sama — `lib/payment/`, webhook tunggal, registry pattern.

---

## End-to-End Flow

```
╔══════════════════════════════════════════════════════════════════╗
║                 CLICKER PAYMENT ECOSYSTEM                        ║
╚══════════════════════════════════════════════════════════════════╝

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  LAYER 1 — TENANT ONBOARDING & MODULE PURCHASE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Owner
    │  1. Register di clicker.id/register
    │     isi form bisnis + pilih modul yang diinginkan
    ▼
  Submit → otomatis buat Xendit Invoice
    │     email invoice dikirim ke Owner via Resend
    ▼
  Owner bayar via Xendit Hosted Page
  (QRIS / VA / GoPay / OVO / Dana / Kartu)
    │
    ▼  bayar ✓
  Webhook → catat pembayaran
           → notif Backyard: "Owner X bayar modul Y"
    │
    ▼
  Superadmin review di Backyard
    │  → aktifkan modul manual
    │  → paymentConfig otomatis dibuat:
    │    { mode: 'clicker', platformFeePercent: default }
    ▼
  Tenant siap terima payment dari customer ✓

  ── FASE 2 (nanti) ──────────────────────────────────────────────
  Webhook → enableModule(siteId, moduleId) otomatis
  (tanpa superadmin, tidak ada dalam scope sekarang)
  ────────────────────────────────────────────────────────────────

  [OPSIONAL] Upgrade ke own-key:
  Superadmin Backyard input:
    • Xendit Secret Key tenant (encrypted)
    • Xendit Callback Token tenant (encrypted)
  Tenant set di Xendit dashboard:
    webhook URL → clicker.id/api/webhook/xendit

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  LAYER 2A — POS (anonymous customer)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Customer (walk-in, anonymous)
    │  1. Scan QR / buka self-order page tenant
    ▼
  Menu page (public, no login required)
    │  2. Pilih item → checkout → orderId dibuat
    ▼
  createInvoice({
    siteId, module: 'pos',
    referenceId: orderId,
    amount,
    customerUid: null,      ← anonymous
    customerMeta: null      ← tidak ada
  })
    │
    ▼
  Redirect → Xendit Hosted Page
    │  bayar ✓
    ▼
  Webhook → markOrderPaid(siteId, orderId)
  (tidak ada customer snapshot)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  LAYER 2B — MEMBERSHIP / LMS (identified customer)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Customer
    │  1. Kunjungi tenant page (kopi.clicker.id/member)
    ▼
  Login form Membership (built-in di modul)
    │  Email + password / Google → Firebase Auth
    │  memberUid terbentuk
    ▼
  Lihat plan / konten LMS
    │  2. Pilih plan → klik "Berlangganan"
    ▼
  createInvoice({
    siteId, module: 'membership',
    referenceId: planId,
    amount,
    customerUid: memberUid,  ← identified
    customerMeta: null
  })
    │
    ▼
  Redirect → Xendit Hosted Page
    │  bayar ✓
    ▼
  Webhook → activatePlan(siteId, planId, memberUid)
           → snapshot customer:
             sites/{siteId}/customers/{memberUid}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  LAYER 2C — RESERVATION (form-based customer)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Customer
    │  1. Buka booking page tenant
    ▼
  Isi form booking (nama, email, HP, tanggal)
    │  bookingId dibuat
    ▼
  createInvoice({
    siteId, module: 'reservation',
    referenceId: bookingId,
    amount,
    customerUid: null,
    customerMeta: { name, email, phone }  ← dari form
  })
    │
    ▼
  Redirect → Xendit Hosted Page
    │  bayar ✓
    ▼
  Webhook → confirmBooking(siteId, bookingId)
           → snapshot customer dari customerMeta
             sites/{siteId}/customers/{email}
             (keyed by email, bukan UID)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  DATA OWNERSHIP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  ┌─────────────────────────────────────────────────┐
  │  TENANT lihat:                                  │
  │  → Semua transaksi di tenant mereka             │
  │  → Customer: nama, email, HP, history di tenant │
  ├─────────────────────────────────────────────────┤
  │  CLICKER lihat:                                 │
  │  → Semua transaksi cross-tenant (layer 1 & 2)   │
  │  → Volume, platform fee, tenant activity        │
  │  → Customer yang beli di multiple tenant        │
  └─────────────────────────────────────────────────┘
```

---

## Payment Modes

| Mode | Deskripsi | Xendit Key | Platform Fee |
|------|-----------|------------|--------------|
| `clicker` | Default. Clicker collect, tenant dapat notifikasi | Clicker key | Ada (configurable) |
| `own` | Tenant setup Xendit sendiri. Uang langsung ke tenant | Tenant key (encrypted) | 0% (atau configurable) |

`paymentConfig` otomatis dibuat saat superadmin aktivasi tenant — default `mode: clicker`.

---

## Architecture

```
lib/payment/
├── index.ts           ← public API (createInvoice)
├── xendit.ts          ← mode-aware Xendit client
├── registry.ts        ← module handler registry
├── config.ts          ← getPaymentConfig / setPaymentConfig per tenant
├── crypto.ts          ← AES-256-GCM encrypt/decrypt tenant keys
└── types.ts           ← shared types

app/api/webhook/xendit/route.ts  ← single endpoint, semua tenant & layer
```

### Flow: Create Invoice

```
createInvoice({ siteId, module, referenceId, amount, customerUid?, customerMeta? })
  → getPaymentConfig(siteId)
  → mode 'clicker' → XENDIT_SECRET_KEY Clicker
  → mode 'own'     → decrypt tenant xenditSecretKey
  → buat Xendit Invoice
  → simpan → platform/payments/invoices/{invoiceId} (status: pending)
  → return { invoiceId, invoiceUrl }
  → redirect customer ke invoiceUrl
```

### Flow: Webhook

```
Xendit POST /api/webhook/xendit
  → extract siteId dari metadata payload
  → getPaymentConfig(siteId)
  → mode 'clicker' → verify XENDIT_WEBHOOK_TOKEN Clicker
  → mode 'own'     → decrypt tenant xenditCallbackToken → verify
  → idempotency check: status sudah 'paid'? skip
  → update invoice → 'paid', paidAt
  → customer snapshot (jika customerUid atau customerMeta ada)
  → source 'ai_topup'? → existing AI topup logic
  → else → getHandler(module) → dispatch PaymentContext
  → return 200 (selalu setelah verify)
```

---

## Module Registry

```ts
// lib/payment/registry.ts
type PaymentHandler = (context: PaymentContext) => Promise<void>

const registry = new Map<string, PaymentHandler>()

export function registerPaymentHandler(module: string, handler: PaymentHandler) {
  registry.set(module, handler)
}

export function getHandler(module: string) {
  return registry.get(module)
}
```

**Registered handlers:**

| Module key | Handler | Aksi |
|------------|---------|------|
| `pos` | `byod-pos/payment-handler.ts` | `markOrderPaid()` |
| `membership` | `membership/payment-handler.ts` | `activatePlan()` |
| `reservation` | `reservation/payment-handler.ts` | `confirmBooking()` |
| `module_purchase` | `lib/payment/module-purchase-handler.ts` | notif Backyard (Fase 1) / `enableModule()` (Fase 2) |

---

## Customer Snapshot Logic

Dipicu di webhook setelah invoice `paid`, sebelum dispatch ke module handler.

```
customerUid ada?
  ├── YES → upsert sites/{siteId}/customers/{uid}
  │         data dari Firebase Auth Admin SDK
  └── NO  → customerMeta ada?
              ├── YES → upsert sites/{siteId}/customers/{email}
              │         data dari customerMeta (form input)
              └── NO  → skip (POS anonymous)
```

**Firestore: `sites/{siteId}/customers/{uid|email}`**
```ts
{
  uid: string | null,
  email: string,
  displayName: string | null,
  phone: string | null,
  firstPurchaseAt: Timestamp,   // set hanya jika doc belum ada
  lastPurchaseAt: Timestamp,    // update tiap transaksi
  totalTransactions: number,    // increment tiap transaksi
}
```

---

## Payment Config

**Firestore: `sites/{siteId}/platform/paymentConfig`**
```ts
{
  mode: 'clicker' | 'own',
  xenditSecretKey?: string,       // AES-256-GCM encrypted, hanya mode 'own'
  xenditCallbackToken?: string,   // AES-256-GCM encrypted, hanya mode 'own'
  platformFeePercent: number,     // default: configurable, 0 jika own
  updatedAt: Timestamp,
  updatedBy: string,              // uid superadmin
}
```

Auto-created saat superadmin aktivasi tenant:
```ts
{ mode: 'clicker', platformFeePercent: DEFAULT_FEE, updatedAt, updatedBy }
```

---

## Encryption

**Algorithm:** AES-256-GCM — authenticated encryption, industry standard untuk API keys.

**Key:** `PAYMENT_ENCRYPTION_KEY` di Secret Manager (tidak pernah di code/Firestore).

**Format:** `iv:authTag:ciphertext` (base64).

**Rules:**
- Tenant key tidak pernah keluar dari server
- Backyard lihat `mode` + `updatedAt`, tidak bisa lihat raw key
- Decryption error = hard fail, tidak fallback diam-diam

---

## Data Model

**Firestore: `platform/payments/invoices/{invoiceId}`**
```ts
{
  invoiceId: string,
  xenditInvoiceUrl: string,
  siteId: string,
  mode: 'clicker' | 'own',
  module: string,               // 'pos' | 'membership' | 'module_purchase' | ...
  referenceId: string,          // orderId / planId / bookingId / moduleId
  amount: number,               // IDR
  platformFeePercent: number,   // snapshot saat invoice dibuat
  platformFeeAmount: number,    // amount × platformFeePercent
  customerUid: string | null,
  customerMeta: { name?, email?, phone? } | null,
  status: 'pending' | 'paid' | 'expired' | 'failed',
  createdAt: Timestamp,
  paidAt: Timestamp | null,
}
```

---

## Types

```ts
// lib/payment/types.ts

interface PaymentContext {
  invoiceId: string
  siteId: string
  module: string
  referenceId: string
  amount: number
  platformFeeAmount: number
  paidAt: Date
  customerUid: string | null
  customerMeta: { name?: string; email?: string; phone?: string } | null
}

interface CreateInvoiceParams {
  siteId: string
  module: string
  referenceId: string
  amount: number               // IDR
  description: string
  customerUid?: string
  customerMeta?: { name?: string; email?: string; phone?: string }
  successRedirectUrl?: string
  failureRedirectUrl?: string
}

interface PaymentConfig {
  mode: 'clicker' | 'own'
  xenditSecretKey?: string     // encrypted
  xenditCallbackToken?: string // encrypted
  platformFeePercent: number
  updatedAt: Timestamp
  updatedBy: string
}
```

---

## Files

### Shared Payment Layer

| File | Action | Keterangan |
|------|--------|------------|
| `lib/payment/types.ts` | Create | Semua shared types |
| `lib/payment/crypto.ts` | Create | AES-256-GCM encrypt/decrypt |
| `lib/payment/config.ts` | Create | `getPaymentConfig`, `setPaymentConfig` |
| `lib/payment/xendit.ts` | Create | Mode-aware Xendit client, `createInvoice`, `getXenditClient` |
| `lib/payment/registry.ts` | Create | `registerPaymentHandler`, `getHandler` |
| `lib/payment/module-purchase-handler.ts` | Create | Handler `module_purchase` — notif Backyard |
| `lib/payment/index.ts` | Create | Public API facade |
| `app/api/webhook/xendit/route.ts` | Extend | Mode-aware verify + customer snapshot + registry dispatch |

### Backyard

| File | Action | Keterangan |
|------|--------|------------|
| `backyard/app/tenants/[siteId]/payment/page.tsx` | Create | Setup own-key UI |
| `backyard/app/api/tenants/[siteId]/payment-config/route.ts` | Create | GET/POST paymentConfig |
| `backyard/app/registrations/[id]/activate.ts` | Modify | Auto-create paymentConfig saat aktivasi tenant |

### Module Handlers (per-modul)

| File | Action | Keterangan |
|------|--------|------------|
| `lib/modules/byod-pos/payment-handler.ts` | Create | `registerPaymentHandler('pos', ...)` |
| `lib/modules/byod-pos/components/PayButton.tsx` | Create/Modify | `createInvoice`, redirect |
| `lib/modules/membership/payment-handler.ts` | Create | `registerPaymentHandler('membership', ...)` |
| `lib/modules/reservation/payment-handler.ts` | Create | `registerPaymentHandler('reservation', ...)` |

---

## Error Handling

| Skenario | Handling |
|----------|----------|
| Webhook duplikat | Cek `status == 'paid'`, skip |
| No handler registered | Log warning, catat di invoice, jangan crash |
| Handler throw error | Catch, log, return 200 (hindari retry storm) |
| Invoice expired | Update status `expired`, tidak ada aksi |
| Webhook token invalid | Return 400, log — tidak reveal alasan |
| Tenant key decrypt gagal | Return 500, alert Clicker ops, hard fail |
| Tenant mode `own` tapi key belum diset | Fallback ke Clicker key, log warning |
| Xendit down saat create | Bubble error ke UI, user retry |
| `siteId` tidak ada di payload | Return 400, log |
| Customer snapshot gagal | Log warning, jangan block dispatch ke handler |

**Security:**
- Webhook tidak log raw payload (ada PII)
- Rate limit webhook: max 100 req/min
- Decryption error tidak fallback diam-diam

---

## Webhook Extension (AI Topup)

Existing `/api/webhook/xendit` sudah handle AI credit topup. Extend tanpa break:

```ts
if (payload.metadata?.source === 'ai_topup') {
  // existing logic, tidak diubah
} else {
  // mode-aware verify + customer snapshot + registry dispatch
}
```

---

## Environment Variables

```
XENDIT_SECRET_KEY=          # Clicker Xendit account
XENDIT_WEBHOOK_TOKEN=       # Clicker Xendit callback token
PAYMENT_ENCRYPTION_KEY=     # AES-256 key untuk encrypt tenant keys
```

---

## Fase Berikutnya (Out of Scope)

- **Layer 1 self-service** — tenant aktivasi modul otomatis setelah bayar (tanpa superadmin)
- **Buyer Library** — customer lihat semua yang pernah dibeli cross-tenant
- **Platform Fee Settlement** — mekanisme transfer sisa ke tenant, settlement report
- Notifikasi ke tenant setelah customer bayar (email + feed)
- Backyard payment dashboard (audit semua transaksi cross-tenant)
- Refund flow
- Per-tenant webhook URL (advanced isolation)
