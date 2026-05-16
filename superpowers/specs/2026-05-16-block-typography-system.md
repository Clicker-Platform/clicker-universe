# Block Typography System — Spec

**Date:** 2026-05-16
**Status:** Approved foundation (2026-05-16). Variants/branding will branch from this later.
**Companion docs:** [audit](../notes/2026-05-16-typography-audit.md), [migration plan](../plans/2026-05-16-typography-migration.md)

---

## Goal

Establish a single, enforceable typography foundation for all Canvas Studio public blocks. Eliminate per-block reinvention of size, weight, color, line-height, and font-family logic. Templates (Default, MRB, future) inherit the same scale; aesthetic variation comes from theme tokens (colors, fonts, cardStyle), **never** from divergent typographic rules per block.

**Non-goals (for this phase):**
- Per-template scale overrides (MRB shares Default scale until foundation is solid)
- Per-cardStyle weight branching (`isBold ? font-black : font-bold`) — eliminate during cleanup; revisit later
- New design tokens beyond what's needed for the system
- Gradient text, text-shadow, decorative effects

---

## 1. The Heading Scale — H1 to H4

Four locked tiers plus a tile-grid tier. Mobile → desktop. **No block defines its own sizes.**

| Tier | Semantic | Size | Weight | Line-height | Tracking | Family |
|------|----------|------|--------|-------------|----------|--------|
| **H1** | Display (Hero title) | `text-4xl md:text-6xl` | `font-extrabold` | `leading-tight` | `tracking-tight` | heading |
| **H2** | Section title | `text-3xl md:text-4xl` | `font-bold` | `leading-tight` | `tracking-tight` | heading |
| **H3** | Subsection / card title (full-width) | `text-xl md:text-2xl` | `font-semibold` | `leading-snug` | normal | heading |
| **TILE_TITLE** | Title in dense `n`-up grid (≤180px tiles) | `text-sm md:text-base` | `font-semibold` | `leading-tight` | normal | heading |
| **H4** | Label / eyebrow | `text-xs md:text-sm` | `font-bold` | `leading-normal` | `tracking-[0.2em]` (uppercase) | heading |

