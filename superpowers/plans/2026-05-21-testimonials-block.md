# Testimonials Block Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Canvas Studio "Testimonials" block with two variants (Single, Marquee), inline content authoring, theme-agnostic rendering. Refactor existing Marquee block to share a new `<MarqueeTrack>` primitive.

**Architecture:** Inline block data (no Firestore library). Two variants share a `<TestimonialCard>` component. Marquee variant uses a new `<MarqueeTrack>` primitive that is also adopted by the existing Marquee block (no behavior change). Theme-aware via existing `cardStyles.ts` + typography tokens; no template-specific components.

**Tech Stack:** Next.js (app router), React, TypeScript, Tailwind, Vitest, existing Canvas Studio block infra in `clicker-platform-v2/`.

**Spec:** `superpowers/specs/2026-05-21-testimonials-block-design.md`

**Working directory:** All paths are relative to `clicker-platform-v2/` unless prefixed otherwise.

---

## File Structure

**New files:**

- `lib/canvas/blocks/testimonials/types.ts` — TestimonialItem + TestimonialsBlockData types, default factories
- `components/blocks/shared/MarqueeTrack.tsx` — shared marquee animation primitive
- `components/blocks/shared/__tests__/MarqueeTrack.test.tsx`
- `components/blocks/shared/TestimonialCard.tsx` — shared card component
- `components/blocks/shared/__tests__/TestimonialCard.test.tsx`
- `components/ui/star-rating/StarRatingDisplay.tsx` — read-only star row
- `components/ui/star-rating/__tests__/StarRatingDisplay.test.tsx`
- `components/blocks/public/DefaultTestimonialsBlock.tsx` — public renderer (dispatcher)
- `components/blocks/public/__tests__/DefaultTestimonialsBlock.test.tsx`
- `components/admin/blocks/forms/testimonials/TestimonialsBlockForm.tsx` — block form
- `components/admin/blocks/forms/testimonials/TestimonialItemEditor.tsx` — single item editor sub-component

**Modified files:**

- `components/blocks/public/DefaultMarqueeBlock.tsx` — refactor to use `<MarqueeTrack>` (no behavior change)
- `components/blocks/marquee/types.ts` — exports remain stable; constants stay here for compatibility
- `components/admin/blocks/blockDefinitions.ts` — register `testimonials` type
- `components/admin/blocks/BlockFormRenderer.tsx` — wire `TestimonialsBlockForm`
- `components/blocks/BlockRenderer.tsx` — wire `DefaultTestimonialsBlock`

---

## Task 1: Add TestimonialItem + TestimonialsBlockData types

**Files:**

- Create: `lib/canvas/blocks/testimonials/types.ts`

- [ ] **Step 1: Create the types file**

```ts
// lib/canvas/blocks/testimonials/types.ts
import { v4 as uuidv4 } from 'uuid';

export type TestimonialsVariant = 'single' | 'marquee';
export type TestimonialRating = 1 | 2 | 3 | 4 | 5;

export interface TestimonialItem {
    id: string;
    personName: string;
    personRole?: string;
    personPhoto?: string;
    brandName?: string;
    brandLogo?: string;
    rating?: TestimonialRating;
    content: string;
}

export interface TestimonialsBlockData {
    variant: TestimonialsVariant;
    items: TestimonialItem[];

    // marquee-only (ignored when variant === 'single')
    marqueeDirection?: 'left' | 'right';
    marqueeSpeed?: 'slow' | 'normal' | 'fast';
    marqueePauseOnHover?: boolean;
    marqueeGap?: 'tight' | 'normal' | 'loose';
}

export const TESTIMONIAL_CONTENT_SOFT_LIMIT = 400;

export function makeDefaultTestimonialItem(): TestimonialItem {
    return {
        id: uuidv4(),
        personName: '',
        content: '',
    };
}

export const DEFAULT_TESTIMONIALS_BLOCK_DATA: TestimonialsBlockData = {
    variant: 'single',
    items: [makeDefaultTestimonialItem()],
    marqueeDirection: 'left',
    marqueeSpeed: 'normal',
    marqueePauseOnHover: true,
    marqueeGap: 'normal',
};
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `pnpm tsc --noEmit`
Expected: no errors (the new file is not imported yet, but must be self-consistent).

- [ ] **Step 3: Commit**

```bash
git add lib/canvas/blocks/testimonials/types.ts
git commit -m "feat(testimonials): add block data types and defaults"
```

---

## Task 2: Add `<StarRatingDisplay>` read-only star row

**Files:**

- Create: `components/ui/star-rating/StarRatingDisplay.tsx`
- Create: `components/ui/star-rating/__tests__/StarRatingDisplay.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// components/ui/star-rating/__tests__/StarRatingDisplay.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StarRatingDisplay } from '../StarRatingDisplay';

