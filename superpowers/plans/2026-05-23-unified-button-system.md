# Unified Button System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace ad-hoc per-block button styling with one site-wide Button Pack system: a single `<UnifiedButton>` component, a Site Styles → Buttons admin panel, and a token pipeline that mirrors the existing Font Pack architecture.

**Architecture:** Three layers. Layer 1 = pure data pack definitions (`lib/buttonPacks/`). Layer 2 = `<ButtonPackProvider>` emitting CSS variables, wired into `ThemeRegistry`. Layer 3 = `<UnifiedButton>` consumes vars only, no theme branching. Public blocks delegate to it. Admin panel replaces the "Coming soon" tile and writes `site.appearance.buttonPackId` + `buttonColors`.

**Tech Stack:** Next.js 14 (app router), TypeScript, Tailwind, Firestore, Vitest, Sonner toasts.

**Reference spec:** `superpowers/specs/2026-05-23-unified-button-system-design.md`

---

## File Map

**Create:**
- `clicker-platform-v2/lib/buttonPacks/types.ts` — TS types
- `clicker-platform-v2/lib/buttonPacks/packs.ts` — pack registry
- `clicker-platform-v2/lib/buttonPacks/contrast.ts` — WCAG luminance helper
- `clicker-platform-v2/lib/buttonPacks/__tests__/contrast.test.ts`
- `clicker-platform-v2/lib/buttonPacks/__tests__/packs.test.ts`
- `clicker-platform-v2/components/ui/UnifiedButton.tsx` — single consumer
- `clicker-platform-v2/components/ui/unified-button.css` — CSS using vars
- `clicker-platform-v2/components/ButtonPackProvider.tsx` — emits CSS vars
- `clicker-platform-v2/app/admin/_dev/buttons/page.tsx` — visual QA page
- `clicker-platform-v2/components/admin/blocks/panels/site-styles/ButtonsSection.tsx`
- `clicker-platform-v2/components/admin/blocks/panels/site-styles/ButtonPackCard.tsx`
- `clicker-platform-v2/components/admin/blocks/panels/site-styles/ButtonColorsEditor.tsx`
- `clicker-platform-v2/components/admin/blocks/panels/site-styles/ButtonsPreviewTile.tsx`

**Modify:**
- `clicker-platform-v2/lib/appearance/types.ts` — add buttonPackId, buttonColors to AppearanceStyles
- `clicker-platform-v2/lib/appearance/api.ts` — add setButtonPackId, setButtonColors, extend getAppearanceStyles
- `clicker-platform-v2/lib/appearance/__tests__/api.test.ts` — new test cases
- `clicker-platform-v2/components/ThemeRegistry.tsx` — emit `--btn-*` variables (extend existing SSR style injection)
- `clicker-platform-v2/components/admin/blocks/panels/SiteStylesPanel.tsx` — swap ComingSoonTile→ButtonsSection
- `clicker-platform-v2/components/blocks/public/DefaultButtonBlock.tsx` — render `<UnifiedButton>`, add tier/size form values
- `clicker-platform-v2/components/blocks/public/DefaultHeroBlock.tsx`
- `clicker-platform-v2/components/blocks/public/DefaultQuickActionsBlock.tsx`
- `clicker-platform-v2/components/blocks/public/DefaultFeaturedProductBlock.tsx`
- `clicker-platform-v2/components/blocks/public/ReservationBlock.tsx`
- `clicker-platform-v2/components/blocks/public/DefaultInlineFormBlock.tsx`
- `clicker-platform-v2/components/blocks/mrb/MrbHero.tsx`
- (any Mrb block with bespoke buttons — see Task 13)
- Button Block admin form (located in Task 12)
- `clicker-platform-v2/lib/templates/definitions.ts` — add `defaultButtonPackId: 'glass'` to MRB template

---

## Task 1: Pack Type Definitions

**Files:**
- Create: `clicker-platform-v2/lib/buttonPacks/types.ts`

- [ ] **Step 1: Write the type file**

```typescript
// clicker-platform-v2/lib/buttonPacks/types.ts

export type ButtonPackId = 'pill' | 'soft' | 'brutalist' | 'glass' | 'underlined';
export type ButtonTier = 'primary' | 'secondary' | 'tertiary';
export type ButtonSize = 'sm' | 'md' | 'lg';
export type TertiaryStyle = 'underline' | 'arrow' | 'plain';

export interface ButtonSizeSpec {
  padY: number;     // px
  padX: number;     // px
  fontSize: number; // px
}

export interface ButtonPack {
  id: ButtonPackId;
  displayName: string;
  radius: number;          // px
  borderWidth: number;     // px (secondary tier border)
  fontWeight: number;
  letterSpacing: string;   // e.g. '0em' | '0.08em'
  textTransform: 'none' | 'uppercase';
  sizes: Record<ButtonSize, ButtonSizeSpec>;
  tertiaryStyle: TertiaryStyle;
}

export interface ButtonColors {
  primaryFill: string;
  primaryText?: string;   // optional override; otherwise auto-contrast
  secondaryBorder: string;
  secondaryText: string;
  tertiaryText: string;
}

export const DEFAULT_BUTTON_PACK_ID: ButtonPackId = 'pill';

export const DEFAULT_BUTTON_COLORS: ButtonColors = {
  primaryFill: '#111111',
  secondaryBorder: '#111111',
  secondaryText: '#111111',
  tertiaryText: '#111111',
};
```

- [ ] **Step 2: Commit**

```bash
git add clicker-platform-v2/lib/buttonPacks/types.ts
git commit -m "feat(buttons): add ButtonPack/Tier/Size/Colors types"
```

---

## Task 2: Auto-Contrast Helper (TDD)

**Files:**
- Create: `clicker-platform-v2/lib/buttonPacks/contrast.ts`
- Test: `clicker-platform-v2/lib/buttonPacks/__tests__/contrast.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// clicker-platform-v2/lib/buttonPacks/__tests__/contrast.test.ts
import { describe, it, expect } from 'vitest';
import { pickContrastText, parseHex, relativeLuminance } from '../contrast';

describe('parseHex', () => {
  it('parses 6-digit hex', () => {
    expect(parseHex('#ffffff')).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseHex('#000000')).toEqual({ r: 0, g: 0, b: 0 });
    expect(parseHex('#ff7a1a')).toEqual({ r: 255, g: 122, b: 26 });
  });
  it('parses 3-digit hex', () => {
    expect(parseHex('#fff')).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseHex('#000')).toEqual({ r: 0, g: 0, b: 0 });
  });
  it('parses without leading #', () => {
    expect(parseHex('111111')).toEqual({ r: 17, g: 17, b: 17 });
  });
});

describe('relativeLuminance', () => {
  it('returns 1 for white', () => {
    expect(relativeLuminance(255, 255, 255)).toBeCloseTo(1, 3);
  });
  it('returns 0 for black', () => {
    expect(relativeLuminance(0, 0, 0)).toBeCloseTo(0, 3);
  });
});

describe('pickContrastText', () => {
  it('returns white text on dark fill', () => {
    expect(pickContrastText('#111111')).toBe('#ffffff');
    expect(pickContrastText('#000000')).toBe('#ffffff');
    expect(pickContrastText('#2563eb')).toBe('#ffffff');
  });
  it('returns black text on light fill', () => {
    expect(pickContrastText('#ffffff')).toBe('#000000');
    expect(pickContrastText('#fef3c7')).toBe('#000000');
    expect(pickContrastText('#ff7a1a')).toBe('#000000');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd clicker-platform-v2 && pnpm vitest run lib/buttonPacks/__tests__/contrast.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement contrast.ts**

```typescript
// clicker-platform-v2/lib/buttonPacks/contrast.ts

