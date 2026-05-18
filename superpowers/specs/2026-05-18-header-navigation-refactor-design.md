# Header Navigation Refactor — Design Spec

**Date:** 2026-05-18
**Status:** Approved, awaiting implementation plan
**Owner:** andre

## Goal

Refactor Header Navigation into a token-driven, variant-based chrome element owned by Canvas Studio. Templates contribute visual tokens (colors, fonts, radii) only; layout structure and behavior are configured per-tenant in the Canvas Studio properties panel. Same model as Canvas blocks: variant + properties.

## Motivation

Audit (2026-05-18) surfaced three problems with the current implementation:

1. **Hardcoded values bypass theme tokens** — `bg-white` avatar, `#e5e7eb` border fallback, `tracking-[0.2em]` letter-spacing, fixed font sizes. Dark templates render incorrectly.
2. **Template-owned headers** — each template (MRB, Shuvo, Classic, Modern) ships its own `Header` component in the template registry. Visual coherence is locked per template; no tenant choice. Couples header work to template rework.
3. **Single layout, no flexibility** — only one structure (logo-left, fixed, full-width). Tenants requesting different arrangements (logo-center, burger, sticky-on-scroll) cannot self-serve.

This refactor fixes all three simultaneously.

## Non-Goals (Phase 1)

- Sub-menu *rendering* (data model lands in Phase 1; UI and rendering deferred to Phase 2)
- Mega-menu / multi-column drop-downs
- Per-breakpoint variant selection (e.g., logo-center on desktop, burger on mobile)
- Search bar in header
- User account / avatar menu
- Animated logo transitions beyond CSS
- Per-link styling overrides
- "Scrolled state" preview toggle in the Canvas Studio panel

## Scoping Decisions (settled during brainstorm)

| Decision | Outcome |
|---|---|
| Refactor vs expand | Both — token discipline + new variants in one piece of work |
| Template vs tenant ownership | Template = tokens only. Tenant picks variant in Canvas Studio. |
| Variant model | Hybrid: variant = structure; width and scroll behavior are independent properties. |
| Variant launch set | All four: logo-left, logo-center, burger, logo-left-stacked |
| Typography control | Hybrid: preset is primary; Advanced disclosure exposes tracking + case overrides only |
| Typography scope | Nav links + CTA share a setting; logo is separate (often an image anyway) |
| Scroll behaviors | none, fixed, sticky-on-scroll-up, shrink-on-scroll |
| Scrolled-state background swap | Separate `scrolledAppearance` toggle, pairs with fixed/shrink |
| Sub-menu | Phase 1 = data field only (`children?`); Phase 2 = rendering |
| Architectural approach | Variant-per-file + shared wrapper (matches existing block pattern) |

## Data Model

Stored at `sites/{siteId}/content/siteSettings.navigation.header`.

```ts
type HeaderVariant = 'logo-left' | 'logo-center' | 'burger' | 'logo-left-stacked';
type ScrollBehavior = 'none' | 'fixed' | 'sticky-on-scroll-up' | 'shrink-on-scroll';
type ContainerWidth = 'full' | 'constrained';
type NavTextPreset = 'default' | 'tight' | 'spacious' | 'sentence-case';

interface NavigationItem {
  id: string;
  label: string;
  type: 'link' | 'page' | 'action' | 'url' | 'form';
  value: string;
  icon?: string;
  formId?: string;
  pageId?: string;
  enabled?: boolean;
  /** Phase 2 — schema-only in Phase 1, no rendering or editor UI */
  children?: NavigationItem[];
}

interface HeaderTypography {
  preset: NavTextPreset;
  trackingOverride?: 'normal' | 'tight' | 'wide';
  caseOverride?: 'uppercase' | 'none';
}

interface HeaderCTA {
  enabled: boolean;
  label: string;
  linkType: 'page' | 'form' | 'url' | 'action';
  linkValue: string;
  formId?: string;
  pageId?: string;
}

interface ScrolledAppearance {
  enabled: boolean;
  bgColor?: string;
  showBorder?: boolean;
}

interface HeaderNavigationConfig {
  variant: HeaderVariant;
  width: ContainerWidth;
  scrollBehavior: ScrollBehavior;
  items: NavigationItem[];
  cta: HeaderCTA;
  bgColor?: string;
  showBorder?: boolean;
  typography: HeaderTypography;
  scrolledAppearance: ScrolledAppearance;
}
```

