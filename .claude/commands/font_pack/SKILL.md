---
name: font_pack
description: >
  Work with the Clicker Platform Font Pack system — the sole source of font choice for public
  sites. Use this skill whenever adding/removing Font Packs, registering new Google Fonts,
  modifying the Site Styles → Fonts picker, debugging font rendering issues on public/canvas
  pages, or extending the typography variable pipeline. Also use when seeing symptoms like
  "headings not changing fonts", "Figtree showing instead of pack", "--font-heading is empty
  / not defined", or any custom-property substitution failure.
  Trigger on: "font pack", "fontpack", "site styles", "SiteStylesPanel", "FontsSection",
  "FontPackCard", "lib/fonts", "lib/appearance", "defaultFontPackId", "appearance/styles",
  "ThemeRegistry", "--font-heading", "--font-body", "next/font/google", "Google Fonts",
  "typography font choice", or any work in `components/admin/blocks/panels/site-styles/`.
---

> **Architecture Reference:** Always read [`docs/ARCHITECTURE.md §8a Font Pack System`](../../../clicker-platform-v2/docs/ARCHITECTURE.md) before making changes.
>
> **Spec:** [`superpowers/specs/2026-05-18-font-packs-design.md`](../../../superpowers/specs/2026-05-18-font-packs-design.md)
>
> **Related:** When authoring **public blocks** that render text, also invoke the [`typography_system`](../typography_system/SKILL.md) skill (H1–H4 scale, color helpers).

# /font_pack — Font Pack & Site Styles System

The Font Pack system is the **sole source** of font choice for public sites. Templates do not own fonts. Sites pick a pack via Canvas Studio → Site Styles → Fonts. Admin chrome uses the system font stack and never picks up Font Pack changes.

This skill exists because the system has non-obvious invariants that caused a full day of debugging during the original build (May 2026). If you violate them, fonts will silently fall back to system-ui with no error message anywhere.

---

## Architecture (one-pager)

```
User picks pack in Canvas Studio
   ↓
sites/{siteId}/appearance/styles.fontPackId  ←  Firestore
   ↓
fetchAppearanceStyles(siteId)  ←  SSR (lib/fetchData.ts)
   ↓
ThemeRegistry resolves: site pack → template.defaultFontPackId → getDefaultPack()
   ↓
Emits :root { --font-heading: var(--font-X); --font-body: var(--font-Y) }
   ↓
globals.css consumes via [data-template] :is(h1,…) { font-family: var(--font-heading, …) !important }
```

Files at a glance:

```text
lib/fonts/
├── types.ts            FontPack, FontSlot
├── packs.ts            FONT_PACKS, KNOWN_CSS_VARS, getPackById, getDefaultPack, DEFAULT_PACK_ID
└── __tests__/packs.test.ts

lib/appearance/
├── types.ts            AppearanceStyles { fontPackId }
└── api.ts              getAppearanceStyles, setFontPackId (client SDK)

lib/fetchData.ts        fetchAppearanceStyles (SSR, client SDK pattern)

app/layout.tsx          next/font/google imports + FONT_CLASS_NAMES on <html>
                        (NOT <body> — see Critical Invariant #1)

components/ThemeRegistry.tsx
                        SSR-injects :root { --font-heading; --font-body }
                        Admin emits font vars only; public also emits brand colors + body bg

app/globals.css         [data-template] :is(h1…) / :is(p…) font-family rules
                        Body uses system-ui stack (admin chrome)

components/admin/blocks/panels/
├── SiteStylesPanel.tsx           Slide-over root (Fonts active, others coming-soon)
└── site-styles/
    ├── FontsSection.tsx          Header strip + grid + optimistic write
    ├── FontPackCard.tsx          Single pack tile, live font preview
    └── ComingSoonTile.tsx        Disabled section placeholder

components/admin/blocks/CanvasStudio.tsx
                        Wires SiteStylesPanel into slideOverPanel union + 'T' shortcut

lib/templates/types.ts             TemplateConfig.defaultFontPackId: string
lib/templates/definitions.ts       Each of 6 templates has a defaultFontPackId
```

---

## Critical Invariants (do not violate)

### 1. `next/font/google` `.variable` classNames live on `<html>`, not `<body>`

