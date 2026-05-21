# Customer Purchase Library — Design Spec

**Date:** 2026-05-21
**Status:** Future Phase (setelah payment gateway infra selesai)
**Depends on:** `2026-05-21-payment-gateway-infrastructure-design.md`

---

## Goal

Customer bisa lihat semua produk/layanan yang pernah dibeli dari semua tenant di satu tempat — "My Library" di Clicker account mereka.

---

## Context

Saat ini setelah customer bayar:
- Modul tenant update state (order paid, plan aktif, booking confirmed)
- Customer snapshot tersimpan di `sites/{siteId}/customers/{uid}`

Yang belum ada: **agregasi cross-tenant** — customer tidak bisa lihat semua pembelian mereka dari berbagai tenant dalam satu halaman.

---

## Scope

Hanya untuk customer yang **identified** (punya `customerUid`) — POS anonymous tidak masuk library.

---

## Flow

```
Customer login ke Clicker account
  │  buka "My Library" (clicker.id/library)
  ▼
Query: platform/payments/invoices
  WHERE customerUid == uid
  AND status == 'paid'
  ORDER BY paidAt DESC
  │
  ▼
Tampilkan list pembelian:
  ┌─────────────────────────────────────────────────┐
  │  🏪 Kopi Nusantara          Membership/LMS      │
  │  Plan: Kelas Barista Premium                    │
  │  Dibeli: 20 Mei 2026        Rp 299.000          │
  │  [Akses Konten →]                               │
  ├─────────────────────────────────────────────────┤
  │  💈 Barbershop Bro          Reservation         │
  │  Booking: Kamis 22 Mei 10:00                    │
  │  Dibeli: 19 Mei 2026        Rp 75.000           │
  │  [Lihat Detail →]                               │
  └─────────────────────────────────────────────────┘
```

---

## Data Model

Tidak perlu collection baru — query dari `platform/payments/invoices` yang sudah ada.

Tambah index Firestore:
```
collection: platform/payments/invoices
fields: customerUid ASC, status ASC, paidAt DESC
```

Untuk resolve nama tenant + nama produk/layanan, tiap invoice perlu tambah field:

```ts
// tambah ke InvoiceRecord di payment infra spec
{
  ...existing fields...
  tenantName: string,        // snapshot nama tenant saat invoice dibuat
  itemName: string,          // snapshot nama produk/plan/booking saat invoice dibuat
}
```

Snapshot saat `createInvoice` — tidak query realtime saat tampil library.

---

## Access Control

- Customer hanya bisa lihat invoices milik `customerUid` mereka sendiri
- Firestore rules: `request.auth.uid == resource.data.customerUid`

---

## CTA Per Modul

Tiap item di library punya CTA yang berbeda tergantung `module`:

| Module | CTA | Link |
|--------|-----|------|
| `membership` | "Akses Konten" | `/{tenantSlug}/member/content` |
| `reservation` | "Lihat Detail" | `/{tenantSlug}/booking/{referenceId}` |
| `pos` | — | tidak masuk library (anonymous) |

---

## Files

| File | Action | Keterangan |
|------|--------|------------|
| `app/(public)/library/page.tsx` | Create | Halaman My Library (requires Clicker login) |
| `app/api/customer/library/route.ts` | Create | GET invoices by customerUid |
| `lib/payment/xendit.ts` | Modify | Tambah `tenantName` + `itemName` ke `createInvoice` |
| `lib/payment/types.ts` | Modify | Tambah field ke `InvoiceRecord` + `CreateInvoiceParams` |

---

## Fase Berikutnya (Out of Scope)

- Filter by tenant atau modul
- Download invoice/receipt PDF
- Re-access konten langsung dari library
