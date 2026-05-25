# Block Flexibility: Single Feature Card & Dual-CTA Button

**Date:** 2026-05-23
**Scope:** Two independent UX flexibility additions to existing public blocks.

---

## Finding 1 — FeatureCards: single-card full-width mode

### Problem

When a `feature_cards` block has exactly one card and `columns >= 2`, the card renders at column-width and is visually stuck on the left side of the grid with empty whitespace beside it. The block looks broken even though the data is valid.

### Solution (Approach A — auto-collapse)

When `cards.length === 1`, ignore `columns` and render the single card as a full-width hero-style card (capped by the existing `md:max-w-6xl` container). For 2+ cards, behavior is unchanged.

### Changes

**File:** `clicker-platform-v2/components/blocks/public/DefaultFeatureCardsBlock.tsx`

- In the render branch, compute `isSingle = cards.length === 1`.
- When `isSingle`, replace the grid container classes with a single-card layout:
  - Drop `md:grid ${desktopCols} md:gap-4`
  - Use `flex justify-center md:px-4 md:max-w-6xl md:mx-auto` so the card centers and fills the row.
- For the card wrapper (`cardWrapperBase`), when `isSingle`:
  - Drop the mobile carousel constraints (`w-[72vw] max-w-[280px] snap-start`).
  - Use `w-full` mobile, `md:w-full` desktop, so it stretches to the container.
- Mobile behavior: a single card already fills the viewport reasonably; keep horizontal padding (`px-4`) for breathing room.

### Behavior matrix

| Card count | columns setting | Desktop layout              | Mobile layout       |
| ---------- | --------------- | --------------------------- | ------------------- |
| 1          | any             | Full-width (max-w-6xl)      | Full-width, padded  |
| 2          | 2/3/4           | Existing grid               | Existing scroll     |
| 3+         | 2/3/4           | Existing grid               | Existing scroll     |

### Out of scope

- No form/UI change. `columns` field stays as-is (it just has no effect at count=1).
- No new "size" or "layout style" field on the single-card variant. If a future need for a "left media / right text" hero layout arises, that's a separate spec.

---

## Finding 2 — Button: optional secondary CTA

### Problem

Many landing-page patterns call for a primary CTA next to a secondary CTA ("Get Started" + "Learn More"). Today the user must drop two separate Button blocks side-by-side, which:
- Doesn't lay out as a pair (each Button block is its own full-width section with its own alignment).
- Forces stacking via a Columns block, which is heavy.
- Has no shared alignment or responsive stacking.

### Solution (Approach A — optional secondary field on the existing block)

Extend `DefaultButtonBlock` with an optional `secondary` config. When present, two buttons render as a pair with shared alignment and container-query responsive stacking. When absent, behavior is identical to today.

### Data shape

Extend the button block's `data` shape:

```ts
interface ButtonData {
    // existing fields (unchanged)
    label: string;
    variant: 'primary' | 'secondary' | 'outline';
    linkType: 'url' | 'page' | 'form';
    url?: string;
    formId?: string;
    openInNewTab?: boolean;
    align: 'left' | 'center' | 'right' | 'full';

    // new optional field
    secondary?: {
        label: string;
        variant: 'primary' | 'secondary' | 'outline';
        linkType: 'url' | 'page' | 'form';
        url?: string;
        formId?: string;
        openInNewTab?: boolean;
    };
}
```

- `secondary` is fully optional. Absent or `undefined` → single button (current behavior).
- `secondary` has no `align` — alignment is shared from the parent.
- Default for new blocks: still single-button (`secondary` not added on creation).

### Layout (responsive via container query)

The wrapper around the button pair uses a container query so it reacts to **available width**, not viewport size. This handles the case where a Button block sits inside a narrow Column or Grid cell.

```
@container (min-width: 320px) {
    .button-pair { flex-direction: row; }
}
```

Default direction: `flex-col` (stacked). When the container is ≥320px wide, switch to `flex-row` side-by-side. Tailwind v4 supports this natively: add `@container` to the wrapper and `@[320px]:flex-row` to the inner flex element. No plugin needed (verified: project uses `tailwindcss@^4`).