This is the single biggest gotcha. ThemeRegistry's SSR rule is `:root { --font-heading: var(--font-fraunces) }`. The `:root` selector matches `<html>`. When the browser computes `--font-heading` at `<html>`, it must substitute `var(--font-fraunces)`. **CSS custom properties inherit downward only.** If `--font-fraunces` is defined on `<body>` (which is below `<html>`), it's unreachable from `<html>`'s cascade, the substitution fails with IACVT (invalid-at-computed-value-time), and `--font-heading` reads as empty everywhere downstream. Public renders bare `system-ui`.

```tsx
// CORRECT — in app/layout.tsx
<html className={`notranslate ${FONT_CLASS_NAMES}`}>
  <body className="antialiased font-sans">
```

```tsx
// WRONG — silent fail, fonts won't apply
<html>
  <body className={`${FONT_CLASS_NAMES} antialiased font-sans`}>
```

### 2. `!important` is required on `[data-template]` typography rules

In `globals.css`, the `[data-template] :is(h1,…)` rules use `!important` to beat Tailwind v4's body cascade. Without it, Tailwind's body font (system-ui) wins because it loads later despite equal specificity.

```css
[data-template] :is(h1, h2, h3, h4, h5, h6) {
  font-family: var(--font-heading, system-ui, sans-serif) !important;
}
```

### 3. Admin chrome must never inherit Font Pack fonts

The `[data-template]` selector is the boundary. `TemplateProvider` (the only writer of `data-template`) wraps only canvas/public content, never admin chrome. The admin body inherits `font-family: system-ui, …` from the body rule. Don't add `data-template` to admin layouts.

### 4. ThemeRegistry's admin branch emits ONLY font vars

The non-admin branch also emits brand colors + body background. Keep those off admin to prevent tenant brand styling from bleeding into admin chrome.

### 5. Don't reintroduce competing font systems

Removed in May 2026 and not coming back:

- `settings.fontFamily` field on `SiteSettings` — removed.
- The "Typography" dropdown in admin Template settings — removed.
- `--font-jakarta` CSS variable + Figtree font import — removed.
- `template.config.fonts: { heading, body }` field — removed.
- ThemeRegistry's `--font-dynamic` + `<link data-font-swap>` legacy path — removed.

If you find yourself adding any of these "for backwards compatibility," stop. The Font Pack system covers all cases.

---

## Common Tasks

### Add a new Font Pack

1. **Pick the Google Fonts.** Verify both heading and body fonts exist in `next/font/google`.
2. **Import in `app/layout.tsx`** — add the font names to the import block and register each with a `--font-{slug}` CSS variable. Use a sensible weight set per the existing examples (e.g. `weight: ['400','500','600','700']` for body fonts, `weight: ['400']` for display-only fonts).
3. **Add to `FONT_CLASS_NAMES`** — append `.variable` to the joined string.
4. **Add the CSS var name to `KNOWN_CSS_VARS`** in `lib/fonts/packs.ts`.
5. **Add a `FontPack` entry** to `FONT_PACKS` array. Provide `id`, `name`, `category`, `heading`, `body`. The `cssVar` values must match what you registered.
6. **Run `pnpm test lib/fonts`** — the catalog integrity test will fail if any cssVar isn't in `KNOWN_CSS_VARS`.
7. **Build** and verify bundle size hasn't ballooned (1.5MB ceiling for total fonts is a soft guideline).

### Change a template's default Font Pack

Edit `lib/templates/definitions.ts`, find the template, change `defaultFontPackId: 'pack-id'`. No other changes needed — the test will pass as long as the id exists in the catalog.

### Add a new section to Site Styles (e.g. Colors)

The panel scaffolds Colors/Buttons/Forms as `ComingSoonTile` placeholders. To activate one:

1. Build the section component under `components/admin/blocks/panels/site-styles/` (e.g. `ColorsSection.tsx`).
2. Update `SiteStylesPanel.tsx` — extend the `View` type, add a navigation case, replace the `ComingSoonTile` with a clickable button for that section.
3. Extend `AppearanceStyles` type to include the new sub-document fields (e.g. `colorPaletteId`).
4. Mirror the Font Pack pattern: optimistic write to `sites/{id}/appearance/styles`, SSR read via `fetchAppearanceStyles`, ThemeRegistry emits the new CSS vars.

