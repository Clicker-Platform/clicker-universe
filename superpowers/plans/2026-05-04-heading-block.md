# Heading Block Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `heading` block type to Canvas Studio — a transparent, image-free block with an editable heading (H1–H4 semantic, XL/LG/MD/SM visual labels), optional sub-heading, independent per-field alignment, vertical spacing (Small/Medium/Tall), and horizontal padding (None/Normal/Wide).

**Architecture:** Extract the `EditableText` + `FieldSelectionChrome` inline-edit primitives (currently duplicated between `DefaultHeroBlock` and `MrbHero`) into a shared file, then build the new block on top of them. Extend `InlineEditToolbar` to route `headingAlign`/`subheadingAlign` keys and show size buttons for `field === 'heading'`. Wire all 7 standard touch points (type, definitions, form, public renderer, BlockFormRenderer, BlockRenderer, shared primitives).

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, Lucide icons, `dynamic()` from next/dynamic, `contentEditable` for inline editing.

---

## File Map

| Action | File |
|--------|------|
| Modify | `clicker-platform-v2/data/mockData.ts` |
| Modify | `clicker-platform-v2/components/admin/blocks/blockDefinitions.ts` |
| **Create** | `clicker-platform-v2/components/blocks/shared/EditablePrimitives.tsx` |
| Modify | `clicker-platform-v2/components/blocks/public/DefaultHeroBlock.tsx` |
| Modify | `clicker-platform-v2/components/blocks/mrb/MrbHero.tsx` |
| Modify | `clicker-platform-v2/components/admin/blocks/InlineEditToolbar.tsx` |
| **Create** | `clicker-platform-v2/components/admin/blocks/forms/HeadingForm.tsx` |
| Modify | `clicker-platform-v2/components/admin/blocks/BlockFormRenderer.tsx` |
| **Create** | `clicker-platform-v2/components/blocks/public/DefaultHeadingBlock.tsx` |
| Modify | `clicker-platform-v2/components/blocks/BlockRenderer.tsx` |

---

## Task 1: Register the block type and default data

**Files:**
- Modify: `clicker-platform-v2/data/mockData.ts:30`
- Modify: `clicker-platform-v2/components/admin/blocks/blockDefinitions.ts`

- [ ] **Step 1: Add `'heading'` to the `BlockType` union in `mockData.ts`**

Open `clicker-platform-v2/data/mockData.ts` line 30. Change:

```ts
export type BlockType = 'hero' | 'text' | 'image' | 'button' | 'products' | 'faq' | 'link' | 'map' | 'image_gallery' | 'social_embed' | 'quick_actions' | 'hours' | 'featured_product' | 'branches' | 'reservation' | 'reservation_cta' | 'content_showcase' | 'inline_form' | string;
```

To:

```ts
export type BlockType = 'hero' | 'text' | 'image' | 'button' | 'products' | 'faq' | 'link' | 'map' | 'image_gallery' | 'social_embed' | 'quick_actions' | 'hours' | 'featured_product' | 'branches' | 'reservation' | 'reservation_cta' | 'content_showcase' | 'inline_form' | 'heading' | string;
```

- [ ] **Step 2: Add `BLOCK_OPTIONS` entry in `blockDefinitions.ts`**

The file already imports `Type` from lucide-react (line 2). In the `BLOCK_OPTIONS` array, add after the `inline_form` entry:

```ts
{ type: 'heading', label: 'Heading', icon: Type },
```

- [ ] **Step 3: Add `getDefaultData` case in `blockDefinitions.ts`**

Inside the `switch (type)` in `getDefaultData`, add before the `default:` case:

```ts
case 'heading':
    return {
        ...baseData,
        heading: 'Your Headline',
        headingSize: 'xl',
        headingAlign: 'left',
        subheading: null,
        subheadingAlign: 'left',
        verticalSpacing: 'medium',
        horizontalPadding: 'none',
    };
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd clicker-platform-v2 && pnpm tsc --noEmit 2>&1 | head -20
```

