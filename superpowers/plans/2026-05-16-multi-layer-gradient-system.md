# Multi-Layer Gradient System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add multi-layer radial gradient support as a reusable, site-scoped visual asset, authored inside Canvas Studio as a dedicated mode, applied to global or per-page backgrounds.

**Architecture:** Gradients are first-class site-scoped Firestore documents at `sites/{siteId}/gradients/{gradientId}`. A neutral `lib/gradients/` module exposes types, CRUD, and a `gradientToCss` helper that any consumer can use. Page backgrounds reference gradients by id via a new `mode: 'gradient'` value on `BackgroundMediaBase`. The Gradient Studio lives as a mode inside Canvas Studio (full page-width canvas, not a side panel).

**Tech Stack:** Next.js (App Router), React, TypeScript, Firebase Firestore (client SDK), Tailwind CSS, Vitest.

**Spec:** [superpowers/specs/2026-05-16-multi-layer-gradient-system.md](../specs/2026-05-16-multi-layer-gradient-system.md)

---

## File Map

**Create:**
- `clicker-platform-v2/lib/gradients/types.ts` — `GradientLayer`, `SavedGradient`
- `clicker-platform-v2/lib/gradients/constants.ts` — DB path constants + defaults
- `clicker-platform-v2/lib/gradients/color.ts` — `withAlpha(hex, opacity)` helper
- `clicker-platform-v2/lib/gradients/toCss.ts` — `gradientToCss(g)` helper
- `clicker-platform-v2/lib/gradients/api.ts` — Firestore CRUD (`getGradients`, `getGradient`, `saveGradient`, `deleteGradient`, `subscribeToGradients`)
- `clicker-platform-v2/lib/gradients/useResolvedGradient.ts` — React hook with in-memory cache + subscription
- `clicker-platform-v2/lib/gradients/__tests__/color.test.ts`
- `clicker-platform-v2/lib/gradients/__tests__/toCss.test.ts`
- `clicker-platform-v2/components/admin/canvas-studio/gradients/GradientStudioMode.tsx` — top-level mode container
- `clicker-platform-v2/components/admin/canvas-studio/gradients/GradientList.tsx` — left rail
- `clicker-platform-v2/components/admin/canvas-studio/gradients/GradientPreview.tsx` — center canvas + handles
- `clicker-platform-v2/components/admin/canvas-studio/gradients/GradientLayerList.tsx` — right rail layer list
- `clicker-platform-v2/components/admin/canvas-studio/gradients/GradientLayerControls.tsx` — right rail selected-layer controls
- `clicker-platform-v2/components/admin/canvas-studio/gradients/ApplyToPicker.tsx` — top-bar dropdown
- `clicker-platform-v2/components/admin/canvas-studio/gradients/SavedGradientPicker.tsx` — used by BackgroundMediaEditor

**Modify:**
- `clicker-platform-v2/data/mockData.ts` — extend `BackgroundMediaBase`
- `clicker-platform-v2/components/blocks/PageBackground.tsx` — handle `mode === 'gradient'`
- `clicker-platform-v2/components/admin/blocks/BackgroundMediaEditor.tsx` — add `'gradient'` option + picker
- `clicker-platform-v2/components/admin/blocks/CanvasStudio.tsx` — add Canvas Studio mode toggle (`'page' | 'gradients'`)

---

## Task 1: Extend `BackgroundMediaBase` type

**Files:**
- Modify: `clicker-platform-v2/data/mockData.ts`

- [ ] **Step 1: Edit the type**

Open `clicker-platform-v2/data/mockData.ts` and replace the `BackgroundMediaBase` interface:

```ts
export interface BackgroundMediaBase {
    mode: 'inherit' | 'color' | 'image' | 'video' | 'gradient';
    url?: string;
    color?: string;
    displaySize?: 'cover' | 'contain' | 'pattern';
    backgroundPosition?: string;
    scrollEffect?: 'scroll' | 'fixed';
    overlayColor?: string;
    overlayOpacity?: number;
    gradientId?: string;
}
```

- [ ] **Step 2: Type-check**

Run: `cd clicker-platform-v2 && pnpm tsc --noEmit`
Expected: PASS — no new errors. (The new field is optional, existing usages remain valid.)

- [ ] **Step 3: Commit**

```bash
git add clicker-platform-v2/data/mockData.ts
git commit -m "feat(gradients): extend BackgroundMediaBase with 'gradient' mode"
```

---

## Task 2: Create gradient types and constants

**Files:**
- Create: `clicker-platform-v2/lib/gradients/types.ts`
- Create: `clicker-platform-v2/lib/gradients/constants.ts`

- [ ] **Step 1: Write types**

Create `clicker-platform-v2/lib/gradients/types.ts`:

```ts
import type { Timestamp } from 'firebase/firestore';

export type GradientShape = 'circle' | 'ellipse';
export type GradientBlendMode = 'normal' | 'screen' | 'multiply' | 'overlay';

export interface GradientLayer {
    id: string;
    color: string;       // hex, e.g. "#fbbf24"
    x: number;           // 0–100 (% from left)
    y: number;           // 0–100 (% from top)
    size: number;        // 0–200 (% of canvas)
    shape: GradientShape;
    opacity: number;     // 0–1
    blendMode: GradientBlendMode;
}

export interface SavedGradient {
    id: string;
    name: string;
    baseColor: string;
    layers: GradientLayer[];
    createdAt?: Timestamp | Date | null;
    updatedAt?: Timestamp | Date | null;
}
```

- [ ] **Step 2: Write constants**

Create `clicker-platform-v2/lib/gradients/constants.ts`:

```ts
import type { GradientLayer, SavedGradient } from './types';

// Firestore path: sites/{siteId}/gradients/{gradientId}
export const GRADIENTS_COLLECTION = 'gradients';

export const DEFAULT_BASE_COLOR = '#1e1b4b'; // indigo-950

export function makeDefaultLayer(idSuffix: string): GradientLayer {
    return {
        id: `layer-${idSuffix}`,
        color: '#fbbf24',
        x: 50,
        y: 50,
        size: 50,
        shape: 'circle',
        opacity: 1,
        blendMode: 'normal',
    };
}

export function makeUntitledGradient(idSuffix: string): Omit<SavedGradient, 'id' | 'createdAt' | 'updatedAt'> {
    return {
        name: 'Untitled',
        baseColor: DEFAULT_BASE_COLOR,
        layers: [makeDefaultLayer(idSuffix)],
    };
}
```

- [ ] **Step 3: Type-check**

Run: `cd clicker-platform-v2 && pnpm tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add clicker-platform-v2/lib/gradients/types.ts clicker-platform-v2/lib/gradients/constants.ts
git commit -m "feat(gradients): add SavedGradient and GradientLayer types"
```

---

## Task 3: `withAlpha` color helper (TDD)

