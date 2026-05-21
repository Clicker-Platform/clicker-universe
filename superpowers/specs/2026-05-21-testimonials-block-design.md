# Testimonials Block — Design Spec

**Date:** 2026-05-21
**Status:** v1.1 — trimmed scope (Single + Marquee variants, inline content)

## Summary

Add a **Testimonials** Canvas Studio block with two layout variants — **Single** and **Marquee**. Content is **stored inline on the block** (no shared library). Multi-card layouts (e.g. 3 testimonials side-by-side) are composed by dropping multiple Single Testimonials blocks into a Columns or Grid block.

## Scope Rationale

- **Inline content, not a shared library.** Testimonial copy is short and rarely re-quoted across pages. The cost of an admin library + picker + SSR batching does not pay off; authors prefer entering content directly on the block.
- **Only Single + Marquee.** Grid/Carousel are covered by composing Single blocks inside existing Columns/Grid blocks. Marquee is kept as its own variant because an auto-scrolling row cannot be composed from existing primitives.
- **Estimated ~60% smaller than the original 4-variant + library design.**

## Goals

- Two variants: Single (one testimonial, fluid width, droppable into Columns/Grid) and Marquee (multiple testimonials, auto-scrolling row).
- Inline content authoring — author types fields directly into the block form. No `/admin/testimonials` page.
- **Template-agnostic rendering** — one block, one component. Reads theme tokens (`cardStyle`, typography, color helpers) only. **Blocks must not depend on templates.**
- Extract a shared `<MarqueeTrack>` primitive and refactor the existing Marquee block to use it (one animation engine to maintain).

## Non-Goals (v1)

- No shared testimonial library, no admin route, no Firestore collection for testimonials.
- No Grid variant on the block itself (use Columns/Grid block to compose).
- No Carousel variant.
- No auto-filter, no tagging.
- No template-specific component variants (e.g. `MrbTestimonialsBlock`). Theme-aware via tokens only.
- No public-side submission form.
- No `StarRatingInput` admin UI component (rating is entered as a small number-select in the form, no fancy interactive stars on the admin side). Public-side `StarRatingDisplay` only.

## Data Model

Testimonial content lives **inline on the block data**. No Firestore collection.

```ts
interface TestimonialItem {
  id: string;                     // local UUID, stable within block
  personName: string;             // required
  personRole?: string;            // optional, e.g. "Marketing Director"
  personPhoto?: string;           // optional, storage URL
  brandName?: string;             // optional, e.g. "Acme Corp"
  brandLogo?: string;             // optional, storage URL
  rating?: 1 | 2 | 3 | 4 | 5;     // optional
  content: string;                // required, soft limit 400 chars
}

interface TestimonialsBlockData {
  variant: 'single' | 'marquee';

  // 'single' variant uses items[0] only (form hides "add another" UI)
  // 'marquee' variant uses all items
  items: TestimonialItem[];

  // marquee-only config (ignored for single)
  marqueeDirection?: 'left' | 'right';        // default 'left'
  marqueeSpeed?: 'slow' | 'normal' | 'fast';  // default 'normal'
  marqueePauseOnHover?: boolean;              // default true
  marqueeGap?: 'tight' | 'normal' | 'loose';  // default 'normal' (matches existing Marquee block vocab)
}
```

**Render rules:**

- When `personPhoto` and `brandLogo` are both present, render both (photo as avatar near name, logo small near brandName).
- When `rating` is empty, hide the star row entirely.
- When `content` exceeds 400 chars, allow save but show a soft-limit warning in the form.
- Switching `variant` from `marquee` → `single` keeps `items` array; renderer only uses `items[0]`. Switching back restores the full list (no data loss).

## Block Form

`components/admin/blocks/forms/testimonials/TestimonialsBlockForm.tsx`

Sections (top to bottom):

1. **Variant picker** — segmented control: Single / Marquee.
2. **Items editor:**
   - Single variant: one card-editor block (no "add" button).
   - Marquee variant: sortable list of card-editors with "Add testimonial" button. Each item is removable.
3. **Item fields (per card-editor):**
   - `personName` — text input (required)
   - `personRole` — text input
   - `personPhoto` — `MediaPicker` (single image)
   - `brandName` — text input
   - `brandLogo` — `MediaPicker` (single image)
   - `rating` — small dropdown / number select (None / 1★ / 2★ / 3★ / 4★ / 5★)
   - `content` — textarea with live char counter; soft-warns past 400
4. **Marquee config** — visible only when variant = `marquee`:
   - `marqueeDirection`: Left / Right
   - `marqueeSpeed`: Slow / Normal / Fast
   - `marqueePauseOnHover`: toggle
   - `marqueeGap`: Tight / Normal / Loose

## Public Renderer

