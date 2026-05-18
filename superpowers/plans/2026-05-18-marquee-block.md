# Marquee Block Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new public block type `marquee` to Canvas Studio — a horizontally-scrolling icon+label ticker with CSS-only animation, mask-fade edges, pause-on-hover, and a "Paste SVG" icon escape hatch.

**Architecture:** Pure-CSS marquee (translateX keyframes + auto-duplicated items for seamless loop) wrapped in a mask-image gradient for fade edges. Icons render either via the existing `ICON_MAP` Lucide registry or via inline-sanitized SVG markup. SVG sanitization is a dedicated module (`lib/sanitizeSvgIcon.ts`) using `isomorphic-dompurify` with an SVG-only allowlist and color normalization to `currentColor`.

**Tech Stack:** Next.js + React, TypeScript, Tailwind, `lucide-react`, `isomorphic-dompurify`, `@dnd-kit/sortable`, Vitest, React Testing Library.

**Spec:** `superpowers/specs/2026-05-18-marquee-block-design.md`

**Working directory for all commands:** `/Users/andre/Repository/clicker-universe/dev/clicker-platform-v2`

**Security note:** Inline-SVG injection is isolated to one wrapper (`SafeSvgIcon`) that always passes through the dedicated sanitizer. All other code paths use Lucide React components — no inline-HTML APIs anywhere else in this feature.

---

## File Structure

**New files:**
- `components/blocks/marquee/types.ts` — types + default-data factory + speed/size/gap maps
- `components/blocks/public/DefaultMarqueeBlock.tsx` — public renderer (client component, CSS animation)
- `components/blocks/public/SafeSvgIcon.tsx` — wrapper that calls `sanitizeSvgIcon` then injects
- `components/admin/blocks/forms/MarqueeForm.tsx` — admin properties panel
- `components/admin/blocks/forms/marquee/SortableMarqueeItem.tsx` — single item row
- `components/admin/blocks/forms/marquee/IconKindPopover.tsx` — popover with "Pick" + "Paste SVG" tabs
- `lib/sanitizeSvgIcon.ts` — SVG-only DOMPurify wrapper + color normalization
- `lib/sanitizeSvgIcon.test.ts` — unit tests for sanitizer
- `components/blocks/public/__tests__/marquee.test.tsx` — render tests
- `app/globals.css` *(modify)* — add `@keyframes marquee-left` / `marquee-right`

**Modified files:**
- `data/mockData.ts` — add `'marquee'` to `BlockType` union
- `components/admin/blocks/blockDefinitions.ts` — add picker entry + default-data case
- `components/blocks/BlockRenderer.tsx` — register public renderer
- `components/admin/blocks/BlockFormRenderer.tsx` — register admin form

---

## Task 1: Add `marquee` to BlockType union

**Files:**
- Modify: `data/mockData.ts` (line 30)

- [ ] **Step 1: Edit the BlockType union**

Open `data/mockData.ts`. Find the line starting with `export type BlockType =` (around line 30). Add `'marquee'` before the trailing `| string`:

```ts
export type BlockType = 'hero' | 'text' | 'image' | 'button' | 'products' | 'faq' | 'link' | 'map' | 'image_gallery' | 'social_embed' | 'quick_actions' | 'hours' | 'featured_product' | 'branches' | 'reservation' | 'reservation_cta' | 'content_showcase' | 'inline_form' | 'heading' | 'feature_cards' | 'columns' | 'grid' | 'marquee' | string;
```

- [ ] **Step 2: Typecheck**

Run: `pnpm tsc --noEmit`
Expected: no new errors. (Existing errors unrelated to this work may exist; just verify nothing new appeared.)

- [ ] **Step 3: Commit**

```bash
git add data/mockData.ts
git commit -m "feat(marquee): add marquee to BlockType union"
```

---

## Task 2: Create marquee types module

**Files:**
- Create: `components/blocks/marquee/types.ts`

- [ ] **Step 1: Create the types file**

Create `components/blocks/marquee/types.ts` with this exact content:

```ts
import { v4 as uuidv4 } from 'uuid';

export type MarqueeSpeed = 'slow' | 'normal' | 'fast';
export type MarqueeDirection = 'left' | 'right';
export type MarqueeIconSize = 'sm' | 'md' | 'lg';
export type MarqueeItemGap = 'tight' | 'normal' | 'loose';

export type MarqueeIcon =
    | { kind: 'lucide'; name: string }
    | { kind: 'svg'; svg: string };

export interface MarqueeItem {
    id: string;
    label: string;
    icon: MarqueeIcon;
}

export interface MarqueeBlockData {
    items: MarqueeItem[];
    speed: MarqueeSpeed;
    direction: MarqueeDirection;
    iconSize: MarqueeIconSize;
    itemGap: MarqueeItemGap;
    color?: string; // hex or theme color token (mirrors FeatureCard.textColor)
}

export const MARQUEE_SPEED_SECONDS: Record<MarqueeSpeed, number> = {
    slow: 45,
    normal: 30,
    fast: 18,
};

export const MARQUEE_ICON_PX: Record<MarqueeIconSize, number> = {
    sm: 16,
    md: 20,
    lg: 24,
};

export const MARQUEE_GAP_PX: Record<MarqueeItemGap, number> = {
    tight: 32,
    normal: 48,
    loose: 72,
};

export const MARQUEE_MASK_GUTTER_PX = 48;

export function makeDefaultMarqueeItem(label = 'New item', iconName = 'Star'): MarqueeItem {
    return { id: uuidv4(), label, icon: { kind: 'lucide', name: iconName } };
}

export const DEFAULT_MARQUEE_DATA: MarqueeBlockData = {
    items: [
        makeDefaultMarqueeItem('100% Online', 'Globe'),
        makeDefaultMarqueeItem('Clear Pricing', 'DollarSign'),
        makeDefaultMarqueeItem('Shipped To Your Door', 'Package'),
        makeDefaultMarqueeItem('Licensed Providers', 'Award'),
    ],
    speed: 'normal',
    direction: 'left',
    iconSize: 'md',
    itemGap: 'normal',
};
```

