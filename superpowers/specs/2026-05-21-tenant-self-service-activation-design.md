# Tenant Self-Service Module Activation — Design Spec

**Date:** 2026-05-21
**Status:** Future Phase (setelah payment gateway infra selesai)
**Depends on:** `2026-05-21-payment-gateway-infrastructure-design.md`

---

## Goal

Tenant bisa beli dan aktifkan modul sendiri tanpa superadmin — pilih modul, bayar via Xendit, modul langsung aktif. Ini Fase 2 dari Layer 1 payment.

---

## Context

**Fase 1 (sekarang):** Owner register → pilih modul → invoice otomatis → bayar → superadmin aktifkan manual.

**Fase 2 (ini):** Sama, tapi setelah bayar → modul otomatis aktif, tidak perlu superadmin.

Bedanya hanya di webhook handler `module_purchase`:
- Fase 1: handler kirim notif ke Backyard saja
- Fase 2: handler langsung `enableModule(siteId, moduleId)`

---

## Flow

```
Owner login ke dashboard Clicker
  │  1. Buka halaman "Modul & Paket"
  ▼
Lihat katalog modul + harga lifetime per modul
  │  2. Pilih modul → klik "Beli"
  ▼
createInvoice({
  siteId,
  module: 'module_purchase',
  referenceId: moduleId,
  amount: MODULE_PRICE[moduleId],
  customerUid: ownerUid,
})
  │
  ▼
Redirect → Xendit Hosted Page
  │  bayar ✓
  ▼
Webhook → module_purchase handler
  → enableModule(siteId, moduleId)
  → notif Backyard: "Tenant X aktifkan modul Y (self-service)"
  → email konfirmasi ke Owner via Resend
  │
  ▼
Modul langsung aktif di dashboard Owner ✓
```

---

## Katalog Modul

Harga lifetime per modul — hardcoded di `lib/payment/module-catalog.ts`:

```ts
export const MODULE_CATALOG: Record<string, { displayName: string; price: number }> = {
  byod_pos:     { displayName: 'POS Self Order', price: 999000 },
  membership:   { displayName: 'Membership & LMS', price: 799000 },
  reservation:  { displayName: 'Reservasi', price: 599000 },
  // ... tambah modul baru di sini
}
```

Harga dalam IDR. Superadmin bisa override harga per tenant via Backyard (diskon/promo).

---

## Handler Update

```ts
// lib/payment/module-purchase-handler.ts
registerPaymentHandler('module_purchase', async (ctx) => {
  const moduleId = ctx.referenceId

  // Fase 1: hanya notif
  // await notifyBackyard(ctx.siteId, moduleId)

  // Fase 2: aktifkan langsung
  await enableModule(ctx.siteId, moduleId)
  await notifyBackyard(ctx.siteId, moduleId, 'self-service')
  await sendModuleActivationEmail(ctx.siteId, moduleId)
})
```

---

## Files

| File | Action | Keterangan |
|------|--------|------------|
| `lib/payment/module-catalog.ts` | Create | Daftar modul + harga lifetime |
| `lib/payment/module-purchase-handler.ts` | Modify | Tambah `enableModule()` + email konfirmasi |
| `app/admin/modules/page.tsx` | Create | Halaman katalog modul di dashboard Owner |
| `app/api/admin/modules/purchase/route.ts` | Create | `createInvoice` untuk module_purchase |

---

## Guard: Cegah Beli Modul yang Sudah Aktif

Sebelum buat invoice, cek `sites/{siteId}.modules.{moduleId}` — jika sudah `true`, tolak dengan pesan "Modul sudah aktif".

---

## Fase Berikutnya (Out of Scope)

- Upgrade/downgrade plan (jika nanti ada subscription model)
- Bundle discount (beli 3 modul sekaligus dapat diskon)
- Trial period sebelum bayar