`components/blocks/public/DefaultTestimonialsBlock.tsx` — dispatcher routing to:

- `TestimonialsSingle` — one `<TestimonialCard>`, fluid width, designed to drop inside Columns/Grid.
- `TestimonialsMarquee` — uses shared `<MarqueeTrack>` primitive, rendering `<TestimonialCard size="sm">` for each item.

Both use:

- Shared `<TestimonialCard>` component
- `cardStyles.ts` from typography system (no hardcoded backgrounds/borders)
- Block typography utilities (H3/H4 scale, color helpers)
- Plain-text content (no DOMPurify needed)

No SSR data hydration needed — content is inline in block data.

## Shared Components (New)

### `<MarqueeTrack>` primitive

Extract the existing Marquee block's animation engine into `components/blocks/shared/MarqueeTrack.tsx`:

```ts
interface MarqueeTrackProps {
  direction: 'left' | 'right';
  speed: 'slow' | 'normal' | 'fast';
  pauseOnHover: boolean;
  gap: 'tight' | 'normal' | 'loose';
  children: React.ReactNode;
}
```

Refactor existing Marquee block (`components/blocks/public/DefaultMarqueeBlock.tsx`) to use it. Refactor must be a behavior no-op — existing marquee renders identically.

### `<TestimonialCard>`

Shared card at `components/blocks/shared/TestimonialCard.tsx`:

```ts
interface TestimonialCardProps {
  item: TestimonialItem;
  size?: 'sm' | 'md' | 'lg';   // marquee = sm, single = lg
}
```

Renders, in order: photo (if present) + name + role, content, rating row (if present), brand row (logo + name, if present).

### `<StarRatingDisplay>`

Read-only stars at `components/ui/star-rating/StarRatingDisplay.tsx`. Renders N filled / 5-N empty stars. Used by `<TestimonialCard>` only in v1. (Input variant deferred — admin form uses a plain dropdown.)

## Block Picker / Catalog

Add Testimonials to the block catalog:

- Icon: quote-mark icon (from existing icon set)
- Display name: "Testimonials"
- Description: "Customer quote — single or auto-scrolling marquee"
- Default variant: `single`
- Default block data: one empty `TestimonialItem` in `items`

## Implementation Touch-Points

1. `lib/canvas/blocks/types.ts` — add `'testimonials'` to BlockType union, define `TestimonialsBlockData` and `TestimonialItem`.
2. Block default factory — add default for `testimonials` (one empty item, variant: `single`).
3. Block catalog registration.
4. `components/admin/blocks/blockDefinitions.ts` — register block.
5. `components/admin/blocks/BlockFormRenderer.tsx` — wire the new form.
6. `components/blocks/BlockRenderer.tsx` — wire the new public renderer.
7. `components/admin/blocks/forms/testimonials/TestimonialsBlockForm.tsx` — block form (new).
8. `components/blocks/public/DefaultTestimonialsBlock.tsx` — public renderer (new).
9. `components/blocks/shared/MarqueeTrack.tsx` — shared marquee primitive (new, extracted from existing Marquee).
10. `components/blocks/shared/TestimonialCard.tsx` — shared card (new).
11. `components/ui/star-rating/StarRatingDisplay.tsx` — read-only stars (new).
12. Refactor `components/blocks/public/DefaultMarqueeBlock.tsx` to use `<MarqueeTrack>` (no behavior change).

## Testing

- Unit test: `<StarRatingDisplay>` renders correct filled/empty count for ratings 1–5.
- Unit test: `<TestimonialCard>` renders all combinations: photo only, logo only, both, rating present/absent, long vs short content.
- Public render smoke test: Single variant renders a card; Marquee variant renders multiple cards inside `<MarqueeTrack>`.
- Marquee refactor verification: existing Marquee block snapshot matches pre-refactor output.
- Manual: drop Single Testimonials block inside a 3-column Columns block, verify it fills its column and styling holds.
- Manual: render on every active template (default, MRB), confirm theme-awareness. Any issue is fixed in the block via tokens/cardStyle, **never** via a template-specific component.

## Risks

- **Marquee refactor regression** — extracting the marquee engine touches an existing in-use block. Mitigation: refactor as no-op first, snapshot-compare existing Marquee before/after, then introduce the new consumer.
- **Card visual consistency** — `<TestimonialCard>` must look right at both `sm` (marquee) and `lg` (single, full width inside a column) sizes. Mitigation: build and visually verify the card in isolation before wiring the public renderer.

## Future Work (out of v1)

- Library mode (shared collection) if it becomes clear testimonials are reused across pages.
- Grid/Carousel variants if composing Single inside Columns proves insufficient.
- `StarRatingInput` interactive admin UI (current dropdown is fine).
- Integration with Service Records feedback to auto-suggest testimonials.
- Public-side submission form.