**Files:**
- Create: `clicker-platform-v2/lib/gradients/__tests__/color.test.ts`
- Create: `clicker-platform-v2/lib/gradients/color.ts`

- [ ] **Step 1: Write the failing test**

Create `clicker-platform-v2/lib/gradients/__tests__/color.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { withAlpha } from '../color';

describe('withAlpha', () => {
    it('converts 6-digit hex + opacity to rgba', () => {
        expect(withAlpha('#fbbf24', 1)).toBe('rgba(251, 191, 36, 1)');
    });

    it('handles partial opacity', () => {
        expect(withAlpha('#000000', 0.5)).toBe('rgba(0, 0, 0, 0.5)');
    });

    it('clamps opacity above 1', () => {
        expect(withAlpha('#ffffff', 1.5)).toBe('rgba(255, 255, 255, 1)');
    });

    it('clamps opacity below 0', () => {
        expect(withAlpha('#ffffff', -0.2)).toBe('rgba(255, 255, 255, 0)');
    });

    it('accepts hex without leading #', () => {
        expect(withAlpha('ff0000', 1)).toBe('rgba(255, 0, 0, 1)');
    });

    it('returns rgba(0,0,0,opacity) for malformed input', () => {
        expect(withAlpha('not-a-color', 0.7)).toBe('rgba(0, 0, 0, 0.7)');
    });
});
```

- [ ] **Step 2: Run test, verify failure**

Run: `cd clicker-platform-v2 && pnpm vitest run lib/gradients/__tests__/color.test.ts`
Expected: FAIL — module `../color` not found.

- [ ] **Step 3: Implement**

Create `clicker-platform-v2/lib/gradients/color.ts`:

```ts
export function withAlpha(hex: string, opacity: number): string {
    const clamped = Math.max(0, Math.min(1, opacity));
    const cleaned = hex.replace(/^#/, '');
    if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) {
        return `rgba(0, 0, 0, ${clamped})`;
    }
    const r = parseInt(cleaned.slice(0, 2), 16);
    const g = parseInt(cleaned.slice(2, 4), 16);
    const b = parseInt(cleaned.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${clamped})`;
}
```

- [ ] **Step 4: Run test, verify pass**

Run: `cd clicker-platform-v2 && pnpm vitest run lib/gradients/__tests__/color.test.ts`
Expected: PASS — 6 tests.

- [ ] **Step 5: Commit**

```bash
git add clicker-platform-v2/lib/gradients/color.ts clicker-platform-v2/lib/gradients/__tests__/color.test.ts
git commit -m "feat(gradients): add withAlpha color helper"
```

---

## Task 4: `gradientToCss` helper (TDD)

**Files:**
- Create: `clicker-platform-v2/lib/gradients/__tests__/toCss.test.ts`
- Create: `clicker-platform-v2/lib/gradients/toCss.ts`

- [ ] **Step 1: Write the failing test**

Create `clicker-platform-v2/lib/gradients/__tests__/toCss.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { gradientToCss } from '../toCss';
import type { SavedGradient } from '../types';

function makeGradient(overrides: Partial<SavedGradient> = {}): SavedGradient {
    return {
        id: 'g1',
        name: 'Test',
        baseColor: '#000000',
        layers: [],
        ...overrides,
    };
}

describe('gradientToCss', () => {
    it('returns the base color and empty image for zero layers', () => {
        const css = gradientToCss(makeGradient());
        expect(css.backgroundColor).toBe('#000000');
        expect(css.backgroundImage).toBe('');
        expect(css.backgroundBlendMode).toBe('');
    });

    it('renders a single circle layer', () => {
        const css = gradientToCss(makeGradient({
            layers: [{
                id: 'l1', color: '#ff0000', x: 50, y: 50, size: 40,
                shape: 'circle', opacity: 1, blendMode: 'normal',
            }],
        }));
        expect(css.backgroundImage).toBe(
            'radial-gradient(circle 40% at 50% 50%, rgba(255, 0, 0, 1) 0%, transparent 70%)'
        );
        expect(css.backgroundBlendMode).toBe('normal');
    });

    it('stacks multiple layers comma-separated, first-in-list = frontmost', () => {
        const css = gradientToCss(makeGradient({
            layers: [
                { id: 'top', color: '#ff0000', x: 25, y: 25, size: 30, shape: 'circle', opacity: 1, blendMode: 'screen' },
                { id: 'bot', color: '#0000ff', x: 75, y: 75, size: 40, shape: 'ellipse', opacity: 0.5, blendMode: 'normal' },
            ],
        }));
        expect(css.backgroundImage).toBe(
            'radial-gradient(circle 30% at 25% 25%, rgba(255, 0, 0, 1) 0%, transparent 70%), ' +
            'radial-gradient(ellipse 40% at 75% 75%, rgba(0, 0, 255, 0.5) 0%, transparent 70%)'
        );
        expect(css.backgroundBlendMode).toBe('screen, normal');
    });

    it('skips layers with opacity 0', () => {
        const css = gradientToCss(makeGradient({
            layers: [
                { id: 'hidden', color: '#ff0000', x: 50, y: 50, size: 30, shape: 'circle', opacity: 0, blendMode: 'normal' },
                { id: 'shown',  color: '#00ff00', x: 50, y: 50, size: 30, shape: 'circle', opacity: 1, blendMode: 'normal' },
            ],
        }));
        expect(css.backgroundImage).toBe(
            'radial-gradient(circle 30% at 50% 50%, rgba(0, 255, 0, 1) 0%, transparent 70%)'
        );
        expect(css.backgroundBlendMode).toBe('normal');
    });
});
```

- [ ] **Step 2: Run test, verify failure**

Run: `cd clicker-platform-v2 && pnpm vitest run lib/gradients/__tests__/toCss.test.ts`
Expected: FAIL — module `../toCss` not found.

- [ ] **Step 3: Implement**

Create `clicker-platform-v2/lib/gradients/toCss.ts`:

```ts
import type { SavedGradient } from './types';
import { withAlpha } from './color';

export function gradientToCss(g: SavedGradient): {
    backgroundColor: string;
    backgroundImage: string;
    backgroundBlendMode: string;
} {
    const visible = g.layers.filter(l => l.opacity > 0);

    const backgroundImage = visible
        .map(l => {
            const shape = l.shape === 'circle' ? 'circle' : 'ellipse';
            const color = withAlpha(l.color, l.opacity);
            return `radial-gradient(${shape} ${l.size}% at ${l.x}% ${l.y}%, ${color} 0%, transparent 70%)`;
        })
        .join(', ');

    const backgroundBlendMode = visible.map(l => l.blendMode).join(', ');

    return {
        backgroundColor: g.baseColor,
        backgroundImage,
        backgroundBlendMode,
    };
}
```

- [ ] **Step 4: Run test, verify pass**

Run: `cd clicker-platform-v2 && pnpm vitest run lib/gradients/__tests__/toCss.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add clicker-platform-v2/lib/gradients/toCss.ts clicker-platform-v2/lib/gradients/__tests__/toCss.test.ts
git commit -m "feat(gradients): add gradientToCss helper"
```

---

## Task 5: Firestore CRUD API

**Files:**
- Create: `clicker-platform-v2/lib/gradients/api.ts`

- [ ] **Step 1: Implement**

Create `clicker-platform-v2/lib/gradients/api.ts`:

```ts
import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    deleteDoc,
    onSnapshot,
    serverTimestamp,
    orderBy,
    query,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { SavedGradient } from './types';