describe('StarRatingDisplay', () => {
    it('renders 5 stars total with N filled when rating=N', () => {
        render(<StarRatingDisplay rating={3} />);
        const filled = screen.getAllByTestId('star-filled');
        const empty = screen.getAllByTestId('star-empty');
        expect(filled).toHaveLength(3);
        expect(empty).toHaveLength(2);
    });

    it('renders 5 filled when rating=5', () => {
        render(<StarRatingDisplay rating={5} />);
        expect(screen.getAllByTestId('star-filled')).toHaveLength(5);
        expect(screen.queryAllByTestId('star-empty')).toHaveLength(0);
    });

    it('renders 1 filled when rating=1', () => {
        render(<StarRatingDisplay rating={1} />);
        expect(screen.getAllByTestId('star-filled')).toHaveLength(1);
        expect(screen.getAllByTestId('star-empty')).toHaveLength(4);
    });

    it('exposes accessible label with rating', () => {
        render(<StarRatingDisplay rating={4} />);
        expect(screen.getByLabelText(/4 out of 5/i)).toBeInTheDocument();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test components/ui/star-rating`
Expected: FAIL — `StarRatingDisplay` not found.

- [ ] **Step 3: Implement the component**

```tsx
// components/ui/star-rating/StarRatingDisplay.tsx
import React from 'react';
import { Star } from 'lucide-react';

interface StarRatingDisplayProps {
    rating: 1 | 2 | 3 | 4 | 5;
    size?: number; // px, default 16
    className?: string;
}

export const StarRatingDisplay: React.FC<StarRatingDisplayProps> = ({
    rating,
    size = 16,
    className,
}) => {
    return (
        <div
            className={className}
            role="img"
            aria-label={`${rating} out of 5 stars`}
            style={{ display: 'inline-flex', gap: 2 }}
        >
            {[1, 2, 3, 4, 5].map((n) => {
                const filled = n <= rating;
                return (
                    <Star
                        key={n}
                        size={size}
                        data-testid={filled ? 'star-filled' : 'star-empty'}
                        fill={filled ? 'currentColor' : 'none'}
                        stroke="currentColor"
                        aria-hidden="true"
                    />
                );
            })}
        </div>
    );
};
```

- [ ] **Step 4: Run tests and verify they pass**

Run: `pnpm test components/ui/star-rating`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add components/ui/star-rating/
git commit -m "feat(ui): add StarRatingDisplay read-only star row"
```

---

## Task 3: Add `<MarqueeTrack>` shared primitive

**Files:**

- Create: `components/blocks/shared/MarqueeTrack.tsx`
- Create: `components/blocks/shared/__tests__/MarqueeTrack.test.tsx`

This primitive must reproduce the existing Marquee block's animation behavior exactly so we can refactor without regressions.

- [ ] **Step 1: Write the failing test**

```tsx
// components/blocks/shared/__tests__/MarqueeTrack.test.tsx
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MarqueeTrack } from '../MarqueeTrack';

describe('MarqueeTrack', () => {
    it('renders children twice (doubled for seamless loop)', () => {
        const { container } = render(
            <MarqueeTrack direction="left" speed="normal" pauseOnHover gap="normal">
                <span data-testid="item">A</span>
            </MarqueeTrack>
        );
        // Expect the inner item to appear twice (doubled for loop)
        const items = container.querySelectorAll('[data-testid="item"]');
        expect(items.length).toBe(2);
    });

    it('applies left animation by default', () => {
        const { container } = render(
            <MarqueeTrack direction="left" speed="normal" pauseOnHover gap="normal">
                <span>X</span>
            </MarqueeTrack>
        );
        const track = container.querySelector('.marquee-track') as HTMLElement;
        expect(track.style.animationName).toBe('marquee-left');
    });

    it('applies right animation when direction=right', () => {
        const { container } = render(
            <MarqueeTrack direction="right" speed="normal" pauseOnHover gap="normal">
                <span>X</span>
            </MarqueeTrack>
        );
        const track = container.querySelector('.marquee-track') as HTMLElement;
        expect(track.style.animationName).toBe('marquee-right');
    });

    it('maps speed to duration seconds', () => {
        const { container } = render(
            <MarqueeTrack direction="left" speed="fast" pauseOnHover gap="normal">
                <span>X</span>
            </MarqueeTrack>
        );
        const track = container.querySelector('.marquee-track') as HTMLElement;
        expect(track.style.animationDuration).toBe('18s');
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test components/blocks/shared`
Expected: FAIL — `MarqueeTrack` not found.

- [ ] **Step 3: Implement the primitive**

```tsx
// components/blocks/shared/MarqueeTrack.tsx
'use client';

import React from 'react';

export type MarqueeTrackSpeed = 'slow' | 'normal' | 'fast';
export type MarqueeTrackDirection = 'left' | 'right';
export type MarqueeTrackGap = 'tight' | 'normal' | 'loose';

interface MarqueeTrackProps {
    direction: MarqueeTrackDirection;
    speed: MarqueeTrackSpeed;
    pauseOnHover: boolean;
    gap: MarqueeTrackGap;
    children: React.ReactNode;
    /** px gutter on each side for the fade mask */
    maskGutterPx?: number;
    className?: string;
    style?: React.CSSProperties;
}

const SPEED_SECONDS: Record<MarqueeTrackSpeed, number> = {
    slow: 45,
    normal: 30,
    fast: 18,
};

const GAP_PX: Record<MarqueeTrackGap, number> = {
    tight: 32,
    normal: 48,
    loose: 72,
};

export const MarqueeTrack: React.FC<MarqueeTrackProps> = ({
    direction,
    speed,
    pauseOnHover,
    gap,
    children,
    maskGutterPx = 48,
    className,
    style,
}) => {
    const durationSec = SPEED_SECONDS[speed];
    const gapPx = GAP_PX[gap];
    const animationName = direction === 'right' ? 'marquee-right' : 'marquee-left';

    const maskImage = `linear-gradient(to right, transparent 0, black ${maskGutterPx}px, black calc(100% - ${maskGutterPx}px), transparent 100%)`;

    const wrapperStyle: React.CSSProperties = {
        overflow: 'hidden',
        WebkitMaskImage: maskImage,
        maskImage,
        ...style,
    };

    const trackStyle: React.CSSProperties = {
        display: 'flex',
        width: 'max-content',
        gap: `${gapPx}px`,
        animationName,
        animationDuration: `${durationSec}s`,
        animationTimingFunction: 'linear',
        animationIterationCount: 'infinite',
        animationPlayState: 'running',
    };

    // Pause on hover via inline hover handler-free approach: a className toggle
    const hoverClass = pauseOnHover ? 'marquee-pause-on-hover' : '';

    return (
        <div className={`marquee-wrapper ${className ?? ''} ${hoverClass}`} style={wrapperStyle}>
            <div className="marquee-track" style={trackStyle}>
                {children}
                {children}
            </div>
        </div>
    );
};

export default MarqueeTrack;
```

- [ ] **Step 4: Verify the global CSS for `marquee-left` / `marquee-right` keyframes still exists**

Run: `grep -rn "@keyframes marquee-left\|@keyframes marquee-right" app/ styles/ 2>/dev/null`
Expected: a match in an existing global CSS file (used by current `DefaultMarqueeBlock`). If `marquee-pause-on-hover` is not yet defined, add this rule near the existing keyframes:

```css
.marquee-pause-on-hover:hover .marquee-track {
    animation-play-state: paused;
}
```

If the global CSS file is `app/globals.css`, add it there. Locate the file with:

`grep -rln "marquee-left" app/ styles/ 2>/dev/null | head -1`

- [ ] **Step 5: Run MarqueeTrack tests, verify they pass**

Run: `pnpm test components/blocks/shared`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add components/blocks/shared/MarqueeTrack.tsx components/blocks/shared/__tests__/MarqueeTrack.test.tsx app/globals.css
git commit -m "feat(blocks): add shared MarqueeTrack primitive"
```

---

## Task 4: Refactor existing Marquee block to use `<MarqueeTrack>` (no-op)

**Files:**

- Modify: `components/blocks/public/DefaultMarqueeBlock.tsx`

This must be a behavior no-op. Capture a "before" snapshot first.

- [ ] **Step 1: Capture pre-refactor snapshot of existing Marquee output**

Create a temporary test to lock the existing Marquee's rendered structure:

```tsx
// components/blocks/public/__tests__/DefaultMarqueeBlock.snapshot.test.tsx
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { DefaultMarqueeBlock } from '../DefaultMarqueeBlock';
import { DEFAULT_MARQUEE_DATA } from '@/components/blocks/marquee/types';

describe('DefaultMarqueeBlock (pre/post refactor parity)', () => {
    it('matches snapshot for default data', () => {
        const { container } = render(<DefaultMarqueeBlock data={DEFAULT_MARQUEE_DATA} />);
        expect(container.innerHTML).toMatchSnapshot();
    });

    it('matches snapshot when empty', () => {
        const data = { ...DEFAULT_MARQUEE_DATA, items: [] };
        const { container } = render(<DefaultMarqueeBlock data={data} />);
        expect(container.innerHTML).toMatchSnapshot();
    });
});
```

- [ ] **Step 2: Run the snapshot test to capture baseline**

Run: `pnpm test components/blocks/public/__tests__/DefaultMarqueeBlock.snapshot.test.tsx -u`
Expected: PASS, snapshot file created.

- [ ] **Step 3: Commit the baseline snapshot**

```bash
git add components/blocks/public/__tests__/DefaultMarqueeBlock.snapshot.test.tsx components/blocks/public/__tests__/__snapshots__/
git commit -m "test(marquee): capture pre-refactor snapshot baseline"
```

- [ ] **Step 4: Refactor `DefaultMarqueeBlock` to use `<MarqueeTrack>`**

Replace the file with:

```tsx
// components/blocks/public/DefaultMarqueeBlock.tsx
'use client';

import React from 'react';
import { ICON_MAP } from '@/data/icons';
import { Star } from 'lucide-react';
import {
    MarqueeBlockData,
    MarqueeItem,
    MARQUEE_ICON_PX,
    MARQUEE_GAP_PX,
} from '@/components/blocks/marquee/types';
import { SafeSvgIcon } from './SafeSvgIcon';
import { MarqueeTrack } from '@/components/blocks/shared/MarqueeTrack';

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

    const iconPx = MARQUEE_ICON_PX[data.iconSize] ?? 20;
    const gapPx = MARQUEE_GAP_PX[data.itemGap] ?? 48;

    const itemStyle: React.CSSProperties = {
        display: 'inline-flex',
        alignItems: 'center',
        gap: `${Math.round(gapPx / 4)}px`,
        whiteSpace: 'nowrap',
        flexShrink: 0,
    };

    const wrapperStyle: React.CSSProperties = {
        color: data.color || 'inherit',
        fontSize: `${iconPx}px`,
    };

    return (
        <MarqueeTrack
            direction={data.direction}
            speed={data.speed}
            pauseOnHover={false}
            gap={data.itemGap}
            style={wrapperStyle}
        >
            {items.map((item) => (
                <span key={item.id} className="marquee-item" style={itemStyle}>
                    {renderIcon(item, iconPx)}
                    <span style={{ fontSize: `${Math.max(12, Math.round(iconPx * 0.8))}px`, fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                        {item.label}
                    </span>
                </span>
            ))}
        </MarqueeTrack>
    );
};

export default DefaultMarqueeBlock;
```

Note: the existing block did not have pause-on-hover; we pass `pauseOnHover={false}` to preserve behavior. `MarqueeTrack` duplicates children internally, so the explicit `doubled` loop is removed.

- [ ] **Step 5: Re-run snapshot test, expect failure (DOM changed slightly)**

Run: `pnpm test components/blocks/public/__tests__/DefaultMarqueeBlock.snapshot.test.tsx`
Expected: FAIL with a diff between old (inline-style animation shorthand) and new (separate animation properties).

- [ ] **Step 6: Visually inspect the snapshot diff**

The diff should show only:
- `animation:` shorthand split into `animation-name`, `animation-duration`, `animation-timing-function`, `animation-iteration-count`, `animation-play-state`
- Children rendered once-then-once (from MarqueeTrack) vs once-then-spread (the previous `doubled`) — both produce the same final DOM order

If any other diff appears (e.g. missing item, changed gap, lost mask), STOP and re-check the refactor.

- [ ] **Step 7: Update snapshot once diff is confirmed cosmetic-only**

Run: `pnpm test components/blocks/public/__tests__/DefaultMarqueeBlock.snapshot.test.tsx -u`
Expected: PASS, snapshot updated.

- [ ] **Step 8: Manual smoke test**

Run: `pnpm dev` (already running, or start it).
Open any admin page that previews a Marquee block. Confirm: speed, direction, items render identically to before.

- [ ] **Step 9: Commit**

```bash
git add components/blocks/public/DefaultMarqueeBlock.tsx components/blocks/public/__tests__/__snapshots__/
git commit -m "refactor(marquee): use shared MarqueeTrack primitive"
```

---

## Task 5: Add `<TestimonialCard>` shared component

**Files:**

- Create: `components/blocks/shared/TestimonialCard.tsx`
- Create: `components/blocks/shared/__tests__/TestimonialCard.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// components/blocks/shared/__tests__/TestimonialCard.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TestimonialCard } from '../TestimonialCard';
import type { TestimonialItem } from '@/lib/canvas/blocks/testimonials/types';

const baseItem: TestimonialItem = {
    id: 't1',
    personName: 'Jane Doe',
    content: 'Great service!',
};

describe('TestimonialCard', () => {
    it('renders name and content', () => {
        render(<TestimonialCard item={baseItem} />);
        expect(screen.getByText('Jane Doe')).toBeInTheDocument();
        expect(screen.getByText('Great service!')).toBeInTheDocument();
    });

    it('renders role when present', () => {
        render(<TestimonialCard item={{ ...baseItem, personRole: 'Director' }} />);
        expect(screen.getByText('Director')).toBeInTheDocument();
    });

    it('hides star row when rating is undefined', () => {
        render(<TestimonialCard item={baseItem} />);
        expect(screen.queryByRole('img', { name: /out of 5/i })).not.toBeInTheDocument();
    });

    it('renders star row when rating is set', () => {
        render(<TestimonialCard item={{ ...baseItem, rating: 4 }} />);
        expect(screen.getByLabelText(/4 out of 5/i)).toBeInTheDocument();
    });

    it('renders brand row when brandName is set', () => {
        render(<TestimonialCard item={{ ...baseItem, brandName: 'Acme' }} />);
        expect(screen.getByText('Acme')).toBeInTheDocument();
    });

    it('renders both photo and brand logo when both present', () => {
        render(
            <TestimonialCard
                item={{
                    ...baseItem,
                    personPhoto: 'https://example.com/p.jpg',
                    brandName: 'Acme',
                    brandLogo: 'https://example.com/l.png',
                }}
            />
        );
        expect(screen.getByAltText(/Jane Doe/i)).toBeInTheDocument();
        expect(screen.getByAltText(/Acme/i)).toBeInTheDocument();
    });

    it('does not render photo container when personPhoto is empty', () => {
        render(<TestimonialCard item={baseItem} />);
        expect(screen.queryByAltText(/Jane Doe/i)).not.toBeInTheDocument();
    });
});
```

- [ ] **Step 2: Run tests, expect fail**

Run: `pnpm test components/blocks/shared/__tests__/TestimonialCard.test.tsx`
Expected: FAIL — `TestimonialCard` not found.

- [ ] **Step 3: Implement the component**

```tsx
// components/blocks/shared/TestimonialCard.tsx
import React from 'react';
import type { TestimonialItem } from '@/lib/canvas/blocks/testimonials/types';
import { StarRatingDisplay } from '@/components/ui/star-rating/StarRatingDisplay';

interface TestimonialCardProps {
    item: TestimonialItem;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

const SIZE_TO_CONTENT_CLASS: Record<'sm' | 'md' | 'lg', string> = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
};

const SIZE_TO_PHOTO_PX: Record<'sm' | 'md' | 'lg', number> = {
    sm: 32,
    md: 44,
    lg: 56,
};

export const TestimonialCard: React.FC<TestimonialCardProps> = ({
    item,
    size = 'md',
    className,
}) => {
    const photoPx = SIZE_TO_PHOTO_PX[size];
    const contentClass = SIZE_TO_CONTENT_CLASS[size];
    const hasPersonRow = Boolean(item.personPhoto || item.personName || item.personRole);
    const hasBrandRow = Boolean(item.brandName || item.brandLogo);

    return (
        <article
            className={`testimonial-card ${className ?? ''}`}
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                padding: 16,
                borderRadius: 12,
            }}
        >
            {hasPersonRow && (
                <header style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {item.personPhoto && (
                        <img
                            src={item.personPhoto}
                            alt={item.personName}
                            width={photoPx}
                            height={photoPx}
                            style={{ borderRadius: '50%', objectFit: 'cover' }}
                        />
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 600 }}>{item.personName}</span>
                        {item.personRole && (
                            <span style={{ opacity: 0.7, fontSize: '0.9em' }}>{item.personRole}</span>
                        )}
                    </div>
                </header>
            )}

            <p className={contentClass} style={{ margin: 0, lineHeight: 1.5 }}>
                {item.content}
            </p>

            {item.rating !== undefined && (
                <div>
                    <StarRatingDisplay rating={item.rating} />
                </div>
            )}

            {hasBrandRow && (
                <footer style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: 0.85 }}>
                    {item.brandLogo && (
                        <img
                            src={item.brandLogo}
                            alt={item.brandName ?? 'Brand'}
                            height={20}
                            style={{ objectFit: 'contain' }}
                        />
                    )}
                    {item.brandName && (
                        <span style={{ fontSize: '0.9em', fontWeight: 500 }}>{item.brandName}</span>
                    )}
                </footer>
            )}
        </article>
    );
};

export default TestimonialCard;
```

- [ ] **Step 4: Run tests, expect pass**

Run: `pnpm test components/blocks/shared/__tests__/TestimonialCard.test.tsx`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add components/blocks/shared/TestimonialCard.tsx components/blocks/shared/__tests__/TestimonialCard.test.tsx
git commit -m "feat(blocks): add shared TestimonialCard component"
```

---

## Task 6: Implement `DefaultTestimonialsBlock` public renderer

**Files:**

- Create: `components/blocks/public/DefaultTestimonialsBlock.tsx`
- Create: `components/blocks/public/__tests__/DefaultTestimonialsBlock.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// components/blocks/public/__tests__/DefaultTestimonialsBlock.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { DefaultTestimonialsBlock } from '../DefaultTestimonialsBlock';
import type { TestimonialsBlockData } from '@/lib/canvas/blocks/testimonials/types';

const singleData: TestimonialsBlockData = {
    variant: 'single',
    items: [{ id: 'a', personName: 'Alice', content: 'Loved it.' }],
};

const marqueeData: TestimonialsBlockData = {
    variant: 'marquee',
    items: [
        { id: 'a', personName: 'Alice', content: 'Loved it.' },
        { id: 'b', personName: 'Bob', content: 'Great.' },
    ],
    marqueeDirection: 'left',
    marqueeSpeed: 'normal',
    marqueePauseOnHover: true,
    marqueeGap: 'normal',
};

describe('DefaultTestimonialsBlock', () => {
    it('renders single variant with one card', () => {
        render(<DefaultTestimonialsBlock data={singleData} />);
        expect(screen.getByText('Loved it.')).toBeInTheDocument();
        expect(screen.queryByText('Great.')).not.toBeInTheDocument();
    });

    it('renders marquee variant with all items (doubled by MarqueeTrack)', () => {
        const { container } = render(<DefaultTestimonialsBlock data={marqueeData} />);
        // MarqueeTrack doubles children, so each item appears twice
        const alice = container.querySelectorAll('[data-testimonial-id="a"]');
        const bob = container.querySelectorAll('[data-testimonial-id="b"]');
        expect(alice.length).toBe(2);
        expect(bob.length).toBe(2);
    });

    it('shows empty hint when items array is empty', () => {
        render(<DefaultTestimonialsBlock data={{ variant: 'single', items: [] }} />);
        expect(screen.getByText(/no testimonials/i)).toBeInTheDocument();
    });

    it('single variant only uses items[0] even if more are stored', () => {
        const data: TestimonialsBlockData = {
            variant: 'single',
            items: [
                { id: 'a', personName: 'Alice', content: 'First' },
                { id: 'b', personName: 'Bob', content: 'Second' },
            ],
        };
        render(<DefaultTestimonialsBlock data={data} />);
        expect(screen.getByText('First')).toBeInTheDocument();
        expect(screen.queryByText('Second')).not.toBeInTheDocument();
    });
});
```

- [ ] **Step 2: Run tests, expect fail**

Run: `pnpm test components/blocks/public/__tests__/DefaultTestimonialsBlock.test.tsx`
Expected: FAIL — `DefaultTestimonialsBlock` not found.

- [ ] **Step 3: Implement the renderer**

```tsx
// components/blocks/public/DefaultTestimonialsBlock.tsx
'use client';

import React from 'react';
import type { TestimonialsBlockData, TestimonialItem } from '@/lib/canvas/blocks/testimonials/types';
import { TestimonialCard } from '@/components/blocks/shared/TestimonialCard';
import { MarqueeTrack } from '@/components/blocks/shared/MarqueeTrack';

interface DefaultTestimonialsBlockProps {
    data: TestimonialsBlockData;
}

const EmptyHint: React.FC = () => (
    <div className="text-sm text-gray-400 italic px-4 py-3">
        No testimonials yet. Add one in the right panel.
    </div>
);

const TestimonialsSingle: React.FC<{ item: TestimonialItem }> = ({ item }) => (
    <div data-testimonial-id={item.id}>
        <TestimonialCard item={item} size="lg" />
    </div>
);

const TestimonialsMarquee: React.FC<{ data: TestimonialsBlockData }> = ({ data }) => (
    <MarqueeTrack
        direction={data.marqueeDirection ?? 'left'}
        speed={data.marqueeSpeed ?? 'normal'}
        pauseOnHover={data.marqueePauseOnHover ?? true}
        gap={data.marqueeGap ?? 'normal'}
    >
        {data.items.map((item) => (
            <div
                key={item.id}
                data-testimonial-id={item.id}
                style={{ flexShrink: 0, width: 320 }}
            >
                <TestimonialCard item={item} size="sm" />
            </div>
        ))}
    </MarqueeTrack>
);

export const DefaultTestimonialsBlock: React.FC<DefaultTestimonialsBlockProps> = ({ data }) => {
    const items = data?.items ?? [];

    if (items.length === 0) {
        return <EmptyHint />;
    }

    if (data.variant === 'single') {
        return <TestimonialsSingle item={items[0]} />;
    }

    return <TestimonialsMarquee data={data} />;
};

export default DefaultTestimonialsBlock;
```

- [ ] **Step 4: Run tests, expect pass**

Run: `pnpm test components/blocks/public/__tests__/DefaultTestimonialsBlock.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add components/blocks/public/DefaultTestimonialsBlock.tsx components/blocks/public/__tests__/DefaultTestimonialsBlock.test.tsx
git commit -m "feat(blocks): add DefaultTestimonialsBlock public renderer"
```

---

## Task 7: Build `TestimonialItemEditor` admin sub-component

**Files:**

- Create: `components/admin/blocks/forms/testimonials/TestimonialItemEditor.tsx`

This is the per-item editor used inside the block form (one card-editor for single variant, multiple for marquee).

- [ ] **Step 1: Identify the MediaPicker import**

Run: `grep -rn "from.*MediaPicker\|export.*MediaPicker" components/admin/ 2>/dev/null | head -5`
Note the canonical import path for `MediaPicker`. You will reuse it. (If different from `@/components/admin/MediaPicker`, substitute accordingly in the code below.)

- [ ] **Step 2: Implement the item editor**

```tsx
// components/admin/blocks/forms/testimonials/TestimonialItemEditor.tsx
'use client';

import React from 'react';
import type { TestimonialItem, TestimonialRating } from '@/lib/canvas/blocks/testimonials/types';
import { TESTIMONIAL_CONTENT_SOFT_LIMIT } from '@/lib/canvas/blocks/testimonials/types';
import { MediaPicker } from '@/components/admin/MediaPicker'; // adjust if path differs (see Step 1)

interface TestimonialItemEditorProps {
    item: TestimonialItem;
    onChange: (next: TestimonialItem) => void;
    onRemove?: () => void;
    canRemove?: boolean;
}

const RATING_OPTIONS: { value: TestimonialRating | ''; label: string }[] = [
    { value: '', label: 'No rating' },
    { value: 1, label: '★ 1' },
    { value: 2, label: '★★ 2' },
    { value: 3, label: '★★★ 3' },
    { value: 4, label: '★★★★ 4' },
    { value: 5, label: '★★★★★ 5' },
];

export const TestimonialItemEditor: React.FC<TestimonialItemEditorProps> = ({
    item,
    onChange,
    onRemove,
    canRemove,
}) => {
    const update = <K extends keyof TestimonialItem>(key: K, value: TestimonialItem[K]) =>
        onChange({ ...item, [key]: value });

    const overLimit = item.content.length > TESTIMONIAL_CONTENT_SOFT_LIMIT;

    return (
        <div className="testimonial-item-editor" style={{ border: '1px solid var(--border, #e5e7eb)', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, opacity: 0.6 }}>Testimonial</span>
                {canRemove && onRemove && (
                    <button type="button" onClick={onRemove} className="text-xs text-red-600 hover:underline">
                        Remove
                    </button>
                )}
            </div>

            <label className="block text-sm">
                <span className="text-xs opacity-70">Person name *</span>
                <input
                    type="text"
                    value={item.personName}
                    onChange={(e) => update('personName', e.target.value)}
                    className="mt-1 w-full border rounded px-2 py-1"
                    required
                />
            </label>

            <label className="block text-sm">
                <span className="text-xs opacity-70">Role / title</span>
                <input
                    type="text"
                    value={item.personRole ?? ''}
                    onChange={(e) => update('personRole', e.target.value || undefined)}
                    className="mt-1 w-full border rounded px-2 py-1"
                    placeholder="e.g. Marketing Director"
                />
            </label>

            <div className="block text-sm">
                <span className="text-xs opacity-70">Photo</span>
                <MediaPicker
                    value={item.personPhoto}
                    onChange={(url) => update('personPhoto', url || undefined)}
                />
            </div>

            <label className="block text-sm">
                <span className="text-xs opacity-70">Brand name</span>
                <input
                    type="text"
                    value={item.brandName ?? ''}
                    onChange={(e) => update('brandName', e.target.value || undefined)}
                    className="mt-1 w-full border rounded px-2 py-1"
                    placeholder="e.g. Acme Corp"
                />
            </label>

            <div className="block text-sm">
                <span className="text-xs opacity-70">Brand logo</span>
                <MediaPicker
                    value={item.brandLogo}
                    onChange={(url) => update('brandLogo', url || undefined)}
                />
            </div>

            <label className="block text-sm">
                <span className="text-xs opacity-70">Rating</span>
                <select
                    value={item.rating ?? ''}
                    onChange={(e) => {
                        const v = e.target.value;
                        update('rating', v === '' ? undefined : (Number(v) as TestimonialRating));
                    }}
                    className="mt-1 w-full border rounded px-2 py-1"
                >
                    {RATING_OPTIONS.map((opt) => (
                        <option key={String(opt.value)} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
            </label>

            <label className="block text-sm">
                <span className="text-xs opacity-70">Quote *</span>
                <textarea
                    value={item.content}
                    onChange={(e) => update('content', e.target.value)}
                    rows={4}
                    className="mt-1 w-full border rounded px-2 py-1"
                    required
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: 11, marginTop: 2, color: overLimit ? '#b91c1c' : 'inherit' }}>
                    {item.content.length} / {TESTIMONIAL_CONTENT_SOFT_LIMIT}
                    {overLimit && ' — long testimonials may be hard to read'}
                </div>
            </label>
        </div>
    );
};

export default TestimonialItemEditor;
```

**Important — verify MediaPicker prop shape.** If existing `MediaPicker` takes different prop names (e.g. `onSelect` instead of `onChange`, or `url` instead of `value`), adjust the two usages above to match. Inspect:

```bash
grep -A 20 "interface.*MediaPickerProps\|type.*MediaPickerProps" components/admin/MediaPicker.tsx 2>/dev/null | head -25
```

Match the editor's two usages to the actual API exactly. Do not invent a new API.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `pnpm tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/admin/blocks/forms/testimonials/TestimonialItemEditor.tsx
git commit -m "feat(blocks): add TestimonialItemEditor admin sub-component"
```

---

## Task 8: Build `TestimonialsBlockForm`

**Files:**

- Create: `components/admin/blocks/forms/testimonials/TestimonialsBlockForm.tsx`

- [ ] **Step 1: Implement the form**

```tsx
// components/admin/blocks/forms/testimonials/TestimonialsBlockForm.tsx
'use client';

import React from 'react';
import type { TestimonialsBlockData, TestimonialItem } from '@/lib/canvas/blocks/testimonials/types';
import { makeDefaultTestimonialItem } from '@/lib/canvas/blocks/testimonials/types';
import { TestimonialItemEditor } from './TestimonialItemEditor';

interface TestimonialsBlockFormProps {
    data: TestimonialsBlockData;
    onChange: (next: TestimonialsBlockData) => void;
}

export const TestimonialsBlockForm: React.FC<TestimonialsBlockFormProps> = ({ data, onChange }) => {
    const items = data.items ?? [];

    const updateItem = (id: string, next: TestimonialItem) =>
        onChange({ ...data, items: items.map((it) => (it.id === id ? next : it)) });

    const removeItem = (id: string) =>
        onChange({ ...data, items: items.filter((it) => it.id !== id) });

    const addItem = () =>
        onChange({ ...data, items: [...items, makeDefaultTestimonialItem()] });

    const setVariant = (variant: 'single' | 'marquee') =>
        onChange({ ...data, variant });

    const visibleItems = data.variant === 'single' ? items.slice(0, 1) : items;
    const showMarqueeConfig = data.variant === 'marquee';

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
                <span className="text-xs opacity-70 block mb-1">Variant</span>
                <div role="radiogroup" style={{ display: 'flex', gap: 8 }}>
                    {(['single', 'marquee'] as const).map((v) => (
                        <button
                            key={v}
                            type="button"
                            role="radio"
                            aria-checked={data.variant === v}
                            onClick={() => setVariant(v)}
                            className={`px-3 py-1.5 rounded border text-sm ${data.variant === v ? 'bg-black text-white' : 'bg-white'}`}
                        >
                            {v === 'single' ? 'Single' : 'Marquee'}
                        </button>
                    ))}
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {visibleItems.map((item) => (
                    <TestimonialItemEditor
                        key={item.id}
                        item={item}
                        onChange={(next) => updateItem(item.id, next)}
                        onRemove={() => removeItem(item.id)}
                        canRemove={data.variant === 'marquee' && items.length > 1}
                    />
                ))}

                {data.variant === 'marquee' && (
                    <button
                        type="button"
                        onClick={addItem}
                        className="border border-dashed rounded py-2 text-sm hover:bg-gray-50"
                    >
                        + Add testimonial
                    </button>
                )}
            </div>

            {showMarqueeConfig && (
                <fieldset style={{ display: 'flex', flexDirection: 'column', gap: 10, border: '1px solid var(--border, #e5e7eb)', borderRadius: 8, padding: 12 }}>
                    <legend className="text-xs opacity-70 px-1">Marquee settings</legend>

                    <label className="block text-sm">
                        <span className="text-xs opacity-70">Direction</span>
                        <select
                            value={data.marqueeDirection ?? 'left'}
                            onChange={(e) => onChange({ ...data, marqueeDirection: e.target.value as 'left' | 'right' })}
                            className="mt-1 w-full border rounded px-2 py-1"
                        >
                            <option value="left">Left</option>
                            <option value="right">Right</option>
                        </select>
                    </label>

                    <label className="block text-sm">
                        <span className="text-xs opacity-70">Speed</span>
                        <select
                            value={data.marqueeSpeed ?? 'normal'}
                            onChange={(e) => onChange({ ...data, marqueeSpeed: e.target.value as 'slow' | 'normal' | 'fast' })}
                            className="mt-1 w-full border rounded px-2 py-1"
                        >
                            <option value="slow">Slow</option>
                            <option value="normal">Normal</option>
                            <option value="fast">Fast</option>
                        </select>
                    </label>

                    <label className="block text-sm">
                        <span className="text-xs opacity-70">Gap</span>
                        <select
                            value={data.marqueeGap ?? 'normal'}
                            onChange={(e) => onChange({ ...data, marqueeGap: e.target.value as 'tight' | 'normal' | 'loose' })}
                            className="mt-1 w-full border rounded px-2 py-1"
                        >
                            <option value="tight">Tight</option>
                            <option value="normal">Normal</option>
                            <option value="loose">Loose</option>
                        </select>
                    </label>

                    <label className="flex items-center gap-2 text-sm">
                        <input
                            type="checkbox"
                            checked={data.marqueePauseOnHover ?? true}
                            onChange={(e) => onChange({ ...data, marqueePauseOnHover: e.target.checked })}
                        />
                        Pause on hover
                    </label>
                </fieldset>
            )}
        </div>
    );
};

