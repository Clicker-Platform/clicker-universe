# Font Packs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a curated Font Pack picker inside Canvas Studio's new "Site Styles" slide-over panel, with 8 starter packs and site-level persistence.

**Architecture:** Static `next/font/google` imports register 13 unique Google Font families with stable `--font-{slug}` CSS variables. A frozen `FontPack[]` catalog maps pack ids to heading + body variables. The new `SiteStylesPanel` slide-over reads/writes `sites/{siteId}/appearance/styles` Firestore doc and optimistically swaps `--font-heading` / `--font-body` on the canvas root. `ThemeRegistry` SSR-emits those same CSS vars on the public site.

**Tech Stack:** Next.js 16 App Router, `next/font/google`, React 19, Firestore (client SDK + Firebase Admin via existing wrappers), TypeScript, Tailwind v4, Vitest.

**Spec reference:** [`superpowers/specs/2026-05-18-font-packs-design.md`](../specs/2026-05-18-font-packs-design.md)

**Key existing facts (verified):**

- `globals.css` already uses `var(--font-heading, …)` and `var(--font-body, …)` — the CSS-var indirection layer the spec depends on **already exists**. We only need to populate the vars.
- `app/layout.tsx` currently imports only `Figtree` (as `--font-jakarta`) and `Space_Mono` (as `--font-space`). We'll add the 13 pack families alongside.
- `CanvasStudio.tsx` uses a `slideOverPanel` discriminated string union (`'links' | 'forms' | 'products' | 'siteinfo' | 'branding' | null`) and dynamic-imports each panel. We'll add `'sitestyles'` to the union.
- `BrandingPanel` already exists for logos/colors — it does **not** include typography. Site Styles is a new sibling panel, not a replacement.
- `fetchSiteSettings` lives at `lib/fetchData.ts:221`.
- `ThemeRegistry.tsx` is the SSR style injector — it already accepts `initialSettings` and emits a `<style>` block.

---

## File Structure

**Create:**

| Path | Responsibility |
|------|----------------|
| `clicker-platform-v2/lib/fonts/packs.ts` | Frozen `FontPack[]` catalog + `getPackById` helper + `DEFAULT_PACK_ID` |
| `clicker-platform-v2/lib/fonts/types.ts` | `FontPack` type |
| `clicker-platform-v2/lib/fonts/__tests__/packs.test.ts` | Catalog integrity tests (every cssVar is known) |
| `clicker-platform-v2/lib/appearance/api.ts` | `getAppearanceStyles(siteId)` + `setFontPackId(siteId, packId)` |
| `clicker-platform-v2/lib/appearance/types.ts` | `AppearanceStyles` type |
| `clicker-platform-v2/lib/appearance/__tests__/api.test.ts` | Read/write round-trip tests (mocked Firestore) |
| `clicker-platform-v2/components/admin/blocks/panels/SiteStylesPanel.tsx` | Slide-over root; section nav (Fonts active, others "coming soon") |
| `clicker-platform-v2/components/admin/blocks/panels/site-styles/FontsSection.tsx` | Header strip + card list |
| `clicker-platform-v2/components/admin/blocks/panels/site-styles/FontPackCard.tsx` | Single pack card (heading + body sample, ring + checkmark when active) |
| `clicker-platform-v2/components/admin/blocks/panels/site-styles/ComingSoonTile.tsx` | Disabled section placeholder |
| `clicker-platform-v2/components/admin/blocks/panels/__tests__/SiteStylesPanel.test.tsx` | Renders, click commits, reset works |

**Modify:**

| Path | Change |
|------|--------|
| `clicker-platform-v2/app/layout.tsx` | Import 13 Google Font families with `--font-{slug}` variables; attach class names to `<body>` |
| `clicker-platform-v2/components/ThemeRegistry.tsx` | Accept optional `appearanceStyles` prop; emit `--font-heading` / `--font-body` when a pack is set |
| `clicker-platform-v2/lib/fetchData.ts` | Add `fetchAppearanceStyles(siteId)` and call it in the layout fetch path |
| `clicker-platform-v2/components/admin/blocks/CanvasStudio.tsx` | Add `'sitestyles'` to union; add toolbar button + keyboard shortcut + slide-over branch |

**Unchanged:**

- `lib/templates/definitions.ts` (`fonts` field stays as fallback)
- Legacy `settings.fontFamily` injection in `ThemeRegistry` (precedence: Font Pack > legacy fontFamily > template default)

---

## Task 1: Define the FontPack type and pack catalog

**Files:**

- Create: `clicker-platform-v2/lib/fonts/types.ts`
- Create: `clicker-platform-v2/lib/fonts/packs.ts`
- Test: `clicker-platform-v2/lib/fonts/__tests__/packs.test.ts`

- [ ] **Step 1: Write the failing test**

