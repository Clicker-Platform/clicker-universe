# Feature Cards Block Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new `feature_cards` Canvas Studio block that renders a configurable grid of highlight cards, each with optional media, label, headline, body text, decorative tags, and per-card background color.

**Architecture:** New standalone block type following the existing 6-file pattern (types → form → public component → blockDefinitions → BlockFormRenderer → BlockRenderer + BlockOutlineItem). Reuses `MediaField`/`MediaView` components from Content Showcase. No template-specific overrides — the default component handles all three card styles (clean/glass/bold) plus per-card custom bgColor.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, Vitest + React Testing Library, `uuid` (already in project), `lucide-react` for icons.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `components/blocks/feature-cards/types.ts` | Create | `FeatureCard` + `FeatureCardsData` interfaces, defaults, `DEFAULT_FEATURE_CARD` |
| `components/admin/blocks/forms/FeatureCardsForm.tsx` | Create | Right-sidebar admin form |
| `components/blocks/public/DefaultFeatureCardsBlock.tsx` | Create | Public render component |
| `components/blocks/public/__tests__/suite2.feature-cards.test.tsx` | Create | Vitest test suite |
| `data/mockData.ts` | Modify | Add `'feature_cards'` to `BlockType` |
| `components/admin/blocks/blockDefinitions.ts` | Modify | Add to `BLOCK_OPTIONS` + `getDefaultData()` |
| `components/admin/blocks/BlockFormRenderer.tsx` | Modify | Add `dynamic()` import + switch case |
| `components/blocks/BlockRenderer.tsx` | Modify | Add dynamic import + switch case |
| `components/admin/blocks/BlockOutlineItem.tsx` | Modify | Add label entry in `coreLabels` |

---

## Task 1: Types & Interfaces

**Files:**
- Create: `components/blocks/feature-cards/types.ts`

- [ ] **Step 1: Create the types file**

```typescript
// components/blocks/feature-cards/types.ts
import { v4 as uuidv4 } from 'uuid';
import type { MediaFieldValue } from '@/components/admin/blocks/media-field/types';

export interface FeatureCard {
    id: string;
    media?: MediaFieldValue;
    label?: string;
    headline: string;
    body?: string;
    tags?: string[];
    bgColor?: string;
    textColor?: string;
}

export interface FeatureCardsData {
    title?: string;
    subtitle?: string;
    columns: 2 | 3 | 4;
    cards: FeatureCard[];
}

export function makeDefaultCard(): FeatureCard {
    return { id: uuidv4(), headline: 'Card Headline' };
}

export const DEFAULT_FEATURE_CARDS_DATA: FeatureCardsData = {
    title: '',
    subtitle: '',
    columns: 3,
    cards: [
        { id: uuidv4(), headline: 'First Card' },
        { id: uuidv4(), headline: 'Second Card' },
        { id: uuidv4(), headline: 'Third Card' },
    ],
};
```

- [ ] **Step 2: Commit**

```bash
git add components/blocks/feature-cards/types.ts
git commit -m "feat(feature-cards): add types and default data"
```

---

## Task 2: Register in blockDefinitions & BlockType

**Files:**
- Modify: `data/mockData.ts` (line with `BlockType`)
- Modify: `components/admin/blocks/blockDefinitions.ts`

- [ ] **Step 1: Add `'feature_cards'` to BlockType in `data/mockData.ts`**

Find the line:
```typescript
export type BlockType = 'hero' | 'text' | 'image' | 'button' | 'products' | 'faq' | 'link' | 'map' | 'image_gallery' | 'social_embed' | 'quick_actions' | 'hours' | 'featured_product' | 'branches' | 'reservation' | 'reservation_cta' | 'content_showcase' | 'inline_form' | 'heading' | string;
```

Replace with:
```typescript
export type BlockType = 'hero' | 'text' | 'image' | 'button' | 'products' | 'faq' | 'link' | 'map' | 'image_gallery' | 'social_embed' | 'quick_actions' | 'hours' | 'featured_product' | 'branches' | 'reservation' | 'reservation_cta' | 'content_showcase' | 'inline_form' | 'heading' | 'feature_cards' | string;
```