export default TestimonialsBlockForm;
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `pnpm tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/admin/blocks/forms/testimonials/TestimonialsBlockForm.tsx
git commit -m "feat(blocks): add TestimonialsBlockForm with variant picker and marquee config"
```

---

## Task 9: Register `testimonials` block type in admin definitions

**Files:**

- Modify: `components/admin/blocks/blockDefinitions.ts`

- [ ] **Step 1: Read the file to locate insertion points**

Open `components/admin/blocks/blockDefinitions.ts`. You will:
1. Add an icon import (use `Quote` from `lucide-react`).
2. Add `'testimonials'` to the type discriminator list (line ~29 area, where `{ type: 'marquee', label: 'Marquee', icon: Megaphone }` is).
3. Add the default-data branch (line ~153 area, where the `case 'marquee'` lives).
4. Add the default factory import: `import { DEFAULT_TESTIMONIALS_BLOCK_DATA } from '@/lib/canvas/blocks/testimonials/types';`.

- [ ] **Step 2: Add the imports near other lucide and block-data imports**

Locate the import section. Add:

```ts
import { Quote } from 'lucide-react';
import { DEFAULT_TESTIMONIALS_BLOCK_DATA } from '@/lib/canvas/blocks/testimonials/types';
```

- [ ] **Step 3: Add the block-catalog entry**

