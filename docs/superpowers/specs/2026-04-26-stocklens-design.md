# Stocklens — AI-Powered Inventory Scanner

**Date:** 2026-04-26
**Branch:** dev-logging
**Status:** Approved

---

## Overview

Stocklens adalah modul baru di Clicker Platform yang memungkinkan user menscan produk fisik menggunakan foto, lalu AI secara otomatis mengidentifikasi detail produk, generate SKU, dan menyimpannya ke dalam database inventory. Modul ini **terpisah** dari modul `inventory` yang sudah ada dan dapat di-toggle per tenant seperti modul lainnya.

**Target user:** Reseller barang umum / mixed category, bisnis skala kecil-menengah.

**AI Engine:** Gemini Vision (`gemini-2.0-flash`) + Google Search Grounding untuk product knowledge real-time.

---

## Module Registration

Modul `stocklens` didaftarkan ke 3-way parity (wajib per ARCHITECTURE.md):

1. `lib/modules/definitions.ts`
2. `backyard/lib/modules/definitions.ts`
3. `scripts/seed-modules.ts`

Module ID: `stocklens`

---

## Data Model

### Firestore Structure

```
sites/{siteId}/
  modules/stocklens/
    private/config              ← { apiKey: string }  (Gemini API key per tenant)
    skus/{skuId}                ← VaultSKU (dokumen induk per produk)
      units/{unitId}            ← VaultUnit (satu doc per unit fisik)
```

### VaultSKU

```ts
interface VaultSKU {
  id: string
  sku: string              // "TOY-HSB-BHEAD"
  name: string             // "Transformers Legacy Voyager Bulkhead"
  brand: string
  category: string         // "TOY" | "ELC" | "SHO" | "CLO" | "GAM" | "SPT" | "HOM" | "BOO" | "ACC" | "GEN"
  series?: string
  releasePrice: number     // harga rilis resmi, locked (tidak bisa diedit user)
  aiAnalysis: string       // deskripsi singkat dari AI (Bahasa Indonesia)
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

### VaultUnit

```ts
interface VaultUnit {
  id: string
  skuId: string
  condition: "BNIB" | "BNOB" | "SECOND" | "BROKEN"
  marketPrice: number      // editable per unit, default dari AI
  photoUrl: string         // Firebase Storage URL
  year?: string            // varian tahun opsional (e.g. "2023")
  notes?: string
  createdAt: Timestamp
}
```

### SKU Format

```
[KATEGORI]-[BRAND3]-[MODEL]

Contoh:
  TOY-HSB-BHEAD     → Transformers Bulkhead (Hasbro)
  ELC-APL-IP15P     → iPhone 15 Pro (Apple)
  SHO-NKE-AM270     → Nike Air Max 270
  GAM-SNY-DS5       → PS5 DualSense (Sony)
```

Jika SKU duplikat dengan beda tahun, suffix tahun ditambahkan: `TOY-HSB-BHEAD-2023`

### Kode Kategori

| Kode | Kategori |
|------|----------|
| ELC | Electronics |
| TOY | Toys / Collectible |
| SHO | Shoes |
| CLO | Clothing / Fashion |
| GAM | Gaming |
| SPT | Sports |
| HOM | Home / Living |
| BOO | Books |
| ACC | Accessories |
| GEN | General / Mixed |

### Status Kondisi

| Status | Kepanjangan | Warna |
|--------|-------------|-------|
| BNIB | Brand New In Box | Gold |
| BNOB | Brand New Open Box | Cyan |
| SECOND | Bekas Normal | Yellow |
| BROKEN | Rusak | Red |

### Firebase Storage Path

```
sites/{siteId}/stocklens/units/{unitId}/{filename}
```

Foto di-resize client-side sebelum upload (max 1200px via canvas API) untuk efisiensi storage.

---

## API Routes

### `POST /api/stocklens/scan`

Menerima `multipart/form-data`: foto produk + `siteId`.

**Flow:**
1. Ambil Gemini API key dari `sites/{siteId}/modules/stocklens/private/config`
2. Kirim gambar ke Gemini Vision dengan Google Search Grounding aktif
3. Return structured JSON hasil analisa

**Gemini config:**
```ts
const model = ai.getGenerativeModel({
  model: "gemini-2.0-flash",
  tools: [{ googleSearch: {} }],
})
// responseMimeType: "application/json"
```

**Prompt strategy:** Instruksikan Gemini return JSON terstruktur langsung dengan field: `name`, `brand`, `category`, `sku`, `series`, `releasePrice`, `marketPrice`, `suggestedCondition`, `aiAnalysis`. Gunakan `responseMimeType: "application/json"` agar selalu parseable.

**Response:**
```ts
interface ScanResult {
  name: string
  brand: string
  category: string
  sku: string
  series?: string
  releasePrice: number
  marketPrice: number
  suggestedCondition: "BNIB" | "BNOB" | "SECOND" | "BROKEN"
  aiAnalysis: string
}
```

### `POST /api/stocklens/check-sku`

Body: `{ siteId, sku }`

Cek apakah SKU sudah ada di Firestore. Return: `{ exists: boolean, skuId?: string, existingData?: VaultSKU }`.

### `GET|POST /api/stocklens/settings`

GET: Ambil config (tanpa expose key mentah — hanya return `{ hasKey: boolean }`).
POST: Simpan Gemini API key ke `sites/{siteId}/modules/stocklens/private/config`.

---

## User Flow

### Flow Utama: Scan Produk

```
Upload / ambil foto
  → preview tampil di ScanUploader
  → POST /api/stocklens/scan
  → loading "Menganalisa produk..."
  → ScanResult card tampil (nama, brand, SKU, harga rilis, harga pasar, saran kondisi)
  → POST /api/stocklens/check-sku
  → [jika duplikat] DuplicatePrompt: "Bedakan versi tahun? [YA] [SAMA AJA]"
       → YA: field year muncul, SKU baru dengan suffix tahun
       → SAMA AJA: unit ditambah ke SKU existing
  → user pilih kondisi final (BNIB/BNOB/SECOND/BROKEN)
  → user adjust marketPrice (opsional)
  → upload foto ke Storage (dengan resize client-side)
  → write VaultUnit (+ buat VaultSKU baru jika SKU belum ada)
  → toast sukses + opsi "Scan lagi" atau "Lihat di Vault"