### Defaults

**New sites:**
```ts
{
  variant: 'logo-left',
  width: 'constrained',
  scrollBehavior: 'fixed',
  items: [],
  cta: { enabled: false, label: '', linkType: 'url', linkValue: '' },
  typography: { preset: 'default' },
  scrolledAppearance: { enabled: false },
}
```

**Existing sites (migration — preserves today's look exactly):**
```ts
{
  variant: 'logo-left',
  width: 'full',                                   // matches today's full-bleed
  scrollBehavior: 'fixed',                         // matches today's fixed top-0
  items: legacy.navigation.topNav ?? [],
  cta: legacy.navigation.topNavActions?.cta ?? { enabled: false, label: '', linkType: 'url', linkValue: '' },
  bgColor: legacy.navigation.headerStyle?.bgColor,
  showBorder: legacy.navigation.headerStyle?.showBorder ?? true,
  typography: { preset: 'spacious' },              // matches today's tracking-[0.2em]
  scrolledAppearance: { enabled: false },
}
```

Migration is **lazy**: synthesized in the read path when `header` is absent, persisted on next save. No batch script. No destructive overwrite of legacy fields (they remain until a save naturally overwrites them).

## Component Architecture

```
components/layout/header/
├── HeaderNavigation.tsx          public wrapper, replaces ResponsiveNavBar
├── useScrollBehavior.ts          scroll hook → { hidden, visible, scrolled, shrunk }
├── useHeaderTypography.ts        resolves preset + overrides → className
├── HeaderShell.tsx               container: width, bg, border, positioning, scrolled-state swap
├── variants/
│   ├── LogoLeftHeader.tsx
│   ├── LogoCenterHeader.tsx
│   ├── BurgerHeader.tsx          owns its drop-down panel
│   ├── LogoLeftStackedHeader.tsx
│   └── index.ts                  variant registry { 'logo-left': LogoLeftHeader, ... }
└── parts/
    ├── NavLogo.tsx               uses theme.colors.surface (fixes hardcoded bg-white)
    ├── NavMenu.tsx               renders items; ignores children in Phase 1
    ├── NavCTA.tsx
    └── BurgerButton.tsx
```

### Responsibility split

| Layer | Owns |
|---|---|
| `HeaderNavigation` | reads config, runs `useScrollBehavior`, `useHeaderTypography`; picks variant from registry; passes normalized props |
| `HeaderShell` | width container (`full` → `w-full px-4`, `constrained` → `max-w-7xl mx-auto px-4`), background, border, positioning, height transition, scrolled-state class swap |
| Variant | pure structural JSX — receives `{ logo, items, cta, typographyClass, forceMobile }`, arranges them |
| `parts/*` | small atoms shared across variants |

### Scroll behavior details

| Value | Behavior |
|---|---|
| `none` | `position: relative`, no scroll listener |
| `fixed` | `position: fixed; top: 0; z-50` (today's behavior) |
| `sticky-on-scroll-up` | fixed, `translateY(-100%)` when scrollY delta is downward past 80px, `translateY(0)` on upward scroll |
| `shrink-on-scroll` | fixed, height transitions `h-20 → h-14` when `scrollY > 80`. Logo and CTA scale via CSS transition. |

`scrolledAppearance.enabled` swaps `bgColor` and re-evaluates `showBorder` when `scrollY > 80`. Applies to any non-`none` behavior.

**Canvas Studio preview:** `useScrollBehavior` accepts an optional `disabled` prop. `HeaderNavigation` passes `disabled={useContext(EditorContext) !== null}` so the hook short-circuits to `none` inside the Canvas preview. Preview always shows the unscrolled state. Faking scroll inside the preview iframe is out of scope.

### Selection model

Clicking the header in Canvas Studio resolves to `selection: { kind: 'chrome', chromeId: 'header' }`. Unchanged from today. Properties panel mounting is handled by existing `HeaderNavPanel` infrastructure.

## Settings Panel (`HeaderNavPanel`)

Reorganized top-down:

```
Header Navigation [GLOBAL SETTING]

LAYOUT
  Variant            [4 visual cards — stacked, full-width preview each]
  Width              [Full · Constrained]
  Scroll behavior    [None · Fixed · Sticky on scroll-up · Shrink on scroll]

NAV LINKS                                  [+ Add]
  [drag] Home          PAGE   [⌄] [🗑]
  [drag] Canvas Studio PAGE   [⌄] [🗑]
  ...

CTA BUTTON                                 [toggle]
  (when enabled) Label · Link type · Target

APPEARANCE
  Background color   [color · empty = theme default]
  Show border        [toggle · uses theme border token]
  Typography
    Style preset     [Default · Tight · Spacious · Sentence case]
    ▸ Advanced (collapsed)
      Tracking override   [Normal · Tight · Wide]
      Case override       [Uppercase · None]

SCROLLED STATE                             [toggle]
  (when enabled, scroll behavior ≠ none)
  Background color   [color]
  Show border        [toggle]
```

**Behavior rules:**
- Variant cards: 4 stacked, each showing the layout pattern as a mini nav-bar mockup
- Scrolled State section disabled with hint "Set Scroll behavior to enable" when `scrollBehavior === 'none'`
- Typography Advanced collapsed by default; expanding exposes only the overrides flagged as pain points (tracking + case)
- CTA section replaces today's scattered `topNavActions.cta` fields
- Sub-menu UI hidden in Phase 1 (data field exists, no editor for `children`)
- Auto-save: 600ms debounced merge write, status chip preserved

**Shared `SortableNavItem` component** — extracted from `HeaderNavPanel` and `ChromeBottomNavProperties` into a single shared component (resolves audit finding #1: duplicated drag/expand UI).

## Token Discipline

| Property | Token source | Notes |
|---|---|---|
| Header bg | `config.bgColor` ?? `theme.colors.background` | |
| Header border | `config.showBorder ? theme.colors.border : 'transparent'` | No hardcoded hex fallback |
| Nav text color | `theme.colors.foreground` | |
| Nav text muted | `${theme.colors.foreground}99` | |
| CTA bg | `theme.colors.primary` | |
| CTA text | `theme.colors.primaryForeground` | |
| Logo container bg | `theme.colors.surface` | Replaces hardcoded `bg-white` |
| Burger drop-down panel bg | `theme.colors.background` | |
| Scrolled bg | `config.scrolledAppearance.bgColor` ?? `theme.colors.background` | |

**Required template token:** Every template must define `theme.colors.border`. When absent in dev, emit a console warning and derive a fallback from `${theme.colors.foreground}26` (15% opacity). No hardcoded hex.

## Typography Presets

Applied as a className to nav links and CTA text.

| Preset | Size | Weight | Tracking | Case |
|---|---|---|---|---|
| `default` | `text-sm` | `font-medium` | `tracking-normal` | none |
| `tight` | `text-sm` | `font-semibold` | `tracking-tight` | `uppercase` |
| `spacious` | `text-xs` | `font-bold` | `tracking-[0.2em]` | `uppercase` |
| `sentence-case` | `text-base` | `font-medium` | `tracking-normal` | none |

`spacious` matches today's hardcoded look exactly — migration sets existing sites to this preset so nothing visually breaks. `default` is the new default for new sites and is the recommended fix for sites with overly-spaced tracking.

**Advanced overrides** (only fire when set):
- `trackingOverride`: `'normal' | 'tight' | 'wide'` → `tracking-normal | tracking-tight | tracking-wider`
- `caseOverride`: `'uppercase' | 'none'` → `text-transform`

Overrides cascade on top of the preset.

## Template Header Removal

Delete (per "template owns styles only"):
- `components/headers/MrbHeader.tsx`
- `components/headers/ShuvoHeader.tsx`
- `components/headers/ClassicProfileHeader.tsx`
- `components/headers/ModernProfileHeader.tsx`
- Any `Header` entry in `lib/templates/registry.ts`

Templates retain `theme.colors.*`, font families, radius/spacing scale. No header components.

**Pre-flight check:** each existing template-header is visually compared against `logo-left` + appropriate typography preset before deletion. MRB's glassmorphism aesthetic comes from `theme.colors` (dark bg + neon-orange accent) not the header component itself — verify in staging.

## Testing

**Unit (Vitest):**
- `useScrollBehavior` — given mocked `scrollY` deltas, returns correct state per `ScrollBehavior` value
- `useHeaderTypography` — preset + override combinations produce expected class strings
- Migration synthesizer — given legacy `navigation` shape (empty, partial, full), returns correct `HeaderNavigationConfig`
- `resolveNavHref` — pin existing behavior with tests covering `action:homepage`, page slugs, absolute URLs, subdomain vs path routing

**Component (RTL):**
- Each variant renders logo/menu/CTA in expected DOM order
- `HeaderShell` applies correct width class for `full` vs `constrained`
- `HeaderShell` swaps to `scrolledAppearance.bgColor` when `scrolled === true`
- Burger variant: clicking burger toggles `aria-expanded`, renders panel, Escape closes

**Manual visual smoke:**
- `/go/layout` on default site, MRB site, dark template — every variant × every scroll behavior renders without console warnings
- Canvas Studio preview shows correct variant; variant switch updates preview within 600ms
- `forceMobile` collapses non-burger variants appropriately; burger is identical mobile vs desktop

No E2E — none exist for this surface today.

## Risks

| Risk | Mitigation |
|---|---|
| Existing tenants visually regress | Migration preserves today's look (`width: full`, `typography: spacious`, `scrollBehavior: fixed`, `showBorder: true`) |
| Template removal breaks MRB / Shuvo branding | Pre-flight visual diff in staging; templates retain all visual tokens; only structural component removed |
| `children?` field unused → orphan data | Acceptable per scoping decision ("get ready on Phase 1"). JSDoc notes Phase 2 status. |
| Scroll behavior misbehaves in Canvas preview | `useScrollBehavior` short-circuits to `none` when inside `EditorContext` |
| `theme.colors.border` missing on templates | Dev warning + 15% foreground fallback; audit templates before launch |
| Auto-save races on rapid variant click | Existing 600ms debounce + `merge: true` write handles this |
| Burger drop-down accessibility | `aria-expanded`, focus trap, Escape-to-close — standard pattern |

## Phase 2 Preview (documentation only)

- Sub-menu rendering: drop-down on hover/click for desktop variants, accordion for burger and mobile
- `NavigationItem.children` editor UI in `HeaderNavPanel` ("+ Add sub-item" inside expanded items)
- Possibly per-breakpoint variant selection
- Possibly mega-menu variant

## File Inventory

**New files:**
- `components/layout/header/HeaderNavigation.tsx`
- `components/layout/header/HeaderShell.tsx`
- `components/layout/header/useScrollBehavior.ts`
- `components/layout/header/useHeaderTypography.ts`
- `components/layout/header/variants/LogoLeftHeader.tsx`
- `components/layout/header/variants/LogoCenterHeader.tsx`
- `components/layout/header/variants/BurgerHeader.tsx`
- `components/layout/header/variants/LogoLeftStackedHeader.tsx`
- `components/layout/header/variants/index.ts`
- `components/layout/header/parts/NavLogo.tsx`
- `components/layout/header/parts/NavMenu.tsx`
- `components/layout/header/parts/NavCTA.tsx`
- `components/layout/header/parts/BurgerButton.tsx`
- `components/admin/blocks/panels/shared/SortableNavItem.tsx` (extracted)
- `lib/migrations/headerNavigation.ts` (lazy migration synthesizer)

**Modified files:**
- `components/admin/blocks/panels/HeaderNavPanel.tsx` (full rewrite for new panel UX)
- `components/admin/blocks/panels/ChromeBottomNavProperties.tsx` (use shared `SortableNavItem`)
- `components/layout/NavigationProvider.tsx` (apply migration on read)
- `lib/hooks/useNavigationConfig.ts` (new return shape includes `header`)
- `components/layout/SharedPageLayout.tsx` (swap `ResponsiveNavBar` → `HeaderNavigation`)
- `components/admin/blocks/CanvasStudio.tsx` (swap `ResponsiveNavBar` → `HeaderNavigation`)
- `data/mockData.ts` (add new types)
- All template files in `lib/templates/` that reference a `Header` component (remove the entry)

**Deleted files:**
- `components/layout/ResponsiveNavBar.tsx`
- `components/headers/MrbHeader.tsx`
- `components/headers/ShuvoHeader.tsx`
- `components/headers/ClassicProfileHeader.tsx`
- `components/headers/ModernProfileHeader.tsx`