Find the array entry containing `{ type: 'marquee', label: 'Marquee', icon: Megaphone }` and add immediately after it:

```ts
    { type: 'testimonials', label: 'Testimonials', icon: Quote },
```

- [ ] **Step 4: Add the default-data case**

Find the switch statement returning default block data (where `case 'marquee':` lives, around line 153) and add:

```ts
        case 'testimonials':
            return DEFAULT_TESTIMONIALS_BLOCK_DATA;
```

immediately after the `marquee` case.

- [ ] **Step 5: Verify TypeScript compiles**

Run: `pnpm tsc --noEmit`
Expected: no errors. If `BlockType` is a union literal somewhere, you may need to add `'testimonials'` to it — search for `type BlockType` or `BlockType = `:

```bash
grep -rn "type BlockType\|BlockType =" lib/canvas/ components/ --include="*.ts" --include="*.tsx" 2>/dev/null | head
```

If found, add `| 'testimonials'`.

- [ ] **Step 6: Commit**

```bash
git add components/admin/blocks/blockDefinitions.ts lib/canvas/
git commit -m "feat(blocks): register testimonials block in admin definitions"
```

---

## Task 10: Wire `TestimonialsBlockForm` into `BlockFormRenderer`

**Files:**

- Modify: `components/admin/blocks/BlockFormRenderer.tsx`

