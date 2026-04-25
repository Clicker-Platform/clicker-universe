# Backyard Sidebar Expansion — Design Spec

**Date:** 2026-04-25
**Branch:** `dev-logging` (akan dibuat worktree baru `dev-backyard` saat implementasi)
**Scope:** Tambah 7 halaman baru + 1 halaman di-promote ke sidebar Backyard superadmin

---

## Goal

Backyard saat ini hanya punya 5 menu (Overview, Tenants, Users, Monitoring, Settings). Banyak Cloud Functions dan capabilities yang sudah ada tapi tidak punya UI. Tujuan spec ini: expose semua capabilities yang sudah ada ke sidebar Backyard tanpa mengubah theme/design system yang sudah ada.

---

## Design Constraints

- **Theme tidak berubah** — brand-dark `#0E3B2E`, brand-green `#B6FF2E`, border `2px solid`, `shadow-sticker`, Plus Jakarta Sans, Tailwind CSS
- **Tidak ada dependencies baru** — semua data source sudah ada (Cloud Functions, Firestore)
- **Backyard adalah separate Next.js app** — tidak import dari `clicker-platform-v2/lib`
- **All-client** — Backyard tidak pakai `firebase-admin`, semua via Cloud Functions callable

---

## Sidebar Structure (Final)

Flat list, divider tipis sebagai pemisah, tidak ada section label, tidak ada emoji. Item baru ditandai titik hijau kecil di sebelah kanan.

```
Overview
─────────────────
Tenants
Module Control      •
Slug & Domain       •
─────────────────
Users
Claims & Roles      •
RBAC Settings       •
─────────────────
Monitoring          [badge error count]
Sync Control        •
Seed Tools          •
─────────────────
WhatsApp            •
Settings
─────────────────
[Sign Out]
```

**Total:** 12 menu items (5 existing + 7 baru)

---

## Pages

### 1. Overview (existing — minor update)
**Route:** `/`
**Status:** Ada, perlu tambah widget

**Isi:**
- Stats grid: Total Tenants, Total Users, Active Errors, System Status
- Recent Errors table (3 terbaru dari platform_logs)
- Quick stats row: WA Issues, Sync Status, Active Modules

**Data source:** `getTenants`, `listUsers`, Firestore `platform_logs`

---

### 2. Tenants (existing — no change)
**Route:** `/tenants`
**Status:** Ada, tidak diubah

---

### 3. Module Control (NEW)
**Route:** `/modules`

**Isi:**
- Tabel matrix: baris = tenant, kolom = modul (POS, Membership, Reservation, Inventory, AI Sales, WA, dll)
- Setiap cell = toggle on/off yang bisa diklik langsung (inline update)
- Search/filter tenant di atas tabel
- Perubahan langsung call `updateTenantModules`

**Data source:** `getTenants`, `updateTenantModules`

**Behavior:**
- Toggle click → optimistic UI update → call Cloud Function → revert jika error
- Toast sukses/error per toggle

---

### 4. Slug & Domain (NEW)
**Route:** `/domains`

**Isi:**
- Tabel: Tenant name | Current slug | URL preview | tombol Edit
- Edit slug: inline input dengan konfirmasi (bukan modal terpisah)
- URL preview otomatis update saat ketik: `{slug}.clicker.id`

**Data source:** `getTenants`, `updateTenantSlug`

**Behavior:**
- Click Edit → baris jadi editable inline
- Save → call `updateTenantSlug` → update baris
- Cancel → revert ke nilai lama

---

### 5. Users (existing — no change)
**Route:** `/users`
**Status:** Ada, tidak diubah

---

### 6. Claims & Roles (NEW)
**Route:** `/claims`

**Isi:**
- Search box: cari user by email → call `getUserByEmail`
- Result card: tampilkan current claims (role, siteId, custom fields)
- Tombol "Edit Claims" → form inline untuk ubah role dan siteId
- Tombol "Revoke Access" → call `removeUserFromSite` dengan konfirmasi

**Data source:** `getUserByEmail`, `setCustomClaims`, `removeUserFromSite`

**Behavior:**
- Search submit → fetch claims → tampilkan card
- Edit → save → call `setCustomClaims` → refresh card
- Revoke → confirmation dialog → call `removeUserFromSite`

---

### 7. RBAC Settings (NEW)
**Route:** `/rbac`

**Isi dua section:**

**Section A — Global Role Definitions:**
- Tabel role standar: `owner`, `manager`, `staff` + deskripsi masing-masing
- Bisa tambah custom role (nama + deskripsi)
- Data disimpan di Firestore `platform_meta/rbac_config`

**Section B — Per-Tenant Permission Editor:**
- Dropdown pilih tenant
- Load `PermissionEditor.tsx` yang sudah ada (komponen existing di `backyard/components/PermissionEditor.tsx`)
- Tampilkan permission grid per role per tenant
- Save → update Firestore `sites/{siteId}/config/rbac`

**Data source:** Firestore `platform_meta/rbac_config`, `sites/{siteId}/config/rbac`, komponen `PermissionEditor.tsx`

---

