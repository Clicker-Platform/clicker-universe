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

1. User opens Canvas Studio → clicks "Site Styles" button in toolbar.
2. Slide-over panel opens (z-40 per memory `feedback_slideover_zindex`), showing sections: **Fonts** (active), Colors / Buttons / Forms (disabled, "Coming soon" tile).
3. User clicks Fonts → grid of Font Pack cards (heading sample + body sample, matching Squarespace screenshot).
4. Clicking a pack:
   - **Optimistic update**: immediately swaps `--font-heading` / `--font-body` CSS vars on the canvas preview root (no React re-render needed).
   - **Persists**: writes `fontPackId` to `sites/{siteId}/appearance/styles`.
5. Selected pack is highlighted in the grid.

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

## Curated Library (Initial ~24 Packs)

Categories and sample picks (final list to be design-reviewed before code):

**Serif-led editorial**
- Editorial Serif — Playfair Display / Source Sans Pro
- Modern Magazine — Fraunces / Inter
- Bookish — Lora / Lato

**Sans-led modern**
- Clean Minimal — Inter / Inter
- Geometric — Poppins / Poppins
- Swiss — Work Sans / Work Sans
- Humanist — Nunito / Nunito

**Display + body pairs**
- Bold Display — Archivo Black / Archivo
- Brutalist — Space Grotesk / Space Mono
- Editorial Bold — Bricolage Grotesque / Inter

**Friendly / approachable**
- Rounded — Quicksand / Open Sans
- Warm — DM Serif Display / DM Sans

**Tech / mono-flavored**
- Monospace — JetBrains Mono / JetBrains Mono
- Code-adjacent — IBM Plex Sans / IBM Plex Mono

(Final pack curation happens during implementation; this is illustrative.)

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
