# Campaigns Module — Banner & Ad Management

**Date:** 2026-05-14
**Status:** Spec — awaiting user review before plan
**Type:** New opt-in module

---

## 1. Goal

Give tenants a single place to create, schedule, and place promotional banners across their Clicker surfaces (POS customer page, Canvas Studio blocks, Link-in-bio). A banner can link to a Promo (showing eligible items), a custom Page, an external URL, or nothing.

**Out of scope for v1:** audience targeting, device targeting, banners in emails, banners in reservation/cashier flows, category/product link targets, auto-apply-promo on tap.

---

## 2. Why a new module (not extending Promo)

Promo Engine handles discount rules, eligibility, vouchers, and commit/reverse — the money side. Banners are pixels and clicks: visual surfaces that may or may not point at a promo. Forcing every banner to be a promo would:

- Bloat the Promo schema with image/placement/CTA fields
- Run eligibility/voucher logic for pure-marketing banners (e.g. "New menu Monday")
- Make banner placement leak across surfaces (POS, site, links, future emails)
- Block use cases where a banner links to a category or external URL with no discount

Campaigns module owns visual surfaces. Promo stays focused on discount math. Cross-module imports are limited to one well-defined facade call (`@/lib/modules/promo/api`), matching the existing pattern used by `byod_pos`.

---

## 3. Module Boundary

- **New module:** `lib/modules/campaigns/`
- **Sanctioned cross-module imports:** `campaigns` may import from `@/lib/modules/promo/api` and `@/lib/modules/byod_pos/api` (facades only). These are the only cross-module imports.
- **Promo does NOT import campaigns.** Promo remains untouched except for the one additive schema change (§4.3).
- **Consumers** (`byod_pos`, Canvas Studio, Links) import campaigns via `@/lib/modules/campaigns/api`.

---

## 4. Data Model

### 4.1 Banner — `sites/{siteId}/modules/campaigns/banners/{bannerId}`

