# Platform Fee Settlement — Design Spec

**Date:** 2026-05-21
**Status:** Future Phase (setelah payment gateway infra selesai)
**Depends on:** `2026-05-21-payment-gateway-infrastructure-design.md`

---

## Goal

Mekanisme Clicker menghitung, mencatat, dan mentransfer platform fee dari transaksi customer ke tenant. Clicker ambil cut, sisanya ke tenant.

---

## Context

Saat ini:
- Setiap invoice catat `platformFeePercent` + `platformFeeAmount` (snapshot)
- Mode `clicker`: uang masuk ke Xendit Clicker, fee sudah tercatat
- Mode `own`: uang masuk ke Xendit tenant, tidak ada fee (platformFeePercent = 0)

Yang belum ada: **mekanisme settlement** — kapan dan bagaimana Clicker transfer sisa ke tenant (mode `clicker`).

---

## Scope

Hanya untuk mode `clicker`. Mode `own` uang langsung ke tenant, tidak perlu settlement.

---

## Settlement Model

**Manual settlement via Backyard** (Fase 1):

```
Superadmin buka Settlement di Backyard
  │  pilih tenant + periode
  ▼
System hitung:
  totalRevenue    = SUM(amount) WHERE siteId + status='paid' + mode='clicker'
  totalFee        = SUM(platformFeeAmount)
  settlementAmount = totalRevenue - totalFee
  │
  ▼
Superadmin transfer manual ke rekening tenant
  → catat di Firestore: platform/settlements/{settlementId}
  → status: 'settled'
  │
  ▼
Tenant dapat notifikasi settlement via email
```

---

## Data Model

**Firestore: `platform/settlements/{settlementId}`**
```ts
{
  settlementId: string,
  siteId: string,
  periodStart: Timestamp,
  periodEnd: Timestamp,
  totalRevenue: number,         // IDR, sum semua transaksi periode ini
  totalFeeAmount: number,       // IDR, sum platform fee
  settlementAmount: number,     // IDR, yang ditransfer ke tenant
  invoiceIds: string[],         // invoice yang masuk settlement ini
  status: 'pending' | 'settled',
  settledAt: Timestamp | null,
  settledBy: string | null,     // uid superadmin
  note: string,                 // nomor rekening / bukti transfer
  createdAt: Timestamp,
}
```

**Tambah field ke invoice:**
```ts
settlementId: string | null   // null = belum di-settle
```

---

## Settlement Calculation

```
Periode: bulan kalender (1 - akhir bulan)

Query invoices:
  WHERE siteId == X
  AND mode == 'clicker'
  AND status == 'paid'
  AND settlementId == null
  AND paidAt >= periodStart
  AND paidAt <= periodEnd

totalRevenue     = SUM(amount)
totalFeeAmount   = SUM(platformFeeAmount)
settlementAmount = totalRevenue - totalFeeAmount
```

---

## Backyard UI

```
┌─────────────────────────────────────────────────────────────────┐
│ Settlement                                          [+ Buat]    │
├──────────┬──────────┬────────────┬────────────┬────────────────┤
│ Tenant   │ Periode  │ Revenue    │ Fee        │ Settlement     │
├──────────┼──────────┼────────────┼────────────┼────────────────┤
│ Kopi Nur │ Mei 2026 │ Rp 5.2jt  │ Rp 520rb   │ Rp 4.68jt     │
│          │          │            │            │ [Settle ✓]     │
├──────────┼──────────┼────────────┼────────────┼────────────────┤
│ Barbershop│ Mei 2026│ Rp 2.1jt  │ Rp 210rb   │ Rp 1.89jt     │
│          │          │            │            │ [Settle ✓]     │
└──────────┴──────────┴────────────┴────────────┴────────────────┘
```

---

## Files

| File | Action | Keterangan |
|------|--------|------------|
| `lib/payment/settlement.ts` | Create | `calculateSettlement`, `createSettlement`, `markSettled` |
| `backyard/app/settlement/page.tsx` | Create | List settlement per tenant |
| `backyard/app/settlement/[siteId]/page.tsx` | Create | Detail + aksi settle |
| `backyard/app/api/settlement/route.ts` | Create | GET/POST settlement |
| `lib/payment/types.ts` | Modify | Tambah `SettlementRecord` type + `settlementId` ke `InvoiceRecord` |

---

## Fase Berikutnya (Out of Scope)

- **Auto settlement** — sistem otomatis transfer via Xendit Disbursement API tiap akhir bulan
- **Tenant settlement dashboard** — tenant lihat pending + history settlement mereka
- **Settlement report PDF** — download laporan per periode
- **Multi-currency** — jika expand ke luar IDR
