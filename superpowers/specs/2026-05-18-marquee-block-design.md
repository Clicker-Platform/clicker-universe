# Marquee Block — Design Spec

**Date:** 2026-05-18
**Status:** Approved (design)
**Owner:** Andre

---

## 1. Purpose & Scope

A new public block type that displays a horizontally-scrolling row of **icon + label** items, looping infinitely. Used to surface short, high-signal facts (mini key-facts, trust signals, value props).

**Reference:** `100% ONLINE` · `CLEAR PRICING` · `SHIPPED TO YOUR DOOR` · `LICENSED MEDICAL PROVIDERS` style strips.

**Out of scope:**
- Clickable items (no links, no CTAs)
- Image marquees / logo clouds (icons only)
- Multi-row marquees (single row only)
- Dynamic data sources (static admin-curated items only)
- RTL/language support beyond the simple direction toggle

---

## 2. Data Model

Stored under the block's `data` field in Firestore (within the page's blocks array — no new collection, no Firebase Storage uploads).

```ts
type MarqueeBlockData = {
  items: MarqueeItem[];            // 1..N items, admin-ordered
  speed: 'slow' | 'normal' | 'fast';     // -> 45s / 30s / 18s
  direction: 'left' | 'right';     // visual scroll direction
  iconSize: 'sm' | 'md' | 'lg';    // -> 16 / 20 / 24 px (label text size couples)
  itemGap: 'tight' | 'normal' | 'loose'; // -> 32 / 48 / 72 px
  color: ColorToken;               // typography color token (theme-driven)
};

type MarqueeItem = {
  id: string;                      // stable id for sortable + react keys
  label: string;                   // short text, recommended <30 chars
  icon:
    | { kind: 'lucide'; name: string }   // from existing IconSelector set
    | { kind: 'svg'; svg: string };      // raw SVG markup, sanitized at render
};
```

Pause-on-hover, mask fade width, and duplication count are **constants in the renderer**, not stored.

---

## 3. Component Structure

```
components/blocks/public/DefaultMarqueeBlock.tsx              # public renderer
components/admin/blocks/panels/MarqueePropertiesPanel.tsx     # admin form
lib/sanitizeSvgIcon.ts                                        # SVG sanitizer (new)
```

The public renderer is expected to be a single component using only CSS for animation + hover pause. No client-side JS required for the animation. If hover pause requires a wrapper variant on certain browsers, a small client wrapper can be added during implementation.

---

## 4. Animation & Visual Mechanics

### Keyframes

Defined globally (or in a CSS module imported by the renderer):

```css
@keyframes marquee-left  { from { transform: translateX(0); } to { transform: translateX(-50%); } }
@keyframes marquee-right { from { transform: translateX(-50%); } to { transform: translateX(0); } }
```

Translating by `-50%` (not `-100%`) is the seamless-loop trick: items are rendered **twice** (`[...items, ...items]`) inside a flex track of width `max-content`. After translating by half the track width, the visual position is identical to the start, so the loop restarts invisibly.

### Speed map

| Preset | Duration |
|--------|----------|
| slow   | 45s      |
| normal | 30s      |
| fast   | 18s      |

Linear easing, infinite iteration.

### Direction

Picks the keyframe (`marquee-left` vs `marquee-right`).

### Pause on hover (desktop)

```css
.marquee-wrapper:hover .marquee-track { animation-play-state: paused; }
```

No-op on touch devices (no hover state).

### Mask fade

Container CSS:

```css
mask-image:         linear-gradient(to right, transparent 0, black 48px, black calc(100% - 48px), transparent 100%);
-webkit-mask-image: linear-gradient(to right, transparent 0, black 48px, black calc(100% - 48px), transparent 100%);
```

Fixed 48px gutters on both edges. Not configurable.

### Reduced motion

```css
@media (prefers-reduced-motion: reduce) {
  .marquee-track { animation: none; transform: none; }
}
```

Items render statically — still readable, just not scrolling.

---

## 5. Icon Rendering

Each item dispatches on `item.icon.kind`:

### `lucide` icons

Rendered via the existing Lucide icon renderer paired with `IconSelector` (`components/admin/IconSelector.tsx`). Uses `currentColor` for stroke — themes naturally with the `color` data field.

### `svg` icons (paste from lucide.dev or similar)

Raw SVG markup, rendered inline as real SVG **after sanitization**. Sanitization runs **on render**, not on save (cheap, lets admins edit pasted markup freely).

A new module `lib/sanitizeSvgIcon.ts` exports:

```ts
export function sanitizeSvgIcon(input: string): string;
```

Rules:

