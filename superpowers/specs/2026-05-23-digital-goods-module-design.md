# Digital Goods Module — Design Spec

**Date:** 2026-05-23
**Status:** Brainstorm complete, awaiting user spec review before plan
**Module ID:** `digital_goods`
**Target ship:** Mid-June 2026 (~3 weeks)
**Author context:** Andre, in collaboration with content creator partner (finance/debt/pinjol niche, 64K IG followers). Revenue share: Clicker 20%, tenant 80%; Clicker covers infra in Phase 1.

---

## 1. Purpose

Lets a Clicker tenant sell digital products to buyers and deliver them via a gated library. MVP supports **single-file digital products** (PDF primary; YouTube unlisted link as an alternative content kind). Payment is **manual bank transfer** with tenant-side confirmation. Buyer auth is the existing **magic-link** flow. Architecture leaves clean extension points for Bundles (v1.1), Courses (v1.2), online payment gateways (v2), and aggregator/escrow (v3).

## 2. Strategic context

- Clicker is **not** a marketplace. Each tenant runs their own brand on their own (often custom) domain.
- The buyer is a member **of the tenant**, not of Clicker. Branding, emails, and login flow feel native to the tenant.
- Same underlying Firebase Auth identity is reused across tenants (Firebase's default behavior — same email = same UID), but each tenant has its own `Member` doc. The buyer never perceives Clicker.
- The existing `membership` module is loyalty-focused. It is **not** renamed; the new module reuses `Member` as the buyer-identity record and optionally awards loyalty points via the existing `addPoints` API.

## 3. Module shape

Standard Clicker module under `lib/modules/digital_goods/` with `api.ts`, `constants.ts`, `types.ts`, `admin/`, `public/`, `components/`. Registered in `lib/modules/definitions.ts` and seeded into Firestore `modules/digital_goods` per CLAUDE.md rule #7.

| Identifier | Value |
|---|---|
| Module ID (registry / code) | `digital_goods` |
| UI label | TBD (placeholder "Digital Goods") |
| Public store URL | `/store` |
| Buyer library URL | `/library` |
| Admin URL prefix | `/admin/digital-goods/` |

## 4. Data model

### Firestore paths

All digital_goods data lives under the module's own path (`sites/{siteId}/modules/digital_goods/...`) per the platform convention — no module's data lives in another module's path. Buyer identity is referenced by `memberId` (foreign key), not by physical nesting under the membership module.

```text
sites/{siteId}/modules/digital_goods/products/{productId}
sites/{siteId}/modules/digital_goods/orders/{orderId}
sites/{siteId}/modules/digital_goods/library/{libraryEntryId}
sites/{siteId}/modules/digital_goods/settings/config           // single-doc, holds bank details
```

### `products/{productId}`

```ts
{
  type: 'single',                         // MVP. Future: 'single' | 'bundle' | 'course'
  title: string,
  description: string,                    // markdown supported
  coverImage?: string,                    // Firebase Storage path
  price: number,                          // integer IDR
  currency: 'IDR',
  contentKind: 'pdf' | 'youtube',
  files: Array<                           // MVP: length === 1 for type:'single'
    | { id, name, storagePath, sizeBytes, mimeType }     // PDF
    | { id, kind: 'youtube', url, title }                 // YouTube unlisted
  >,
  slug: string,                           // URL-safe, unique per site
  status: 'draft' | 'published',
  createdAt: Timestamp,
  updatedAt: Timestamp,
  publishedAt?: Timestamp,
  // Reserved for v1.2: course?: { modules: [...] }
}
```

### `orders/{orderId}`

```ts
{
  memberId: string,
  productId: string,
  productSnapshot: {                      // denormalized at order time, immutable
    title, coverImage, price, currency, contentKind, type
  },
  amount: number,                         // IDR, buyer-paid amount
  currency: 'IDR',
  paymentMethod: 'manual_transfer',       // MVP. Future: 'midtrans' | 'xendit'
  paymentInstructions: {                  // snapshotted from tenant settings at order time
    bankName, accountNumber, accountName, qrisImageUrl?
  },
  status: 'pending' | 'awaiting_confirmation' | 'paid' | 'cancelled',
  buyerNote?: string,                     // optional, buyer pastes transfer reference
  paymentRef?: string,                    // optional, tenant pastes bank ref on confirm
  confirmedBy?: string,                   // userId of staff who confirmed
  confirmedAt?: Timestamp,
  createdAt: Timestamp,
  updatedAt: Timestamp,
  // Reserved for v2: paymentProvider?: { provider, transactionId, rawWebhookPayload }
  // Reserved for v3: fees?: { pg, platform, net }
}
```

### `library/{libraryEntryId}`

Flat collection keyed by `memberId` field, not nested under member docs. Owned by digital_goods (no entanglement with the membership module's path).

```ts
{
  memberId: string,                       // FK to sites/{siteId}/modules/membership/members
  productId: string,
  orderId: string,
  productSnapshot: { title, coverImage, type, contentKind },
  purchasedAt: Timestamp,
  // Reserved for v1.2: progress?: { completedLessons: string[] }
}
```

Read pattern for "this member's library": `query(library, where('memberId', '==', X), orderBy('purchasedAt', 'desc'))` — needs a composite index on `(memberId, purchasedAt desc)`. Firestore prompts for index creation on first query in dev.

### `settings/config` (single doc)

```ts
{
  bankName: string,
  accountNumber: string,
  accountName: string,
  qrisImageUrl?: string,                  // Firebase Storage path
  updatedAt: Timestamp,
}
```

## 5. Authentication & identity

- Reuses existing magic-link flow at `/member/login` → `/member/login/verify` (owned by the membership module).
- The `Member` doc lives at `sites/{siteId}/modules/membership/members/{memberId}` and is owned by the membership module. Digital_goods **references** it by `memberId` but never writes to it directly.
- **Auto-provision on first verify:** the membership module's existing verify handler creates the `Member` doc if absent. Digital_goods does not duplicate or sidecar this logic — it consumes whatever member-resolution helper the membership module exposes (e.g., `getOrCreateMemberByUid(siteId, uid)`). If this helper doesn't yet exist, the plan will add it inside the membership module (one targeted change), then call it from digital_goods.
- Name is collected on first library visit if missing — via the same membership-module update path, not a digital_goods write.
- Magic-link emails are sent via existing Resend integration with per-tenant from-name and template branding — the buyer never sees "Clicker" branding.

## 6. Access control

### Server-side guard (every signed-URL endpoint and library detail)

```ts
// helper from membership module — read-only resolution of the current member
const member = await getMemberFromSession(siteId);
if (!member) return redirect('/member/login?next=...');

// digital_goods API — owns library queries on its own collection
const entry = await getLibraryEntryForProduct(siteId, member.id, productId);
if (!entry) return forbidden();
// issue 15-min signed URL for PDF download or render YouTube embed
```

### Firestore security rules

All rules live alongside other module rules in `firestore.rules` under the `sites/{siteId}/modules/digital_goods/...` path. No rules touch the membership module's path.

- `modules/digital_goods/products/{id}` — public read for `status === 'published'`; admin write (requires `digital_goods.manage` permission).
- `modules/digital_goods/orders/{id}` — buyer reads own (where `request.auth.uid` resolves to the order's `memberId`); admin reads/writes all in their tenant.
- `modules/digital_goods/library/{id}` — buyer reads own (same `memberId` check); server writes via Admin SDK only (no client-side writes ever).
- `modules/digital_goods/settings/config` — admin read/write only.

### File delivery

- PDF: short-lived signed Firebase Storage URL (15-min expiry), regenerated on every "Download" click. Never stored or cached client-side.
- YouTube: rendered as iframe embed on the library detail page.

## 7. Tenant-side admin

Under `/admin/digital-goods/`:

| Route | Screen |
|---|---|
| `/admin/digital-goods` | Module landing / products list |
| `/admin/digital-goods/products/new` | Product editor (create) |
| `/admin/digital-goods/products/[id]` | Product editor (edit) |
| `/admin/digital-goods/orders` | Orders list with status filter, search by buyer email |
| `/admin/digital-goods/orders/[id]` | Order detail panel with "Mark as paid" / "Cancel" actions |
| `/admin/digital-goods/settings` | Bank account details (name, number, bank), QRIS image upload |

**Product editor fields:** title, description (markdown), cover image (uses existing `MediaPicker`/`uploadToStorage`), price, content kind toggle (PDF upload OR YouTube URL), draft/publish toggle.

**Permissions:** new permission `digital_goods.manage`. Standard `canEdit()` check per CLAUDE.md rule #4.

## 8. Buyer-side public

| Route | Screen |
|---|---|
| `/store` | Public catalog (list of published products) |
| `/store/[slug]` | Product detail page |
| `/store/[slug]/checkout` | Checkout (auth-gated) |
| `/library/orders/[orderId]` | Order status page |
| `/library` | Buyer's purchased items (auth-gated) |
| `/library/[libraryEntryId]` | Single purchase detail (PDF download / YouTube embed) |

## 9. Buyer checkout flow (MVP — manual transfer)

1. **Discovery** — buyer lands on `/store/[slug]` from creator's IG, WhatsApp, etc. No login needed to browse.
2. **Click "Buy Now":**
   - Not logged in → redirect to `/member/login?next=/store/[slug]/checkout`. Magic link round-trip.
   - Logged in → straight to checkout.
3. **Checkout page** displays: order summary, buyer's email, payment instructions (bank details + QRIS image snapshotted from tenant settings), optional "Catatan transfer" field, "Saya sudah transfer" button. No PG widget — purely instructions.
4. **Click "Saya sudah transfer":** server creates `Order` with `status: 'awaiting_confirmation'`, snapshots `paymentInstructions`, sends Resend email to tenant ("New order #X from buyer@x.com, Rp Y"). Redirects buyer to order status page.
5. **Order status page** (`/library/orders/[orderId]`): live status ("Menunggu konfirmasi"), payment instructions repeated, editable buyer note. Uses Firestore `onSnapshot` for live updates. Copy: "Kami akan kirim email saat pesanan dikonfirmasi."
6. **Tenant confirms (out-of-band):** opens admin → order detail → clicks "Tandai Lunas" (optionally pastes `paymentRef`). Server transitions order to `paid`, writes library entry, sends buyer confirmation email with library link.
7. **Buyer receives confirmation:** email lands; status page live-updates to "Lunas" with "Lihat di Library" CTA.

### Already-purchased guard

Product detail page checks if the logged-in buyer already owns this product (paid order or library entry exists). If so, "Buy Now" is replaced by "Already in your library →" linking to `/library/[libraryEntryId]`. Prevents duplicate-purchase confusion.

### Cancellation

Tenant can cancel `awaiting_confirmation` orders from the admin detail panel ("Mark as cancelled"). No library entry is created; status becomes `cancelled`. No automatic SLA enforcement in MVP.

## 10. Notifications

- **To tenant** (on new order): Resend email — "New order #X from buyer@x.com, Rp Y. Cek bank, lalu confirm." Includes deep link to admin order detail.
- **To buyer** (on order paid): Resend email — "Pembayaran dikonfirmasi! Akses produk Anda: [Buka Library]." Includes deep link to library entry.

Email-only for MVP. Per-tenant from-name and template branding via existing Resend setup.

## 11. Cross-module integrations

Every cross-module touchpoint is enumerated here. The rule: digital_goods may **read from** and **call published facades of** other modules. It must never write directly to another module's Firestore data, and it must never import from another module's internals (only the facade `@/lib/modules/<x>/api`).

| Integration | Direction | Mechanism |
| --- | --- | --- |
| Firebase Auth | digital_goods consumes session | Existing `lib/firebase` client / Admin SDK in server actions. Platform infrastructure, not a module. |
| **Membership module — member resolution** | digital_goods calls facade | `getMemberFromSession(siteId)` and `getOrCreateMemberByUid(siteId, uid)` exported from `@/lib/modules/membership/api`. Digital_goods never reads/writes `members/*` directly. If either helper doesn't exist yet, the plan adds it inside membership module. |
| **Membership module — loyalty award (optional)** | digital_goods calls facade | On `Order.status === 'paid'`, if `membership` module is enabled and loyalty is on, call `addPoints(siteId, memberId, points, source)` via `@/lib/modules/membership/api` (designated facade exception per CLAUDE.md rule #6). Failure is non-fatal — log and continue; the purchase still succeeds. |
| Firebase Storage | digital_goods owns its files | All files at `sites/{siteId}/modules/digital_goods/...`. No shared storage paths. Signed-URL issuance handled server-side via Admin SDK in `app/api/digital-goods/files/[fileId]/route.ts` (digital_goods's own endpoint). |
| Resend email | digital_goods calls platform helper | `sendEmail({ siteId, to, templateAlias, variables })` from `lib/email/...`. Platform infrastructure, not a module. New template aliases owned by digital_goods: `digital_goods.new_order_tenant` and `digital_goods.order_paid_buyer`. |
| PostHog | digital_goods emits events | `digital_goods.purchase_completed`, `digital_goods.product_published`. Uses platform PostHog wiring with `siteId` super-property. |
| Site context | digital_goods consumes | `useSite()` for `siteId` per CLAUDE.md rule #3. Platform infrastructure. |
| RBAC | digital_goods registers permission | New permission `digital_goods.manage` added to platform RBAC registry. `canEdit()` check per rule #4. |

### Cross-module audit findings (fixed in this spec)

- ✗→✓ Library originally placed under `members/{memberId}/library` (membership module's path). **Fixed:** library lives under `modules/digital_goods/library` with `memberId` as a FK field.
- ✗→✓ Originally said "auto-provision a Member doc" without specifying who owns the write. **Fixed:** the write happens inside the membership module via its `getOrCreateMemberByUid` helper. Digital_goods only calls it.
- ✗→✓ Originally said "Name is collected on first library visit" without specifying which module writes it. **Fixed:** name update goes through a membership-module helper (e.g., `updateMemberProfile`). Digital_goods does not write `members/*`.
- ✗→✓ Storage path originally `sites/{siteId}/digital_products/...` (top-level, outside the module's namespace). **Fixed:** nested under `sites/{siteId}/modules/digital_goods/...` to mirror Firestore convention.
- ✓ Loyalty integration was correctly designed as a facade call from the start.

## 12. Out of MVP (explicit non-goals)

- No bundles, courses, lessons, progress tracking, quizzes.
- No subscriptions / recurring billing.
- No automated payment gateway (Approach 2 — deferred to v2).
- No aggregator / escrow / payout (Approach 1 — deferred to v3, requires legal).
- No refund workflow.
- No physical goods.
- No video hosting (YouTube unlisted only).
- No reviews / comments / Q&A.
- No promo / discount code integration (existing `promo` module can be wired later via `promo_integration` skill).
- No cart / multi-item checkout.
- No guest checkout.
- No Canvas Studio block to embed product cards in custom pages (standalone `/store` only).
- No WhatsApp notifications.

## 13. Build estimate

| Slice | Effort |
|---|---|
| Module scaffolding, registry, Firestore seed | 0.5 day |
| Schema, types, security rules | 0.5 day |
| Admin: products list + editor + image/PDF upload | 1.5 days |
| Admin: orders list + manual-confirm flow | 1 day |
| Admin: payment settings (bank details + QRIS) | 0.5 day |
| Public: product detail + checkout pages | 1 day |
| Public: library + signed-URL endpoint | 1 day |
| Buyer + tenant emails (Resend templates) | 0.5 day |
| Loyalty integration (optional points award) | 0.25 day |
| Already-purchased guard | 0.25 day |
| Testing, polish, dogfooding with the creator | 1.5 days |
| **Total** | **~8.5 working days** |

Comfortably ships in 3 weeks if no surprises. Mid-June launch realistic.

---

## 14. Future roadmap — DEFERRED, not in MVP

The MVP schema and architecture are designed so each of these is **additive** with no migration of existing data required. Each section below documents *what will change* and *what MVP must avoid doing* so the door stays open.

### v1.1 — Bundle (~3–5 days post-MVP) — DEFERRED

- New product type: `Product.type = 'bundle'`. Tenant adds multiple files to one product, one price.
- Buyer library shows bundle as a single entry; opening it reveals file list inside.
- Schema-wise this is purely the `files[]` array growing from `length === 1` to `length > 1`. **MVP already designs `files[]` as an array** — no schema change required.
- Mostly admin UI work (multi-file upload widget) + a library detail variant.

### v1.2 — Course / LMS-lite (multi-week, scope on its own later) — DEFERRED

- New product type: `Product.type = 'course'` with nested `course.modules[].lessons[]`.
- Lesson types: `'video' | 'article' | 'file'`.
- Course builder UI in admin (drag-reorder, lesson editor — likely uses Canvas Studio block editor infrastructure or a stripped-down variant).
- Public course player UI (TOC sidebar, content area, "next lesson" nav).
- Per-buyer progress tracking via `library/{entry}.progress.completedLessons[]`.
- **MVP reserves** the `course?` field on `Product` and `progress?` field on library entry — both optional, both absent in MVP.

### v2 — Tenant-connected Payment Gateway (5–8 days) — DEFERRED

Approach 2 from the brainstorm. Each tenant brings their own Midtrans/Xendit merchant account. Money flows directly to tenant. Clicker invoices 20% revshare separately (manual until v3).

**What changes:**
- New admin screen `/admin/digital-goods/settings/payment` — "Payment Methods" panel with Manual Transfer + Online Payment cards. Tenant pastes provider credentials.
- Credentials stored at `sites/{siteId}/integrations/{provider}` — **separate doc, encrypted at rest, server-only reads**. Reserved path; not built in MVP. **MVP rule: never put payment credentials on the main site doc.**
- Checkout adds a payment-method picker step. PG paths render Snap/Xendit checkout (modal or redirect).
- Per-tenant webhook endpoint `app/api/digital-goods/webhook/[provider]/route.ts`. Site lookup via transaction metadata. Per-tenant webhook-secret signature verification. Idempotency / dedupe required (PGs retry).
- `Order.paymentMethod` gains `'midtrans' | 'xendit'`. `Order.paymentProvider` field added (transaction ID + raw payload for debugging). Both additive.
- `Order.status` may gain `'failed'`. Additive.

**MVP forward-compat checklist for v2:**
- ✓ `paymentMethod` already a string enum, easy to extend.
- ✓ `Order.amount` is buyer-paid gross — fees/splits go in v3 additive fields.
- ✓ `paymentInstructions` is snapshotted per-order — historical orders aren't affected when tenant changes payment setup.
- ✓ Library granting is decoupled from how the payment happened (driven by `Order.status === 'paid'` regardless of source).

### v3 — Clicker as Aggregator (legal-first, then 2–8 weeks engineering) — DEFERRED

Approach 1 from the brainstorm. Buyer pays Clicker; Clicker holds funds in escrow, takes its cut, pays out to tenant on a schedule.

**Pre-requisites (months of legal work):**
1. Legal entity (PT) with sufficient capital.
2. OJK registration as payment service provider — OR partner with a licensed aggregator like **Xendit Marketplace** (recommended path; Xendit holds the license, you wire tenants as sub-accounts, Xendit handles split-payment automatically per transaction).
3. Tax / PPN structure for aggregated revenue.
4. KYC for tenants (bank account verification, contracts).
5. Escrow / settlement account.
6. ToS rewrite (buyer pays Clicker, refund policy, dispute resolution, tenant takedown).

**Engineering scope once legal is settled:**
- Ledger (double-entry recommended) — orders generate paired debit/credit for tenant earnings vs Clicker liability.
- Payout engine — scheduled disbursements per tenant. If Xendit Marketplace: split happens automatically per transaction; otherwise: bank disbursement API integration.
- Tenant earnings dashboard — balance, payout schedule, history.
- Hold periods (industry standard 7–14 days before payout) for refund window.
- Refund / dispute handling now lives with Clicker, not tenant.
- Fee transparency UI for tenant ("Sale Rp 100k → PG fee Rp 2.5k → Clicker fee Rp 19.5k → Your earnings Rp 78k").
- Year-end earnings reports for tenant tax filing.

**Recommended middle path:** Use Xendit Marketplace (or Midtrans equivalent). Xendit carries the regulatory burden. Engineering ~2–3 weeks instead of 4–8.

**MVP forward-compat checklist for v3:**
- ✓ `Order.amount` is buyer-paid gross. v3 adds `Order.fees: { pg, platform, net }` — additive.
- ✓ Revshare deal (20%) is **not** modeled in code. When v3 ships, store in a separate `sites/{siteId}/billing/terms` doc — never inline in product/order records. Keeps order history clean when terms change.
- ✓ `Order.status` may gain `'refunded' | 'held'`. Additive.

---

## 15. Open questions / unresolved

None blocking MVP. Items intentionally left for later:
- UI label / marketing name for the module (placeholder "Digital Goods" — tenant may want to brand as "Shop," "Library," "Vault," etc.). i18n hook.
- Storefront templating — currently a standalone `/store` route. Future: Canvas Studio block to embed product cards in custom pages.
- Promo code support — wire later via existing `promo` module and `promo_integration` skill.
- Refund workflow — tenant currently handles out-of-band. v2+ may need first-class refund support.
