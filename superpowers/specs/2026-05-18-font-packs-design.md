# Font Packs in Canvas Studio — Design Spec

**Date:** 2026-05-18
**Status:** Approved (brainstorm), pending implementation plan
**Author:** Brainstorm session with Andre

---

## Summary

Introduce a curated **Font Pack** system (heading + body pairs from Google Fonts) accessed through a new **Site Styles** panel inside Canvas Studio. Move font configuration out of template definitions and into a site-level appearance document. First slice ships Fonts only; the Site Styles panel scaffolds future Colors / Buttons / Forms sections as visible "coming soon" tiles.

---

## Motivation

Today, fonts live inside `lib/templates/definitions.ts` — each template hardcodes its own `{ heading, body }`. Users cannot change fonts without switching templates entirely. This conflicts with the platform's architectural direction (memorized 2026-04-05): **template = tokens only, Block Builder owns layout**. Fonts are tokens — they belong to the site, not the template.

Squarespace's "Recommended Font Packs" UI is the reference: a grid of heading+body pairings the user can swap independently of the broader template.

---

## Scope (First Slice)

**In scope:**
- New "Site Styles" slide-over panel in Canvas Studio.
- Fonts sub-section: Font Pack picker (grid of curated packs).
- Curated library of ~24–30 Google Font packs, statically registered.
- Site-level storage for selected `fontPackId`.
- Public renderer consumes the selection via CSS variables.
- Migration: existing templates fall back to a default pack when no `fontPackId` is set.

**Out of scope (deferred):**
- Colors / Buttons / Forms sections in Site Styles (rendered as disabled "coming soon" tiles).
- Per-page or per-block font overrides.
- User-uploaded fonts or "bring your own Google Font".
- Monospace font selection (stays hardcoded as JetBrains Mono or system mono).
- Removing the `fonts` field from `lib/templates/definitions.ts` (kept as *default suggestion* for first-time setup; full removal is a follow-up cleanup).

---

## Key Constraints

### Build-time font loading

`next/font/google` resolves fonts at **build time**, not runtime. Every font in the library must be statically imported in `app/layout.tsx`. This is a feature, not a bug:

- Self-hosted, zero CLS, no Google CDN runtime dependency.
- Curated set = design-vetted, no Comic Sans accidents.
- Tradeoff: adding a new pack requires a code deploy (~quarterly cadence is fine).