import { GRADIENTS_COLLECTION } from './constants';

function gradientsRef(siteId: string) {
    return collection(db, 'sites', siteId, GRADIENTS_COLLECTION);
}

function gradientDoc(siteId: string, gradientId: string) {
    return doc(db, 'sites', siteId, GRADIENTS_COLLECTION, gradientId);
}

export async function getGradients(siteId: string): Promise<SavedGradient[]> {
    const q = query(gradientsRef(siteId), orderBy('updatedAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as SavedGradient));
}

export async function getGradient(siteId: string, gradientId: string): Promise<SavedGradient | null> {
    const snap = await getDoc(gradientDoc(siteId, gradientId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as SavedGradient;
}

export async function saveGradient(
    siteId: string,
    gradient: SavedGradient,
): Promise<void> {
    const { id, createdAt, ...rest } = gradient;
    await setDoc(
        gradientDoc(siteId, id),
        {
            ...rest,
            createdAt: createdAt ?? serverTimestamp(),
            updatedAt: serverTimestamp(),
        },
        { merge: true },
    );
}

export async function deleteGradient(siteId: string, gradientId: string): Promise<void> {
    await deleteDoc(gradientDoc(siteId, gradientId));
}

export function subscribeToGradients(
    siteId: string,
    cb: (gradients: SavedGradient[]) => void,
): () => void {
    const q = query(gradientsRef(siteId), orderBy('updatedAt', 'desc'));
    return onSnapshot(q, snap => {
        cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as SavedGradient)));
    });
}

export function subscribeToGradient(
    siteId: string,
    gradientId: string,
    cb: (gradient: SavedGradient | null) => void,
): () => void {
    return onSnapshot(gradientDoc(siteId, gradientId), snap => {
        if (!snap.exists()) {
            cb(null);
            return;
        }
        cb({ id: snap.id, ...snap.data() } as SavedGradient);
    });
}
```

- [ ] **Step 2: Type-check**

Run: `cd clicker-platform-v2 && pnpm tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add clicker-platform-v2/lib/gradients/api.ts
git commit -m "feat(gradients): Firestore CRUD for SavedGradient"
```

---

## Task 6: `useResolvedGradient` hook with cache

**Files:**
- Create: `clicker-platform-v2/lib/gradients/useResolvedGradient.ts`

- [ ] **Step 1: Implement**

Create `clicker-platform-v2/lib/gradients/useResolvedGradient.ts`:

```ts
'use client';

import { useEffect, useState } from 'react';
import { useSite } from '@/lib/site-context';
import { subscribeToGradient } from './api';
import type { SavedGradient } from './types';

// Module-level cache keyed by `${siteId}/${gradientId}`.
// Survives re-renders; cleared when subscription receives a null doc.
const cache = new Map<string, SavedGradient>();
const subscribers = new Map<string, number>();
const unsubs = new Map<string, () => void>();
const listeners = new Map<string, Set<(g: SavedGradient | null) => void>>();

function keyOf(siteId: string, gradientId: string) {
    return `${siteId}/${gradientId}`;
}

function ensureSubscription(siteId: string, gradientId: string) {
    const key = keyOf(siteId, gradientId);
    if (unsubs.has(key)) return;
    const unsub = subscribeToGradient(siteId, gradientId, g => {
        if (g) cache.set(key, g);
        else cache.delete(key);
        const set = listeners.get(key);
        if (set) set.forEach(fn => fn(g));
    });
    unsubs.set(key, unsub);
}

function releaseSubscription(siteId: string, gradientId: string) {
    const key = keyOf(siteId, gradientId);
    const n = (subscribers.get(key) ?? 0) - 1;
    if (n <= 0) {
        subscribers.delete(key);
        const unsub = unsubs.get(key);
        if (unsub) unsub();
        unsubs.delete(key);
        listeners.delete(key);
        cache.delete(key);
    } else {
        subscribers.set(key, n);
    }
}

export function useResolvedGradient(gradientId: string | undefined | null): SavedGradient | null {
    const { siteId } = useSite();
    const [value, setValue] = useState<SavedGradient | null>(() => {
        if (!siteId || !gradientId) return null;
        return cache.get(keyOf(siteId, gradientId)) ?? null;
    });

    useEffect(() => {
        if (!siteId || !gradientId) {
            setValue(null);
            return;
        }
        const key = keyOf(siteId, gradientId);
        subscribers.set(key, (subscribers.get(key) ?? 0) + 1);
        ensureSubscription(siteId, gradientId);

        const fn = (g: SavedGradient | null) => setValue(g);
        if (!listeners.has(key)) listeners.set(key, new Set());
        listeners.get(key)!.add(fn);

        const cached = cache.get(key);
        if (cached) setValue(cached);

        return () => {
            listeners.get(key)?.delete(fn);
            releaseSubscription(siteId, gradientId);
        };
    }, [siteId, gradientId]);

    return value;
}
```

- [ ] **Step 2: Type-check**

Run: `cd clicker-platform-v2 && pnpm tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add clicker-platform-v2/lib/gradients/useResolvedGradient.ts
git commit -m "feat(gradients): useResolvedGradient hook with shared cache"
```

---

## Task 7: Renderer integration in `PageBackground.tsx`

**Files:**
- Modify: `clicker-platform-v2/components/blocks/PageBackground.tsx`

- [ ] **Step 1: Add gradient branch to `BackgroundLayer`**

Open `clicker-platform-v2/components/blocks/PageBackground.tsx`. Add at the top of the file (after the existing imports):

```ts
import { useResolvedGradient } from '@/lib/gradients/useResolvedGradient';
import { gradientToCss } from '@/lib/gradients/toCss';
```

Inside `BackgroundLayer`, **above** the existing `if (mode === 'color' && color)` block, add:

```tsx
if (mode === 'gradient' && cfg.gradientId) {
    return (
        <GradientBackgroundLayer
            gradientId={cfg.gradientId}
            visibilityClass={visibilityClass}
            positionClass={positionClass}
            overlayColor={overlayColor}
            overlayOpacity={overlayOpacity}
        />
    );
}
```

Then, **outside** `BackgroundLayer` (before `export function PageBackground`), add:

```tsx
function GradientBackgroundLayer({
    gradientId,
    visibilityClass,
    positionClass,
    overlayColor,
    overlayOpacity = 0,
}: {
    gradientId: string;
    visibilityClass: string;
    positionClass: string;
    overlayColor?: string;
    overlayOpacity?: number;
}) {
    const gradient = useResolvedGradient(gradientId);
    if (!gradient) return null;
    const { backgroundColor, backgroundImage, backgroundBlendMode } = gradientToCss(gradient);
    return (
        <div
            className={`${positionClass} inset-0 overflow-hidden pointer-events-none ${visibilityClass}`}
            style={{ zIndex: -15 }}
        >
            <div
                className="absolute inset-0"
                style={{ backgroundColor, backgroundImage, backgroundBlendMode }}
            />
            {(overlayColor || overlayOpacity > 0) && (
                <div className="absolute inset-0" style={{ backgroundColor: overlayColor || '#000000', opacity: overlayOpacity }} />
            )}
        </div>
    );
}
```

Also update the destructure inside `BackgroundLayer` to include `cfg` raw so `cfg.gradientId` is reachable. If the existing destructure shadows `cfg`, keep the parameter name `cfg` and reference `cfg.gradientId` directly (don't add it to the destructure list — `mode` is already pulled out).

- [ ] **Step 2: Type-check**

Run: `cd clicker-platform-v2 && pnpm tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Manual smoke check**

Start dev server (`cd clicker-platform-v2 && pnpm dev`). The app should load without errors. Gradient mode won't be reachable yet from UI — visual verification deferred to Task 10.

- [ ] **Step 4: Commit**

```bash
git add clicker-platform-v2/components/blocks/PageBackground.tsx
git commit -m "feat(gradients): render gradient mode in PageBackground"
```

---

## Task 8: Canvas Studio mode toggle infrastructure

**Files:**
- Modify: `clicker-platform-v2/components/admin/blocks/CanvasStudio.tsx`

- [ ] **Step 1: Add `studioMode` state**

In `CanvasStudio.tsx`, find the desktop state block (around line 90, near `const [activePanel, setActivePanel] = useState...`). Add immediately after:

```tsx
const [studioMode, setStudioMode] = useState<'page' | 'gradients'>('page');
const [activeGradientId, setActiveGradientId] = useState<string | null>(null);
```

- [ ] **Step 2: Render mode toggle in top bar**

Locate the top bar JSX in the same file (search for the existing toolbar — it contains things like `StudioTopBarSlot` or the host bar). Add a toggle near the top-left (look for an existing `<div>` that wraps top-bar action buttons; insert as a sibling):

```tsx
<div className="flex items-center gap-1 rounded-md bg-gray-100 p-0.5">
    <button
        type="button"
        onClick={() => setStudioMode('page')}
        className={`px-3 py-1 text-xs font-medium rounded ${studioMode === 'page' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600'}`}
    >
        Page Editor
    </button>
    <button
        type="button"
        onClick={() => setStudioMode('gradients')}
        className={`px-3 py-1 text-xs font-medium rounded ${studioMode === 'gradients' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600'}`}
    >
        Gradients
    </button>
</div>
```

- [ ] **Step 3: Conditionally render the gradient mode**

Find the main canvas JSX (the area showing the page preview/blocks). Wrap it conditionally:

```tsx
{studioMode === 'page' ? (
    /* existing canvas + side panels JSX, unchanged */
) : (
    <GradientStudioMode
        activeGradientId={activeGradientId}
        onSelectGradient={setActiveGradientId}
        onExit={() => setStudioMode('page')}
    />
)}
```

Add the import at the top:

```ts
const GradientStudioMode = dynamic(() => import('@/components/admin/canvas-studio/gradients/GradientStudioMode').then(m => m.GradientStudioMode));
```

- [ ] **Step 4: Type-check**

Run: `cd clicker-platform-v2 && pnpm tsc --noEmit`
Expected: FAIL — `GradientStudioMode` doesn't exist yet. **Don't fix yet** — the next task creates it. Skip to Step 5.

- [ ] **Step 5: Commit**

```bash
git add clicker-platform-v2/components/admin/blocks/CanvasStudio.tsx
git commit -m "feat(gradients): add Page Editor / Gradients mode toggle to Canvas Studio"
```

---

## Task 9: Gradient Studio mode — list + preview shell

**Files:**
- Create: `clicker-platform-v2/components/admin/canvas-studio/gradients/GradientStudioMode.tsx`
- Create: `clicker-platform-v2/components/admin/canvas-studio/gradients/GradientList.tsx`
- Create: `clicker-platform-v2/components/admin/canvas-studio/gradients/GradientPreview.tsx`

- [ ] **Step 1: Create `GradientList.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useSite } from '@/lib/site-context';
import { subscribeToGradients, saveGradient, deleteGradient } from '@/lib/gradients/api';
import { makeUntitledGradient } from '@/lib/gradients/constants';
import { gradientToCss } from '@/lib/gradients/toCss';
import type { SavedGradient } from '@/lib/gradients/types';

export function GradientList({
    activeId,
    onSelect,
}: {
    activeId: string | null;
    onSelect: (id: string) => void;
}) {
    const { siteId } = useSite();
    const [gradients, setGradients] = useState<SavedGradient[]>([]);

    useEffect(() => {
        if (!siteId) return;
        return subscribeToGradients(siteId, setGradients);
    }, [siteId]);

    async function handleNew() {
        if (!siteId) return;
        const id = `g-${Date.now()}`;
        const next: SavedGradient = { id, ...makeUntitledGradient(id) };
        await saveGradient(siteId, next);
        onSelect(id);
    }

    async function handleDelete(id: string) {
        if (!siteId) return;
        if (!confirm('Delete this gradient?')) return;
        await deleteGradient(siteId, id);
        if (activeId === id) onSelect('');
    }

    return (
        <div className="w-56 border-r border-gray-200 bg-gray-50 p-3 flex flex-col gap-2 overflow-y-auto">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
                Saved Gradients
            </div>
            {gradients.map(g => {
                const css = gradientToCss(g);
                const isActive = g.id === activeId;
                return (
                    <div
                        key={g.id}
                        onClick={() => onSelect(g.id)}
                        className={`group flex items-center gap-2 p-1.5 rounded cursor-pointer ${isActive ? 'bg-indigo-100 border border-indigo-500' : 'hover:bg-white border border-transparent'}`}
                    >
                        <div
                            className="w-8 h-8 rounded border border-gray-300 shrink-0"
                            style={{
                                backgroundColor: css.backgroundColor,
                                backgroundImage: css.backgroundImage,
                                backgroundBlendMode: css.backgroundBlendMode,
                            }}
                        />
                        <span className="flex-1 text-sm truncate">{g.name}</span>
                        <button
                            type="button"
                            onClick={e => { e.stopPropagation(); handleDelete(g.id); }}
                            className="opacity-0 group-hover:opacity-100 text-xs text-gray-400 hover:text-red-600"
                        >
                            ✕
                        </button>
                    </div>
                );
            })}
            <button
                type="button"
                onClick={handleNew}
                className="mt-2 px-2 py-1.5 text-xs border border-dashed border-gray-300 rounded text-gray-700 hover:bg-white"
            >
                + New Gradient
            </button>
        </div>
    );
}
```

- [ ] **Step 2: Create `GradientPreview.tsx`**

```tsx
'use client';

import { useRef } from 'react';
import { gradientToCss } from '@/lib/gradients/toCss';
import type { GradientLayer, SavedGradient } from '@/lib/gradients/types';

export function GradientPreview({
    gradient,
    selectedLayerId,
    onSelectLayer,
    onMoveLayer,
}: {
    gradient: SavedGradient;
    selectedLayerId: string | null;
    onSelectLayer: (id: string | null) => void;
    onMoveLayer: (id: string, x: number, y: number) => void;
}) {
    const canvasRef = useRef<HTMLDivElement>(null);
    const css = gradientToCss(gradient);

    function startDrag(e: React.PointerEvent, layer: GradientLayer) {
        e.stopPropagation();
        e.preventDefault();
        onSelectLayer(layer.id);
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();

        const move = (ev: PointerEvent) => {
            const x = Math.max(0, Math.min(100, ((ev.clientX - rect.left) / rect.width) * 100));
            const y = Math.max(0, Math.min(100, ((ev.clientY - rect.top) / rect.height) * 100));
            onMoveLayer(layer.id, x, y);
        };
        const up = () => {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
    }

    return (
        <div className="flex-1 p-6 flex items-center justify-center bg-gray-100">
            <div
                ref={canvasRef}
                onClick={() => onSelectLayer(null)}
                className="relative w-full max-w-4xl aspect-video rounded-lg overflow-hidden border border-gray-200 shadow-sm"
                style={{
                    backgroundColor: css.backgroundColor,
                    backgroundImage: css.backgroundImage,
                    backgroundBlendMode: css.backgroundBlendMode,
                }}
            >
                {gradient.layers.map(layer => (
                    <div
                        key={layer.id}
                        onPointerDown={e => startDrag(e, layer)}
                        className={`absolute w-4 h-4 rounded-full cursor-move border-[3px] border-white shadow-md ${layer.id === selectedLayerId ? 'ring-2 ring-white' : ''}`}
                        style={{
                            left: `${layer.x}%`,
                            top: `${layer.y}%`,
                            transform: 'translate(-50%, -50%)',
                            backgroundColor: layer.color,
                            boxShadow: `0 0 0 2px ${layer.color}, 0 2px 8px rgba(0,0,0,0.3)`,
                        }}
                    />
                ))}
            </div>
        </div>
    );
}
```

- [ ] **Step 3: Create `GradientStudioMode.tsx` (initial scaffold without controls)**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useSite } from '@/lib/site-context';
import { getGradient, saveGradient } from '@/lib/gradients/api';
import type { GradientLayer, SavedGradient } from '@/lib/gradients/types';
import { GradientList } from './GradientList';
import { GradientPreview } from './GradientPreview';

export function GradientStudioMode({
    activeGradientId,
    onSelectGradient,
    onExit,
}: {
    activeGradientId: string | null;
    onSelectGradient: (id: string) => void;
    onExit: () => void;
}) {
    const { siteId } = useSite();
    const [gradient, setGradient] = useState<SavedGradient | null>(null);
    const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);

    useEffect(() => {
        if (!siteId || !activeGradientId) {
            setGradient(null);
            return;
        }
        getGradient(siteId, activeGradientId).then(setGradient);
    }, [siteId, activeGradientId]);

    // Debounced auto-save
    useEffect(() => {
        if (!siteId || !gradient) return;
        const t = setTimeout(() => { saveGradient(siteId, gradient); }, 500);
        return () => clearTimeout(t);
    }, [siteId, gradient]);

    function patchLayer(id: string, patch: Partial<GradientLayer>) {
        setGradient(g => g ? ({
            ...g,
            layers: g.layers.map(l => l.id === id ? { ...l, ...patch } : l),
        }) : g);
    }

    return (
        <div className="flex flex-1 h-full">
            <GradientList activeId={activeGradientId} onSelect={onSelectGradient} />
            {gradient ? (
                <GradientPreview
                    gradient={gradient}
                    selectedLayerId={selectedLayerId}
                    onSelectLayer={setSelectedLayerId}
                    onMoveLayer={(id, x, y) => patchLayer(id, { x, y })}
                />
            ) : (
                <div className="flex-1 flex items-center justify-center text-sm text-gray-500">
                    Select a gradient on the left, or create a new one.
                </div>
            )}
            {/* Right rail placeholder — added in Task 10 */}
        </div>
    );
}
```

- [ ] **Step 4: Type-check**

Run: `cd clicker-platform-v2 && pnpm tsc --noEmit`
Expected: PASS — Task 8's failing import now resolves.

- [ ] **Step 5: Manual smoke check**

`cd clicker-platform-v2 && pnpm dev`, open Canvas Studio, click **Gradients** in the top bar. Verify: list renders, "+ New Gradient" creates a record, selecting one shows the preview with one draggable handle that updates position live.

- [ ] **Step 6: Commit**

```bash
git add clicker-platform-v2/components/admin/canvas-studio/gradients/
git commit -m "feat(gradients): Gradient Studio shell with list and preview"
```

---

## Task 10: Layer list + controls (right rail)

**Files:**
- Create: `clicker-platform-v2/components/admin/canvas-studio/gradients/GradientLayerList.tsx`
- Create: `clicker-platform-v2/components/admin/canvas-studio/gradients/GradientLayerControls.tsx`
- Modify: `clicker-platform-v2/components/admin/canvas-studio/gradients/GradientStudioMode.tsx`

- [ ] **Step 1: Create `GradientLayerList.tsx`**

```tsx
'use client';

import type { GradientLayer } from '@/lib/gradients/types';

export function GradientLayerList({
    layers,
    selectedLayerId,
    onSelectLayer,
    onAddLayer,
    onDeleteLayer,
    onMoveLayer,
    onPatchLayer,
}: {
    layers: GradientLayer[];
    selectedLayerId: string | null;
    onSelectLayer: (id: string) => void;
    onAddLayer: () => void;
    onDeleteLayer: (id: string) => void;
    onMoveLayer: (id: string, direction: 'up' | 'down') => void;
    onPatchLayer: (id: string, patch: Partial<GradientLayer>) => void;
}) {
    return (
        <div>
            <div className="flex items-center justify-between mb-1.5">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Layers ({layers.length})
                </div>
                <button
                    type="button"
                    onClick={onAddLayer}
                    className="px-2 py-0.5 text-xs border border-gray-300 rounded bg-white hover:bg-gray-50"
                >
                    + Add
                </button>
            </div>
            <div className="flex flex-col gap-1">
                {layers.map((l, idx) => {
                    const isActive = l.id === selectedLayerId;
                    return (
                        <div
                            key={l.id}
                            onClick={() => onSelectLayer(l.id)}
                            className={`flex items-center gap-1.5 p-1.5 rounded border text-xs cursor-pointer ${isActive ? 'bg-indigo-100 border-indigo-500' : 'bg-white border-gray-200 hover:bg-gray-50'}`}
                        >
                            <div className="flex flex-col">
                                <button
                                    type="button"
                                    disabled={idx === 0}
                                    onClick={e => { e.stopPropagation(); onMoveLayer(l.id, 'up'); }}
                                    className="text-[10px] text-gray-400 hover:text-gray-700 disabled:opacity-30"
                                >▲</button>
                                <button
                                    type="button"
                                    disabled={idx === layers.length - 1}
                                    onClick={e => { e.stopPropagation(); onMoveLayer(l.id, 'down'); }}
                                    className="text-[10px] text-gray-400 hover:text-gray-700 disabled:opacity-30"
                                >▼</button>
                            </div>
                            <div className="w-4 h-4 rounded-full border border-gray-300" style={{ backgroundColor: l.color }} />
                            <span className="flex-1">Layer {idx + 1}</span>
                            <button
                                type="button"
                                onClick={e => { e.stopPropagation(); onPatchLayer(l.id, { opacity: l.opacity > 0 ? 0 : 1 }); }}
                                className="text-gray-400 hover:text-gray-700"
                                title={l.opacity > 0 ? 'Hide' : 'Show'}
                            >
                                {l.opacity > 0 ? '👁' : '⊘'}
                            </button>
                            <button
                                type="button"
                                onClick={e => { e.stopPropagation(); onDeleteLayer(l.id); }}
                                className="text-gray-400 hover:text-red-600"
                                title="Delete"
                            >
                                ✕
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Create `GradientLayerControls.tsx`**

```tsx
'use client';

import type { GradientLayer, GradientShape, GradientBlendMode } from '@/lib/gradients/types';

export function GradientLayerControls({
    layer,
    onPatch,
}: {
    layer: GradientLayer;
    onPatch: (patch: Partial<GradientLayer>) => void;
}) {
    return (
        <div className="border-t border-gray-200 pt-3 mt-3 flex flex-col gap-2 text-xs">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Layer settings
            </div>

            <label className="flex items-center gap-2">
                <span className="w-14 text-gray-600">Color</span>
                <input
                    type="color"
                    value={layer.color}
                    onChange={e => onPatch({ color: e.target.value })}
                    className="w-6 h-6 rounded border border-gray-300 cursor-pointer"
                />
                <input
                    type="text"
                    value={layer.color}
                    onChange={e => onPatch({ color: e.target.value })}
                    className="flex-1 px-1.5 py-0.5 text-[11px] border border-gray-300 rounded"
                />
            </label>

            <label className="flex items-center gap-2">
                <span className="w-14 text-gray-600">Size</span>
                <input
                    type="range" min={0} max={200} value={layer.size}
                    onChange={e => onPatch({ size: Number(e.target.value) })}
                    className="flex-1"
                />
                <span className="w-9 text-right text-gray-700">{layer.size}%</span>
            </label>

            <label className="flex items-center gap-2">
                <span className="w-14 text-gray-600">Opacity</span>
                <input
                    type="range" min={0} max={100} value={Math.round(layer.opacity * 100)}
                    onChange={e => onPatch({ opacity: Number(e.target.value) / 100 })}
                    className="flex-1"
                />
                <span className="w-9 text-right text-gray-700">{Math.round(layer.opacity * 100)}%</span>
            </label>

            <label className="flex items-center gap-2">
                <span className="w-14 text-gray-600">Shape</span>
                <select
                    value={layer.shape}
                    onChange={e => onPatch({ shape: e.target.value as GradientShape })}
                    className="flex-1 px-1.5 py-0.5 text-[11px] border border-gray-300 rounded"
                >
                    <option value="circle">Circle</option>
                    <option value="ellipse">Ellipse</option>
                </select>
            </label>

            <label className="flex items-center gap-2">
                <span className="w-14 text-gray-600">Blend</span>
                <select
                    value={layer.blendMode}
                    onChange={e => onPatch({ blendMode: e.target.value as GradientBlendMode })}
                    className="flex-1 px-1.5 py-0.5 text-[11px] border border-gray-300 rounded"
                >
                    <option value="normal">Normal</option>
                    <option value="screen">Screen</option>
                    <option value="multiply">Multiply</option>
                    <option value="overlay">Overlay</option>
                </select>
            </label>
        </div>
    );
}
```

- [ ] **Step 3: Wire right rail into `GradientStudioMode.tsx`**

Replace the existing `GradientStudioMode` body. Update the return JSX and helpers:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useSite } from '@/lib/site-context';
import { getGradient, saveGradient } from '@/lib/gradients/api';
import { makeDefaultLayer } from '@/lib/gradients/constants';
import type { GradientLayer, SavedGradient } from '@/lib/gradients/types';
import { GradientList } from './GradientList';
import { GradientPreview } from './GradientPreview';
import { GradientLayerList } from './GradientLayerList';
import { GradientLayerControls } from './GradientLayerControls';

export function GradientStudioMode({
    activeGradientId,
    onSelectGradient,
    onExit,
}: {
    activeGradientId: string | null;
    onSelectGradient: (id: string) => void;
    onExit: () => void;
}) {
    const { siteId } = useSite();
    const [gradient, setGradient] = useState<SavedGradient | null>(null);
    const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);

    useEffect(() => {
        if (!siteId || !activeGradientId) { setGradient(null); return; }
        getGradient(siteId, activeGradientId).then(setGradient);
    }, [siteId, activeGradientId]);

    useEffect(() => {
        if (!siteId || !gradient) return;
        const t = setTimeout(() => { saveGradient(siteId, gradient); }, 500);
        return () => clearTimeout(t);
    }, [siteId, gradient]);

    function patchLayer(id: string, patch: Partial<GradientLayer>) {
        setGradient(g => g ? ({ ...g, layers: g.layers.map(l => l.id === id ? { ...l, ...patch } : l) }) : g);
    }

    function addLayer() {
        setGradient(g => {
            if (!g) return g;
            const layer = makeDefaultLayer(String(Date.now()));
            return { ...g, layers: [layer, ...g.layers] };
        });
    }

    function deleteLayer(id: string) {
        setGradient(g => g ? ({ ...g, layers: g.layers.filter(l => l.id !== id) }) : g);
        if (selectedLayerId === id) setSelectedLayerId(null);
    }

    function moveLayer(id: string, dir: 'up' | 'down') {
        setGradient(g => {
            if (!g) return g;
            const idx = g.layers.findIndex(l => l.id === id);
            if (idx < 0) return g;
            const target = dir === 'up' ? idx - 1 : idx + 1;
            if (target < 0 || target >= g.layers.length) return g;
            const next = [...g.layers];
            [next[idx], next[target]] = [next[target], next[idx]];
            return { ...g, layers: next };
        });
    }

    const selectedLayer = gradient?.layers.find(l => l.id === selectedLayerId) ?? null;

    return (
        <div className="flex flex-1 h-full">
            <GradientList activeId={activeGradientId} onSelect={onSelectGradient} />

            {gradient ? (
                <>
                    <GradientPreview
                        gradient={gradient}
                        selectedLayerId={selectedLayerId}
                        onSelectLayer={setSelectedLayerId}
                        onMoveLayer={(id, x, y) => patchLayer(id, { x, y })}
                    />
                    <div className="w-72 border-l border-gray-200 bg-gray-50 p-3 flex flex-col gap-3 overflow-y-auto">
                        <div>
                            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">Name</div>
                            <input
                                type="text"
                                value={gradient.name}
                                onChange={e => setGradient(g => g ? { ...g, name: e.target.value } : g)}
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                            />
                        </div>

                        <div>
                            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">Base Canvas</div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="color"
                                    value={gradient.baseColor}
                                    onChange={e => setGradient(g => g ? { ...g, baseColor: e.target.value } : g)}
                                    className="w-6 h-6 rounded border border-gray-300 cursor-pointer"
                                />
                                <input
                                    type="text"
                                    value={gradient.baseColor}
                                    onChange={e => setGradient(g => g ? { ...g, baseColor: e.target.value } : g)}
                                    className="flex-1 px-1.5 py-0.5 text-[11px] border border-gray-300 rounded"
                                />
                            </div>
                        </div>

                        <GradientLayerList
                            layers={gradient.layers}
                            selectedLayerId={selectedLayerId}
                            onSelectLayer={setSelectedLayerId}
                            onAddLayer={addLayer}
                            onDeleteLayer={deleteLayer}
                            onMoveLayer={moveLayer}
                            onPatchLayer={patchLayer}
                        />

                        {selectedLayer && (
                            <GradientLayerControls
                                layer={selectedLayer}
                                onPatch={p => patchLayer(selectedLayer.id, p)}
                            />
                        )}
                    </div>
                </>
            ) : (
                <div className="flex-1 flex items-center justify-center text-sm text-gray-500">
                    Select a gradient on the left, or create a new one.
                </div>
            )}
        </div>
    );
}
```

- [ ] **Step 4: Type-check**

Run: `cd clicker-platform-v2 && pnpm tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Manual smoke check**

`cd clicker-platform-v2 && pnpm dev`. In Canvas Studio → Gradients mode: create gradient, add layers, drag handles, change colors/sizes/opacity/blend, reorder, delete. Verify auto-save by refreshing — state persists.

- [ ] **Step 6: Commit**

```bash
git add clicker-platform-v2/components/admin/canvas-studio/gradients/
git commit -m "feat(gradients): layer list and per-layer controls"
```

---

## Task 11: Apply to… dropdown

**Files:**
- Create: `clicker-platform-v2/components/admin/canvas-studio/gradients/ApplyToPicker.tsx`
- Modify: `clicker-platform-v2/components/admin/canvas-studio/gradients/GradientStudioMode.tsx`

- [ ] **Step 1: Create `ApplyToPicker.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { doc, setDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useSite } from '@/lib/site-context';

type PageOption = { id: string; title: string };

export function ApplyToPicker({ gradientId, gradientName }: { gradientId: string; gradientName: string }) {
    const { siteId } = useSite();
    const [open, setOpen] = useState(false);
    const [pages, setPages] = useState<PageOption[]>([]);
    const [pagePickerOpen, setPagePickerOpen] = useState(false);
    const [toast, setToast] = useState<string | null>(null);

    useEffect(() => {
        if (!siteId || !pagePickerOpen) return;
        getDocs(collection(db, 'sites', siteId, 'pages')).then(snap => {
            setPages(snap.docs.map(d => ({ id: d.id, title: (d.data() as any).title || d.id })));
        });
    }, [siteId, pagePickerOpen]);

    async function applyGlobal() {
        if (!siteId) return;
        await setDoc(
            doc(db, 'sites', siteId, 'content', 'siteSettings'),
            { globalBackground: { mode: 'gradient', gradientId } },
            { merge: true },
        );
        showToast(`"${gradientName}" applied to Global Background`);
        setOpen(false);
    }

    async function applyPage(pageId: string, title: string) {
        if (!siteId) return;
        await setDoc(
            doc(db, 'sites', siteId, 'pages', pageId),
            { background: { mode: 'gradient', gradientId } },
            { merge: true },
        );
        showToast(`"${gradientName}" applied to page "${title}"`);
        setOpen(false);
        setPagePickerOpen(false);
    }

    function showToast(msg: string) {
        setToast(msg);
        setTimeout(() => setToast(null), 2400);
    }

    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setOpen(v => !v)}
                className="px-3 py-1 text-xs font-medium rounded bg-indigo-600 text-white hover:bg-indigo-700"
            >
                Apply to… ▾
            </button>
            {open && (
                <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-gray-200 rounded shadow-lg z-50">
                    <button
                        type="button"
                        onClick={applyGlobal}
                        className="block w-full text-left px-3 py-2 text-xs hover:bg-gray-50"
                    >
                        Global Background
                    </button>
                    <button
                        type="button"
                        onClick={() => setPagePickerOpen(v => !v)}
                        className="block w-full text-left px-3 py-2 text-xs hover:bg-gray-50 border-t border-gray-100"
                    >
                        Page: …
                    </button>
                    {pagePickerOpen && (
                        <div className="border-t border-gray-100 max-h-48 overflow-y-auto">
                            {pages.map(p => (
                                <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => applyPage(p.id, p.title)}
                                    className="block w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50"
                                >
                                    {p.title}
                                </button>
                            ))}
                            {pages.length === 0 && (
                                <div className="px-3 py-2 text-xs text-gray-500">No pages</div>
                            )}
                        </div>
                    )}
                </div>
            )}
            {toast && (
                <div className="fixed bottom-6 right-6 bg-gray-900 text-white text-xs px-3 py-2 rounded shadow-lg z-50">
                    {toast}
                </div>
            )}
        </div>
    );
}
```

- [ ] **Step 2: Mount the picker in `GradientStudioMode`**

In `GradientStudioMode.tsx`, add the import at the top:

```ts
import { ApplyToPicker } from './ApplyToPicker';
```

Replace the right-rail Name field block (`<div><div className="text-xs font-semibold ... Name</div>...`) with one that shows the picker beside the name input:

```tsx
<div>
    <div className="flex items-center justify-between mb-1.5">
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Name</div>
        <ApplyToPicker gradientId={gradient.id} gradientName={gradient.name} />
    </div>
    <input
        type="text"
        value={gradient.name}
        onChange={e => setGradient(g => g ? { ...g, name: e.target.value } : g)}
        className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
    />
</div>
```

- [ ] **Step 3: Type-check**

Run: `cd clicker-platform-v2 && pnpm tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Manual smoke check**

In Canvas Studio → Gradients mode: edit a gradient, click **Apply to… → Global Background**. Switch back to Page Editor mode and reload — the page should render with the gradient as its background. Repeat with **Page: <title>** for a specific page.

- [ ] **Step 5: Commit**

```bash
git add clicker-platform-v2/components/admin/canvas-studio/gradients/
git commit -m "feat(gradients): Apply to… dropdown for Global and per-page targets"
```

---

## Task 12: `BackgroundMediaEditor` integration

**Files:**
- Create: `clicker-platform-v2/components/admin/canvas-studio/gradients/SavedGradientPicker.tsx`
- Modify: `clicker-platform-v2/components/admin/blocks/BackgroundMediaEditor.tsx`

- [ ] **Step 1: Create `SavedGradientPicker.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useSite } from '@/lib/site-context';
import { subscribeToGradients } from '@/lib/gradients/api';
import { gradientToCss } from '@/lib/gradients/toCss';
import type { SavedGradient } from '@/lib/gradients/types';

