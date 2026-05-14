# Campaigns Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a new opt-in `campaigns` module that lets tenants create, schedule, and place promotional banners across POS, the Canvas Studio block system, and Link-in-bio — with optional links to Promos, Pages, or external URLs.

**Architecture:** New module under `lib/modules/campaigns/` with strict facade boundary; sanctioned cross-module imports from `@/lib/modules/promo/api` and `@/lib/modules/byod_pos/api`. One additive field added to `PromoConditions`. Shared rendering primitives (`<BannerImage />`, `<BannerStrip />`, `<BannerHero />`) consumed by three surface-specific entry components. Standard module registration (three-way parity: platform definitions + components + backyard mirror). Tracking via existing `useAnalytics` PostHog wrapper. Canvas Studio block follows the existing pattern at `components/blocks/<type>/` + `components/admin/blocks/forms/<Type>Form.tsx`.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Firestore (client + admin SDK), Firebase Storage, PostHog, Tailwind, Vitest, lucide-react.

**Spec:** `dev/superpowers/specs/2026-05-14-campaigns-module-design.md`

---

## File Structure

### New files

```
clicker-platform-v2/
  lib/modules/campaigns/
    types.ts                                — Banner, BannerTarget, BannerPlacement, CampaignsSettings, defaults
    constants.ts                            — BANNERS_COLLECTION, SETTINGS_DOC, BANNER_IMAGE_PATH, DEFAULT_CAMPAIGNS_SETTINGS
    api.ts                                  — public client facade (re-exports from api/*)
    api-admin.ts                            — Firebase Admin SDK queries (SSR)
    api-server.ts                           — SSR utility used by the Canvas Studio block server renderer
    api/
      banners.ts                            — CRUD: list/get/create/update/setStatus/reorder/delete
      settings.ts                           — get/update settings (with strip-undefined)
      queries.ts                            — getActiveBanners, resolvePromoTarget
      tracking.ts                           — trackBannerImpression, trackBannerClick (counters + PostHog)
    admin/
      CampaignsListClient.tsx               — table + drag-reorder + filters
      CampaignEditorClient.tsx              — banner create/edit form host
      CampaignsSettingsPage.tsx             — settings form (static page consumer)
      components/
        BannerForm.tsx                      — the form body
        TargetPicker.tsx                    — radio + conditional sub-field (promo/page/external/none)
        PlacementChips.tsx                  — multi-select for pos/site_block/links
        ScheduleFields.tsx                  — start/end date pickers
        AspectRatioToggle.tsx               — 3:2 vs 3:1
    components/
      BannerImage.tsx                       — shared image renderer (reads banner.aspectRatio)
      BannerStrip.tsx                       — horizontal card strip
      BannerHero.tsx                        — single-banner auto-rotating hero
      POSBannerStrip.tsx                    — surface entry for byod_pos (strip-only)
      LinkBannerItem.tsx                    — surface entry for link-in-bio
      PromoBannerSheet.tsx                  — bottom sheet shown on POS promo banner tap
    hooks/
      useImpressionTracker.ts               — dedup'd impression firing
      useHeroRotation.ts                    — interval rotation state for hero layout
    __tests__/
      types.test.ts                         — type guards / discriminator helpers
      api-banners.test.ts                   — CRUD with Firestore mock
      api-queries.test.ts                   — getActiveBanners filters + sort + resolvePromoTarget
      api-tracking.test.ts                  — increment + PostHog wiring
      BannerStrip.test.tsx                  — render strip variant
      BannerHero.test.tsx                   — rotation hook + render
      PromoBannerSheet.test.tsx             — empty / non-empty eligible products
      useImpressionTracker.test.tsx         — dedup behavior

  components/blocks/banner/
    types.ts                                — BannerBlockData (layout, maxBanners, rotationIntervalMs)
    renderer.tsx                            — BannerBlock — picks strip/hero, fetches active banners via api-server

  components/admin/blocks/forms/
    BannerBlockForm.tsx                     — block config form

  app/admin/(dashboard)/campaigns/
    settings/page.tsx                       — static page imports CampaignsSettingsPage
    new/page.tsx                            — static page imports CampaignEditorClient (create mode)
    [id]/page.tsx                           — static page imports CampaignEditorClient (edit mode)
    page.tsx                                — static page imports CampaignsListClient

  app/promo/[promoId]/
    page.tsx                                — public SSR promo detail page (banner hero + eligible items)
```

### Files to modify

```
clicker-platform-v2/
  lib/modules/promo/types.ts                — extend PromoConditions with optional eligibleItems
  lib/modules/definitions.ts                — register 'campaigns' STATIC_MODULE_DEFINITIONS
  lib/modules/components.tsx                — dynamic imports + MODULE_COMPONENTS entries
  lib/modules/client-registry.tsx           — if needed for Canvas Studio block client renderer
  scripts/seed-modules.ts                   — add campaigns entry
  components/admin/blocks/blockDefinitions.ts        — add 'banner' BlockType option + default data
  components/admin/blocks/BlockFormRenderer.tsx      — wire BannerBlockForm
  components/blocks/BlockRenderer.tsx                — add 'banner' case → render BannerBlock
  data/mockData.ts                          — extend BlockType union with 'banner'
  lib/modules/byod_pos/components/POSWidget.tsx     — render <POSBannerStrip /> above category tabs

backyard/
  lib/modules/definitions.ts                — mirror campaigns module entry (displayName + description)
```

---

## Phase 1 — Foundation: Promo extension + Campaigns types + constants

### Task 1: Extend PromoConditions with eligibleItems

**Files:**
- Modify: `clicker-platform-v2/lib/modules/promo/types.ts:11-18`
- Test: `clicker-platform-v2/lib/modules/promo/__tests__/types-eligibleItems.test.ts`

- [ ] **Step 1: Write the failing test**

Create `clicker-platform-v2/lib/modules/promo/__tests__/types-eligibleItems.test.ts`:

```typescript
import { describe, it, expectTypeOf } from 'vitest';
import type { PromoConditions } from '../types';

describe('PromoConditions.eligibleItems', () => {
    it('accepts a conditions object without eligibleItems (backwards compatible)', () => {
        const c: PromoConditions = {
            eligibleSources: [],
            audience: 'public',
        };
        // type-check is the test
        expectTypeOf(c).toMatchTypeOf<PromoConditions>();
    });

    it('accepts eligibleItems with itemIds, categoryIds, or both', () => {
        const a: PromoConditions = { eligibleSources: [], audience: 'public', eligibleItems: { itemIds: ['x'] } };
        const b: PromoConditions = { eligibleSources: [], audience: 'public', eligibleItems: { categoryIds: ['c'] } };
        const c: PromoConditions = { eligibleSources: [], audience: 'public', eligibleItems: { itemIds: ['x'], categoryIds: ['c'] } };
        expectTypeOf(a).toMatchTypeOf<PromoConditions>();
        expectTypeOf(b).toMatchTypeOf<PromoConditions>();
        expectTypeOf(c).toMatchTypeOf<PromoConditions>();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd clicker-platform-v2 && pnpm test lib/modules/promo/__tests__/types-eligibleItems.test.ts`
Expected: FAIL (`eligibleItems` not in `PromoConditions`)

- [ ] **Step 3: Add the field to PromoConditions**

In `clicker-platform-v2/lib/modules/promo/types.ts`, locate the existing `PromoConditions` interface and add the optional field as the last property:

```typescript
export interface PromoConditions {
  minSubtotal?: number;
  validFrom?: Timestamp;
  validUntil?: Timestamp;
  eligibleSources: PromoSource[]; // empty array = all sources eligible
  audience: PromoAudience;
  specificMemberIds?: string[];
  eligibleItems?: {
    itemIds?: string[];
    categoryIds?: string[];
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd clicker-platform-v2 && pnpm test lib/modules/promo/__tests__/types-eligibleItems.test.ts`
Expected: PASS

- [ ] **Step 5: Type-check the whole platform**

Run: `cd clicker-platform-v2 && pnpm lint`
Expected: no new errors introduced by this change.

- [ ] **Step 6: Commit**

```bash
git add clicker-platform-v2/lib/modules/promo/types.ts clicker-platform-v2/lib/modules/promo/__tests__/types-eligibleItems.test.ts
git commit -m "feat(promo): add optional eligibleItems to PromoConditions"
```

---

### Task 2: Campaigns module types

**Files:**
- Create: `clicker-platform-v2/lib/modules/campaigns/types.ts`
- Test: `clicker-platform-v2/lib/modules/campaigns/__tests__/types.test.ts`

- [ ] **Step 1: Write the failing test**

Create `clicker-platform-v2/lib/modules/campaigns/__tests__/types.test.ts`:

```typescript
import { describe, it, expect, expectTypeOf } from 'vitest';
import type { Banner, BannerTarget, BannerPlacement, CampaignsSettings } from '../types';
import { isPromoTarget, isPageTarget, isExternalTarget, isNoneTarget } from '../types';

describe('campaigns types', () => {
    it('BannerPlacement union', () => {
        const valid: BannerPlacement[] = ['pos', 'site_block', 'links'];
        expectTypeOf(valid).toMatchTypeOf<BannerPlacement[]>();
    });

    it('BannerTarget discriminated union has 4 variants', () => {
        const a: BannerTarget = { type: 'promo', promoId: 'p1' };
        const b: BannerTarget = { type: 'page', pageSlug: 'about' };
        const c: BannerTarget = { type: 'external', url: 'https://example.com' };
        const d: BannerTarget = { type: 'none' };
        expectTypeOf([a, b, c, d]).toMatchTypeOf<BannerTarget[]>();
    });

    it('isPromoTarget narrows correctly', () => {
        const t: BannerTarget = { type: 'promo', promoId: 'p1' };
        expect(isPromoTarget(t)).toBe(true);
        if (isPromoTarget(t)) expect(t.promoId).toBe('p1');
    });

    it('isPageTarget / isExternalTarget / isNoneTarget narrow correctly', () => {
        expect(isPageTarget({ type: 'page', pageSlug: 's' })).toBe(true);
        expect(isExternalTarget({ type: 'external', url: 'x' })).toBe(true);
        expect(isNoneTarget({ type: 'none' })).toBe(true);
        expect(isPromoTarget({ type: 'none' })).toBe(false);
    });

    it('CampaignsSettings shape', () => {
        const s: CampaignsSettings = { posBannerEnabled: true, posBannerMaxCount: 3, trackingEnabled: true };
        expectTypeOf(s).toMatchTypeOf<CampaignsSettings>();
    });

    it('Banner aspectRatio is 3:2 or 3:1', () => {
        const b: Banner = {
            id: 'b1', siteId: 's1', title: 't', image: 'u', aspectRatio: '3:2',
            target: { type: 'none' }, placements: ['pos'],
            status: 'draft', priority: 100,
            impressionCount: 0, clickCount: 0,
            createdAt: { seconds: 0, nanoseconds: 0 } as any,
            updatedAt: { seconds: 0, nanoseconds: 0 } as any,
        };
        expectTypeOf(b).toMatchTypeOf<Banner>();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd clicker-platform-v2 && pnpm test lib/modules/campaigns/__tests__/types.test.ts`
Expected: FAIL (module does not exist).

- [ ] **Step 3: Create the types file**

Create `clicker-platform-v2/lib/modules/campaigns/types.ts`:

```typescript
import { Timestamp } from 'firebase/firestore';

export type BannerPlacement = 'pos' | 'site_block' | 'links';

export type BannerTarget =
    | { type: 'promo'; promoId: string }
    | { type: 'page'; pageSlug: string }
    | { type: 'external'; url: string }
    | { type: 'none' };

export type BannerStatus = 'draft' | 'active' | 'paused' | 'archived';
export type BannerAspectRatio = '3:2' | '3:1';

export interface Banner {
    id: string;
    siteId: string;

    title: string;
    image: string;
    altText?: string;
    aspectRatio: BannerAspectRatio;

    target: BannerTarget;
    placements: BannerPlacement[];

    status: BannerStatus;
    startAt?: Timestamp;
    endAt?: Timestamp;
    priority: number;

    impressionCount: number;
    clickCount: number;

    createdAt: Timestamp;
    updatedAt: Timestamp;
}

export interface CampaignsSettings {
    posBannerEnabled: boolean;
    posBannerMaxCount: number;
    trackingEnabled: boolean;
}

export function isPromoTarget(t: BannerTarget): t is Extract<BannerTarget, { type: 'promo' }> {
    return t.type === 'promo';
}
export function isPageTarget(t: BannerTarget): t is Extract<BannerTarget, { type: 'page' }> {
    return t.type === 'page';
}
export function isExternalTarget(t: BannerTarget): t is Extract<BannerTarget, { type: 'external' }> {
    return t.type === 'external';
}
export function isNoneTarget(t: BannerTarget): t is Extract<BannerTarget, { type: 'none' }> {
    return t.type === 'none';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd clicker-platform-v2 && pnpm test lib/modules/campaigns/__tests__/types.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add clicker-platform-v2/lib/modules/campaigns/types.ts clicker-platform-v2/lib/modules/campaigns/__tests__/types.test.ts
git commit -m "feat(campaigns): module types — Banner, BannerTarget, placements, settings"
```

---

### Task 3: Campaigns constants

**Files:**
- Create: `clicker-platform-v2/lib/modules/campaigns/constants.ts`
- Test: `clicker-platform-v2/lib/modules/campaigns/__tests__/constants.test.ts`

- [ ] **Step 1: Write the failing test**

Create `clicker-platform-v2/lib/modules/campaigns/__tests__/constants.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { BANNERS_COLLECTION, SETTINGS_DOC, BANNER_IMAGE_PATH, DEFAULT_CAMPAIGNS_SETTINGS } from '../constants';

describe('campaigns constants', () => {
    it('Firestore paths are correctly namespaced under modules/campaigns', () => {
        expect(BANNERS_COLLECTION).toBe('modules/campaigns/banners');
        expect(SETTINGS_DOC).toBe('modules/campaigns/settings/config');
    });

    it('Storage path is namespaced for image uploads', () => {
        expect(BANNER_IMAGE_PATH).toBe('campaigns/banners');
    });

    it('Default settings enable POS banners with sensible cap and tracking on', () => {
        expect(DEFAULT_CAMPAIGNS_SETTINGS).toEqual({
            posBannerEnabled: true,
            posBannerMaxCount: 3,
            trackingEnabled: true,
        });
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd clicker-platform-v2 && pnpm test lib/modules/campaigns/__tests__/constants.test.ts`
Expected: FAIL (file not found)

- [ ] **Step 3: Create the constants file**

Create `clicker-platform-v2/lib/modules/campaigns/constants.ts`:

```typescript
import type { CampaignsSettings } from './types';

export const BANNERS_COLLECTION = 'modules/campaigns/banners';
export const SETTINGS_DOC = 'modules/campaigns/settings/config';
export const BANNER_IMAGE_PATH = 'campaigns/banners';

export const DEFAULT_CAMPAIGNS_SETTINGS: CampaignsSettings = {
    posBannerEnabled: true,
    posBannerMaxCount: 3,
    trackingEnabled: true,
};

export const DEFAULT_BANNER_PRIORITY = 100;
export const HERO_MAX_WIDTH_PX = 960;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd clicker-platform-v2 && pnpm test lib/modules/campaigns/__tests__/constants.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add clicker-platform-v2/lib/modules/campaigns/constants.ts clicker-platform-v2/lib/modules/campaigns/__tests__/constants.test.ts
git commit -m "feat(campaigns): module constants (paths, defaults)"
```

---