Create `clicker-platform-v2/lib/fonts/__tests__/packs.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { FONT_PACKS, getPackById, DEFAULT_PACK_ID, KNOWN_CSS_VARS } from '../packs';

describe('FONT_PACKS catalog', () => {
  it('ships at least 8 packs', () => {
    expect(FONT_PACKS.length).toBeGreaterThanOrEqual(8);
  });

  it('every pack has a unique id', () => {
    const ids = FONT_PACKS.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every pack references known CSS variables', () => {
    for (const pack of FONT_PACKS) {
      expect(KNOWN_CSS_VARS).toContain(pack.heading.cssVar);
      expect(KNOWN_CSS_VARS).toContain(pack.body.cssVar);
    }
  });

  it('DEFAULT_PACK_ID resolves to a real pack', () => {
    expect(getPackById(DEFAULT_PACK_ID)).toBeDefined();
  });

  it('getPackById returns undefined for unknown ids', () => {
    expect(getPackById('not-a-real-pack')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd clicker-platform-v2 && pnpm test lib/fonts`
Expected: FAIL — `Cannot find module '../packs'`

- [ ] **Step 3: Create the type file**

Create `clicker-platform-v2/lib/fonts/types.ts`:

```typescript
export type FontSlot = {
  family: string;
  cssVar: string;
  weights: number[];
};

export type FontPack = {
  id: string;
  name: string;
  description?: string;
  category: 'serif' | 'sans' | 'display' | 'mixed';
  heading: FontSlot;
  body: FontSlot;
};
```

- [ ] **Step 4: Create the catalog**

Create `clicker-platform-v2/lib/fonts/packs.ts`:

```typescript
import type { FontPack } from './types';

export const KNOWN_CSS_VARS = [
  '--font-inter',
  '--font-inter-tight',
  '--font-outfit',
  '--font-dm-sans',
  '--font-playfair',
  '--font-lora',
  '--font-fraunces',
  '--font-archivo',
  '--font-archivo-black',
  '--font-space-grotesk',
  '--font-dm-serif-display',
  '--font-quicksand',
  '--font-montserrat',
] as const;

export const FONT_PACKS: ReadonlyArray<FontPack> = Object.freeze([
  {
    id: 'clean-minimal',
    name: 'Clean Minimal',
    category: 'sans',
    heading: { family: 'Inter', cssVar: '--font-inter', weights: [600, 700] },
    body: { family: 'Inter Tight', cssVar: '--font-inter-tight', weights: [400, 500] },
  },
  {
    id: 'modern-geometric',
    name: 'Modern Geometric',
    category: 'sans',
    heading: { family: 'Outfit', cssVar: '--font-outfit', weights: [600, 700] },
    body: { family: 'DM Sans', cssVar: '--font-dm-sans', weights: [400, 500] },
  },
  {
    id: 'editorial-serif',
    name: 'Editorial Serif',
    category: 'serif',
    heading: { family: 'Playfair Display', cssVar: '--font-playfair', weights: [600, 700] },
    body: { family: 'Lora', cssVar: '--font-lora', weights: [400, 500] },
  },
  {
    id: 'modern-magazine',
    name: 'Modern Magazine',
    category: 'mixed',
    heading: { family: 'Fraunces', cssVar: '--font-fraunces', weights: [600, 700] },
    body: { family: 'Inter', cssVar: '--font-inter', weights: [400, 500] },
  },
  {
    id: 'bold-display',
    name: 'Bold Display',
    category: 'display',
    heading: { family: 'Archivo Black', cssVar: '--font-archivo-black', weights: [400] },
    body: { family: 'Archivo', cssVar: '--font-archivo', weights: [400, 500] },
  },
  {
    id: 'brutalist',
    name: 'Brutalist',
    category: 'mixed',
    heading: { family: 'Space Grotesk', cssVar: '--font-space-grotesk', weights: [600, 700] },
    body: { family: 'Inter', cssVar: '--font-inter', weights: [400, 500] },
  },
  {
    id: 'warm-friendly',
    name: 'Warm Friendly',
    category: 'mixed',
    heading: { family: 'DM Serif Display', cssVar: '--font-dm-serif-display', weights: [400] },
    body: { family: 'DM Sans', cssVar: '--font-dm-sans', weights: [400, 500] },
  },
  {
    id: 'rounded-soft',
    name: 'Rounded Soft',
    category: 'sans',
    heading: { family: 'Quicksand', cssVar: '--font-quicksand', weights: [600, 700] },
    body: { family: 'Montserrat', cssVar: '--font-montserrat', weights: [400, 500] },
  },
]);

export const DEFAULT_PACK_ID = 'clean-minimal';

export function getPackById(id: string | null | undefined): FontPack | undefined {
  if (!id) return undefined;
  return FONT_PACKS.find(p => p.id === id);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd clicker-platform-v2 && pnpm test lib/fonts`
Expected: PASS (5/5)

- [ ] **Step 6: Commit**

```bash
git add clicker-platform-v2/lib/fonts/
git commit -m "feat(fonts): add FontPack type and 8-pack starter catalog"
```

---

## Task 2: Register the 13 font families in app/layout.tsx

