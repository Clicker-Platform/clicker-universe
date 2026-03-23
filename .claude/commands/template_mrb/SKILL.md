---
name: template_mrb
description: >
  Work with the MRB ("Mr Brightside") template — dark glassmorphism aesthetic with neon orange accents.
  Use this skill when modifying MRB-specific blocks, the MrbHeader, glass cardStyle styling,
  or fixing any component that renders incorrectly on the MRB site.
  Trigger on: "mrb template", "mr brightside", "glass style", "glass cardStyle", "dark template",
  "MrbHero", "MrbQuickActions", "MrbOperatingHours", "MrbHeader", "components/blocks/mrb/",
  or any block that looks wrong (white background, thick border, green color) on the MRB site.
---

> **Architecture Reference:** Always read [`docs/ARCHITECTURE.md`](../../../clicker-platform-v2/docs/ARCHITECTURE.md) before making any changes.


# /template_mrb — MRB Template Skill

You are working on the **MRB ("Mr Brightside") template** — a dark-mode glassmorphism template with neon orange accents. This skill covers the design system, block styling rules, file paths, and common pitfalls specific to MRB.

---

## Design System

MRB uses `cardStyle: 'glass'` and `allowThemeColorOverride: false` (palette is locked — user color changes don't apply).

| Token | Value | Purpose |
|---|---|---|
| `background` | `#0a0a0a` | Page background (near-black) |
| `foreground` | `#f8fafc` | Body text (off-white) |
| `primary` | `#ec5b13` | Neon orange — CTAs, highlights, accents |
| `accent` | `#ec5b13` | Same as primary |
| `surface` | `#1a1a1a` | Card / container backgrounds |
| `border` | `#262626` | Subtle borders |

CSS variables injected by `TemplateProvider` at runtime (on the wrapping `div[data-template="mrb"]`):
- `--theme-primary: #ec5b13`
- `--theme-background: #0a0a0a`
- `--theme-foreground: #f8fafc`
- `--theme-surface: #1a1a1a`
- `--theme-radius: 1rem`

---

## The Glass Styling Rule

**Every block component must have a dedicated `isGlass` branch. No block may fall through to brutalist/default styles under MRB.**

### Required 3-way pattern in every block

```tsx
const isClean = theme.cardStyle === 'clean';
const isGlass = theme.cardStyle === 'glass';
const isBold = !isClean && !isGlass;  // brutalist/default
```

### Glass visual spec

| Property | Tailwind | Inline style |
|---|---|---|
| Background | — | `background: 'rgba(26, 26, 26, 0.6)'` |
| Blur | `backdrop-blur-md` | `backdropFilter: 'blur(12px)'` |
| Border | `border border-white/10` | `border: '1px solid rgba(255,255,255,0.1)'` |
| Shadow | `shadow-xl` | `boxShadow: '0 8px 32px rgba(0,0,0,0.3)'` |
| Text (normal) | `text-white` | — |
| Text (muted) | `text-white/60` | — |
| Inner surface | `bg-white/5` | `background: 'rgba(255,255,255,0.05)'` |
| Hover highlight | `hover:bg-white/10` | — |
| Neon ring/border | `border-[var(--theme-primary)]/50` | — |

### Utility helpers (use these when possible)

From `components/blocks/public/cardStyles.ts`:

```ts
getCardClasses(cardStyle)
// glass → 'bg-black/20 backdrop-blur-md border border-white/10 shadow-xl overflow-hidden'
// clean → 'bg-white border border-gray-200 shadow-sm'
// default → 'bg-white border-[3px] border-theme-border shadow-sticker overflow-hidden'

getTextColor(cardStyle, muted?)
// glass → 'text-white' / 'text-white/60'
// default → 'text-theme-foreground' / 'text-gray-500'
```

---

## MRB-Specific Block Overrides

These files in `components/blocks/mrb/` **replace** the Default* counterparts entirely for MRB. They use `theme.colors.*` directly and do not check `cardStyle`.

| Block | File | Key characteristics |
|---|---|---|
| Hero | `MrbHero.tsx` | Full-bleed image with gradient overlay, two-tone name split, neon CTA buttons |
| QuickActions | `MrbQuickActions.tsx` | Glass cards with `glass-effect` class, neon highlight border |
| OperatingHours | `MrbOperatingHours.tsx` | Dark gradient card `from-[#262626] to-[#1a1a1a]`, `glass-effect` class |

Registered in `lib/templates/registry.ts` under `mrb.Blocks`.

All other blocks fall through to `Default*` components in `components/blocks/public/` — they must each have a correct `isGlass` branch.

---

## Block Audit Checklist

When adding or reviewing a block for MRB compatibility, verify:

- [ ] Declares `const isGlass = theme.cardStyle === 'glass'`
- [ ] `isBold` (if used) is `!isClean && !isGlass` — NOT `cardStyle !== 'clean'`
- [ ] Card container has glass branch: dark semi-transparent bg + blur + white/10 border
- [ ] Text uses `text-white` or `text-white/60` (not `text-gray-900` or inherited body color)
- [ ] No `bg-white`, `bg-gray-50`, `bg-gray-100` in glass branch
- [ ] No `border-[3px]`, `shadow-sticker`, `border-brand-dark`, `border-theme-border` in glass branch
- [ ] No `bg-brand-dark`, `bg-brand-green`, `text-brand-dark` anywhere in glass branch

---

## Header

`components/headers/MrbHeader.tsx` — minimal glassmorphic top bar. Used only by MRB.

---

## Common Gotchas

**`isBold = cardStyle !== 'clean'` is WRONG.**
For glass, this evaluates to `true`, making glass render as brutalist (white cards, thick borders). Always use `isBold = !isClean && !isGlass`.

**`text-theme-foreground` under MRB resolves to `#f8fafc` (off-white).**
This is correct on MRB's dark background. But if a block renders on a white/light card and uses `text-theme-foreground` without an explicit glass branch, text will appear nearly invisible.

**`body { color: var(--theme-foreground) }` cascades everywhere.**
Under MRB, `--theme-foreground` is `#f8fafc`. Any element without an explicit text color inherits off-white. This is intentional on the dark background but breaks light-colored sub-components (like modals or form inputs) that haven't been updated.

**`bg-brand-dark` is classic green (`#0E3B2E`), not MRB dark.**
Never use `bg-brand-dark` in MRB blocks. Use `style={{ backgroundColor: theme.colors.background }}` or `bg-[#0a0a0a]` / `bg-black/20` instead.

**`allowThemeColorOverride: false` — palette is locked.**
User-set `themeColor` does not apply to MRB. `TemplateProvider` skips the color override for this template. Do not rely on `themeColor` for MRB-specific styling.

**`--theme-radius` is `1rem` on MRB.**
All border-radius should use `var(--theme-radius)` or `calc(var(--theme-radius) * 0.75)` for inner elements.

---

## Critical File Paths

```
PLATFORM (clicker-platform-v2/):

MRB-specific blocks:
  components/blocks/mrb/MrbHero.tsx
  components/blocks/mrb/MrbQuickActions.tsx
  components/blocks/mrb/MrbOperatingHours.tsx

Header:
  components/headers/MrbHeader.tsx

Block styling utilities:
  components/blocks/public/cardStyles.ts        ← getCardClasses(), getTextColor()

Default blocks (must all have isGlass branch):
  components/blocks/public/DefaultTextBlock.tsx
  components/blocks/public/DefaultButtonBlock.tsx
  components/blocks/public/DefaultFAQBlock.tsx
  components/blocks/public/DefaultImageBlock.tsx
  components/blocks/public/DefaultImageGalleryBlock.tsx
  components/blocks/public/DefaultMapBlock.tsx
  components/blocks/public/DefaultHeroBlock.tsx
  components/blocks/public/ProductsBlockClient.tsx
  components/blocks/public/ReservationBlock.tsx
  components/LinkCard.tsx
  components/catalog/ProductCard.tsx
  components/FeaturedProduct.tsx
  components/BranchesList.tsx

Template registration:
  lib/templates/definitions.ts                  ← MRB config (colors, cardStyle, layout)
  lib/templates/registry.ts                     ← MRB component registrations (Header, Blocks)

Block dispatch:
  components/blocks/BlockRenderer.tsx           ← routes to MRB-specific or Default* components
  components/TemplateProvider.tsx               ← injects CSS vars, provides useTemplate()
```

---

## Architecture Rules

- **MRB block overrides are registered in `registry.ts` under `mrb.Blocks`.** `BlockRenderer` checks `customBlocks?.[Key]` first; if not found, falls through to `Default*`.
- **New MRB-specific block overrides go in `components/blocks/mrb/`.** File naming: `Mrb{BlockName}.tsx`. Register under `mrb.Blocks` in `registry.ts`.
- **Never import `firebase-admin` in block or header components.** These run client-side.
- **`useTemplate()` is imported from `@/components/TemplateProvider`** — not `@/lib/templates/TemplateProvider`.
- **After updating `lib/templates/definitions.ts`, seed Firestore:** `GET /api/admin/seed-templates` or use the "Seed Templates" button in `/admin/template`.