- [ ] **Step 2: Add to `BLOCK_OPTIONS` in `blockDefinitions.ts`**

Add `LayoutGrid` to the existing lucide-react import at the top of the file:
```typescript
import { Type, Image as ImageIcon, Layout, Box, HelpCircle, AlignCenter, Link, Map, List, Clock, Star, MapPin, Play, Columns2, ClipboardList, LayoutGrid } from 'lucide-react';
```

Then add to the `BLOCK_OPTIONS` array (after `heading`):
```typescript
{ type: 'feature_cards', label: 'Feature Cards', icon: LayoutGrid },
```

- [ ] **Step 3: Add to `getDefaultData()` in `blockDefinitions.ts`**

Add the import at the top of the file (after existing imports):
```typescript
import { DEFAULT_FEATURE_CARDS_DATA, makeDefaultCard } from '@/components/blocks/feature-cards/types';
```

Add a case in the `switch (type)` block (after the `heading` case):
```typescript
case 'feature_cards':
    return {
        ...baseData,
        ...DEFAULT_FEATURE_CARDS_DATA,
        cards: [
            makeDefaultCard(),
            makeDefaultCard(),
            makeDefaultCard(),
        ],
    };
```

- [ ] **Step 4: Commit**

```bash
git add data/mockData.ts components/admin/blocks/blockDefinitions.ts components/blocks/feature-cards/types.ts
git commit -m "feat(feature-cards): register block type and default data"
```

---

## Task 3: Public Render Component

**Files:**
- Create: `components/blocks/public/DefaultFeatureCardsBlock.tsx`

- [ ] **Step 1: Create the public component**

