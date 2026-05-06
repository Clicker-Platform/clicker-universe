# Heading Block — Design Spec

**Date:** 2026-05-04
**Block type:** `heading`
**Status:** Approved, ready for implementation

---

## Overview

A standalone heading + optional sub-heading block for the Canvas Studio. It is intentionally minimal: transparent background, no card chrome, no images. Its purpose is to label sections of a page between other blocks — the same job a loose `<h2>` would do in hand-coded HTML.

Inline editing behavior mirrors the Hero block exactly (same `EditableText` + `FieldSelectionChrome` + `InlineEditToolbar` interaction). This is the occasion to extract those shared primitives from their current duplicated state in `DefaultHeroBlock` and `MrbHero`.

---

## Data Shape

```ts
// PageBlock.data for type 'heading'
{
  heading: string;                                  // required, default: 'Your Headline'
  headingSize: 'xl' | 'lg' | 'md' | 'sm';         // default: 'xl'
  headingAlign: 'left' | 'center' | 'right';        // default: 'left'
  subheading?: string | null;                        // null = hidden; string (incl. '') = visible
  subheadingAlign: 'left' | 'center' | 'right';     // default: 'left'
  verticalSpacing: 'small' | 'medium' | 'tall';     // default: 'medium'
  horizontalPadding: 'none' | 'normal' | 'wide';    // default: 'none'
}
```

### Size → Semantic Tag + Classes

| `headingSize` | Semantic tag | Tailwind classes |
|---------------|-------------|-----------------|
| `xl` | `<h1>` | `text-4xl md:text-5xl` |
| `lg` | `<h2>` | `text-3xl md:text-4xl` |
| `md` | `<h3>` | `text-2xl md:text-3xl` |
| `sm` | `<h4>` | `text-xl md:text-2xl` |

The toolbar label shows `XL / LG / MD / SM` (visual scale, not semantic), consistent with the Hero block's existing `SM / MD / LG / XL` pattern.

### Vertical Spacing → `py-*`

| `verticalSpacing` | Class | Pixels |
|-------------------|-------|--------|
| `small` | `py-4` | 16px |
| `medium` | `py-8` | 32px (default) |
| `tall` | `py-14` | 56px |

### Horizontal Padding → `px-*`

| `horizontalPadding` | Class | Pixels |
|--------------------|-------|--------|
| `none` | `px-0` | 0 (default) |
| `normal` | `px-4` | 16px |
| `wide` | `px-8` | 32px |

---

## Shared Primitives Extraction

`FieldSelectionChrome` and `EditableText` are currently duplicated verbatim between `DefaultHeroBlock.tsx` and `MrbHero.tsx`. This block extracts them to a shared location.

**New file:** `components/blocks/shared/EditablePrimitives.tsx`

Exports:
- `FieldSelectionChrome` — the blue 9-handle selection chrome shown on focused fields
- `EditableText` — `contentEditable` wrapper with placeholder, blur-commit, paste sanitization, and `FieldSelectionChrome` on focus

Both `DefaultHeroBlock.tsx` and `MrbHero.tsx` are updated to import from the shared file. **No behavior change** — pure extraction.

---

## Inline Toolbar Extension

**File:** `components/admin/blocks/InlineEditToolbar.tsx`

Current behavior: size buttons (`SM / MD / LG / XL`) appear only when `field === 'title'`. Align key is derived as `titleAlign / subtitleAlign / taglineAlign` based on field name.

**Changes:**
- Size buttons also appear when `field === 'heading'`
- Align key routing adds two new cases:
  - `field === 'heading'` → `headingAlign`
  - `field === 'subheading'` → `subheadingAlign`
- Field label shows "Heading" / "Sub-heading" (capitalized display)

The toolbar reads `currentData.headingSize` for the active size when `field === 'heading'`.

---

## Public Renderer

**New file:** `components/blocks/public/DefaultHeadingBlock.tsx`