Expected: no errors related to `BlockType` or `blockDefinitions`.

- [ ] **Step 5: Commit**

```bash
git add clicker-platform-v2/data/mockData.ts clicker-platform-v2/components/admin/blocks/blockDefinitions.ts
git commit -m "feat(canvas): register heading block type and default data"
```

---

## Task 2: Extract shared inline-edit primitives

**Files:**
- Create: `clicker-platform-v2/components/blocks/shared/EditablePrimitives.tsx`
- Modify: `clicker-platform-v2/components/blocks/public/DefaultHeroBlock.tsx`
- Modify: `clicker-platform-v2/components/blocks/mrb/MrbHero.tsx`

- [ ] **Step 1: Create `EditablePrimitives.tsx`**

The `FieldSelectionChrome` and `EditableText` components in `DefaultHeroBlock.tsx` (lines 52–137) and `MrbHero.tsx` (lines 56–139) are identical. Create `clicker-platform-v2/components/blocks/shared/EditablePrimitives.tsx` by copying those two functions verbatim from `DefaultHeroBlock.tsx`, adding `'use client';` at the top, changing the imports to:

```ts
'use client';

import { useRef, useState } from 'react';
import { toolbarMouseDownRef } from '@/components/admin/blocks/InlineEditToolbar';
```

And export both functions with the `export` keyword (they are currently not exported). The function bodies are identical to what is already in `DefaultHeroBlock.tsx` — copy them exactly, do not modify the logic.

- [ ] **Step 2: Update `DefaultHeroBlock.tsx` to import from shared file**

In `clicker-platform-v2/components/blocks/public/DefaultHeroBlock.tsx`:

1. Delete the local `FieldSelectionChrome` function (lines 52–66)
2. Delete the local `EditableText` function (lines 70–137)
3. Add this import after line 10 (after the existing imports):

```ts
import { FieldSelectionChrome, EditableText } from '@/components/blocks/shared/EditablePrimitives';
```

- [ ] **Step 3: Update `MrbHero.tsx` to import from shared file**

In `clicker-platform-v2/components/blocks/mrb/MrbHero.tsx`:

1. Delete the local `FieldSelectionChrome` function (lines 56–70)
2. Delete the local `EditableText` function (lines 72–139)
3. Add this import after line 12 (after the existing imports):

```ts
import { FieldSelectionChrome, EditableText } from '@/components/blocks/shared/EditablePrimitives';
```

- [ ] **Step 4: Verify the app compiles and hero blocks still work**

```bash
cd clicker-platform-v2 && pnpm tsc --noEmit 2>&1 | head -20
```

Expected: no new TypeScript errors. Open Canvas Studio in browser, add a Hero block, confirm inline editing still shows the blue selection chrome and floating toolbar.

- [ ] **Step 5: Commit**

```bash
git add clicker-platform-v2/components/blocks/shared/EditablePrimitives.tsx \
    clicker-platform-v2/components/blocks/public/DefaultHeroBlock.tsx \
    clicker-platform-v2/components/blocks/mrb/MrbHero.tsx
git commit -m "refactor(canvas): extract EditableText + FieldSelectionChrome to shared primitives"
```

---

## Task 3: Extend InlineEditToolbar for heading fields

**Files:**
- Modify: `clicker-platform-v2/components/admin/blocks/InlineEditToolbar.tsx`

The toolbar currently handles `title`, `subtitle`, `tagline` fields. We need to add `heading` (shows size buttons + headingAlign) and `subheading` (shows subheadingAlign only).

- [ ] **Step 1: Update align key routing and size button condition**

In `clicker-platform-v2/components/admin/blocks/InlineEditToolbar.tsx` around line 62, replace:

```ts
const isTitle = field === 'title';
const titleSize = currentData.titleSize || 'md';
const alignKey = field === 'tagline' ? 'taglineAlign' : field === 'title' ? 'titleAlign' : 'subtitleAlign';
const fallbackAlign = currentData.textAlign || 'left';
const textAlign = currentData[alignKey] ?? fallbackAlign;
```

With:

```ts
const isTitle = field === 'title' || field === 'heading';
const titleSize = field === 'heading'
    ? (currentData.headingSize || 'xl')
    : (currentData.titleSize || 'md');
const alignKey =
    field === 'tagline' ? 'taglineAlign' :
    field === 'title' ? 'titleAlign' :
    field === 'heading' ? 'headingAlign' :
    field === 'subheading' ? 'subheadingAlign' :
    'subtitleAlign';
const fallbackAlign = currentData.textAlign || 'left';
const textAlign = currentData[alignKey] ?? fallbackAlign;
```

- [ ] **Step 2: Update size button action to patch the correct key**

Still in `InlineEditToolbar.tsx`, find the size button `onClick` inside the `{isTitle && (...)}` block. It currently calls:

```ts
() => onAction(blockId, { titleSize: size })
```

Change it to:

```ts
() => onAction(blockId, field === 'heading' ? { headingSize: size } : { titleSize: size })
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd clicker-platform-v2 && pnpm tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add clicker-platform-v2/components/admin/blocks/InlineEditToolbar.tsx
git commit -m "feat(canvas): extend InlineEditToolbar to support heading/subheading fields"
```

---

## Task 4: Create the admin form panel

**Files:**
- Create: `clicker-platform-v2/components/admin/blocks/forms/HeadingForm.tsx`

- [ ] **Step 1: Create `HeadingForm.tsx`**

Create `clicker-platform-v2/components/admin/blocks/forms/HeadingForm.tsx`:

```tsx
'use client';

import { AlignLeft, AlignCenter, AlignRight, Plus, Trash2 } from 'lucide-react';

interface HeadingFormProps {
    data: any;
    onChange: (data: any) => void;
}

const inputClass = "w-full px-4 py-2.5 bg-gray-100 dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded-lg text-sm text-neutral-900 dark:text-neutral-200 placeholder-neutral-400 dark:placeholder-neutral-600 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-medium";
const labelClass = "block text-xs font-medium text-neutral-400 dark:text-neutral-500 mb-1";

const ALIGN_OPTIONS = [
    { value: 'left',   icon: AlignLeft,   label: 'Left' },
    { value: 'center', icon: AlignCenter, label: 'Center' },
    { value: 'right',  icon: AlignRight,  label: 'Right' },
] as const;

const HEADING_SIZES = [
    { value: 'xl', label: 'XL' },
    { value: 'lg', label: 'LG' },
    { value: 'md', label: 'MD' },
    { value: 'sm', label: 'SM' },
] as const;

export function HeadingForm({ data, onChange }: HeadingFormProps) {
    const safe = data || {};
    const set = (field: string, value: any) => onChange({ ...safe, [field]: value });

    const alignBtns = (field: 'headingAlign' | 'subheadingAlign') => {
        const current = safe[field] ?? 'left';
        return (
            <div className="flex gap-0.5 flex-shrink-0">
                {ALIGN_OPTIONS.map(({ value, icon: Icon, label }) => (
                    <button
                        key={value}
                        type="button"
                        title={label}
                        onClick={() => set(field, value)}
                        className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all ${
                            current === value
                                ? 'bg-blue-600 text-white shadow'
                                : 'text-neutral-400 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-800'
                        }`}
                    >
                        <Icon size={14} />
                    </button>
                ))}
            </div>
        );
    };

    return (
        <div className="space-y-4">

            {/* Heading */}
            <div>
                <label className={labelClass}>Heading</label>
                <input
                    type="text"
                    value={safe.heading || ''}
                    onChange={(e) => set('heading', e.target.value)}
                    placeholder="Your Headline"
                    className={inputClass}
                />
                <div className="flex gap-1 p-1 mt-2 bg-gray-50 dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800">
                    {HEADING_SIZES.map(({ value, label }) => (
                        <button
                            key={value}
                            type="button"
                            onClick={() => set('headingSize', value)}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                (safe.headingSize || 'xl') === value
                                    ? 'bg-blue-600 text-white shadow'
                                    : 'text-neutral-400 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-800'
                            }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
                <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-neutral-400 dark:text-neutral-500">Alignment</span>
                    {alignBtns('headingAlign')}
                </div>
            </div>

            {/* Sub-heading */}
            <div>
                {safe.subheading !== null && safe.subheading !== undefined ? (
                    <>
                        <div className="flex items-center justify-between mb-1">
                            <label className={labelClass}>Sub-heading</label>
                            <button
                                type="button"
                                onClick={() => set('subheading', null)}
                                className="text-neutral-400 dark:text-neutral-500 hover:text-red-400 transition-colors"
                            >
                                <Trash2 size={13} />
                            </button>
                        </div>
                        <input
                            type="text"
                            value={safe.subheading || ''}
                            onChange={(e) => set('subheading', e.target.value)}
                            placeholder="Supporting text"
                            className={inputClass}
                        />
                        <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-neutral-400 dark:text-neutral-500">Alignment</span>
                            {alignBtns('subheadingAlign')}
                        </div>
                    </>
                ) : (
                    <button
                        type="button"
                        onClick={() => set('subheading', '')}
                        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-gray-300 dark:border-neutral-700 text-xs font-bold text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 hover:border-gray-400 dark:hover:border-neutral-500 transition-colors"
                    >
                        <Plus size={13} />
                        Add Sub-heading
                    </button>
                )}
            </div>

            {/* Vertical Spacing */}
            <div>
                <label className={labelClass}>Vertical Spacing</label>
                <div className="flex gap-1 p-1 bg-gray-50 dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800">
                    {(['small', 'medium', 'tall'] as const).map((v) => (
                        <button
                            key={v}
                            type="button"
                            onClick={() => set('verticalSpacing', v)}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
                                (safe.verticalSpacing || 'medium') === v
                                    ? 'bg-blue-600 text-white shadow'
                                    : 'text-neutral-400 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-800'
                            }`}
                        >
                            {v === 'small' ? 'Small' : v === 'medium' ? 'Medium' : 'Tall'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Horizontal Padding */}
            <div>
                <label className={labelClass}>Horizontal Padding</label>
                <div className="flex gap-1 p-1 bg-gray-50 dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800">
                    {(['none', 'normal', 'wide'] as const).map((v) => (
                        <button
                            key={v}
                            type="button"
                            onClick={() => set('horizontalPadding', v)}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
                                (safe.horizontalPadding || 'none') === v
                                    ? 'bg-blue-600 text-white shadow'
                                    : 'text-neutral-400 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-800'
                            }`}
                        >
                            {v === 'none' ? 'None' : v === 'normal' ? 'Normal' : 'Wide'}
                        </button>
                    ))}
                </div>
            </div>

        </div>
    );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd clicker-platform-v2 && pnpm tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add clicker-platform-v2/components/admin/blocks/forms/HeadingForm.tsx