### Debugging "fonts not changing"

If the user picks a pack but rendering doesn't change, run this diagnostic in browser console **before theorizing**:

```js
// 1. Is the SSR style tag in the DOM with correct content?
const s = document.querySelector('style[data-theme-registry]');
console.log('exists:', !!s, 'count:', document.querySelectorAll('style[data-theme-registry]').length);
console.log('content:', s?.textContent);

// 2. Are the font vars actually computed at :root?
console.log('html --font-heading:', getComputedStyle(document.documentElement).getPropertyValue('--font-heading'));
console.log('body --font-heading:', getComputedStyle(document.body).getPropertyValue('--font-heading'));

// 3. Is the referenced underlying font var reachable at :root?
// (e.g. if --font-heading: var(--font-fraunces), check --font-fraunces at html)
console.log('html --font-fraunces:', getComputedStyle(document.documentElement).getPropertyValue('--font-fraunces'));
console.log('body --font-fraunces:', getComputedStyle(document.body).getPropertyValue('--font-fraunces'));
```

Interpretations:

- `style tag missing` → ThemeRegistry didn't fire SSR. Check the `if (!settings) return null` guard.
- `style content correct BUT html --font-heading empty` AND `html --font-fraunces empty BUT body --font-fraunces populated` → **Invariant #1 violation**. The font className is on `<body>` instead of `<html>`. Fix: move it.
- `html --font-heading populated` but visual rendering still wrong → check selector specificity. Look for inline `style={fontFamily: ...}` writes on the h1's ancestors, or for `!important` rules competing.
- `style content has wrong pack name` → check the SSR fetch (`fetchAppearanceStyles`) or the Firestore doc directly.

### Adding the Font Pack picker to a new admin surface

The picker is already wired into Canvas Studio. If asked to add it elsewhere (e.g. a standalone Appearance page), import `<FontsSection />` from `components/admin/blocks/panels/site-styles/FontsSection.tsx`. It's self-contained: reads `useSite()` for siteId, fetches via `getAppearanceStyles`, writes via `setFontPackId`, handles optimistic updates and rollback. Don't re-implement.

---

## Persistence model

**Firestore path:** `sites/{siteId}/appearance/styles`

**Shape:**
```typescript
type AppearanceStyles = {
  fontPackId: string | null;
};
```

**Firestore rule** (in `firestore.rules`):
```javascript
match /appearance/{docId} {
  allow read: if true;                          // SSR needs this
  allow write: if hasSiteAccess(siteId);
}
```

**Write semantics:** `setFontPackId` uses `setDoc(..., { merge: true })`. Future sub-systems (Colors, Buttons, Forms) will add fields to the same doc.

**Read semantics:** SSR via `fetchAppearanceStyles` (uses Firestore client SDK in a server context — `cache()`-wrapped, no Redis). Client-side via `getAppearanceStyles` (used by `FontsSection` for initial state).

---

## What NOT to do

- **Don't reintroduce `settings.fontFamily` or any global font setting outside Font Packs.** The point of the migration was to make Font Pack the only path. New "let user pick any Google Font" features should be added as a v2 to Font Packs (e.g. "Custom" pack), not as a parallel system.
- **Don't make templates own fonts again.** Templates only carry `defaultFontPackId`. If you find yourself adding `template.config.fonts`, you're going backwards.
- **Don't write `--font-heading` or `--font-body` from anywhere except ThemeRegistry (SSR) and `FontsSection.applyFontVarsToDocument` (optimistic preview).** Any other writer creates cascade competition that's painful to debug.
- **Don't expose all of Google Fonts at runtime.** `next/font/google` is build-time. Adding a runtime `<link>` injection for arbitrary fonts would resurrect the legacy `--font-dynamic` path.
- **Don't move `next/font` classNames back to `<body>`.** See Invariant #1.

---

## Memory references

- `feedback_css_var_reachability_at_root` — Why `:root { --x: var(--y) }` silently fails when `--y` lives below `<html>`. Includes the 5-line diagnostic that nails it.
- `feedback_grep_existing_css_var_writers` — Always grep for existing writers before introducing a new CSS variable; inline-style writers beat `:root` rules by specificity.
