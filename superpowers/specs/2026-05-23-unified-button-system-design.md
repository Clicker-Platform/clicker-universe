# Unified Button System — Design Spec

**Date:** 2026-05-23
**Status:** Approved, ready for implementation plan
**Related:** Site Styles → Buttons panel (placeholder exists); Font Pack system (architectural sibling)

---

## Purpose

Replace ad-hoc button styling scattered across blocks with a single site-wide button system. One `<UnifiedButton>` component, one Site Styles → Buttons admin panel, one pack-based token pipeline. Mirrors the Font Pack architecture.

**Why now:** `DefaultButtonBlock.tsx` branches on `theme.cardStyle` with three parallel variant tables; other blocks (Hero, QuickActions, Reservation, Featured Product, Inline Form, MRB variants) reimplement their own button styling independently. Adding a new button visual requires editing every block. Custom button color overrides are not possible — buttons always follow `--theme-primary`, which conflicts with the principle that buttons are functional UI, not brand decoration.

---

## Core Principles

1. **Buttons are functional, not brand.** Default colors are neutral near-black, independent of theme primary. Brand expression happens elsewhere (hero, typography, color palette).
2. **One global pack, no per-block shape override.** Same model as Font Pack — pick one, every block inherits. Per-block override is out of scope.
3. **Shape from pack, color independent.** Pack defines radius, padding, weight, tracking, tertiary treatment. Color is a separate, site-wide override (5 fields).
4. **Auto-contrast where it matters.** Primary text defaults to WCAG-correct black or white based on fill luminance. Manual override available.
5. **Three semantic tiers.** Primary / Secondary / Tertiary. Visual hierarchy, not visual treatment.
6. **Three sizes per pack.** sm / md / lg. Blocks choose where it makes sense; hardcode where it doesn't.

---

## Data Model

### `site.appearance` additions

```ts
type ButtonPackId = 'pill' | 'soft' | 'brutalist' | 'glass' | 'underlined';

interface ButtonColors {
  primaryFill: string;      // hex; default '#111111'
  primaryText?: string;     // hex; optional override. If omitted, auto-contrast.
  secondaryBorder: string;  // hex; default '#111111'
  secondaryText: string;    // hex; default '#111111'
  tertiaryText: string;     // hex; default '#111111'
}

interface SiteAppearance {
  // ...existing fields
  buttonPackId: ButtonPackId;   // default 'pill'
  buttonColors: ButtonColors;
}
```

Defaults seed on new sites; existing sites get defaults via lazy fallback in the provider (no migration script).

### Block field changes — `DefaultButtonBlock.data`

- **Add:** `tier: 'primary' | 'secondary' | 'tertiary'`
- **Add:** `size?: 'sm' | 'md' | 'lg'` (default `'md'`)
- **Deprecate:** `variant` (kept readable for back-compat shim)

