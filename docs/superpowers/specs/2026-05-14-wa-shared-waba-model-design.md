# WA Shared WABA Model — Design Spec

**Date:** 2026-05-14
**Status:** Draft
**Scope:** Refactor WA integration dari per-tenant WABA menjadi Shared WABA milik Clicker

---

## 1. Problem

Setup Meta WABA per-tenant terlalu tinggi barrier-nya untuk UMKM:
- Butuh Meta Business Manager verification (bisa ditolak, lama)
- Butuh nomor HP dedicated yang belum terdaftar WA
- Konfigurasi teknis (phoneNumberId, System User token, webhook) di luar kemampuan rata-rata UMKM

---

## 2. Solution: Shared WABA Model

Clicker memiliki 1 WABA (WhatsApp Business Account) yang sudah verified. Tiap tenant mendapat **nomor WA sendiri** yang di-provision oleh Clicker admin via Backyard — tenant tidak perlu sentuh Meta sama sekali.

```
Meta WABA (milik Clicker)
├── phoneNumberId: AAA  →  sites/tenantA/wa/config
├── phoneNumberId: BBB  →  sites/tenantB/wa/config
└── phoneNumberId: CCC  →  sites/tenantC/wa/config

accessToken = 1 System User token milik Clicker (ENV only, tidak di Firestore)
```

---

## 3. Arsitektur

### 3.1 Credentials Storage

**Sebelum (per-tenant):**
```
sites/{siteId}/wa/config:
  phoneNumberId, wabaId, accessToken (encrypted), webhookVerifyToken, status
```

**Sesudah (shared WABA):**
```
sites/{siteId}/wa/config:
  phoneNumberId: string       ← per tenant, berbeda tiap tenant
  displayPhone: string        ← nomor display e.g. "+6281234567890"
  webhookVerifyToken: string  ← per tenant
  status: "pending" | "connected" | "disconnected" | "error"
  provisionedAt: timestamp
  provisionedBy: string       ← Backyard admin userId

# DIHAPUS dari Firestore:
  accessToken  ← pindah ke ENV
  wabaId       ← pindah ke ENV
```

**ENV vars (server only):**
```
WA_CLICKER_ACCESS_TOKEN=...   ← System User token Meta milik Clicker
WA_CLICKER_WABA_ID=...        ← WABA ID milik Clicker
WA_WEBHOOK_SECRET=...         ← untuk verify X-Hub-Signature-256
WA_ENCRYPTION_KEY=...         ← tetap ada, untuk data sensitif lain
```

### 3.2 Firestore Index Baru

Untuk routing webhook incoming ke tenant yang tepat:

```
wa_phone_index/{phoneNumberId}:
  siteId: string
  displayPhone: string
  status: string
```

Index ini di-write saat Backyard admin provision nomor, di-delete saat tenant dinonaktifkan.

### 3.3 Webhook Routing

```
Meta → POST /api/webhooks/wa
     → verify X-Hub-Signature-256 (ENV: WA_WEBHOOK_SECRET)
     → extract phoneNumberId dari payload
     → lookup wa_phone_index/{phoneNumberId} → dapat siteId
     → processIncomingMessage(siteId, payload)
     → return 200 (selalu, bahkan kalau error)
```

### 3.4 Outbound Gateway