**Files:**

- Modify: `clicker-platform-v2/app/layout.tsx`

- [ ] **Step 1: Read the current layout**

Read `clicker-platform-v2/app/layout.tsx` to confirm existing structure (Figtree + Space_Mono imports, body className).

- [ ] **Step 2: Add the 13 next/font/google imports**

Replace the existing import block (lines 1–18) with:

```typescript
import type { Metadata } from "next";
import {
  Figtree,
  Space_Mono,
  Inter,
  Inter_Tight,
  Outfit,
  DM_Sans,
  Playfair_Display,
  Lora,
  Fraunces,
  Archivo,
  Archivo_Black,
  Space_Grotesk,
  DM_Serif_Display,
  Quicksand,
  Montserrat,
} from "next/font/google";
import { Toaster } from 'sonner';
import "./globals.css";

const figtree = Figtree({ subsets: ["latin"], variable: "--font-jakarta", weight: ['400','500','600','700','800'], display: 'swap' });
const spaceMono = Space_Mono({ subsets: ["latin"], variable: "--font-space", weight: ['400','700'], display: 'swap' });

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", weight: ['400','500','600','700'], display: 'swap' });
const interTight = Inter_Tight({ subsets: ["latin"], variable: "--font-inter-tight", weight: ['400','500','600','700'], display: 'swap' });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit", weight: ['400','500','600','700'], display: 'swap' });
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans", weight: ['400','500','600','700'], display: 'swap' });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair", weight: ['400','600','700'], display: 'swap' });
const lora = Lora({ subsets: ["latin"], variable: "--font-lora", weight: ['400','500','600'], display: 'swap' });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", weight: ['400','600','700'], display: 'swap' });
const archivo = Archivo({ subsets: ["latin"], variable: "--font-archivo", weight: ['400','500','600','700'], display: 'swap' });
const archivoBlack = Archivo_Black({ subsets: ["latin"], variable: "--font-archivo-black", weight: ['400'], display: 'swap' });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk", weight: ['400','500','600','700'], display: 'swap' });
const dmSerifDisplay = DM_Serif_Display({ subsets: ["latin"], variable: "--font-dm-serif-display", weight: ['400'], display: 'swap' });
const quicksand = Quicksand({ subsets: ["latin"], variable: "--font-quicksand", weight: ['400','500','600','700'], display: 'swap' });
const montserrat = Montserrat({ subsets: ["latin"], variable: "--font-montserrat", weight: ['400','500','600','700'], display: 'swap' });

const FONT_CLASS_NAMES = [
  figtree.variable, spaceMono.variable,
  inter.variable, interTight.variable, outfit.variable, dmSans.variable,
  playfair.variable, lora.variable, fraunces.variable,
  archivo.variable, archivoBlack.variable, spaceGrotesk.variable,
  dmSerifDisplay.variable, quicksand.variable, montserrat.variable,
].join(' ');
```

- [ ] **Step 3: Attach FONT_CLASS_NAMES to body (or html)**

Find the existing `<body className="…">` line. Replace with:

```tsx
<body className={FONT_CLASS_NAMES + ' ' + /* any existing class string */ ''}>
```

If `<body>` currently has `className={figtree.variable}` or similar, replace it with the `FONT_CLASS_NAMES` constant.

- [ ] **Step 4: Verify the dev build compiles**

Run: `cd clicker-platform-v2 && pnpm dev` briefly to confirm no compile errors, then Ctrl-C.
Expected: Server starts on :3000 without font import errors.

- [ ] **Step 5: Verify CSS variables are present in the DOM**

Open `http://localhost:3000` in a browser, open DevTools → Elements → `<body>` → Computed → look for `--font-outfit`, `--font-playfair`, etc. All 13 should resolve to font-family values.

- [ ] **Step 6: Commit**

```bash
git add clicker-platform-v2/app/layout.tsx
git commit -m "feat(fonts): register 13 Google Font families for Font Packs"
```

---

## Task 3: Define AppearanceStyles type and Firestore API

**Files:**

- Create: `clicker-platform-v2/lib/appearance/types.ts`
- Create: `clicker-platform-v2/lib/appearance/api.ts`
- Test: `clicker-platform-v2/lib/appearance/__tests__/api.test.ts`

- [ ] **Step 1: Create the type**

Create `clicker-platform-v2/lib/appearance/types.ts`:

```typescript
export type AppearanceStyles = {
  fontPackId: string | null;
};

export const DEFAULT_APPEARANCE_STYLES: AppearanceStyles = {
  fontPackId: null,
};
```

- [ ] **Step 2: Write the failing test**