## Phase 2 — Data API: settings + banner CRUD + queries + tracking

### Task 4: Settings API (get / update)

**Files:**
- Create: `clicker-platform-v2/lib/modules/campaigns/api/settings.ts`
- Test: `clicker-platform-v2/lib/modules/campaigns/__tests__/api-settings.test.ts`

- [ ] **Step 1: Write the failing test**

Create `clicker-platform-v2/lib/modules/campaigns/__tests__/api-settings.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
    doc: vi.fn((...args) => ({ _path: args })),
    getDoc: vi.fn(),
    setDoc: vi.fn(async () => {}),
    serverTimestamp: vi.fn(() => 'server-ts'),
}));

import { getDoc, setDoc } from 'firebase/firestore';
import { getCampaignsSettings, updateCampaignsSettings } from '../api/settings';
import { DEFAULT_CAMPAIGNS_SETTINGS } from '../constants';

describe('settings api', () => {
    beforeEach(() => vi.clearAllMocks());

    it('returns defaults when no settings doc exists', async () => {
        (getDoc as any).mockResolvedValueOnce({ exists: () => false });
        const result = await getCampaignsSettings('site1');
        expect(result).toEqual(DEFAULT_CAMPAIGNS_SETTINGS);
    });

    it('returns stored settings merged with defaults', async () => {
        (getDoc as any).mockResolvedValueOnce({ exists: () => true, data: () => ({ posBannerMaxCount: 5 }) });
        const result = await getCampaignsSettings('site1');
        expect(result.posBannerMaxCount).toBe(5);
        expect(result.posBannerEnabled).toBe(true); // default
    });

    it('returns defaults for unhydrated siteIds without reading Firestore', async () => {
        const a = await getCampaignsSettings('default');
        const b = await getCampaignsSettings('pending');
        expect(a).toEqual(DEFAULT_CAMPAIGNS_SETTINGS);
        expect(b).toEqual(DEFAULT_CAMPAIGNS_SETTINGS);
        expect(getDoc).not.toHaveBeenCalled();
    });

    it('strips undefined values before writing', async () => {
        await updateCampaignsSettings('site1', { posBannerMaxCount: 4, posBannerEnabled: undefined as any });
        expect(setDoc).toHaveBeenCalledTimes(1);
        const payload = (setDoc as any).mock.calls[0][1];
        expect(payload).not.toHaveProperty('posBannerEnabled');
        expect(payload.posBannerMaxCount).toBe(4);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd clicker-platform-v2 && pnpm test lib/modules/campaigns/__tests__/api-settings.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Create the settings API**

Create `clicker-platform-v2/lib/modules/campaigns/api/settings.ts`:

```typescript
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { CampaignsSettings } from '../types';
import { SETTINGS_DOC, DEFAULT_CAMPAIGNS_SETTINGS } from '../constants';

function isUnhydratedSiteId(siteId: string): boolean {
    return !siteId || siteId === 'default' || siteId === 'pending';
}

export async function getCampaignsSettings(siteId: string): Promise<CampaignsSettings> {
    if (isUnhydratedSiteId(siteId)) return DEFAULT_CAMPAIGNS_SETTINGS;
    const ref = doc(db, 'sites', siteId, SETTINGS_DOC);
    const snap = await getDoc(ref);
    if (!snap.exists()) return DEFAULT_CAMPAIGNS_SETTINGS;
    return { ...DEFAULT_CAMPAIGNS_SETTINGS, ...(snap.data() as Partial<CampaignsSettings>) };
}

export async function updateCampaignsSettings(siteId: string, patch: Partial<CampaignsSettings>): Promise<void> {
    if (isUnhydratedSiteId(siteId)) return;
    const cleaned = JSON.parse(JSON.stringify(patch));
    const ref = doc(db, 'sites', siteId, SETTINGS_DOC);
    await setDoc(ref, { ...cleaned, updatedAt: serverTimestamp() }, { merge: true });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd clicker-platform-v2 && pnpm test lib/modules/campaigns/__tests__/api-settings.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add clicker-platform-v2/lib/modules/campaigns/api/settings.ts clicker-platform-v2/lib/modules/campaigns/__tests__/api-settings.test.ts
git commit -m "feat(campaigns): settings api with default merge and undefined strip"
```

---

### Task 5: Banner CRUD API

**Files:**
- Create: `clicker-platform-v2/lib/modules/campaigns/api/banners.ts`
- Test: `clicker-platform-v2/lib/modules/campaigns/__tests__/api-banners.test.ts`

- [ ] **Step 1: Write the failing test**

Create `clicker-platform-v2/lib/modules/campaigns/__tests__/api-banners.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
    collection: vi.fn((...args) => ({ _coll: args })),
    doc: vi.fn((...args) => ({ _doc: args })),
    addDoc: vi.fn(async () => ({ id: 'new-id' })),
    setDoc: vi.fn(async () => {}),
    updateDoc: vi.fn(async () => {}),
    deleteDoc: vi.fn(async () => {}),
    getDoc: vi.fn(),
    getDocs: vi.fn(),
    writeBatch: vi.fn(() => ({ update: vi.fn(), commit: vi.fn(async () => {}) })),
    serverTimestamp: vi.fn(() => 'server-ts'),
    Timestamp: { now: () => ({ seconds: 1, nanoseconds: 0 }) },
    query: vi.fn((coll) => coll),
    where: vi.fn((...args) => ({ where: args })),
    orderBy: vi.fn((...args) => ({ orderBy: args })),
}));

import { addDoc, updateDoc, deleteDoc, getDoc, getDocs, writeBatch } from 'firebase/firestore';
import {
    listBanners,
    getBanner,
    createBanner,
    updateBanner,
    setBannerStatus,
    reorderBanners,
    deleteBanner,
} from '../api/banners';

describe('banner crud', () => {
    beforeEach(() => vi.clearAllMocks());

    it('createBanner sets initial counters and timestamps', async () => {
        await createBanner('s1', {
            title: 't', image: 'u', aspectRatio: '3:2',
            target: { type: 'none' }, placements: ['pos'],
            status: 'draft',
        });
        const payload = (addDoc as any).mock.calls[0][1];
        expect(payload.impressionCount).toBe(0);
        expect(payload.clickCount).toBe(0);
        expect(payload.priority).toBeTypeOf('number');
        expect(payload.createdAt).toBe('server-ts');
        expect(payload.updatedAt).toBe('server-ts');
        expect(payload.siteId).toBe('s1');
    });

    it('updateBanner strips undefined and sets updatedAt', async () => {
        await updateBanner('s1', 'b1', { title: 'new', altText: undefined as any });
        const payload = (updateDoc as any).mock.calls[0][1];
        expect(payload).not.toHaveProperty('altText');
        expect(payload.title).toBe('new');
        expect(payload.updatedAt).toBe('server-ts');
    });

    it('setBannerStatus is a thin wrapper over updateBanner', async () => {
        await setBannerStatus('s1', 'b1', 'active');
        const payload = (updateDoc as any).mock.calls[0][1];
        expect(payload.status).toBe('active');
    });

    it('deleteBanner refuses to delete a non-archived banner', async () => {
        (getDoc as any).mockResolvedValueOnce({ exists: () => true, data: () => ({ status: 'active' }) });
        await expect(deleteBanner('s1', 'b1')).rejects.toThrow(/archived/);
        expect(deleteDoc).not.toHaveBeenCalled();
    });

    it('deleteBanner deletes an archived banner', async () => {
        (getDoc as any).mockResolvedValueOnce({ exists: () => true, data: () => ({ status: 'archived' }) });
        await deleteBanner('s1', 'b1');
        expect(deleteDoc).toHaveBeenCalledTimes(1);
    });

    it('reorderBanners assigns priorities by array index*10', async () => {
        const batch = { update: vi.fn(), commit: vi.fn(async () => {}) };
        (writeBatch as any).mockReturnValueOnce(batch);
        await reorderBanners('s1', ['b1', 'b2', 'b3']);
        expect(batch.update).toHaveBeenCalledTimes(3);
        expect((batch.update as any).mock.calls[0][1].priority).toBe(0);
        expect((batch.update as any).mock.calls[1][1].priority).toBe(10);
        expect((batch.update as any).mock.calls[2][1].priority).toBe(20);
        expect(batch.commit).toHaveBeenCalled();
    });

    it('unhydrated siteIds return safe defaults without firestore', async () => {
        const list = await listBanners('default');
        expect(list).toEqual([]);
        const single = await getBanner('pending', 'b1');
        expect(single).toBeNull();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd clicker-platform-v2 && pnpm test lib/modules/campaigns/__tests__/api-banners.test.ts`
Expected: FAIL

- [ ] **Step 3: Create the banners API**

Create `clicker-platform-v2/lib/modules/campaigns/api/banners.ts`:

```typescript
import {
    collection, doc, addDoc, updateDoc, deleteDoc, getDoc, getDocs,
    query, orderBy, where, writeBatch, serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Banner, BannerStatus, BannerPlacement } from '../types';
import { BANNERS_COLLECTION, DEFAULT_BANNER_PRIORITY } from '../constants';

function isUnhydratedSiteId(siteId: string): boolean {
    return !siteId || siteId === 'default' || siteId === 'pending';
}

function bannersCollection(siteId: string) {
    return collection(db, 'sites', siteId, BANNERS_COLLECTION);
}

function bannerDoc(siteId: string, bannerId: string) {
    return doc(db, 'sites', siteId, BANNERS_COLLECTION, bannerId);
}

type NewBannerInput = Omit<Banner, 'id' | 'siteId' | 'priority' | 'impressionCount' | 'clickCount' | 'createdAt' | 'updatedAt'> & { priority?: number };

export async function listBanners(
    siteId: string,
    opts?: { status?: BannerStatus; placement?: BannerPlacement }
): Promise<Banner[]> {
    if (isUnhydratedSiteId(siteId)) return [];
    let q: any = query(bannersCollection(siteId), orderBy('priority', 'asc'));
    if (opts?.status) q = query(q, where('status', '==', opts.status));
    if (opts?.placement) q = query(q, where('placements', 'array-contains', opts.placement));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Banner, 'id'>) }));
}

export async function getBanner(siteId: string, bannerId: string): Promise<Banner | null> {
    if (isUnhydratedSiteId(siteId)) return null;
    const snap = await getDoc(bannerDoc(siteId, bannerId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...(snap.data() as Omit<Banner, 'id'>) };
}

export async function createBanner(siteId: string, data: NewBannerInput): Promise<Banner> {
    if (isUnhydratedSiteId(siteId)) throw new Error('Cannot create banner for unhydrated siteId');
    const cleaned = JSON.parse(JSON.stringify(data));
    const payload = {
        ...cleaned,
        siteId,
        priority: cleaned.priority ?? DEFAULT_BANNER_PRIORITY,
        impressionCount: 0,
        clickCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    };
    const ref = await addDoc(bannersCollection(siteId), payload);
    return { id: ref.id, ...(payload as any) } as Banner;
}

export async function updateBanner(
    siteId: string,
    bannerId: string,
    patch: Partial<Omit<Banner, 'id' | 'siteId' | 'createdAt'>>
): Promise<void> {
    if (isUnhydratedSiteId(siteId)) return;
    const cleaned = JSON.parse(JSON.stringify(patch));
    await updateDoc(bannerDoc(siteId, bannerId), { ...cleaned, updatedAt: serverTimestamp() });
}

export async function setBannerStatus(siteId: string, bannerId: string, status: BannerStatus): Promise<void> {
    return updateBanner(siteId, bannerId, { status });
}

export async function reorderBanners(siteId: string, orderedIds: string[]): Promise<void> {
    if (isUnhydratedSiteId(siteId)) return;
    const batch = writeBatch(db);
    orderedIds.forEach((id, idx) => {
        batch.update(bannerDoc(siteId, id), { priority: idx * 10, updatedAt: serverTimestamp() });
    });
    await batch.commit();
}

export async function deleteBanner(siteId: string, bannerId: string): Promise<void> {
    if (isUnhydratedSiteId(siteId)) return;
    const existing = await getDoc(bannerDoc(siteId, bannerId));
    if (!existing.exists()) return;
    if ((existing.data() as Banner).status !== 'archived') {
        throw new Error('Only archived banners can be deleted. Archive it first.');
    }
    await deleteDoc(bannerDoc(siteId, bannerId));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd clicker-platform-v2 && pnpm test lib/modules/campaigns/__tests__/api-banners.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add clicker-platform-v2/lib/modules/campaigns/api/banners.ts clicker-platform-v2/lib/modules/campaigns/__tests__/api-banners.test.ts
git commit -m "feat(campaigns): banner CRUD with reorder and archive-only-delete guard"
```

---

### Task 6: getActiveBanners query

**Files:**
- Create: `clicker-platform-v2/lib/modules/campaigns/api/queries.ts`
- Test: `clicker-platform-v2/lib/modules/campaigns/__tests__/api-queries.test.ts`

- [ ] **Step 1: Write the failing test**

Create `clicker-platform-v2/lib/modules/campaigns/__tests__/api-queries.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
    collection: vi.fn(),
    query: vi.fn((c) => c),
    where: vi.fn(),
    orderBy: vi.fn(),
    getDocs: vi.fn(),
    Timestamp: { now: () => ({ toMillis: () => 1000 }), fromMillis: (n: number) => ({ toMillis: () => n }) },
}));

import { getDocs } from 'firebase/firestore';
import { getActiveBanners } from '../api/queries';

const now = 1000;

function tsAt(ms: number) {
    return { toMillis: () => ms } as any;
}

function banner(overrides: any) {
    return {
        id: overrides.id || 'b',
        siteId: 's1',
        title: 't',
        image: 'u',
        aspectRatio: '3:2',
        target: { type: 'none' },
        placements: ['pos'],
        status: 'active',
        priority: 100,
        impressionCount: 0,
        clickCount: 0,
        createdAt: tsAt(0),
        updatedAt: tsAt(0),
        ...overrides,
    };
}

