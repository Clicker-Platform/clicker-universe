# Typography Audit — Canvas Studio Blocks

**Date:** 2026-05-16
**Scope:** All public block components in `components/blocks/public/` + MRB overrides in `components/blocks/mrb/`. Findings only — no fix plan.

---

## Summary — Top Inconsistencies (Ranked by Visual Severity)

1. **Heading Scale Drift** — Block titles rendered at 5+ different sizes (`text-xs` to `text-6xl`) for the same semantic role. No consistent hierarchy.
2. **Weight Proliferation** — `font-bold`, `font-semibold`, `font-black`, `font-extrabold` used interchangeably with no semantic mapping.
3. **Color Source Fragmentation** — Three competing patterns: hardcoded Tailwind (`text-neutral-900`), inline `theme.textColor`, centralized `getTextColor()` helper. Used inconsistently.
4. **Responsive Scaling Gaps** — ~40% of blocks have no mobile/desktop scaling. FAQ stays `text-2xl` while Hero scales `text-2xl md:text-6xl`.
5. **Line-Height Chaos** — No baseline. Prose uses `leading-[1.65]`, FAQ answer uses `leading-relaxed`, OperatingHours hours have no leading set.
6. **MRB Template Divergence** — MRB overrides use different patterns than defaults (some inline colors, some via theme tokens), partly aesthetic, partly inconsistent.
7. **`getTextColor()` Underutilized** — Only 4 of 20+ blocks use the centralized helper. Others reinvent `isGlass ? glass_color : light_color` logic locally.
8. **Hardcoded Colors Ignoring Theme** — SocialEmbedBlock uses `text-slate-400`, ImageGalleryBlock uses `text-white`/`bg-black/70`, SafeBlockRenderer uses `text-red-*` — all ignore theme tokens.
9. **Letter Spacing Sporadic** — `tracking-*` applied only to uppercase text in some blocks, omitted in others doing the same thing.
10. **Font Family Inline Everywhere** — Every block manually applies `fontFamily: theme.fonts.heading` inline rather than via prose config or global CSS.

---

## Per-Block Typography Table

