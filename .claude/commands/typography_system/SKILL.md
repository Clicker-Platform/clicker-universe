---
name: typography_system
description: >
  Enforce the Canvas Studio block typography system (H1–H4 scale, color helpers, prose adoption, no-hardcoded-colors rule).
  Use this skill whenever authoring or modifying a public block component, adding a new block type, or reviewing block visuals for consistency.
  Trigger on: any work in components/blocks/public/, components/blocks/mrb/, when adding/editing block forms or rendering, "typography", "heading size", "font weight", "text color", "block styling", "prose", "leading", "tracking".
---

> **Source of truth:** [`superpowers/specs/2026-05-16-block-typography-system.md`](../../../superpowers/specs/2026-05-16-block-typography-system.md). This skill is the working checklist. If anything here conflicts with the spec, the spec wins.

---

## Why this skill exists

Before 2026-05-16 the block system had no shared typographic foundation: every block reinvented sizes, weights, colors, and font-family logic. The audit ([notes/2026-05-16-typography-audit.md](../../../superpowers/notes/2026-05-16-typography-audit.md)) documented 10 categories of drift. This skill prevents reintroducing them.

---

## The Token Quick Reference

```
HEADINGS  (use constants from components/blocks/public/typography.ts)
  H1          text-4xl md:text-6xl   font-extrabold  leading-tight  tracking-tight     (Display — Hero title)
  H2          text-3xl md:text-4xl   font-bold       leading-tight  tracking-tight     (Section title — FAQ, FeatureCards, ContentShowcase row, Featured Product name)
  H3          text-xl  md:text-2xl   font-semibold   leading-snug                       (Full-width card title — FAQ question, branch name)
  TILE_TITLE  text-sm  md:text-base  font-semibold   leading-tight                      (Dense n-up grid title — QuickActions tiles, Products tiles, LinkCard)
  H4          text-xs  md:text-sm    font-bold       leading-normal tracking-[0.2em]    (Label/eyebrow — always uppercase)

BODY
  body-lg  text-lg    font-normal  leading-normal     (Hero subtitle, lead)
  body     text-base  font-normal  leading-normal     (Standard)
  body-sm  text-sm    font-normal  leading-normal     (Captions, secondary, price, address)
  prose    via shared proseConfig                      (Rich text only: TextBlock, ContentShowcase row, FAQ answer)

COLORS  (helpers from components/blocks/public/cardStyles.ts — return color strings for inline style)
  getHeadingColor(cardStyle, theme)   ← H1, H2, H3
  getBodyColor(cardStyle, theme)      ← body, body-lg
  getMutedColor(cardStyle, theme)     ← body-sm, captions, secondary
  getLabelColor(cardStyle, theme)     ← H4
  getAccentColor(theme)               ← links, CTAs, primary buttons

FONT FAMILY  (global CSS, never inline)
  var(--font-heading) ← applied via global rule to h1–h6
  var(--font-body)    ← applied via global rule to body/p
```

---

## Decision Table — Which H-Tier?

When adding or editing a block, map each heading element to a tier:

| Block element | Tier |
|---|---|
| Hero / page-level display title | **H1** |
| Block section title (e.g., "FAQ", "Our Products", "Operating Hours") | **H2** if visually dominant, **H4** if it's a small eyebrow |
| Featured Product name, FeatureCards section title, ContentShowcase row heading, Form heading | **H2** |
| Full-width card title (FAQ question, branch name, FeatureCards card headline) | **H3** |
| Title in a dense `n`-up grid (QuickActions tile, Products tile, LinkCard inside QuickActions list) | **TILE_TITLE** |
| Eyebrow / small label (Hero tagline, "MAIN LOCATION", category label, "PRODUCTS" small heading) | **H4** |

**H3 vs TILE_TITLE:** if the card stretches full container width with horizontal room (FAQ accordion, branch row), use H3. If it sits in a grid where multiple tiles share row width (≤180px each), use TILE_TITLE — otherwise H3 wraps mid-word and breaks layout. Confirmed empirically post-Phase 2c.