```tsx
// components/blocks/public/DefaultFeatureCardsBlock.tsx
'use client';

import React from 'react';
import { useTemplate } from '@/components/TemplateProvider';
import { MediaView } from './MediaView';
import { getCardClasses, getTextColor } from './cardStyles';
import type { FeatureCardsData, FeatureCard } from '@/components/blocks/feature-cards/types';

/**
 * Returns true if luminance of a hex color is above 0.5 (i.e. light background).
 * Falls back to true (dark text) for invalid input.
 */
function isLightColor(hex: string): boolean {
    const clean = hex.replace('#', '');
    if (clean.length !== 6) return true;
    const r = parseInt(clean.slice(0, 2), 16) / 255;
    const g = parseInt(clean.slice(2, 4), 16) / 255;
    const b = parseInt(clean.slice(4, 6), 16) / 255;
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return luminance > 0.5;
}

const COLS_CLASS: Record<number, string> = {
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
};

interface CardItemProps {
    card: FeatureCard;
    cardStyle?: string;
}

function CardItem({ card, cardStyle }: CardItemProps) {
    const hasCustomBg = !!card.bgColor;

    const autoTextColor = card.bgColor
        ? (card.textColor || (isLightColor(card.bgColor) ? '#111111' : '#ffffff'))
        : undefined;

    const cardClass = hasCustomBg
        ? 'rounded-2xl overflow-hidden flex flex-col'
        : `rounded-2xl overflow-hidden flex flex-col ${getCardClasses(cardStyle)}`;

    const inlineStyle = hasCustomBg
        ? { backgroundColor: card.bgColor, color: autoTextColor }
        : undefined;

    const labelColor = hasCustomBg
        ? (autoTextColor ? `${autoTextColor}99` : 'rgba(255,255,255,0.6)')
        : undefined;

    const bodyColor = hasCustomBg
        ? (autoTextColor ? `${autoTextColor}cc` : 'rgba(255,255,255,0.8)')
        : undefined;

    const tagBg = hasCustomBg ? 'rgba(255,255,255,0.15)' : undefined;
    const tagText = hasCustomBg ? autoTextColor : undefined;

    return (
        <div className={cardClass} style={inlineStyle}>
            {card.media?.src && (
                <MediaView media={card.media} />
            )}
            <div className="flex flex-col gap-2 p-5 flex-1">
                {card.label && (
                    <span
                        className="text-xs font-bold tracking-widest uppercase"
                        style={labelColor ? { color: labelColor } : { color: 'var(--theme-muted-foreground, #6b7280)' }}
                    >
                        {card.label}
                    </span>
                )}
                <h3
                    className="text-xl font-black leading-tight"
                    style={hasCustomBg ? { color: autoTextColor } : { color: 'var(--theme-foreground)' }}
                >
                    {card.headline}
                </h3>
                {card.body && (
                    <p
                        className="text-sm leading-relaxed"
                        style={bodyColor ? { color: bodyColor } : { color: 'var(--theme-muted-foreground, #6b7280)' }}
                    >
                        {card.body}
                    </p>
                )}
                {card.tags && card.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-auto pt-2">
                        {card.tags.map((tag, i) => (
                            <span
                                key={i}
                                className="px-3 py-1 rounded-full text-xs font-medium"
                                style={
                                    tagBg
                                        ? { backgroundColor: tagBg, color: tagText }
                                        : { backgroundColor: 'var(--theme-muted, #f3f4f6)', color: 'var(--theme-foreground)' }
                                }
                            >
                                {tag}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

interface DefaultFeatureCardsBlockProps {
    data: FeatureCardsData;
    theme?: any;
    previewMode?: boolean;
}

export function DefaultFeatureCardsBlock({ data, theme: themeProp, previewMode: _previewMode }: DefaultFeatureCardsBlockProps) {
    const { theme: contextTheme } = useTemplate();
    const theme = themeProp ?? contextTheme;

    if (!data) return null;

    const columns = data.columns || 3;
    const colsClass = COLS_CLASS[columns] || COLS_CLASS[3];
    const cards = data.cards || [];

    return (
        <section className="w-full px-4 py-8">
            {(data.title || data.subtitle) && (
                <div className="mb-8 text-center">
                    {data.title && (
                        <h2 className="text-3xl font-black tracking-tight" style={{ color: 'var(--theme-foreground)' }}>
                            {data.title}
                        </h2>
                    )}
                    {data.subtitle && (
                        <p className="mt-2 text-base" style={{ color: 'var(--theme-muted-foreground, #6b7280)' }}>
                            {data.subtitle}
                        </p>
                    )}
                </div>
            )}
            {cards.length > 0 && (
                <div className={`grid ${colsClass} gap-4 items-stretch`}>
                    {cards.map((card) => (
                        <CardItem key={card.id} card={card} cardStyle={theme?.cardStyle} />
                    ))}
                </div>
            )}
        </section>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/blocks/public/DefaultFeatureCardsBlock.tsx
git commit -m "feat(feature-cards): add public render component"
```

---

## Task 4: Tests for Public Component