Create `clicker-platform-v2/lib/appearance/__tests__/api.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAppearanceStyles, setFontPackId } from '../api';

vi.mock('@/lib/firebase', () => ({ db: {} }));

vi.mock('firebase/firestore', () => {
  const data: Record<string, any> = (globalThis as any).__appearanceData ?? ((globalThis as any).__appearanceData = {});
  return {
    doc: (_db: any, ...path: string[]) => ({ path: path.join('/') }),
    getDoc: async (ref: any) => ({
      exists: () => ref.path in data,
      data: () => data[ref.path],
    }),
    setDoc: async (ref: any, value: any, _opts?: any) => { data[ref.path] = { ...(data[ref.path] ?? {}), ...value }; },
    serverTimestamp: () => new Date(),
  };
});

describe('appearance api', () => {
  beforeEach(() => { (globalThis as any).__appearanceData = {}; });

  it('returns default styles when no doc exists', async () => {
    const styles = await getAppearanceStyles('site-1');
    expect(styles.fontPackId).toBeNull();
  });

  it('round-trips fontPackId', async () => {
    await setFontPackId('site-1', 'modern-geometric');
    const styles = await getAppearanceStyles('site-1');
    expect(styles.fontPackId).toBe('modern-geometric');
  });

  it('setFontPackId(null) clears the pack', async () => {
    await setFontPackId('site-1', 'editorial-serif');
    await setFontPackId('site-1', null);
    const styles = await getAppearanceStyles('site-1');
    expect(styles.fontPackId).toBeNull();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd clicker-platform-v2 && pnpm test lib/appearance`
Expected: FAIL — `Cannot find module '../api'`

- [ ] **Step 4: Implement the API**

Create `clicker-platform-v2/lib/appearance/api.ts`:

```typescript
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { AppearanceStyles, DEFAULT_APPEARANCE_STYLES } from './types';

const STYLES_DOC = (siteId: string) => doc(db, 'sites', siteId, 'appearance', 'styles');

export async function getAppearanceStyles(siteId: string): Promise<AppearanceStyles> {
  const snap = await getDoc(STYLES_DOC(siteId));
  if (!snap.exists()) return { ...DEFAULT_APPEARANCE_STYLES };
  const data = snap.data() as Partial<AppearanceStyles>;
  return {
    fontPackId: data.fontPackId ?? null,
  };
}

export async function setFontPackId(siteId: string, packId: string | null): Promise<void> {
  await setDoc(
    STYLES_DOC(siteId),
    { fontPackId: packId, updatedAt: serverTimestamp() },
    { merge: true },
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd clicker-platform-v2 && pnpm test lib/appearance`
Expected: PASS (3/3)

- [ ] **Step 6: Commit**

```bash
git add clicker-platform-v2/lib/appearance/
git commit -m "feat(appearance): add AppearanceStyles type and Firestore api"
```

---

## Task 4: Wire fetchSiteSettings to include appearance styles (SSR read path)

**Files:**

- Modify: `clicker-platform-v2/lib/fetchData.ts`

- [ ] **Step 1: Locate fetchSiteSettings**

Open `clicker-platform-v2/lib/fetchData.ts` and find `fetchSiteSettings` at line 221. Note the file's imports — find the symbol used for Firebase Admin Firestore (likely `adminDb`, `firestore`, or via a `getAdminFirestore()` helper) by scanning the top of the file and the body of `fetchSiteSettings`.

- [ ] **Step 2: Add a server-side appearance fetch helper**

Below `fetchSiteSettings`, add (replacing `adminDb` with whatever symbol the file uses):

```typescript
export const fetchAppearanceStyles = cache(async function fetchAppearanceStyles(siteId: string): Promise<{ fontPackId: string | null }> {
  try {
    const snap = await adminDb.collection('sites').doc(siteId).collection('appearance').doc('styles').get();
    if (!snap.exists) return { fontPackId: null };
    const data = snap.data() ?? {};
    return { fontPackId: typeof data.fontPackId === 'string' ? data.fontPackId : null };
  } catch (e) {
    if (typeof logDebug === 'function') logDebug(`fetchAppearanceStyles: Error ${e}`);
    return { fontPackId: null };
  }
});
```

If `cache` from React is not already imported in the file, import it: `import { cache } from 'react';` — but check first, since `fetchSiteSettings` already uses it.

- [ ] **Step 3: Verify it type-checks**

Run: `cd clicker-platform-v2 && pnpm tsc --noEmit`
Expected: No new errors.

- [ ] **Step 4: Commit**

```bash
git add clicker-platform-v2/lib/fetchData.ts
git commit -m "feat(fetch): add fetchAppearanceStyles for SSR font pack read"
```

---

## Task 5: Emit --font-heading and --font-body from ThemeRegistry

**Files:**

- Modify: `clicker-platform-v2/components/ThemeRegistry.tsx`
- Modify: `clicker-platform-v2/app/layout.tsx`

- [ ] **Step 1: Update ThemeRegistry to accept appearance styles**

Modify `clicker-platform-v2/components/ThemeRegistry.tsx`. Add the import:

```tsx
import { getPackById } from '@/lib/fonts/packs';
```

Update the props type and component signature to accept an optional `appearanceStyles` prop:

```tsx
type Props = {
  initialSettings: SiteSettings | null;
  appearanceStyles?: { fontPackId: string | null } | null;
};

export default function ThemeRegistry({ initialSettings, appearanceStyles }: Props) {
```