**Rule:** Pick the tier by semantic role, not by visual desire. If the visual feels wrong AND the role is right, the spec has a gap — file it rather than override locally.

---

## Forbidden Patterns

### ❌ Hardcoded text colors

```tsx
<h2 className="text-slate-400 text-xs">Social</h2>           // ❌
<p className="text-gray-500">caption</p>                     // ❌
<span className="text-white">on glass</span>                 // ❌
<div style={{ color: '#333' }}>...</div>                     // ❌
```

### ✅ Theme-token helpers

```tsx
import { getHeadingColor, getMutedColor } from '../cardStyles';
import { H2, BODY_SM } from '../typography';

<h2 className={H2} style={{ color: getHeadingColor(cardStyle, theme) }}>Social</h2>
<p className={BODY_SM} style={{ color: getMutedColor(cardStyle, theme) }}>caption</p>
```

### ❌ Inline fontFamily

```tsx
<h3 style={{ fontFamily: theme.fonts.heading }}>...</h3>     // ❌ Never.
```

### ✅ Inherit from global CSS

```tsx
<h3 className={H3} style={{ color: getHeadingColor(cardStyle, theme) }}>...</h3>
// font-family flows from `h3 { font-family: var(--font-heading) }` in globals.css
```

### ❌ Per-cardStyle typographic branching

```tsx
const isBold = theme.cardStyle === 'brutalist';
<h2 className={isBold ? 'text-3xl font-black uppercase tracking-wider' : 'text-2xl font-bold'}>     // ❌
```

### ✅ One scale, color/surface varies via helpers

```tsx
<h2 className={H2} style={{ color: getHeadingColor(cardStyle, theme) }}>...</h2>
```

cardStyle still varies card **surface** (bg, border, glass effect) via `getCardClasses()` / `getGlassStyle()`. It does **not** vary headings/body typography in this phase.

### ❌ Non-responsive headings

```tsx
<h2 className="text-3xl font-bold">...</h2>                  // ❌ no md:
```

### ✅ All headings scale

```tsx
<h2 className={H2}>...</h2>                                  // H2 already encodes `text-3xl md:text-4xl`
```

### ❌ Auto-uppercase buttons

```tsx
<button className="uppercase tracking-wider font-black">CLICK</button>     // ❌
```

### ✅ User controls caps; buttons stay neutral

```tsx
<button className="text-sm md:text-base font-semibold" style={{ color: getAccentColor(theme) }}>Click</button>
```

If the user wants caps, they type "CLICK" in the label field.

### ❌ Inventing line-height

```tsx
<p className="text-base leading-[1.65]">paragraph</p>        // ❌ unless inside prose
```

### ✅ Default normal; prose has its own

```tsx
<p className={BODY}>paragraph</p>                            // leading-normal
<div className={proseClass}>{html}</div>                     // leading-[1.65] inside prose
```

---

## When Adding a New Block

1. **Read the spec** — [`specs/2026-05-16-block-typography-system.md`](../../../superpowers/specs/2026-05-16-block-typography-system.md) §12 token summary.
2. **Map each text element to a tier** — use the Decision Table above.
3. **Import constants** — `import { H1, H2, H3, H4, BODY, BODY_LG, BODY_SM } from '../typography';`
4. **Import color helpers** — `import { getHeadingColor, getBodyColor, getMutedColor, getLabelColor, getAccentColor } from '../cardStyles';`
5. **For rich text** — import `proseClass` from `../proseConfig` (or `proseGlassClass` for glass surfaces). Do NOT roll your own prose styling.
6. **Never** add inline `fontFamily`, raw Tailwind color classes (`text-*-500`), or hex `style={{ color: '#...' }}`.
7. **Buttons** — `font-semibold`, no uppercase, no `tracking-wider`. Color via `getAccentColor()` for primary.
8. **Responsive scaling is mandatory** — all heading tiers already encode `md:` breakpoints. If you're tempted to write `text-3xl` without an `md:`, you're doing it wrong.