export function SavedGradientPicker({
    value,
    onChange,
}: {
    value?: string;
    onChange: (gradientId: string) => void;
}) {
    const { siteId } = useSite();
    const [gradients, setGradients] = useState<SavedGradient[]>([]);

    useEffect(() => {
        if (!siteId) return;
        return subscribeToGradients(siteId, setGradients);
    }, [siteId]);

    if (gradients.length === 0) {
        return (
            <div className="text-xs text-gray-500 p-3 border border-dashed border-gray-300 rounded">
                No saved gradients yet. Open the <strong>Gradients</strong> tab in Canvas Studio to create one.
            </div>
        );
    }

    return (
        <div className="grid grid-cols-3 gap-2">
            {gradients.map(g => {
                const css = gradientToCss(g);
                const isActive = g.id === value;
                return (
                    <button
                        key={g.id}
                        type="button"
                        onClick={() => onChange(g.id)}
                        className={`group rounded border-2 overflow-hidden ${isActive ? 'border-indigo-500' : 'border-transparent hover:border-gray-300'}`}
                    >
                        <div
                            className="w-full aspect-square"
                            style={{
                                backgroundColor: css.backgroundColor,
                                backgroundImage: css.backgroundImage,
                                backgroundBlendMode: css.backgroundBlendMode,
                            }}
                        />
                        <div className="text-[10px] truncate px-1 py-0.5 bg-white">{g.name}</div>
                    </button>
                );
            })}
        </div>
    );
}
```

- [ ] **Step 2: Add `'gradient'` option and picker to `BackgroundMediaEditor.tsx`**

Open `clicker-platform-v2/components/admin/blocks/BackgroundMediaEditor.tsx`.

Add at top of file:

```ts
import { SavedGradientPicker } from '@/components/admin/canvas-studio/gradients/SavedGradientPicker';
```

Find the existing mode `<select>` (it has options like `Inherit Global Background`, `Solid Color`, `Image`, `Video URL`). Add a new `<option>` to it:

```tsx
<option value="gradient">Saved Gradient</option>
```

Locate where the editor renders per-mode content (the `if (bg.mode === 'color') {...}`, `if (bg.mode === 'image')`, etc. blocks). Add a new branch alongside them:

```tsx
{bg.mode === 'gradient' && (
    <div className="mt-2">
        <SavedGradientPicker
            value={bg.gradientId}
            onChange={gradientId => patch({ gradientId })}
        />
    </div>
)}
```

- [ ] **Step 3: Type-check**

Run: `cd clicker-platform-v2 && pnpm tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Manual smoke check**