**Rules:**
- Each block selects a tier based on semantic role, not visual taste.
- **H3 vs TILE_TITLE:** H3 is for full-width card titles where text has horizontal room (FAQ question, branch name, ContentShowcase row heading). TILE_TITLE is for dense grids where H3 wraps mid-word (QuickActions 3-up tiles, Products auto-fit minmax-140px grid, LinkCard inside QuickActions list mode).
- H4 is the **only** tier with implied `uppercase` (it's the "eyebrow" label tier). Other tiers stay sentence-case unless the user explicitly types caps.
- Templates may swap the heading font family (`--font-heading`) — but **not the size/weight scale** in this phase.

**Added 2026-05-16 (post-2c visual QA):** TILE_TITLE introduced after H3 was applied to QuickActions grid tiles per the original decision table, which caused titles to wrap into 3+ lines on ~120px-wide tiles. The spec's "card title" rule didn't distinguish dense grids from full-width cards. TILE_TITLE fills that gap.

### Mapping current blocks to tiers

| Block element | Current | Target tier |
|---|---|---|
| Hero title | `text-2xl md:text-6xl` | **H1** |
| MRB Hero title | `text-5xl md:text-6xl` (lg: `text-7xl md:text-8xl`) | **H1** (drop oversized variant for now) |
| HeadingBlock H1 | `text-4xl md:text-5xl` | **H1** |
| ContentShowcase row heading | `text-2xl md:text-3xl` | **H2** |
| FeatureCards section title | `text-3xl` | **H2** |
| Featured Product name | `text-2xl md:text-3xl` | **H2** |
| InlineForm heading | `text-3xl` / `text-2xl` | **H2** |
| FAQ block title ("FAQ") | `text-2xl` | **H2** |
| FAQ question | `text-base` | **H3** |
| FeatureCards card headline | `text-xl` | **H3** |
| LinkCard title (in QuickActions list mode) | `text-base` | **TILE_TITLE** |
| Branches branch name | unset | **H3** |
| QuickActions grid-tile link title | `text-sm` | **TILE_TITLE** |
| Products grid tile product name | `text-sm` | **TILE_TITLE** |
| Operating Hours label | `text-sm` | **H4** |
| Branches "Main Location" | `text-base` uppercase | **H4** |
| QuickActions section title | `text-xs` | **H4** |
| Products block title | `text-xs` | **H4** |
| SocialEmbed title | `text-xs` | **H4** |
| Hero tagline | `text-xs` uppercase tracking-[0.2em] | **H4** |

---

## 2. Body Text Scale

Three sizes. Same rules across blocks.

| Token | Size | Weight | Line-height | Use |
|-------|------|--------|-------------|-----|
| **body-lg** | `text-lg` | `font-normal` | `leading-normal` | Hero subtitle, lead paragraphs |
| **body** | `text-base` | `font-normal` | `leading-normal` | Standard body paragraphs |
| **body-sm** | `text-sm` | `font-normal` | `leading-normal` | Captions, secondary text, product price, branch address |

**Emphasis:** Use `font-medium` for inline emphasis. Reserve `font-semibold`+ for headings.

**Long-form prose exception:** When body text is rendered via the **prose plugin** (rich text from TextBlock, ContentShowcase row content, FAQ answer), use `leading-[1.65]` for reading optimization. This is the **only** allowed line-height override and is configured once in the prose config — never inline.

---

## 3. Color System

### 3.1 No hardcoded colors. Ever.

**Strictly forbidden in block files:**
- `text-slate-*`, `text-gray-*`, `text-neutral-*`, `text-zinc-*`, `text-stone-*`
- `text-white`, `text-black`
- `text-red-*`, `text-green-*`, `text-blue-*`, etc. (color names)
- Hex colors in `style={{ color: '#...' }}`
- `bg-black/70`, `bg-white/50`, etc. for text overlays

**Allowed only:**
- Theme-token-backed helper functions (§3.2)
- CSS variables `var(--theme-foreground)`, `var(--theme-primary)`, etc.
- Semantic status colors (success/warning/error) — but only via theme tokens like `var(--theme-success)`, never raw `text-red-600`

**Exception:** Luminance-derived contrast colors (e.g., Hero text on user-uploaded background image) are allowed when bridged through a shared utility — but the utility itself reads from theme tokens for fallback.

### 3.2 The helper API — expand `cardStyles.ts`

Rename file → keep `cardStyles.ts` (existing path), expand surface:

```ts
// components/blocks/public/cardStyles.ts

export function getHeadingColor(cardStyle: CardStyle, theme: ThemeConfig): string;
export function getBodyColor(cardStyle: CardStyle, theme: ThemeConfig): string;
export function getMutedColor(cardStyle: CardStyle, theme: ThemeConfig): string;
export function getLabelColor(cardStyle: CardStyle, theme: ThemeConfig): string;
export function getAccentColor(theme: ThemeConfig): string;       // links, CTAs → theme.primary

// Existing — keep
export function getCardClasses(cardStyle: CardStyle, extra?: string): string;
export function getGlassStyle(surfaceColor?: string): CSSProperties;

// Deprecated — remove after migration
// export function getTextColor(cardStyle, muted?): string;
```

**Return type:** All color helpers return a CSS color **string** (hex, rgb, or `var(--theme-*)`) suitable for inline `style={{ color: ... }}`. Not Tailwind classes — this avoids the current split between class-based and inline-style consumers.

**Why inline strings, not classes:** Theme colors are tenant-customizable (per-site `theme.colors.foreground`). Tailwind classes can't express dynamic per-tenant hex values; only CSS vars or inline styles can. We standardize on inline-style consumption.

**Implementation sketch:**

```ts
export function getHeadingColor(cardStyle, theme) {
  if (cardStyle === 'glass') return 'rgba(255, 255, 255, 0.98)';
  return theme.colors.foreground; // tenant-overridable
}

export function getBodyColor(cardStyle, theme) {
  if (cardStyle === 'glass') return 'rgba(255, 255, 255, 0.85)';
  return theme.colors.foreground;
}

export function getMutedColor(cardStyle, theme) {
  if (cardStyle === 'glass') return 'rgba(255, 255, 255, 0.6)';
  return theme.colors.textMuted ?? hexWithOpacity(theme.colors.foreground, 0.65);
}

export function getLabelColor(cardStyle, theme) {
  // Eyebrow/H4 — slightly muted heading color
  if (cardStyle === 'glass') return 'rgba(255, 255, 255, 0.7)';
  return theme.colors.textMuted ?? hexWithOpacity(theme.colors.foreground, 0.7);
}

export function getAccentColor(theme) {
  return theme.colors.primary;
}
```

### 3.3 Usage pattern

```tsx
// ❌ Before (mix of patterns)
<h2 className={`text-2xl font-black ${getTextColor(cardStyle)}`}>FAQ</h2>
<h2 className="text-slate-400 text-xs">Social</h2>
<h3 style={{ color: theme.colors.foreground }}>...</h3>

// ✅ After (single pattern)
<h2 className="text-3xl md:text-4xl font-bold leading-tight tracking-tight"
    style={{ color: getHeadingColor(cardStyle, theme) }}>
  FAQ
</h2>
```

---

## 4. Font Family — Global, Not Inline

### 4.1 Remove inline `fontFamily`

**Forbidden in blocks:**
```tsx
style={{ fontFamily: theme.fonts.heading }}  // ❌ never again
```

### 4.2 Emit CSS variables at template root

Template root (e.g., `app/[slug]/page.tsx` or template layout component) emits:

```tsx
<div
  style={{
    '--font-heading': theme.fonts.heading,
    '--font-body': theme.fonts.body,
  } as CSSProperties}
>
  {children}
</div>
```

This is likely already partially done — audit and consolidate during migration.

### 4.3 Global CSS rules

In `app/globals.css` (or template-scoped stylesheet):

```css
h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-heading, system-ui);
}

body, p, li, dd, dt, td, th, input, button, textarea, select {
  font-family: var(--font-body, system-ui);
}

.prose {
  font-family: var(--font-body, system-ui);
}
.prose :where(h1, h2, h3, h4, h5, h6) {
  font-family: var(--font-heading, system-ui);
}
```

### 4.4 Per-block exceptions

If a block legitimately needs a different family (e.g., monospace for code), use a Tailwind utility class (`font-mono`) — never inline `theme.fonts.*`.

---

## 5. Prose Plugin — Standard for Rich Text

### 5.1 Scope

Use the `prose` plugin for any block that renders **user-authored rich text** (multi-paragraph, may contain headings, lists, links, emphasis):

| Block | Prose? | Notes |
|---|---|---|
| DefaultTextBlock | ✅ Already | Canonical |
| DefaultContentShowcaseBlock row content | ✅ Already | Keep |
| DefaultFAQBlock answer | ✅ **Migrate** | Currently ad-hoc |
| Hero subtitle | ❌ No | Single paragraph |
| InlineForm subheading | ❌ No | Single line |
| Branches address | ❌ No | Single line |
| LinkCard description | ❌ No | Single line |

### 5.2 Shared prose config

Define once (likely a `proseClass` constant or Tailwind plugin config), reuse:

```ts
// components/blocks/public/proseConfig.ts
export const proseClass = [
  'prose prose-neutral max-w-none',
  'prose-headings:font-heading prose-headings:text-[var(--theme-foreground)]',
  'prose-p:font-body prose-p:text-[var(--theme-foreground)] prose-p:leading-[1.65]',
  'prose-a:text-[var(--theme-primary)] prose-a:no-underline hover:prose-a:underline',
  'prose-strong:text-[var(--theme-foreground)] prose-strong:font-semibold',
  'prose-li:text-[var(--theme-foreground)] prose-li:leading-[1.65]',
].join(' ');
```

Glass-on-dark variant (when needed):

```ts
export const proseGlassClass = proseClass
  .replace('text-[var(--theme-foreground)]', 'text-white/85')
  .replace('prose-strong:text-[var(--theme-foreground)]', 'prose-strong:text-white');
```

### 5.3 Prose `max-w-none`?

Current TextBlock uses `prose max-w-none` (no width cap). **Keep `max-w-none`** in this phase — width capping is a layout concern, not typography. Container blocks (Columns, Grid) handle width. Revisit if readability complaints surface.

---

## 6. Responsive Scaling — Required Everywhere

Every heading and label must scale mobile → desktop. The H1–H4 table above already encodes this.

**Body text** does not scale by default (`text-base` everywhere). Exception: long-form prose may scale (`prose-base md:prose-lg`) — configure in shared prose config, not per-block.

**Forbidden:** non-responsive heading sizes like `text-3xl` (no `md:` qualifier).

---

## 7. Letter Spacing (Tracking)

Locked rules:

| Context | Tracking |
|---------|----------|
| H1 (display) | `tracking-tight` |
| H2 (section) | `tracking-tight` |
| H3 (subsection) | normal (none) |
| H4 (label/eyebrow, uppercase) | `tracking-[0.2em]` |
| Body | normal (none) |
| Buttons | normal (none) — no auto-uppercase |

**No `tracking-tighter`** in this phase (was MRB-only).
**No `tracking-widest`** — fold into the `[0.2em]` standard.

---

## 8. Buttons

| Aspect | Rule |
|--------|------|
| Text size | `text-sm md:text-base` |
| Weight | `font-semibold` |
| Case | **Never auto-uppercase.** User types caps if they want caps. |
| Tracking | Normal (no `tracking-wider`) |
| Family | Inherits `--font-body` (no override) |
| Line-height | `leading-normal` |
| Color | `getAccentColor(theme)` for primary, `getBodyColor(...)` for secondary |

Remove all `uppercase`, `tracking-wider`, and `font-black` from button styling in `DefaultButtonBlock`, `DefaultFeaturedProductBlock` CTA, `DefaultInlineFormBlock` submit.

---

## 9. cardStyle Branching — Reduce, Don't Eliminate

`cardStyle` (clean/glass/brutalist) is a **theme-level** distinction, not a typography one. After this cleanup:

**Allowed cardStyle branching:**
- Color (glass uses white-on-dark; clean/brutalist use theme.foreground) — via helpers
- Card surface (bg, border, backdrop-filter) — via `getCardClasses()` / `getGlassStyle()`

**Forbidden cardStyle branching:**
- Heading size (`isBold ? text-3xl : text-2xl`) — pick one size, the scale wins
- Font weight (`isBold ? font-black : font-bold`) — semantic tier wins
- Tracking (`isBold ? tracking-widest : tracking-wider`) — H1–H4 rules win
- Case (`isBold ? uppercase : ''`) — user-controlled, not block-controlled

If a future variant genuinely needs typographic differentiation, it gets its own template + scale override — but that's post-foundation work.

---

## 10. MRB Override Policy (This Phase)

**MRB shares the Default scale.** Specifically:

- **Drop** MrbHero's oversized `text-7xl md:text-8xl` variant — use H1 (`text-4xl md:text-6xl`)
- **Drop** `tracking-tighter` and `leading-[0.95]` — use H1 rules (`tracking-tight`, `leading-tight`)
- **Keep** MRB's color/font choices (theme-token-driven) — those are aesthetic
- **Keep** MRB's tagline pill styling (visual ornament, not typography)
- **Fix** MrbOperatingHours to use `getCardClasses()` like Default

MRB remains visually distinct via:
- `--font-heading` (MRB picks a display font)
- `theme.colors` (dark palette)
- `cardStyle: 'glass'` (glassmorphism surfaces)
- Decorative ornaments (pill tagline, gradients on backgrounds)

But the typographic **system** (scale, weights, line-heights) is shared.

---

## 11. Enforcement

### 11.1 ESLint rules (add or extend)

```js
// .eslintrc — custom rules
{
  rules: {
    'no-restricted-syntax': [
      'error',
      {
        // Forbid hardcoded Tailwind text colors in blocks
        selector: "Literal[value=/text-(slate|gray|neutral|zinc|stone|white|black|red|green|blue|yellow|orange|pink|purple|indigo)-[0-9]/]",
        message: 'Use theme-token color helpers from cardStyles.ts. No hardcoded Tailwind colors in block files.',
      },
      {
        // Forbid inline fontFamily
        selector: "Property[key.name='fontFamily'][value.type='MemberExpression']",
        message: 'Font family must come from CSS variables (--font-heading, --font-body), not inline style.',
      },
    ],
  },
  overrides: [
    { files: ['components/blocks/**/*.tsx'], rules: { /* stricter */ } },
  ],
}
```

### 11.2 Visual regression — Chromatic / Percy (deferred)

Out of scope for foundation. Note in migration plan to add per-block stories that compare scale snapshots.

### 11.3 Skill / docs

Update `.claude/commands/canvas_studio/SKILL.md` with a "Typography" section pointing here. New blocks must declare which H-tier each heading uses. Add a `typography_system` quick-reference (see migration plan).

---

## 12. Token Summary (for quick reference)

```
HEADINGS
  H1          text-4xl md:text-6xl   font-extrabold  leading-tight  tracking-tight
  H2          text-3xl md:text-4xl   font-bold       leading-tight  tracking-tight
  H3          text-xl  md:text-2xl   font-semibold   leading-snug   normal
  TILE_TITLE  text-sm  md:text-base  font-semibold   leading-tight  normal             (dense n-up grids)
  H4          text-xs  md:text-sm    font-bold       leading-normal tracking-[0.2em]   (uppercase eyebrow)

BODY
  body-lg  text-lg    font-normal  leading-normal
  body     text-base  font-normal  leading-normal
  body-sm  text-sm    font-normal  leading-normal
  prose    (configured separately, leading-[1.65])

WEIGHTS (semantic)
  font-normal     body
  font-medium     body emphasis
  font-semibold   H3, buttons
  font-bold       H2, H4
  font-extrabold  H1

COLORS (via helpers, never hardcoded)
  getHeadingColor(cardStyle, theme)
  getBodyColor(cardStyle, theme)
  getMutedColor(cardStyle, theme)
  getLabelColor(cardStyle, theme)
  getAccentColor(theme)

FONT FAMILY (global CSS, not inline)
  var(--font-heading)  ← all h1-h6
  var(--font-body)     ← body, p, prose
```

---

## 13. Out of Scope (Future Work)

- Variant typographic systems per template (post-foundation)
- Per-cardStyle weight differentiation (post-foundation; may revisit if `isBold` "brutalist" demands it)
- Gradient text, text-shadow, decorative effects
- User-configurable scale (tenant picks "compact" vs "spacious")
- Vertical rhythm / baseline grid system
- Antialiasing class strategy
- Visual regression test suite
- `text-balance` / `text-pretty` adoption (cheap to add later)

---

## 14. Open Decisions (still flexible)

None at spec time. All 10 audit questions answered. Edge cases (e.g., semantic status colors `text-red-*` in `SafeBlockRenderer`) will be settled during migration by routing through new theme tokens (`var(--theme-error)` etc.).
