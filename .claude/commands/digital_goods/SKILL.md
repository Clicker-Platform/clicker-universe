---
name: digital_goods
description: >
  Work with the Digital Goods module — tenants selling digital products (PDF, YouTube unlisted) with manual bank-transfer payment.
  Use when adding screens, debugging admin product/settings issues, or extending to Plan 2 (buyer flow).
  Trigger on: "digital goods", "digital_goods", "/admin/digital-goods", "/store", "/library/orders", "PDF product", "manual transfer", "buyer library", "lib/modules/digital_goods/", or any work in lib/modules/digital_goods/.
---

> **Architecture Reference:** Always read [`docs/ARCHITECTURE.md`](../../../clicker-platform-v2/docs/ARCHITECTURE.md) before making any changes.

# /digital_goods — Digital Goods Module

Sell digital products (PDF, YouTube unlisted) with gated buyer library and manual bank-transfer payment.

This skill is invoked as `/digital_goods [action]`.

---

## 1. Status & Roadmap

**Plan 1 — Foundation: SHIPPED.** Admin can create/edit/publish PDF or YouTube products, configure bank settings.

**Plan 2 — Purchase flow: PENDING.** No buyer-facing flow yet (no /store, no checkout, no orders, no library).

**Plan 3 — Polish: PENDING.** No loyalty integration, no already-purchased guard, no PostHog events.

---

## 2. Key Paths (constants from `lib/modules/digital_goods/constants.ts`)

| What | Path |
|---|---|
| Module ID | `digital_goods` |
| Products Firestore | `sites/{siteId}/modules/digital_goods/products/{id}` |
| Settings Firestore | `sites/{siteId}/modules/digital_goods/settings/config` |
| Orders Firestore (Plan 2) | `sites/{siteId}/modules/digital_goods/orders/{id}` |
| Library Firestore (Plan 2) | `sites/{siteId}/modules/digital_goods/library/{id}` |
| Buyers Firestore (Plan 2) | `sites/{siteId}/modules/digital_goods/buyers/{uid}` |
| Storage (PDFs) | `sites/{siteId}/modules/digital_goods/products/files/` |
| Storage (QRIS) | `sites/{siteId}/modules/digital_goods/settings/` |
| Admin list | `/admin/digital-goods` |
| Admin new product | `/admin/digital-goods/products/new` |
| Admin edit product | `/admin/digital-goods/products/edit?id=...` |
| Admin settings | `/admin/digital-goods/settings` |

---

## 3. Architecture Rules

- **Single buyer identity** at `modules/digital_goods/buyers/{uid}` (Plan 2). **No dependency on membership module for identity.**
- **Loyalty integration** (Plan 3) is opt-in via the `membership` module facade — fire-and-forget after a paid order. No `Member` doc creation in Plan 1.
- **All Firestore reads/writes** use constants from `constants.ts`. Never hardcode paths.
- **Cover images and QRIS upload** via existing `lib/upload.ts` `uploadToStorage` (returns `{ url, path, contentType, sizeBytes }`).
- **PDF storage paths** are returned by `uploadToStorage().path` and stored on the Product's `files[]` array. Plan 2 will serve via signed URLs.

---

## 4. Key Types (`lib/modules/digital_goods/types.ts`)

### `Product`

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | Firestore doc ID |
| `name` | `string` | Product title |
| `description` | `string` | Rich text (Tiptap) |
| `price` | `number` | In IDR |
| `type` | `'pdf' \| 'youtube'` | Product type |
| `files` | `Array<{path, url, name, sizeBytes}>` | PDFs only |
| `youtubeUrl` | `string?` | YouTube unlisted URL (Plan 2 validates as unlisted) |
| `coverImage` | `{url, path}?` | Cover image uploaded to Storage |
| `published` | `boolean` | Draft vs. published state |
| `createdAt` | `Timestamp` | Server-set |
| `updatedAt` | `Timestamp` | Server-set |

### `Settings`

| Field | Type | Notes |
|---|---|---|
| `bankAccountName` | `string` | Account holder name |
| `bankName` | `string` | Bank name (e.g., "BCA") |
| `bankAccountNumber` | `string` | Account number (masked in UI) |
| `qrisCode` | `{url, path}?` | QRIS code image |
| `manualTransferInstructions` | `string` | Rich text instructions |

---

## 5. Where to Start

- **Spec:** `superpowers/specs/2026-05-23-digital-goods-module-design.md` (15 sections, includes v1.1/v2/v3 roadmap)
- **Plan 1:** `superpowers/plans/2026-05-23-digital-goods-plan-1-foundation.md`
- **Brainstorm notes:** `superpowers/notes/2026-05-23-digital-goods-brainstorm.md`
- **Wireframes (HTML):** `superpowers/wireframes/digital_goods/` — serve via `python3 -m http.server 3030`

---

## 6. Common Tasks

### Add a new admin field to a product
1. Edit `lib/modules/digital_goods/types.ts` → add field to `Product` interface.
2. Edit `lib/modules/digital_goods/admin/components/ProductForm.tsx` → add input.
3. Update `lib/modules/digital_goods/admin/hooks/useProductForm.ts` if validation needed.
4. Test: `/admin/digital-goods/products/new` and `/admin/digital-goods/products/edit?id=...`

### Add a new admin route
1. Register in `lib/modules/definitions.ts` → add to `digitalGoodsModuleDefinition.adminRoutes[]`.
2. Register in `lib/modules/components.tsx` → add to `digitalGoodsAdminRoutes` with lazy-loaded component.
3. Create the route file under `lib/modules/digital_goods/admin/routes/`.
4. Test 3-way parity: definitions, components, and ensure Firestore module doc at `modules/digital_goods` exists with `{ id, displayName: "Digital Goods", enabled: true, icon, version }`.

### Tighten Firestore security
Edit `firestore.rules` and deploy to `clicker-universe-stagging` with `--project clicker-universe-stagging`.

---

## 7. Reference

- **Upload utility:** `lib/upload.ts` → `uploadToStorage(siteId, path, file)` returns `{ url, path, contentType, sizeBytes }`
- **Module registry:** `sites/{siteId}/modules/digital_goods` (module doc must exist for admin sidebar)
- **Client-side multi-tenancy:** Always use `useSite()` → `siteId` for all paths
- **RBAC:** Call `canEdit()` before writes in client components