**Alignment of the pair** (governed by the existing `align` field):
- `left` / `center` / `right`: pair uses `inline-flex` with `justify-content` matching alignment.
- `full`: pair stretches; each button takes 50% width on row, 100% width when stacked. Use `flex-1` on each child.

**Gap:** `gap-3` between buttons.

### Form (admin)

**File:** `clicker-platform-v2/components/admin/blocks/forms/ButtonForm.tsx`

- Below the existing fields, add a collapsible "Secondary button" section.
- Collapsed state: a single "+ Add secondary button" link.
- Expanded state (when `data.secondary` exists): same field set as primary (label, variant, linkType + conditional url/formId/page selector, openInNewTab) plus a "Remove secondary button" link that clears `data.secondary`.
- No changes to `blockDefinitions.ts` default — new blocks remain single-button.

### Rendering (public)

**File:** `clicker-platform-v2/components/blocks/public/DefaultButtonBlock.tsx`

- Extract the existing single-button render logic (the `trigger` construction) into a local `renderTrigger(buttonConfig)` helper that takes a config object and returns the `<a>` / `<Link>` / `<button>` / `<span>` node.
- If `data.secondary` is absent, render `renderTrigger(data)` as today (wrapped in `wrapperClass`).
- If `data.secondary` is present:
  - Render both triggers inside a `@container` wrapper with `flex flex-col @[320px]:flex-row gap-3`.
  - Outer wrapper handles alignment (`justify-start | justify-center | justify-end` for left/center/right; `w-full` with `flex-1` children for full).
  - Form modal state (`isModalOpen`, `formData`, etc.) needs to be tracked per-button. Add a parallel state set for the secondary button OR refactor to a small map keyed by `'primary' | 'secondary'`. Refactor preferred — cleaner.

### Form-link state refactor

Today, `isModalOpen`, `formData`, `isLoadingForm`, `formError` are single-instance state. With two buttons each potentially a form link, model state as:

```ts
type ButtonKey = 'primary' | 'secondary';
const [modalOpenFor, setModalOpenFor] = useState<ButtonKey | null>(null);
const [formDataByKey, setFormDataByKey] = useState<Partial<Record<ButtonKey, any>>>({});
const [loadingFor, setLoadingFor] = useState<ButtonKey | null>(null);
const [errorByKey, setErrorByKey] = useState<Partial<Record<ButtonKey, string>>>({});
```

The `handleFormClick` handler becomes `handleFormClick(key: ButtonKey, formId: string)`.

### Out of scope

- No third (tertiary) button. Pattern caps at two.
- No reorder UI. Primary is always first in DOM/visual order.
- No per-button alignment override.
- No migration — existing blocks just have `secondary: undefined` and render as before.

---

## Testing

### Finding 1
- Visual smoke test in Canvas Studio:
  - `cards.length === 1, columns=3` → full-width card, no empty grid columns.
  - `cards.length === 2, columns=3` → existing 2-of-3 layout (unchanged).
  - Mobile preview at count=1 → card fills viewport width with padding.

### Finding 2
- Drop a Button block, leave `secondary` absent → renders identically to today (regression check).
- Add `secondary` with a `url` link, set `align: center` → two buttons centered, side-by-side on desktop.
- Set `align: full` → two buttons each 50% width on desktop, stacked 100% on mobile.
- Drop the dual-button block inside a 2-col Columns block on desktop → buttons stack vertically (container <320px).
- Make both buttons form-links → opening primary modal doesn't affect secondary state and vice versa.

---

## Files touched

**Finding 1:**
- `clicker-platform-v2/components/blocks/public/DefaultFeatureCardsBlock.tsx` (modify)

**Finding 2:**
- `clicker-platform-v2/components/blocks/public/DefaultButtonBlock.tsx` (modify)
- `clicker-platform-v2/components/admin/blocks/forms/ButtonForm.tsx` (modify)
- Optionally: shared TS type for `ButtonData` if one exists; otherwise inline.

No DB changes, no migration, no new block type.