describe('getActiveBanners', () => {
    beforeEach(() => vi.clearAllMocks());

    it('filters out non-active status', async () => {
        (getDocs as any).mockResolvedValueOnce({
            docs: [
                { id: 'a', data: () => banner({ id: 'a', status: 'paused' }) },
                { id: 'b', data: () => banner({ id: 'b', status: 'active' }) },
            ],
        });
        const result = await getActiveBanners('s1', 'pos', now);
        expect(result.map(b => b.id)).toEqual(['b']);
    });

    it('filters out banners outside their date window', async () => {
        (getDocs as any).mockResolvedValueOnce({
            docs: [
                { id: 'past',    data: () => banner({ id: 'past',    endAt: tsAt(500) }) },
                { id: 'future',  data: () => banner({ id: 'future',  startAt: tsAt(2000) }) },
                { id: 'current', data: () => banner({ id: 'current', startAt: tsAt(500), endAt: tsAt(2000) }) },
                { id: 'forever', data: () => banner({ id: 'forever' }) },
            ],
        });
        const result = await getActiveBanners('s1', 'pos', now);
        expect(result.map(b => b.id).sort()).toEqual(['current', 'forever']);
    });

    it('sorts ascending by priority', async () => {
        (getDocs as any).mockResolvedValueOnce({
            docs: [
                { id: 'c', data: () => banner({ id: 'c', priority: 30 }) },
                { id: 'a', data: () => banner({ id: 'a', priority: 10 }) },
                { id: 'b', data: () => banner({ id: 'b', priority: 20 }) },
            ],
        });
        const result = await getActiveBanners('s1', 'pos', now);
        expect(result.map(b => b.id)).toEqual(['a', 'b', 'c']);
    });

    it('returns [] for unhydrated siteId', async () => {
        const result = await getActiveBanners('default', 'pos', now);
        expect(result).toEqual([]);
        expect(getDocs).not.toHaveBeenCalled();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd clicker-platform-v2 && pnpm test lib/modules/campaigns/__tests__/api-queries.test.ts`
Expected: FAIL

- [ ] **Step 3: Create the queries module**

Create `clicker-platform-v2/lib/modules/campaigns/api/queries.ts`:

```typescript
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Banner, BannerPlacement } from '../types';
import { BANNERS_COLLECTION } from '../constants';

function isUnhydratedSiteId(siteId: string): boolean {
    return !siteId || siteId === 'default' || siteId === 'pending';
}

export async function getActiveBanners(
    siteId: string,
    placement: BannerPlacement,
    nowMs: number = Date.now(),
): Promise<Banner[]> {
    if (isUnhydratedSiteId(siteId)) return [];

    const coll = collection(db, 'sites', siteId, BANNERS_COLLECTION);
    const q = query(
        coll,
        where('status', '==', 'active'),
        where('placements', 'array-contains', placement),
        orderBy('priority', 'asc'),
    );
    const snap = await getDocs(q);
    const all = snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Banner, 'id'>) }));

    return all.filter(b => {
        const startOk = !b.startAt || b.startAt.toMillis() <= nowMs;
        const endOk = !b.endAt || b.endAt.toMillis() >= nowMs;
        return startOk && endOk;
    });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd clicker-platform-v2 && pnpm test lib/modules/campaigns/__tests__/api-queries.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add clicker-platform-v2/lib/modules/campaigns/api/queries.ts clicker-platform-v2/lib/modules/campaigns/__tests__/api-queries.test.ts
git commit -m "feat(campaigns): getActiveBanners with status/date/placement filter"
```

---

### Task 7: resolvePromoTarget (cross-module composition)

**Files:**
- Modify: `clicker-platform-v2/lib/modules/campaigns/api/queries.ts`
- Test: extend `clicker-platform-v2/lib/modules/campaigns/__tests__/api-queries.test.ts`

- [ ] **Step 1: Add failing tests for resolvePromoTarget**

Append to `clicker-platform-v2/lib/modules/campaigns/__tests__/api-queries.test.ts`:

```typescript
vi.mock('@/lib/modules/promo/api', () => ({
    getPromo: vi.fn(),
}));
vi.mock('@/lib/modules/byod_pos/api', () => ({
    listMenuItemsByIds: vi.fn(async () => []),
    listMenuItemsByCategoryIds: vi.fn(async () => []),
}));

import { getPromo } from '@/lib/modules/promo/api';
import { listMenuItemsByIds, listMenuItemsByCategoryIds } from '@/lib/modules/byod_pos/api';
import { resolvePromoTarget } from '../api/queries';