- [ ] **Step 2: Typecheck**

Run: `pnpm tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add components/blocks/marquee/types.ts
git commit -m "feat(marquee): add types module + default data"
```

---

## Task 3: SVG sanitizer — failing test

**Files:**
- Create: `lib/sanitizeSvgIcon.test.ts`

- [ ] **Step 1: Write the test file**

Create `lib/sanitizeSvgIcon.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { sanitizeSvgIcon } from './sanitizeSvgIcon';

const LUCIDE_CHECK = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';

describe('sanitizeSvgIcon', () => {
    it('returns empty string for non-SVG input', () => {
        expect(sanitizeSvgIcon('')).toBe('');
        expect(sanitizeSvgIcon('hello world')).toBe('');
        expect(sanitizeSvgIcon('<div>not svg</div>')).toBe('');
    });

    it('strips <script> tags', () => {
        const malicious = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><script>alert(1)</script><path d="M1 1"/></svg>`;
        const out = sanitizeSvgIcon(malicious);
        expect(out).not.toContain('<script');
        expect(out).not.toContain('alert');
        expect(out).toContain('<path');
    });

    it('strips on* event handlers', () => {
        const malicious = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" onload="alert(1)"><path d="M1 1" onclick="alert(2)"/></svg>`;
        const out = sanitizeSvgIcon(malicious);
        expect(out).not.toContain('onload');
        expect(out).not.toContain('onclick');
        expect(out).not.toContain('alert');
    });

    it('strips href and xlink:href to prevent external refs', () => {
        const malicious = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><use href="http://evil.com/x.svg#a"/><use xlink:href="http://evil.com/y.svg#b"/></svg>`;
        const out = sanitizeSvgIcon(malicious);
        expect(out).not.toContain('evil.com');
        expect(out).not.toContain('href=');
    });

    it('preserves Lucide-shaped paste with currentColor stroke', () => {
        const out = sanitizeSvgIcon(LUCIDE_CHECK);
        expect(out).toContain('<svg');
        expect(out).toContain('<path');
        expect(out).toContain('d="M20 6 9 17l-5-5"');
        expect(out).toContain('currentColor');
    });

    it('normalizes hardcoded stroke color to currentColor', () => {
        const hardcoded = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke="#000000" fill="none"><path d="M1 1" stroke="#ff0000"/></svg>`;
        const out = sanitizeSvgIcon(hardcoded);
        expect(out).not.toContain('#000000');
        expect(out).not.toContain('#ff0000');
        expect(out.match(/currentColor/g)?.length).toBeGreaterThanOrEqual(2);
    });

    it('leaves fill="none" intact', () => {
        const out = sanitizeSvgIcon(LUCIDE_CHECK);
        expect(out).toContain('fill="none"');
    });

    it('forces width="1em" and height="1em" on root svg', () => {
        const out = sanitizeSvgIcon(LUCIDE_CHECK);
        expect(out).toMatch(/<svg[^>]*\swidth="1em"/);
        expect(out).toMatch(/<svg[^>]*\sheight="1em"/);
    });
});
```

- [ ] **Step 2: Run the test — verify it fails**

Run: `pnpm vitest run lib/sanitizeSvgIcon.test.ts`
Expected: FAIL with "Cannot find module './sanitizeSvgIcon'".

- [ ] **Step 3: Commit**

```bash
git add lib/sanitizeSvgIcon.test.ts
git commit -m "test(marquee): add failing tests for sanitizeSvgIcon"
```

---

## Task 4: SVG sanitizer — implementation

**Files:**
- Create: `lib/sanitizeSvgIcon.ts`

- [ ] **Step 1: Implement the sanitizer**

Create `lib/sanitizeSvgIcon.ts`:

```ts
import DOMPurify from 'isomorphic-dompurify';

const SVG_TAGS = [
    'svg', 'g', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'ellipse',
    'defs', 'linearGradient', 'radialGradient', 'stop', 'mask', 'clipPath', 'use', 'title',
];

const SVG_ATTRS = [
    'viewBox', 'xmlns', 'class', 'transform', 'opacity',
    'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin',
    'd', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'x1', 'y1', 'x2', 'y2',
    'points', 'width', 'height', 'offset', 'stop-color',
];