```typescript
// gateway.ts — perubahan minimal
async send(message: OutboundMessage): Promise<void> {
  // accessToken dari ENV, bukan dari Firestore
  const accessToken = process.env.WA_CLICKER_ACCESS_TOKEN;
  const phoneNumberId = this.config.phoneNumberId; // dari sites/{siteId}/wa/config

  // safeguard tetap sama
  if (message.to_type === 'customer' && !message.human_triggered) {
    throw new Error('Cannot send to customer without explicit human trigger');
  }

  await fetch(`${META_API_BASE}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(message),
  });
}
```

---

## 4. Backyard UI — WA Provisioning

Screen baru: **Backyard → Tenants → {tenant} → WhatsApp**

### Form Provisioning
- Input `phoneNumberId` (dari Meta Business Manager)
- Input `displayPhone` (nomor HP display, e.g. `+6281234567890`)
- Tombol **"Provision"** → write ke `sites/{siteId}/wa/config` + `wa_phone_index/{phoneNumberId}`
- Status badge: `pending` → `connected` → `disconnected`
- Tombol **"Test Connection"** → kirim pesan test ke nomor owner tenant
- Tombol **"Disconnect"** → set status `disconnected`, hapus dari `wa_phone_index`

### List View
Backyard → WhatsApp → semua tenant yang sudah/belum provision:
- Tabel: Tenant | Nomor | Status | Provisioned At
- Filter by status

---

## 5. Tenant Admin UI

`WASetupWizard.tsx` **dihapus** — tenant tidak input credentials.

Diganti `WAStatus.tsx` (read-only):
- Status koneksi (pending/connected/disconnected/error)
- Nomor WA display
- Usage stats (pesan masuk/keluar bulan ini)
- Pesan "Hubungi support untuk aktivasi WhatsApp"

---

## 6. Error Handling

| Skenario | Handling |
|---|---|
| `phoneNumberId` tidak ada di `wa_phone_index` | Log warning, return 200, skip processing |
| Tenant status `pending` | Pesan masuk disimpan, outbound diblock di gateway |
| `accessToken` invalid (Meta 401) | Update semua tenant status → `error`, alert Clicker admin |
| Tenant dinonaktifkan | Webhook masuk dibuang setelah lookup, outbound diblock |
| Meta non-200 response | Log error per-tenant, jangan retry otomatis, surface di Backyard |

**Critical:** `accessToken` milik Clicker — kalau expired/invalid, semua tenant WA mati. Mitigasi: gunakan System User token (tidak expire), monitor via Backyard alert.

---

## 7. File Changes

### Modified
| File | Perubahan |
|---|---|
| `lib/whatsapp/gateway.ts` | Baca `accessToken` dari ENV, bukan Firestore |
| `lib/whatsapp/constants.ts` | Tambah `WA_PHONE_INDEX = 'wa_phone_index'` |
| `lib/whatsapp/types.ts` | Update `WAConfig` — hapus `accessToken`, `wabaId`; tambah `displayPhone`, `provisionedAt`, `provisionedBy` |
| `lib/whatsapp/webhook-processor.ts` | Tambah `getSiteIdByPhoneNumberId()` lookup |
| `app/api/webhooks/wa/route.ts` | Routing via `wa_phone_index` |

### New
| File | Fungsi |
|---|---|
| `components/admin/wa/WAStatus.tsx` | Tenant read-only WA status view |
| `backyard/components/wa/WATenantProvisioning.tsx` | Form provision nomor per tenant |
| `backyard/components/wa/WAProvisioningList.tsx` | List semua tenant + WA status |

### Deleted
| File | Alasan |
|---|---|
| `components/admin/wa/WASetupWizard.tsx` | Tenant tidak lagi setup sendiri |

---

## 8. Security Rules

1. `accessToken` **tidak pernah** ada di Firestore — ENV only, server-side only
2. Tenant admin tidak bisa lihat/ubah credentials WA
3. Hanya Backyard admin yang bisa provision/disconnect nomor
4. `wa_phone_index` hanya bisa di-write via server action (bukan client SDK)
5. Webhook POST selalu return 200 ke Meta — error dihandle internal
6. HMAC SHA256 verification wajib sebelum payload diproses

---

## 9. Out of Scope

- Otomatisasi provisioning via Meta API (manual via Backyard — cukup untuk 10-50 tenant/bulan)
- BSP registration (future, kalau Clicker scale)
- Billing/usage tracking per tenant (future)
- Multi-WABA support (future)