The existing runtime `<link>` injection in `ThemeRegistry.tsx` (lines 22–34) is **legacy** — it loads arbitrary Google Fonts via `fonts.googleapis.com`. Font Packs do **not** use this path. We leave the legacy code in place for now (don't break existing sites that rely on `settings.fontFamily`), but Font Packs override it when set.

### Font Pack data shape

```ts
type FontPack = {
  id: string;                  // 'editorial-serif'
  name: string;                // 'Editorial Serif'
  description?: string;        // 'Classic, magazine-style'
  category: 'serif' | 'sans' | 'display' | 'mixed';
  heading: {
    family: string;            // 'Playfair Display'
    cssVar: string;            // '--font-playfair'
    weights: number[];         // [400, 700, 900]
  };
  body: {
    family: string;
    cssVar: string;
    weights: number[];
  };
};
```

The catalog lives in `lib/fonts/packs.ts` as a frozen array. Adding a pack means:
1. Add the `next/font/google` import in `app/layout.tsx` with a stable `--font-{slug}` CSS variable.
2. Add a `FontPack` entry to `packs.ts`.
3. Deploy.

---

## Architecture

### Storage

Site-level appearance doc:

```
sites/{siteId}/appearance/styles
{
  fontPackId: 'editorial-serif',  // null = use template default
  // future: colorPaletteId, buttonStyleId, formStyleId
}
```

A single `styles` doc (not per-axis docs) keeps reads cheap and writes atomic.

### Read path

1. Server: `fetchSiteSettings(siteId)` already loads site data — extend to include `appearance.styles`.
2. `ThemeRegistry` reads `fontPackId`, resolves to the pack's `heading.cssVar` / `body.cssVar`, and emits:
   ```css
   :root {
     --font-heading: var(--font-playfair);
     --font-body: var(--font-source-sans);
   }
   ```
3. Templates and blocks consume `--font-heading` / `--font-body` (not the underlying `--font-playfair`). This is the indirection that lets Font Packs override template fonts cleanly.

### Write path (Canvas Studio)

1. User opens Canvas Studio → clicks "Site Styles" button (paintbrush icon) in the top toolbar, next to the device-view toggles.
2. Slide-over panel opens from the right (z-40 per memory `feedback_slideover_zindex`, width matches existing properties sidebar at ~380px), showing sections: **Fonts** (active), Colors / Buttons / Forms (disabled, "Coming soon" tile).
3. User clicks Fonts → enters Fonts sub-view: header strip showing the active pack name plus a "Reset to template" button, followed by a **single-column, full-width** list of Font Pack cards.
4. Clicking a pack:
   - **Optimistic update**: immediately swaps `--font-heading` / `--font-body` CSS vars on the canvas preview root (no React re-render needed). No hover preview — selection commits on click. **No "Apply" button** — the click *is* the apply (Squarespace pattern).
   - **Persists**: writes `fontPackId` to `sites/{siteId}/appearance/styles`.
5. Selected pack is highlighted with a **ring border + checkmark badge** (see Active state indicator below).

### Active state indicator

The active pack card uses two non-color signals stacked so it remains identifiable for users with color-vision deficiency (WCAG 1.4.1):

- **2px ring border** in brand accent color around the card.
- **Checkmark badge** (small filled circle with ✓) anchored top-right of the card.

Inactive cards have a 1px subtle gray border. The card's sample area (heading + body text) stays on a neutral surface in both states so the font preview itself isn't distorted by a tinted background.

The Fonts sub-view header strip (showing the active pack name plus a "Reset to template" button) only renders when `fontPackId !== null`. When no pack is set (template default in use), the header strip collapses and the grid scrolls to the top of the catalog.

### Preview behavior (three levels)

The word "preview" appears at three distinct levels in this feature:

1. **In-card preview** (always on): each `FontPackCard` renders "Heading" + "This is your paragraph." in the pack's real fonts on mount. Static — never changes. This is the "browse the catalog" view.
2. **Canvas preview** (on click): when the user clicks a card, the canvas iframe root's `--font-heading` / `--font-body` CSS variables swap to the selected pack's variables. The currently-edited page repaints instantly — all H1s, paragraphs, buttons, nav, etc. update because they consume `var(--font-heading)` / `var(--font-body)`. Firestore write fires in the background; toast on failure.
3. **Public site** (after save): next page load reads `fontPackId` from `sites/{id}/appearance/styles` and emits the same CSS variables via SSR. No client-side flicker.

### Scope of the selection

Site Styles is **global** — the selected Font Pack persists across all pages of the site. If a user opens Site Styles while editing Home, picks a pack, then navigates to About in Canvas Studio, About also shows the new pack (both pages share `--font-heading` / `--font-body`). There is no per-page font override in this slice.

### UI wireframe — Fonts sub-view

```
                                ┌──────────────────────────────┐
                                │ ← Fonts                  ✕   │
                                ├──────────────────────────────┤
                                │ Active: Modern Geometric     │
                                │ [ Reset to template ]        │
                                ├──────────────────────────────┤
                                │ ┌──────────────────────────┐ │
┌───────────────────────┐       │ │  Heading                 │ │
│                       │       │ │  This is your paragraph. │ │
│   Canvas preview      │       │ │  Inter / Inter Tight     │ │
│   (live, updates on   │       │ └──────────────────────────┘ │
│   pack click)         │       │ ┌──────────────────────────┐ │
│                       │       │ │  Heading                 │ │ ← active
│                       │       │ │  This is your paragraph. │ │   (ring)
│                       │       │ │  Outfit / DM Sans        │ │
│                       │       │ └──────────────────────────┘ │
│                       │       │ ┌──────────────────────────┐ │
│                       │       │ │  Heading                 │ │
│                       │       │ │  This is your paragraph. │ │
│                       │       │ │  Playfair Display / Lora │ │
│                       │       │ └──────────────────────────┘ │
│                       │       │           ⋮ (scroll)         │
└───────────────────────┘       └──────────────────────────────┘
```

**Layout rationale (1 column, full-width):** Display fonts (Archivo Black, Fraunces, Playfair Display) need ~340px of card width to render the "Heading" sample at a meaningful size (28–32px). A 2-column grid in the ~380px slide-over leaves each card at ~165px — too cramped for display fonts to show their character. 8 cards in 1 column scrolls in ~2 viewport heights, which is acceptable. A future "browse all" view (30+ packs) can use a full modal with a 3–4 column grid.

### Card preview rendering

Card previews use **real fonts via CSS variables**, not pre-rendered images. Each `FontPackCard` is two `<div>`s:

```tsx
<div style={{ fontFamily: `var(${pack.heading.cssVar})`, fontWeight: 700, fontSize: 32 }}>
  Heading
</div>
<div style={{ fontFamily: `var(${pack.body.cssVar})`, fontWeight: 400, fontSize: 14 }}>
  This is your paragraph.
</div>
```

Why real fonts (not images):

- Always in sync with the catalog — swap a pack's body font and previews update automatically.
- No asset pipeline (no PNGs, retina variants, dark/light versions, or CDN).
- Sharp at any size; semantic; selectable; i18n-ready.
- All pack fonts are already statically imported in `app/layout.tsx` for the public renderer — using them in Canvas Studio costs nothing extra at runtime.

**Cost acknowledgement:** the admin Canvas Studio bundle eagerly loads all 13 pack font families (not just the active site's pack) so the picker can render live previews. This is intentional and acceptable — admin bundle size is a less sensitive budget than public-site bundle size, and the alternative (lazy-loading fonts per card hover) would add complexity and FOUT flicker in the picker.

### Template migration

- Templates keep their `fonts: { heading, body }` field for now (used as the *implicit default* when `fontPackId` is null).
- On first save of a Font Pack, the site's `fontPackId` overrides the template default permanently — even if the user later switches templates.
- Future cleanup: replace each template's `fonts` with a `defaultFontPackId: string` reference. Out of scope for this slice.

---

## UI Components (New)

| Component | Path | Purpose |
|-----------|------|---------|
| `SiteStylesPanel` | `components/admin/canvas/SiteStylesPanel.tsx` | Slide-over container, section nav, z-40 |
| `FontsSection` | `components/admin/canvas/site-styles/FontsSection.tsx` | Renders the Font Pack grid |
| `FontPackCard` | `components/admin/canvas/site-styles/FontPackCard.tsx` | Single pack tile (heading + body sample) |
| `ComingSoonTile` | `components/admin/canvas/site-styles/ComingSoonTile.tsx` | Disabled section placeholder |

### Canvas Studio toolbar

Add a Site Styles button (paintbrush icon, matching screenshot) next to existing device-view toggle buttons.

---

## Curated Library (Starter Set: 8 Core + 4 Optional)

**Sizing rationale:** 8–12 packs at launch (not 24+). Each pack adds 15–40KB per weight to the build's font bundle, and decision fatigue is a real cost for SMB users. Adding pack #13 later is a trivial PR — start focused, expand on usage data.

**Core 8 (ship at launch):**

|#|Pack name|Heading|Body|
|-|-|-|-|
|1|Clean Minimal|Inter|Inter Tight|
|2|Modern Geometric|Outfit|DM Sans|
|3|Editorial Serif|Playfair Display|Lora|
|4|Modern Magazine|Fraunces|Inter|
|5|Bold Display|Archivo Black|Archivo|
|6|Brutalist|Space Grotesk|Inter|
|7|Warm Friendly|DM Serif Display|DM Sans|
|8|Rounded Soft|Quicksand|Montserrat|

**Optional 4 (add if bundle budget allows, or defer to v1.1):**

- Humanist — Nunito / Nunito
- Tech Mono-flavored — IBM Plex Sans / IBM Plex Mono
- Bookish — Lora / Lato
- Swiss — Work Sans / Work Sans

**Unique families to register in `app/layout.tsx` for the core 8:**
Inter, Inter Tight, Outfit, DM Sans, Playfair Display, Lora, Fraunces, Archivo, Archivo Black, Space Grotesk, DM Serif Display, Quicksand, Montserrat — 13 families total. (Inter and DM Sans appear in multiple packs but are imported once.)

---

## Data Flow Summary

```
User selects pack in Canvas Studio
   ↓
Write fontPackId to sites/{id}/appearance/styles  ←  Firestore
   ↓
Optimistic CSS var swap on canvas root  →  Preview updates instantly
   ↓
Next page load: ThemeRegistry reads styles doc
   ↓
Emits :root { --font-heading: var(--font-X); --font-body: var(--font-Y); }
   ↓
Templates/blocks consume --font-heading / --font-body
```

---

## Error Handling

- **Unknown `fontPackId`** (deleted pack, stale data) → fall back to template default fonts. Log warning to Sentry; no user-facing error.
- **Firestore write fails** → revert optimistic CSS swap, show toast: "Couldn't save font choice. Try again."
- **Pack import missing in `app/layout.tsx`** (registry/import drift) → CSS var is undefined, browser falls back to `serif`/`sans-serif`. Add a build-time guard: a unit test that asserts every `FontPack.heading.cssVar` and `body.cssVar` resolves to a known `next/font` variable.

---

## Testing

- **Unit**: `packs.ts` catalog integrity — every pack's `cssVar` exists in the layout imports.
- **Unit**: `SiteStylesPanel` renders disabled tiles for non-Fonts sections.
- **Integration**: Selecting a pack in Canvas Studio writes the correct doc and updates the preview CSS var (test via a stubbed canvas root).
- **Public render check** (per memory `feedback_test_public_path`): after writing `fontPackId`, load the public site and confirm `--font-heading` / `--font-body` resolve correctly via SSR — not just in the admin preview.

---

## Migration / Rollout

1. Ship behind no flag — additive, doesn't break existing sites (templates still carry their `fonts` field as fallback).
2. Seed `sites/{id}/appearance/styles` lazily on first Font Pack selection. No backfill needed.
3. Legacy `settings.fontFamily` + runtime `<link>` injection in `ThemeRegistry` stays untouched. Font Packs take precedence when set; `fontFamily` continues to work for sites that never use Font Packs.

---

## Open Questions (deferred to implementation plan)

- Exact final pack list (design review).
- Should the Font Pack picker show a "Reset to template default" affordance? (Probably yes; trivial to add.)
- Where does the Site Styles button live in the Canvas toolbar exactly — left rail, top bar, or floating? (Reference screenshot suggests top-right, next to device-view toggle.)

---

## Files Touched (Estimated)

**New:**
- `lib/fonts/packs.ts` — catalog
- `components/admin/canvas/SiteStylesPanel.tsx`
- `components/admin/canvas/site-styles/FontsSection.tsx`
- `components/admin/canvas/site-styles/FontPackCard.tsx`
- `components/admin/canvas/site-styles/ComingSoonTile.tsx`
- `lib/appearance/api.ts` — read/write `sites/{id}/appearance/styles`

**Modified:**
- `app/layout.tsx` — add `next/font/google` imports for ~24 new families
- `components/ThemeRegistry.tsx` — read appearance doc, emit `--font-heading` / `--font-body`
- `lib/fetchData.ts` — include `appearance.styles` in `fetchSiteSettings`
- Canvas Studio toolbar component — add Site Styles button
- Templates — switch hardcoded font references to `var(--font-heading)` / `var(--font-body)` where they don't already

**Unchanged (explicitly):**
- `lib/templates/definitions.ts` `fonts` field (kept as default fallback)
- Legacy `settings.fontFamily` runtime injection in `ThemeRegistry`

---

## Success Criteria

- A user on any template can swap to any Font Pack via Canvas Studio in <3 clicks.
- Selection persists across sessions and reflects on the public site.
- Selection survives a template switch.
- No CLS or FOUT (verified via Lighthouse before/after).
- Disabled Colors / Buttons / Forms tiles communicate the future direction without false promises.