Inside the `useServerInsertedHTML` callback, after the existing `fontFamily` / `isCustomFont` lines, add:

```tsx
const pack = getPackById(appearanceStyles?.fontPackId) ?? null;
const headingVar = pack ? 'var(' + pack.heading.cssVar + ')' : 'var(--font-jakarta)';
const bodyVar = pack ? 'var(' + pack.body.cssVar + ')' : 'var(--font-jakarta)';
```

In the inline CSS template string inside the existing `<style>` tag, add two lines to the `:root` block:

```css
--font-heading: ${headingVar};
--font-body: ${bodyVar};
```

And change the existing `body { font-family: var(--font-dynamic) !important; }` rule to:

```css
body { font-family: var(--font-body) !important; }
```

The fallback chain ensures graceful degradation: if no pack is set, `--font-body` resolves to `var(--font-jakarta)`.

- [ ] **Step 2: Pass appearance styles into ThemeRegistry from the root layout**

In `clicker-platform-v2/app/layout.tsx`, find the existing `fetchSiteSettings(siteId)` call. Add the appearance fetch alongside it and pass it through:

```tsx
import { fetchSiteSettings, fetchAppearanceStyles } from "@/lib/fetchData";

// inside RootLayout, replacing the lone settings fetch:
const [settings, appearanceStyles] = await Promise.all([
  fetchSiteSettings(siteId),
  fetchAppearanceStyles(siteId),
]);

// in JSX where ThemeRegistry is rendered:
<ThemeRegistry initialSettings={settings} appearanceStyles={appearanceStyles} />
```

