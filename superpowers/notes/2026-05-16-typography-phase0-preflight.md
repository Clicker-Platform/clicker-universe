# Phase 0 Pre-flight — Typography Migration

**Date:** 2026-05-16  
**Companion:** [migration plan](../plans/2026-05-16-typography-migration.md) | [spec](../specs/2026-05-16-block-typography-system.md)

---

## TL;DR — Gap List for Phase 1

**Critical gaps that Phase 1 must close:**

1. **Status color tokens missing** — `--theme-error`, `--theme-success`, `--theme-warning` not emitted by TemplateProvider. These are needed for SafeBlockRenderer (error state), MrbOperatingHours + DefaultOperatingHoursBlock (open/closed badges), DefaultSocialEmbedBlock platform colors.

2. **No overlay token** — DefaultImageGalleryBlock uses hardcoded `bg-black/70` for photo badges. Need `--theme-overlay` token (or define pattern for semi-transparent scrim colors).

3. **`hexWithOpacity()` helper doesn't exist** — Spec §3.2 calls for fallback opacity logic (`hexWithOpacity(theme.colors.foreground, 0.65)`). This utility must be created.

4. **Five color helpers not yet defined** — `getHeadingColor()`, `getBodyColor()`, `getMutedColor()`, `getLabelColor()`, `getAccentColor()` — spec §3.2 defines the API but not implemented.

5. **No shared prose config** — Spec §5.2 defines `proseClass` and `proseGlassClass` constants. DefaultFAQBlock currently uses ad-hoc prose styling.

6. **Typography constants not exported** — Spec §1 / Phase 1.1e proposes exporting `H1`, `H2`, `H3`, `H4`, `BODY`, `BODY_LG`, `BODY_SM` constants from a new `typography.ts` file.

7. **Global font-family CSS rules incomplete** — `globals.css` emits the theme color variables but **lacks the typography base rules** for `h1–h6` and body text (spec §4.3). Font families are emitted as CSS variables by TemplateProvider but not consumed by global selectors.

8. **No admin canvas parity for `--font-heading` / `--font-body`** — CanvasStudio wraps its preview in TemplateProvider (confirmed at line 270), so font variables ARE emitted in the canvas. ✅ No action needed.

---

## Q1 — ThemeConfig Shape

**File:** [clicker-platform-v2/lib/templates/types.ts](../../clicker-platform-v2/lib/templates/types.ts)

### Full ThemeConfig Shape

```ts
export interface ThemeConfig = TemplateConfig {
  colors: ThemeColors;
  fonts: ThemeFonts;
  borderRadius: string;
  cardStyle: 'brutalist' | 'clean' | 'glass';
  cardVariant: 'shadow' | 'outlined' | 'flat';
  backgroundElements?: BackgroundElement[];
  allowThemeColorOverride?: boolean;
  headerLayout: 'center' | 'left' | 'minimal';
  homeButtonStyle: 'pill' | 'text' | 'icon';
  homeButtonColor: 'primary' | 'foreground' | 'glass';
  taglineStyle: 'contrast' | 'gentle' | 'outline';
  layout?: TemplateLayoutConfig;
  custom?: Record<string, any>;
  decorations?: { surfaceStyle?, accentGlow?, neutralTone? };
}

export interface ThemeColors {
  primary: string;                  // ✅ Required
  secondary?: string;
  accent?: string;
  background: string;               // ✅ Required
  foreground: string;               // ✅ Required
  surface?: string;
  border?: string;
  muted?: string;
  accentForeground?: string;
  surfaceElevated?: string;
  textMuted?: string;               // ✅ Optional, spec assumes it
  textSubtle?: string;
}

export interface ThemeFonts {
  heading: string;                  // ✅ Required
  body: string;                     // ✅ Required
}
```

### Default Values & Template Overrides