git commit -m "feat(canvas): add HeadingForm admin panel"
```

---

## Task 5: Register form in BlockFormRenderer

**Files:**
- Modify: `clicker-platform-v2/components/admin/blocks/BlockFormRenderer.tsx`

- [ ] **Step 1: Add dynamic import**

In `BlockFormRenderer.tsx`, after the `InlineFormBlockForm` dynamic import (line ~35), add:

```ts
const HeadingForm = dynamic(() => import('./forms/HeadingForm').then(mod => mod.HeadingForm), { loading: () => <FormSkeleton /> });
```

- [ ] **Step 2: Add `coreLabels` entry**

In the `coreLabels` object (around line 51), add `'heading': 'Heading'` to the existing map:

```ts
const coreLabels: Record<string, string> = {
    'hero': 'Hero', 'text': 'Text', 'image': 'Image', 'button': 'Button',
    'products': 'Products', 'faq': 'FAQ', 'link': 'Link', 'map': 'Map', 'image_gallery': 'Gallery',
    'quick_actions': 'Quick Actions', 'hours': 'Operating Hours', 'featured_product': 'Featured Product', 'branches': 'Branches',
    'social_embed': 'Social Embeds',
    'content_showcase': 'Content Showcase',
    'inline_form': 'Inline Form',
    'heading': 'Heading',
};
```

- [ ] **Step 3: Add switch case**

In the `switch (block.type)` (around line 120), add before `case 'quick_actions':`:

```ts
case 'heading': return <HeadingForm data={block.data} onChange={handleDataChange} />;
```

- [ ] **Step 4: Verify TypeScript**

```bash
cd clicker-platform-v2 && pnpm tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add clicker-platform-v2/components/admin/blocks/BlockFormRenderer.tsx
git commit -m "feat(canvas): register HeadingForm in BlockFormRenderer"
```

---

## Task 6: Create the public renderer

**Files:**
- Create: `clicker-platform-v2/components/blocks/public/DefaultHeadingBlock.tsx`

- [ ] **Step 1: Create `DefaultHeadingBlock.tsx`**

Create `clicker-platform-v2/components/blocks/public/DefaultHeadingBlock.tsx`:

```tsx
'use client';

import { EditableText } from '@/components/blocks/shared/EditablePrimitives';

const ALIGN_CLASS = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
} as const;

const SIZE_CONFIG = {
    xl: { tag: 'h1' as const, className: 'text-4xl md:text-5xl' },
    lg: { tag: 'h2' as const, className: 'text-3xl md:text-4xl' },
    md: { tag: 'h3' as const, className: 'text-2xl md:text-3xl' },
    sm: { tag: 'h4' as const, className: 'text-xl md:text-2xl' },
};

const VERTICAL_SPACING = {
    small:  'py-4',
    medium: 'py-8',
    tall:   'py-14',
} as const;

const HORIZONTAL_PADDING = {
    none:   'px-0',
    normal: 'px-4',
    wide:   'px-8',
} as const;