- [ ] **Step 1: Read the file to find the dispatch switch**

Open `components/admin/blocks/BlockFormRenderer.tsx`. Locate the switch over `block.type` where each case returns the form for that type (look for `MarqueeForm` or similar).

- [ ] **Step 2: Add the import**

Add near other form imports:

```ts
import { TestimonialsBlockForm } from './forms/testimonials/TestimonialsBlockForm';
```

- [ ] **Step 3: Add the case**

Add after the `marquee` case (or wherever fits the existing alphabetical/grouping convention):

```ts
        case 'testimonials':
            return <TestimonialsBlockForm data={block.data} onChange={onChange} />;
```

**Note:** Adjust prop names (`onChange` vs `onDataChange` etc.) to whatever the existing forms use in the same file. Match the convention.

- [ ] **Step 4: Verify TypeScript compiles**

Run: `pnpm tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add components/admin/blocks/BlockFormRenderer.tsx
git commit -m "feat(blocks): wire TestimonialsBlockForm into BlockFormRenderer"
```

---

## Task 11: Wire `DefaultTestimonialsBlock` into `BlockRenderer`

**Files:**

- Modify: `components/blocks/BlockRenderer.tsx`

- [ ] **Step 1: Read the file**

Open `components/blocks/BlockRenderer.tsx`. Locate the dynamic-import block near line 25 (where `MarqueeBlock` is set up via `dynamic(...)`) and the switch around line 230 (where `case 'marquee':` returns the `<MarqueeBlock>`).

