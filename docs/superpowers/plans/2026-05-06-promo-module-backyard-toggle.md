# Promo Module — Backyard Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Daftarkan modul `promo` ke Backyard definitions agar superadmin bisa enable/disable modul ini per tenant dari TenantModulesCard.

**Architecture:** Satu entry ditambahkan ke `STATIC_MODULE_DEFINITIONS` di `backyard/lib/modules/definitions.ts`. `SYSTEM_MODULES` di-generate otomatis dari map itu, sehingga entry baru langsung muncul di UI toggle tanpa perubahan lain. Tidak ada seeding — modul berjalan dari empty state.

**Tech Stack:** TypeScript, Firebase Firestore, Next.js (App Router), Cloud Functions

---

## File Map

| Action | File | Change |
|--------|------|--------|
| Modify | `dev/backyard/lib/modules/definitions.ts` | Tambah entry `promo` ke `STATIC_MODULE_DEFINITIONS` |

---

### Task 1: Tambah `promo` ke Backyard Module Definitions

**Files:**
- Modify: `dev/backyard/lib/modules/definitions.ts`

- [ ] **Step 1: Buka file definitions**

Buka `dev/backyard/lib/modules/definitions.ts`. Cari baris terakhir dari `STATIC_MODULE_DEFINITIONS` sebelum penutup `};` — tepatnya setelah entry `ai_marketing`.

- [ ] **Step 2: Tambahkan entry `promo`**

Tambahkan entry berikut tepat sebelum `};` penutup `STATIC_MODULE_DEFINITIONS`, setelah entry `ai_marketing`:

```ts
'promo': {
    displayName: 'Promotions',
    description: 'Discount codes, vouchers, and member reward programs.',
    adminRoutes: [
        { label: 'Promotions', path: '/admin/promo',          icon: 'tag',      componentKey: 'promo:PromoAdminPage' },
        { label: 'Vouchers',   path: '/admin/promo/vouchers', icon: 'ticket',   componentKey: 'promo:PromoAdminPage' },
        { label: 'Settings',   path: '/admin/promo/settings', icon: 'settings', componentKey: 'promo:PromoAdminPage', permission: 'settings' },
    ]
},
```

- [ ] **Step 3: Verifikasi TypeScript tidak error**

Jalankan dari direktori `dev/`:

```bash
cd /Users/mac/Documents/AI\ Project/clicker-platform/dev
pnpm --filter backyard exec tsc --noEmit
```

Expected: tidak ada output error. Jika ada error tipe, pastikan struktur entry sesuai dengan `ModuleDefinition` yang didefinisikan di `dev/backyard/lib/modules/types.ts`.

- [ ] **Step 4: Verifikasi entry muncul di SYSTEM_MODULES**

Karena `SYSTEM_MODULES` di-generate via `Object.entries(STATIC_MODULE_DEFINITIONS)`, cukup pastikan secara visual bahwa key `promo` ada dan field `displayName`, `description`, `adminRoutes` terisi dengan benar. Tidak perlu runtime check tambahan.

- [ ] **Step 5: Commit**

```bash
git add dev/backyard/lib/modules/definitions.ts
git commit -m "feat(backyard): register promo module for enable/disable toggle"
```

---

## Cara Verify Fungsionalitas (Manual)

Setelah deploy atau jalankan Backyard secara lokal:

1. Login ke Backyard sebagai superadmin
2. Buka halaman detail tenant mana saja
3. Di card **Modules**, pastikan **"Promotions"** muncul dengan deskripsi *"Discount codes, vouchers, and member reward programs."*
4. Toggle enable → cek Firestore: `sites/{siteId}.modules.promo` berubah jadi `true`
5. Buka platform tenant tersebut → sidebar admin harus menampilkan menu **Promotions** dan **Vouchers**
6. Toggle disable → menu hilang dari sidebar