### Behavior
- `'use client'` directive
- Transparent background — no `bg-*`, no border, no card chrome
- Applies `py-*` from `verticalSpacing` and `px-*` from `horizontalPadding`
- Heading rendered as the correct semantic element (`h1`–`h4`) based on `headingSize`
- Heading color: `var(--theme-foreground)` — respects active template
- Heading font weight: `font-bold tracking-tight` (neutral, template-agnostic)
- Sub-heading rendered as `<p>` when `subheading !== null`, hidden otherwise
- Sub-heading color: `var(--theme-foreground)` at 65% opacity (`opacity-65`)
- Sub-heading font: `text-base font-medium` (readable body-scale)
- Both fields use `EditableText` when `onInlineChange` is present, plain element otherwise
- No `isFirst` prop — block never renders images, no LCP concern

### Props

```ts
interface DefaultHeadingBlockProps {
  data: any;
  onInlineChange?: (field: string, value: string) => void;
  onFieldFocus?: (field: string, rect: DOMRect) => void;
  onFieldBlur?: () => void;
}
```

### Alignment

Both `headingAlign` and `subheadingAlign` map to `text-left / text-center / text-right` independently.

---

## Admin Form Panel

**New file:** `components/admin/blocks/forms/HeadingForm.tsx`

### Layout (top to bottom)

1. **Heading** — text input (always shown, never removable)
   - Size picker: `XL / LG / MD / SM` segmented control (blue active state)
   - Align buttons: Left / Center / Right icon buttons

2. **Sub-heading** — conditional
   - When `subheading === null`: dashed "Add Sub-heading" button (same style as Hero's "Add Tagline")
   - When `subheading !== null`: text input + align buttons + trash icon (sets `subheading` back to `null`)

3. **Vertical Spacing** — `Small / Medium / Tall` segmented control

4. **Horizontal Padding** — `None / Normal / Wide` segmented control

Uses the same `inputClass`, `labelClass` CSS string constants as `HeroForm.tsx`. No color pickers — heading color is always driven by `var(--theme-foreground)`.

---

## BlockFormRenderer

**File:** `components/admin/blocks/BlockFormRenderer.tsx`

- Dynamic import of `HeadingForm`
- `coreLabels` entry: `'heading': 'Heading'`
- Switch case: `case 'heading': return <HeadingForm data={block.data} onChange={handleDataChange} />`

No layout variants — skip `renderWithLayoutPicker`.

---

## BlockRenderer

**File:** `components/blocks/BlockRenderer.tsx`

- Dynamic import of `DefaultHeadingBlock` (not static — no LCP image)
- Switch case:

```tsx
case 'heading':
  return customBlocks?.HeadingBlock
    ? React.createElement(customBlocks.HeadingBlock, { data: block.data })
    : <HeadingBlock data={block.data} />;
```

No `isFirst` forwarded — block has no images.

---

## blockDefinitions.ts

```ts
// BLOCK_OPTIONS entry
{ type: 'heading', label: 'Heading', icon: Type },

// getDefaultData case
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

---

## mockData.ts

Add `'heading'` to the `BlockType` union:

```ts
export type BlockType = 'hero' | 'text' | ... | 'heading' | string;
```

---

## Touch Point Checklist

- [ ] `mockData.ts` — `BlockType` union updated
- [ ] `blockDefinitions.ts` — `BLOCK_OPTIONS` entry + `getDefaultData` case
- [ ] `components/blocks/shared/EditablePrimitives.tsx` — new shared file with `FieldSelectionChrome` + `EditableText`
- [ ] `DefaultHeroBlock.tsx` — import primitives from shared file
- [ ] `MrbHero.tsx` — import primitives from shared file
- [ ] `InlineEditToolbar.tsx` — `headingAlign` / `subheadingAlign` routing + size buttons for `field === 'heading'`
- [ ] `HeadingForm.tsx` — new admin form
- [ ] `BlockFormRenderer.tsx` — dynamic import + `coreLabels` + switch case
- [ ] `DefaultHeadingBlock.tsx` — new public renderer
- [ ] `BlockRenderer.tsx` — dynamic import + switch case (no `isFirst`)

---

## Out of Scope

- No color picker — heading color is always `var(--theme-foreground)`
- No background options — block is always transparent
- No layout variants — single layout only
- No `isFirst` / LCP wiring — no images
- No font weight override — uses template-driven weight