| Block | Heading Size/Weight/Color | Body Size/Weight/Color | Line-height | Color Source | Notes |
|-------|---------------------------|----------------------|-------------|--------------|-------|
| **DefaultHeroBlock** | h1: `text-2xl`–`text-6xl` (responsive), `font-bold`/`font-extrabold` (cardStyle-dependent), inline `data.titleColor` or luminance-computed | `text-xl` (subtitle), `font-medium`, inline color | subtitle `unset`, tagline `tracking-[0.2em]` | Luminance-driven (bespoke `resolveTextOnBg()`), inline color override or computed hex | Heavy bespoke logic; 3 variants (split/fullbleed/centered) with slightly different typog patterns |
| **DefaultHeadingBlock** | h1–h4: `text-4xl`–`text-xl` + `md:text-5xl`–`md:text-2xl` (responsive), `font-bold`, `var(--theme-foreground)` | p: `text-base`, `font-medium`, opacity 65%, `var(--theme-foreground)` | `mt-2` (subheading), no explicit `leading` | Theme tokens (`var(--theme-foreground)`) | Clean, centralized; uses theme tokens uniformly |
| **DefaultTextBlock** | prose headings: `font-heading`, `text-[var(...)]`, mt-8 mb-4 | prose paragraphs: `font-body`, variable size `text-[15px]`–`text-[18px]` (responsive), `leading-[1.65]`–`leading-[1.75]` (responsive) | prose `leading-snug` (lists) | Theme tokens via prose classes, `prose-a:text-[var(--theme-primary)]` | Only block using prose; typography fully delegated to Tailwind prose plugin |
| **DefaultFAQBlock** | h2 (FAQ title): `text-2xl`, `font-black`, `getTextColor()` | question h3: `text-base`, `font-bold`, `getTextColor()`; answer p: `text-sm`, `font-medium`, `getTextColor(true)` | answer `leading-relaxed` | `getTextColor(cardStyle, muted)` helper | Uses centralized helper; 3 variants (accordion/grid/simple-list) all consistent |
| **DefaultButtonBlock** | N/A (inline element) | button: `font-bold`, `text-sm` (hardcoded in className), theme-driven via `getVariantClass()` | `inline-block` | `getVariantClass()` returns full color classes per cardStyle | cardStyle-branching; no responsive text sizing |
| **DefaultLinkBlock** | (Server component, delegates to LinkBlockClient) | — | — | — | Thin wrapper |
| **LinkCard** | h3: `font-bold`, `text-base`, inline `fgColor` (derived from theme/override) | p: `text-sm`, `font-medium`, inline `mutedColor` | `leading-tight` | Inline styles from context or derived contrast color | Uses derived `cardFgColor` passed from parent |
| **DefaultQuickActionsBlock** | h2 (section title): `text-xs`, `font-bold`, uppercase, `tracking-[0.2em]`, `theme.colors.textMuted` | link title: `text-sm`, `font-bold`, inline `resolvedFg`; subtitle `text-xs`, inline `resolvedMuted` | inline `gap-*` spacing | Resolved inline (glass/override logic branches) | Computes `resolvedBg`, `resolvedBorder`, `resolvedFg`, `resolvedMuted` locally; not using `getTextColor()` |
| **DefaultOperatingHoursBlock** | h3 (label): `text-sm`, `font-black`, `uppercase`, `tracking-wide`, inline color (glass-specific or theme) | day labels: `text-xs`, `font-bold`, opacity/inline color; hours `text-xs`, `font-bold`, `tabular-nums`, opacity/inline color | `space-y-1` (row gap) | Inline style from theme colors or glass-specific values | Uses `getCardClasses()` and `getGlassStyle()` but not `getTextColor()` |
| **MrbOperatingHours** | h3 (label): `text-sm`, `font-black`, `uppercase`, `tracking-wide`, inline `fg` | day labels `text-xs` (no font-weight), hours `text-xs`, `font-bold`, `tabular-nums`, inline color | `space-y-1.5` (row gap, tighter than Default) | Inline colors from theme tokens (`surface`, `fg`, `subtle`, `border`) | Diverges from Default: no `getCardClasses()`; custom bg/border inline styles |
| **DefaultBranchesBlock** | h3 (Main Location): `text-base`, `uppercase`, `font-bold`, `getTextColor()`; h4 (branch name): `font-bold`, `getTextColor()` | p (address): `text-sm`, `font-medium`, `getTextColor(true)` | `leading-relaxed` (address), `mb-1` (branch) | `getTextColor()` helper + inline theme.colors | Uses helper for body text; consistent |
| **DefaultFeatureCardsBlock** | h2 (section title): `text-3xl`, `font-black`, `tracking-tight`, `var(--theme-foreground)`; h3 (card headline): `text-xl`, `font-black`, `leading-tight`, inline `autoTextColor` or theme | label: `text-xs`, `font-bold`, `uppercase`, `tracking-widest`; body p: `text-sm`, `leading-relaxed`, inline `bodyColor` or theme | labels `tracking-widest`, body `leading-relaxed` | Custom bg → auto text color via luminance; fallback to theme | Per-card color override with luminance fallback |
| **DefaultContentShowcaseBlock** | h3 (row heading): `text-2xl`–`text-3xl` (responsive `md:text-3xl`), `font-black`, `font-heading`, `text-[var(--theme-foreground)]`, `leading-tight` | prose (row content): `prose` plugin classes, `text-[var(--theme-foreground)]/80`, `prose-strong:text-[var(...)]`, `prose-a:text-[var(--theme-primary)]` | prose `leading-none` for heading | Prose plugin + inline theme vars | Only CTA uses inline style (`color: var(--theme-primary)`) |
| **DefaultFeaturedProductBlock** | h3 (product name): `text-2xl`–`text-3xl`, `font-bold`–`font-black`, `uppercase`, `leading-none`, `tracking-tight`, inline `colors.foreground` or family | button: `font-bold`–`font-black` (isBold), `text-sm`–`uppercase`, inline colors | button `py-4` (no `leading`), badge `uppercase`, `tracking-wider`, product name `leading-none` | Inline colors from theme via `theme?.colors`, badge uses custom bg | Heavy branching on `isBold` (clean/glass/brutalist); strong brand differentiation |
| **DefaultProductsBlock / ProductsBlockClient** | h2 (Products title): `text-xs`, `font-bold`, `uppercase`, `tracking-[0.2em]`, opacity 60%, theme.colors.foreground | product tile: category label `text-[10px]`, `font-bold`, `uppercase`, `tracking-wider`, `getTextColor(true)`; product name h3 `text-sm`, `font-bold`, `getTextColor()`; price `text-xs`, `font-medium`, `getTextColor(true)` | category `mb-1`, title `mb-1`, price `font-medium` | Mixed: title uses theme.colors directly; labels/price use `getTextColor()` | Inconsistent within same block |
| **DefaultSocialEmbedBlock** | h2 (title): `text-slate-400`, `text-xs`, `font-bold`, `uppercase`, `tracking-[0.2em]` | platform label (in placeholder): `text-xs`, `font-bold`, platform-specific Tailwind classes like `bg-pink-500/20` | no prose; captions `text-xs` (no weight) | Platform-specific hardcoded Tailwind (`text-pink-300`, etc.); title hardcoded `text-slate-400` | Hardcoded grays; should use theme tokens |
| **DefaultInlineFormBlock** | h2 (form heading): `text-3xl`–`text-2xl`, `font-black`–`font-bold`, `uppercase` (bold only), inline `colors.foreground` | p (subheading): `text-sm`, `font-medium`, inline color opacity 0.6; button: `font-bold`–`font-black` (isBold), `text-sm` (bold), `uppercase` (bold), `tracking-wider` (bold) | button `py-4`, form `space-y-4` (field gaps) | Inline colors from theme via `colors.*`; per-cardStyle branching | Form inputs styled per cardStyle (glass/bold/clean); heading responsive via conditional logic |
| **DefaultImageBlock** | N/A | N/A | — | — | Pure image component |
| **DefaultMapBlock** | N/A | N/A | — | — | Pure map component |
| **DefaultColumnsBlock** | (Container; child blocks' typography) | — | — | — | Recursive renderer |
| **DefaultGridBlock** | (Container; child blocks' typography) | — | — | — | Recursive renderer |
| **DefaultImageGalleryBlock** | (no heading) | photo badge: `text-white`, `bg-black/70` | — | Hardcoded | Ignores theme |
| **MrbHero** | h1 (title): `text-3xl`–`text-7xl` + `md:text-4xl`–`md:text-8xl` (larger than Default), `font-extrabold`, `leading-[0.95]`, `tracking-tighter`, inline color; tagline span: `text-[10px]`, `font-bold`, `uppercase`, inline border/bg; subtitle p: `text-lg`, `font-medium` (default), `leading-relaxed`, inline color, opacity 80% | — | tagline `leading-[0.95]`, subtitle `leading-relaxed` | Inline colors from `data.*` override or computed hex (luminance) + theme.colors.primary for tagline | Larger heading scale than Default (MRB aesthetic); custom button styling |

---

## Cross-Cutting Issues

### 1. Heading Scale Drift

Blocks use dramatically different sizes for semantically similar roles:

| Block Role | Size Classes | Context |
|-----------|--------------|---------|
| FAQ block heading | `text-2xl` | DefaultFAQBlock:22, 47, 63 |
| Feature Cards title | `text-3xl` | DefaultFeatureCardsBlock:140 |
| Content Showcase row heading | `text-2xl md:text-3xl` | DefaultContentShowcaseBlock:186 |
| Products block title | `text-xs` | ProductsBlockClient:108 (radically smaller) |
| QuickActions section title | `text-xs` | DefaultQuickActionsBlock:112 (radically smaller) |
| Featured Product name | `text-2xl md:text-3xl` | DefaultFeaturedProductBlock:261 (but `leading-none`) |
| Heading Block H1 | `text-4xl md:text-5xl` | DefaultHeadingBlock:12 |
| Hero H1 | `text-2xl md:text-6xl` | DefaultHeroBlock:52–56 (huge range) |
| MRB Hero H1 | `text-5xl md:text-6xl` (lg/xl: `text-7xl md:text-8xl`) | MrbHero:55–59 (explicitly larger) |

**Impact:** No consistent visual hierarchy for "section heading."

---

### 2. Weight Inconsistency

Same semantic role uses 4+ different weights:

| Role | Weights | Files |
|------|---------|-------|
| Section/block heading | `font-bold`, `font-black`, `font-extrabold` | FAQBlock:22 (black), QuickActionsBlock:112 (bold), HeroBlock:259 (extrabold split variant) |
| Body text | `font-medium`, default (unset) | TextBlock prose defaults to `font-medium`; OperatingHours uses `font-bold` for hours |
| Label/caption | `font-bold`, `font-black` | FeatureCardsBlock:68 (bold + tracking-widest); ProductsBlockClient:74 (bold + tracking-wider) |
| Card titles | `font-bold`, `font-black` | LinkCard:95 (bold), FeatureCardsBlock CardItem:75 (black) |

---

### 3. Color Source Inconsistency — Three Competing Patterns

**Pattern A: Centralized helper `getTextColor(cardStyle, muted?)`**
Used in: FAQBlock, OperatingHoursBlock, BranchesBlock, ProductsBlockClient (~4 blocks)

```tsx
// DefaultFAQBlock.tsx:22
<h2 className={`text-2xl mb-8 font-black ${getTextColor(cardStyle)}`}>FAQ</h2>
```

**Pattern B: Inline `theme.textColor` / `theme.colors.*`**
Used in: HeroBlock (luminance-computed), QuickActionsBlock (resolved locally), FeaturedProductBlock, InlineFormBlock, LinkCard (~60% of blocks)

```tsx
// DefaultQuickActionsBlock.tsx:87–91
const resolvedFg = isGlass ? 'rgba(255,255,255,0.95)' : (cardFgColor || theme.colors.foreground);
// ... style={{ color: resolvedFg }}
```

Each block reinvents `isGlass ? glass_color : light_color` locally.

**Pattern C: Hardcoded Tailwind classes**
Used in: SocialEmbedBlock (`text-slate-400`), ImageGalleryBlock (`text-white`), SafeBlockRenderer (`text-red-600`) (~3 blocks)

```tsx
// DefaultSocialEmbedBlock.tsx:116
<h2 className="text-slate-400 text-xs font-bold uppercase tracking-[0.2em]">
```

**Pattern D: Prose plugin**
Used in: DefaultTextBlock only

```tsx
// DefaultTextBlock.tsx:39–46
prose-headings:text-[var(--theme-foreground)]
prose-p:text-[var(--theme-foreground)] prose-p:font-body
prose-a:text-[var(--theme-primary)]
```

---

### 4. Line-Height Gaps

| Block | Headings | Body | Notes |
|-------|----------|------|-------|
| DefaultTextBlock | unset (default) | `leading-[1.65]` / `leading-[1.75]` (responsive) | Only block with prose-level tuning |
| DefaultHeroBlock | unset | subtitle unset | Subtitle lacks explicit leading |
| DefaultContentShowcaseBlock | `leading-tight` | prose default | Row heading has `leading-tight` |
| DefaultOperatingHoursBlock | unset | unset (font-bold hours) | Hours have `tabular-nums` but no leading |
| MrbOperatingHoursBlock | unset | unset | Smaller row gap `space-y-1.5` vs Default `space-y-1` |
| DefaultFeaturedProductBlock | `leading-none` (product name) | button `py-4` (no leading) | Intentional tight leading |
| DefaultQuickActionsBlock | unset | unset (text-sm link title, text-xs subtitle) | — |
| DefaultFeatureCardsBlock | `leading-tight` (h3) | body `leading-relaxed` | Good contrast |
| FAQBlock (simple-list) | unset | `leading-relaxed` (answer) | Inconsistent across variants |

**Impact:** Body text line-heights range unset (~1.5) to `leading-relaxed` (1.75) — inconsistent rhythm.

---

### 5. Responsive Scaling Gaps

**With responsive scaling:**
- HeroBlock: `text-2xl md:text-3xl` (per size config)
- HeadingBlock: `text-4xl md:text-5xl` (per size config)
- ContentShowcaseBlock: `text-2xl md:text-3xl`
- FeaturedProductBlock: `text-2xl md:text-3xl` (conditional on `isBold`)

**Without responsive scaling:**
- FAQBlock: always `text-2xl` (should scale on mobile)
- QuickActionsBlock: always `text-xs`
- ProductsBlockClient: always `text-xs`
- OperatingHoursBlock: always `text-sm`
- SocialEmbedBlock: always `text-xs`
- InlineFormBlock: `text-3xl` / `text-2xl` (conditional on `isBold`, not device)
- FeatureCardsBlock section title: `text-3xl` (non-responsive)

**Impact:** On mobile, FAQ headings don't shrink while Hero headings do.

---

### 6. Hardcoded Colors Ignoring Theme

| Block | Hardcoded Class | Should Be | File / Line |
|-------|-----------------|-----------|------------|
| SocialEmbedBlock | `text-slate-400` (title) | theme token | DefaultSocialEmbedBlock:116 |
| SocialEmbedBlock | `text-pink-300` / `text-purple-300` / `text-red-300` (platform labels) | brand/theme tokens | DefaultSocialEmbedBlock:33–36 |
| ImageGalleryBlock | `text-white`, `bg-black/70` (photo badge) | theme overlay | DefaultImageGalleryBlock:110 |
| SafeBlockRenderer | `text-red-600`, `border-red-200`, `bg-red-50` (error) | theme tokens | SafeBlockRenderer.tsx:30 |

---

### 7. MRB vs. Default Divergence

#### MrbHero vs. DefaultHeroBlock

| Aspect | Default | MRB | Intentional? |
|--------|---------|-----|------------|
| Title size (lg config) | `text-5xl md:text-6xl` | `text-6xl md:text-7xl` | Yes (larger) |
| Title weight | `font-bold`/`font-extrabold` (cardStyle-branched) | `font-extrabold` (always) | Yes |
| Title leading | unset | `leading-[0.95]` | Yes (tighter) |
| Title tracking | `tracking-tight` (clean/glass) or unset | `tracking-tighter` | Yes |
| Tagline style | `text-xs`, uppercase, `tracking-[0.2em]` | `text-[10px]`, uppercase, `tracking-[0.25em]`, pill | Yes (pill style) |
| Subtitle opacity | data color or luminance-computed | explicit 80% opacity | Slight divergence |
| Button styling | cardStyle branches | simplified `borderColor: ${primaryColor}66` | Yes (simplifies) |

**Assessment:** MRB intentionally uses a more dramatic, tighter, larger heading scale — coherent with dark glassmorphism aesthetic.

#### MrbOperatingHours vs. DefaultOperatingHoursBlock

| Aspect | Default | MRB | Intentional? |
|--------|---------|-----|------------|
| Card wrapper | `getCardClasses(cardStyle)` + `getGlassStyle()` | Direct inline bg/border | **Divergence** — pattern-use inconsistent |
| Status badge | semantic green/red hardcoded | same hardcoded | Both hardcode |
| Row gap | `space-y-1` | `space-y-1.5` | Slight divergence |
| Font weights | label `font-black`, hours `font-bold` | same | Same |

**Assessment:** MRB doesn't use `getCardClasses()` — minor inconsistent pattern-use, not aesthetic.

---

### 8. `getTextColor()` Helper Underutilization

**Current usage:** ~16 calls across 4 blocks out of 20+ blocks.

**Blocks that should use `getTextColor()` but don't:**
1. DefaultButtonBlock — reinvents `getVariantClass()`
2. DefaultQuickActionsBlock — computes `resolvedFg` / `resolvedMuted` locally
3. LinkCard — computes `bgColor`, `borderColor`, `fgColor`, `mutedColor` locally
4. DefaultSocialEmbedBlock — hardcodes `text-slate-400`
5. DefaultHeroBlock — bespoke luminance logic
6. DefaultFeaturedProductBlock — inline colors from `theme.colors.*`

**Helper Gap:** `getTextColor()` only handles glass (opacity) or light (gray/theme-foreground). Doesn't support:
- Emphasized text
- Gradient text
- Link/accent text
- Heading-specific color (no `getHeadingColor()`)

---

### 9. Letter Spacing (Tracking) Applied Sporadically

| Block | Tracking Used | Value | Context |
|-------|----------------|-------|---------|
| HeroBlock | Yes | `tracking-[0.2em]` (tagline) | Uppercase tagline |
| HeadingBlock | No | — | — |
| QuickActionsBlock | Yes | `tracking-[0.2em]` (title) | Uppercase section heading |
| FAQBlock | No | — | — |
| FeatureCardsBlock | Yes | `tracking-widest` (label), `tracking-tight` (title) | Label uppercase |
| ContentShowcaseBlock | Yes | `tracking-tight` (title) | — |
| FeaturedProductBlock | Yes | `tracking-tight` (name), `tracking-wider` (button) | Name uppercase |
| MrbHero | Yes | `tracking-tighter` (title), `tracking-[0.25em]` (tagline) | MRB aesthetic |
| OperatingHoursBlock | Yes | `tracking-wide` (label) | Uppercase label |

**Pattern:** Consistent on uppercase text; sporadic elsewhere. No systematic rule.

---

## `cardStyles.ts` Analysis

**What's centralized:**
1. `getCardClasses(cardStyle, extra?)` — card border/bg/shadow per cardStyle (clean/glass/brutalist)
2. `getTextColor(cardStyle, muted?)` — text color class (glass opacity or gray/foreground)
3. `getGlassStyle(surfaceColor?)` — inline CSSProperties for glass cards

**What's missing:**
1. **No `getHeadingColor()`** — only body text helper exists
2. **No `getBodyTextSize()`** — each block picks own sizes
3. **No `getLineHeightClass()`** — line-height is per-block
4. **No `getLabelStyle()`** — labels inconsistently styled
5. **No `getButtonTextClass()`** — button text ad-hoc
6. **No font-family helper** — inline `fontFamily: theme.fonts.*` in every block
7. **No responsive scaling support** — must use Tailwind classes per block

---

## Suggested Additional Audit Dimensions

1. **Text Balance / Wrap** — No `text-balance` / `text-pretty` (Tailwind 3.4+). Long titles wrap awkwardly on mobile.
2. **Font Family Overrides** — Every block manually applies `fontFamily: theme.fonts.heading` inline. Could be centralized.
3. **Text Transforms (Uppercase)** — Mixed `uppercase` Tailwind class vs inline `textTransform: 'uppercase'` (FeaturedProductBlock:282).
4. **Emphasis (Italic)** — Zero use of `italic` / `not-italic` classes.
5. **Text Truncation / Clamp** — ProductTile uses `truncate`; BranchesBlock address may overflow.
6. **Antialiasing** — No `antialiased` classes. MRB (dark) might benefit.
7. **Gradient Text** — Not used. Could enhance Hero / Featured Product.
8. **Text Shadow** — Only error badge uses red. Not used for legibility on image backgrounds.
9. **Prose Max-Width** — DefaultTextBlock uses `prose max-w-none`. Readability suffers — consider `max-w-3xl`.
10. **Vertical Align** — No use of `align-top/middle/baseline` in inline icon+text pairs.

---

## Color Source Summary

| Block | Pattern | Helper Used? | cardStyle Branches? | Hardcoded Colors? |
|-------|---------|--------------|----------------------|-------------------|
| DefaultHeroBlock | Luminance-driven inline | No | Yes (split/fullbleed/centered) | No |
| DefaultHeadingBlock | Theme tokens | No | No | No |
| DefaultTextBlock | Prose + theme vars | No | No (prose-invert on brutalist) | No |
| DefaultButtonBlock | `getVariantClass()` inline | No | Yes | Yes (white/gray on glass) |
| DefaultFAQBlock | `getTextColor()` helper | **Yes** | Yes | No |
| LinkCard | Inline + derived contrast | No | Yes (glass) | No |
| DefaultQuickActionsBlock | Resolved inline | No | Yes (glass/brutalist) | No |
| DefaultOperatingHoursBlock | Inline + `getTextColor()` partial | Partial | Yes | Semantic (green/red) |
| MrbOperatingHours | Inline theme | No | Yes | Semantic (green/red) |
| DefaultBranchesBlock | `getTextColor()` + theme.colors | Partial | Yes | No |
| DefaultFeatureCardsBlock | Luminance auto + theme fallback | No | No | No |
| DefaultContentShowcaseBlock | Theme vars + prose | No | No | No |
| DefaultFeaturedProductBlock | Inline theme.colors | No | Yes (`isBold`) | No |
| ProductsBlockClient | Mixed `getTextColor()` + theme | Partial | Yes | No |
| DefaultSocialEmbedBlock | Hardcoded Tailwind | No | No | **Yes** (`text-slate-400`) |
| DefaultInlineFormBlock | Inline theme.colors | No | Yes | No |
| DefaultImageGalleryBlock | Hardcoded overlay | No | No | **Yes** (`text-white`, `bg-black/70`) |
| MrbHero | Luminance + theme override | No | No | No |

---

## Open Questions for the User

1. **Heading Scale Tier System:** Should we establish 3–4 explicit tiers (display, section, subsection, label) with locked size ranges?
2. **Font Weight Semantics:** Should `font-bold` = section headings, `font-semibold` = secondary, `font-black` = display? Or is per-block branching intentional?
3. **Color Pattern Authority:** Should `getTextColor()` (expanded) be the single source of truth, or is the current mix intentional?
4. **Responsive Scaling:** Should ALL headings/labels scale on mobile, or only specific blocks?
5. **MRB Typography:** Is MRB's larger/tighter scale the desired aesthetic, or should both templates share scale with only color/weight differing?
6. **Line-Height Baseline:** Should body text default to `leading-relaxed` (1.75) globally, with explicit overrides only for special cases?
7. **Hardcoded Colors:** Should SocialEmbed/ImageGallery/SafeBlockRenderer use theme tokens?
8. **Font Family:** Bake into prose config or global CSS instead of inline `fontFamily: theme.fonts.*` per block?
9. **Button Capitalization:** Should all buttons be uppercase, or is current mix intentional?
10. **Prose Styling:** Should FAQ / ContentShowcase use prose plugin like TextBlock for consistency?