function normalizeColors(svg: string): string {
    return svg.replace(/(stroke|fill)="([^"]*)"/g, (_match, attr, value) => {
        const v = value.trim().toLowerCase();
        if (v === 'none' || v === 'currentcolor' || v === '') return `${attr}="${value}"`;
        return `${attr}="currentColor"`;
    });
}

function forceRootSize(svg: string): string {
    return svg.replace(/<svg\b([^>]*)>/i, (_full, attrs) => {
        const cleaned = attrs
            .replace(/\swidth="[^"]*"/i, '')
            .replace(/\sheight="[^"]*"/i, '');
        return `<svg${cleaned} width="1em" height="1em">`;
    });
}

export function sanitizeSvgIcon(input: string | null | undefined): string {
    if (!input) return '';
    const trimmed = input.trim();
    if (!trimmed.toLowerCase().includes('<svg')) return '';

    const purified = DOMPurify.sanitize(trimmed, {
        USE_PROFILES: { svg: true, svgFilters: false },
        ALLOWED_TAGS: SVG_TAGS,
        ALLOWED_ATTR: SVG_ATTRS,
        FORBID_ATTR: ['href', 'xlink:href', 'style'],
        FORBID_TAGS: ['script', 'style', 'foreignObject'],
    });

    if (!purified || !purified.toLowerCase().includes('<svg')) return '';

    const normalized = normalizeColors(purified);
    const sized = forceRootSize(normalized);
    return sized;
}
```

- [ ] **Step 2: Run the tests — verify they pass**

Run: `pnpm vitest run lib/sanitizeSvgIcon.test.ts`
Expected: PASS (all 8 tests).

If a test fails:
- "preserves currentColor" failing: confirm DOMPurify retains the `stroke` attribute value casing. If it lowercases, change `normalizeColors` to explicitly emit `${attr}="currentColor"` even when the input was already `currentColor`.
- "forces width=1em" failing: the regex only matches if `<svg` is followed by attrs; ensure DOMPurify output has a standard `<svg ...>` opening.

- [ ] **Step 3: Commit**

```bash
git add lib/sanitizeSvgIcon.ts
git commit -m "feat(marquee): implement sanitizeSvgIcon with SVG-only allowlist + color normalization"
```

---

## Task 5: SafeSvgIcon wrapper component

**Files:**
- Create: `components/blocks/public/SafeSvgIcon.tsx`

- [ ] **Step 1: Create the wrapper**

Create `components/blocks/public/SafeSvgIcon.tsx`:

```tsx
import React from 'react';
import { sanitizeSvgIcon } from '@/lib/sanitizeSvgIcon';

interface SafeSvgIconProps {
    svg: string;
    className?: string;
    'aria-hidden'?: boolean;
}

// Renders raw SVG markup after passing it through sanitizeSvgIcon.
// Isolates the inline-HTML injection to one well-tested call site.
export const SafeSvgIcon: React.FC<SafeSvgIconProps> = ({ svg, className, 'aria-hidden': ariaHidden = true }) => {
    const safe = React.useMemo(() => sanitizeSvgIcon(svg), [svg]);
    if (!safe) return null;
    return (
        <span
            className={className}
            aria-hidden={ariaHidden}
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
            dangerouslySetInnerHTML={{ __html: safe }}
        />
    );
};
```

- [ ] **Step 2: Typecheck**

Run: `pnpm tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add components/blocks/public/SafeSvgIcon.tsx
git commit -m "feat(marquee): add SafeSvgIcon wrapper isolating sanitize+inject"
```

---

## Task 6: Marquee CSS keyframes in globals

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Append marquee keyframes**

Append this block to the end of `app/globals.css`:

```css
/* Marquee block — seamless infinite scroll via translateX -50% on a 2x-duplicated track */
@keyframes marquee-left {
    from { transform: translateX(0); }
    to   { transform: translateX(-50%); }
}

@keyframes marquee-right {
    from { transform: translateX(-50%); }
    to   { transform: translateX(0); }
}

@media (prefers-reduced-motion: reduce) {
    .marquee-track {
        animation: none !important;
        transform: none !important;
    }
}
```

- [ ] **Step 2: Verify**

If `pnpm dev` is running, save the file — Next.js should HMR. No errors expected.
If not running: `pnpm tsc --noEmit`.

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "feat(marquee): add CSS keyframes + reduced-motion fallback"
```

---

## Task 7: Public renderer — DefaultMarqueeBlock

**Files:**
- Create: `components/blocks/public/DefaultMarqueeBlock.tsx`

- [ ] **Step 1: Create the renderer**

Create `components/blocks/public/DefaultMarqueeBlock.tsx`:

```tsx
'use client';

import React from 'react';
import { ICON_MAP } from '@/data/icons';
import { Star } from 'lucide-react';
import {
    MarqueeBlockData,
    MarqueeItem,
    MARQUEE_SPEED_SECONDS,
    MARQUEE_ICON_PX,
    MARQUEE_GAP_PX,
    MARQUEE_MASK_GUTTER_PX,
} from '@/components/blocks/marquee/types';
import { SafeSvgIcon } from './SafeSvgIcon';

interface DefaultMarqueeBlockProps {
    data: MarqueeBlockData;
}

function renderIcon(item: MarqueeItem, sizePx: number): React.ReactNode {
    if (item.icon.kind === 'svg') {
        return <SafeSvgIcon svg={item.icon.svg} className="marquee-icon" />;
    }
    const LucideIcon = ICON_MAP[item.icon.name] ?? Star;
    return <LucideIcon size={sizePx} aria-hidden="true" />;
}

export const DefaultMarqueeBlock: React.FC<DefaultMarqueeBlockProps> = ({ data }) => {
    const items = data?.items ?? [];
    if (items.length === 0) {
        return (
            <div className="text-sm text-gray-400 italic px-4 py-3">
                Marquee has no items yet. Add items in the right panel.
            </div>
        );
    }

    const durationSec = MARQUEE_SPEED_SECONDS[data.speed] ?? 30;
    const iconPx = MARQUEE_ICON_PX[data.iconSize] ?? 20;
    const gapPx = MARQUEE_GAP_PX[data.itemGap] ?? 48;
    const animationName = data.direction === 'right' ? 'marquee-right' : 'marquee-left';

    const maskImage = `linear-gradient(to right, transparent 0, black ${MARQUEE_MASK_GUTTER_PX}px, black calc(100% - ${MARQUEE_MASK_GUTTER_PX}px), transparent 100%)`;

    const doubled = [...items, ...items];

    const wrapperStyle: React.CSSProperties = {
        overflow: 'hidden',
        WebkitMaskImage: maskImage,
        maskImage,
        color: data.color || 'inherit',
        fontSize: `${iconPx}px`,
    };

    const trackStyle: React.CSSProperties = {
        display: 'flex',
        width: 'max-content',
        gap: `${gapPx}px`,
        animation: `${animationName} ${durationSec}s linear infinite`,
    };

    const itemStyle: React.CSSProperties = {
        display: 'inline-flex',
        alignItems: 'center',
        gap: `${Math.round(gapPx / 4)}px`,
        whiteSpace: 'nowrap',
        flexShrink: 0,
    };

    return (
        <div
            className="marquee-wrapper group"
            style={wrapperStyle}
            onMouseEnter={(e) => {
                const track = e.currentTarget.querySelector('.marquee-track') as HTMLElement | null;
                if (track) track.style.animationPlayState = 'paused';
            }}
            onMouseLeave={(e) => {
                const track = e.currentTarget.querySelector('.marquee-track') as HTMLElement | null;
                if (track) track.style.animationPlayState = 'running';
            }}
        >
            <div className="marquee-track" style={trackStyle}>
                {doubled.map((item, idx) => (
                    <span key={`${item.id}-${idx}`} className="marquee-item" style={itemStyle}>
                        {renderIcon(item, iconPx)}
                        <span style={{ fontSize: `${Math.max(12, Math.round(iconPx * 0.8))}px`, fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                            {item.label}
                        </span>
                    </span>
                ))}
            </div>
        </div>
    );
};

export default DefaultMarqueeBlock;
```

Note: pause-on-hover uses inline event handlers (not CSS `:hover`) because there's no straightforward way to target `.marquee-track` from `.marquee-wrapper:hover` when track styles are inline. Tailwind's `group-hover:` doesn't expose `animation-play-state`. Inline handlers are zero-state and no-op on touch devices.

- [ ] **Step 2: Typecheck**

Run: `pnpm tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add components/blocks/public/DefaultMarqueeBlock.tsx
git commit -m "feat(marquee): add DefaultMarqueeBlock public renderer"
```

---

## Task 8: Public renderer test

**Files:**
- Create: `components/blocks/public/__tests__/marquee.test.tsx`

- [ ] **Step 1: Write the test**

Create `components/blocks/public/__tests__/marquee.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DefaultMarqueeBlock } from '../DefaultMarqueeBlock';
import { DEFAULT_MARQUEE_DATA, MarqueeBlockData } from '@/components/blocks/marquee/types';

describe('DefaultMarqueeBlock', () => {
    it('shows empty-state hint when items array is empty', () => {
        const data: MarqueeBlockData = { ...DEFAULT_MARQUEE_DATA, items: [] };
        render(<DefaultMarqueeBlock data={data} />);
        expect(screen.getByText(/no items yet/i)).toBeInTheDocument();
    });

    it('renders each item label twice (duplicated for seamless loop)', () => {
        render(<DefaultMarqueeBlock data={DEFAULT_MARQUEE_DATA} />);
        const matches = screen.getAllByText(/100% Online/i);
        expect(matches.length).toBe(2);
    });

    it('applies left animation by default', () => {
        const { container } = render(<DefaultMarqueeBlock data={DEFAULT_MARQUEE_DATA} />);
        const track = container.querySelector('.marquee-track') as HTMLElement;
        expect(track).not.toBeNull();
        expect(track.style.animation).toContain('marquee-left');
    });

    it('applies right animation when direction=right', () => {
        const data: MarqueeBlockData = { ...DEFAULT_MARQUEE_DATA, direction: 'right' };
        const { container } = render(<DefaultMarqueeBlock data={data} />);
        const track = container.querySelector('.marquee-track') as HTMLElement;
        expect(track.style.animation).toContain('marquee-right');
    });

    it('renders inline SVG icon via SafeSvgIcon when icon.kind=svg', () => {
        const data: MarqueeBlockData = {
            ...DEFAULT_MARQUEE_DATA,
            items: [{
                id: 'a',
                label: 'Custom',
                icon: { kind: 'svg', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke="currentColor"><path d="M1 1"/></svg>' },
            }],
        };
        const { container } = render(<DefaultMarqueeBlock data={data} />);
        expect(container.querySelector('svg')).not.toBeNull();
    });

    it('applies mask-image gradient for fade edges', () => {
        const { container } = render(<DefaultMarqueeBlock data={DEFAULT_MARQUEE_DATA} />);
        const wrapper = container.querySelector('.marquee-wrapper') as HTMLElement;
        expect(wrapper.style.maskImage || wrapper.style.getPropertyValue('mask-image')).toMatch(/linear-gradient/);
    });
});
```