```ts
type BannerPlacement = 'pos' | 'site_block' | 'links';

type BannerTarget =
  | { type: 'promo'; promoId: string }
  | { type: 'page'; pageSlug: string }
  | { type: 'external'; url: string }
  | { type: 'none' };

interface Banner {
  id: string;
  siteId: string;

  // Content
  title: string;            // admin label
  image: string;            // Firebase Storage URL
  altText?: string;
  aspectRatio: '3:2' | '3:1';  // default '3:2'. '3:1' is wider hero format. Determines upload crop guide.

  // Click target
  target: BannerTarget;

  // Placement (multi)
  placements: BannerPlacement[];

  // Scheduling
  status: 'draft' | 'active' | 'paused' | 'archived';
  startAt?: Timestamp;      // null = starts immediately
  endAt?: Timestamp;        // null = no end
  priority: number;         // lower = first. Default 100.

  // Tracking (denormalized counters; PostHog is source of truth)
  impressionCount: number;
  clickCount: number;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### 4.2 Settings — `sites/{siteId}/modules/campaigns/settings/config` (singleton)

```ts
interface CampaignsSettings {
  posBannerEnabled: boolean;     // POS surface master switch
  posBannerMaxCount: number;     // max banners rendered in POS (default 3)
  trackingEnabled: boolean;      // PostHog events on/off (default true)
}
```

### 4.3 Promo extension (additive only)

Add an optional field to existing `PromoConditions` in `lib/modules/promo/types.ts`:

```ts
interface PromoConditions {
  // ...existing fields unchanged
  eligibleItems?: {
    itemIds?: string[];
    categoryIds?: string[];
  };
}
```

**Behavior:** absent or empty = promo applies to whole cart (today's behavior, fully preserved). When populated, the campaigns module reads this to render an eligible-products list when a banner targets the promo. This field is forward-compatible with future POS UI (e.g. "this item qualifies for X promo" badges in checkout).

### 4.4 Banner image specs

- **Aspect ratio:** per-banner choice between `3:2` (default, card-friendly) and `3:1` (wide hero). Enforced via CSS `aspect-ratio` on the shared `<BannerImage />` component.
- **Recommended minimum:** 1200 × 800 px (3:2) or 1500 × 500 px (3:1). Warn but do not block smaller uploads.
- **Max file size:** 2 MB
- **Formats:** JPG, PNG, WebP
- **Storage path:** `sites/{siteId}/campaigns/banners/{bannerId}.{ext}` via Firebase Storage
- **Upload component:** reuse existing `MultiImageUpload` (single-image mode). Aspect-ratio guide overlay updates based on the banner's `aspectRatio` value.

**Rendering model:** card strip is the default everywhere; hero is opt-in on the Canvas Studio block only.

| Surface | Default | Hero option | Notes |
| --- | --- | --- | --- |
| POS strip | Strip (3:2 cards) | ❌ no | Always strip — POS is too cramped for a hero above the menu grid |
| Site block | Strip (3:2 cards) | ✅ yes | Block config picks `'strip'` or `'hero'`; hero supports 3:1 banners + auto-rotate |
| Link-in-bio | Full-width card | ❌ no | Column is naturally narrow (~380 px), no hero needed |

**Card strip — count per surface and viewport:**

| Surface | Mobile (<640px) | Tablet (640–1024px) | Desktop (>1024px) |
| --- | --- | --- | --- |
| POS strip | 2 cards visible + scroll | 3 cards | 3 cards |
| Site block (strip) | scroll | 2 cards | 3 cards |
| Link-in-bio | full-width card | full-width card | full-width card |

**Hero (Canvas Studio block only):** one banner at a time, full container width up to `max-width: 960px`, auto-rotates through active banners with a configurable interval. Tenant should upload banners with `aspectRatio: '3:1'` for hero layout; `3:2` banners are letterboxed if used in hero.

### 4.5 Path constants

`lib/modules/campaigns/constants.ts`:

```ts
export const BANNERS_COLLECTION = 'modules/campaigns/banners';
export const SETTINGS_DOC = 'modules/campaigns/settings/config';
export const BANNER_IMAGE_PATH = 'campaigns/banners'; // under sites/{siteId}/
```

Always used via these constants; never inline strings.

---

## 5. Public API Facade — `lib/modules/campaigns/api.ts`

The only entry point other modules use.

### Settings
- `getCampaignsSettings(siteId): Promise<CampaignsSettings>`
- `updateCampaignsSettings(siteId, patch): Promise<void>`

### Banner CRUD (admin)
- `listBanners(siteId, opts?: { status?; placement? }): Promise<Banner[]>`
- `getBanner(siteId, bannerId): Promise<Banner | null>`
- `createBanner(siteId, data): Promise<Banner>`
- `updateBanner(siteId, bannerId, patch): Promise<void>`
- `setBannerStatus(siteId, bannerId, status): Promise<void>`
- `reorderBanners(siteId, orderedIds): Promise<void>` — bulk priority update
- `deleteBanner(siteId, bannerId): Promise<void>` — archived only

### Banner queries (public renderers)
- `getActiveBanners(siteId, placement: BannerPlacement): Promise<Banner[]>`
  - Filters: `status === 'active'`, `(startAt == null || startAt <= now)`, `(endAt == null || endAt >= now)`, `placements array-contains placement`
  - Sorted by `priority` ascending
  - Single function every renderer calls

### Promo resolution
- `resolvePromoTarget(siteId, promoId): Promise<{ promo: Promo; eligibleProducts: MenuItem[] }>`
  - Reads promo via promo facade, queries POS menu items via byod_pos facade for matching `itemIds` + items in `categoryIds`. Returns combined view-model.
  - If `eligibleItems` is empty or absent → `eligibleProducts: []` (UI renders "applies to whole cart").

### Tracking
- `trackBannerImpression(siteId, bannerId, placement): Promise<void>`
- `trackBannerClick(siteId, bannerId, placement, targetType): Promise<void>`
- Both: PostHog event + Firestore `increment(1)` on counter. Guarded by `settings.trackingEnabled`.

### Rules
- All functions guard `siteId !== 'default' && siteId !== 'pending'`.
- Writes strip `undefined` via `JSON.parse(JSON.stringify(...))` (Firestore rejects undefined).
- `resolvePromoTarget` is the ONE place that touches both `promo/api` and `byod_pos/api`. No other campaigns code reaches across modules.

---

## 6. Admin UI

### 6.1 Routes (3, all under campaigns module)

| Path | Component key | Component | Purpose |
|---|---|---|---|
| `/admin/campaigns` | `campaigns:CampaignsList` | `CampaignsListClient` | Table view: thumbnail, title, placements (chips), target summary, schedule, status, impressions/clicks. Drag-handle reorder. "+ New banner" button. |
| `/admin/campaigns/new` | `campaigns:CampaignEditor` | `CampaignEditorClient` | Create form. |
| `/admin/campaigns/[id]` | `campaigns:CampaignEditor` | `CampaignEditorClient` | Edit form. Same component, branches on route param. |
| `/admin/campaigns/settings` | `campaigns:CampaignsSettings` | `CampaignsSettingsPage` | The 3 settings fields. Static page (bypasses ModuleLoader, like POS settings). |

### 6.2 Editor form fields

- Image upload (uses existing `MultiImageUpload` with `BANNER_IMAGE_PATH`)
- Title (required, admin label)
- Alt text (optional, a11y + fallback)
- Target type radio: Promo / Page / External URL / None
  - **Promo selected:** searchable dropdown of promos (`listPromos`). Helper note: *"This banner will show eligible items based on the Promo's eligibleItems setting. Edit the promo to manage which items qualify."* with link to `/admin/promo/{promoId}`.
  - **Page selected:** dropdown of tenant's custom pages.
  - **External selected:** URL input with validation (http/https only).
  - **None selected:** no extra field.
- Placements (multi-select chips): POS, Site Block, Link-in-bio
- Schedule: start date (optional), end date (optional)
- Status: draft / active / paused / archived

### 6.3 RBAC

- New permission key: `manage_campaigns`
- Default role mapping: owner ✓, admin ✓, editor ✓ (campaigns are content), staff ✗
- `CampaignEditorClient` reads `usePermission().isViewOnly` to disable writes
- All write API functions check the permission server-side (where applicable in client SDK pattern: rules + `getCanEdit` gate before action)

---

## 7. Public Renderers

All three call `getActiveBanners(siteId, placement)` and share the same click handler.

### 7.1 `<POSBannerStrip />`
- Used by: `byod_pos` `POSWidget` (rendered above category tabs, matching wireframe)
- Layout: horizontal scrollable strip, cap to `settings.posBannerMaxCount`
- Tap behavior:
  - target.type === 'promo' → open `<PromoBannerSheet />` (bottom sheet)
  - target.type === 'page' → `router.push('/' + pageSlug)`
  - target.type === 'external' → `window.open(url, '_blank', 'noopener')`
  - target.type === 'none' → no-op
- Impression tracking: fires once per banner per render lifecycle (dedupe via `Set<bannerId>` ref)

### 7.2 `<BannerBlock />` (Canvas Studio block)

- New block type `banner` in the Canvas Studio block system
- Two layout variants, tenant picks per block instance:
  - `layout: 'strip'` (default) — horizontal card row. 3 on desktop, 2 on tablet, scroll on mobile. Each card 3:2.
  - `layout: 'hero'` — single banner full-container-width, `max-width: 960px`, auto-rotates if multiple active banners. Best paired with banners that have `aspectRatio: '3:1'`.
- Block config:
  - `{ layout: 'strip' \| 'hero'; maxBanners: number; rotationIntervalMs?: number }`
  - `rotationIntervalMs` applies only to `layout: 'hero'`. Default 6000.
  - `maxBanners` caps how many active banners render. Default 6 for strip, 5 for hero.
- Server-rendered via `api-server.ts` for SSR (reads active banners via admin SDK).
- Tap behavior:
  - target.type === 'promo' → `router.push('/promo/' + promoId)` (dedicated page)
  - target.type === 'page' → `router.push('/' + pageSlug)`
  - target.type === 'external' → `window.open(url, '_blank', 'noopener')`
  - target.type === 'none' → no-op

### 7.3 `<LinkBannerItem />`
- Used by: Link-in-bio (Links page renderer)
- Appears as a banner item interleaved with link items
- Same tap behavior as `<BannerCarouselBlock />` (navigation context, no bottom sheet)

### 7.4 Shared click-result UIs

**`<PromoBannerSheet />`** — bottom sheet/slide-over
- z-index 40 (per [feedback_slideover_zindex.md] — below sidebar)
- Reads `resolvePromoTarget(siteId, promoId)`
- Shows: banner image hero, promo name + description, terms (min subtotal, validity window, conditions), eligible items grid with "Add" buttons that call into POS cart context
- Footer: "View full details" → `/promo/{promoId}`
- If `eligibleProducts.length === 0` → shows "This promo applies to your whole order" with "Apply promo" button that triggers `evaluatePromo` on current cart

**`app/promo/[promoId]/page.tsx`** — public dedicated page (SSR)
- Used by Site block + Link-in-bio
- Hero: if any active banner targets this promo, use that banner's image; otherwise render a text-only hero with promo name. Promo description, terms, eligible items grid follow.
- Per-item "Order now" CTA → opens POS with item pre-selected (if POS enabled for site)
- Path uses `promoId` directly (no separate slug field needed for v1; can add slug later)

---

## 8. Tracking

Reuses existing PostHog integration ([project_posthog_integration.md]).

**Events:**
- `campaign_banner_impression` — payload: `{ siteId, bannerId, placement }`
- `campaign_banner_click` — payload: `{ siteId, bannerId, placement, targetType }`

**Dedup:** impression fires once per banner per page-view (client-side `Set<bannerId>`).

**Counters:** Firestore `increment(1)` on `impressionCount`/`clickCount`. Eventually consistent, used for admin list display only. PostHog is the source of truth.

**Admin display:** list view shows counter values. "View analytics" link points to PostHog dashboard URL.

---

## 9. Module Registration

Three-way parity (platform definitions + components + backyard mirror), per the standard module pattern.

### 9.1 Platform `lib/modules/definitions.ts`

```ts
STATIC_MODULE_DEFINITIONS['campaigns'] = {
  id: 'campaigns',
  displayName: 'Campaigns',
  description: 'Banners and promotional campaigns across POS, site, and links',
  icon: 'megaphone',
  adminRoutes: [
    { label: 'Campaigns', path: '/admin/campaigns', icon: 'megaphone',
      componentKey: 'campaigns:CampaignsList' },
    { label: 'New / Edit', path: '/admin/campaigns/[id]', icon: 'megaphone',
      componentKey: 'campaigns:CampaignEditor', hidden: true },
    { label: 'Settings', path: '/admin/campaigns/settings', icon: 'settings',
      componentKey: 'campaigns:CampaignsSettings', permission: 'manage_campaigns' },
  ],
};
```

### 9.2 `lib/modules/components.tsx`
Dynamic imports + `MODULE_COMPONENTS` entries for the 3 admin component keys.

### 9.3 `lib/modules/client-registry.tsx`
Register `BannerCarouselBlock` for Canvas Studio block system.

### 9.4 Canvas Studio block registry
Register new `banner` block type (Form + Renderer, follows existing block pattern). Block config: `{ layout: 'strip' | 'hero'; maxBanners: number; rotationIntervalMs?: number }`.

### 9.5 `dev/backyard/lib/modules/definitions.ts`
Mirror with displayName + description.

### 9.6 `scripts/seed-modules.ts`
Add `campaigns` entry.

### 9.7 Static pages
- `app/admin/(dashboard)/campaigns/settings/page.tsx` → imports `CampaignsSettingsPage`

### 9.8 Per-tenant enable flag
`sites/{siteId}.modules.campaigns = true` enables the module in sidebar.

---

## 10. File Layout

```
lib/modules/campaigns/
  types.ts              — Banner, BannerTarget, BannerPlacement, CampaignsSettings
  constants.ts          — BANNERS_COLLECTION, SETTINGS_DOC, BANNER_IMAGE_PATH
  api.ts                — public facade (client SDK)
  api-admin.ts          — Firebase Admin SDK (SSR for site block)
  api-server.ts         — SSR utility (admin SDK + promo/POS resolve)
  api/                  — internal split (similar to promo module)
    banners.ts
    settings.ts
    queries.ts          — getActiveBanners, resolvePromoTarget
    tracking.ts
  admin/
    CampaignsListClient.tsx
    CampaignEditorClient.tsx
    CampaignsSettingsPage.tsx
    components/
      BannerForm.tsx
      TargetPicker.tsx
      PlacementChips.tsx
      ScheduleFields.tsx
  components/
    POSBannerStrip.tsx        — used by byod_pos (strip-only)
    BannerBlock.tsx           — Canvas Studio block renderer (delegates to BannerStrip or BannerHero based on config)
    BannerStrip.tsx           — horizontal card row variant
    BannerHero.tsx            — single-banner auto-rotating hero variant
    LinkBannerItem.tsx        — Links page renderer (full-width card)
    PromoBannerSheet.tsx      — shared bottom sheet for POS taps
    BannerImage.tsx           — shared image + alt fallback (reads banner.aspectRatio)
  hooks/
    useImpressionTracker.ts   — dedup'd impression firing
    useHeroRotation.ts        — auto-rotate timing for hero layout