(Adapt to the layout's actual structure — the key changes are: fetch appearance styles in parallel, pass the prop.)

- [ ] **Step 3: Verify SSR injection**

Run: `cd clicker-platform-v2 && pnpm dev`
Visit `http://localhost:3000` (public site, not admin), view-source. Search the HTML for `--font-heading`. Confirm it resolves to a var(--font-…) value.
Without any saved pack: `--font-heading: var(--font-jakarta);`

- [ ] **Step 4: Type-check + commit**

```bash
cd clicker-platform-v2 && pnpm tsc --noEmit
git add clicker-platform-v2/components/ThemeRegistry.tsx clicker-platform-v2/app/layout.tsx
git commit -m "feat(theme): emit --font-heading/--font-body from Font Pack selection"
```

---

## Task 6: Build FontPackCard (real-font preview + ring + checkmark)

**Files:**

- Create: `clicker-platform-v2/components/admin/blocks/panels/site-styles/FontPackCard.tsx`

- [ ] **Step 1: Implement the card**

Create the file:

```tsx
'use client';

import { Check } from 'lucide-react';
import type { FontPack } from '@/lib/fonts/types';

type Props = {
  pack: FontPack;
  active: boolean;
  onClick: () => void;
};

export function FontPackCard({ pack, active, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        'group relative w-full rounded-lg border bg-white dark:bg-neutral-900 text-left',
        'px-4 py-4 transition-all',
        active
          ? 'border-blue-600 ring-2 ring-blue-600 ring-offset-2 ring-offset-white dark:ring-offset-neutral-900'
          : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600',
      ].join(' ')}
    >
      {active && (
        <span
          aria-label="Active"
          className="absolute top-2 right-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white"
        >
          <Check className="h-3 w-3" strokeWidth={3} />
        </span>
      )}

      <div
        className="text-neutral-900 dark:text-neutral-100 leading-tight"
        style={{ fontFamily: 'var(' + pack.heading.cssVar + ')', fontWeight: 700, fontSize: 32 }}
      >
        Heading
      </div>
      <div
        className="text-neutral-700 dark:text-neutral-300 mt-1"
        style={{ fontFamily: 'var(' + pack.body.cssVar + ')', fontWeight: 400, fontSize: 14 }}
      >
        This is your paragraph.
      </div>
      <div className="mt-3 text-[11px] uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
        {pack.heading.family} / {pack.body.family}
      </div>
    </button>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add clicker-platform-v2/components/admin/blocks/panels/site-styles/FontPackCard.tsx
git commit -m "feat(site-styles): add FontPackCard with real-font preview"
```

---

## Task 7: Build FontsSection (header strip + card list + state)

**Files:**

- Create: `clicker-platform-v2/components/admin/blocks/panels/site-styles/FontsSection.tsx`

- [ ] **Step 1: Implement the section**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { FONT_PACKS, getPackById } from '@/lib/fonts/packs';
import { getAppearanceStyles, setFontPackId } from '@/lib/appearance/api';
import { useSite } from '@/lib/site-context';
import { FontPackCard } from './FontPackCard';

function applyFontVarsToDocument(packId: string | null) {
  const pack = getPackById(packId);
  const root = document.documentElement;
  if (pack) {
    root.style.setProperty('--font-heading', 'var(' + pack.heading.cssVar + ')');
    root.style.setProperty('--font-body', 'var(' + pack.body.cssVar + ')');
  } else {
    root.style.removeProperty('--font-heading');
    root.style.removeProperty('--font-body');
  }
}

export function FontsSection() {
  const { siteId } = useSite();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getAppearanceStyles(siteId).then(s => {
      if (!cancelled) {
        setActiveId(s.fontPackId);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [siteId]);

  const handlePick = async (packId: string) => {
    const prev = activeId;
    setActiveId(packId);
    applyFontVarsToDocument(packId);
    try {
      await setFontPackId(siteId, packId);
    } catch (e) {
      setActiveId(prev);
      applyFontVarsToDocument(prev);
      toast.error("Couldn't save font choice. Try again.");
    }
  };

  const handleReset = async () => {
    const prev = activeId;
    setActiveId(null);
    applyFontVarsToDocument(null);
    try {
      await setFontPackId(siteId, null);
    } catch {
      setActiveId(prev);
      applyFontVarsToDocument(prev);
      toast.error("Couldn't reset. Try again.");
    }
  };

  const activePack = getPackById(activeId);

  return (
    <div className="flex flex-col gap-4">
      {activePack && (
        <div className="flex items-center justify-between rounded-lg bg-neutral-50 dark:bg-neutral-800 px-3 py-2">
          <div className="text-xs">
            <div className="text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Active</div>
            <div className="text-neutral-900 dark:text-neutral-100 font-medium">{activePack.name}</div>
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="text-xs text-blue-600 hover:underline"
          >
            Reset to template
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-neutral-500">Loading…</div>
      ) : (
        <div className="flex flex-col gap-3">
          {FONT_PACKS.map(pack => (
            <FontPackCard
              key={pack.id}
              pack={pack}
              active={activeId === pack.id}
              onClick={() => handlePick(pack.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add clicker-platform-v2/components/admin/blocks/panels/site-styles/FontsSection.tsx
git commit -m "feat(site-styles): add FontsSection with optimistic pick + reset"
```

---

## Task 8: Build ComingSoonTile and SiteStylesPanel

**Files:**

- Create: `clicker-platform-v2/components/admin/blocks/panels/site-styles/ComingSoonTile.tsx`
- Create: `clicker-platform-v2/components/admin/blocks/panels/SiteStylesPanel.tsx`

- [ ] **Step 1: Implement ComingSoonTile**

```tsx
'use client';

import type { LucideIcon } from 'lucide-react';

type Props = { icon: LucideIcon; label: string };

export function ComingSoonTile({ icon: Icon, label }: Props) {
  return (
    <div
      aria-disabled
      className="flex items-center gap-3 rounded-lg border border-dashed border-neutral-200 dark:border-neutral-800 px-3 py-3 opacity-60"
    >
      <Icon className="h-4 w-4 text-neutral-400" />
      <div className="flex-1">
        <div className="text-sm text-neutral-700 dark:text-neutral-300">{label}</div>
        <div className="text-[11px] text-neutral-500 dark:text-neutral-400">Coming soon</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Implement SiteStylesPanel**

```tsx
'use client';

import { useState } from 'react';
import { ChevronLeft, Type, Palette, MousePointerClick, FormInput } from 'lucide-react';
import { FontsSection } from './site-styles/FontsSection';
import { ComingSoonTile } from './site-styles/ComingSoonTile';

type View = 'index' | 'fonts';

export function SiteStylesPanel() {
  const [view, setView] = useState<View>('index');

  if (view === 'fonts') {
    return (
      <div className="flex flex-col gap-4 p-4">
        <button
          type="button"
          onClick={() => setView('index')}
          className="flex items-center gap-1 text-sm text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-100"
        >
          <ChevronLeft className="h-4 w-4" /> Site Styles
        </button>
        <FontsSection />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <button
        type="button"
        onClick={() => setView('fonts')}
        className="flex items-center gap-3 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600 px-3 py-3 text-left transition-colors"
      >
        <Type className="h-4 w-4 text-neutral-700 dark:text-neutral-200" />
        <div className="flex-1">
          <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Fonts</div>
          <div className="text-[11px] text-neutral-500 dark:text-neutral-400">Heading + body pack</div>
        </div>
      </button>
      <ComingSoonTile icon={Palette} label="Colors" />
      <ComingSoonTile icon={MousePointerClick} label="Buttons" />
      <ComingSoonTile icon={FormInput} label="Forms" />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add clicker-platform-v2/components/admin/blocks/panels/site-styles/ComingSoonTile.tsx \
        clicker-platform-v2/components/admin/blocks/panels/SiteStylesPanel.tsx
git commit -m "feat(site-styles): add SiteStylesPanel container and ComingSoonTile"
```

---

## Task 9: Wire SiteStylesPanel into CanvasStudio

**Files:**

- Modify: `clicker-platform-v2/components/admin/blocks/CanvasStudio.tsx`

- [ ] **Step 1: Add dynamic import**

Near the other panel dynamic imports (around line 39–40), add:

```tsx
const SiteStylesPanel = dynamic(() => import('./panels/SiteStylesPanel').then(m => m.SiteStylesPanel));
```

- [ ] **Step 2: Extend the slideOverPanel union**

Find the `useState` at line 94:

```typescript
const [slideOverPanel, setSlideOverPanel] = useState<'links' | 'forms' | 'products' | 'siteinfo' | 'branding' | null>(null);
```

Change to:

```typescript
const [slideOverPanel, setSlideOverPanel] = useState<'links' | 'forms' | 'products' | 'siteinfo' | 'branding' | 'sitestyles' | null>(null);
```

Apply the same `'sitestyles'` addition to the `toggleSlideOverPanel` parameter type at line 133.

- [ ] **Step 3: Add keyboard shortcut**

In the `switch` block at line 207–208, add a new case (use `'t'` for Type):

```typescript
case 't': toggleSlideOverPanel('sitestyles'); break;
```

- [ ] **Step 4: Add the sidebar/header button entries**

Find the array around line 785 that lists `siteinfo` and `branding`. Add:

```tsx
{ id: 'sitestyles' as const, icon: Brush, label: 'Site Styles', description: 'Fonts, colors, buttons, forms' },
```

Import `Brush` from `lucide-react` if not already imported.

Also add to the second list at line 932–933:

```tsx
{ id: 'sitestyles' as const, icon: Brush, label: 'Site Styles', shortcut: 'T' },
```

- [ ] **Step 5: Add the render branches**

At lines 879, 880, 883–887, extend each ternary chain / conditional block to include `sitestyles`:

```tsx
title={slideOverPanel === 'links' ? 'Links'
  : slideOverPanel === 'forms' ? 'Forms'
  : slideOverPanel === 'products' ? 'Products'
  : slideOverPanel === 'siteinfo' ? 'Site Info'
  : slideOverPanel === 'branding' ? 'Branding'
  : slideOverPanel === 'sitestyles' ? 'Site Styles'
  : ''}
icon={slideOverPanel === 'links' ? Link2
  : slideOverPanel === 'forms' ? FileInput
  : slideOverPanel === 'products' ? ShoppingBag
  : slideOverPanel === 'siteinfo' ? Globe
  : slideOverPanel === 'branding' ? Palette
  : slideOverPanel === 'sitestyles' ? Brush
  : undefined}
```

And the body:

```tsx
{slideOverPanel === 'links' && <LinksPanel />}
{slideOverPanel === 'forms' && <FormsPanel />}
{slideOverPanel === 'products' && <ProductsPanel />}
{slideOverPanel === 'siteinfo' && <SiteInfoPanel />}
{slideOverPanel === 'branding' && <BrandingPanel />}
{slideOverPanel === 'sitestyles' && <SiteStylesPanel />}
```

Apply the same additions to the duplicate render block at lines 984–994.

- [ ] **Step 6: Type-check**

Run: `cd clicker-platform-v2 && pnpm tsc --noEmit`
Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add clicker-platform-v2/components/admin/blocks/CanvasStudio.tsx
git commit -m "feat(canvas): wire Site Styles slide-over panel + keyboard shortcut"
```

---

## Task 10: Integration test — SiteStylesPanel flow

**Files:**

- Create: `clicker-platform-v2/components/admin/blocks/panels/__tests__/SiteStylesPanel.test.tsx`

- [ ] **Step 1: Write the test**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SiteStylesPanel } from '../SiteStylesPanel';

const setFontPackIdMock = vi.fn(async () => {});
const getAppearanceStylesMock = vi.fn(async () => ({ fontPackId: null as string | null }));

vi.mock('@/lib/appearance/api', () => ({
  setFontPackId: (...args: any[]) => setFontPackIdMock(...args),
  getAppearanceStyles: (...args: any[]) => getAppearanceStylesMock(...args),
}));

vi.mock('@/lib/site-context', () => ({
  useSite: () => ({ siteId: 'site-test' }),
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn() },
}));

describe('SiteStylesPanel', () => {
  beforeEach(() => {
    setFontPackIdMock.mockClear();
    getAppearanceStylesMock.mockClear();
    getAppearanceStylesMock.mockResolvedValue({ fontPackId: null });
    document.documentElement.style.removeProperty('--font-heading');
    document.documentElement.style.removeProperty('--font-body');
  });

  it('shows the Fonts entry on the index view', () => {
    render(<SiteStylesPanel />);
    expect(screen.getByText('Fonts')).toBeInTheDocument();
    expect(screen.getAllByText('Coming soon').length).toBe(3);
  });

  it('navigates into Fonts and renders pack cards', async () => {
    render(<SiteStylesPanel />);
    fireEvent.click(screen.getByText('Fonts'));
    await waitFor(() => expect(screen.getByText('Clean Minimal')).toBeInTheDocument());
    expect(screen.getByText('Modern Geometric')).toBeInTheDocument();
  });

  it('selecting a pack writes Firestore and updates CSS vars', async () => {
    render(<SiteStylesPanel />);
    fireEvent.click(screen.getByText('Fonts'));
    await waitFor(() => screen.getByText('Modern Geometric'));
    fireEvent.click(screen.getByText('Modern Geometric').closest('button')!);
    await waitFor(() => expect(setFontPackIdMock).toHaveBeenCalledWith('site-test', 'modern-geometric'));
    expect(document.documentElement.style.getPropertyValue('--font-heading')).toContain('--font-outfit');
    expect(document.documentElement.style.getPropertyValue('--font-body')).toContain('--font-dm-sans');
  });

  it('reset clears the pack', async () => {
    getAppearanceStylesMock.mockResolvedValue({ fontPackId: 'editorial-serif' });
    render(<SiteStylesPanel />);
    fireEvent.click(screen.getByText('Fonts'));
    await waitFor(() => screen.getByText('Reset to template'));
    fireEvent.click(screen.getByText('Reset to template'));
    await waitFor(() => expect(setFontPackIdMock).toHaveBeenCalledWith('site-test', null));
    expect(document.documentElement.style.getPropertyValue('--font-heading')).toBe('');
  });
});
```

- [ ] **Step 2: Run tests**

Run: `cd clicker-platform-v2 && pnpm test SiteStylesPanel`
Expected: PASS (4/4)

- [ ] **Step 3: Commit**

```bash
git add clicker-platform-v2/components/admin/blocks/panels/__tests__/SiteStylesPanel.test.tsx
git commit -m "test(site-styles): integration test for pick/reset/CSS-var flow"
```

---

## Task 11: Verify the public render path (per memory feedback_test_public_path)

**Files:** (no code changes — verification task)

- [ ] **Step 1: Manual public-path smoke test**

In a browser:

1. Sign in to admin, open Canvas Studio.
2. Open Site Styles → Fonts → click "Modern Geometric".
3. Confirm the canvas preview updates (Outfit heading, DM Sans body).
4. Open the public site (`localhost:3000` or whatever the SSR public URL is for the test site).
5. View-source. Confirm the `<style data-theme-registry>` block contains:
   - `--font-heading: var(--font-outfit);`
   - `--font-body: var(--font-dm-sans);`
6. Reload the public site (no admin cache). Confirm headings render in Outfit and body text in DM Sans (visible to the eye, not just in DOM).

- [ ] **Step 2: Public-path smoke test for the reset path**

1. In Canvas Studio, Site Styles → Fonts → "Reset to template".
2. Visit the public site.
3. View-source. Confirm `--font-heading: var(--font-jakarta);` (fallback).
4. Confirm headings render in Figtree.

- [ ] **Step 3: Document the verification**

Append to the spec's "Success Criteria" section in `superpowers/specs/2026-05-18-font-packs-design.md` with a checkbox marking these verified, then commit.

---

## Task 12: Audit bundle size impact

**Files:** (no code changes — verification task)

- [ ] **Step 1: Build and inspect**

Run: `cd clicker-platform-v2 && pnpm build`
Expected: build succeeds.

Check the build output for total font asset weight. Look in `.next/static/media/` for the new font files. Expected order of magnitude: each family ≈ 15–40 KB woff2 per weight. 13 families × ~3 weights × 25 KB ≈ ~1 MB of font assets total — acceptable for self-hosted, on-demand-loaded fonts (Next.js only ships the variants actually used per page).

- [ ] **Step 2: If significantly worse, prune weights**

If the total exceeds 1.5 MB, revisit weight lists in `app/layout.tsx` and reduce non-essential weights (e.g. drop `500` where only `400`/`700` are needed).

- [ ] **Step 3: Commit any prunes**

```bash
git add clicker-platform-v2/app/layout.tsx
git commit -m "perf(fonts): prune unused font weights"
```

(Skip if no changes needed.)

---

## Self-Review Findings (resolved inline)

- **Spec coverage:** Wireframe (Task 8), real-font preview (Task 6), active state ring+check (Task 6), 3-level preview (Tasks 5, 7, 11), global scope (covered by single doc), no Apply button (Task 7), 8 starter packs (Task 1), template fallback (Task 5 — pack null → `--font-jakarta`), reset (Task 7).
- **Placeholders:** None — all code shown in full.
- **Type consistency:** `FontPack`, `AppearanceStyles`, `getPackById`, `setFontPackId`, `getAppearanceStyles` names consistent across Tasks 1, 3, 5, 7, 10.
- **Known fragility:** Task 4's Firebase Admin symbol depends on `fetchSiteSettings`'s existing convention — the task tells the engineer to match the file's existing pattern.

---

## Out of Scope (deferred to follow-up plans)

- Colors / Buttons / Forms sections (render as "Coming soon" tiles only).
- Migrating `lib/templates/definitions.ts` to use `defaultFontPackId` references.
- Per-page font overrides.
- Bring-your-own Google Font.
- Real-time `subscribeAppearanceStyles` updates (not needed — single editor at a time).