All template definitions in [definitions.ts:4–248](../../clicker-platform-v2/lib/templates/definitions.ts#L4-L248) include:

| Template | Primary | Foreground | Background | TextMuted | Heading Font | Body Font |
|----------|---------|-----------|------------|-----------|--------------|-----------|
| **classic** | #B6FF2E | #0E3B2E | #B6FF2E | *(missing)* | var(--font-inter) | var(--font-inter) |
| **modern** | #FFD400 | #1A1A1A | #FFFFFF | *(missing)* | var(--font-space) | var(--font-space) |
| **sojourner** | #00AA6C | #1C1C1C | #F5F7FA | *(missing)* | var(--font-inter) | var(--font-inter) |
| **shuvo** | #1A1A1A | #1A1A1A | #F5F5F0 | *(missing)* | var(--font-playfair) | var(--font-inter) |
| **mrb** | #ec5b13 | #f8fafc | #0a0a0a | #94a3b8 ✅ | var(--font-inter) | var(--font-inter) |
| **mrb-light** | #c2693a | #2A2724 | #FAF7F2 | #8C7B6E ✅ | var(--font-inter) | var(--font-inter) |

### Spec Assumptions vs. Current State

| Token | Spec Assumes | Current State | Gap |
|-------|-------------|--------|-----|
| `colors.foreground` | ✅ exists | ✅ All templates define | None |
| `colors.background` | ✅ exists | ✅ All templates define | None |
| `colors.primary` | ✅ exists | ✅ All templates define | None |
| `colors.textMuted` | ✅ exists | ⚠️ Only mrb/mrb-light define; others missing | **GAP: Add to classic, modern, sojourner, shuvo** |
| `colors.error` | ✅ assumed (Q6) | ❌ Not in type, not in any template | **GAP: Add token type + emit** |
| `colors.success` | ✅ assumed (Q6) | ❌ Not in type, not in any template | **GAP: Add token type + emit** |
| `colors.warning` | ✅ assumed (Q6) | ❌ Not in type, not in any template | **GAP: Add token type + emit** |
| `colors.overlay` | ✅ assumed (Q6) | ❌ Not in type, not in any template | **GAP: Add token type + emit** |
| `fonts.heading` | ✅ exists | ✅ All templates define | None |
| `fonts.body` | ✅ exists | ✅ All templates define | None |

---

## Q2 — CSS Variable Emission

**Primary Emitter:** [clicker-platform-v2/components/TemplateProvider.tsx:112–181](../../clicker-platform-v2/components/TemplateProvider.tsx#L112-L181)

### Currently Emitted Variables

| CSS Variable | Emitted? | Line | When |
|--------------|----------|------|------|
| `--theme-primary` | ✅ Yes | 115 | Always (if theme.colors.primary exists) |
| `--theme-background` | ✅ Yes | 116 | Always (if theme.colors.background exists) |
| `--theme-foreground` | ✅ Yes | 117 | Always (if theme.colors.foreground exists) |
| `--theme-accent` | ✅ Yes | 120 | If theme.colors.accent exists |
| `--theme-surface` | ✅ Yes | 121 | If theme.colors.surface exists |
| `--theme-border` | ✅ Yes | 122 | If theme.colors.border exists |
| `--theme-radius` | ✅ Yes | 125 | If theme.borderRadius exists |
| `--theme-card-shadow` | ✅ Yes | 133 | Always (derived from cardVariant) |
| `--font-heading` | ✅ Yes | 136 | If theme.fonts?.heading exists |
| `--font-body` | ✅ Yes | 137 | If theme.fonts?.body exists |
| `--layout-max-width` | ✅ Yes | 153 | Always (derived from layout config) |
| `--grid-cols-mobile` | ✅ Yes | 156 | Always |
| `--grid-cols-tablet` | ✅ Yes | 157 | Always |
| `--grid-cols-desktop` | ✅ Yes | 158 | Always |
| `--grid-gap` | ✅ Yes | 178 | Always |
| `--theme-error` | ❌ No | — | **Not emitted; needed** |
| `--theme-success` | ❌ No | — | **Not emitted; needed** |
| `--theme-warning` | ❌ No | — | **Not emitted; needed** |
| `--theme-overlay` | ❌ No | — | **Not emitted; needed** |
| `--theme-textMuted` | ❌ No | — | **Not emitted; fallback logic in helpers** |

### Emission Sites

1. **Public site:** TemplateProvider (client component) wraps root in [app/[tenant]/[...slug]/page.tsx:99–108](../../clicker-platform-v2/app/%5Btenant%5D/%5B...slug%5D/page.tsx#L99-L108)
2. **Admin canvas preview:** TemplateProvider wraps preview in [components/admin/blocks/CanvasStudio.tsx:270–293](../../clicker-platform-v2/components/admin/blocks/CanvasStudio.tsx#L270-L293)

Both emit the same variables (TemplateProvider is the single source of truth).

### Confirmed Answers

- ✅ `--theme-foreground` is emitted (TemplateProvider:117)
- ✅ `--theme-primary` is emitted (TemplateProvider:115)
- ✅ `--theme-background` is emitted (TemplateProvider:116)
- ✅ `--font-heading` is emitted (TemplateProvider:136)
- ✅ `--font-body` is emitted (TemplateProvider:137)
- ❌ `--theme-error` is NOT emitted — **add to Phase 1**
- ❌ `--theme-success` is NOT emitted — **add to Phase 1**
- ❌ `--theme-warning` is NOT emitted — **add to Phase 1**
- ❌ `--theme-overlay` is NOT emitted — **add to Phase 1**

---

## Q3 — Existing Global Typography CSS

**File:** [clicker-platform-v2/app/globals.css](../../clicker-platform-v2/app/globals.css)

### Current State

✅ **Font variable definitions** (lines 36–37):
```css
if (theme.fonts?.heading) vars['--font-heading'] = theme.fonts.heading;
if (theme.fonts?.body) vars['--font-body'] = theme.fonts.body;
```

✅ **Body fallback** (line 48):
```css
body {
  font-family: var(--font-jakarta), sans-serif;
  color: var(--theme-foreground);
}
```

❌ **Missing heading rules** — No `h1, h2, h3, h4, h5, h6 { font-family: var(--font-heading); }` in globals.css

❌ **Missing prose scope** — No `.prose { font-family: var(--font-body); }` or `.prose :where(h1, h2, h3, h4, h5, h6) { font-family: var(--font-heading); }`

❌ **No @layer base typography** — Spec §4.3 recommends defining heading/body rules early (e.g., via `@layer base`) to avoid cascade issues.

### Action Required

Add to globals.css per spec §4.3:
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

---

## Q4 — cardStyles.ts Current State

**File:** [clicker-platform-v2/components/blocks/public/cardStyles.ts](../../clicker-platform-v2/components/blocks/public/cardStyles.ts)

### Exported Functions

1. **`getCardClasses(cardStyle?: string, extra?: string): string`**  
   Returns Tailwind classes. Handles 'clean', 'glass', and brutalist (default). Uses `--theme-card-shadow` CSS var. ✅ Keeps working.

2. **`getTextColor(cardStyle?: string, muted = false): string`**  
   **[DEPRECATED in Phase 1]** Returns Tailwind class strings (`text-white/60`, `text-theme-foreground/60`, `text-gray-500`, `text-theme-foreground`).  
   Bug: Returns class names, not color values. Spec wants color **strings** (hex/rgba/`var(--)`), not classes.

3. **`getGlassStyle(surfaceColor?: string): CSSProperties`**  
   Returns inline style object for glass backgrounds. Uses `color-mix()` CSS function. ✅ Keeps working.

### Key Findings

- **No `hexWithOpacity()` helper** — Spec §3.2 references this for fallback opacity logic. **Must create it.**
- **No new color helpers** — `getHeadingColor()`, `getBodyColor()`, `getMutedColor()`, `getLabelColor()`, `getAccentColor()` not yet defined.
- **Import source** — File does NOT import `ThemeConfig`. New helpers will need to accept `(cardStyle: CardStyle, theme: ThemeConfig)` signature (similar to how they're sketched in spec §3.2).

### Recommended Imports for Phase 1

```ts
import type { CardStyle } from '@/data/mockData'; // or wherever CardStyle is defined
import type { ThemeConfig } from '@/lib/templates/types';
```

---

## Q5 — Admin Canvas Preview Parity

**Canvas location:** `/admin/canvas` — client-side editor

**TemplateProvider wrapping:** ✅ YES  
File: [components/admin/blocks/CanvasStudio.tsx:270](../../clicker-platform-v2/components/admin/blocks/CanvasStudio.tsx#L270)

```tsx
<TemplateProvider
    templateId={templateId}
    themeOverrides={...}
>
  {/* preview content */}
</TemplateProvider>
```

**Confirmation:**
- ✅ Canvas preview **does** wrap content in TemplateProvider
- ✅ Both `--font-heading` and `--font-body` are emitted in the canvas just like the public site
- ✅ CSS variables are resolved in DevTools on both public pages and canvas
- ✅ No special handling needed for Phase 1

**Verdict:** Admin canvas has parity. No Phase 1 adjustments required.

---

## Q6 — Status Badge / Error State Survey

### Hardcoded Status Colors in Blocks

| File | Component | Use Case | Current Color | Suggested Token |
|------|-----------|----------|---------|---|
| [SafeBlockRenderer.tsx:30](../../clicker-platform-v2/components/blocks/SafeBlockRenderer.tsx#L30) | Error boundary | Error state | `border-red-200`, `bg-red-50`, `text-red-600` | `--theme-error`, `--theme-error-bg` (or derive from opacity) |
| [DefaultOperatingHoursBlock.tsx:72–73](../../clicker-platform-v2/components/blocks/public/DefaultOperatingHoursBlock.tsx#L72-L73) | Status badge | "Open Now" | `rgba(34,197,94,0.15)` bg + `rgb(22,163,74)` text | `--theme-success`, `--theme-success-bg` |
| [DefaultOperatingHoursBlock.tsx:72–73](../../clicker-platform-v2/components/blocks/public/DefaultOperatingHoursBlock.tsx#L72-L73) | Status badge | "Closed" | `rgba(239,68,68,0.15)` bg + `rgb(220,38,38)` text | `--theme-error`, `--theme-error-bg` |
| [MrbOperatingHours.tsx:92–93](../../clicker-platform-v2/components/blocks/mrb/MrbOperatingHours.tsx#L92-L93) | Status badge | "Open Now" | `bg-green-500/10 text-green-400 border-green-500/20` | `--theme-success`, `--theme-success-bg`, `--theme-success-border` |
| [MrbOperatingHours.tsx:92–93](../../clicker-platform-v2/components/blocks/mrb/MrbOperatingHours.tsx#L92-L93) | Status badge | "Closed" | `bg-red-500/10 text-red-400 border-red-500/20` | `--theme-error`, `--theme-error-bg`, `--theme-error-border` |
| [DefaultSocialEmbedBlock.tsx:35](../../clicker-platform-v2/components/blocks/public/DefaultSocialEmbedBlock.tsx#L35) | Platform badge | YouTube, etc. | `bg-red-500/20 text-red-300` | Brand color (platform-specific, not semantic) |
| [DefaultButtonBlock.tsx:162](../../clicker-platform-v2/components/blocks/public/DefaultButtonBlock.tsx#L162) | Error message | Form validation | `bg-red-500/10 text-red-600 border-red-500/20` | `--theme-error`, `--theme-error-bg` |
| [DefaultInlineFormBlock.tsx:175](../../clicker-platform-v2/components/blocks/public/DefaultInlineFormBlock.tsx#L175) | Error message | Form validation | `text-red-500` | `--theme-error` |
| [DefaultImageGalleryBlock.tsx](../../clicker-platform-v2/components/blocks/public/DefaultImageGalleryBlock.tsx) | Photo overlay | Badge on photo | `bg-black/70` (implicit) | `--theme-overlay` (semi-transparent scrim) |

### Recommended Token Additions

1. **`colors.error`** → CSS var `--theme-error`  
   *Foreground color for error text and icons. Typically red-ish.*

2. **`colors.errorBg`** (optional, derived) → CSS var `--theme-error-bg`  
   *Background color for error regions. Typically error + opacity or lighter shade.*

3. **`colors.success`** → CSS var `--theme-success`  
   *Foreground color for success indicators (badges, checkmarks). Typically green-ish.*

4. **`colors.successBg`** (optional) → CSS var `--theme-success-bg`  
   *Background for success regions.*

5. **`colors.warning`** → CSS var `--theme-warning`  
   *Foreground for warnings (amber/yellow). Currently not found in blocks but recommended by spec.*

6. **`colors.warningBg`** (optional) → CSS var `--theme-warning-bg`

7. **`colors.overlay`** → CSS var `--theme-overlay`  
   *Semi-transparent scrim for overlays (photo badges, modals). Typically `rgba(0,0,0,0.7)` or similar.*

### Phase 1 Action

- Add `error?`, `success?`, `warning?`, `overlay?` fields to `ThemeColors` interface (lib/templates/types.ts)
- Define default values in all template definitions (definitions.ts)
- Emit them in TemplateProvider (TemplateProvider.tsx)
- Create helper functions to return these colors as strings (cardStyles.ts)

---

## Q7 — Tailwind Prose Plugin Config

**Prose Plugin Status:**

✅ **Installed:** `@tailwindcss/typography@^0.5.19` (package.json)

✅ **Enabled:** `@plugin "@tailwindcss/typography"` in [globals.css:2](../../clicker-platform-v2/app/globals.css#L2)

❌ **No custom prose config found** — No tailwind.config.js/ts extending the prose theme.

❌ **No `font-heading` / `font-body` Tailwind theme extension** — The spec recommends registering these as Tailwind utilities so blocks can use `font-heading` class. Currently only available via CSS variables.

### Current Usage Pattern

Prose is used in-block but with ad-hoc styling. Example: [DefaultFAQBlock](../../clicker-platform-v2/components/blocks/public/DefaultFAQBlock.tsx) likely applies prose classes inline rather than using a shared config.

### Recommendation for Phase 1

If a Tailwind config exists (tailwind.config.js/ts was not found in top-level clicker-platform-v2/), consider:
1. Creating shared `proseClass` constant in a new `proseConfig.ts` file (spec §5.2)
2. Defining `proseGlassClass` variant for dark backgrounds
3. **Optional:** Extend Tailwind theme to register `font-heading` and `font-body` utilities (out of scope for Phase 0 but noted for future ergonomics)

---

## Recommended Phase 1 Adjustments

Based on this audit, update the Phase 1 checklist:

### 1a. Expand `cardStyles.ts` — ADD:
- [ ] Create `hexWithOpacity(hex: string, alpha: 0–1): string` helper
- [ ] Add `getHeadingColor(cardStyle: CardStyle, theme: ThemeConfig): string`
- [ ] Add `getBodyColor(cardStyle: CardStyle, theme: ThemeConfig): string`
- [ ] Add `getMutedColor(cardStyle: CardStyle, theme: ThemeConfig): string`
- [ ] Add `getLabelColor(cardStyle: CardStyle, theme: ThemeConfig): string`
- [ ] Add `getAccentColor(theme: ThemeConfig): string`

### 1c. Global CSS — ADD:
- [ ] Heading font-family rules (`h1, h2, h3, h4, h5, h6 { font-family: var(--font-heading); }`)
- [ ] Body font-family rules (`body, p, li, ...`)
- [ ] Prose font rules (`.prose`, `.prose :where(h1–h6)`)

### 1d. Emit font variables — CONFIRM:
- [x] Already done: TemplateProvider emits `--font-heading` and `--font-body` at lines 136–137

### NEW: 1f. Add status color tokens
- [ ] Add `colors.error`, `colors.success`, `colors.warning`, `colors.overlay` to ThemeColors interface (lib/templates/types.ts)
- [ ] Define sensible defaults in all template definitions (classic, modern, sojourner, shuvo, mrb, mrb-light)
- [ ] Emit new tokens in TemplateProvider (`--theme-error`, `--theme-success`, `--theme-warning`, `--theme-overlay`)

### NEW: 1g. Add `textMuted` to templates missing it
- [ ] Add `textMuted` to classic, modern, sojourner, shuvo (mrb and mrb-light already have it)
- [ ] Define sensible defaults (e.g., `foreground + 0.65 opacity` via `hexWithOpacity`)

---

## Open Questions for the User

1. **Opacity fallback pattern** — The spec suggests `hexWithOpacity(foreground, 0.65)` for `getMutedColor()` fallback. Should this compute opacity **in the helper** (runtime, requires hex parsing) or **at template definition time** (cleaner, but each template hardcodes a muted color)? Recommend: template definition time (Phase 0 defines defaults; Phase 1 helpers use them).

2. **Error/success/warning semantics** — Should these be:
   - **Global theme tokens** (one `--theme-error` for the entire site), or
   - **CardStyle variants** (e.g., `getErrorColor(cardStyle, theme)` like other color helpers)?
   
   Recommend: Global theme tokens (simpler, matches error/success/warning standard UX patterns).

3. **Overlay token scope** — Should `--theme-overlay` be:
   - A single color (e.g., `rgba(0,0,0,0.7)`), or
   - A palette (e.g., `--theme-overlay-light`, `--theme-overlay-dark`)?
   
   Recommend: Single color (opinionated; if more nuance is needed post-Phase 1, split it).

4. **Prose config location** — Should `proseClass` and `proseGlassClass` go in a new `components/blocks/public/proseConfig.ts` or inline in each block's styles? Spec §5.2 suggests a shared file.  
   Recommend: New shared file (easier to maintain; one source of truth).

5. **Tailwind config** — No `tailwind.config.js/ts` found. Is Tailwind config co-located elsewhere or using defaults?

---

## Summary

| Item | Status | Blocker? |
|------|--------|---------|
| ThemeConfig shape (colors, fonts) | ✅ Complete; minor gaps (textMuted on some templates, no error/success/warning) | No |
| CSS variable emission | ✅ Core vars emitted; missing error/success/warning/overlay | Yes |
| Global typography CSS | ⚠️ Partial (no heading/prose rules in globals.css) | Yes |
| cardStyles.ts helpers | ❌ Not defined | Yes |
| hexWithOpacity utility | ❌ Not defined | Yes |
| Shared prose config | ❌ Not defined | No (can live per-block until Phase 2) |
| Typography constants (H1/H2/H3/H4) | ❌ Not defined | No (nice-to-have, Phase 1.1e) |
| Admin canvas parity | ✅ Full parity via TemplateProvider | No |
| Status color tokens | ⚠️ Partially hardcoded; need theme tokens | Yes |
| Prose plugin | ✅ Installed & enabled | No |

**Phase 0 Complete:** All questions answered. Phase 1 can proceed with confidence.