describe('resolvePromoTarget', () => {
    beforeEach(() => vi.clearAllMocks());

    it('returns null promo when not found', async () => {
        (getPromo as any).mockResolvedValueOnce(null);
        const result = await resolvePromoTarget('s1', 'missing');
        expect(result).toEqual({ promo: null, eligibleProducts: [] });
    });

    it('returns empty eligibleProducts when promo has no eligibleItems', async () => {
        (getPromo as any).mockResolvedValueOnce({ id: 'p1', conditions: { eligibleSources: [], audience: 'public' } });
        const result = await resolvePromoTarget('s1', 'p1');
        expect(result.eligibleProducts).toEqual([]);
        expect(listMenuItemsByIds).not.toHaveBeenCalled();
        expect(listMenuItemsByCategoryIds).not.toHaveBeenCalled();
    });

    it('queries POS items by both itemIds and categoryIds and merges (dedup by id)', async () => {
        (getPromo as any).mockResolvedValueOnce({
            id: 'p1',
            conditions: { eligibleSources: [], audience: 'public', eligibleItems: { itemIds: ['a'], categoryIds: ['c'] } },
        });
        (listMenuItemsByIds as any).mockResolvedValueOnce([{ id: 'a', name: 'A' }]);
        (listMenuItemsByCategoryIds as any).mockResolvedValueOnce([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }]);
        const result = await resolvePromoTarget('s1', 'p1');
        expect(result.eligibleProducts.map((p: any) => p.id).sort()).toEqual(['a', 'b']);
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd clicker-platform-v2 && pnpm test lib/modules/campaigns/__tests__/api-queries.test.ts`
Expected: FAIL (`resolvePromoTarget` not exported)

- [ ] **Step 3: Check POS facade exports**

Run: `grep -n "export.*listMenuItemsByIds\|export.*listMenuItemsByCategoryIds" clicker-platform-v2/lib/modules/byod_pos/api.ts`

If either function is missing, add it as a thin wrapper in `clicker-platform-v2/lib/modules/byod_pos/api.ts`. The required signatures:

```typescript
// at the bottom of lib/modules/byod_pos/api.ts
import { POSItem } from './types';
import { documentId } from 'firebase/firestore';

export async function listMenuItemsByIds(siteId: string, ids: string[]): Promise<POSItem[]> {
    if (!siteId || siteId === 'default' || siteId === 'pending' || ids.length === 0) return [];
    const coll = collection(db, 'sites', siteId, 'modules/byod_pos/menu_items');
    // Firestore "in" supports up to 30 ids per query — chunk if needed
    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += 30) chunks.push(ids.slice(i, i + 30));
    const results: POSItem[] = [];
    for (const chunk of chunks) {
        const snap = await getDocs(query(coll, where(documentId(), 'in', chunk)));
        results.push(...snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
    }
    return results;
}

export async function listMenuItemsByCategoryIds(siteId: string, categoryIds: string[]): Promise<POSItem[]> {
    if (!siteId || siteId === 'default' || siteId === 'pending' || categoryIds.length === 0) return [];
    const coll = collection(db, 'sites', siteId, 'modules/byod_pos/menu_items');
    const chunks: string[][] = [];
    for (let i = 0; i < categoryIds.length; i += 30) chunks.push(categoryIds.slice(i, i + 30));
    const results: POSItem[] = [];
    for (const chunk of chunks) {
        const snap = await getDocs(query(coll, where('categoryId', 'in', chunk)));
        results.push(...snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
    }
    return results;
}
```

Check what's already imported at the top of `lib/modules/byod_pos/api.ts` before adding imports; only add the missing ones.

- [ ] **Step 4: Implement resolvePromoTarget**

Append to `clicker-platform-v2/lib/modules/campaigns/api/queries.ts`:

```typescript
import { getPromo } from '@/lib/modules/promo/api';
import { listMenuItemsByIds, listMenuItemsByCategoryIds } from '@/lib/modules/byod_pos/api';
import type { Promo } from '@/lib/modules/promo/types';
import type { POSItem } from '@/lib/modules/byod_pos/types';

export async function resolvePromoTarget(
    siteId: string,
    promoId: string,
): Promise<{ promo: Promo | null; eligibleProducts: POSItem[] }> {
    if (isUnhydratedSiteId(siteId)) return { promo: null, eligibleProducts: [] };

    const promo = await getPromo(siteId, promoId);
    if (!promo) return { promo: null, eligibleProducts: [] };

    const eligible = promo.conditions.eligibleItems;
    if (!eligible || (!eligible.itemIds?.length && !eligible.categoryIds?.length)) {
        return { promo, eligibleProducts: [] };
    }

    const [byId, byCat] = await Promise.all([
        eligible.itemIds?.length ? listMenuItemsByIds(siteId, eligible.itemIds) : Promise.resolve([] as POSItem[]),
        eligible.categoryIds?.length ? listMenuItemsByCategoryIds(siteId, eligible.categoryIds) : Promise.resolve([] as POSItem[]),
    ]);

    const seen = new Set<string>();
    const merged: POSItem[] = [];
    for (const item of [...byId, ...byCat]) {
        if (!seen.has(item.id)) {
            seen.add(item.id);
            merged.push(item);
        }
    }
    return { promo, eligibleProducts: merged };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd clicker-platform-v2 && pnpm test lib/modules/campaigns/__tests__/api-queries.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add clicker-platform-v2/lib/modules/campaigns/api/queries.ts clicker-platform-v2/lib/modules/byod_pos/api.ts clicker-platform-v2/lib/modules/campaigns/__tests__/api-queries.test.ts
git commit -m "feat(campaigns): resolvePromoTarget — cross-module composition of promo+POS"
```

---

### Task 8: Tracking API

**Files:**
- Create: `clicker-platform-v2/lib/modules/campaigns/api/tracking.ts`
- Test: `clicker-platform-v2/lib/modules/campaigns/__tests__/api-tracking.test.ts`

- [ ] **Step 1: Write the failing test**

Create `clicker-platform-v2/lib/modules/campaigns/__tests__/api-tracking.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const captureMock = vi.fn();
vi.mock('posthog-js', () => ({ default: { capture: captureMock } }));
vi.mock('@/lib/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
    doc: vi.fn((...args) => ({ _doc: args })),
    updateDoc: vi.fn(async () => {}),
    increment: vi.fn((n: number) => ({ _inc: n })),
}));

import { updateDoc } from 'firebase/firestore';
import { trackBannerImpression, trackBannerClick } from '../api/tracking';

const settings = { posBannerEnabled: true, posBannerMaxCount: 3, trackingEnabled: true };
const off = { ...settings, trackingEnabled: false };

describe('banner tracking', () => {
    beforeEach(() => { captureMock.mockClear(); (updateDoc as any).mockClear(); });

    it('impression fires PostHog event and increments counter when enabled', async () => {
        await trackBannerImpression('s1', 'b1', 'pos', settings);
        expect(captureMock).toHaveBeenCalledWith('campaign_banner_impression', { siteId: 's1', bannerId: 'b1', placement: 'pos' });
        expect(updateDoc).toHaveBeenCalledTimes(1);
    });

    it('impression is no-op when tracking disabled', async () => {
        await trackBannerImpression('s1', 'b1', 'pos', off);
        expect(captureMock).not.toHaveBeenCalled();
        expect(updateDoc).not.toHaveBeenCalled();
    });

    it('click fires event with targetType and increments counter', async () => {
        await trackBannerClick('s1', 'b1', 'site_block', 'promo', settings);
        expect(captureMock).toHaveBeenCalledWith('campaign_banner_click', { siteId: 's1', bannerId: 'b1', placement: 'site_block', targetType: 'promo' });
        expect(updateDoc).toHaveBeenCalledTimes(1);
    });

    it('unhydrated siteId is a no-op', async () => {
        await trackBannerImpression('default', 'b1', 'pos', settings);
        await trackBannerClick('pending', 'b1', 'pos', 'none', settings);
        expect(captureMock).not.toHaveBeenCalled();
        expect(updateDoc).not.toHaveBeenCalled();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd clicker-platform-v2 && pnpm test lib/modules/campaigns/__tests__/api-tracking.test.ts`
Expected: FAIL

- [ ] **Step 3: Create the tracking module**

Create `clicker-platform-v2/lib/modules/campaigns/api/tracking.ts`:

```typescript
import { doc, updateDoc, increment } from 'firebase/firestore';
import posthog from 'posthog-js';
import { db } from '@/lib/firebase';
import type { BannerPlacement, BannerTarget, CampaignsSettings } from '../types';
import { BANNERS_COLLECTION } from '../constants';

function isUnhydratedSiteId(siteId: string): boolean {
    return !siteId || siteId === 'default' || siteId === 'pending';
}

export async function trackBannerImpression(
    siteId: string,
    bannerId: string,
    placement: BannerPlacement,
    settings: CampaignsSettings,
): Promise<void> {
    if (isUnhydratedSiteId(siteId) || !settings.trackingEnabled) return;
    posthog.capture('campaign_banner_impression', { siteId, bannerId, placement });
    try {
        await updateDoc(doc(db, 'sites', siteId, BANNERS_COLLECTION, bannerId), { impressionCount: increment(1) });
    } catch {
        // counter drift is acceptable — PostHog is the source of truth
    }
}

export async function trackBannerClick(
    siteId: string,
    bannerId: string,
    placement: BannerPlacement,
    targetType: BannerTarget['type'],
    settings: CampaignsSettings,
): Promise<void> {
    if (isUnhydratedSiteId(siteId) || !settings.trackingEnabled) return;
    posthog.capture('campaign_banner_click', { siteId, bannerId, placement, targetType });
    try {
        await updateDoc(doc(db, 'sites', siteId, BANNERS_COLLECTION, bannerId), { clickCount: increment(1) });
    } catch {
        // ignore
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd clicker-platform-v2 && pnpm test lib/modules/campaigns/__tests__/api-tracking.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add clicker-platform-v2/lib/modules/campaigns/api/tracking.ts clicker-platform-v2/lib/modules/campaigns/__tests__/api-tracking.test.ts
git commit -m "feat(campaigns): tracking — PostHog events + denormalized counters"
```

---

### Task 9: Public facade `api.ts` and admin SDK `api-admin.ts`

**Files:**
- Create: `clicker-platform-v2/lib/modules/campaigns/api.ts`
- Create: `clicker-platform-v2/lib/modules/campaigns/api-admin.ts`
- Create: `clicker-platform-v2/lib/modules/campaigns/api-server.ts`
- Test: `clicker-platform-v2/lib/modules/campaigns/__tests__/api-facade.test.ts`

- [ ] **Step 1: Write the failing test (facade only)**

Create `clicker-platform-v2/lib/modules/campaigns/__tests__/api-facade.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import * as facade from '../api';

describe('campaigns facade', () => {
    it('exports the full public surface', () => {
        const required = [
            'getCampaignsSettings', 'updateCampaignsSettings',
            'listBanners', 'getBanner', 'createBanner', 'updateBanner',
            'setBannerStatus', 'reorderBanners', 'deleteBanner',
            'getActiveBanners', 'resolvePromoTarget',
            'trackBannerImpression', 'trackBannerClick',
        ];
        for (const name of required) {
            expect(facade).toHaveProperty(name);
            expect(typeof (facade as any)[name]).toBe('function');
        }
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd clicker-platform-v2 && pnpm test lib/modules/campaigns/__tests__/api-facade.test.ts`
Expected: FAIL

- [ ] **Step 3: Create the public facade**

Create `clicker-platform-v2/lib/modules/campaigns/api.ts`:

```typescript
export * from './types';
export {
    getCampaignsSettings,
    updateCampaignsSettings,
} from './api/settings';
export {
    listBanners,
    getBanner,
    createBanner,
    updateBanner,
    setBannerStatus,
    reorderBanners,
    deleteBanner,
} from './api/banners';
export {
    getActiveBanners,
    resolvePromoTarget,
} from './api/queries';
export {
    trackBannerImpression,
    trackBannerClick,
} from './api/tracking';
```

- [ ] **Step 4: Create the admin SDK API**

Create `clicker-platform-v2/lib/modules/campaigns/api-admin.ts`:

```typescript
import { adminDb } from '@/lib/firebase-admin';
import type { Banner, BannerPlacement } from './types';

export async function listActiveBannersAdmin(siteId: string, placement: BannerPlacement, nowMs: number = Date.now()): Promise<Banner[]> {
    try {
        const snap = await adminDb
            .collection('sites').doc(siteId)
            .collection('modules/campaigns/banners')
            .where('status', '==', 'active')
            .where('placements', 'array-contains', placement)
            .orderBy('priority', 'asc')
            .get();

        const all = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as Banner));
        return all.filter(b => {
            const startOk = !b.startAt || (b.startAt as any).toMillis() <= nowMs;
            const endOk = !b.endAt || (b.endAt as any).toMillis() >= nowMs;
            return startOk && endOk;
        });
    } catch {
        return [];
    }
}
```

- [ ] **Step 5: Create the SSR utility**

Create `clicker-platform-v2/lib/modules/campaigns/api-server.ts`:

```typescript
import { listActiveBannersAdmin } from './api-admin';
import type { Banner, BannerPlacement } from './types';

export async function getActiveBannersServer(siteId: string, placement: BannerPlacement): Promise<Banner[]> {
    return listActiveBannersAdmin(siteId, placement);
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd clicker-platform-v2 && pnpm test lib/modules/campaigns/__tests__/api-facade.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add clicker-platform-v2/lib/modules/campaigns/api.ts clicker-platform-v2/lib/modules/campaigns/api-admin.ts clicker-platform-v2/lib/modules/campaigns/api-server.ts clicker-platform-v2/lib/modules/campaigns/__tests__/api-facade.test.ts
git commit -m "feat(campaigns): public facade + admin SDK + SSR utility"
```

---

## Phase 3 — Shared rendering primitives

### Task 10: `<BannerImage />` shared image component

**Files:**
- Create: `clicker-platform-v2/lib/modules/campaigns/components/BannerImage.tsx`
- Test: `clicker-platform-v2/lib/modules/campaigns/__tests__/BannerImage.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `clicker-platform-v2/lib/modules/campaigns/__tests__/BannerImage.test.tsx`:

```typescript
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { BannerImage } from '../components/BannerImage';

describe('BannerImage', () => {
    it('renders 3:2 aspect ratio by default', () => {
        const { container } = render(<BannerImage src="/x.jpg" aspectRatio="3:2" alt="A" />);
        const wrapper = container.firstChild as HTMLElement;
        expect(wrapper.style.aspectRatio).toBe('3 / 2');
    });

    it('renders 3:1 when specified', () => {
        const { container } = render(<BannerImage src="/x.jpg" aspectRatio="3:1" alt="A" />);
        const wrapper = container.firstChild as HTMLElement;
        expect(wrapper.style.aspectRatio).toBe('3 / 1');
    });

    it('uses the alt text', () => {
        const { getByAltText } = render(<BannerImage src="/x.jpg" aspectRatio="3:2" alt="Hello" />);
        expect(getByAltText('Hello')).toBeTruthy();
    });

    it('falls back to empty alt when not provided', () => {
        const { container } = render(<BannerImage src="/x.jpg" aspectRatio="3:2" />);
        expect(container.querySelector('img')?.getAttribute('alt')).toBe('');
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd clicker-platform-v2 && pnpm test lib/modules/campaigns/__tests__/BannerImage.test.tsx`
Expected: FAIL

- [ ] **Step 3: Create the component**

Create `clicker-platform-v2/lib/modules/campaigns/components/BannerImage.tsx`:

```typescript
import type { BannerAspectRatio } from '../types';

interface Props {
    src: string;
    aspectRatio: BannerAspectRatio;
    alt?: string;
    className?: string;
}

export function BannerImage({ src, aspectRatio, alt, className }: Props) {
    const ratio = aspectRatio === '3:1' ? '3 / 1' : '3 / 2';
    return (
        <div
            className={`relative w-full overflow-hidden rounded-lg ${className ?? ''}`}
            style={{ aspectRatio: ratio }}
        >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={src}
                alt={alt ?? ''}
                className="absolute inset-0 h-full w-full object-cover"
                loading="lazy"
            />
        </div>
    );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd clicker-platform-v2 && pnpm test lib/modules/campaigns/__tests__/BannerImage.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add clicker-platform-v2/lib/modules/campaigns/components/BannerImage.tsx clicker-platform-v2/lib/modules/campaigns/__tests__/BannerImage.test.tsx
git commit -m "feat(campaigns): BannerImage with 3:2 / 3:1 aspect ratio control"
```

---

### Task 11: `useImpressionTracker` hook

**Files:**
- Create: `clicker-platform-v2/lib/modules/campaigns/hooks/useImpressionTracker.ts`
- Test: `clicker-platform-v2/lib/modules/campaigns/__tests__/useImpressionTracker.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `clicker-platform-v2/lib/modules/campaigns/__tests__/useImpressionTracker.test.tsx`:

```typescript
import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const tracked: string[] = [];
vi.mock('../api/tracking', () => ({
    trackBannerImpression: vi.fn(async (_s: string, id: string) => { tracked.push(id); }),
}));

import { useImpressionTracker } from '../hooks/useImpressionTracker';
import { trackBannerImpression } from '../api/tracking';

const settings = { posBannerEnabled: true, posBannerMaxCount: 3, trackingEnabled: true };

describe('useImpressionTracker', () => {
    beforeEach(() => { tracked.length = 0; (trackBannerImpression as any).mockClear(); });

    it('fires once per banner id', () => {
        const { result } = renderHook(() => useImpressionTracker('s1', 'pos', settings));
        result.current.trackOnce('b1');
        result.current.trackOnce('b1');
        result.current.trackOnce('b2');
        result.current.trackOnce('b1');
        expect((trackBannerImpression as any).mock.calls.map((c: any[]) => c[1])).toEqual(['b1', 'b2']);
    });

    it('no-ops when tracking disabled', () => {
        const off = { ...settings, trackingEnabled: false };
        const { result } = renderHook(() => useImpressionTracker('s1', 'pos', off));
        result.current.trackOnce('b1');
        expect(trackBannerImpression).not.toHaveBeenCalled();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd clicker-platform-v2 && pnpm test lib/modules/campaigns/__tests__/useImpressionTracker.test.tsx`
Expected: FAIL

- [ ] **Step 3: Create the hook**

Create `clicker-platform-v2/lib/modules/campaigns/hooks/useImpressionTracker.ts`:

```typescript
'use client';

import { useRef, useCallback } from 'react';
import { trackBannerImpression } from '../api/tracking';
import type { BannerPlacement, CampaignsSettings } from '../types';

export function useImpressionTracker(
    siteId: string,
    placement: BannerPlacement,
    settings: CampaignsSettings,
) {
    const seen = useRef<Set<string>>(new Set());

    const trackOnce = useCallback((bannerId: string) => {
        if (!settings.trackingEnabled) return;
        if (seen.current.has(bannerId)) return;
        seen.current.add(bannerId);
        void trackBannerImpression(siteId, bannerId, placement, settings);
    }, [siteId, placement, settings]);

    return { trackOnce };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd clicker-platform-v2 && pnpm test lib/modules/campaigns/__tests__/useImpressionTracker.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add clicker-platform-v2/lib/modules/campaigns/hooks/useImpressionTracker.ts clicker-platform-v2/lib/modules/campaigns/__tests__/useImpressionTracker.test.tsx
git commit -m "feat(campaigns): useImpressionTracker — dedup'd impression firing"
```

---

### Task 12: `<BannerStrip />` and click handler

**Files:**
- Create: `clicker-platform-v2/lib/modules/campaigns/components/BannerStrip.tsx`
- Create: `clicker-platform-v2/lib/modules/campaigns/lib/handleBannerClick.ts`
- Test: `clicker-platform-v2/lib/modules/campaigns/__tests__/BannerStrip.test.tsx`
- Test: `clicker-platform-v2/lib/modules/campaigns/__tests__/handleBannerClick.test.ts`

- [ ] **Step 1: Write failing test for the click handler**

Create `clicker-platform-v2/lib/modules/campaigns/__tests__/handleBannerClick.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';

const trackMock = vi.fn();
vi.mock('../api/tracking', () => ({ trackBannerClick: trackMock }));

import { handleBannerClick } from '../lib/handleBannerClick';

const settings = { posBannerEnabled: true, posBannerMaxCount: 3, trackingEnabled: true };
const baseBanner = {
    id: 'b1', siteId: 's1', title: 't', image: 'u', aspectRatio: '3:2',
    placements: ['pos'], status: 'active', priority: 100,
    impressionCount: 0, clickCount: 0,
    createdAt: {} as any, updatedAt: {} as any,
};

describe('handleBannerClick', () => {
    it('promo target → calls onOpenPromoSheet', () => {
        const onOpenPromoSheet = vi.fn();
        const router = { push: vi.fn() };
        const banner = { ...baseBanner, target: { type: 'promo' as const, promoId: 'p1' } };
        handleBannerClick(banner, 'pos', settings, { onOpenPromoSheet, router });
        expect(onOpenPromoSheet).toHaveBeenCalledWith('p1');
        expect(trackMock).toHaveBeenCalledWith('s1', 'b1', 'pos', 'promo', settings);
    });

    it('promo target without onOpenPromoSheet → navigates to /promo/[id]', () => {
        const router = { push: vi.fn() };
        const banner = { ...baseBanner, target: { type: 'promo' as const, promoId: 'p1' } };
        handleBannerClick(banner, 'site_block', settings, { router });
        expect(router.push).toHaveBeenCalledWith('/promo/p1');
    });

    it('page target → navigates to /[slug]', () => {
        const router = { push: vi.fn() };
        const banner = { ...baseBanner, target: { type: 'page' as const, pageSlug: 'about' } };
        handleBannerClick(banner, 'pos', settings, { router });
        expect(router.push).toHaveBeenCalledWith('/about');
    });

    it('external target → opens in new tab', () => {
        const openSpy = vi.fn();
        (globalThis as any).window = { open: openSpy };
        const banner = { ...baseBanner, target: { type: 'external' as const, url: 'https://x.com' } };
        handleBannerClick(banner, 'pos', settings, {});
        expect(openSpy).toHaveBeenCalledWith('https://x.com', '_blank', 'noopener');
    });

    it('none target → no-op (but still tracks click)', () => {
        const router = { push: vi.fn() };
        const banner = { ...baseBanner, target: { type: 'none' as const } };
        handleBannerClick(banner, 'pos', settings, { router });
        expect(router.push).not.toHaveBeenCalled();
        expect(trackMock).toHaveBeenCalledWith('s1', 'b1', 'pos', 'none', settings);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd clicker-platform-v2 && pnpm test lib/modules/campaigns/__tests__/handleBannerClick.test.ts`
Expected: FAIL

- [ ] **Step 3: Create the click handler**

Create `clicker-platform-v2/lib/modules/campaigns/lib/handleBannerClick.ts`:

```typescript
import type { Banner, BannerPlacement, CampaignsSettings } from '../types';
import { trackBannerClick } from '../api/tracking';

interface RouterLike { push: (path: string) => void; }

interface ClickContext {
    router?: RouterLike;
    onOpenPromoSheet?: (promoId: string) => void;
}

export function handleBannerClick(
    banner: Banner,
    placement: BannerPlacement,
    settings: CampaignsSettings,
    ctx: ClickContext,
): void {
    void trackBannerClick(banner.siteId, banner.id, placement, banner.target.type, settings);

    switch (banner.target.type) {
        case 'promo':
            if (ctx.onOpenPromoSheet) ctx.onOpenPromoSheet(banner.target.promoId);
            else ctx.router?.push(`/promo/${banner.target.promoId}`);
            return;
        case 'page':
            ctx.router?.push(`/${banner.target.pageSlug}`);
            return;
        case 'external':
            (globalThis as any).window?.open?.(banner.target.url, '_blank', 'noopener');
            return;
        case 'none':
            return;
    }
}
```

- [ ] **Step 4: Run handler test**

Run: `cd clicker-platform-v2 && pnpm test lib/modules/campaigns/__tests__/handleBannerClick.test.ts`
Expected: PASS

- [ ] **Step 5: Write failing test for BannerStrip**

Create `clicker-platform-v2/lib/modules/campaigns/__tests__/BannerStrip.test.tsx`:

```typescript
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('../api/tracking', () => ({
    trackBannerClick: vi.fn(),
    trackBannerImpression: vi.fn(),
}));

import { BannerStrip } from '../components/BannerStrip';

const settings = { posBannerEnabled: true, posBannerMaxCount: 3, trackingEnabled: true };

const baseBanner = (id: string, target: any = { type: 'none' }) => ({
    id, siteId: 's1', title: id, image: `/${id}.jpg`, aspectRatio: '3:2' as const,
    target, placements: ['pos' as const], status: 'active' as const, priority: 100,
    impressionCount: 0, clickCount: 0,
    createdAt: {} as any, updatedAt: {} as any,
});

describe('BannerStrip', () => {
    it('renders one card per banner', () => {
        const { getAllByRole } = render(
            <BannerStrip banners={[baseBanner('b1'), baseBanner('b2'), baseBanner('b3')]} placement="pos" settings={settings} />
        );
        expect(getAllByRole('button')).toHaveLength(3);
    });

    it('clicking a card triggers handler', () => {
        const onOpenPromoSheet = vi.fn();
        const { getAllByRole } = render(
            <BannerStrip
                banners={[baseBanner('b1', { type: 'promo', promoId: 'p1' })]}
                placement="pos"
                settings={settings}
                onOpenPromoSheet={onOpenPromoSheet}
            />
        );
        fireEvent.click(getAllByRole('button')[0]);
        expect(onOpenPromoSheet).toHaveBeenCalledWith('p1');
    });

    it('renders nothing if banners list is empty', () => {
        const { container } = render(<BannerStrip banners={[]} placement="pos" settings={settings} />);
        expect(container.firstChild).toBeNull();
    });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `cd clicker-platform-v2 && pnpm test lib/modules/campaigns/__tests__/BannerStrip.test.tsx`
Expected: FAIL

- [ ] **Step 7: Create BannerStrip**

Create `clicker-platform-v2/lib/modules/campaigns/components/BannerStrip.tsx`:

```typescript
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Banner, BannerPlacement, CampaignsSettings } from '../types';
import { BannerImage } from './BannerImage';
import { handleBannerClick } from '../lib/handleBannerClick';
import { useImpressionTracker } from '../hooks/useImpressionTracker';

interface Props {
    banners: Banner[];
    placement: BannerPlacement;
    settings: CampaignsSettings;
    onOpenPromoSheet?: (promoId: string) => void;
}

export function BannerStrip({ banners, placement, settings, onOpenPromoSheet }: Props) {
    const router = useRouter();
    const { trackOnce } = useImpressionTracker(banners[0]?.siteId ?? '', placement, settings);

    useEffect(() => {
        banners.forEach(b => trackOnce(b.id));
    }, [banners, trackOnce]);

    if (banners.length === 0) return null;

    return (
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory">
            {banners.map(b => (
                <button
                    key={b.id}
                    type="button"
                    onClick={() => handleBannerClick(b, placement, settings, { router, onOpenPromoSheet })}
                    className="flex-shrink-0 w-[70%] sm:w-1/2 lg:w-1/3 snap-start text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg"
                >
                    <BannerImage src={b.image} aspectRatio={b.aspectRatio} alt={b.altText ?? b.title} />
                </button>
            ))}
        </div>
    );
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `cd clicker-platform-v2 && pnpm test lib/modules/campaigns/__tests__/BannerStrip.test.tsx`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add clicker-platform-v2/lib/modules/campaigns/components/BannerStrip.tsx clicker-platform-v2/lib/modules/campaigns/lib/handleBannerClick.ts clicker-platform-v2/lib/modules/campaigns/__tests__/BannerStrip.test.tsx clicker-platform-v2/lib/modules/campaigns/__tests__/handleBannerClick.test.ts
git commit -m "feat(campaigns): BannerStrip renderer + shared click handler"
```

---

### Task 13: `useHeroRotation` hook + `<BannerHero />`

**Files:**
- Create: `clicker-platform-v2/lib/modules/campaigns/hooks/useHeroRotation.ts`
- Create: `clicker-platform-v2/lib/modules/campaigns/components/BannerHero.tsx`
- Test: `clicker-platform-v2/lib/modules/campaigns/__tests__/useHeroRotation.test.tsx`
- Test: `clicker-platform-v2/lib/modules/campaigns/__tests__/BannerHero.test.tsx`

- [ ] **Step 1: Write failing test for rotation hook**

Create `clicker-platform-v2/lib/modules/campaigns/__tests__/useHeroRotation.test.tsx`:

```typescript
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useHeroRotation } from '../hooks/useHeroRotation';

describe('useHeroRotation', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('starts at index 0', () => {
        const { result } = renderHook(() => useHeroRotation(3, 1000));
        expect(result.current.index).toBe(0);
    });

    it('advances index every interval', () => {
        const { result } = renderHook(() => useHeroRotation(3, 1000));
        act(() => { vi.advanceTimersByTime(1000); });
        expect(result.current.index).toBe(1);
        act(() => { vi.advanceTimersByTime(1000); });
        expect(result.current.index).toBe(2);
        act(() => { vi.advanceTimersByTime(1000); });
        expect(result.current.index).toBe(0);
    });

    it('does not rotate when count is 1', () => {
        const { result } = renderHook(() => useHeroRotation(1, 1000));
        act(() => { vi.advanceTimersByTime(5000); });
        expect(result.current.index).toBe(0);
    });

    it('goTo sets the index directly', () => {
        const { result } = renderHook(() => useHeroRotation(3, 1000));
        act(() => { result.current.goTo(2); });
        expect(result.current.index).toBe(2);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd clicker-platform-v2 && pnpm test lib/modules/campaigns/__tests__/useHeroRotation.test.tsx`
Expected: FAIL

- [ ] **Step 3: Create the rotation hook**

Create `clicker-platform-v2/lib/modules/campaigns/hooks/useHeroRotation.ts`:

```typescript
'use client';

import { useEffect, useState, useCallback } from 'react';

export function useHeroRotation(count: number, intervalMs: number) {
    const [index, setIndex] = useState(0);

    useEffect(() => {
        if (count <= 1 || intervalMs <= 0) return;
        const id = setInterval(() => {
            setIndex(i => (i + 1) % count);
        }, intervalMs);
        return () => clearInterval(id);
    }, [count, intervalMs]);

    const goTo = useCallback((i: number) => setIndex(i), []);

    return { index, goTo };
}
```

- [ ] **Step 4: Run rotation hook test**

Run: `cd clicker-platform-v2 && pnpm test lib/modules/campaigns/__tests__/useHeroRotation.test.tsx`
Expected: PASS

- [ ] **Step 5: Write failing test for BannerHero**

Create `clicker-platform-v2/lib/modules/campaigns/__tests__/BannerHero.test.tsx`:

```typescript
import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('../api/tracking', () => ({ trackBannerClick: vi.fn(), trackBannerImpression: vi.fn() }));

import { BannerHero } from '../components/BannerHero';

const settings = { posBannerEnabled: true, posBannerMaxCount: 3, trackingEnabled: true };

const banner = (id: string) => ({
    id, siteId: 's1', title: id, image: `/${id}.jpg`, aspectRatio: '3:1' as const,
    target: { type: 'none' as const }, placements: ['site_block' as const],
    status: 'active' as const, priority: 100,
    impressionCount: 0, clickCount: 0,
    createdAt: {} as any, updatedAt: {} as any,
});

describe('BannerHero', () => {
    it('renders the current banner image only', () => {
        const { getAllByRole } = render(
            <BannerHero banners={[banner('a'), banner('b')]} placement="site_block" settings={settings} rotationIntervalMs={6000} />
        );
        // a single clickable hero
        expect(getAllByRole('button')).toHaveLength(1);
    });

    it('renders dot indicators equal to banner count', () => {
        const { container } = render(
            <BannerHero banners={[banner('a'), banner('b'), banner('c')]} placement="site_block" settings={settings} rotationIntervalMs={6000} />
        );
        expect(container.querySelectorAll('[data-hero-dot]')).toHaveLength(3);
    });

    it('returns null when empty', () => {
        const { container } = render(
            <BannerHero banners={[]} placement="site_block" settings={settings} rotationIntervalMs={6000} />
        );
        expect(container.firstChild).toBeNull();
    });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `cd clicker-platform-v2 && pnpm test lib/modules/campaigns/__tests__/BannerHero.test.tsx`
Expected: FAIL

- [ ] **Step 7: Create BannerHero**

Create `clicker-platform-v2/lib/modules/campaigns/components/BannerHero.tsx`:

```typescript
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Banner, BannerPlacement, CampaignsSettings } from '../types';
import { BannerImage } from './BannerImage';
import { useHeroRotation } from '../hooks/useHeroRotation';
import { useImpressionTracker } from '../hooks/useImpressionTracker';
import { handleBannerClick } from '../lib/handleBannerClick';
import { HERO_MAX_WIDTH_PX } from '../constants';

interface Props {
    banners: Banner[];
    placement: BannerPlacement;
    settings: CampaignsSettings;
    rotationIntervalMs: number;
}

export function BannerHero({ banners, placement, settings, rotationIntervalMs }: Props) {
    const router = useRouter();
    const { index, goTo } = useHeroRotation(banners.length, rotationIntervalMs);
    const { trackOnce } = useImpressionTracker(banners[0]?.siteId ?? '', placement, settings);
    const current = banners[index];

    useEffect(() => {
        if (current) trackOnce(current.id);
    }, [current, trackOnce]);

    if (!current) return null;

    return (
        <div className="mx-auto w-full" style={{ maxWidth: HERO_MAX_WIDTH_PX }}>
            <button
                type="button"
                onClick={() => handleBannerClick(current, placement, settings, { router })}
                className="w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-xl"
            >
                <BannerImage src={current.image} aspectRatio={current.aspectRatio} alt={current.altText ?? current.title} />
            </button>
            {banners.length > 1 && (
                <div className="mt-2 flex justify-center gap-1.5">
                    {banners.map((b, i) => (
                        <button
                            key={b.id}
                            type="button"
                            aria-label={`Show banner ${i + 1}`}
                            data-hero-dot
                            onClick={() => goTo(i)}
                            className={`h-2 w-2 rounded-full transition-colors ${i === index ? 'bg-blue-600' : 'bg-gray-300'}`}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
```

- [ ] **Step 8: Run BannerHero test**

Run: `cd clicker-platform-v2 && pnpm test lib/modules/campaigns/__tests__/BannerHero.test.tsx`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add clicker-platform-v2/lib/modules/campaigns/hooks/useHeroRotation.ts clicker-platform-v2/lib/modules/campaigns/components/BannerHero.tsx clicker-platform-v2/lib/modules/campaigns/__tests__/useHeroRotation.test.tsx clicker-platform-v2/lib/modules/campaigns/__tests__/BannerHero.test.tsx
git commit -m "feat(campaigns): BannerHero with auto-rotation and dot indicators"
```

---

## Phase 4 — Surface components: POS, Link-in-bio, PromoBannerSheet

### Task 14: `<PromoBannerSheet />` — POS bottom sheet for promo banners

**Files:**
- Create: `clicker-platform-v2/lib/modules/campaigns/components/PromoBannerSheet.tsx`
- Test: `clicker-platform-v2/lib/modules/campaigns/__tests__/PromoBannerSheet.test.tsx`

- [ ] **Step 1: Write failing test**

Create `clicker-platform-v2/lib/modules/campaigns/__tests__/PromoBannerSheet.test.tsx`:

```typescript
import { render, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../api/queries', () => ({ resolvePromoTarget: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { resolvePromoTarget } from '../api/queries';
import { PromoBannerSheet } from '../components/PromoBannerSheet';

const promo = { id: 'p1', name: 'Weekend Coffee', description: 'Save 20%', kind: 'percent', value: 20 } as any;

describe('PromoBannerSheet', () => {
    beforeEach(() => vi.clearAllMocks());

    it('renders the promo name once resolved', async () => {
        (resolvePromoTarget as any).mockResolvedValueOnce({ promo, eligibleProducts: [] });
        const { findByText } = render(<PromoBannerSheet siteId="s1" promoId="p1" open onClose={() => {}} />);
        expect(await findByText('Weekend Coffee')).toBeTruthy();
    });

    it('shows whole-cart message when no eligibleProducts', async () => {
        (resolvePromoTarget as any).mockResolvedValueOnce({ promo, eligibleProducts: [] });
        const { findByText } = render(<PromoBannerSheet siteId="s1" promoId="p1" open onClose={() => {}} />);
        expect(await findByText(/whole order/i)).toBeTruthy();
    });

    it('renders eligible items grid when present', async () => {
        (resolvePromoTarget as any).mockResolvedValueOnce({ promo, eligibleProducts: [{ id: 'i1', name: 'Latte', price: 35000 }] });
        const { findByText } = render(<PromoBannerSheet siteId="s1" promoId="p1" open onClose={() => {}} />);
        expect(await findByText('Latte')).toBeTruthy();
    });

    it('does not call resolve when closed', () => {
        render(<PromoBannerSheet siteId="s1" promoId="p1" open={false} onClose={() => {}} />);
        expect(resolvePromoTarget).not.toHaveBeenCalled();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd clicker-platform-v2 && pnpm test lib/modules/campaigns/__tests__/PromoBannerSheet.test.tsx`
Expected: FAIL

- [ ] **Step 3: Create PromoBannerSheet**

Create `clicker-platform-v2/lib/modules/campaigns/components/PromoBannerSheet.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { resolvePromoTarget } from '../api/queries';
import type { Promo } from '@/lib/modules/promo/types';
import type { POSItem } from '@/lib/modules/byod_pos/types';

interface Props {
    siteId: string;
    promoId: string;
    open: boolean;
    onClose: () => void;
}

export function PromoBannerSheet({ siteId, promoId, open, onClose }: Props) {
    const router = useRouter();
    const [promo, setPromo] = useState<Promo | null>(null);
    const [items, setItems] = useState<POSItem[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!open) return;
        setLoading(true);
        resolvePromoTarget(siteId, promoId).then(r => {
            setPromo(r.promo);
            setItems(r.eligibleProducts);
        }).finally(() => setLoading(false));
    }, [open, siteId, promoId]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40">
            <div className="w-full bg-white rounded-t-2xl max-h-[85vh] overflow-y-auto p-4 sm:max-w-2xl sm:mx-auto sm:mb-6 sm:rounded-2xl">
                <div className="flex items-start justify-between mb-3">
                    <h2 className="text-lg font-semibold">{promo?.name ?? (loading ? 'Loading...' : 'Promo')}</h2>
                    <button type="button" onClick={onClose} aria-label="Close" className="text-gray-500 hover:text-gray-800">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {promo?.description && <p className="text-sm text-gray-600 mb-4">{promo.description}</p>}

                {items.length === 0 ? (
                    <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-sm text-blue-800">
                        This promo applies to your whole order. Add items to your cart and the discount will apply at checkout.
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {items.map(item => (
                            <div key={item.id} className="rounded-lg border border-gray-200 p-2 text-sm">
                                <div className="font-medium">{item.name}</div>
                                {typeof (item as any).price === 'number' && (
                                    <div className="text-xs text-gray-500">Rp {(item as any).price.toLocaleString('id-ID')}</div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {promo && (
                    <button
                        type="button"
                        onClick={() => { router.push(`/promo/${promo.id}`); onClose(); }}
                        className="mt-4 w-full rounded-lg border border-gray-300 py-2 text-sm font-medium hover:bg-gray-50"
                    >
                        View full details
                    </button>
                )}
            </div>
        </div>
    );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd clicker-platform-v2 && pnpm test lib/modules/campaigns/__tests__/PromoBannerSheet.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add clicker-platform-v2/lib/modules/campaigns/components/PromoBannerSheet.tsx clicker-platform-v2/lib/modules/campaigns/__tests__/PromoBannerSheet.test.tsx
git commit -m "feat(campaigns): PromoBannerSheet bottom sheet for POS promo taps"
```

---

### Task 15: `<POSBannerStrip />` — POS surface entry component

**Files:**
- Create: `clicker-platform-v2/lib/modules/campaigns/components/POSBannerStrip.tsx`
- Test: `clicker-platform-v2/lib/modules/campaigns/__tests__/POSBannerStrip.test.tsx`

- [ ] **Step 1: Write failing test**

Create `clicker-platform-v2/lib/modules/campaigns/__tests__/POSBannerStrip.test.tsx`:

```typescript
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../api/queries', () => ({ getActiveBanners: vi.fn(), resolvePromoTarget: vi.fn(async () => ({ promo: null, eligibleProducts: [] })) }));
vi.mock('../api/settings', () => ({ getCampaignsSettings: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('../api/tracking', () => ({ trackBannerClick: vi.fn(), trackBannerImpression: vi.fn() }));

import { getActiveBanners } from '../api/queries';
import { getCampaignsSettings } from '../api/settings';
import { POSBannerStrip } from '../components/POSBannerStrip';

const banner = (id: string, target: any = { type: 'none' }) => ({
    id, siteId: 's1', title: id, image: `/${id}.jpg`, aspectRatio: '3:2',
    target, placements: ['pos'], status: 'active', priority: 100,
    impressionCount: 0, clickCount: 0,
    createdAt: {} as any, updatedAt: {} as any,
});

describe('POSBannerStrip', () => {
    beforeEach(() => vi.clearAllMocks());

    it('renders banners limited by posBannerMaxCount', async () => {
        (getCampaignsSettings as any).mockResolvedValueOnce({ posBannerEnabled: true, posBannerMaxCount: 2, trackingEnabled: true });
        (getActiveBanners as any).mockResolvedValueOnce([banner('a'), banner('b'), banner('c')]);
        const { findAllByRole } = render(<POSBannerStrip siteId="s1" />);
        await waitFor(() => {
            expect(findAllByRole('button')).resolves.toHaveLength(2);
        });
    });

    it('renders nothing when posBannerEnabled=false', async () => {
        (getCampaignsSettings as any).mockResolvedValueOnce({ posBannerEnabled: false, posBannerMaxCount: 3, trackingEnabled: true });
        (getActiveBanners as any).mockResolvedValueOnce([banner('a')]);
        const { container } = render(<POSBannerStrip siteId="s1" />);
        await waitFor(() => expect(container.firstChild).toBeNull());
    });

    it('opens PromoBannerSheet when a promo-target banner is clicked', async () => {
        (getCampaignsSettings as any).mockResolvedValueOnce({ posBannerEnabled: true, posBannerMaxCount: 3, trackingEnabled: true });
        (getActiveBanners as any).mockResolvedValueOnce([banner('a', { type: 'promo', promoId: 'p1' })]);
        const { findByRole, findByText } = render(<POSBannerStrip siteId="s1" />);
        const btn = await findByRole('button');
        fireEvent.click(btn);
        // Sheet renders the close button
        await findByText('Promo'); // loading state text — sheet is open
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd clicker-platform-v2 && pnpm test lib/modules/campaigns/__tests__/POSBannerStrip.test.tsx`
Expected: FAIL

- [ ] **Step 3: Create POSBannerStrip**

Create `clicker-platform-v2/lib/modules/campaigns/components/POSBannerStrip.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { getActiveBanners } from '../api/queries';
import { getCampaignsSettings } from '../api/settings';
import type { Banner, CampaignsSettings } from '../types';
import { BannerStrip } from './BannerStrip';
import { PromoBannerSheet } from './PromoBannerSheet';

interface Props {
    siteId: string;
}

export function POSBannerStrip({ siteId }: Props) {
    const [banners, setBanners] = useState<Banner[]>([]);
    const [settings, setSettings] = useState<CampaignsSettings | null>(null);
    const [openPromoId, setOpenPromoId] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const [s, b] = await Promise.all([
                getCampaignsSettings(siteId),
                getActiveBanners(siteId, 'pos'),
            ]);
            if (cancelled) return;
            setSettings(s);
            setBanners(b);
        })();
        return () => { cancelled = true; };
    }, [siteId]);

    if (!settings || !settings.posBannerEnabled) return null;
    if (banners.length === 0) return null;

    const limited = banners.slice(0, settings.posBannerMaxCount);

    return (
        <>
            <BannerStrip
                banners={limited}
                placement="pos"
                settings={settings}
                onOpenPromoSheet={id => setOpenPromoId(id)}
            />
            {openPromoId && (
                <PromoBannerSheet
                    siteId={siteId}
                    promoId={openPromoId}
                    open
                    onClose={() => setOpenPromoId(null)}
                />
            )}
        </>
    );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd clicker-platform-v2 && pnpm test lib/modules/campaigns/__tests__/POSBannerStrip.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add clicker-platform-v2/lib/modules/campaigns/components/POSBannerStrip.tsx clicker-platform-v2/lib/modules/campaigns/__tests__/POSBannerStrip.test.tsx
git commit -m "feat(campaigns): POSBannerStrip — POS surface entry with PromoBannerSheet"
```

---

### Task 16: `<LinkBannerItem />` — Link-in-bio surface entry

**Files:**
- Create: `clicker-platform-v2/lib/modules/campaigns/components/LinkBannerItem.tsx`

- [ ] **Step 1: Create the component (mirrors POSBannerStrip pattern)**

Create `clicker-platform-v2/lib/modules/campaigns/components/LinkBannerItem.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getActiveBanners } from '../api/queries';
import { getCampaignsSettings } from '../api/settings';
import type { Banner, CampaignsSettings } from '../types';
import { BannerImage } from './BannerImage';
import { handleBannerClick } from '../lib/handleBannerClick';
import { useImpressionTracker } from '../hooks/useImpressionTracker';

interface Props {
    siteId: string;
}

export function LinkBannerItem({ siteId }: Props) {
    const router = useRouter();
    const [banners, setBanners] = useState<Banner[]>([]);
    const [settings, setSettings] = useState<CampaignsSettings | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const [s, b] = await Promise.all([
                getCampaignsSettings(siteId),
                getActiveBanners(siteId, 'links'),
            ]);
            if (cancelled) return;
            setSettings(s);
            setBanners(b);
        })();
        return () => { cancelled = true; };
    }, [siteId]);

    const { trackOnce } = useImpressionTracker(siteId, 'links', settings ?? { posBannerEnabled: false, posBannerMaxCount: 0, trackingEnabled: false });

    useEffect(() => { banners.forEach(b => trackOnce(b.id)); }, [banners, trackOnce]);

    if (!settings || banners.length === 0) return null;

    return (
        <div className="flex flex-col gap-3">
            {banners.map(b => (
                <button
                    key={b.id}
                    type="button"
                    onClick={() => handleBannerClick(b, 'links', settings, { router })}
                    className="w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-xl"
                >
                    <BannerImage src={b.image} aspectRatio={b.aspectRatio} alt={b.altText ?? b.title} />
                </button>
            ))}
        </div>
    );
}
```

- [ ] **Step 2: Type-check**

Run: `cd clicker-platform-v2 && pnpm lint`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add clicker-platform-v2/lib/modules/campaigns/components/LinkBannerItem.tsx
git commit -m "feat(campaigns): LinkBannerItem for Link-in-bio surface"
```

---

## Phase 5 — Admin UI: list + editor + settings

### Task 17: Settings page

**Files:**
- Create: `clicker-platform-v2/lib/modules/campaigns/admin/CampaignsSettingsPage.tsx`
- Create: `clicker-platform-v2/app/admin/(dashboard)/campaigns/settings/page.tsx`

- [ ] **Step 1: Create the settings page component**

Create `clicker-platform-v2/lib/modules/campaigns/admin/CampaignsSettingsPage.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useSite } from '@/lib/site-context';
import { usePermission } from '@/components/admin/PermissionGuard';
import { getCampaignsSettings, updateCampaignsSettings } from '../api/settings';
import type { CampaignsSettings } from '../types';
import { DEFAULT_CAMPAIGNS_SETTINGS } from '../constants';

export default function CampaignsSettingsPage() {
    const { siteId } = useSite();
    const { isViewOnly } = usePermission();
    const [settings, setSettings] = useState<CampaignsSettings>(DEFAULT_CAMPAIGNS_SETTINGS);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!siteId) return;
        getCampaignsSettings(siteId).then(setSettings);
    }, [siteId]);

    const save = async () => {
        if (isViewOnly) return;
        setSaving(true);
        try {
            await updateCampaignsSettings(siteId, settings);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="p-6 max-w-2xl">
            <h1 className="text-2xl font-semibold mb-4">Campaigns Settings</h1>

            <label className="flex items-center gap-2 mb-3">
                <input
                    type="checkbox"
                    checked={settings.posBannerEnabled}
                    onChange={e => setSettings(s => ({ ...s, posBannerEnabled: e.target.checked }))}
                    disabled={isViewOnly}
                />
                <span>Enable banners on POS customer page</span>
            </label>

            <label className="block mb-3">
                <span className="block text-sm font-medium">Max POS banners shown at once</span>
                <input
                    type="number"
                    min={1} max={10}
                    value={settings.posBannerMaxCount}
                    onChange={e => setSettings(s => ({ ...s, posBannerMaxCount: Number(e.target.value) || 1 }))}
                    disabled={isViewOnly}
                    className="mt-1 block w-24 rounded border px-2 py-1"
                />
            </label>

            <label className="flex items-center gap-2 mb-6">
                <input
                    type="checkbox"
                    checked={settings.trackingEnabled}
                    onChange={e => setSettings(s => ({ ...s, trackingEnabled: e.target.checked }))}
                    disabled={isViewOnly}
                />
                <span>Track banner impressions & clicks (PostHog)</span>
            </label>

            <button
                type="button"
                disabled={isViewOnly || saving}
                onClick={save}
                className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
            >
                {saving ? 'Saving...' : 'Save'}
            </button>
        </div>
    );
}
```

- [ ] **Step 2: Create the static route**

Create `clicker-platform-v2/app/admin/(dashboard)/campaigns/settings/page.tsx`:

```typescript
import CampaignsSettingsPage from '@/lib/modules/campaigns/admin/CampaignsSettingsPage';

export default function Page() {
    return <CampaignsSettingsPage />;
}
```

- [ ] **Step 3: Smoke test**

Run: `cd clicker-platform-v2 && pnpm dev` in one terminal, then visit `http://localhost:3000/admin/campaigns/settings` (with a hydrated session). Confirm the page renders, defaults load, and Save is disabled for view-only users.

Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add clicker-platform-v2/lib/modules/campaigns/admin/CampaignsSettingsPage.tsx clicker-platform-v2/app/admin/\(dashboard\)/campaigns/settings/page.tsx
git commit -m "feat(campaigns): admin settings page"
```

---

### Task 18: Editor form pieces — TargetPicker + PlacementChips + ScheduleFields + AspectRatioToggle

**Files:**
- Create: `clicker-platform-v2/lib/modules/campaigns/admin/components/TargetPicker.tsx`
- Create: `clicker-platform-v2/lib/modules/campaigns/admin/components/PlacementChips.tsx`
- Create: `clicker-platform-v2/lib/modules/campaigns/admin/components/ScheduleFields.tsx`
- Create: `clicker-platform-v2/lib/modules/campaigns/admin/components/AspectRatioToggle.tsx`

- [ ] **Step 1: Create TargetPicker**

Create `clicker-platform-v2/lib/modules/campaigns/admin/components/TargetPicker.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useSite } from '@/lib/site-context';
import { listPromos } from '@/lib/modules/promo/api';
import type { Promo } from '@/lib/modules/promo/types';
import type { BannerTarget } from '../../types';

interface Props {
    value: BannerTarget;
    onChange: (v: BannerTarget) => void;
}

export function TargetPicker({ value, onChange }: Props) {
    const { siteId } = useSite();
    const [promos, setPromos] = useState<Promo[]>([]);

    useEffect(() => {
        if (!siteId) return;
        listPromos(siteId).then(setPromos);
    }, [siteId]);

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
                {(['promo', 'page', 'external', 'none'] as const).map(type => (
                    <label key={type} className="flex items-center gap-1 text-sm">
                        <input
                            type="radio"
                            checked={value.type === type}
                            onChange={() => onChange(
                                type === 'promo' ? { type: 'promo', promoId: '' } :
                                type === 'page' ? { type: 'page', pageSlug: '' } :
                                type === 'external' ? { type: 'external', url: '' } :
                                { type: 'none' }
                            )}
                        />
                        <span className="capitalize">{type === 'external' ? 'External URL' : type}</span>
                    </label>
                ))}
            </div>

            {value.type === 'promo' && (
                <div>
                    <select
                        value={value.promoId}
                        onChange={e => onChange({ type: 'promo', promoId: e.target.value })}
                        className="mt-1 block w-full rounded border px-2 py-1"
                    >
                        <option value="">— Select a promo —</option>
                        {promos.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    {value.promoId && (
                        <p className="mt-1 text-xs text-gray-500">
                            This banner shows eligible items based on the Promo&apos;s eligibleItems setting.{' '}
                            <a href={`/admin/promo/${value.promoId}`} className="underline">Edit promo</a>
                        </p>
                    )}
                </div>
            )}

            {value.type === 'page' && (
                <input
                    type="text"
                    placeholder="page-slug (e.g. about, menu)"
                    value={value.pageSlug}
                    onChange={e => onChange({ type: 'page', pageSlug: e.target.value })}
                    className="block w-full rounded border px-2 py-1"
                />
            )}

            {value.type === 'external' && (
                <input
                    type="url"
                    placeholder="https://..."
                    value={value.url}
                    onChange={e => onChange({ type: 'external', url: e.target.value })}
                    className="block w-full rounded border px-2 py-1"
                />
            )}
        </div>
    );
}
```

- [ ] **Step 2: Create PlacementChips**

Create `clicker-platform-v2/lib/modules/campaigns/admin/components/PlacementChips.tsx`:

```typescript
'use client';

import type { BannerPlacement } from '../../types';

const ALL: { id: BannerPlacement; label: string }[] = [
    { id: 'pos', label: 'POS customer page' },
    { id: 'site_block', label: 'Site block' },
    { id: 'links', label: 'Link-in-bio' },
];

interface Props {
    value: BannerPlacement[];
    onChange: (v: BannerPlacement[]) => void;
}

export function PlacementChips({ value, onChange }: Props) {
    const toggle = (p: BannerPlacement) => {
        onChange(value.includes(p) ? value.filter(v => v !== p) : [...value, p]);
    };
    return (
        <div className="flex flex-wrap gap-2">
            {ALL.map(p => {
                const on = value.includes(p.id);
                return (
                    <button
                        key={p.id}
                        type="button"
                        onClick={() => toggle(p.id)}
                        className={`rounded-full border px-3 py-1 text-sm ${on ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300'}`}
                    >
                        {p.label}
                    </button>
                );
            })}
        </div>
    );
}
```

- [ ] **Step 3: Create ScheduleFields**

Create `clicker-platform-v2/lib/modules/campaigns/admin/components/ScheduleFields.tsx`:

```typescript
'use client';

import { Timestamp } from 'firebase/firestore';

interface Props {
    startAt?: Timestamp;
    endAt?: Timestamp;
    onChange: (patch: { startAt?: Timestamp; endAt?: Timestamp }) => void;
}

function toInputValue(ts?: Timestamp): string {
    if (!ts) return '';
    const d = ts.toDate();
    return d.toISOString().slice(0, 16);
}

function fromInputValue(v: string): Timestamp | undefined {
    if (!v) return undefined;
    return Timestamp.fromDate(new Date(v));
}

export function ScheduleFields({ startAt, endAt, onChange }: Props) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
                <span className="block text-sm font-medium">Start</span>
                <input
                    type="datetime-local"
                    value={toInputValue(startAt)}
                    onChange={e => onChange({ startAt: fromInputValue(e.target.value) })}
                    className="mt-1 block w-full rounded border px-2 py-1"
                />
            </label>
            <label className="block">
                <span className="block text-sm font-medium">End</span>
                <input
                    type="datetime-local"
                    value={toInputValue(endAt)}
                    onChange={e => onChange({ endAt: fromInputValue(e.target.value) })}
                    className="mt-1 block w-full rounded border px-2 py-1"
                />
            </label>
        </div>
    );
}
```

- [ ] **Step 4: Create AspectRatioToggle**

Create `clicker-platform-v2/lib/modules/campaigns/admin/components/AspectRatioToggle.tsx`:

```typescript
'use client';

import type { BannerAspectRatio } from '../../types';

interface Props {
    value: BannerAspectRatio;
    onChange: (v: BannerAspectRatio) => void;
}

export function AspectRatioToggle({ value, onChange }: Props) {
    return (
        <div className="flex gap-2">
            {(['3:2', '3:1'] as const).map(r => (
                <button
                    key={r}
                    type="button"
                    onClick={() => onChange(r)}
                    className={`rounded border px-3 py-1 text-sm ${value === r ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300'}`}
                >
                    {r} {r === '3:2' ? '(card)' : '(hero)'}
                </button>
            ))}
        </div>
    );
}
```

- [ ] **Step 5: Type-check and commit**

```bash
cd clicker-platform-v2 && pnpm lint
git add clicker-platform-v2/lib/modules/campaigns/admin/components/
git commit -m "feat(campaigns): editor form pieces (target/placement/schedule/aspect)"
```

---

### Task 19: BannerForm + CampaignEditorClient

**Files:**
- Create: `clicker-platform-v2/lib/modules/campaigns/admin/components/BannerForm.tsx`
- Create: `clicker-platform-v2/lib/modules/campaigns/admin/CampaignEditorClient.tsx`

- [ ] **Step 1: Create BannerForm**

Create `clicker-platform-v2/lib/modules/campaigns/admin/components/BannerForm.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { MultiImageUpload } from '@/components/admin/MultiImageUpload';
import { BANNER_IMAGE_PATH } from '../../constants';
import type { Banner, BannerAspectRatio, BannerPlacement, BannerStatus, BannerTarget } from '../../types';
import { TargetPicker } from './TargetPicker';
import { PlacementChips } from './PlacementChips';
import { ScheduleFields } from './ScheduleFields';
import { AspectRatioToggle } from './AspectRatioToggle';
import type { Timestamp } from 'firebase/firestore';

export interface BannerDraft {
    title: string;
    image: string;
    altText?: string;
    aspectRatio: BannerAspectRatio;
    target: BannerTarget;
    placements: BannerPlacement[];
    status: BannerStatus;
    startAt?: Timestamp;
    endAt?: Timestamp;
}

interface Props {
    initial?: Partial<BannerDraft>;
    onSubmit: (draft: BannerDraft) => Promise<void>;
    isViewOnly?: boolean;
}

const EMPTY: BannerDraft = {
    title: '',
    image: '',
    altText: '',
    aspectRatio: '3:2',
    target: { type: 'none' },
    placements: [],
    status: 'draft',
};

export function BannerForm({ initial, onSubmit, isViewOnly }: Props) {
    const [draft, setDraft] = useState<BannerDraft>({ ...EMPTY, ...initial });
    const [submitting, setSubmitting] = useState(false);

    const update = (patch: Partial<BannerDraft>) => setDraft(d => ({ ...d, ...patch }));

    return (
        <form
            className="space-y-5 max-w-3xl"
            onSubmit={async e => {
                e.preventDefault();
                if (isViewOnly) return;
                setSubmitting(true);
                try {
                    await onSubmit(draft);
                } finally {
                    setSubmitting(false);
                }
            }}
        >
            <div>
                <label className="block text-sm font-medium mb-1">Title</label>
                <input
                    type="text"
                    value={draft.title}
                    onChange={e => update({ title: e.target.value })}
                    disabled={isViewOnly}
                    required
                    className="block w-full rounded border px-2 py-1"
                />
            </div>

            <div>
                <label className="block text-sm font-medium mb-1">Aspect Ratio</label>
                <AspectRatioToggle value={draft.aspectRatio} onChange={r => update({ aspectRatio: r })} />
                <p className="mt-1 text-xs text-gray-500">3:2 for cards (1200×800 min). 3:1 for hero (1500×500 min).</p>
            </div>

            <div>
                <label className="block text-sm font-medium mb-1">Banner Image</label>
                <MultiImageUpload
                    images={draft.image ? [draft.image] : []}
                    onImagesChange={imgs => update({ image: imgs[0] ?? '' })}
                    maxImages={1}
                />
            </div>

            <div>
                <label className="block text-sm font-medium mb-1">Alt Text (a11y / fallback)</label>
                <input
                    type="text"
                    value={draft.altText ?? ''}
                    onChange={e => update({ altText: e.target.value })}
                    disabled={isViewOnly}
                    className="block w-full rounded border px-2 py-1"
                />
            </div>

            <div>
                <label className="block text-sm font-medium mb-1">Click Target</label>
                <TargetPicker value={draft.target} onChange={t => update({ target: t })} />
            </div>

            <div>
                <label className="block text-sm font-medium mb-1">Placements</label>
                <PlacementChips value={draft.placements} onChange={p => update({ placements: p })} />
            </div>

            <div>
                <label className="block text-sm font-medium mb-1">Schedule</label>
                <ScheduleFields startAt={draft.startAt} endAt={draft.endAt} onChange={p => update(p)} />
            </div>

            <div>
                <label className="block text-sm font-medium mb-1">Status</label>
                <select
                    value={draft.status}
                    onChange={e => update({ status: e.target.value as BannerStatus })}
                    disabled={isViewOnly}
                    className="block rounded border px-2 py-1"
                >
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                    <option value="archived">Archived</option>
                </select>
            </div>

            <button
                type="submit"
                disabled={isViewOnly || submitting || !draft.title || !draft.image || draft.placements.length === 0}
                className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
            >
                {submitting ? 'Saving...' : 'Save Banner'}
            </button>
        </form>
    );
}
```

- [ ] **Step 2: Create the editor client**

Create `clicker-platform-v2/lib/modules/campaigns/admin/CampaignEditorClient.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSite } from '@/lib/site-context';
import { usePermission } from '@/components/admin/PermissionGuard';
import { getBanner, createBanner, updateBanner } from '../api/banners';
import { BannerForm, type BannerDraft } from './components/BannerForm';

interface Props {
    bannerId?: string; // omit → create mode
}

export default function CampaignEditorClient({ bannerId }: Props) {
    const { siteId } = useSite();
    const { isViewOnly } = usePermission();
    const router = useRouter();
    const [initial, setInitial] = useState<Partial<BannerDraft> | undefined>(bannerId ? undefined : {});

    useEffect(() => {
        if (!bannerId || !siteId) return;
        getBanner(siteId, bannerId).then(b => {
            if (!b) return;
            setInitial({
                title: b.title, image: b.image, altText: b.altText,
                aspectRatio: b.aspectRatio, target: b.target, placements: b.placements,
                status: b.status, startAt: b.startAt, endAt: b.endAt,
            });
        });
    }, [bannerId, siteId]);

    if (initial === undefined) return <div className="p-6">Loading...</div>;

    const onSubmit = async (draft: BannerDraft) => {
        if (bannerId) {
            await updateBanner(siteId, bannerId, draft);
        } else {
            await createBanner(siteId, draft);
        }
        router.push('/admin/campaigns');
    };

    return (
        <div className="p-6">
            <h1 className="text-2xl font-semibold mb-4">{bannerId ? 'Edit Banner' : 'New Banner'}</h1>
            <BannerForm initial={initial} onSubmit={onSubmit} isViewOnly={isViewOnly} />
        </div>
    );
}
```

- [ ] **Step 3: Wire static routes**

Create `clicker-platform-v2/app/admin/(dashboard)/campaigns/new/page.tsx`:

```typescript
import CampaignEditorClient from '@/lib/modules/campaigns/admin/CampaignEditorClient';
export default function Page() { return <CampaignEditorClient />; }
```

Create `clicker-platform-v2/app/admin/(dashboard)/campaigns/[id]/page.tsx`:

```typescript
import CampaignEditorClient from '@/lib/modules/campaigns/admin/CampaignEditorClient';

interface Props { params: Promise<{ id: string }>; }

export default async function Page({ params }: Props) {
    const { id } = await params;
    return <CampaignEditorClient bannerId={id} />;
}
```

- [ ] **Step 4: Lint and commit**

```bash
cd clicker-platform-v2 && pnpm lint
git add clicker-platform-v2/lib/modules/campaigns/admin/components/BannerForm.tsx clicker-platform-v2/lib/modules/campaigns/admin/CampaignEditorClient.tsx clicker-platform-v2/app/admin/\(dashboard\)/campaigns/new/page.tsx clicker-platform-v2/app/admin/\(dashboard\)/campaigns/\[id\]/page.tsx
git commit -m "feat(campaigns): banner form + create/edit pages"
```

---

### Task 20: CampaignsListClient + list route

**Files:**
- Create: `clicker-platform-v2/lib/modules/campaigns/admin/CampaignsListClient.tsx`
- Create: `clicker-platform-v2/app/admin/(dashboard)/campaigns/page.tsx`

- [ ] **Step 1: Create the list client**

Create `clicker-platform-v2/lib/modules/campaigns/admin/CampaignsListClient.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSite } from '@/lib/site-context';
import { usePermission } from '@/components/admin/PermissionGuard';
import { listBanners, reorderBanners, setBannerStatus, deleteBanner } from '../api/banners';
import type { Banner } from '../types';

export default function CampaignsListClient() {
    const { siteId } = useSite();
    const { isViewOnly } = usePermission();
    const [banners, setBanners] = useState<Banner[]>([]);
    const [loading, setLoading] = useState(true);

    const refresh = async () => {
        if (!siteId) return;
        setLoading(true);
        const list = await listBanners(siteId);
        setBanners(list);
        setLoading(false);
    };

    useEffect(() => { refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [siteId]);

    const move = async (id: string, direction: -1 | 1) => {
        if (isViewOnly) return;
        const idx = banners.findIndex(b => b.id === id);
        const newIdx = idx + direction;
        if (idx < 0 || newIdx < 0 || newIdx >= banners.length) return;
        const reordered = [...banners];
        [reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]];
        setBanners(reordered);
        await reorderBanners(siteId, reordered.map(b => b.id));
    };

    return (
        <div className="p-6">
            <div className="flex items-center justify-between mb-4">
                <h1 className="text-2xl font-semibold">Campaigns</h1>
                {!isViewOnly && (
                    <Link href="/admin/campaigns/new" className="rounded bg-blue-600 px-4 py-2 text-white text-sm">
                        + New Banner
                    </Link>
                )}
            </div>

            {loading && <div className="text-gray-500">Loading...</div>}

            <div className="space-y-2">
                {banners.map((b, i) => (
                    <div key={b.id} className="flex items-center gap-3 rounded border p-2">
                        <div className="flex flex-col gap-0.5">
                            <button type="button" disabled={isViewOnly || i === 0} onClick={() => move(b.id, -1)} aria-label="Move up" className="text-xs disabled:opacity-30">▲</button>
                            <button type="button" disabled={isViewOnly || i === banners.length - 1} onClick={() => move(b.id, 1)} aria-label="Move down" className="text-xs disabled:opacity-30">▼</button>
                        </div>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={b.image} alt="" className="h-12 w-20 object-cover rounded" />
                        <div className="flex-1 min-w-0">
                            <Link href={`/admin/campaigns/${b.id}`} className="font-medium hover:underline truncate block">{b.title}</Link>
                            <div className="text-xs text-gray-500">
                                {b.placements.join(', ')} · {b.target.type}
                            </div>
                        </div>
                        <div className="text-xs text-right">
                            <div>👁 {b.impressionCount}</div>
                            <div>👆 {b.clickCount}</div>
                        </div>
                        <select
                            value={b.status}
                            onChange={e => setBannerStatus(siteId, b.id, e.target.value as any).then(refresh)}
                            disabled={isViewOnly}
                            className="rounded border px-2 py-1 text-sm"
                        >
                            <option value="draft">Draft</option>
                            <option value="active">Active</option>
                            <option value="paused">Paused</option>
                            <option value="archived">Archived</option>
                        </select>
                        {b.status === 'archived' && !isViewOnly && (
                            <button
                                type="button"
                                onClick={async () => {
                                    if (!confirm(`Delete banner "${b.title}"?`)) return;
                                    await deleteBanner(siteId, b.id);
                                    await refresh();
                                }}
                                className="text-red-600 text-xs"
                            >
                                Delete
                            </button>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Create the list page route**

Create `clicker-platform-v2/app/admin/(dashboard)/campaigns/page.tsx`:

```typescript
import CampaignsListClient from '@/lib/modules/campaigns/admin/CampaignsListClient';
export default function Page() { return <CampaignsListClient />; }
```

- [ ] **Step 3: Lint and commit**

```bash
cd clicker-platform-v2 && pnpm lint
git add clicker-platform-v2/lib/modules/campaigns/admin/CampaignsListClient.tsx clicker-platform-v2/app/admin/\(dashboard\)/campaigns/page.tsx
git commit -m "feat(campaigns): admin list page with reorder + inline status + delete"
```

---

## Phase 6 — Module registration

### Task 21: Register module in platform definitions + components + backyard + seed

**Files:**
- Modify: `clicker-platform-v2/lib/modules/definitions.ts`
- Modify: `clicker-platform-v2/lib/modules/components.tsx`
- Modify: `backyard/lib/modules/definitions.ts`
- Modify: `clicker-platform-v2/scripts/seed-modules.ts`

- [ ] **Step 1: Read current shape of definitions.ts**

Run: `grep -n "STATIC_MODULE_DEFINITIONS\b" clicker-platform-v2/lib/modules/definitions.ts | head -5`

Find an existing module entry (e.g. promo) to mimic its shape exactly. Read the structure:

Run: `sed -n '/STATIC_MODULE_DEFINITIONS\[.promo.\]/,/^\};\|^],$/p' clicker-platform-v2/lib/modules/definitions.ts | head -40`

- [ ] **Step 2: Add the campaigns entry to platform definitions**

In `clicker-platform-v2/lib/modules/definitions.ts`, add a new entry (place near the promo entry to keep related modules together). Match the existing style. The entry:

```typescript
STATIC_MODULE_DEFINITIONS['campaigns'] = {
    id: 'campaigns',
    displayName: 'Campaigns',
    description: 'Banners and promotional campaigns across POS, site, and links',
    icon: 'megaphone',
    adminRoutes: [
        { label: 'Campaigns', path: '/admin/campaigns', icon: 'megaphone', componentKey: 'campaigns:CampaignsList' },
        { label: 'New', path: '/admin/campaigns/new', icon: 'megaphone', componentKey: 'campaigns:CampaignEditor', hidden: true },
        { label: 'Edit', path: '/admin/campaigns/[id]', icon: 'megaphone', componentKey: 'campaigns:CampaignEditor', hidden: true },
        { label: 'Settings', path: '/admin/campaigns/settings', icon: 'settings', permission: 'manage_content', componentKey: 'campaigns:CampaignsSettings' },
    ],
};
```

Adjust property names if the existing shape uses different naming (e.g. `routes` vs `adminRoutes`, `iconName` vs `icon`) — keep parity with the promo entry.

- [ ] **Step 3: Register components in components.tsx**

In `clicker-platform-v2/lib/modules/components.tsx`, add the three dynamic imports near the other module imports:

```typescript
const CampaignsList = dynamic(() => import('@/lib/modules/campaigns/admin/CampaignsListClient'));
const CampaignEditor = dynamic(() => import('@/lib/modules/campaigns/admin/CampaignEditorClient'));
const CampaignsSettings = dynamic(() => import('@/lib/modules/campaigns/admin/CampaignsSettingsPage'));
```

Then in the `MODULE_COMPONENTS` map, add:

```typescript
'campaigns:CampaignsList': CampaignsList,
'campaigns:CampaignEditor': CampaignEditor,
'campaigns:CampaignsSettings': CampaignsSettings,
```

- [ ] **Step 4: Mirror in backyard**

In `backyard/lib/modules/definitions.ts`, add the matching entry with at least `id`, `displayName`, `description`, `adminRoutes`. Match the same shape used by other modules in that file.

- [ ] **Step 5: Add seed entry**

In `clicker-platform-v2/scripts/seed-modules.ts`, add `campaigns` to the modules array with the same fields as adjacent modules (`id: 'campaigns'`, `enabled: true`, etc).

- [ ] **Step 6: Lint and start dev**

```bash
cd clicker-platform-v2 && pnpm lint
```

Then in a separate terminal: `pnpm dev`, set `sites/{testSite}.modules.campaigns = true` in Firestore, and confirm "Campaigns" appears in the admin sidebar with a working link.

Stop the dev server.

- [ ] **Step 7: Commit**

```bash
git add clicker-platform-v2/lib/modules/definitions.ts clicker-platform-v2/lib/modules/components.tsx backyard/lib/modules/definitions.ts clicker-platform-v2/scripts/seed-modules.ts
git commit -m "feat(campaigns): three-way module registration + seed"
```

---

## Phase 7 — Canvas Studio block

### Task 22: Register `banner` block type

**Files:**
- Modify: `clicker-platform-v2/data/mockData.ts` (extend BlockType union)
- Modify: `clicker-platform-v2/components/admin/blocks/blockDefinitions.ts` (BLOCK_OPTIONS + getDefaultData)
- Create: `clicker-platform-v2/components/blocks/banner/types.ts`
- Create: `clicker-platform-v2/components/blocks/banner/renderer.tsx`
- Create: `clicker-platform-v2/components/admin/blocks/forms/BannerBlockForm.tsx`
- Modify: `clicker-platform-v2/components/admin/blocks/BlockFormRenderer.tsx` (wire BannerBlockForm)
- Modify: `clicker-platform-v2/components/blocks/BlockRenderer.tsx` (case 'banner')

- [ ] **Step 1: Extend BlockType union**

In `clicker-platform-v2/data/mockData.ts:30`, append `| 'banner'` to the BlockType union (before `| string`).

- [ ] **Step 2: Create banner block types**

Create `clicker-platform-v2/components/blocks/banner/types.ts`:

```typescript
export type BannerBlockLayout = 'strip' | 'hero';

export interface BannerBlockData {
    layout: BannerBlockLayout;
    maxBanners: number;
    rotationIntervalMs?: number;
}

export const DEFAULT_BANNER_BLOCK_DATA: BannerBlockData = {
    layout: 'strip',
    maxBanners: 6,
    rotationIntervalMs: 6000,
};
```

- [ ] **Step 3: Register in blockDefinitions**

In `clicker-platform-v2/components/admin/blocks/blockDefinitions.ts`:

- Add import: `import { DEFAULT_BANNER_BLOCK_DATA } from '@/components/blocks/banner/types';`
- Add icon import: extend the `lucide-react` import to include `Megaphone`
- Add to `BLOCK_OPTIONS`: `{ type: 'banner', label: 'Banner', icon: Megaphone },`
- Add case in `getDefaultData`:

```typescript
case 'banner':
    return { ...baseData, ...DEFAULT_BANNER_BLOCK_DATA };
```

- [ ] **Step 4: Create BannerBlockForm**

Create `clicker-platform-v2/components/admin/blocks/forms/BannerBlockForm.tsx`:

```typescript
'use client';

import type { BannerBlockData } from '@/components/blocks/banner/types';
import { DEFAULT_BANNER_BLOCK_DATA } from '@/components/blocks/banner/types';

interface Props {
    data: BannerBlockData;
    onChange: (data: BannerBlockData) => void;
}

export function BannerBlockForm({ data, onChange }: Props) {
    const safe: BannerBlockData = { ...DEFAULT_BANNER_BLOCK_DATA, ...data };
    const update = (patch: Partial<BannerBlockData>) => onChange({ ...safe, ...patch });

    return (
        <div className="space-y-4">
            <div>
                <label className="block text-sm font-medium mb-1">Layout</label>
                <div className="flex gap-2">
                    {(['strip', 'hero'] as const).map(l => (
                        <button
                            key={l}
                            type="button"
                            onClick={() => update({ layout: l })}
                            className={`rounded border px-3 py-1 text-sm ${safe.layout === l ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300'}`}
                        >
                            {l === 'strip' ? 'Card strip' : 'Hero (single, rotates)'}
                        </button>
                    ))}
                </div>
            </div>

            <label className="block">
                <span className="block text-sm font-medium">Max banners</span>
                <input
                    type="number"
                    min={1} max={20}
                    value={safe.maxBanners}
                    onChange={e => update({ maxBanners: Math.max(1, Number(e.target.value) || 1) })}
                    className="mt-1 block w-24 rounded border px-2 py-1"
                />
            </label>

            {safe.layout === 'hero' && (
                <label className="block">
                    <span className="block text-sm font-medium">Rotation interval (ms)</span>
                    <input
                        type="number"
                        min={1000} step={500}
                        value={safe.rotationIntervalMs ?? 6000}
                        onChange={e => update({ rotationIntervalMs: Math.max(1000, Number(e.target.value) || 6000) })}
                        className="mt-1 block w-32 rounded border px-2 py-1"
                    />
                </label>
            )}

            <p className="text-xs text-gray-500">
                Banners are managed in <a href="/admin/campaigns" className="underline">Campaigns</a>. This block shows all active banners with the &quot;Site block&quot; placement.
            </p>
        </div>
    );
}
```

- [ ] **Step 5: Wire BannerBlockForm in BlockFormRenderer**

In `clicker-platform-v2/components/admin/blocks/BlockFormRenderer.tsx`, near the other dynamic form imports:

```typescript
const BannerBlockForm = dynamic(() => import('./forms/BannerBlockForm').then(mod => mod.BannerBlockForm), { loading: () => <FormSkeleton /> });
```

Find the switch/map that picks a form by type and add a `'banner'` case that returns `<BannerBlockForm data={data} onChange={onChange} />`.

- [ ] **Step 6: Create the renderer**

Create `clicker-platform-v2/components/blocks/banner/renderer.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useSite } from '@/lib/site-context';
import { getActiveBanners } from '@/lib/modules/campaigns/api/queries';
import { getCampaignsSettings } from '@/lib/modules/campaigns/api/settings';
import type { Banner, CampaignsSettings } from '@/lib/modules/campaigns/types';
import { BannerStrip } from '@/lib/modules/campaigns/components/BannerStrip';
import { BannerHero } from '@/lib/modules/campaigns/components/BannerHero';
import type { BannerBlockData } from './types';

interface Props {
    data: BannerBlockData;
}

export function BannerBlockRenderer({ data }: Props) {
    const { siteId } = useSite();
    const [banners, setBanners] = useState<Banner[]>([]);
    const [settings, setSettings] = useState<CampaignsSettings | null>(null);

    useEffect(() => {
        if (!siteId) return;
        let cancelled = false;
        (async () => {
            const [s, b] = await Promise.all([
                getCampaignsSettings(siteId),
                getActiveBanners(siteId, 'site_block'),
            ]);
            if (cancelled) return;
            setSettings(s);
            setBanners(b);
        })();
        return () => { cancelled = true; };
    }, [siteId]);

    if (!settings) return null;
    const limited = banners.slice(0, data.maxBanners);
    if (limited.length === 0) return null;

    if (data.layout === 'hero') {
        return (
            <BannerHero
                banners={limited}
                placement="site_block"
                settings={settings}
                rotationIntervalMs={data.rotationIntervalMs ?? 6000}
            />
        );
    }
    return <BannerStrip banners={limited} placement="site_block" settings={settings} />;
}
```

- [ ] **Step 7: Add case in BlockRenderer.tsx**

In `clicker-platform-v2/components/blocks/BlockRenderer.tsx`, locate the switch that maps block.type to a renderer. Near the `case 'feature_cards':` (line ~192), add:

```typescript
case 'banner':
    return <BannerBlockRenderer data={block.data} />;
```

And add the import near the top:

```typescript
import { BannerBlockRenderer } from './banner/renderer';
```

- [ ] **Step 8: Lint and smoke test**

```bash
cd clicker-platform-v2 && pnpm lint
```

Start dev server: `pnpm dev`. In a Canvas Studio page, add a "Banner" block, save, then visit the public page and confirm banners (already created in /admin/campaigns with `site_block` placement) render.

Stop dev server.

- [ ] **Step 9: Commit**

```bash
git add clicker-platform-v2/data/mockData.ts clicker-platform-v2/components/admin/blocks/blockDefinitions.ts clicker-platform-v2/components/blocks/banner/ clicker-platform-v2/components/admin/blocks/forms/BannerBlockForm.tsx clicker-platform-v2/components/admin/blocks/BlockFormRenderer.tsx clicker-platform-v2/components/blocks/BlockRenderer.tsx
git commit -m "feat(campaigns): Canvas Studio 'banner' block with strip/hero layouts"
```

---

## Phase 8 — Surface integration: POS + public promo page

### Task 23: Wire POSBannerStrip into POSWidget

**Files:**
- Modify: `clicker-platform-v2/lib/modules/byod_pos/components/POSWidget.tsx`

- [ ] **Step 1: Locate the POSWidget insertion point**

Run: `grep -n "category\|categories\|tabs" clicker-platform-v2/lib/modules/byod_pos/components/POSWidget.tsx | head -10`

Identify where the category tabs are rendered (look for the search input or a tabs container near the top of the JSX).

- [ ] **Step 2: Render POSBannerStrip above the category tabs**

In `clicker-platform-v2/lib/modules/byod_pos/components/POSWidget.tsx`, add at the top of the file:

```typescript
import { POSBannerStrip } from '@/lib/modules/campaigns/components/POSBannerStrip';
import { isModuleEnabled } from '@/lib/modules/registry';
import { useEffect, useState } from 'react';
```

Add an effect inside the component to check whether the campaigns module is enabled for the site:

```typescript
const [campaignsEnabled, setCampaignsEnabled] = useState(false);
useEffect(() => {
    isModuleEnabled('campaigns').then(setCampaignsEnabled);
}, []);
```

In the JSX, place `{campaignsEnabled && siteId && <POSBannerStrip siteId={siteId} />}` after the search input and before the category tab row.

- [ ] **Step 3: Lint**

Run: `cd clicker-platform-v2 && pnpm lint`
Expected: passes.

- [ ] **Step 4: Smoke test**

Start dev, open the POS customer page on a site that has `modules.campaigns = true` and an active POS-placement banner. Confirm the banner strip appears above the categories.

- [ ] **Step 5: Commit**

```bash
git add clicker-platform-v2/lib/modules/byod_pos/components/POSWidget.tsx
git commit -m "feat(campaigns): mount POSBannerStrip in POSWidget above category tabs"
```

---

### Task 24: Public promo detail page `/promo/[promoId]`

**Files:**
- Create: `clicker-platform-v2/app/promo/[promoId]/page.tsx`

- [ ] **Step 1: Create the page**

Create `clicker-platform-v2/app/promo/[promoId]/page.tsx`:

```typescript
import { notFound } from 'next/navigation';
import { adminDb } from '@/lib/firebase-admin';
import { listActiveBannersAdmin } from '@/lib/modules/campaigns/api-admin';
import { getPromo } from '@/lib/modules/promo/api';
import { resolvePromoTarget } from '@/lib/modules/campaigns/api/queries';
import { BannerImage } from '@/lib/modules/campaigns/components/BannerImage';

interface Props {
    params: Promise<{ promoId: string }>;
}

async function getSiteIdFromHeaders(): Promise<string | null> {
    const { headers } = await import('next/headers');
    const h = await headers();
    return h.get('x-site-id');
}

export default async function PromoDetailPage({ params }: Props) {
    const { promoId } = await params;
    const siteId = await getSiteIdFromHeaders();
    if (!siteId) notFound();

    const { promo, eligibleProducts } = await resolvePromoTarget(siteId, promoId);
    if (!promo) notFound();

    const banners = await listActiveBannersAdmin(siteId, 'site_block');
    const hero = banners.find(b => b.target.type === 'promo' && b.target.promoId === promoId);

    return (
        <main className="mx-auto max-w-3xl px-4 py-6">
            {hero ? (
                <BannerImage src={hero.image} aspectRatio={hero.aspectRatio} alt={hero.altText ?? promo.name} className="mb-6" />
            ) : (
                <h1 className="text-3xl font-semibold mb-4">{promo.name}</h1>
            )}
            {hero && <h1 className="text-3xl font-semibold mb-4">{promo.name}</h1>}
            {promo.description && <p className="text-gray-700 mb-6">{promo.description}</p>}

            {eligibleProducts.length > 0 ? (
                <section>
                    <h2 className="text-xl font-medium mb-3">Eligible items</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {eligibleProducts.map(item => (
                            <div key={item.id} className="rounded-lg border p-3">
                                <div className="font-medium">{item.name}</div>
                                {typeof (item as any).price === 'number' && (
                                    <div className="text-sm text-gray-500">Rp {(item as any).price.toLocaleString('id-ID')}</div>
                                )}
                            </div>
                        ))}
                    </div>
                </section>
            ) : (
                <p className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-blue-800">
                    This promo applies to your whole order.
                </p>
            )}
        </main>
    );
}
```

- [ ] **Step 2: Lint and smoke test**

```bash
cd clicker-platform-v2 && pnpm lint
```

Start dev, visit `/promo/{some-promo-id}` on a tenant subdomain. Confirm the page renders for both promos with and without `eligibleItems`.

Stop dev server.

- [ ] **Step 3: Commit**

```bash
git add clicker-platform-v2/app/promo/\[promoId\]/page.tsx
git commit -m "feat(campaigns): public /promo/[id] detail page with banner hero"
```

---

## Phase 9 — Final verification

### Task 25: Full verification pass

- [ ] **Step 1: Run full test suite**

Run: `cd clicker-platform-v2 && pnpm test`
Expected: all tests pass (including pre-existing tests untouched).

- [ ] **Step 2: Run lint**

Run: `cd clicker-platform-v2 && pnpm lint`
Expected: no errors.

- [ ] **Step 3: Production build**

Run: `cd clicker-platform-v2 && pnpm build`
Expected: build succeeds.

- [ ] **Step 4: End-to-end smoke test (manual, in dev)**

Start `pnpm dev`. On a test tenant with `modules.campaigns = true`:

1. Visit `/admin/campaigns` — list renders.
2. Click "+ New Banner" — form opens.
3. Upload an image, set title, pick a Promo target, select POS + Site Block + Links placements, set status=active. Save.
4. Returned to list — banner appears with counters at 0.
5. Visit POS customer page — banner strip renders above category tabs.
6. Tap the banner — bottom sheet opens with the promo details (and eligible items if the promo has `eligibleItems`).
7. Add a "Banner" block to a Canvas Studio page, layout=strip — verify renders. Switch to layout=hero, verify rotation.
8. Visit the Link-in-bio page (Links) — banner renders between links.
9. Visit `/promo/{promoId}` directly — page renders with hero (when a site_block banner targets it).
10. Reload the POS page — counters in `/admin/campaigns` show >0 impressions and clicks within a minute.

- [ ] **Step 5: Add `dev` worktree note to commit**

```bash
git status
git log --oneline -25
```

Confirm history is clean (one commit per task, sensible messages).

- [ ] **Step 6: Final commit (only if anything tweaked during smoke)**

If any small fixes are needed from the smoke test, commit them with `fix(campaigns): ...` messages.

---

## Self-Review

**Spec coverage check (versus `2026-05-14-campaigns-module-design.md`):**

- §1 Goal — covered end to end (Tasks 1–24)
- §2 Why new module — Task 1 (additive promo change) preserves boundary
- §3 Module boundary — Tasks 7, 24 are the only cross-module touches and both go through facades ✓
- §4.1 Banner schema — Task 2, 5 (CRUD) ✓
- §4.2 Settings — Task 2, 4 ✓
- §4.3 Promo eligibleItems — Task 1 ✓
- §4.4 Image specs / rendering model — Tasks 10, 12, 13 (BannerImage + Strip + Hero) ✓
- §4.5 Path constants — Task 3 ✓
- §5 Public API facade — Task 9 ✓
- §6.1 Admin routes — Tasks 17, 19, 20 ✓
- §6.2 Editor form fields — Tasks 18, 19 ✓
- §6.3 RBAC — Tasks 17, 19, 20 use `usePermission().isViewOnly` ✓
- §7.1 POSBannerStrip — Task 15 ✓
- §7.2 BannerBlock (strip + hero) — Tasks 13, 22 ✓
- §7.3 LinkBannerItem — Task 16 ✓
- §7.4 PromoBannerSheet + /promo/[id] page — Tasks 14, 24 ✓
- §8 Tracking — Task 8 ✓
- §9 Module registration — Task 21 ✓
- §10 File layout — matches plan ✓
- §11 Critical rules — `'use client'`, siteId from useSite, undefined strip, etc. all enforced in tasks ✓
- §12 Open questions — appropriately deferred (audience targeting, device targeting, email banners not in plan)

**Placeholder scan:** none — all code is concrete.

**Type consistency:**
- `Banner.aspectRatio` used identically in Tasks 2, 10, 19, 22 ✓
- `BannerTarget` discriminated union used identically in Tasks 2, 12, 18 ✓
- `CampaignsSettings` shape consistent across Tasks 2, 4, 11, 15 ✓
- `handleBannerClick` signature matches between definition (Task 12) and consumers (Tasks 12, 13, 16) ✓
- `useImpressionTracker` signature matches between definition (Task 11) and consumers (Tasks 12, 13, 16) ✓
- `resolvePromoTarget` return shape `{ promo, eligibleProducts }` matches between Task 7 (impl) and Tasks 14, 24 (consumers) ✓

Plan is complete and internally consistent.