**Back-compat shim** (in `<UnifiedButton>`'s consumer, not a data migration):

```ts
const tier: Tier =
  data.tier
  ?? (data.variant === 'outline' ? 'secondary' : data.variant)
  ?? 'primary';
```

No Firestore migration. Old docs render correctly via the shim. Field rename surfaces in admin form only — old saved docs work indefinitely.

---

## Architecture (3 layers)

### Layer 1 — Pack definitions

**Location:** `lib/buttonPacks/definitions.ts`

```ts
interface ButtonPack {
  id: ButtonPackId;
  displayName: string;
  radius: number;              // px
  borderWidth: number;         // px (used by secondary tier)
  fontWeight: number;
  letterSpacing: string;       // '0em' | '0.06em' | etc.
  textTransform: 'none' | 'uppercase';
  sizes: {
    sm: { padY: number; padX: number; fontSize: number };
    md: { padY: number; padX: number; fontSize: number };
    lg: { padY: number; padX: number; fontSize: number };
  };
  tertiaryStyle: 'underline' | 'arrow' | 'plain';
}

export const BUTTON_PACKS: Record<ButtonPackId, ButtonPack> = {
  pill:       { /* radius: 9999, weight: 600, tracking: 0,    tertiary: underline */ },
  soft:       { /* radius: 6,    weight: 600, tracking: 0,    tertiary: arrow */ },
  brutalist:  { /* radius: 0,    weight: 700, tracking: .08,  uppercase, tertiary: underline */ },
  glass:      { /* radius: 12,   weight: 600, tracking: 0,    tertiary: arrow */ },
  underlined: { /* radius: 0,    weight: 600, tracking: 0,    tertiary: plain */ },
};

export const DEFAULT_BUTTON_PACK_ID: ButtonPackId = 'pill';
```

Pure data, no React. Mirrors `lib/fonts/packs.ts`.

### Layer 2 — Token emission

**Location:** `components/ButtonPackProvider.tsx`, called from `ThemeRegistry` alongside font tokens.

Reads `site.appearance.buttonPackId` + `buttonColors`, emits CSS variables on `:root` (or scoped to `[data-button-pack]`):

```
--btn-radius
--btn-border-width
--btn-font-weight
--btn-tracking
--btn-transform

--btn-sm-pad-y, --btn-sm-pad-x, --btn-sm-font
--btn-md-pad-y, --btn-md-pad-x, --btn-md-font
--btn-lg-pad-y, --btn-lg-pad-x, --btn-lg-font

--btn-primary-fill
--btn-primary-text          /* auto-computed if buttonColors.primaryText empty */
--btn-secondary-border
--btn-secondary-text
--btn-tertiary-text
```

The provider also exposes `tertiaryStyle` via a `data-tertiary-style="underline|arrow|plain"` attribute on the root, so `<UnifiedButton>` can switch tertiary rendering without runtime context.

### Layer 3 — `<UnifiedButton>`

**Location:** `components/ui/UnifiedButton.tsx`

```tsx
interface UnifiedButtonProps {
  tier: 'primary' | 'secondary' | 'tertiary';
  size?: 'sm' | 'md' | 'lg';          // default 'md'
  children: React.ReactNode;

  // polymorphic action — one must be provided
  href?: string;                       // routes to <Link> or <a> based on href shape
  onClick?: (e: React.MouseEvent) => void;

  fullWidth?: boolean;
  disabled?: boolean;
  external?: boolean;                  // auto-detected from href if omitted; controls target/rel
  loading?: boolean;                   // shows 'Loading…' label, disables interaction
  className?: string;                  // escape hatch; appended last
}
```

**Polymorphism logic** (replicating current `DefaultButtonBlock`):
- `href` matches `^(https?:\/\/|mailto:|tel:)` → `<a target rel>`
- `href` matches `^(\/|#)` → Next `<Link>`
- `onClick` only → `<button type="button">`
- Neither → `<span>` (preview / disabled state)

**Styling:** all visual properties come from CSS variables. No conditionals on `theme.cardStyle`, no Tailwind variant tables. One Tailwind class string parameterized by `tier` + `size` data-attributes.

```tsx
<a
  data-tier={tier}
  data-size={size}
  data-fullwidth={fullWidth || undefined}
  className="ub-root"
  ...
>{children}</a>
```

CSS lives in a co-located stylesheet or globals — selectors read `[data-tier="primary"]`, `[data-size="lg"]`, etc., pulling from `--btn-*` variables.

### Auto-contrast helper

**Location:** `lib/buttonPacks/contrast.ts` (~20 lines)

```ts
export function pickContrastText(hex: string): '#000000' | '#ffffff' {
  // WCAG relative luminance
  const { r, g, b } = parseHex(hex);
  const lum = relativeLuminance(r, g, b);
  return lum > 0.5 ? '#000000' : '#ffffff';
}
```

Used by `ButtonPackProvider` when computing `--btn-primary-text` if `buttonColors.primaryText` is empty. Pure function, no deps.

---

## Admin UI — Site Styles → Buttons

Replaces "Coming soon" placeholder. Slide-over panel, ~520px wide, mirrors `FontPackCard` layout. Wireframe approved 2026-05-23.

### Three sections, top to bottom

1. **Pack** — 2-col grid of 5 pack cards. Each card renders the 3 tiers in mini-preview using that pack's tokens. Selected card gets blue border + checkmark.
2. **Colors** — five rows, each with label / hint / color chip / hex value. Primary Text row shows "AUTO · #FFF" pill and an "override" link; clicking override turns it into a normal color picker, "reset" link returns to auto.
3. **Preview** — live tile showing all 3 tiers × all 3 sizes with current settings. Updates instantly as user edits.

No sliders for radius/padding/size. Those are pack-defined; switch packs to change shape.

### Persistence

- Pack selection writes `sites/{id}.appearance.buttonPackId`
- Color edits write `sites/{id}.appearance.buttonColors.*`
- Both update live in the canvas preview (same mechanism as Font Pack)

---

## Block Migration Scope

Each migration is a small, isolated swap of local button JSX for `<UnifiedButton>`. Order matters only for `DefaultButtonBlock` (validates the back-compat shim).

| Block | Changes |
|---|---|
| `DefaultButtonBlock` | Refactor render; add `tier` + `size` form fields; keep `variant` shim. Reference implementation. |
| `DefaultHeroBlock` | CTA buttons → `<UnifiedButton size="lg">`. Form exposes `tier` only. |
| `DefaultQuickActionsBlock` | Action buttons → `<UnifiedButton size="md">`. |
| `DefaultFeaturedProductBlock` | CTA → `<UnifiedButton>`. |
| `ReservationBlock` | Submit + secondary actions → `<UnifiedButton>`. |
| `DefaultInlineFormBlock` | Submit button → `<UnifiedButton>`. |
| `MrbHero`, `MrbQuickActions` | Delete custom button code entirely — `glass` pack handles MRB natively. |

After migration, the `if (isGlass)` / `if (isClean)` branches in those files can be removed.

---

## Build Sequence

Sequential where dependencies exist, parallelizable from step 4.

1. **Pack definitions + types + contrast helper.** Pure data, no UI, no integration. Unit tests for `pickContrastText`.
2. **`<UnifiedButton>` component + dev preview page** at `/admin/_dev/buttons`. Visual QA across all 5 packs × 3 tiers × 3 sizes × 3 states (default, hover, disabled). Validates CSS variable pipeline before wiring to real data.
3. **`<ButtonPackProvider>`** wired into `ThemeRegistry`. CSS variables emit on page load with hardcoded test defaults. Verify variables appear in browser devtools.
4. **Admin Site Styles → Buttons panel.** Replaces "Coming soon". Pack picker, color editors, live preview. Writes to Firestore.
5. **Migrate `DefaultButtonBlock`.** Validates back-compat shim with legacy `variant: 'outline'` docs. Add new form fields (`tier`, `size`).
6. **Migrate remaining public blocks** one-by-one. Each is a self-contained diff.
7. **Delete dead code in MRB block variants** + `theme.cardStyle` branches in any migrated block.

Estimated 10–14h end-to-end. Parallelizable after step 3 (admin panel + block migrations can split).

---

## Out of Scope (deliberate)

- **Hover state customization.** Auto-derived: primary darkens fill 8%; secondary fills with border color.
- **Per-block color override.** Site-wide only. The "buttons are functional" principle implies they shouldn't shift per section. Revisit if real users hit the wall.
- **Custom radius outside pack.** Pack-defined. Add new pack instead.
- **Icons inside buttons.** Separate future work; current scope is text-only.
- **Disabled-state color customization.** Auto-derived: 50% opacity on the resolved colors.
- **Loading spinner styling.** Uses current theme accent. Existing `Loading…` label remains.
- **Per-tier radius/shape.** One shape per pack — Squarespace-style consistency.

---

## Open Questions

None. All decisions ratified in 2026-05-23 brainstorm.

---

## Acceptance Criteria

1. Site Styles → Buttons panel is fully functional, replacing the "Coming soon" card.
2. All 7 listed blocks render via `<UnifiedButton>` with no `theme.cardStyle` branching.
3. Switching pack in admin updates canvas preview live, no reload.
4. Color overrides persist; primary-text auto-contrast defaults work; manual override wins when set.
5. Legacy Button Block docs with `variant: 'outline'` continue rendering (as `secondary`) without edits.
6. No regressions in MRB template visual appearance — glass pack output matches current styling.
7. New `tier` and `size` fields appear in Button Block form; existing `variant` field hidden/removed from form (data shim still handles old docs).