---

## When Reviewing an Existing Block

Quick checklist:

- [ ] All headings use H1/H2/H3/H4 constants (or equivalent classes)
- [ ] No `text-slate-*`, `text-gray-*`, `text-white`, `text-black`, etc. in JSX
- [ ] No `style={{ fontFamily: ... }}`
- [ ] No `style={{ color: '#hex' }}` (allowed: `var(--theme-*)` and helper return values)
- [ ] No `isBold ? ... : ...` ternaries on size/weight/tracking (cardStyle should not branch typography)
- [ ] Rich text uses shared prose config, not ad-hoc styling
- [ ] Headings scale on mobile (`text-* md:text-*`)
- [ ] Buttons don't auto-uppercase

Grep helpers to run from `clicker-platform-v2/`:

```bash
# Hardcoded Tailwind colors in block files
grep -rE "text-(slate|gray|neutral|zinc|stone|white|black|red|green|blue|yellow|orange|pink|purple|indigo)-[0-9]" components/blocks/public components/blocks/mrb

# Inline fontFamily
grep -rE "fontFamily:\s*theme\.fonts" components/blocks/

# Old getTextColor calls (post-migration should be zero)
grep -rE "getTextColor\(" components/blocks/
```

All three should return zero hits in a clean codebase.

---

## MRB Override Policy

MRB **shares the Default scale**. MRB differentiation comes from:
- Theme tokens (`--font-heading`, `theme.colors.*`)
- `cardStyle: 'glass'` (surfaces, not typography)
- Decorative ornaments (pill taglines, gradients, background effects)

MRB-specific files in `components/blocks/mrb/` must follow the same rules as `components/blocks/public/`. No `text-7xl md:text-8xl` heroes, no `tracking-tighter`, no `leading-[0.95]` — those were the audit's MRB-only divergences and have been folded into H1.

If MRB (or any future template) legitimately needs a typographic differentiation, that's a post-foundation conversation. Don't add it ad-hoc.

---

## Common Pitfalls

| Pitfall | Why it happens | Fix |
|---|---|---|
| "But this looks too small/big" | Tier picked by visual desire, not semantic role | Re-map by role; if still wrong, the block's information hierarchy is wrong, not the scale |
| "But I need a custom color for this brand callout" | Brand color should be in theme tokens | Add to `theme.colors.*` or use `getAccentColor(theme)` |
| "Tailwind class is shorter than the inline style" | Convenience > consistency | Use the helper; consistency wins |
| "Prose plugin is overkill for two paragraphs" | False — it's the consistency point | Use it anyway. If genuinely overkill (single line), use `BODY` constant |
| "The old block did X; I'll match it" | Old block predates the system | Don't propagate the rot; migrate the old block too if you touch it |

---

## Pointers

- **Spec:** [`superpowers/specs/2026-05-16-block-typography-system.md`](../../../superpowers/specs/2026-05-16-block-typography-system.md)
- **Audit (evidence):** [`superpowers/notes/2026-05-16-typography-audit.md`](../../../superpowers/notes/2026-05-16-typography-audit.md)
- **Migration plan:** [`superpowers/plans/2026-05-16-typography-migration.md`](../../../superpowers/plans/2026-05-16-typography-migration.md)
- **Helpers:** [`clicker-platform-v2/components/blocks/public/cardStyles.ts`](../../../clicker-platform-v2/components/blocks/public/cardStyles.ts)
- **Constants:** `clicker-platform-v2/components/blocks/public/typography.ts` (created in Phase 1)
- **Prose config:** `clicker-platform-v2/components/blocks/public/proseConfig.ts` (created in Phase 1)
- **Related skill:** [`canvas_studio`](../canvas_studio/SKILL.md) — overall block system architecture
