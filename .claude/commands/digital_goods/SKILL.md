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

**Plan 1 — Foundation: SHIPPED.** Admin can create/edit/publish PDF or YouTube products, configure bank/QRIS settings.

**Plan 2 — Purchase flow: SHIPPED (under audit).** Buyer flow is built: storefront (`/{tenant}/store`, `/{tenant}/store/[slug]`), magic-link login (`/{tenant}/store/login` + `/verify`), checkout, order status, gated library (`/{tenant}/library`, `/{tenant}/library/[entryId]`), buyer profile (`/{tenant}/profile`), admin Orders list + confirm/cancel, signed-URL PDF serving, and order/paid emails. Buyer identity lives at `modules/digital_goods/buyers/{uid}` (Firebase Auth session cookie). As of 2026-05-28 the module is being audited area-by-area; see memory `project_auth_cookie_collision` for the admin/buyer cookie-origin caveat.

**Plan 3 — Polish: PARTIAL/PENDING.** Loyalty integration, already-purchased guard, and PostHog events not yet confirmed wired — verify before relying on them.

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
| Admin Products list | `/admin/digital-goods` |
| Admin Orders list | `/admin/digital-goods/orders` |
| Admin Settings | `/admin/digital-goods/settings` |
| Buyer storefront | `/{tenant}/store`, `/{tenant}/store/[slug]` |
| Buyer checkout | `/{tenant}/store/[slug]/checkout` |
| Buyer login | `/{tenant}/store/login` (+ `/verify`) — module-owned, NOT `/member/login` |
| Buyer library | `/{tenant}/library`, `/{tenant}/library/[entryId]` |
| Buyer order status | `/{tenant}/library/orders/[orderId]` |
| Buyer profile | `/{tenant}/profile` |
| Buyer APIs | `/api/digital-goods/{auth,buyer,checkout,orders,files,lookup-library}` |

---

## 3. Architecture Rules

- **Single buyer identity** at `modules/digital_goods/buyers/{uid}` (Plan 2). **No dependency on membership module for identity.**
- **Loyalty integration** (Plan 3) is opt-in via the `membership` module facade — fire-and-forget after a paid order. No `Member` doc creation in Plan 1.
- **All Firestore reads/writes** use constants from `constants.ts`. Never hardcode paths.
- **Cover images and QRIS upload** via existing `lib/upload.ts` `uploadToStorage({ file, folder, siteId })` (returns `{ url, path, contentType, sizeBytes }`). `coverImage` and `qrisImageUrl` store the public `.url`; PDFs store the private `.path` (served via signed URL).
- **PDF storage paths** (`PdfFile.storagePath`) are kept private and served through `/api/digital-goods/files/[fileId]` which mints a short-lived signed URL.

---

## 4. Key Types (`lib/modules/digital_goods/types.ts`)

Timestamp fields use the client-SDK `Timestamp` (`firebase/firestore`), matching every other module; server code writes `FieldValue.serverTimestamp()` and reads via `as Type` casts.

### `DigitalProduct`

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | Firestore doc ID |
| `type` | `ProductType` (`'single'`) | Plan 1 only; future `'bundle' \| 'course'` |
| `title` | `string` | Product title |
| `description` | `string` | Markdown |
| `coverImage` | `string?` | Public URL (from MediaPicker) |
| `price` | `number` | Integer IDR |
| `currency` | `'IDR'` | |
| `contentKind` | `'pdf' \| 'youtube'` | |
| `files` | `ProductFile[]` | Discriminated union `PdfFile \| YouTubeFile`; Plan 1 length === 1 |
| `slug` | `string` | URL-safe, unique per site |
| `status` | `'draft' \| 'published'` | |
| `createdAt` / `updatedAt` | `Timestamp` | Server-set |
| `publishedAt` | `Timestamp?` | |

`PdfFile` = `{ id, kind: 'pdf', name, storagePath, sizeBytes, mimeType }` (private path, signed-URL served).
`YouTubeFile` = `{ id, kind: 'youtube', url, title? }`.

### `DigitalGoodsSettings`

| Field | Type | Notes |
|---|---|---|
| `bankName` | `string` | Bank name (e.g. "BCA") |
| `accountNumber` | `string` | Account number |
| `accountName` | `string` | Account holder name |
| `qrisImageUrl` | `string?` | Public Storage URL — static QRIS, shown on checkout |
| `updatedAt` | `Timestamp?` | |

### Other key types

- `DigitalOrder` — has `productSnapshot` (denormalized), `status` (`pending \| awaiting_confirmation \| paid \| cancelled`), `paymentInstructions`, `buyerId`/`buyerEmail?`. State transitions guarded by `canTransition`.
- `LibraryEntry` — gated content access; created on order `paid`. Has `productSnapshot`, `orderId`, `purchasedAt`.
- `DigitalGoodsBuyer` — `{ uid, email, fullName?, createdAt, updatedAt }`, auto-provisioned at `modules/digital_goods/buyers/{uid}` on first authed visit.

---

## 5. Where to Start

- **Spec:** `superpowers/specs/2026-05-23-digital-goods-module-design.md` (15 sections, includes v1.1/v2/v3 roadmap)
- **Plan 1:** `superpowers/plans/2026-05-23-digital-goods-plan-1-foundation.md`
- **Brainstorm notes:** `superpowers/notes/2026-05-23-digital-goods-brainstorm.md`
- **Wireframes (HTML):** `superpowers/wireframes/digital_goods/` — serve via `python3 -m http.server 3030`

---

## 6. Common Tasks

### Add a new admin field to a product
1. Edit `lib/modules/digital_goods/types.ts` → add field to `DigitalProduct` interface.
2. Edit `lib/modules/digital_goods/admin/components/ProductForm.tsx` → add input + form state + save mapping (validation is inline in this component; there is no separate hook).
3. Persist via `lib/modules/digital_goods/api.ts` (client) if a new write path is needed.
4. Test in the ProductForm flow reached from `/admin/digital-goods`.

### Add a new admin route
1. Register in `lib/modules/definitions.ts` → add an entry to the `'digital_goods'.adminRoutes[]` array. Only add a `permission` field for owner-restricted routes (e.g. Settings); content routes omit it so they fall back to grantable `hasAccess()`.
2. Register the component in `lib/modules/components.tsx` → add a `dynamic()` import and map a `'digital_goods:Key'` entry.
3. Create the page component under `lib/modules/digital_goods/admin/` (pages live directly here, e.g. `OrdersListPage.tsx`; shared bits go in `admin/components/`).
4. Keep `scripts/seed-modules.ts` adminRoutes in sync, and ensure the Firestore module doc at `modules/digital_goods` exists with `{ id, displayName: "Digital Goods", enabled: true, icon, version }`.

### Tighten Firestore security
Edit `firestore.rules` and deploy to `clicker-universe-stagging` with `--project clicker-universe-stagging`.

---

## 7. Reference

- **Upload utility:** `lib/upload.ts` → `uploadToStorage({ file, folder, siteId })` returns `{ url, path, contentType, sizeBytes }`
- **Module registry:** `sites/{siteId}/modules/digital_goods` (module doc must exist for admin sidebar)
- **Client-side multi-tenancy:** Always use `useSite()` → `siteId` for all paths
- **RBAC:** Call `canEdit()` before writes in client components
