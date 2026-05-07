# Feature Cards Block — Design Spec

**Date:** 2026-05-07  
**Status:** Approved  
**Block type:** `feature_cards`

---

## Overview

A new Canvas Studio block that renders a configurable grid of highlight cards. Designed to showcase key facts, benefits, or features — like "Siap <1 Jam / Bayar yang Dipakai / AI yang Ngerti" or "GenAI or No GenAI / Display Chain of Thought".

---

## Data Model

### Block-level (`FeatureCardsData`)

```typescript
interface FeatureCardsData {
  // Block wrapper (all optional)
  title?: string;          // Section heading above the grid
  subtitle?: string;       // Secondary text below title

  // Grid config
  columns: 2 | 3 | 4;     // Default: 3

  // Cards
  cards: FeatureCard[];
}
```

### Per-card (`FeatureCard`)

```typescript
interface FeatureCard {
  id: string;                    // uuidv4, created client-side

  // Visual
  media?: MediaFieldValue;       // From @/components/admin/blocks/media-field/types — optional

  // Content
  label?: string;                // Small caps text above headline (optional)
  headline: string;              // Required
  body?: string;                 // Paragraph text (optional)
  tags?: string[];               // Decorative chips, no links (optional)

  // Styling
  bgColor?: string;              // Hex color. If absent → white/neutral card
  textColor?: string;            // Hex color. If absent → auto (dark on light bg, white on dark bg)
}
```

**Default card:**
```typescript
{
  id: uuidv4(),
  headline: 'Card Headline',
  bgColor: undefined,   // → white card
}
```

**Default block data:**
```typescript
{
  title: '',
  subtitle: '',
  columns: 3,
  cards: [
    { id: uuidv4(), headline: 'First Card' },
    { id: uuidv4(), headline: 'Second Card' },
    { id: uuidv4(), headline: 'Third Card' },
  ],
}
```

---

## Files to Create / Modify

### New files

| File | Purpose |
|------|---------|
| `components/blocks/feature-cards/types.ts` | `FeatureCard`, `FeatureCardsData` interfaces + defaults |
| `components/admin/blocks/forms/FeatureCardsForm.tsx` | Right-sidebar form |
| `components/blocks/public/DefaultFeatureCardsBlock.tsx` | Public render component |

### Modified files

| File | Change |
|------|--------|
| `data/mockData.ts` | Add `'feature_cards'` to `BlockType` union |
| `components/admin/blocks/blockDefinitions.ts` | Add to `BLOCK_OPTIONS` + `getDefaultData()` |
| `components/admin/blocks/BlockFormRenderer.tsx` | Add `dynamic()` import + `case 'feature_cards'` |
| `components/blocks/BlockRenderer.tsx` | Add `case 'feature_cards'` dynamic import |
| `components/admin/blocks/BlockOutlineItem.tsx` | Add label `'Feature Cards'` |

---

## Admin Form (`FeatureCardsForm`)

### Block-level section
- **Title** — text input (placeholder: "Why Choose Us")
- **Subtitle** — text input (placeholder: "A short supporting line")
- **Columns** — segmented control: `2 | 3 | 4`

### Cards section
- List of cards with collapse/expand per card
- Add card button (appends default card, assigns new uuidv4)
- Delete card button per card (with confirmation or just trash icon)
- Drag-to-reorder (use same DnD pattern as other list forms in the codebase)

### Per-card fields (inside each card's collapsed section)
- **Headline** — text input (required)
- **Label** — text input (optional, placeholder: "CATEGORY")
- **Body** — text input or textarea (optional)
- **Media** — `MediaField` component (optional, toggle to show/hide)
- **Tags** — tag input: type and press Enter/comma to add, click × to remove
- **Background color** — color picker input (hex). "None" option → white card
- **Text color** — color picker input (hex). "Auto" option → system picks contrast color

---

## Public Component (`DefaultFeatureCardsBlock`)

### Props
```typescript
interface Props {
  data: FeatureCardsData;
  theme?: ThemeConfig;
  previewMode?: boolean;
}
```

### Rendering rules

**Grid:** CSS `grid` with `grid-cols-{columns}` at desktop, collapsing to `grid-cols-1` on mobile (≤ md breakpoint). Cards in the same row share equal height via `items-stretch`.

**Card anatomy (top to bottom):**
1. Media area — if `card.media` has a `src`, render `<MediaView>` at the top. Aspect ratio from `media.aspectRatio`, defaults to `16:9`.
2. Content area (padding):
   - Label — small caps, muted color
   - Headline — bold, large
   - Body — regular weight, slightly muted
   - Tags — pill chips in a flex-wrap row

**Card background:**
- If `card.bgColor` is set → use as inline `background-color`. Text color: use `card.textColor` if set, else auto-detect contrast (light bg → dark text, dark bg → white text).
- If no `bgColor` → apply `getCardClasses(theme.cardStyle)` (clean / glass / bold — respects template card style).

**Block wrapper:**
- If `data.title` is non-empty → render heading above grid
- If `data.subtitle` is non-empty → render subtitle below title
- Both are hidden (not rendered) when empty

**3-way card style support:**
```typescript
const isClean = theme?.cardStyle === 'clean';
const isGlass = theme?.cardStyle === 'glass';
const isBold = !isClean && !isGlass;
```
Cards with a custom `bgColor` bypass `getCardClasses()` entirely and use inline styles.

---

## Block Registration

```typescript
// blockDefinitions.ts — BLOCK_OPTIONS
{ type: 'feature_cards', label: 'Feature Cards', icon: LayoutGrid }

// blockDefinitions.ts — getDefaultData()
case 'feature_cards':
  return {
    ...baseData,
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

---

## Out of Scope

- Tag links (decorative only for now)
- Per-card CTA buttons
- Template-specific overrides (MRB etc.) — use default component
- Icon/emoji picker (use MediaField image upload instead)
- Animation or hover effects beyond standard CSS transitions

---

## Notes

- `MediaFieldValue` is imported from `@/components/admin/blocks/media-field/types` — same type used by Content Showcase rows.
- `MediaView` component (`components/blocks/public/MediaView.tsx`) handles image/video/Lottie rendering — reuse directly.
- Card IDs are assigned client-side via `uuidv4()` in the form when adding cards — same pattern as Content Showcase rows.
- `textColor` auto-detection: use luminance check on `bgColor` hex — if luminance > 0.5, use dark text (`#111`), else white (`#fff`).