In Canvas Studio → Page Editor mode → Page Background panel. Change `Background Type` to **Saved Gradient**. The picker grid appears showing thumbnails of gradients created in Task 11. Selecting one applies it to the page background. Verify the page preview updates live.

- [ ] **Step 5: Commit**

```bash
git add clicker-platform-v2/components/admin/blocks/BackgroundMediaEditor.tsx clicker-platform-v2/components/admin/canvas-studio/gradients/SavedGradientPicker.tsx
git commit -m "feat(gradients): wire Saved Gradient option into BackgroundMediaEditor"
```

---

## Task 13: End-to-end manual verification

**Files:** none

- [ ] **Step 1: Start dev server**

Run: `cd clicker-platform-v2 && pnpm dev`

- [ ] **Step 2: Verify the golden path**

1. Open Canvas Studio for any tenant.
2. Switch to **Gradients** mode.
3. Click **+ New Gradient** — a new "Untitled" appears in the list.
4. Rename it to "Test Sunset".
5. Add 2 more layers (Yellow at top-left, Pink at bottom-right).
6. Drag handles around — preview updates live.
7. Change blend mode on one layer to **Screen** — verify visual change.
8. Toggle a layer's visibility off — preview updates; toggle back on.
9. Click **Apply to… → Global Background**. Toast appears.
10. Switch to **Page Editor** mode. Reload the page. The page renders with the gradient.
11. Open Page Background panel. Change type to **Saved Gradient**. Verify the picker shows "Test Sunset" and is selectable.
12. Visit the public-facing tenant URL (e.g. `localhost:3000/[tenant]`). Verify the gradient renders on the public page too.