- [ ] **Step 2: Add the dynamic import**

Near the `MarqueeBlock` dynamic import (~line 25), add:

```ts
const TestimonialsBlock = dynamic(() =>
    import('./public/DefaultTestimonialsBlock').then((mod) => mod.DefaultTestimonialsBlock)
);
```

- [ ] **Step 3: Add the switch case**

Immediately after the `case 'marquee':` block:

```ts
            case 'testimonials':
                return <TestimonialsBlock data={block.data} />;
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `pnpm tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add components/blocks/BlockRenderer.tsx
git commit -m "feat(blocks): wire DefaultTestimonialsBlock into BlockRenderer"
```

---

## Task 12: End-to-end manual smoke test

This task is verification, not code. Do not skip.

- [ ] **Step 1: Start dev server**

Run: `cd clicker-platform-v2 && pnpm dev`
Expected: server starts on :3000.

- [ ] **Step 2: Add a Testimonials block in Canvas Studio**

In the admin Canvas Studio:
1. Open or create a custom page.
2. Click "Add block" and find "Testimonials".
3. Confirm it inserts with `variant: single` and one empty item.

- [ ] **Step 3: Fill the Single variant and verify rendering**

In the right panel:
- Fill `personName`, `content`.
- Optionally pick a photo via MediaPicker.
- Set a rating.
- Add brand name + logo.

Verify in the canvas preview:
- Card shows person row, content, star row, brand row.
- Hiding rating (set to "No rating") removes the star row.
- Removing brand fields removes the brand row.

- [ ] **Step 4: Drop Single inside a Columns block**

1. Add a Columns block (3 columns).
2. Drag/insert a Testimonials block into each column.
3. Confirm each card fills its column at fluid width and styling looks correct.

- [ ] **Step 5: Switch to Marquee variant**

In a fresh Testimonials block:
1. Switch variant to "Marquee".
2. Confirm: existing single item is preserved; "Add testimonial" button appears.
3. Add 2–3 more items.
4. Confirm marquee animation runs in the preview.
5. Toggle Direction left/right — animation reverses.
6. Change speed slow/normal/fast — animation timing changes.
7. Toggle "Pause on hover" — hovering pauses (or doesn't).
8. Switch back to Single — only the first item is shown, but items[1..N] are still in the block data (re-switch to Marquee confirms they're preserved).

- [ ] **Step 6: Confirm existing Marquee block still works**

Find an existing page with the legacy `marquee` block (or create one). Confirm it renders identically to before the refactor.

- [ ] **Step 7: Theme check on every active template**

Open the same page on:
1. The default-template tenant (the dev environment's default).
2. The MRB tenant (if available — `mrb.localhost:3000` or whichever local route serves MRB).

Confirm: the Testimonials block uses theme tokens. No white cards on dark background; no hardcoded colors leaking. If something looks wrong: **the fix is in `<TestimonialCard>`'s tokenization (e.g. swap `borderRadius: 12` to a token, or read `cardStyles.ts`), never a `MrbTestimonialsBlock` component.**

- [ ] **Step 8: Document any tokenization gaps**

If the theme check finds card styling that does not respect tokens, file follow-up notes in the commit/PR description. Do **not** add template-specific components.

- [ ] **Step 9: Final commit if any token fixes were needed**

```bash
git add -p components/blocks/shared/TestimonialCard.tsx
git commit -m "fix(testimonials): use theme tokens for card chrome"
```

(Skip if no fixes needed.)

---

## Self-Review Summary

**Spec coverage check:**

| Spec requirement | Covered by |
| --- | --- |
| Two variants (single, marquee) | Task 1 (types), Task 6 (renderer), Task 8 (form) |
| Inline content (no Firestore lib) | Task 1 (block data shape with `items` array) |
| `MarqueeTrack` shared primitive | Task 3 |
| Marquee block refactor (no-op) | Task 4 |
| `<TestimonialCard>` shared | Task 5 |
| `<StarRatingDisplay>` read-only stars | Task 2 |
| Block form: variant picker + items + marquee config | Tasks 7, 8 |
| Public renderer dispatch | Task 6 |
| Block registered in admin catalog | Task 9 |
| Form wired into BlockFormRenderer | Task 10 |
| Public renderer wired into BlockRenderer | Task 11 |
| Both photo + brand logo render when present | Task 5 (test covers it) |
| Rating row hidden when undefined | Tasks 2, 5 (tests cover it) |
| Content soft limit 400 (warning, not block) | Task 7 (`overLimit` UI) |
| Variant switch preserves items | Task 8 (only filters `visibleItems` for display) |
| Theme-agnostic (no MRB component) | Task 12 step 7 (verification + explicit no-template-component rule) |
| Marquee refactor verified no-op | Task 4 steps 1–3 (baseline snapshot before refactor) |

**Notes / known unknowns the implementer should resolve as they go:**

- `MediaPicker` prop API — verified in Task 7 step 1.
- `BlockType` union location — checked in Task 9 step 5.
- `BlockFormRenderer` prop convention (`onChange` vs `onDataChange`) — matched per Task 10 step 3.
- Global CSS file for `@keyframes marquee-*` — located in Task 3 step 4.