**Files:**
- Create: `components/blocks/public/__tests__/suite2.feature-cards.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// components/blocks/public/__tests__/suite2.feature-cards.test.tsx
import React from 'react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DefaultFeatureCardsBlock } from '../DefaultFeatureCardsBlock';
import type { FeatureCardsData } from '@/components/blocks/feature-cards/types';

vi.mock('@/components/TemplateProvider', () => ({
    useTemplate: () => ({ theme: { cardStyle: 'clean' } }),
}));

vi.mock('../MediaView', () => ({
    MediaView: ({ media }: any) =>
        media?.src ? <div data-testid="media-view" data-src={media.src} /> : null,
}));

const BASE_DATA: FeatureCardsData = {
    title: '',
    subtitle: '',
    columns: 3,
    cards: [],
};

function makeCard(overrides: Partial<any> = {}) {
    return { id: 'card-1', headline: 'Test Headline', ...overrides };
}

describe('Suite 2 — DefaultFeatureCardsBlock', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    it('2.1 — renders nothing when data is null', () => {
        const { container } = render(<DefaultFeatureCardsBlock data={null as any} />);
        expect(container.firstChild).toBeNull();
    });

    it('2.2 — renders nothing when cards array is empty (no title)', () => {
        const { container } = render(<DefaultFeatureCardsBlock data={{ ...BASE_DATA, cards: [] }} />);
        // section renders but grid is absent
        expect(container.querySelector('[class*="grid"]')).toBeNull();
    });

    it('2.3 — renders block title when provided', () => {
        render(<DefaultFeatureCardsBlock data={{ ...BASE_DATA, title: 'Why Choose Us', cards: [] }} />);
        expect(screen.getByText('Why Choose Us')).toBeInTheDocument();
    });

    it('2.4 — renders block subtitle when provided', () => {
        render(<DefaultFeatureCardsBlock data={{ ...BASE_DATA, subtitle: 'A short line', cards: [] }} />);
        expect(screen.getByText('A short line')).toBeInTheDocument();
    });

    it('2.5 — does not render title section when both title and subtitle are empty', () => {
        render(<DefaultFeatureCardsBlock data={{ ...BASE_DATA, title: '', subtitle: '', cards: [makeCard()] }} />);
        expect(screen.queryByRole('heading', { level: 2 })).toBeNull();
    });

    it('2.6 — renders headline for each card', () => {
        const cards = [
            { id: '1', headline: 'First' },
            { id: '2', headline: 'Second' },
            { id: '3', headline: 'Third' },
        ];
        render(<DefaultFeatureCardsBlock data={{ ...BASE_DATA, cards }} />);
        expect(screen.getByText('First')).toBeInTheDocument();
        expect(screen.getByText('Second')).toBeInTheDocument();
        expect(screen.getByText('Third')).toBeInTheDocument();
    });

    it('2.7 — renders label when provided', () => {
        render(<DefaultFeatureCardsBlock data={{ ...BASE_DATA, cards: [makeCard({ label: 'CATEGORY' })] }} />);
        expect(screen.getByText('CATEGORY')).toBeInTheDocument();
    });

    it('2.8 — does not render label element when label is absent', () => {
        render(<DefaultFeatureCardsBlock data={{ ...BASE_DATA, cards: [makeCard({ label: undefined })] }} />);
        // headline renders, but no uppercase small label
        expect(screen.queryByText(/category/i)).toBeNull();
    });

    it('2.9 — renders body text when provided', () => {
        render(<DefaultFeatureCardsBlock data={{ ...BASE_DATA, cards: [makeCard({ body: 'Body copy here.' })] }} />);
        expect(screen.getByText('Body copy here.')).toBeInTheDocument();
    });

    it('2.10 — renders tags as pill chips', () => {
        render(<DefaultFeatureCardsBlock data={{ ...BASE_DATA, cards: [makeCard({ tags: ['Design', 'Strategy'] })] }} />);
        expect(screen.getByText('Design')).toBeInTheDocument();
        expect(screen.getByText('Strategy')).toBeInTheDocument();
    });

    it('2.11 — does not render tags section when tags array is empty', () => {
        const { container } = render(<DefaultFeatureCardsBlock data={{ ...BASE_DATA, cards: [makeCard({ tags: [] })] }} />);
        // no pill chips rendered
        expect(container.querySelectorAll('.rounded-full').length).toBe(0);
    });

    it('2.12 — renders MediaView when card has media.src', () => {
        const card = makeCard({ media: { type: 'image', src: 'https://example.com/img.jpg' } });
        render(<DefaultFeatureCardsBlock data={{ ...BASE_DATA, cards: [card] }} />);
        expect(screen.getByTestId('media-view')).toBeInTheDocument();
        expect(screen.getByTestId('media-view').getAttribute('data-src')).toBe('https://example.com/img.jpg');
    });

    it('2.13 — does not render MediaView when card has no media.src', () => {
        render(<DefaultFeatureCardsBlock data={{ ...BASE_DATA, cards: [makeCard({ media: { type: 'image', src: '' } })] }} />);
        expect(screen.queryByTestId('media-view')).toBeNull();
    });

    it('2.14 — applies inline backgroundColor when card.bgColor is set', () => {
        const { container } = render(<DefaultFeatureCardsBlock data={{ ...BASE_DATA, cards: [makeCard({ bgColor: '#6366f1' })] }} />);
        const card = container.querySelector('[style*="background-color"]');
        expect(card).not.toBeNull();
        expect(card!.getAttribute('style')).toMatch(/background-color:\s*rgb\(99,\s*102,\s*241\)|#6366f1/i);
    });

    it('2.15 — renders correct number of cards', () => {
        const cards = Array.from({ length: 5 }, (_, i) => ({ id: `${i}`, headline: `Card ${i}` }));
        render(<DefaultFeatureCardsBlock data={{ ...BASE_DATA, cards }} />);
        expect(screen.getAllByRole('heading', { level: 3 }).length).toBe(5);
    });
});
```

