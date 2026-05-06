# Design: Promo Module — Backyard Enable/Disable Toggle

**Date:** 2026-05-06
**Status:** Approved

## Problem

Modul `promo` sudah lengkap di `clicker-platform-v2` (components, API, definitions, components registry) tapi tidak terdaftar di `backyard/lib/modules/definitions.ts`. Akibatnya, modul ini tidak muncul di TenantModulesCard di Backyard dan tidak bisa di-enable/disable per tenant oleh superadmin.

## Scope

Satu file, satu perubahan:
- **File:** `dev/backyard/lib/modules/definitions.ts`
- **Action:** Tambah entry `promo` ke `STATIC_MODULE_DEFINITIONS`

Tidak ada perubahan di:
- `clicker-platform-v2` — definitions dan components registry sudah benar
- `functions/src/admin/modules/seeding.ts` — tidak perlu seed, modul bisa jalan dari empty state

## Change

Tambahkan ke `STATIC_MODULE_DEFINITIONS` di `backyard/lib/modules/definitions.ts`:

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

## How It Works (End-to-End)

1. `SYSTEM_MODULES` di backyard di-generate otomatis dari `STATIC_MODULE_DEFINITIONS` — `promo` langsung muncul di TenantModulesCard
2. Superadmin toggle enable → `updateTenantModules` Cloud Function dipanggil
3. Function update `sites/{siteId}.modules.promo = true` di Firestore
4. Platform membaca flag via `subscribeToEnabledModules` → sidebar routes aktif, modul bisa diakses
5. Tidak ada seeding — modul tampil empty state langsung siap pakai

## Out of Scope

- Tidak ada seed Firestore — empty state sudah cukup
- `fintrack` tidak disentuh (disengaja)
- Tidak ada perubahan UI Backyard
