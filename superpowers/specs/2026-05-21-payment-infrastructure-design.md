# Payment Infrastructure — Design Spec

**Date:** 2026-05-21
**Status:** Approved

## Goal

Bangun shared payment infrastructure di Clicker Platform menggunakan Xendit sebagai payment gateway. Satu sistem yang bisa dipakai semua modul (POS, Membership, Reservation, dll). MVP: integrasi dengan modul POS (BYOD) sebagai modul pertama.

## Scope

- Clicker punya 1 Xendit account (bukan per-tenant)
- Payment method: Xendit hosted page (redirect)
- Post-payment: trigger aksi di modul via registry pattern
- MVP modul: POS (BYOD)
- Expand ke per-tenant Xendit account di fase berikutnya

## Architecture

```
lib/payment/
├── index.ts          ← public API (createInvoice, getInvoice)
├── xendit.ts         ← Xendit client wrapper
├── registry.ts       ← module handler registry
└── types.ts          ← shared types

app/api/webhook/xendit/route.ts  ← single webhook endpoint (extend dari existing)
```

### Flow

```
1. Modul panggil createInvoice({ amount, siteId, module, referenceId })
2. lib/payment buat Xendit Invoice → dapat invoice_url
3. User redirect ke Xendit hosted page
4. User bayar (QRIS / VA / e-wallet / kartu)
5. Xendit POST /api/webhook/xendit (invoice.paid)
6. Webhook verify token → lookup invoice metadata
7. Dispatch ke registered handler berdasarkan module field
8. Handler update state modul (mark order paid, activate plan, dll)
```

## Payment Registry

Tiap modul register handler-nya sendiri. Webhook dispatch berdasarkan `module` field di invoice metadata.

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

### Firestore: `platform/payments/invoices/{invoiceId}`

```ts
{
  invoiceId: string,          // Xendit invoice ID
  xenditInvoiceUrl: string,
  siteId: string,
  module: string,             // 'pos' | 'membership' | 'reservation' | ...
  referenceId: string,        // orderId / bookingId / planId
  amount: number,             // IDR
  status: 'pending' | 'paid' | 'expired' | 'failed',
  createdAt: Timestamp,
  paidAt: Timestamp | null,
}
```

Satu collection untuk semua transaksi cross-modul. Backyard bisa audit semua payment dari satu tempat. Modul tetap punya state sendiri (contoh: POS order punya `paymentStatus: 'paid'`).

### Types

```ts
// lib/payment/types.ts
interface PaymentContext {
  invoiceId: string,
  siteId: string,
  module: string,
  referenceId: string,
  amount: number,
  paidAt: Date,
}

interface CreateInvoiceParams {
  siteId: string,
  module: string,
  referenceId: string,
  amount: number,             // IDR
  description: string,
  successRedirectUrl?: string,
  failureRedirectUrl?: string,
}
```

## Files

### Shared Payment Layer (baru)

| File | Action | Keterangan |
|------|--------|------------|
| `lib/payment/types.ts` | Create | `PaymentContext`, `InvoiceRecord`, `CreateInvoiceParams` |
| `lib/payment/xendit.ts` | Create | Xendit client: `createInvoice`, verify webhook token |
| `lib/payment/registry.ts` | Create | `registerPaymentHandler`, `getHandler` |
| `lib/payment/index.ts` | Create | Public API facade |
| `app/api/webhook/xendit/route.ts` | Extend | Sudah ada (AI topup) — tambah dispatch ke registry, jangan replace |

### POS Integration (modul pertama)

| File | Action | Keterangan |
|------|--------|------------|
| `lib/modules/byod-pos/payment-handler.ts` | Create | Register handler, panggil `markOrderPaid` |
| `lib/modules/byod-pos/components/PayButton.tsx` | Create/Modify | Trigger `createInvoice`, redirect ke Xendit |

## Webhook Extension

Existing webhook (`/api/webhook/xendit`) sudah handle AI topup. Perlu extend tanpa break existing:

```ts
// Dispatch logic di webhook route
if (invoice.metadata.source === 'ai_topup') {
  // existing AI topup logic
} else {
  // new: dispatch ke module registry
  const handler = getHandler(invoice.metadata.module)
  if (handler) await handler(context)
  else log.warn('No handler for module:', invoice.metadata.module)
}
```

## Error Handling

| Skenario | Handling |
|----------|----------|
| Webhook duplikat | Cek `status == 'paid'` di Firestore dulu, skip jika sudah |
| No handler registered | Log warning, catat di invoice record, jangan crash |
| Handler throw error | Catch, log error, return 200 ke Xendit (hindari retry storm) |
| Invoice expired | Update status `expired`, tidak ada aksi |
| Webhook token invalid | Return 400, log |
| Xendit down saat create | Bubble error ke UI, user bisa retry |

**Idempotency:** `invoiceId` dari Xendit adalah unique — pakai sebagai guard duplikat.

**Webhook selalu return 200** setelah verify token, bahkan jika handler gagal — cegah Xendit retry storm. Error di-handle internal.

## Environment Variables

```
XENDIT_SECRET_KEY=
XENDIT_WEBHOOK_TOKEN=
```

(Shared dengan AI topup — sudah ada di Secret Manager)

## Fase Berikutnya (Out of Scope MVP)

- Per-tenant Xendit account (split payment / marketplace)
- Notifikasi ke tenant setelah payment sukses (email + feed)
- Backyard payment dashboard (audit semua transaksi)
- Refund flow
