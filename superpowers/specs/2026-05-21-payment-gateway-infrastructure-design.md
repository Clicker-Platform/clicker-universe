# Payment Gateway Infrastructure — Design Spec

**Date:** 2026-05-21
**Status:** Approved

## Goal

Bangun shared payment gateway infrastructure di Clicker Platform menggunakan Xendit. Mendukung dua mode: Clicker collect semua payment (default), atau tenant connect Xendit account sendiri (own-key). Satu webhook endpoint handle semua tenant. Module registry pattern — modul baru tinggal register handler tanpa touch core.

## Context

Clicker adalah SaaS platform. Ada dua layer payment:
1. **Tenant bayar ke Clicker** — beli/subscribe modul (existing, out of scope)
2. **Buyer bayar ke Tenant** — beli produk/service milik tenant via Clicker infra (this spec)

Spec ini cover layer 2.

## Payment Modes

| Mode | Deskripsi | Xendit Key | Platform Fee |
|------|-----------|------------|--------------|
| `clicker` | Default. Clicker collect, tenant dapat notifikasi | Clicker key | Ada (configurable) |
| `own` | Tenant setup Xendit sendiri. Uang langsung ke tenant | Tenant key (encrypted) | 0% (atau configurable) |

Tenant mulai dengan mode `clicker`. Upgrade ke `own` via Backyard (superadmin input key tenant).

## Architecture

```
lib/payment/
├── index.ts           ← public API
├── xendit.ts          ← mode-aware Xendit client
├── registry.ts        ← module handler registry
├── config.ts          ← getPaymentConfig / setPaymentConfig per tenant
├── crypto.ts          ← AES-256-GCM encrypt/decrypt tenant keys
└── types.ts           ← shared types

app/api/webhook/xendit/route.ts  ← single endpoint, handle semua tenant
```

### Flow: Create Invoice

```
Module panggil createInvoice({ siteId, module, referenceId, amount, ... })
  → getPaymentConfig(siteId)
  → mode 'clicker' → pakai XENDIT_SECRET_KEY Clicker
  → mode 'own'     → decrypt tenant xenditSecretKey → pakai key tenant
  → buat Xendit Invoice
  → simpan invoice record ke platform/payments/invoices/{invoiceId}
  → return { invoiceId, invoiceUrl }
Module redirect buyer ke invoiceUrl
```

### Flow: Webhook

```
Xendit POST /api/webhook/xendit
  → extract siteId dari metadata payload
  → getPaymentConfig(siteId)
  → mode 'clicker' → verify pakai XENDIT_WEBHOOK_TOKEN Clicker
  → mode 'own'     → decrypt tenant xenditCallbackToken → verify
  → cek idempotency: invoice status sudah 'paid'? skip
  → update invoice status → 'paid', paidAt
  → getHandler(module) → dispatch PaymentContext
  → handler update state modul (mark order paid, activate plan, dll)
  → return 200 (selalu, setelah verify)
```

**Tenant own-key wajib set webhook URL di Xendit dashboard mereka:**
```
https://clicker.id/api/webhook/xendit
```

## Payment Config

**Firestore: `sites/{siteId}/platform/paymentConfig`**
```ts
{
  mode: 'clicker' | 'own',
  xenditSecretKey?: string,       // AES-256-GCM encrypted, hanya jika mode 'own'
  xenditCallbackToken?: string,   // AES-256-GCM encrypted, hanya jika mode 'own'
  platformFeePercent: number,     // default: configurable per tenant, 0 jika own
  updatedAt: Timestamp,
  updatedBy: string,              // uid superadmin yang setup
}
```

## Encryption

**Algorithm:** AES-256-GCM — authenticated encryption, industry standard untuk simpan API keys.

**Key:** `PAYMENT_ENCRYPTION_KEY` di Secret Manager (tidak pernah di code/Firestore).

**Format simpan:** `iv:authTag:ciphertext` (base64 encoded).

```ts
// lib/payment/crypto.ts
export function encrypt(plaintext: string): string
export function decrypt(ciphertext: string): string
```

**Rules:**
- Tenant key tidak pernah keluar dari server — hanya decrypt saat create invoice / verify webhook
- Backyard bisa lihat `mode` dan `updatedAt`, tidak bisa lihat raw key
- Decryption error = hard fail, tidak fallback diam-diam

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

Modul register di file sendiri:
```ts
// lib/modules/byod-pos/payment-handler.ts
registerPaymentHandler('pos', async (ctx) => {
  await markOrderPaid(ctx.siteId, ctx.referenceId)
})
```