1. **Allowed tags only:** `svg, g, path, circle, rect, line, polyline, polygon, ellipse, defs, linearGradient, radialGradient, stop, mask, clipPath, use, title`.
2. **Allowed attributes only:** standard SVG geometry (`d, cx, cy, r, rx, ry, x, y, x1, y1, x2, y2, points, width, height`), `viewBox`, `fill`, `stroke`, `stroke-width`, `stroke-linecap`, `stroke-linejoin`, `xmlns`, `class`, `transform`, `opacity`, `offset`, `stop-color`.
3. **Strip:** all `on*` event handlers, `script` tags, `style` tags/attrs, `href` and `xlink:href` (no external refs), any tag/attr not on the allowlist.
4. **Normalize color:** any `stroke` or `fill` attribute with a non-`currentColor`/non-`none` value is rewritten to `currentColor`. Applied recursively to the root `<svg>` and all descendants. (Lucide's "Copy SVG" output uses `currentColor` already; this normalization makes pastes from Heroicons / Tabler / hand-edited SVGs theme correctly too.)
5. **Force sizing:** set `width="1em"` and `height="1em"` on the root `<svg>` so the icon sizes from font-size (which the iconSize tier controls).
6. **Validation:** input that doesn't contain a valid `<svg>` root returns an empty string (renderer falls back to a placeholder).

Implementation uses `isomorphic-dompurify` (already in the stack via `lib/sanitizeHtml.ts`) with a dedicated SVG-only config — **not** the existing rich-text sanitizer, which disallows `<svg>`.

The renderer injects the sanitized markup using React's inline-HTML mechanism wrapped in a tiny `<SafeSvgIcon svg={sanitized} />` component, isolating the unsafe API to one well-tested call site.

---

## 6. Admin Form (Properties Panel)

Right-panel form following existing panel patterns (e.g. `HeaderNavPanel`).

### Items section

- Sortable list (reuse the `SortableNavItem` pattern from header nav).
- Each row shows:
  - Drag handle
  - Icon preview (renders current icon at small size)
  - Inline text input for label
  - **Icon picker button** -> opens a popover with two tabs:
    - **Pick** — existing `IconSelector` (bundled Lucide set)
    - **Paste SVG** — multiline textarea + live preview of the sanitized SVG. "Clear" button to reset to a default lucide icon.
  - Delete button
- **"Add item"** button at the bottom of the list.

### Layout & motion section

| Control     | Type               | Options                            |
|-------------|--------------------|------------------------------------|
| Speed       | Segmented control  | Slow / Normal / Fast               |
| Direction   | Segmented control  | Left / Right                       |
| Icon size   | Segmented control  | Sm / Md / Lg                       |
| Item gap    | Segmented control  | Tight / Normal / Loose             |

### Color

Color token picker (the theme-aware text color picker used by other blocks). Drives both icon stroke and label color via `currentColor`.

### Empty state

When `items.length === 0`, canvas renders `EmptyBlockHint` with copy prompting the admin to add the first item.

---

## 7. Block Registration (3-way parity)

Per the `clicker_platform_core` 3-way rule:

1. **Type/schema:** add `'marquee'` to the BlockType union and `MarqueeBlockData` to the block-data discriminated union.
2. **Public renderer:** register `DefaultMarqueeBlock` in the public block renderer map.
3. **Admin:** register `MarqueePropertiesPanel` in the admin panel map; add a default-data factory (1 starter item, `speed: 'normal'`, `direction: 'left'`, `iconSize: 'md'`, `itemGap: 'normal'`, default color token); add the block to the "Add block" picker with icon, label, and the "Content" or "Visual" category.

---

## 8. Testing

Following the existing patterns in `components/blocks/public/__tests__/`:

- **Snapshot test** for `DefaultMarqueeBlock` rendering a mix of lucide + svg items.
- **Sanitizer unit tests** for `sanitizeSvgIcon`:
  - Strips `<script>` and inline `on*` handlers
  - Strips `href` / `xlink:href`
  - Preserves Lucide-shaped paste structurally intact
  - Normalizes hardcoded `stroke="#000000"` / `fill="#000"` -> `currentColor`
  - Forces `width="1em" height="1em"` on root
  - Returns empty string for non-SVG input
- **Admin panel test** — add item, remove item, reorder, switch icon kind from `lucide` -> `svg` and back.
- **Public-path smoke test** (per `feedback_test_public_path` memory): manual verification on a SSR'd public page, not just admin preview. Specifically verify mask fade, animation, and hover pause on desktop.

---

## 9. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| SVG XSS via pasted markup | Dedicated allowlist sanitizer (section 5). No `script`, no event handlers, no external refs. Sanitize on render — old data stays safe if rules harden. |
| Performance with many items | Auto-duplication doubles node count (e.g. 50 -> 100). Negligible. Animation is GPU-composited (transform only). |
| Layout shift on first paint | Track uses `width: max-content`; stable once items render. No CLS expected. |
| Safari mask compat | Dual `-webkit-mask-image` + `mask-image` declared. Verified on Safari 14+. |
| Pasted SVG doesn't theme | Color normalization in sanitizer rewrites non-`currentColor` stroke/fill values. |

---

## 10. Effort Estimate

~4–6 hours.

| Task | Time |
|---|---|
| Schema + types + registry wiring (3-way parity) | 30 min |
| `DefaultMarqueeBlock` renderer + CSS keyframes + mask | 1h |
| `sanitizeSvgIcon` + unit tests | 1h |
| `MarqueePropertiesPanel` (sortable items + dual-mode icon picker popover) | 2h |
| Public-site smoke test, value tweaking (mask gutter, speed durations, gap values) | 30–60 min |

---

## Decisions Locked During Brainstorm

| Decision | Value |
|---|---|
| Item content model | Icon + label only (no link, no sublabel) |
| Icon source | Bundled Lucide picker + per-item Paste SVG escape hatch |
| SVG storage | Inline string in Firestore block data (no Firebase Storage) |
| Speed presets | 3 (Slow / Normal / Fast) |
| Direction | Configurable (left or right) |
| Pause on hover | Always on (desktop) |
| Form controls | Color, icon size, item spacing (background/border inherited from parent) |
| Seamless loop | Auto-duplicate items in renderer |
| Mask fade | Fixed 48px gutters, always on |
