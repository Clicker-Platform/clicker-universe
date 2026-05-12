# AI Credit Topup via Xendit — Design Spec

## Goal

Tenant dapat topup AI Kredit secara mandiri via Xendit (QRIS/VA/e-wallet). Backyard tetap bisa topup manual dalam Kredit. Semua tampilan tenant dalam Kredit, Backyard tampil USD + Kredit.

## Currency System

| Layer | Unit | Keterangan |
|-------|------|------------|
| Firestore storage | USD (float) | Tidak berubah dari sistem existing |
| Tampilan tenant | Kredit | `Kredit = balanceUSD × liveRate / 100` |
| Tampilan Backyard | USD + Kredit | USD utama, Kredit di samping |
| Input topup Xendit | IDR | Min Rp 20.000 |
| Input topup manual Backyard | Kredit | Sistem konversi ke USD |

**1 Kredit ≈ Rp 100** (berfluktuasi mengikuti live rate harian, acceptable)

## Exchange Rate

- Source: **frankfurter.app** — free, no API key, rate dari ECB
- Endpoint: `https://api.frankfurter.app/latest?from=USD&to=IDR`
- Cache: **1x per hari**, reset tengah malam WIB
- Simpan di: memory cache server-side (key: `usd_idr_YYYY-MM-DD`)
- Fallback: kalau fetch gagal, pakai rate terakhir yang berhasil

## Margin Multiplier

- Diset superadmin di Backyard (default: `1.2`)
- Simpan di Firestore: `platform/config/aiSettings.marginMultiplier`
- Fungsi: proteksi fluktuasi rate + margin bisnis platform
- Dipakai **hanya saat topup** (bukan saat deduct)

**Formula topup Xendit:**
```
usdAdded = (idrPaid / liveRate) / marginMultiplier
```

**Formula topup manual Backyard:**
```
usdAdded = (kreditInput × 100) / liveRate / marginMultiplier
```

**Formula tampil Kredit:**
```
kredit = balanceUSD × liveRate / 100
```

**Formula deduct (tidak berubah):**
```
balanceUSD -= costUSD  // tidak ada perubahan dari sistem existing
```

## Xendit Payment Flow

```
1. Tenant klik "Topup Kredit" di AI Usage page
2. Input nominal IDR (min Rp 20.000, free input)
3. Platform POST /api/admin/ai-topup/create
   → fetch live rate
   → hitung usdAdded = (idrAmount / liveRate) / marginMultiplier
   → buat Xendit Invoice (IDR amount, external_id = siteId+timestamp)
   → return { invoice_url, kreditPreview }
4. Tenant redirect ke Xendit hosted page
5. Tenant bayar (QRIS / VA / GoPay / OVO / Dana / kartu)
6. Xendit kirim webhook POST /api/webhook/xendit
   → verify X-CALLBACK-TOKEN header
   → cek status == "PAID"
   → ambil external_id → extract siteId
   → hitung usdAdded dari amount + rate saat invoice dibuat (simpan di metadata)
   → addCredits(siteId, usdAdded, { performedBy: 'xendit', reason: 'Topup via Xendit' })
7. Tenant refresh → saldo Kredit bertambah
```

## Data Model

### Xendit Invoice Metadata
Simpan di Firestore `sites/{siteId}/platform/aiTopupPending/{invoiceId}`:
```
{
  invoiceId: string,
  idrAmount: number,
  usdAmount: number,       // pre-calculated saat create
  kreditPreview: number,   // untuk tampil di UI
  liveRate: number,        // rate saat invoice dibuat
  marginMultiplier: number,
  status: 'pending' | 'paid' | 'expired',
  createdAt: Timestamp,
}
```

Webhook gunakan data ini — tidak recalculate rate saat webhook tiba (rate sudah terkunci saat invoice dibuat).

### Platform Config
`platform/config/aiSettings`:
```
{
  marginMultiplier: 1.2,
}
```

## Files

### Platform (clicker-platform-v2)

| File | Action | Keterangan |
|------|--------|------------|
| `lib/ai/rate.ts` | Create | Fetch + cache rate frankfurter.app |
| `lib/ai/credits.ts` | Modify | `addCredits` terima param `kreditDisplay` opsional |
| `lib/xendit.ts` | Create | Xendit client wrapper (create invoice, verify webhook) |
| `app/api/admin/ai-topup/create/route.ts` | Create | Buat Xendit invoice |
| `app/api/webhook/xendit/route.ts` | Create | Handle `invoice.paid` |
| `lib/modules/ai-platform/admin/UsagePage.tsx` | Modify | Tampil Kredit + tombol Topup |
| `components/admin/AICreditTopupModal.tsx` | Create | Modal input IDR + preview Kredit |

### Backyard

| File | Action | Keterangan |
|------|--------|------------|
| `app/ai-settings/_components/CreditOverview.tsx` | Modify | Tampil kolom Kredit + input topup dalam Kredit |
| `app/ai-settings/_components/MarginPanel.tsx` | Create | Set marginMultiplier |
| `app/api/ai-settings/credits/route.ts` | Modify | POST topup terima `kreditAmount`, konversi ke USD |
| `app/api/ai-settings/margin/route.ts` | Create | GET/POST marginMultiplier |

## UI Tenant — AI Usage Page

```
┌─────────────────────────────────────────────┐
│ Saldo          Bulan Ini       Total         │
│ 🪙 1.234 Kredit  12 Kredit    45 Kredit      │
│                                              │
│              [+ Topup Kredit]                │
└─────────────────────────────────────────────┘
```

Modal Topup:
```
Topup AI Kredit
Nominal: [Rp ________] (min Rp 20.000)
Preview: ~200 Kredit
[Bayar via Xendit]
```

## UI Backyard — Credit Overview

```
Site      Total $    Used $    Available $  | Kredit    Topup
quattro   $5.00      $0.06     $4.94        | 81.5K     [+ Topup]
```

Topup modal Backyard: input Kredit (bukan USD).

## Error Handling

| Skenario | Handling |
|----------|----------|
| frankfurter.app down | Pakai rate terakhir dari cache, log warning |
| Xendit webhook duplikat | Cek `invoiceId` sudah `paid` di Firestore, skip |
| Invoice expired | Status update ke `expired`, tidak ada aksi kredit |
| Webhook signature invalid | Return 400, log error |

## Environment Variables (Platform)

```
XENDIT_SECRET_KEY=
XENDIT_WEBHOOK_TOKEN=
NEXT_PUBLIC_XENDIT_PUBLIC_KEY=
```

## Xendit Setup

- Buat akun Xendit, aktifkan Invoice API
- Set webhook URL: `https://stg-clicker-core.web.app/api/webhook/xendit`
- Copy Secret Key + Callback Token ke Secret Manager