- [ ] **Step 2: Run tests and verify they fail (component not yet imported)**

```bash
cd clicker-platform-v2 && pnpm test components/blocks/public/__tests__/suite2.feature-cards.test.tsx --run
```

Expected: Tests run (some may pass since the component exists). All 15 should pass after the component in Task 3 is done. Verify no import errors.

- [ ] **Step 3: Run tests and verify all pass**

```bash
pnpm test components/blocks/public/__tests__/suite2.feature-cards.test.tsx --run
```

Expected: `15 passed`.

- [ ] **Step 4: Commit**

```bash
git add components/blocks/public/__tests__/suite2.feature-cards.test.tsx
git commit -m "test(feature-cards): add public component test suite"
```

---

## Task 5: Admin Form

**Files:**
- Create: `components/admin/blocks/forms/FeatureCardsForm.tsx`

- [ ] **Step 1: Create the form**

```tsx
// components/admin/blocks/forms/FeatureCardsForm.tsx
'use client';

import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { MediaField } from '@/components/admin/blocks/media-field/MediaField';
import { DEFAULT_MEDIA } from '@/components/admin/blocks/media-field/types';
import type { FeatureCard, FeatureCardsData } from '@/components/blocks/feature-cards/types';

const inputClass = "w-full px-4 py-2.5 bg-neutral-800 border border-neutral-700 rounded-xl text-sm text-neutral-200 placeholder-neutral-600 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-medium";
const labelClass = "block text-xs font-medium text-neutral-500 mb-1";
const sectionClass = "p-3 bg-neutral-900/50 rounded-xl border border-neutral-800 space-y-3";

interface Props {
    data: FeatureCardsData;
    onChange: (data: FeatureCardsData) => void;
}

function TagInput({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
    const [input, setInput] = useState('');

    const add = () => {
        const v = input.trim();
        if (!v || tags.includes(v)) return;
        onChange([...tags, v]);
        setInput('');
    };

    return (
        <div className="space-y-2">
            <div className="flex gap-2">
                <input
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); } }}
                    placeholder="Add tag, press Enter"
                    className={inputClass + ' flex-1'}
                />
                <button
                    type="button"
                    onClick={add}
                    className="px-3 py-2 bg-neutral-700 rounded-xl text-xs text-neutral-300 hover:bg-neutral-600 transition-colors"
                >
                    Add
                </button>
            </div>
            {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {tags.map((tag, i) => (
                        <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 bg-neutral-700 rounded-full text-xs text-neutral-300">
                            {tag}
                            <button type="button" onClick={() => onChange(tags.filter((_, j) => j !== i))} className="hover:text-red-400 transition-colors">×</button>
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}

function CardItem({ card, index, total, onChange, onDelete, onMove }: {
    card: FeatureCard;
    index: number;
    total: number;
    onChange: (card: FeatureCard) => void;
    onDelete: () => void;
    onMove: (dir: 'up' | 'down') => void;
}) {
    const [expanded, setExpanded] = useState(true);
    const [showMedia, setShowMedia] = useState(!!card.media?.src);

    const set = (field: keyof FeatureCard, value: any) => onChange({ ...card, [field]: value });

    return (
        <div className="bg-neutral-800 rounded-xl border border-neutral-700 overflow-hidden">
            {/* Card header */}
            <div className="flex items-center gap-2 px-3 py-2.5 bg-neutral-800/80">
                <button type="button" onClick={() => setExpanded(e => !e)} className="flex-1 flex items-center gap-2 text-left">
                    <span className="text-xs font-bold text-neutral-400">#{index + 1}</span>
                    <span className="text-sm font-medium text-neutral-200 truncate">{card.headline || 'Untitled Card'}</span>
                    {expanded ? <ChevronUp size={14} className="ml-auto text-neutral-500" /> : <ChevronDown size={14} className="ml-auto text-neutral-500" />}
                </button>
                <div className="flex items-center gap-1">
                    <button type="button" disabled={index === 0} onClick={() => onMove('up')} className="p-1 text-neutral-500 hover:text-neutral-200 disabled:opacity-30 transition-colors">↑</button>
                    <button type="button" disabled={index === total - 1} onClick={() => onMove('down')} className="p-1 text-neutral-500 hover:text-neutral-200 disabled:opacity-30 transition-colors">↓</button>
                    <button type="button" onClick={onDelete} className="p-1 text-neutral-500 hover:text-red-400 transition-colors"><Trash2 size={13} /></button>
                </div>
            </div>

            {expanded && (
                <div className="p-3 space-y-3 border-t border-neutral-700">
                    {/* Headline */}
                    <div>
                        <label className={labelClass}>Headline *</label>
                        <input value={card.headline} onChange={e => set('headline', e.target.value)} className={inputClass} placeholder="Card Headline" />
                    </div>

                    {/* Label */}
                    <div>
                        <label className={labelClass}>Label (optional)</label>
                        <input value={card.label || ''} onChange={e => set('label', e.target.value)} className={inputClass} placeholder="CATEGORY" />
                    </div>

                    {/* Body */}
                    <div>
                        <label className={labelClass}>Body text (optional)</label>
                        <textarea value={card.body || ''} onChange={e => set('body', e.target.value)} className={inputClass + ' resize-none'} rows={2} placeholder="Supporting description..." />
                    </div>

                    {/* Tags */}
                    <div>
                        <label className={labelClass}>Tags (decorative)</label>
                        <TagInput tags={card.tags || []} onChange={tags => set('tags', tags)} />
                    </div>

                    {/* Colors */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelClass}>Background color</label>
                            <div className="flex gap-2 items-center">
                                <input
                                    type="color"
                                    value={card.bgColor || '#ffffff'}
                                    onChange={e => set('bgColor', e.target.value)}
                                    className="w-8 h-8 rounded cursor-pointer border border-neutral-600 bg-transparent"
                                />
                                <input
                                    value={card.bgColor || ''}
                                    onChange={e => set('bgColor', e.target.value || undefined)}
                                    className={inputClass + ' flex-1'}
                                    placeholder="None (white)"
                                />
                            </div>
                        </div>
                        <div>
                            <label className={labelClass}>Text color</label>
                            <div className="flex gap-2 items-center">
                                <input
                                    type="color"
                                    value={card.textColor || '#ffffff'}
                                    onChange={e => set('textColor', e.target.value)}
                                    className="w-8 h-8 rounded cursor-pointer border border-neutral-600 bg-transparent"
                                />
                                <input
                                    value={card.textColor || ''}
                                    onChange={e => set('textColor', e.target.value || undefined)}
                                    className={inputClass + ' flex-1'}
                                    placeholder="Auto"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Media */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className={labelClass + ' mb-0'}>Media (optional)</label>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowMedia(s => !s);
                                    if (showMedia) set('media', undefined);
                                    else set('media', { ...DEFAULT_MEDIA });
                                }}
                                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                            >
                                {showMedia ? 'Remove' : '+ Add media'}
                            </button>
                        </div>
                        {showMedia && (
                            <MediaField
                                value={card.media || { ...DEFAULT_MEDIA }}
                                onChange={val => set('media', val)}
                            />
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export function FeatureCardsForm({ data, onChange }: Props) {
    const safeData: FeatureCardsData = {
        title: data?.title ?? '',
        subtitle: data?.subtitle ?? '',
        columns: data?.columns ?? 3,
        cards: data?.cards ?? [],
    };

    const update = (patch: Partial<FeatureCardsData>) => onChange({ ...safeData, ...patch });

    const updateCard = (index: number, card: FeatureCard) => {
        const cards = [...safeData.cards];
        cards[index] = card;
        update({ cards });
    };

    const addCard = () => {
        update({ cards: [...safeData.cards, { id: uuidv4(), headline: 'New Card' }] });
    };

    const deleteCard = (index: number) => {
        update({ cards: safeData.cards.filter((_, i) => i !== index) });
    };

    const moveCard = (index: number, dir: 'up' | 'down') => {
        const cards = [...safeData.cards];
        const target = dir === 'up' ? index - 1 : index + 1;
        [cards[index], cards[target]] = [cards[target], cards[index]];
        update({ cards });
    };

    return (
        <div className="space-y-5">
            {/* Block-level settings */}
            <div className={sectionClass}>
                <div>
                    <label className={labelClass}>Block title (optional)</label>
                    <input value={safeData.title} onChange={e => update({ title: e.target.value })} className={inputClass} placeholder="Why Choose Us" />
                </div>
                <div>
                    <label className={labelClass}>Subtitle (optional)</label>
                    <input value={safeData.subtitle} onChange={e => update({ subtitle: e.target.value })} className={inputClass} placeholder="A short supporting line" />
                </div>
                <div>
                    <label className={labelClass}>Columns</label>
                    <div className="flex gap-2">
                        {([2, 3, 4] as const).map(n => (
                            <button
                                key={n}
                                type="button"
                                onClick={() => update({ columns: n })}
                                className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors border ${safeData.columns === n ? 'bg-blue-600 border-blue-500 text-white' : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:border-neutral-500'}`}
                            >
                                {n}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Cards list */}
            <div>
                <div className="flex justify-between items-center mb-2">
                    <label className={labelClass + ' mb-0'}>Cards ({safeData.cards.length})</label>
                    <button
                        type="button"
                        onClick={addCard}
                        className="text-xs font-bold text-blue-400 flex items-center gap-1.5 hover:text-blue-300 transition-colors bg-blue-500/10 px-3 py-1.5 rounded-full border border-blue-500/20"
                    >
                        <Plus size={14} /> Add Card
                    </button>
                </div>

                {safeData.cards.length === 0 && (
                    <div className="text-center py-8 bg-neutral-900/50 rounded-xl border-2 border-dashed border-neutral-800 text-neutral-500 text-sm">
                        No cards yet. Click "Add Card" to start.
                    </div>
                )}

                <div className="space-y-2">
                    {safeData.cards.map((card, i) => (
                        <CardItem
                            key={card.id}
                            card={card}
                            index={i}
                            total={safeData.cards.length}
                            onChange={c => updateCard(i, c)}
                            onDelete={() => deleteCard(i)}
                            onMove={dir => moveCard(i, dir)}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/admin/blocks/forms/FeatureCardsForm.tsx
git commit -m "feat(feature-cards): add admin form component"
```

---

## Task 6: Wire into BlockFormRenderer

**Files:**
- Modify: `components/admin/blocks/BlockFormRenderer.tsx`

- [ ] **Step 1: Add dynamic import** (add after the `HeadingForm` dynamic import line)

```typescript
const FeatureCardsForm = dynamic(() => import('./forms/FeatureCardsForm').then(mod => mod.FeatureCardsForm), { loading: () => <FormSkeleton /> });
```

- [ ] **Step 2: Add switch case** (add after the `case 'heading':` line inside the switch)

```typescript
case 'feature_cards': return <FeatureCardsForm data={block.data} onChange={handleDataChange} />;
```

- [ ] **Step 3: Add `'feature_cards'` to `coreLabels`** inside the `useEffect` that builds the label lookup (around line 50, alongside other core labels):

```typescript
'feature_cards': 'Feature Cards',
```

- [ ] **Step 4: Commit**

```bash
git add components/admin/blocks/BlockFormRenderer.tsx
git commit -m "feat(feature-cards): wire form into BlockFormRenderer"
```

---

## Task 7: Wire into BlockRenderer

**Files:**
- Modify: `components/blocks/BlockRenderer.tsx`

- [ ] **Step 1: Add dynamic import** (add after the `HeadingBlock` dynamic import line)

```typescript
const FeatureCardsBlock = dynamic(() => import('./public/DefaultFeatureCardsBlock').then(mod => mod.DefaultFeatureCardsBlock));
```

- [ ] **Step 2: Add switch case** (add after the `case 'heading':` case inside the switch)

```typescript
case 'feature_cards':
    return <FeatureCardsBlock data={block.data} theme={theme} previewMode={previewMode} />;
```

- [ ] **Step 3: Commit**

```bash
git add components/blocks/BlockRenderer.tsx
git commit -m "feat(feature-cards): wire public component into BlockRenderer"
```

---

## Task 8: Add Label to BlockOutlineItem

**Files:**
- Modify: `components/admin/blocks/BlockOutlineItem.tsx`

- [ ] **Step 1: Add to `coreLabels`** inside `getBlockLabel()` (add after `'content_showcase': 'Content Showcase'`)

```typescript
'feature_cards': 'Feature Cards',
```

- [ ] **Step 2: Commit**

```bash
git add components/admin/blocks/BlockOutlineItem.tsx
git commit -m "feat(feature-cards): add navigator label"
```

---

## Task 9: Smoke Test in Dev

- [ ] **Step 1: Start the dev server**

```bash
cd clicker-platform-v2 && pnpm dev
```

- [ ] **Step 2: Open Canvas Studio**

Navigate to `http://localhost:3000/admin/canvas`. Open Add Blocks panel (A key or left sidebar). Confirm **Feature Cards** appears in the list.

- [ ] **Step 3: Add the block and verify default state**

Click Feature Cards to add it. In the canvas, verify:
- 3 default cards render side-by-side
- Right sidebar shows the Feature Cards form with Title, Subtitle, Columns, and Cards list

- [ ] **Step 4: Test card editing**

In the form:
- Edit the Headline of card 1 — verify canvas updates in real-time
- Add a Label — verify it renders in small caps above headline
- Add body text — verify it renders below headline
- Add tags ("Design", "Strategy") — verify pill chips appear
- Set bgColor to `#6366f1` — verify card turns purple with auto white text
- Click "+ Add media" and set a test image URL — verify MediaView renders at top of card

- [ ] **Step 5: Test grid column control**

Click 2 in the Columns control → verify cards switch to 2-col grid. Click 4 → verify 4-col grid.

- [ ] **Step 6: Test add/delete/reorder**

- Add a 4th card — verify it appends to the grid
- Delete card 2 — verify it's removed
- Move card 1 down with the ↓ button — verify order changes in canvas

- [ ] **Step 7: Save and verify public render**

Click Save (or Cmd+S). Navigate to the public page in the browser. Confirm Feature Cards block renders identically to the canvas preview.

- [ ] **Step 8: Run full test suite**

```bash
pnpm test --run
```

Expected: All tests pass, including the new `suite2.feature-cards` suite.

- [ ] **Step 9: Final commit**

```bash
git add -A
git commit -m "feat(feature-cards): complete feature cards block implementation"
```