Modul baru tinggal tambah 1 file — tidak touch webhook route.

## Data Model

**Firestore: `platform/payments/invoices/{invoiceId}`**
```ts
{
  invoiceId: string,            // Xendit invoice ID
  xenditInvoiceUrl: string,
  siteId: string,
  mode: 'clicker' | 'own',     // snapshot mode saat invoice dibuat
  module: string,               // 'pos' | 'membership' | 'reservation' | ...
  referenceId: string,          // orderId / bookingId / planId
  amount: number,               // IDR
  platformFeePercent: number,   // snapshot saat invoice dibuat
  platformFeeAmount: number,    // amount × platformFeePercent
  status: 'pending' | 'paid' | 'expired' | 'failed',
  createdAt: Timestamp,
  paidAt: Timestamp | null,
}
```

`platformFeePercent` di-snapshot per invoice — perubahan fee tidak affect invoice yang sudah dibuat.

Collection ini queryable cross-tenant — Clicker analytics tanpa masuk data tenant.

### Types

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
}

interface CreateInvoiceParams {
  siteId: string
  module: string
  referenceId: string
  amount: number               // IDR
  description: string
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

## Files

### Shared Payment Layer (baru)

| File | Action | Keterangan |
|------|--------|------------|
| `lib/payment/types.ts` | Create | Semua shared types |
| `lib/payment/crypto.ts` | Create | AES-256-GCM encrypt/decrypt |
| `lib/payment/config.ts` | Create | `getPaymentConfig`, `setPaymentConfig` |
| `lib/payment/xendit.ts` | Create | Mode-aware Xendit client, `createInvoice`, `getXenditClient` |
| `lib/payment/registry.ts` | Create | `registerPaymentHandler`, `getHandler` |
| `lib/payment/index.ts` | Create | Public API facade |
| `app/api/webhook/xendit/route.ts` | Extend | Mode-aware verify + registry dispatch (extend existing AI topup handler) |

### Backyard — Tenant Payment Config UI

| File | Action | Keterangan |
|------|--------|------------|
| `backyard/app/tenants/[siteId]/payment/page.tsx` | Create | Setup own-key: input + encrypt secret key & callback token |
| `backyard/app/api/tenants/[siteId]/payment-config/route.ts` | Create | GET/POST paymentConfig |

### POS Integration (modul pertama)

| File | Action | Keterangan |
|------|--------|------------|
| `lib/modules/byod-pos/payment-handler.ts` | Create | Register handler, `markOrderPaid` |
| `lib/modules/byod-pos/components/PayButton.tsx` | Create/Modify | `createInvoice`, redirect ke Xendit |

## Error Handling

| Skenario | Handling |
|----------|----------|
| Webhook duplikat | Cek `status == 'paid'` di Firestore, skip |
| No handler registered | Log warning, catat di invoice, jangan crash |
| Handler throw error | Catch, log, return 200 ke Xendit (hindari retry storm) |
| Invoice expired | Update status `expired`, tidak ada aksi |
| Webhook token invalid | Return 400, log — tidak reveal alasan gagal |
| Tenant key decrypt gagal | Return 500, alert Clicker ops, hard fail |
| Tenant mode `own` tapi key belum diset | Log warning, fallback ke Clicker key |
| Xendit down saat create | Bubble error ke UI, user retry |
| `siteId` tidak ada di webhook payload | Return 400, log |

**Security:**
- Webhook tidak log raw payload (ada PII)
- Rate limit webhook: max 100 req/min
- Decryption error tidak fallback diam-diam

## Environment Variables

```
XENDIT_SECRET_KEY=          # Clicker Xendit account
XENDIT_WEBHOOK_TOKEN=       # Clicker Xendit callback token
PAYMENT_ENCRYPTION_KEY=     # AES-256 key untuk encrypt tenant keys
```

## Webhook Extension (existing AI topup)

Existing `/api/webhook/xendit` sudah handle AI credit topup. Extend tanpa break:

```ts
if (payload.metadata?.source === 'ai_topup') {
  // existing AI topup logic (tidak diubah)
} else {
  // new: mode-aware verify + module registry dispatch
}
```

## Fase Berikutnya (Out of Scope)

- Notifikasi ke tenant setelah payment sukses (email + feed)
- Backyard payment dashboard (audit semua transaksi cross-tenant)
- Refund flow
- Platform fee auto-transfer / settlement report
- Per-tenant webhook URL (advanced isolation)