- [ ] **Step 2: Run the test**

Run: `pnpm vitest run components/blocks/public/__tests__/marquee.test.tsx`
Expected: PASS (6 tests).

If "inline SVG" test fails: log `sanitizeSvgIcon(...)` output to confirm the minimal `<svg xmlns viewBox stroke><path d/></svg>` survives sanitization.

- [ ] **Step 3: Commit**

```bash
git add components/blocks/public/__tests__/marquee.test.tsx
git commit -m "test(marquee): add renderer tests for empty state, duplication, direction, svg, mask"
```

---

## Task 9: Register public renderer in BlockRenderer

**Files:**
- Modify: `components/blocks/BlockRenderer.tsx`

- [ ] **Step 1: Add dynamic import**

Open `components/blocks/BlockRenderer.tsx`. Around line 30 (with other `dynamic(() => import(...))` declarations), add:

```tsx
const MarqueeBlock = dynamic(() => import('./public/DefaultMarqueeBlock').then(mod => ({ default: mod.DefaultMarqueeBlock })));
```

If existing dynamic imports use a different shape, mirror that shape exactly.

- [ ] **Step 2: Add switch case**

Inside the `renderBlock()` function's main `switch (block.type)` (around line 107–224), add a case before `default:`:

```tsx
case 'marquee':
    return <MarqueeBlock data={block.data} />;
```

- [ ] **Step 3: Typecheck**

Run: `pnpm tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add components/blocks/BlockRenderer.tsx
git commit -m "feat(marquee): register marquee in public BlockRenderer"
```

---

## Task 10: Sortable item row component (admin)

**Files:**
- Create: `components/admin/blocks/forms/marquee/SortableMarqueeItem.tsx`

- [ ] **Step 1: Create the row**

Create `components/admin/blocks/forms/marquee/SortableMarqueeItem.tsx`:

```tsx
'use client';

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, Star } from 'lucide-react';
import { ICON_MAP } from '@/data/icons';
import { MarqueeItem } from '@/components/blocks/marquee/types';
import { SafeSvgIcon } from '@/components/blocks/public/SafeSvgIcon';
import { IconKindPopover } from './IconKindPopover';

interface SortableMarqueeItemProps {
    item: MarqueeItem;
    onChange: (next: MarqueeItem) => void;
    onDelete: () => void;
}

export const SortableMarqueeItem: React.FC<SortableMarqueeItemProps> = ({ item, onChange, onDelete }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    const renderIconPreview = () => {
        if (item.icon.kind === 'svg') {
            return <SafeSvgIcon svg={item.icon.svg} className="text-gray-700" />;
        }
        const Icon = ICON_MAP[item.icon.name] ?? Star;
        return <Icon size={18} className="text-gray-700" />;
    };

    return (
        <div ref={setNodeRef} style={style} className="flex items-center gap-2 p-2 bg-white border border-gray-200 rounded-md">
            <button type="button" {...attributes} {...listeners} className="cursor-grab text-gray-400 hover:text-gray-600" aria-label="Drag to reorder">
                <GripVertical size={16} />
            </button>

            <IconKindPopover
                icon={item.icon}
                onChange={(nextIcon) => onChange({ ...item, icon: nextIcon })}
                trigger={
                    <button type="button" className="flex items-center justify-center w-8 h-8 border border-gray-200 rounded hover:bg-gray-50" aria-label="Change icon">
                        {renderIconPreview()}
                    </button>
                }
            />

            <input
                type="text"
                value={item.label}
                onChange={(e) => onChange({ ...item, label: e.target.value })}
                placeholder="Label"
                className="flex-1 px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            />

            <button type="button" onClick={onDelete} className="text-gray-400 hover:text-red-500" aria-label="Delete item">
                <Trash2 size={16} />
            </button>
        </div>
    );
};
```

- [ ] **Step 2: Typecheck (expect one error)**

Run: `pnpm tsc --noEmit`
Expected: error about missing `./IconKindPopover`. Task 11 creates it. Any *other* new error must be fixed.

- [ ] **Step 3: Hold commit until Task 11**

Don't commit yet — wait for IconKindPopover so the tree compiles cleanly.

---

## Task 11: Icon kind popover (Pick + Paste SVG tabs)