export function parseHex(hex: string): { r: number; g: number; b: number } {
  let h = hex.startsWith('#') ? hex.slice(1) : hex;
  if (h.length === 3) {
    h = h.split('').map(c => c + c).join('');
  }
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

function srgbToLin(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(r: number, g: number, b: number): number {
  return 0.2126 * srgbToLin(r) + 0.7152 * srgbToLin(g) + 0.0722 * srgbToLin(b);
}

export function pickContrastText(hex: string): '#000000' | '#ffffff' {
  const { r, g, b } = parseHex(hex);
  return relativeLuminance(r, g, b) > 0.5 ? '#000000' : '#ffffff';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd clicker-platform-v2 && pnpm vitest run lib/buttonPacks/__tests__/contrast.test.ts`
Expected: PASS — all assertions pass.

- [ ] **Step 5: Commit**

```bash
git add clicker-platform-v2/lib/buttonPacks/contrast.ts \
        clicker-platform-v2/lib/buttonPacks/__tests__/contrast.test.ts
git commit -m "feat(buttons): WCAG auto-contrast text helper"
```

---

## Task 3: Pack Registry

**Files:**
- Create: `clicker-platform-v2/lib/buttonPacks/packs.ts`
- Test: `clicker-platform-v2/lib/buttonPacks/__tests__/packs.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// clicker-platform-v2/lib/buttonPacks/__tests__/packs.test.ts
import { describe, it, expect } from 'vitest';
import { BUTTON_PACKS, getButtonPackById, getDefaultButtonPack } from '../packs';
import { DEFAULT_BUTTON_PACK_ID } from '../types';

describe('BUTTON_PACKS', () => {
  it('exposes 5 packs', () => {
    expect(BUTTON_PACKS).toHaveLength(5);
  });
  it('contains pill, soft, brutalist, glass, underlined', () => {
    const ids = BUTTON_PACKS.map(p => p.id).sort();
    expect(ids).toEqual(['brutalist', 'glass', 'pill', 'soft', 'underlined']);
  });
  it('each pack has 3 sizes (sm/md/lg)', () => {
    for (const p of BUTTON_PACKS) {
      expect(Object.keys(p.sizes).sort()).toEqual(['lg', 'md', 'sm']);
    }
  });
});

describe('getButtonPackById', () => {
  it('returns pack by id', () => {
    expect(getButtonPackById('pill')?.id).toBe('pill');
  });
  it('returns null for unknown id', () => {
    expect(getButtonPackById('nope' as any)).toBeNull();
  });
  it('returns null for null input', () => {
    expect(getButtonPackById(null)).toBeNull();
  });
});

describe('getDefaultButtonPack', () => {
  it('returns the pack matching DEFAULT_BUTTON_PACK_ID', () => {
    expect(getDefaultButtonPack().id).toBe(DEFAULT_BUTTON_PACK_ID);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd clicker-platform-v2 && pnpm vitest run lib/buttonPacks/__tests__/packs.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement packs.ts**

```typescript
// clicker-platform-v2/lib/buttonPacks/packs.ts
import type { ButtonPack, ButtonPackId } from './types';
import { DEFAULT_BUTTON_PACK_ID } from './types';

export const BUTTON_PACKS: ReadonlyArray<ButtonPack> = Object.freeze([
  {
    id: 'pill',
    displayName: 'Pill',
    radius: 9999,
    borderWidth: 1.5,
    fontWeight: 600,
    letterSpacing: '0em',
    textTransform: 'none',
    tertiaryStyle: 'underline',
    sizes: {
      sm: { padY: 8,  padX: 16, fontSize: 12 },
      md: { padY: 11, padX: 22, fontSize: 13 },
      lg: { padY: 14, padX: 28, fontSize: 15 },
    },
  },
  {
    id: 'soft',
    displayName: 'Soft',
    radius: 6,
    borderWidth: 1.5,
    fontWeight: 600,
    letterSpacing: '0em',
    textTransform: 'none',
    tertiaryStyle: 'arrow',
    sizes: {
      sm: { padY: 8,  padX: 16, fontSize: 12 },
      md: { padY: 11, padX: 22, fontSize: 13 },
      lg: { padY: 14, padX: 28, fontSize: 15 },
    },
  },
  {
    id: 'brutalist',
    displayName: 'Brutalist',
    radius: 0,
    borderWidth: 3,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    tertiaryStyle: 'underline',
    sizes: {
      sm: { padY: 9,  padX: 16, fontSize: 12 },
      md: { padY: 12, padX: 22, fontSize: 13 },
      lg: { padY: 15, padX: 28, fontSize: 15 },
    },
  },
  {
    id: 'glass',
    displayName: 'Glass',
    radius: 12,
    borderWidth: 1,
    fontWeight: 600,
    letterSpacing: '0em',
    textTransform: 'none',
    tertiaryStyle: 'arrow',
    sizes: {
      sm: { padY: 8,  padX: 16, fontSize: 12 },
      md: { padY: 11, padX: 22, fontSize: 13 },
      lg: { padY: 14, padX: 28, fontSize: 15 },
    },
  },
  {
    id: 'underlined',
    displayName: 'Underlined',
    radius: 0,
    borderWidth: 0,
    fontWeight: 600,
    letterSpacing: '0em',
    textTransform: 'none',
    tertiaryStyle: 'plain',
    sizes: {
      sm: { padY: 4,  padX: 0, fontSize: 12 },
      md: { padY: 6,  padX: 0, fontSize: 13 },
      lg: { padY: 8,  padX: 0, fontSize: 15 },
    },
  },
]);

export function getButtonPackById(id: ButtonPackId | string | null | undefined): ButtonPack | null {
  if (!id) return null;
  return BUTTON_PACKS.find(p => p.id === id) ?? null;
}

export function getDefaultButtonPack(): ButtonPack {
  const p = getButtonPackById(DEFAULT_BUTTON_PACK_ID);
  if (!p) throw new Error(`Default button pack '${DEFAULT_BUTTON_PACK_ID}' not in registry`);
  return p;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd clicker-platform-v2 && pnpm vitest run lib/buttonPacks/__tests__/packs.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add clicker-platform-v2/lib/buttonPacks/packs.ts \
        clicker-platform-v2/lib/buttonPacks/__tests__/packs.test.ts
git commit -m "feat(buttons): pack registry (pill/soft/brutalist/glass/underlined)"
```

---

## Task 4: Extend AppearanceStyles with buttonPackId + buttonColors

**Files:**
- Modify: `clicker-platform-v2/lib/appearance/types.ts`
- Modify: `clicker-platform-v2/lib/appearance/api.ts`
- Modify: `clicker-platform-v2/lib/appearance/__tests__/api.test.ts`

- [ ] **Step 1: Read current types.ts**

Run: `cat clicker-platform-v2/lib/appearance/types.ts`
Note the current `AppearanceStyles` shape and `DEFAULT_APPEARANCE_STYLES`.

- [ ] **Step 2: Modify types.ts**

Add imports and extend the interface. Final file contents (replace existing; preserve any pre-existing fields not shown here):

```typescript
// clicker-platform-v2/lib/appearance/types.ts
import type { ButtonPackId, ButtonColors } from '@/lib/buttonPacks/types';
import { DEFAULT_BUTTON_COLORS } from '@/lib/buttonPacks/types';

export interface AppearanceStyles {
  fontPackId: string | null;
  buttonPackId: ButtonPackId | null;
  buttonColors: ButtonColors;
}

export const DEFAULT_APPEARANCE_STYLES: AppearanceStyles = {
  fontPackId: null,
  buttonPackId: null,
  buttonColors: { ...DEFAULT_BUTTON_COLORS },
};
```

- [ ] **Step 3: Write failing test cases — append to api.test.ts**

```typescript
import { setButtonPackId, setButtonColors } from '../api';

describe('appearance api — buttons', () => {
  beforeEach(() => { (globalThis as any).__appearanceData = {}; });

  it('default styles include null buttonPackId and default buttonColors', async () => {
    const styles = await getAppearanceStyles('site-1');
    expect(styles.buttonPackId).toBeNull();
    expect(styles.buttonColors.primaryFill).toBe('#111111');
    expect(styles.buttonColors.secondaryBorder).toBe('#111111');
    expect(styles.buttonColors.secondaryText).toBe('#111111');
    expect(styles.buttonColors.tertiaryText).toBe('#111111');
    expect(styles.buttonColors.primaryText).toBeUndefined();
  });

  it('setButtonPackId persists the pack id', async () => {
    await setButtonPackId('site-1', 'soft');
    const styles = await getAppearanceStyles('site-1');
    expect(styles.buttonPackId).toBe('soft');
  });

  it('setButtonPackId(null) clears the pack', async () => {
    await setButtonPackId('site-1', 'soft');
    await setButtonPackId('site-1', null);
    const styles = await getAppearanceStyles('site-1');
    expect(styles.buttonPackId).toBeNull();
  });

  it('setButtonColors merges with existing colors', async () => {
    await setButtonColors('site-1', { primaryFill: '#2563eb' });
    const styles = await getAppearanceStyles('site-1');
    expect(styles.buttonColors.primaryFill).toBe('#2563eb');
    expect(styles.buttonColors.secondaryBorder).toBe('#111111');
  });

  it('setButtonColors can clear primaryText override', async () => {
    await setButtonColors('site-1', { primaryFill: '#2563eb', primaryText: '#fafafa' });
    let styles = await getAppearanceStyles('site-1');
    expect(styles.buttonColors.primaryText).toBe('#fafafa');

    await setButtonColors('site-1', { primaryText: undefined });
    styles = await getAppearanceStyles('site-1');
    expect(styles.buttonColors.primaryText).toBeUndefined();
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `cd clicker-platform-v2 && pnpm vitest run lib/appearance/__tests__/api.test.ts`
Expected: FAIL — `setButtonPackId`/`setButtonColors` not exported.

- [ ] **Step 5: Modify api.ts**

Replace `clicker-platform-v2/lib/appearance/api.ts` with:

```typescript
// clicker-platform-v2/lib/appearance/api.ts
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, deleteField, serverTimestamp } from 'firebase/firestore';
import { AppearanceStyles, DEFAULT_APPEARANCE_STYLES } from './types';
import type { ButtonPackId, ButtonColors } from '@/lib/buttonPacks/types';
import { DEFAULT_BUTTON_COLORS } from '@/lib/buttonPacks/types';

const STYLES_DOC = (siteId: string) => doc(db, 'sites', siteId, 'appearance', 'styles');

export async function getAppearanceStyles(siteId: string): Promise<AppearanceStyles> {
  const snap = await getDoc(STYLES_DOC(siteId));
  if (!snap.exists()) {
    return { ...DEFAULT_APPEARANCE_STYLES, buttonColors: { ...DEFAULT_BUTTON_COLORS } };
  }
  const data = snap.data() as Partial<AppearanceStyles>;
  return {
    fontPackId: data.fontPackId ?? null,
    buttonPackId: (data.buttonPackId as ButtonPackId | null | undefined) ?? null,
    buttonColors: { ...DEFAULT_BUTTON_COLORS, ...(data.buttonColors ?? {}) },
  };
}

export async function setFontPackId(siteId: string, packId: string | null): Promise<void> {
  await setDoc(
    STYLES_DOC(siteId),
    { fontPackId: packId, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

export async function setButtonPackId(siteId: string, packId: ButtonPackId | null): Promise<void> {
  await setDoc(
    STYLES_DOC(siteId),
    { buttonPackId: packId, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

export async function setButtonColors(siteId: string, patch: Partial<ButtonColors>): Promise<void> {
  const updates: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    updates[`buttonColors.${k}`] = v === undefined ? deleteField() : v;
  }
  updates.updatedAt = serverTimestamp();
  await setDoc(STYLES_DOC(siteId), updates, { merge: true });
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd clicker-platform-v2 && pnpm vitest run lib/appearance/__tests__/api.test.ts`
Expected: PASS.

If the existing test mock at the top of `api.test.ts` doesn't honor nested `buttonColors.<field>` paths or `deleteField()`, extend the mock to handle dotted field paths and the deleteField sentinel (read the top of `api.test.ts` first to see current mock shape).

- [ ] **Step 7: Commit**

```bash
git add clicker-platform-v2/lib/appearance/types.ts \
        clicker-platform-v2/lib/appearance/api.ts \
        clicker-platform-v2/lib/appearance/__tests__/api.test.ts
git commit -m "feat(appearance): add buttonPackId + buttonColors to appearance styles"
```

---

## Task 5: ButtonPackProvider (CSS variable emission)

**Files:**
- Create: `clicker-platform-v2/components/ButtonPackProvider.tsx`

- [ ] **Step 1: Implement the provider**

```tsx
// clicker-platform-v2/components/ButtonPackProvider.tsx
'use client';

import { useEffect } from 'react';
import { getButtonPackById, getDefaultButtonPack } from '@/lib/buttonPacks/packs';
import { DEFAULT_BUTTON_COLORS } from '@/lib/buttonPacks/types';
import type { ButtonPack, ButtonColors, ButtonPackId } from '@/lib/buttonPacks/types';
import { pickContrastText } from '@/lib/buttonPacks/contrast';

type Props = {
  packId: ButtonPackId | null;
  colors?: Partial<ButtonColors>;
  children?: React.ReactNode;
};

export function buildButtonCssVars(pack: ButtonPack, colors: ButtonColors): Record<string, string> {
  const primaryText = colors.primaryText ?? pickContrastText(colors.primaryFill);
  return {
    '--btn-radius': `${pack.radius}px`,
    '--btn-border-width': `${pack.borderWidth}px`,
    '--btn-font-weight': String(pack.fontWeight),
    '--btn-tracking': pack.letterSpacing,
    '--btn-transform': pack.textTransform,

    '--btn-sm-pad-y': `${pack.sizes.sm.padY}px`,
    '--btn-sm-pad-x': `${pack.sizes.sm.padX}px`,
    '--btn-sm-font':  `${pack.sizes.sm.fontSize}px`,
    '--btn-md-pad-y': `${pack.sizes.md.padY}px`,
    '--btn-md-pad-x': `${pack.sizes.md.padX}px`,
    '--btn-md-font':  `${pack.sizes.md.fontSize}px`,
    '--btn-lg-pad-y': `${pack.sizes.lg.padY}px`,
    '--btn-lg-pad-x': `${pack.sizes.lg.padX}px`,
    '--btn-lg-font':  `${pack.sizes.lg.fontSize}px`,

    '--btn-primary-fill':     colors.primaryFill,
    '--btn-primary-text':     primaryText,
    '--btn-secondary-border': colors.secondaryBorder,
    '--btn-secondary-text':   colors.secondaryText,
    '--btn-tertiary-text':    colors.tertiaryText,
  };
}

export function ButtonPackProvider({ packId, colors, children }: Props) {
  const pack = getButtonPackById(packId) ?? getDefaultButtonPack();
  const resolved: ButtonColors = { ...DEFAULT_BUTTON_COLORS, ...(colors ?? {}) };

  useEffect(() => {
    const root = document.documentElement;
    const vars = buildButtonCssVars(pack, resolved);
    for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
    root.setAttribute('data-tertiary-style', pack.tertiaryStyle);
    return () => {
      for (const k of Object.keys(vars)) root.style.removeProperty(k);
      root.removeAttribute('data-tertiary-style');
    };
  }, [pack, resolved.primaryFill, resolved.primaryText, resolved.secondaryBorder, resolved.secondaryText, resolved.tertiaryText]);

  return <>{children}</>;
}
```

- [ ] **Step 2: Commit**

```bash
git add clicker-platform-v2/components/ButtonPackProvider.tsx
git commit -m "feat(buttons): ButtonPackProvider emits --btn-* CSS vars"
```

---

## Task 6: UnifiedButton Component

**Files:**
- Create: `clicker-platform-v2/components/ui/unified-button.css`
- Create: `clicker-platform-v2/components/ui/UnifiedButton.tsx`

- [ ] **Step 1: Write the CSS**

```css
/* clicker-platform-v2/components/ui/unified-button.css */
.ub-root {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4em;
  border-radius: var(--btn-radius, 9999px);
  font-weight: var(--btn-font-weight, 600);
  letter-spacing: var(--btn-tracking, 0em);
  text-transform: var(--btn-transform, none);
  text-decoration: none;
  cursor: pointer;
  transition: transform .15s ease, opacity .15s ease, background-color .15s ease, color .15s ease, box-shadow .15s ease;
  border: 0 solid transparent;
  line-height: 1.2;
  user-select: none;
}
.ub-root[data-fullwidth] { width: 100%; }
.ub-root[aria-disabled="true"] { opacity: 0.5; pointer-events: none; }

.ub-root[data-size="sm"] { padding: var(--btn-sm-pad-y) var(--btn-sm-pad-x); font-size: var(--btn-sm-font); }
.ub-root[data-size="md"] { padding: var(--btn-md-pad-y) var(--btn-md-pad-x); font-size: var(--btn-md-font); }
.ub-root[data-size="lg"] { padding: var(--btn-lg-pad-y) var(--btn-lg-pad-x); font-size: var(--btn-lg-font); }

.ub-root[data-tier="primary"] {
  background: var(--btn-primary-fill);
  color: var(--btn-primary-text);
}
.ub-root[data-tier="primary"]:hover { filter: brightness(0.92); transform: translateY(-1px); }

.ub-root[data-tier="secondary"] {
  background: transparent;
  color: var(--btn-secondary-text);
  border-width: var(--btn-border-width);
  border-style: solid;
  border-color: var(--btn-secondary-border);
}
.ub-root[data-tier="secondary"]:hover {
  background: var(--btn-secondary-border);
  color: #fff;
  transform: translateY(-1px);
}

.ub-root[data-tier="tertiary"] {
  background: transparent;
  color: var(--btn-tertiary-text);
  padding-left: 0;
  padding-right: 0;
  border: 0;
  border-radius: 0;
}
[data-tertiary-style="underline"] .ub-root[data-tier="tertiary"] {
  text-decoration: underline;
  text-underline-offset: 4px;
}
[data-tertiary-style="arrow"] .ub-root[data-tier="tertiary"]::after {
  content: " →";
}
.ub-root[data-tier="tertiary"]:hover { opacity: 0.7; }
```

- [ ] **Step 2: Implement the component**

```tsx
// clicker-platform-v2/components/ui/UnifiedButton.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import type { ButtonTier, ButtonSize } from '@/lib/buttonPacks/types';
import './unified-button.css';

export interface UnifiedButtonProps {
  tier: ButtonTier;
  size?: ButtonSize;
  children: React.ReactNode;
  href?: string;
  onClick?: (e: React.MouseEvent) => void;
  fullWidth?: boolean;
  disabled?: boolean;
  external?: boolean;
  loading?: boolean;
  className?: string;
  type?: 'button' | 'submit';
  ariaLabel?: string;
}

function isExternalProtocol(href: string): boolean {
  return /^(https?:\/\/|mailto:|tel:)/i.test(href);
}
function isSafeHref(href: string): boolean {
  return /^(https?:\/\/|\/|#|mailto:|tel:)/i.test(href);
}

export function UnifiedButton({
  tier,
  size = 'md',
  children,
  href,
  onClick,
  fullWidth,
  disabled,
  external,
  loading,
  className,
  type = 'button',
  ariaLabel,
}: UnifiedButtonProps) {
  const label = loading ? 'Loading…' : children;
  const isDisabled = disabled || loading;
  const dataProps = {
    'data-tier': tier,
    'data-size': size,
    'data-fullwidth': fullWidth || undefined,
    'aria-disabled': isDisabled || undefined,
    'aria-label': ariaLabel,
    className: ['ub-root', className].filter(Boolean).join(' '),
  } as const;

  if (href && isSafeHref(href)) {
    const isExt = external ?? isExternalProtocol(href);
    if (isExt) {
      return (
        <a
          {...dataProps}
          href={isDisabled ? undefined : href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={isDisabled ? (e) => e.preventDefault() : onClick}
        >
          {label}
        </a>
      );
    }
    return (
      <Link
        {...dataProps}
        href={isDisabled ? '#' : href}
        onClick={isDisabled ? (e) => e.preventDefault() : onClick}
      >
        {label}
      </Link>
    );
  }

  // Render a <button> when there's an action OR when the consumer needs a submit button.
  if (onClick || type === 'submit') {
    return (
      <button {...dataProps} type={type} disabled={isDisabled} onClick={onClick}>
        {label}
      </button>
    );
  }

  // No action and no submit intent: span (used in preview mode).
  return <span {...dataProps}>{label}</span>;
}
```

- [ ] **Step 3: Commit**

```bash
git add clicker-platform-v2/components/ui/UnifiedButton.tsx \
        clicker-platform-v2/components/ui/unified-button.css
git commit -m "feat(buttons): UnifiedButton component + CSS using --btn-* vars"
```

---

## Task 7: Dev Preview Page for Visual QA

**Files:**
- Create: `clicker-platform-v2/app/admin/_dev/buttons/page.tsx`

- [ ] **Step 1: Implement the preview page**

```tsx
// clicker-platform-v2/app/admin/_dev/buttons/page.tsx
'use client';

import { useState } from 'react';
import { ButtonPackProvider } from '@/components/ButtonPackProvider';
import { UnifiedButton } from '@/components/ui/UnifiedButton';
import { BUTTON_PACKS } from '@/lib/buttonPacks/packs';
import { DEFAULT_BUTTON_COLORS } from '@/lib/buttonPacks/types';
import type { ButtonPackId, ButtonColors } from '@/lib/buttonPacks/types';

export default function ButtonsDevPage() {
  const [packId, setPackId] = useState<ButtonPackId>('pill');
  const [colors, setColors] = useState<ButtonColors>(DEFAULT_BUTTON_COLORS);

  return (
    <ButtonPackProvider packId={packId} colors={colors}>
      <div className="p-8 space-y-6">
        <h1 className="text-2xl font-bold">UnifiedButton — Dev Preview</h1>

        <div className="flex gap-2 flex-wrap">
          {BUTTON_PACKS.map(p => (
            <button
              key={p.id}
              onClick={() => setPackId(p.id)}
              className={`px-3 py-1 rounded border ${p.id === packId ? 'bg-blue-600 text-white' : 'bg-white'}`}
            >
              {p.displayName}
            </button>
          ))}
        </div>

        <div className="flex gap-3 items-center">
          <label className="text-sm">Primary fill</label>
          <input type="color" value={colors.primaryFill}
                 onChange={e => setColors({ ...colors, primaryFill: e.target.value })} />
          <code className="text-xs">{colors.primaryFill}</code>
        </div>

        {(['sm', 'md', 'lg'] as const).map(size => (
          <section key={size} className="space-y-2">
            <h2 className="text-xs uppercase tracking-wider text-neutral-500">Size: {size}</h2>
            <div className="flex gap-3 items-center flex-wrap">
              <UnifiedButton tier="primary" size={size} href="#">Primary</UnifiedButton>
              <UnifiedButton tier="secondary" size={size} href="#">Secondary</UnifiedButton>
              <UnifiedButton tier="tertiary" size={size} href="#">Tertiary</UnifiedButton>
              <UnifiedButton tier="primary" size={size} onClick={() => {}}>Button</UnifiedButton>
              <UnifiedButton tier="primary" size={size} disabled>Disabled</UnifiedButton>
              <UnifiedButton tier="primary" size={size} loading>Loading</UnifiedButton>
            </div>
          </section>
        ))}

        <section className="space-y-2">
          <h2 className="text-xs uppercase tracking-wider text-neutral-500">Full width</h2>
          <UnifiedButton tier="primary" fullWidth href="#">Full Width Primary</UnifiedButton>
        </section>
      </div>
    </ButtonPackProvider>
  );
}
```

- [ ] **Step 2: Verify in browser**

Run: `cd clicker-platform-v2 && pnpm dev`
Visit: `http://localhost:3000/admin/_dev/buttons`
Expected:
- All 5 packs render distinct shapes.
- All 3 sizes scale visibly.
- Color picker updates fill + auto-flips text black/white.
- Tertiary shows underline in pill/brutalist, arrow in soft/glass, plain in underlined.
- Disabled is dimmed and non-interactive; Loading shows "Loading…".

- [ ] **Step 3: Commit**

```bash
git add clicker-platform-v2/app/admin/_dev/buttons/page.tsx
git commit -m "feat(buttons): dev preview page at /admin/_dev/buttons"
```

---

## Task 8: Wire ButtonPack into ThemeRegistry (SSR)

**Files:**
- Modify: `clicker-platform-v2/components/ThemeRegistry.tsx`

This task extends `ThemeRegistry`'s existing `useServerInsertedHTML` style block — the same one currently emitting `--font-heading` / `--font-body` — to also emit the `--btn-*` variables. Read the file first to understand the current emission pattern (it uses `useServerInsertedHTML` to inject a `<style>` tag into the SSR `<head>`).

- [ ] **Step 1: Read current ThemeRegistry**

Run: `cat clicker-platform-v2/components/ThemeRegistry.tsx`
Identify:
- the `Props` type and `appearanceStyles` prop shape
- the SSR style-tag emission block inside `useServerInsertedHTML`
- the admin branch vs public branch (the file emits different CSS in admin vs public)

- [ ] **Step 2: Extend Props type**

Update the `Props` type at the top:

```ts
type Props = {
  initialSettings: SiteSettings | null;
  appearanceStyles?: {
    fontPackId: string | null;
    buttonPackId?: import('@/lib/buttonPacks/types').ButtonPackId | null;
    buttonColors?: Partial<import('@/lib/buttonPacks/types').ButtonColors>;
  } | null;
  templateId?: string | null;
};
```

- [ ] **Step 3: Add imports near the top of the file**

```ts
import { getButtonPackById, getDefaultButtonPack } from '@/lib/buttonPacks/packs';
import { DEFAULT_BUTTON_COLORS } from '@/lib/buttonPacks/types';
import { buildButtonCssVars } from '@/components/ButtonPackProvider';
import { getTemplate } from '@/lib/templates/registry';
```

(`getTemplate` may already be imported — check before adding.)

- [ ] **Step 4: Resolve the button pack + colors inside `useServerInsertedHTML`**

Inside the callback, after the existing font-pack resolution, add:

```ts
// Resolve button pack: site override > template default > registry default
const siteButtonPack = getButtonPackById(appearanceStyles?.buttonPackId ?? null);
let buttonPack;
if (siteButtonPack) {
  buttonPack = siteButtonPack;
} else if (templateId) {
  const template = getTemplate(templateId);
  // template.config.defaultButtonPackId is added in Task 13f; fallback safely until then
  const fromTemplate = (template?.config as any)?.defaultButtonPackId ?? null;
  buttonPack = getButtonPackById(fromTemplate) ?? getDefaultButtonPack();
} else {
  buttonPack = getDefaultButtonPack();
}

const buttonColors = { ...DEFAULT_BUTTON_COLORS, ...(appearanceStyles?.buttonColors ?? {}) };
const btnVars = buildButtonCssVars(buttonPack, buttonColors);
const btnVarsCss = Object.entries(btnVars).map(([k, v]) => `${k}: ${v};`).join(' ');
```

- [ ] **Step 5: Merge `btnVarsCss` into the existing `:root { ... }` style emission**

The file currently builds a CSS string like ``:root { --font-heading: ...; --font-body: ...; }`` and injects it via the existing `<style data-theme-registry>` element. Modify that string construction so the `:root` block reads:

```
:root { --font-heading: ${headingVar}; --font-body: ${bodyVar}; ${btnVarsCss} }
```

Apply this change to BOTH branches (admin and public). The admin branch only emits font + button vars (no body bg) — same partition as today.

- [ ] **Step 6: Set the tertiary-style attribute on `<html>`**

The CSS selector `[data-tertiary-style="underline"]` (from Task 6) reads from a `data-tertiary-style` attribute on `<html>`. There are two acceptable ways to set it during SSR:

**Option A (preferred):** add `data-tertiary-style={buttonPack.tertiaryStyle}` to the `<html>` tag in the root `app/layout.tsx`. To do this, the layout must read `appearanceStyles.buttonPackId` and resolve the pack server-side. If the layout already reads `appearanceStyles` for font pack purposes, extend that resolution. Add the attribute to `<html lang="..." data-tertiary-style={tertiaryStyle}>`.

**Option B (fallback):** if the layout can't easily resolve the pack, add a small inline `<script>` element next to the existing `<style data-theme-registry>` that sets `document.documentElement.setAttribute('data-tertiary-style', '<value>')` on first paint. The value comes from the same `buttonPack.tertiaryStyle` already computed in step 4 — inline as a string literal. (This is the same pattern Next.js dark-mode handoff scripts use; the existing codebase already emits inline script content via SSR for related concerns — match that.)

Pick **A** if `app/layout.tsx` is reasonably accessible; otherwise B. Document the choice in the commit message.

- [ ] **Step 7: Verify SSR emits the vars**

Run: `cd clicker-platform-v2 && pnpm dev`
Visit a public page that uses `ThemeRegistry`.
In devtools, inspect `<html>` — confirm:
- Computed style includes `--btn-radius`, `--btn-primary-fill`, `--btn-secondary-border`, etc.
- `data-tertiary-style="underline"` attribute is present (default pack is `pill` → underline).
- Switch the Firestore `appearance/styles.buttonPackId` to `'brutalist'` and reload → vars and attribute update.

- [ ] **Step 8: Commit**

```bash
git add clicker-platform-v2/components/ThemeRegistry.tsx <layout-file-if-modified>
git commit -m "feat(buttons): emit --btn-* CSS vars from ThemeRegistry SSR"
```

---

## Task 9: Plumb appearanceStyles → ThemeRegistry from layout/server boundary

**Files:**
- Locate: where `ThemeRegistry` is rendered with `appearanceStyles` prop

- [ ] **Step 1: Find the call site(s)**

Run: `grep -rn "ThemeRegistry" clicker-platform-v2/app clicker-platform-v2/components --include="*.tsx" | grep -v ThemeRegistry.tsx`
Note files calling `<ThemeRegistry appearanceStyles=...>`.

- [ ] **Step 2: Verify the data flows**

At each call site, confirm `appearanceStyles` is fetched via `getAppearanceStyles(siteId)`. Because Task 4 extended `getAppearanceStyles` to return `buttonPackId` + `buttonColors`, the new fields flow automatically IF the entire returned object is forwarded.

If a call site picks only `{ fontPackId }` and discards the rest, change it to pass the full object (or at minimum `{ fontPackId, buttonPackId, buttonColors }`).

- [ ] **Step 3: Manual smoke test**

Visit any tenant public page. Inspect `<html>` — confirm `--btn-primary-fill: #111111` (default) appears. Set `sites/{id}/appearance/styles.buttonPackId = 'brutalist'` in Firestore, reload, confirm vars update.

- [ ] **Step 4: Commit (only if changes were needed)**

```bash
git add <changed files>
git commit -m "feat(buttons): forward buttonPack appearance to ThemeRegistry"
```

Skip the commit if no code changes were required.

---

## Task 10: ButtonsSection Admin Panel — Pack Picker

**Files:**
- Create: `clicker-platform-v2/components/admin/blocks/panels/site-styles/ButtonPackCard.tsx`
- Create: `clicker-platform-v2/components/admin/blocks/panels/site-styles/ButtonsSection.tsx`
- Modify: `clicker-platform-v2/components/admin/blocks/panels/SiteStylesPanel.tsx`

- [ ] **Step 1: Implement ButtonPackCard**

```tsx
// clicker-platform-v2/components/admin/blocks/panels/site-styles/ButtonPackCard.tsx
'use client';

import { Check } from 'lucide-react';
import type { ButtonPack } from '@/lib/buttonPacks/types';

type Props = {
  pack: ButtonPack;
  active: boolean;
  onClick: () => void;
};

export function ButtonPackCard({ pack, active, onClick }: Props) {
  const baseBtn = {
    fontWeight: pack.fontWeight,
    letterSpacing: pack.letterSpacing,
    textTransform: pack.textTransform,
    borderRadius: pack.radius,
    padding: '6px 14px',
    fontSize: 10,
  } as const;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        'group relative w-full rounded-lg border bg-white dark:bg-neutral-900 text-left',
        'px-4 py-4 transition-all flex flex-col gap-2 items-center',
        active
          ? 'border-transparent ring-2 ring-blue-600 ring-offset-2 ring-offset-white dark:ring-offset-neutral-900'
          : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600',
      ].join(' ')}
    >
      {active && (
        <span className="absolute top-2 right-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white">
          <Check className="h-3 w-3" strokeWidth={3} />
        </span>
      )}

      <div style={{ ...baseBtn, background: '#111', color: '#fff', border: 0 }}>Primary</div>
      <div style={{
        ...baseBtn,
        background: 'transparent',
        color: '#111',
        border: `${pack.borderWidth}px solid #111`,
        padding: `${6 - pack.borderWidth}px ${14 - pack.borderWidth}px`,
      }}>Secondary</div>
      <div style={{
        fontWeight: pack.fontWeight,
        letterSpacing: pack.letterSpacing,
        textTransform: pack.textTransform,
        fontSize: 10,
        textDecoration: pack.tertiaryStyle === 'underline' ? 'underline' : 'none',
        textUnderlineOffset: 4,
      }}>
        Tertiary{pack.tertiaryStyle === 'arrow' ? ' →' : ''}
      </div>

      <div className="mt-2 text-[11px] uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
        {pack.displayName}
      </div>
    </button>
  );
}
```

- [ ] **Step 2: Implement ButtonsSection (pack picker only — colors in Task 11)**

```tsx
// clicker-platform-v2/components/admin/blocks/panels/site-styles/ButtonsSection.tsx
'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { BUTTON_PACKS } from '@/lib/buttonPacks/packs';
import { getAppearanceStyles, setButtonPackId } from '@/lib/appearance/api';
import { useSite } from '@/lib/site-context';
import { ButtonPackCard } from './ButtonPackCard';
import type { ButtonPackId, ButtonColors } from '@/lib/buttonPacks/types';
import { DEFAULT_BUTTON_COLORS } from '@/lib/buttonPacks/types';

export function ButtonsSection() {
  const { siteId } = useSite();
  const [activeId, setActiveId] = useState<ButtonPackId | null>(null);
  const [colors, setColors] = useState<ButtonColors>(DEFAULT_BUTTON_COLORS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getAppearanceStyles(siteId).then(s => {
      if (!cancelled) {
        setActiveId(s.buttonPackId);
        setColors(s.buttonColors);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [siteId]);

  const handlePick = async (packId: ButtonPackId) => {
    const prev = activeId;
    setActiveId(packId);
    try {
      await setButtonPackId(siteId, packId);
    } catch {
      setActiveId(prev);
      toast.error("Couldn't save button pack. Try again.");
    }
  };

  if (loading) return <div className="text-sm text-neutral-500">Loading…</div>;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="text-xs uppercase tracking-wider text-neutral-500 mb-2">Pack</div>
        <div className="grid grid-cols-2 gap-3">
          {BUTTON_PACKS.map(p => (
            <ButtonPackCard
              key={p.id}
              pack={p}
              active={activeId === p.id}
              onClick={() => handlePick(p.id)}
            />
          ))}
        </div>
      </div>
      {/* Colors editor + preview tile arrive in Task 11 */}
    </div>
  );
}
```

- [ ] **Step 3: Replace ComingSoonTile in SiteStylesPanel**

In `clicker-platform-v2/components/admin/blocks/panels/SiteStylesPanel.tsx`:
- Read the file first.
- Add import: `import { ButtonsSection } from './site-styles/ButtonsSection';`
- Replace `<ComingSoonTile icon={MousePointerClick} label="Buttons" />` with whatever wrapper the file uses around `<FontsSection />` (matching collapsible/group/header structure), but containing `<ButtonsSection />`.

- [ ] **Step 4: Smoke test**

Run: `pnpm dev`, navigate to admin Site Styles panel, open Buttons section. Click each pack — confirm:
1. Active state updates immediately.
2. Selection persists across reload.
3. Public canvas reflects the new pack (if a canvas preview is wired in the panel; otherwise verify against a public route).

- [ ] **Step 5: Commit**

```bash
git add clicker-platform-v2/components/admin/blocks/panels/site-styles/ButtonPackCard.tsx \
        clicker-platform-v2/components/admin/blocks/panels/site-styles/ButtonsSection.tsx \
        clicker-platform-v2/components/admin/blocks/panels/SiteStylesPanel.tsx
git commit -m "feat(buttons): Site Styles → Buttons pack picker (replaces ComingSoon)"
```

---

## Task 11: ButtonsSection — Colors Editor + Preview Tile

**Files:**
- Create: `clicker-platform-v2/components/admin/blocks/panels/site-styles/ButtonColorsEditor.tsx`
- Create: `clicker-platform-v2/components/admin/blocks/panels/site-styles/ButtonsPreviewTile.tsx`
- Modify: `clicker-platform-v2/components/admin/blocks/panels/site-styles/ButtonsSection.tsx`

- [ ] **Step 1: Implement ButtonColorsEditor**

```tsx
// clicker-platform-v2/components/admin/blocks/panels/site-styles/ButtonColorsEditor.tsx
'use client';

import type { ButtonColors } from '@/lib/buttonPacks/types';
import { pickContrastText } from '@/lib/buttonPacks/contrast';

type Props = {
  colors: ButtonColors;
  onChange: (patch: Partial<ButtonColors>) => void;
};

type Row = {
  key: keyof ButtonColors;
  label: string;
  hint: string;
  optional?: boolean;
};

const ROWS: Row[] = [
  { key: 'primaryFill',     label: 'Primary fill',     hint: 'Background of primary buttons' },
  { key: 'primaryText',     label: 'Primary text',     hint: 'Auto-contrast with fill',          optional: true },
  { key: 'secondaryBorder', label: 'Secondary border', hint: 'Border + default text on secondary' },
  { key: 'secondaryText',   label: 'Secondary text',   hint: 'Defaults to border color' },
  { key: 'tertiaryText',    label: 'Tertiary text',    hint: 'Color of text-link tier' },
];

export function ButtonColorsEditor({ colors, onChange }: Props) {
  const autoPrimaryText = pickContrastText(colors.primaryFill);

  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-neutral-500 mb-2">Colors</div>
      <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg divide-y divide-neutral-100 dark:divide-neutral-800">
        {ROWS.map(row => {
          const value = colors[row.key];
          const isAuto = row.optional && (value === undefined || value === null || value === '');
          const displayHex = isAuto ? autoPrimaryText : (value ?? '#000000');
          return (
            <div key={row.key} className="flex items-center justify-between px-3 py-2">
              <div className="flex flex-col">
                <span className="text-sm">{row.label}</span>
                <span className="text-[11px] text-neutral-500">{row.hint}</span>
              </div>
              <div className="flex items-center gap-2">
                {isAuto && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                    AUTO · {autoPrimaryText.toUpperCase()}
                  </span>
                )}
                <code className="text-xs text-neutral-500">{displayHex.toUpperCase()}</code>
                <input
                  type="color"
                  value={displayHex}
                  onChange={(e) => onChange({ [row.key]: e.target.value } as Partial<ButtonColors>)}
                  className="w-7 h-7 rounded border border-neutral-300 cursor-pointer"
                  aria-label={row.label}
                />
                {row.optional && !isAuto && (
                  <button
                    type="button"
                    onClick={() => onChange({ [row.key]: undefined } as Partial<ButtonColors>)}
                    className="text-[10px] text-blue-600 hover:underline"
                  >
                    auto
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Implement ButtonsPreviewTile**

```tsx
// clicker-platform-v2/components/admin/blocks/panels/site-styles/ButtonsPreviewTile.tsx
'use client';

import { ButtonPackProvider } from '@/components/ButtonPackProvider';
import { UnifiedButton } from '@/components/ui/UnifiedButton';
import type { ButtonPackId, ButtonColors } from '@/lib/buttonPacks/types';

type Props = {
  packId: ButtonPackId | null;
  colors: ButtonColors;
};

export function ButtonsPreviewTile({ packId, colors }: Props) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-neutral-500 mb-2">Preview</div>
      <div className="rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 p-4">
        <ButtonPackProvider packId={packId} colors={colors}>
          {(['sm', 'md', 'lg'] as const).map(size => (
            <div key={size} className="mb-3 last:mb-0">
              <div className="text-[10px] uppercase tracking-wider text-neutral-400 text-center mb-1">{size}</div>
              <div className="flex items-center justify-center gap-2">
                <UnifiedButton tier="primary" size={size} onClick={() => {}}>Primary</UnifiedButton>
                <UnifiedButton tier="secondary" size={size} onClick={() => {}}>Secondary</UnifiedButton>
                <UnifiedButton tier="tertiary" size={size} onClick={() => {}}>Tertiary</UnifiedButton>
              </div>
            </div>
          ))}
        </ButtonPackProvider>
      </div>
    </div>
  );
}
```

Note: `ButtonPackProvider` writes CSS vars to `document.documentElement`. The preview tile sharing the root is acceptable because the public canvas reflects the same vars — the preview is honest.

- [ ] **Step 3: Wire into ButtonsSection**

Update `ButtonsSection.tsx` — add these imports:
```tsx
import { ButtonColorsEditor } from './ButtonColorsEditor';
import { ButtonsPreviewTile } from './ButtonsPreviewTile';
import { setButtonColors } from '@/lib/appearance/api';
```

Add the handler inside the component body:
```tsx
const handleColorChange = async (patch: Partial<ButtonColors>) => {
  const prev = colors;
  setColors({ ...colors, ...patch });
  try {
    await setButtonColors(siteId, patch);
  } catch {
    setColors(prev);
    toast.error("Couldn't save colors. Try again.");
  }
};
```

Render below the pack grid:
```tsx
<ButtonColorsEditor colors={colors} onChange={handleColorChange} />
<ButtonsPreviewTile packId={activeId} colors={colors} />
```

- [ ] **Step 4: Smoke test**

Run `pnpm dev`. Visit admin Site Styles → Buttons. Confirm:
- Color pickers update preview live.
- Changing primary fill flips the "AUTO" text label automatically.
- Clicking "auto" on primary text clears the override.
- Reload preserves all values.

- [ ] **Step 5: Commit**

```bash
git add clicker-platform-v2/components/admin/blocks/panels/site-styles/ButtonColorsEditor.tsx \
        clicker-platform-v2/components/admin/blocks/panels/site-styles/ButtonsPreviewTile.tsx \
        clicker-platform-v2/components/admin/blocks/panels/site-styles/ButtonsSection.tsx
git commit -m "feat(buttons): color editor + live preview tile in Buttons panel"
```

---

## Task 12: Migrate DefaultButtonBlock (reference + back-compat shim)

**Files:**
- Modify: `clicker-platform-v2/components/blocks/public/DefaultButtonBlock.tsx`
- Locate + modify: Button Block admin form

- [ ] **Step 1: Replace DefaultButtonBlock**

Final contents of `clicker-platform-v2/components/blocks/public/DefaultButtonBlock.tsx`:

```tsx
'use client';

import React, { useState } from 'react';
import { useSite } from '@/lib/site-context';
import { resolveNavHref } from '@/lib/resolveNavHref';
import { FormModal } from '@/components/FormModal';
import { UnifiedButton } from '@/components/ui/UnifiedButton';
import type { ButtonTier, ButtonSize } from '@/lib/buttonPacks/types';

function isSafeHref(href: string | undefined | null): boolean {
  if (!href) return false;
  return /^(https?:\/\/|\/|#|mailto:|tel:)/i.test(href);
}

function resolveTier(data: any): ButtonTier {
  if (data.tier === 'primary' || data.tier === 'secondary' || data.tier === 'tertiary') return data.tier;
  if (data.variant === 'outline') return 'secondary';
  if (data.variant === 'secondary') return 'secondary';
  return 'primary';
}

function resolveSize(data: any): ButtonSize {
  return data.size === 'sm' || data.size === 'lg' ? data.size : 'md';
}

export const DefaultButtonBlock = ({
  data,
  previewMode,
  siteId: siteIdProp,
}: { data: any; previewMode?: boolean; siteId?: string }) => {
  const { siteId: ctxSiteId, tenantSlug, isSubdomain } = useSite();
  const siteId = siteIdProp || ctxSiteId;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<any>(null);
  const [isLoadingForm, setIsLoadingForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const tier = resolveTier(data);
  const size = resolveSize(data);
  const label = data.label || 'Click Here';
  const linkType = data.linkType || 'url';
  const isFormLink = linkType === 'form' && !!data.formId;
  const fullWidth = data.align === 'full';

  const alignClass =
    fullWidth ? ''
    : data.align === 'left' ? 'text-left'
    : data.align === 'right' ? 'text-right'
    : 'text-center';

  const rawUrl = typeof data.url === 'string' ? data.url.trim() : '';
  const resolvedHref = linkType === 'page'
    ? resolveNavHref(rawUrl, tenantSlug, isSubdomain)
    : rawUrl;
  const safe = isSafeHref(resolvedHref);
  const external = safe && /^(https?:\/\/|mailto:|tel:)/i.test(resolvedHref);
  const openInNewTab = external || data.openInNewTab === true;

  const handleFormClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (previewMode || !siteId) return;
    setFormError(null);
    if (!formData) {
      setIsLoadingForm(true);
      try {
        const res = await fetch(`/api/forms?id=${data.formId}&siteId=${siteId}`);
        if (res.ok) {
          setFormData(await res.json());
          setIsModalOpen(true);
        } else if (res.status === 404) {
          setFormError('Form not found or unpublished.');
        } else {
          setFormError('Could not load form. Please try again.');
        }
      } catch {
        setFormError('Network error. Please check your connection.');
      }
      setIsLoadingForm(false);
    } else {
      setIsModalOpen(true);
    }
  };

  React.useEffect(() => {
    if (!formError) return;
    const t = setTimeout(() => setFormError(null), 4000);
    return () => clearTimeout(t);
  }, [formError]);

  let trigger: React.ReactNode;
  if (previewMode || (!isFormLink && !safe)) {
    trigger = <UnifiedButton tier={tier} size={size} fullWidth={fullWidth}>{label}</UnifiedButton>;
  } else if (isFormLink) {
    trigger = (
      <UnifiedButton
        tier={tier} size={size} fullWidth={fullWidth}
        onClick={handleFormClick} loading={isLoadingForm}
      >
        {label}
      </UnifiedButton>
    );
  } else {
    trigger = (
      <UnifiedButton
        tier={tier} size={size} fullWidth={fullWidth}
        href={resolvedHref} external={openInNewTab}
      >
        {label}
      </UnifiedButton>
    );
  }

  return (
    <>
      <div className={alignClass}>
        {trigger}
        {formError && (
          <div
            role="alert"
            className="mt-2 inline-block text-xs font-medium px-3 py-1.5 rounded-lg border"
            style={{
              backgroundColor: 'var(--theme-error-bg)',
              color: 'var(--theme-error)',
              borderColor: 'var(--theme-error-bg)',
            }}
          >
            {formError}
          </div>
        )}
      </div>
      {isFormLink && isModalOpen && formData && (
        <FormModal form={formData} isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} siteId={siteId} />
      )}
    </>
  );
};
```

- [ ] **Step 2: Locate + update the Button Block admin form**

```bash
grep -rn "'outline'\|\"outline\"" clicker-platform-v2/components/admin --include="*.tsx" | grep -i button
grep -rn "variant" clicker-platform-v2/components/admin --include="*.tsx" | grep -i button
```

In the located form file:
- Replace the "Variant" select with a "Tier" select: options `Primary | Secondary | Tertiary` (values `primary | secondary | tertiary`), default `primary`.
- Add a "Size" select: `Small | Medium | Large` (values `sm | md | lg`), default `md`.
- Form writes `data.tier` and `data.size`. Do NOT delete `data.variant` from existing docs — the shim handles legacy reads.

- [ ] **Step 3: Smoke test with legacy data**

In Firestore, craft a block with `{ variant: 'outline', label: 'Test' }` (no `tier`/`size`). Render the page. Confirm it shows as secondary tier, medium size.

Then in admin, edit the block → switch tier to "Tertiary" → save → confirm `data.tier: 'tertiary'` is written and renders correctly.

- [ ] **Step 4: Commit**

```bash
git add clicker-platform-v2/components/blocks/public/DefaultButtonBlock.tsx \
        <button-form-file-path>
git commit -m "feat(buttons): migrate DefaultButtonBlock to UnifiedButton, add tier/size fields"
```

---

## Task 13: Migrate Remaining Public Blocks

For each sub-task, replace bespoke button rendering with `<UnifiedButton>`. Each is an independent commit.

### 13a — DefaultHeroBlock

**File:** `clicker-platform-v2/components/blocks/public/DefaultHeroBlock.tsx`

- [ ] Read the file; locate CTA button rendering.
- [ ] Replace with:
```tsx
<UnifiedButton tier={data.tier ?? 'primary'} size="lg" href={resolvedHref} external={openInNewTab}>
  {data.ctaLabel}
</UnifiedButton>
```
- [ ] Remove the if-glass / if-clean branching that gated button styles. Leave non-button branches (background, headings) untouched.
- [ ] If the Hero admin form doesn't have a `tier` field, add one (default primary).
- [ ] Smoke test in canvas; commit: `feat(buttons): Hero block uses UnifiedButton (size=lg)`

### 13b — DefaultQuickActionsBlock

**File:** `clicker-platform-v2/components/blocks/public/DefaultQuickActionsBlock.tsx`

- [ ] Locate the per-action button rendering. Note today's default visual treatment (solid / outline).
- [ ] Replace with `<UnifiedButton tier={action.tier ?? 'primary'} size="md" href={action.href}>{action.label}</UnifiedButton>` — set the default `tier` to match the current visual default in the existing code (read carefully before choosing).
- [ ] If individual actions can override their tier, expose `tier` in the per-action editor.
- [ ] Smoke test; commit: `feat(buttons): QuickActions uses UnifiedButton`

### 13c — DefaultFeaturedProductBlock

**File:** `clicker-platform-v2/components/blocks/public/DefaultFeaturedProductBlock.tsx`

- [ ] Locate "View product"/CTA button.
- [ ] Replace with `<UnifiedButton tier="primary" size="md" href={...}>{label}</UnifiedButton>`.
- [ ] Smoke test; commit: `feat(buttons): FeaturedProduct uses UnifiedButton`

### 13d — ReservationBlock

**File:** `clicker-platform-v2/components/blocks/public/ReservationBlock.tsx`

- [ ] Locate submit button(s) and any back/cancel buttons.
- [ ] Submit: `<UnifiedButton tier="primary" size="md" onClick={...} loading={isSubmitting}>`
- [ ] Back/cancel: `<UnifiedButton tier="secondary" size="md" onClick={...}>`
- [ ] Smoke test booking flow end-to-end.
- [ ] Commit: `feat(buttons): Reservation block uses UnifiedButton`

### 13e — DefaultInlineFormBlock

**File:** `clicker-platform-v2/components/blocks/public/DefaultInlineFormBlock.tsx`

- [ ] Locate submit button.
- [ ] Replace with `<UnifiedButton tier="primary" size="md" type="submit" loading={isSubmitting}>{ctaLabel}</UnifiedButton>` — UnifiedButton from Task 6 renders a `<button type="submit">` when `type === 'submit'` even without onClick, so the surrounding `<form onSubmit>` still receives the submit event.
- [ ] Smoke test form submission end-to-end.
- [ ] Commit: `feat(buttons): InlineForm uses UnifiedButton`

### 13f — MRB Blocks + MRB Template Default

**Files:**
- `clicker-platform-v2/components/blocks/mrb/MrbHero.tsx`
- `clicker-platform-v2/components/blocks/mrb/MrbQuickActions.tsx`
- Any other MRB block with a custom button: `grep -rln "className=.*bg-\[" clicker-platform-v2/components/blocks/mrb/`
- `clicker-platform-v2/lib/templates/definitions.ts`

- [ ] For each MRB block, replace bespoke button JSX with `<UnifiedButton>`. Tier defaults: hero CTAs primary, supporting actions secondary, links tertiary.
- [ ] In `lib/templates/definitions.ts`, locate the MRB template config block and add `defaultButtonPackId: 'glass'` alongside the existing `defaultFontPackId`.
- [ ] In `ThemeRegistry.tsx` (already touched in Task 8), the resolution code from Task 8 step 4 already honors `template.config.defaultButtonPackId` via the `(template?.config as any)?.defaultButtonPackId` cast. Now that the field exists, optionally tighten the typing on `TemplateConfig` (or the equivalent template config type in `lib/templates/types.ts`) to include `defaultButtonPackId?: ButtonPackId`.
- [ ] Smoke test MRB tenant: hero, quick actions, and any other button render in glass style by default. Override to `pill` in admin → confirms it switches.
- [ ] Commit: `feat(buttons): MRB blocks use UnifiedButton, glass as template default`

---

## Task 14: Remove Dead Code

**Files:**
- The migrated blocks from Tasks 12–13

- [ ] **Step 1: Search for stale cardStyle branching**

```bash
grep -rn "isGlass\|isClean\|cardStyle === 'glass'\|cardStyle === 'clean'\|cardStyle === 'brutalist'" \
  clicker-platform-v2/components/blocks/public \
  clicker-platform-v2/components/blocks/mrb
```

For each match, if it only branched a button's class string, remove it. If it gates non-button visuals, leave it.

- [ ] **Step 2: Search for old variant-class patterns**

```bash
grep -rn "getVariantClass\|buttonStyle.*borderRadius" clicker-platform-v2/components/blocks/
```

Remove and re-test the affected block.

- [ ] **Step 3: Verify with `pnpm build`**

Run: `cd clicker-platform-v2 && pnpm build`
Expected: clean build. Remove unused imports surfaced by the typechecker.

- [ ] **Step 4: Commit**

```bash
git add -u clicker-platform-v2/components/blocks
git commit -m "refactor(buttons): drop dead per-cardStyle button branching"
```

---

## Task 15: Final Verification

- [ ] **Step 1: Run all unit tests**

Run: `cd clicker-platform-v2 && pnpm test`
Expected: PASS, including the new `contrast.test.ts`, `packs.test.ts`, and extended `api.test.ts`.

- [ ] **Step 2: Lint + typecheck + build**

Run: `cd clicker-platform-v2 && pnpm lint && pnpm build`
Expected: no errors.

- [ ] **Step 3: Manual acceptance checklist (with `pnpm dev`)**

Verify each spec acceptance criterion:

1. Site Styles → Buttons panel: pack picker, color editors, live preview all functional.
2. Public pages render via `<UnifiedButton>` — no `if (isGlass)` branches remain in migrated blocks (confirm with grep from Task 14 Step 1).
3. Switching pack in admin → canvas updates live, no reload.
4. Custom color overrides persist; primary-text AUTO defaults work; manual override wins.
5. Legacy block with `variant: 'outline'` only (no `tier`/`size`) renders as secondary tier.
6. MRB tenant defaults to glass pack; admin override to pill works.
7. Button Block form shows Tier + Size dropdowns; saving writes `tier` + `size`.

- [ ] **Step 4: Final cleanup commit (only if needed)**

```bash
git status
# only commit if there are uncommitted fixes from verification
git add -u
git commit -m "chore(buttons): final cleanup"
```

---

## Self-Review Notes

- All 7 acceptance criteria from the spec mapped to Task 15 verification steps.
- No "TBD" / "fill in details" / "appropriate handling" placeholders.
- Type names consistent across tasks: `ButtonTier`, `ButtonSize`, `ButtonPackId`, `ButtonColors`, `ButtonPack`.
- API names consistent: `getAppearanceStyles`, `setButtonPackId`, `setButtonColors`, `buildButtonCssVars`, `pickContrastText`, `getButtonPackById`, `getDefaultButtonPack`.
- Task 6's UnifiedButton component renders `<button type="submit">` when `type === 'submit'` even without `onClick` — required by Task 13e (InlineForm submit button).
- Task 8 includes a `(template?.config as any)?.defaultButtonPackId` cast that is intentionally permissive — Task 13f adds the actual field. Task 13f also includes the optional follow-up to tighten the typing.
- Task 9 may produce zero changes; the task explicitly says "skip the commit if no code changes were required."
- Task 13a–13e: each sub-task is a self-contained block migration, independently committable, reviewable in isolation.