lib/blocks/banner/
  form.tsx                  — block config form (layout, maxBanners, rotationIntervalMs)
  renderer.tsx              — thin wrapper around <BannerBlock />

app/admin/(dashboard)/campaigns/settings/page.tsx  — static page
app/promo/[promoId]/page.tsx                       — public promo detail page
```

---

## 11. Critical Rules

- Cross-module imports limited to `@/lib/modules/promo/api` and `@/lib/modules/byod_pos/api` from `campaigns` only. No reverse imports.
- All admin screen components MUST have `'use client'` at top.
- `siteId` from `useSite()` only — never hardcoded.
- Path constants from `constants.ts` only.
- `updateBanner` / `updateCampaignsSettings` strip undefined before write.
- Image uploads to `sites/{siteId}/campaigns/banners/` Firebase Storage.
- Impression dedup uses ref-based `Set<bannerId>` per render lifecycle.
- `sites/{siteId}.modules.campaigns = true` required for module to appear in sidebar.
- PostHog tracking respects `settings.trackingEnabled`.

---

## 12. Open Questions / Deferred

- **Audience targeting** (members/non-members/tier) — deferred to v2. Requires auth state in render path.
- **Device targeting** (mobile/desktop) — deferred to v2.
- **Email banners** — deferred. Touches Resend templates.
- **Banner A/B testing** — deferred. PostHog supports it but adds UX complexity.
- **Promo slug** — for v1, `/promo/[promoId]`. May add `slug` field to Promo later for cleaner URLs.
- **Carousel auto-rotate** — included in v1 block config. Can be left off by default if it becomes intrusive.