**Files:**
- Create: `components/admin/blocks/forms/marquee/IconKindPopover.tsx`

- [ ] **Step 1: Create the popover**

Create `components/admin/blocks/forms/marquee/IconKindPopover.tsx`:

```tsx
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { IconSelector } from '@/components/admin/IconSelector';
import { MarqueeIcon } from '@/components/blocks/marquee/types';
import { sanitizeSvgIcon } from '@/lib/sanitizeSvgIcon';
import { SafeSvgIcon } from '@/components/blocks/public/SafeSvgIcon';

interface IconKindPopoverProps {
    icon: MarqueeIcon;
    onChange: (next: MarqueeIcon) => void;
    trigger: React.ReactNode;
}

export const IconKindPopover: React.FC<IconKindPopoverProps> = ({ icon, onChange, trigger }) => {
    const [open, setOpen] = useState(false);
    const [tab, setTab] = useState<'pick' | 'paste'>(icon.kind === 'svg' ? 'paste' : 'pick');
    const [svgDraft, setSvgDraft] = useState(icon.kind === 'svg' ? icon.svg : '');
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const onDocClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', onDocClick);
        return () => document.removeEventListener('mousedown', onDocClick);
    }, [open]);

    const previewSafe = svgDraft ? sanitizeSvgIcon(svgDraft) : '';

    return (
        <div className="relative inline-block" ref={ref}>
            <span onClick={() => setOpen((v) => !v)}>{trigger}</span>
            {open && (
                <div className="absolute z-50 left-0 top-full mt-1 w-80 bg-white border border-gray-200 rounded-md shadow-lg p-3">
                    <div className="flex gap-1 mb-3 border-b border-gray-100">
                        <button
                            type="button"
                            onClick={() => setTab('pick')}
                            className={`px-3 py-1 text-sm ${tab === 'pick' ? 'border-b-2 border-blue-500 font-medium' : 'text-gray-500'}`}
                        >
                            Pick
                        </button>
                        <button
                            type="button"
                            onClick={() => setTab('paste')}
                            className={`px-3 py-1 text-sm ${tab === 'paste' ? 'border-b-2 border-blue-500 font-medium' : 'text-gray-500'}`}
                        >
                            Paste SVG
                        </button>
                    </div>

                    {tab === 'pick' && (
                        <IconSelector
                            selectedIcon={icon.kind === 'lucide' ? icon.name : ''}
                            onSelect={(name) => {
                                onChange({ kind: 'lucide', name });
                                setOpen(false);
                            }}
                        />
                    )}

                    {tab === 'paste' && (
                        <div className="space-y-2">
                            <p className="text-xs text-gray-500">
                                Paste SVG markup from <a href="https://lucide.dev" target="_blank" rel="noreferrer" className="underline">lucide.dev</a> ("Copy SVG"), Heroicons, etc.
                            </p>
                            <textarea
                                value={svgDraft}
                                onChange={(e) => setSvgDraft(e.target.value)}
                                placeholder="<svg xmlns=...>...</svg>"
                                rows={5}
                                className="w-full px-2 py-1 text-xs font-mono border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                    <span>Preview:</span>
                                    <span className="inline-flex items-center justify-center w-6 h-6 border border-gray-200 rounded" style={{ fontSize: 20 }}>
                                        {previewSafe ? <SafeSvgIcon svg={svgDraft} /> : <span className="text-gray-300">—</span>}
                                    </span>
                                </div>
                                <div className="flex gap-1">
                                    <button
                                        type="button"
                                        onClick={() => { setSvgDraft(''); onChange({ kind: 'lucide', name: 'Star' }); }}
                                        className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
                                    >
                                        Clear
                                    </button>
                                    <button
                                        type="button"
                                        disabled={!previewSafe}
                                        onClick={() => { onChange({ kind: 'svg', svg: svgDraft }); setOpen(false); }}
                                        className="px-2 py-1 text-xs bg-blue-500 text-white rounded disabled:bg-gray-300"
                                    >
                                        Apply
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
```

- [ ] **Step 2: Typecheck**

Run: `pnpm tsc --noEmit`
Expected: no new errors. If `IconSelector`'s prop names differ from `selectedIcon` / `onSelect`, open `components/admin/IconSelector.tsx` and adjust to match its actual contract.

- [ ] **Step 3: Commit (Tasks 10+11 together)**

```bash
git add components/admin/blocks/forms/marquee/SortableMarqueeItem.tsx components/admin/blocks/forms/marquee/IconKindPopover.tsx
git commit -m "feat(marquee): add SortableMarqueeItem + IconKindPopover (pick/paste tabs)"
```

---

## Task 12: Admin properties panel — MarqueeForm

**Files:**
- Create: `components/admin/blocks/forms/MarqueeForm.tsx`

- [ ] **Step 1: Create the form**

Create `components/admin/blocks/forms/MarqueeForm.tsx`:

```tsx
'use client';

import React from 'react';
import { Plus } from 'lucide-react';
import {
    DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent,
} from '@dnd-kit/core';
import {
    SortableContext, arrayMove, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
    MarqueeBlockData,
    MarqueeSpeed,
    MarqueeDirection,
    MarqueeIconSize,
    MarqueeItemGap,
    makeDefaultMarqueeItem,
} from '@/components/blocks/marquee/types';
import { SortableMarqueeItem } from './marquee/SortableMarqueeItem';

interface MarqueeFormProps {
    data: MarqueeBlockData;
    onChange: (next: MarqueeBlockData) => void;
}

const SPEEDS: MarqueeSpeed[] = ['slow', 'normal', 'fast'];
const SIZES: MarqueeIconSize[] = ['sm', 'md', 'lg'];
const GAPS: MarqueeItemGap[] = ['tight', 'normal', 'loose'];

function Segmented<T extends string>({ value, options, onChange, labels }: { value: T; options: T[]; onChange: (v: T) => void; labels?: Record<string, string> }) {
    return (
        <div className="inline-flex border border-gray-200 rounded overflow-hidden">
            {options.map((opt) => (
                <button
                    key={opt}
                    type="button"
                    onClick={() => onChange(opt)}
                    className={`px-3 py-1 text-xs capitalize ${value === opt ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                >
                    {labels?.[opt] ?? opt}
                </button>
            ))}
        </div>
    );
}