### 8. Monitoring (existing — no change)
**Route:** `/monitoring`
**Status:** Ada (baru ditambah di dev-logging branch), tidak diubah

---

### 9. Sync Control (NEW)
**Route:** `/sync`

**Isi:**
- Stats: Auto Sync status, Last Sync timestamp, jumlah collections
- Tabel collections: nama | type (Firestore/Storage) | status (Active/Idle/Error) | last sync | tombol Trigger
- Tombol "Trigger All Sync Now" di bawah tabel

**Collections yang di-monitor:**
- `sites` → `syncGoFirestore`
- `sites (deep)` → `syncGoFirestoreDeep`
- `sites (level3)` → `syncGoFirestoreLevel3`
- `storage/uploads` → `syncGoStorageUpload`

**Data source:** Firestore `platform_meta/sync_status` (tulis status saat sync berjalan), Cloud Functions callable wrapper untuk manual trigger

**Catatan:** `syncGoFirestore` adalah Firestore trigger (bukan callable). Perlu tambah satu Cloud Function callable baru `triggerManualSync(collection)` yang memanggil logic sync secara manual. Ini satu-satunya backend baru yang perlu dibuat.

---

### 10. Seed Tools (PROMOTE — existing component)
**Route:** `/seed`

**Isi:**
- Dropdown pilih tenant
- Dropdown pilih modul yang akan di-seed
- Tombol "Run Seed"
- Seed History table: tenant | modul | waktu | status

**Data source:** `getTenants`, `seedSiteData`, komponen `SeedTool.tsx` yang sudah ada
**History:** disimpan di Firestore `platform_meta/seed_history` (array append)

---

### 11. WhatsApp Manager (NEW)
**Route:** `/whatsapp`

**Isi:**
- Stats: Total WA Tenants, Connected, Issues
- Tabel: Tenant | Phone number | Status (OK/Error/Idle) | Last Error event | tombol "View Logs"
- "View Logs" → link ke `/monitoring?siteId={siteId}&event=wa.*` (filter pre-filled)
- Status ditentukan dari platform_logs: ada `wa.*` error dalam 1 jam terakhir = Error, ada WA config = Idle/OK

**Data source:** Firestore `sites/{siteId}/settings` (phone number, WA config), `platform_logs` (wa.* events)

---

### 12. Settings (existing — no change)
**Route:** `/settings`
**Status:** Coming Soon placeholder, tidak diubah

---

## Komponen Shared yang Perlu Dibuat

### `backyard/components/PageShell.tsx`
Wrapper layout yang sudah include Sidebar. Semua halaman pakai ini agar tidak duplikasi `<Sidebar />` di setiap page.

```tsx
// Usage:
<PageShell title="Module Control" subtitle="Toggle modules per tenant">
  {/* content */}
</PageShell>
```

### `backyard/components/StatsGrid.tsx`
Reusable stats card grid. Dipakai di Overview, Sync Control, WhatsApp.

---

## Backend: Satu Cloud Function Baru

**`triggerManualSync`** — callable function yang trigger sync manual untuk collection tertentu.

```ts
// functions/src/admin/sync.ts
export const triggerManualSync = functions.https.onCall(async (request) => {
  // validate superadmin
  // jalankan sync logic berdasarkan request.data.collection
  // update platform_meta/sync_status
});
```

Semua Cloud Functions lain sudah ada.

---

## Firestore Collections Baru

| Collection | Kegunaan |
|------------|----------|
| `platform_meta/rbac_config` | Global role definitions |
| `platform_meta/sync_status` | Status per sync collection |
| `platform_meta/seed_history` | History seed tools |

Firestore rules: read/write hanya untuk `isGlobalAdmin()` — konsisten dengan `platform_logs`.

---

## File Map Implementasi

| File | Action |
|------|--------|
| `backyard/components/Sidebar.tsx` | Update menu items (12 items + dividers) |
| `backyard/components/PageShell.tsx` | Buat baru — shared layout wrapper |
| `backyard/components/StatsGrid.tsx` | Buat baru — reusable stats |
| `backyard/app/modules/page.tsx` | Buat baru |
| `backyard/app/domains/page.tsx` | Buat baru |
| `backyard/app/claims/page.tsx` | Buat baru |
| `backyard/app/rbac/page.tsx` | Buat baru |
| `backyard/app/sync/page.tsx` | Buat baru |
| `backyard/app/seed/page.tsx` | Buat baru (wrap SeedTool.tsx) |
| `backyard/app/whatsapp/page.tsx` | Buat baru |
| `backyard/app/page.tsx` | Update — tambah Recent Errors + Quick Stats |
| `functions/src/admin/sync.ts` | Buat baru — `triggerManualSync` |
| `functions/src/index.ts` | Export `triggerManualSync` |
| `clicker-platform-v2/firestore.rules` | Tambah rules untuk `platform_meta` collections |

---

## Out of Scope

- Settings page content (Coming Soon, diisi later)
- Push notifications / email alerts dari Monitoring
- Multi-environment (staging vs prod switch) di UI
- Audit log per superadmin action