export function DefaultHeadingBlock({ data, onInlineChange, onFieldFocus, onFieldBlur }: {
    data: any;
    onInlineChange?: (field: string, value: string) => void;
    onFieldFocus?: (field: string, rect: DOMRect) => void;
    onFieldBlur?: () => void;
}) {
    if (!data) return null;

    const sizeKey = (data.headingSize || 'xl') as keyof typeof SIZE_CONFIG;
    const { tag: HeadingTag, className: sizeClass } = SIZE_CONFIG[sizeKey] ?? SIZE_CONFIG.xl;

    const headingAlignClass = ALIGN_CLASS[(data.headingAlign || 'left') as keyof typeof ALIGN_CLASS] ?? 'text-left';
    const subheadingAlignClass = ALIGN_CLASS[(data.subheadingAlign || 'left') as keyof typeof ALIGN_CLASS] ?? 'text-left';
    const verticalClass = VERTICAL_SPACING[(data.verticalSpacing || 'medium') as keyof typeof VERTICAL_SPACING] ?? 'py-8';
    const horizontalClass = HORIZONTAL_PADDING[(data.horizontalPadding || 'none') as keyof typeof HORIZONTAL_PADDING] ?? 'px-0';
    const hasSubheading = data.subheading !== null && data.subheading !== undefined;

    return (
        <section className={`w-full ${verticalClass} ${horizontalClass}`}>
            <EditableText
                tag={HeadingTag}
                field="heading"
                value={data.heading}
                placeholder="Your Headline"
                onInlineChange={onInlineChange}
                onFieldFocus={onFieldFocus}
                onFieldBlur={onFieldBlur}
                className={`${sizeClass} ${headingAlignClass} font-bold tracking-tight m-0`}
                style={{ color: 'var(--theme-foreground)' }}
            />
            {(hasSubheading || onInlineChange) && (
                <EditableText
                    tag="p"
                    field="subheading"
                    value={data.subheading ?? ''}
                    placeholder="Supporting text..."
                    onInlineChange={onInlineChange}
                    onFieldFocus={onFieldFocus}
                    onFieldBlur={onFieldBlur}
                    className={`text-base font-medium mt-2 opacity-65 ${subheadingAlignClass} m-0`}
                    style={{ color: 'var(--theme-foreground)' }}
                />
            )}
        </section>
    );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd clicker-platform-v2 && pnpm tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add clicker-platform-v2/components/blocks/public/DefaultHeadingBlock.tsx
git commit -m "feat(canvas): add DefaultHeadingBlock public renderer"
```

---

## Task 7: Register in BlockRenderer and verify end-to-end

**Files:**
- Modify: `clicker-platform-v2/components/blocks/BlockRenderer.tsx`

- [ ] **Step 1: Add dynamic import**

In `BlockRenderer.tsx`, after the `InlineFormBlock` dynamic import (line ~20), add:

```ts
const HeadingBlock = dynamic(() => import('./public/DefaultHeadingBlock').then(mod => mod.DefaultHeadingBlock));
```

- [ ] **Step 2: Add switch case**

In the `switch (block.type)` inside `renderBlock()`, add before the `default:` case:

```ts
case 'heading':
    return customBlocks?.HeadingBlock
        ? React.createElement(customBlocks.HeadingBlock, { data: block.data })
        : <HeadingBlock data={block.data} onInlineChange={onInlineChange} onFieldFocus={onFieldFocus} onFieldBlur={onFieldBlur} />;
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd clicker-platform-v2 && pnpm tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 4: Manual end-to-end test**

Start the dev server:

```bash
cd clicker-platform-v2 && pnpm dev
```

In Canvas Studio:
1. Open any page in the editor
2. Click "Add Block" — confirm "Heading" appears in the list with the Type icon
3. Add the block — confirm it renders "Your Headline" on the canvas with no background
4. Click the heading text — confirm the blue selection chrome appears and the floating toolbar shows: `XL · LG · MD · SM | T Heading | align buttons | trash`
5. Click `LG` in the toolbar — confirm the heading shrinks to H2 size and `headingSize` updates
6. Click align center — confirm text centers
7. In the right panel, click "Add Sub-heading" — confirm sub-heading input appears
8. Type a sub-heading — confirm it renders below the heading at smaller size
9. Click the sub-heading text in the canvas — confirm toolbar shows `T Sub-heading | align buttons | trash` (no size buttons)
10. Change vertical spacing to Tall — confirm more padding appears above/below the block
11. Change horizontal padding to Normal — confirm the text indents from the sides
12. Delete the block — confirm it removes cleanly

- [ ] **Step 5: Commit**

```bash
git add clicker-platform-v2/components/blocks/BlockRenderer.tsx
git commit -m "feat(canvas): wire heading block into BlockRenderer — heading block complete"
```

---

## Self-Review Notes

- **Task 2:** After removing local primitives from `DefaultHeroBlock` and `MrbHero`, search each file for any remaining local references to `FieldSelectionChrome` or `EditableText` — there should be none except the import line.
- **Task 3:** Size button patches `headingSize` for `field === 'heading'` and `titleSize` otherwise — matches the data shape from Task 1.
- **Task 6:** Sub-heading renders in edit mode (`onInlineChange` present) even when `subheading === null` so users can click it to add text. The `value={data.subheading ?? ''}` prevents a crash on null.
- **Task 7:** `onInlineChange`, `onFieldFocus`, `onFieldBlur` are forwarded to the default renderer. The `customBlocks?.HeadingBlock` branch omits them intentionally — template overrides manage their own edit mode.