export const MarqueeForm: React.FC<MarqueeFormProps> = ({ data, onChange }) => {
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const oldIndex = data.items.findIndex((i) => i.id === active.id);
        const newIndex = data.items.findIndex((i) => i.id === over.id);
        if (oldIndex < 0 || newIndex < 0) return;
        onChange({ ...data, items: arrayMove(data.items, oldIndex, newIndex) });
    };

    return (
        <div className="space-y-4 p-3">
            <section>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Items</h3>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={data.items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                        <div className="space-y-2">
                            {data.items.map((item, idx) => (
                                <SortableMarqueeItem
                                    key={item.id}
                                    item={item}
                                    onChange={(next) => {
                                        const items = [...data.items];
                                        items[idx] = next;
                                        onChange({ ...data, items });
                                    }}
                                    onDelete={() => {
                                        const items = data.items.filter((i) => i.id !== item.id);
                                        onChange({ ...data, items });
                                    }}
                                />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
                <button
                    type="button"
                    onClick={() => onChange({ ...data, items: [...data.items, makeDefaultMarqueeItem()] })}
                    className="mt-2 inline-flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded"
                >
                    <Plus size={14} /> Add item
                </button>
            </section>

            <section className="space-y-3">
                <h3 className="text-sm font-medium text-gray-700">Layout & motion</h3>

                <div className="flex items-center justify-between">
                    <label className="text-xs text-gray-600">Speed</label>
                    <Segmented<MarqueeSpeed> value={data.speed} options={SPEEDS} onChange={(v) => onChange({ ...data, speed: v })} />
                </div>

                <div className="flex items-center justify-between">
                    <label className="text-xs text-gray-600">Direction</label>
                    <Segmented<MarqueeDirection>
                        value={data.direction}
                        options={['left', 'right']}
                        onChange={(v) => onChange({ ...data, direction: v })}
                        labels={{ left: '← Left', right: 'Right →' }}
                    />
                </div>

                <div className="flex items-center justify-between">
                    <label className="text-xs text-gray-600">Icon size</label>
                    <Segmented<MarqueeIconSize> value={data.iconSize} options={SIZES} onChange={(v) => onChange({ ...data, iconSize: v })} />
                </div>

                <div className="flex items-center justify-between">
                    <label className="text-xs text-gray-600">Item gap</label>
                    <Segmented<MarqueeItemGap> value={data.itemGap} options={GAPS} onChange={(v) => onChange({ ...data, itemGap: v })} />
                </div>
            </section>

            <section>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Color</h3>
                <div className="flex items-center gap-2">
                    <input
                        type="color"
                        value={data.color || '#374151'}
                        onChange={(e) => onChange({ ...data, color: e.target.value })}
                        className="w-8 h-8 border border-gray-200 rounded cursor-pointer"
                    />
                    <input
                        type="text"
                        value={data.color || ''}
                        onChange={(e) => onChange({ ...data, color: e.target.value })}
                        placeholder="#374151 or theme token"
                        className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded"
                    />
                    {data.color && (
                        <button type="button" onClick={() => onChange({ ...data, color: undefined })} className="text-xs text-gray-500 hover:text-gray-700">
                            Reset
                        </button>
                    )}
                </div>
                <p className="mt-1 text-xs text-gray-400">Drives icon stroke + label color via currentColor.</p>
            </section>
        </div>
    );
};

export default MarqueeForm;
```

- [ ] **Step 2: Typecheck**

Run: `pnpm tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add components/admin/blocks/forms/MarqueeForm.tsx
git commit -m "feat(marquee): add MarqueeForm admin properties panel"
```

---

## Task 13: Register block in admin (picker + default data)

**Files:**
- Modify: `components/admin/blocks/blockDefinitions.ts`

- [ ] **Step 1: Add picker entry**

Open `components/admin/blocks/blockDefinitions.ts`. At the top, find the existing icon imports from `lucide-react` (around line 2). Add `Megaphone`:

```ts
import { /* existing icons */, Megaphone } from 'lucide-react';
```

Find the `BLOCK_OPTIONS` array (lines 7–28). Add a new entry before the closing `]`:

```ts
{ type: 'marquee', label: 'Marquee', icon: <Megaphone size={16} /> },
```

If existing entries use a different icon-prop shape, mirror the pattern exactly.

- [ ] **Step 2: Add default-data case**

At the top of the file, add:

```ts
import { DEFAULT_MARQUEE_DATA } from '@/components/blocks/marquee/types';
```

Find the `getDefaultData()` function (lines 40–154). Inside its `switch (type)` statement, add a case before `default:`:

```ts
case 'marquee':
    return DEFAULT_MARQUEE_DATA;
```

- [ ] **Step 3: Typecheck**

Run: `pnpm tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add components/admin/blocks/blockDefinitions.ts
git commit -m "feat(marquee): register marquee in picker + default data"
```

---

## Task 14: Register admin form in BlockFormRenderer

**Files:**
- Modify: `components/admin/blocks/BlockFormRenderer.tsx`

- [ ] **Step 1: Add dynamic import**

Open `components/admin/blocks/BlockFormRenderer.tsx`. Around line 39 (with other `dynamic` imports), add:

```tsx
const MarqueeForm = dynamic(() => import('./forms/MarqueeForm').then(mod => ({ default: mod.MarqueeForm })), { loading: () => <FormSkeleton /> });
```

If existing dynamic imports use `mod => mod.XxxForm` without the `default:` wrapper, mirror exactly.

- [ ] **Step 2: Add switch case**

Inside the main `switch` (around line 126–152), add a case before `default:`:

```tsx
case 'marquee':
    return <MarqueeForm data={block.data} onChange={handleDataChange} />;
```

- [ ] **Step 3: Typecheck**

Run: `pnpm tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add components/admin/blocks/BlockFormRenderer.tsx
git commit -m "feat(marquee): register MarqueeForm in BlockFormRenderer"
```

---

## Task 15: Run full test suite + smoke test on public path

**Files:** (no edits — verification only)

- [ ] **Step 1: Run all marquee tests**

Run: `pnpm vitest run lib/sanitizeSvgIcon.test.ts components/blocks/public/__tests__/marquee.test.tsx`
Expected: all PASS (14 tests total: 8 sanitizer + 6 renderer).

- [ ] **Step 2: Run typecheck**

Run: `pnpm tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Run lint**

Run: `pnpm lint`
Expected: no new errors in files touched. Pre-existing warnings elsewhere acceptable.

- [ ] **Step 4: Manual smoke test — admin path**

Start dev server: `pnpm dev`
1. Open the admin Canvas Studio for any test site.
2. Add a new "Marquee" block from the picker.
3. Verify the default 4 items appear and scroll left at normal speed in the canvas preview.
4. Add a 5th item, rename one, reorder via drag.
5. Open the icon popover on one item → switch to "Paste SVG" tab → paste from lucide.dev:
   ```
   <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
   ```
   → preview should render → click Apply → row icon updates.
6. Toggle direction to Right → animation reverses.
7. Toggle speed to Fast → noticeably faster.
8. Hover the marquee → animation pauses; mouseout → resumes.
9. Verify fade-out at left and right edges (mask gradient).

- [ ] **Step 5: Manual smoke test — public path**

(Per the `feedback_test_public_path` memory: admin and public read via different paths.)

1. Save the page with the marquee block.
2. Visit the public site URL — **not** the admin preview.
3. Verify:
   - Marquee renders with the configured items.
   - Animation runs.
   - Direction, speed, gap, icon size all match the admin settings.
   - Mask fade visible on both edges.
   - Inline SVG icon (from paste-svg step) renders correctly.
4. With OS-level "Reduce motion" enabled, reload the public page — items render statically (no animation).

- [ ] **Step 6: Commit (if smoke-test tweaks needed)**

If steps 4–5 surfaced any small fix (icon size tweak, mask gutter adjustment), commit it now:

```bash
git add -A
git commit -m "fix(marquee): smoke-test adjustments"
```

If no fixes needed, skip the commit.

---

## Notes for the Implementing Engineer

- **No Firebase Storage:** pasted SVGs live as strings inside the block's `data` field in Firestore.
- **Sanitize on render:** `SafeSvgIcon` re-runs the sanitizer on every render (memoized by `svg` string). Cheap.
- **Color field shape:** `string` (hex or token), matching `FeatureCard.textColor`. Widening to a `ColorToken` type later is one line.
- **Pause-on-hover:** inline `onMouseEnter/Leave` handlers, not CSS `:hover` — needed because we can't target `.marquee-track` from `.marquee-wrapper:hover` when track styles are inline. No-op on touch.
- **Duplication factor:** `[...items, ...items]` (2×). With ≥4 items this is sufficient. If users report blank gaps with very few short items, bump to 3× via a render-time width check.
- **Reduced-motion** handled entirely in `app/globals.css` (`@media (prefers-reduced-motion: reduce) .marquee-track`).
- **3-way parity:** BlockType union (Task 1), public renderer (Task 9), admin form + picker + defaults (Tasks 13–14). All three required to ship.