- [ ] **Step 3: Run all tests**

Run: `cd clicker-platform-v2 && pnpm test`
Expected: All tests pass — including the new `color.test.ts` and `toCss.test.ts`.

- [ ] **Step 4: Lint**

Run: `cd clicker-platform-v2 && pnpm lint`
Expected: PASS (or no new errors introduced).

- [ ] **Step 5: Production build**

Run: `cd clicker-platform-v2 && pnpm build`
Expected: PASS.

- [ ] **Step 6: Commit any final fixes**

If any of the above turned up small issues, fix them inline and commit. Otherwise skip.

```bash
git add -A && git commit -m "chore(gradients): final polish from QA pass"
```

---

## Self-Review Notes

- All 13 spec sections have corresponding tasks (data model → 1+2; CSS output → 3+4; file layout → established across 2,5,6; Canvas Studio integration → 8+9+10; UX interactions → 9+10+11; renderer → 7; RBAC implicit via `useSite()`; testing → 3+4 unit + 13 manual).
- No placeholders. All code blocks complete.
- Type consistency: `GradientLayer`, `SavedGradient`, `patchLayer`, `addLayer`, `moveLayer` used consistently across Tasks 6, 9, 10, 11.
- `'gradient'` mode value used identically everywhere (`BackgroundMediaBase.mode`, `BackgroundMediaEditor` option, `PageBackground` branch).
- Firestore paths consistent: `sites/{siteId}/gradients/{id}` for gradient docs; `sites/{siteId}/content/siteSettings` (existing) for `globalBackground`; `sites/{siteId}/pages/{id}` for per-page background.