```

---

## Admin UI Pages

### Scanner (`/admin/stocklens`)

Halaman utama. Berisi:
- Area upload foto (drag & drop atau kamera)
- Progress bar saat AI scan berjalan
- CODEX RESULT card dengan detail produk dari AI
- ConditionSelector (BNIB/BNOB/SECOND/BROKEN dengan badge warna)
- DuplicatePrompt dialog jika SKU sudah ada
- Field edit marketPrice
- Tombol "Save to Vault"

### Vault Inventory (`/admin/stocklens/vault`)

- Filter: kategori, kondisi, search nama/SKU
- Tiap VaultSKUCard expandable → tampil unit per kondisi dengan foto thumbnail, qty, harga pasar
- Badge kondisi menggunakan warna Clicker dark theme

### Detail SKU (`/admin/stocklens/vault/[skuId]`)

- Header: nama, SKU, brand, kategori
- Foto swiper per unit
- Tabel stock per kondisi: qty + marketPrice masing-masing
- releasePrice locked (read-only)
- Tombol: **Scan Add Unit** (scanner dengan SKU pre-filled), **Edit**, **Delete SKU**

### Settings (`/admin/stocklens/settings`)

- Input Gemini API Key (masked)
- Simpan ke `sites/{siteId}/modules/stocklens/private/config`
- Tombol "Test Connection" — validasi key dengan API call minimal

---

## File Structure

```
lib/modules/stocklens/
  constants.ts                    ← DB paths & storage paths
  types.ts                        ← VaultSKU, VaultUnit, ScanResult
  api.ts                          ← Firestore CRUD (client SDK)
  server/
    gemini-scanner.ts             ← Gemini Vision + Search Grounding
  admin/
    ScannerPage.tsx
    ScanUploader.tsx
    ScanResult.tsx
    ConditionSelector.tsx
    DuplicatePrompt.tsx
    VaultPage.tsx
    VaultSKUCard.tsx
    DetailPage.tsx
    SettingsPage.tsx

app/admin/stocklens/
  page.tsx                        ← render ScannerPage
  vault/
    page.tsx                      ← render VaultPage
    [skuId]/
      page.tsx                    ← render DetailPage
  settings/
    page.tsx                      ← render SettingsPage

app/api/stocklens/
  scan/route.ts
  check-sku/route.ts
  settings/route.ts
```

---

## Error Handling

| Kasus | Handling |
|-------|----------|
| Gemini API key tidak ada | Redirect ke settings dengan toast informatif |
| Foto tidak dikenali AI | Return partial result — field kosong bisa diisi manual |
| Gemini timeout / error | Toast error + retry button, tidak ada data yang tersimpan |
| JSON tidak parseable | Fallback ke form kosong, user isi manual |
| marketPrice = 0 saat simpan | Validasi client-side, user wajib isi sebelum save |
| Storage upload gagal | Unit tidak ditulis ke Firestore, user diminta retry |

---

## Architectural Notes

- **Core vs Module boundary:** `stocklens` tidak import dari modul lain. Jika di masa depan perlu cross dengan `inventory`, gunakan shared utility di `lib/core/` atau event-driven pattern.
- **API key security:** Gemini key disimpan di `private/config` sub-collection — tidak terbaca oleh client SDK tanpa Firebase Security Rules yang mengizinkan (server-only via `firebase-admin`).
- **Pola Gemini client:** Ikuti pattern `ai-sales-agent/server/gemini-client.ts` — fetch key per request untuk garantikan key terbaru dipakai.
- **Future bridge ke inventory:** Data model VaultSKU sudah cukup kompatibel untuk di-map ke `InventoryItem` di modul `inventory` jika integrasi diputuskan nanti.
