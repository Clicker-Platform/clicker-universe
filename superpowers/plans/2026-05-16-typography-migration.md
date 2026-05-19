# Block Typography Migration — Plan

**Date:** 2026-05-16
**Spec:** [block-typography-system.md](../specs/2026-05-16-block-typography-system.md)
**Audit:** [typography-audit.md](../notes/2026-05-16-typography-audit.md)

Phased migration of all Canvas Studio public blocks to the unified typography system. Foundation-first: ship helpers + global CSS before touching blocks, so each block migration is a mechanical color/class swap rather than a redesign.

---

## Phase 0 — Pre-flight (1h)

**Goal:** Confirm theme-token surface area is sufficient before writing helpers.

- [ ] Audit `ThemeConfig` shape (`lib/templates/types.ts` or wherever defined). Confirm fields exist: `colors.foreground`, `colors.textMuted`, `colors.primary`, `colors.background`, `fonts.heading`, `fonts.body`. If any missing, add them with sensible defaults.
- [ ] Confirm CSS variables `--theme-foreground`, `--theme-primary`, `--theme-background` are already emitted at template root. Find where (likely `app/[slug]/page.tsx`, `lib/templates/.../Layout.tsx`, or a `ThemeProvider`).
- [ ] If `--font-heading` / `--font-body` not yet emitted, identify the single best spot to add them (template root, not per-block).
- [ ] Add `--theme-error`, `--theme-success`, `--theme-warning` tokens if missing (for SafeBlockRenderer and Operating Hours status badges).

**Done when:** A short doc-comment in `cardStyles.ts` can reference each token confidently.

---

## Phase 1 — Helpers + Global CSS (2h)

**Goal:** All infrastructure in place. No block changes yet.

### 1a. Expand `cardStyles.ts`

File: `clicker-platform-v2/components/blocks/public/cardStyles.ts`

- [ ] Add `getHeadingColor(cardStyle, theme)` — returns string
- [ ] Add `getBodyColor(cardStyle, theme)` — returns string
- [ ] Add `getMutedColor(cardStyle, theme)` — returns string
- [ ] Add `getLabelColor(cardStyle, theme)` — returns string
- [ ] Add `getAccentColor(theme)` — returns string (theme.primary)
- [ ] Add `hexWithOpacity(hex, alpha)` private helper if not already present
- [ ] Mark old `getTextColor(cardStyle, muted)` as `@deprecated` in JSDoc, keep working until Phase 4 completes
- [ ] Unit tests: 1 test per helper × 3 cardStyles (clean/glass/brutalist) = 15 tests. Verify glass returns `rgba(255,...)`, others return theme value.

### 1b. Shared prose config

New file: `clicker-platform-v2/components/blocks/public/proseConfig.ts`

- [ ] Export `proseClass` constant per spec §5.2
- [ ] Export `proseGlassClass` variant
- [ ] Document in JSDoc: when to use which

### 1c. Global CSS

File: `clicker-platform-v2/app/globals.css` (or template-scoped equivalent)

- [ ] Add `h1, h2, h3, h4, h5, h6 { font-family: var(--font-heading, system-ui); }`
- [ ] Add `body, p, li, dd, dt, td, th, input, button, textarea, select { font-family: var(--font-body, system-ui); }`
- [ ] Add `.prose` family rules per spec §4.3

### 1d. Emit `--font-heading` / `--font-body` at template root

- [ ] Locate template wrapper (e.g., `lib/templates/default/Layout.tsx`, MRB equivalent)
- [ ] Add CSS variable emission to the wrapper's root element style
- [ ] Verify in DevTools that variables resolve on a public page

### 1e. Token constants file (optional but recommended)

New file: `clicker-platform-v2/components/blocks/public/typography.ts`

- [ ] Export string constants for each tier so blocks `import { H1, H2, H3, H4, BODY, BODY_LG, BODY_SM } from '...'` instead of duplicating Tailwind class strings:

```ts
export const H1 = 'text-4xl md:text-6xl font-extrabold leading-tight tracking-tight';
export const H2 = 'text-3xl md:text-4xl font-bold leading-tight tracking-tight';
export const H3 = 'text-xl md:text-2xl font-semibold leading-snug';
export const H4 = 'text-xs md:text-sm font-bold tracking-[0.2em] uppercase';
export const BODY_LG = 'text-lg font-normal leading-normal';
export const BODY    = 'text-base font-normal leading-normal';
export const BODY_SM = 'text-sm font-normal leading-normal';
```

This makes block migrations a `className={H2}` swap instead of remembering five Tailwind classes. Strongly recommend.

**Done when:** New helpers + constants are importable; `pnpm test` passes; one smoke-test block (TextBlock or HeadingBlock) renders with global font CSS applied.

---

## Phase 2 — Block Migration (~6–8h, parallelizable)

**Goal:** Every public block uses the new system. Old `getTextColor` no longer referenced.

Migrate one block per commit so visual regressions are bisectable. Each block: swap to `H1/H2/H3/H4` constants + replace color logic with new helpers + remove inline `fontFamily`.

### 2a. Trivial migrations (mechanical class swap)

- [ ] `DefaultHeadingBlock.tsx` — already uses theme tokens; swap to H1/H2/H3/H4 constants
- [ ] `DefaultFAQBlock.tsx` — swap `getTextColor` → `getHeadingColor`/`getBodyColor`/`getMutedColor`; FAQ title → H2; question → H3; answer → migrate to **prose** (proseConfig)
- [ ] `DefaultBranchesBlock.tsx` — "Main Location" → H4; branch name → H3; address → body-sm via prose? (decision: no, single-line, just body-sm)
- [ ] `DefaultOperatingHoursBlock.tsx` — label → H4; rows → body-sm; status badge uses `var(--theme-success)` / `var(--theme-error)`

### 2b. Mid-complexity (color logic refactor)

- [ ] `DefaultQuickActionsBlock.tsx` — remove `resolvedFg`/`resolvedMuted` local logic; title → H4; link title → H3 (or body? — pick H3 since it's the primary actionable label); subtitle → body-sm; use helpers
- [ ] `LinkCard.tsx` — remove `bgColor/borderColor/fgColor/mutedColor` local derivation; title → H3; description → body-sm
- [ ] `ProductsBlockClient.tsx` — block title → H4; product name → H3; category label → H4 (eyebrow); price → body-sm; use helpers consistently (currently mixed)
- [ ] `DefaultFeatureCardsBlock.tsx` — section title → H2; card headline → H3; label → H4; body → body-sm via prose? (decision: no, short copy)
- [ ] `DefaultInlineFormBlock.tsx` — heading → H2; subheading → body-lg; remove `uppercase` / `tracking-wider` / `font-black` from button; button uses spec §8 rules

### 2c. Complex (luminance + variants)

- [ ] `DefaultHeroBlock.tsx` — title → H1; tagline → H4; subtitle → body-lg; **keep** luminance contrast logic for user-uploaded backgrounds (it's the legit exception in spec §3.1), but route fallback through `getHeadingColor`; remove inline `fontFamily`
- [ ] `DefaultFeaturedProductBlock.tsx` — name → H2 (drop `text-2xl md:text-3xl` ad-hoc); remove `isBold` typographic branching (keep card-surface branching); button per spec §8
- [ ] `DefaultContentShowcaseBlock.tsx` — row heading → H2; row content already prose, swap to shared `proseConfig`
- [ ] `DefaultTextBlock.tsx` — swap to shared `proseConfig` (already uses prose, just consolidate)

### 2d. Hardcoded-color cleanup

- [ ] `DefaultSocialEmbedBlock.tsx` — title → H4; remove `text-slate-400`, replace with `getLabelColor(...)`; platform-color labels (`text-pink-300` etc.) — decision: **keep as brand colors** but route through a `getPlatformColor(platform)` helper that returns a string (still no raw `text-pink-*` in the JSX)
- [ ] `DefaultImageGalleryBlock.tsx` — photo badge `text-white` + `bg-black/70` → use theme overlay token (add `--theme-overlay` in Phase 0 if not present)
- [ ] `SafeBlockRenderer.tsx` — error state uses `var(--theme-error)` / `var(--theme-error-bg)` (add tokens if missing)

### 2e. MRB overrides

- [ ] `MrbHero.tsx` — drop oversized `text-7xl md:text-8xl` variants; use H1; drop `tracking-tighter` and `leading-[0.95]`; keep pill tagline ornament (visual, not typographic); remove inline `fontFamily`
- [ ] `MrbOperatingHours.tsx` — adopt `getCardClasses()` like Default; align row gap (`space-y-1` to match Default, or update Default to `space-y-1.5` — pick one); same H4/body-sm tokens
- [ ] `MrbHeader.tsx` — audit for hardcoded colors, fontFamily inline; clean up
- [ ] `MrbQuickActions.tsx` — same as DefaultQuickActionsBlock migration

### 2f. Non-text blocks (verify no typography to migrate)

- [ ] `DefaultButtonBlock.tsx` — spec §8: `text-sm md:text-base`, `font-semibold`, no uppercase, no tracking-wider; refactor `getVariantClass()` to consume color helpers
- [ ] `DefaultImageBlock.tsx`, `DefaultMapBlock.tsx` — no headings; verify no stray text styles
- [ ] `DefaultColumnsBlock.tsx`, `DefaultGridBlock.tsx` — container only, no own typography

**Done when:** `grep -rE "text-(slate|gray|neutral|white|black)-[0-9]" components/blocks/public components/blocks/mrb` returns nothing; no inline `fontFamily: theme.fonts.*` in blocks; all `getTextColor` calls replaced.

---

## Phase 3 — Enforcement (1h)

**Goal:** Backslide is impossible.

- [ ] Add ESLint rules per spec §11.1 to `.eslintrc` (or platform's eslint config)
- [ ] Add `pnpm lint:typography` script if useful (could be a focused ESLint run on `components/blocks/**`)
- [ ] Run `pnpm lint` — should pass cleanly post-migration
- [ ] Verify CI runs the new lint rules

---

## Phase 4 — Cleanup + Docs (1h)

- [ ] Delete deprecated `getTextColor` from `cardStyles.ts` (or leave as `throw new Error('removed')` for one release if external code might use it — unlikely)
- [ ] Update `.claude/commands/canvas_studio/SKILL.md` — add "Typography" section pointing to spec + a quick-reference (the §12 token block from the spec)
- [ ] Create `.claude/commands/typography_system/` skill (see below)
- [ ] Add brief CHANGELOG entry or update ARCHITECTURE.md if it mentions block styling

---

## Phase 5 — Visual QA (1–2h)

**Goal:** Confirm no regressions on real tenant sites.

- [ ] Spin up dev (`pnpm dev`) and load Default template demo page with every block type
- [ ] Compare side-by-side with staging (or pre-migration screenshots) for: Hero, FAQ, ContentShowcase, FeaturedProduct, Operating Hours, QuickActions
- [ ] Repeat for MRB template
- [ ] Mobile viewport check (375px) — verify responsive scaling kicks in for previously non-responsive blocks (FAQ, QuickActions, Products)
- [ ] Glass cardStyle check — verify white-on-dark text still legible
- [ ] Note any visual regressions; either accept (intentional consolidation) or file a fix
- [ ] Save before/after screenshots to `superpowers/notes/2026-05-16-typography-qa-screens/` for the record

---

## Skill: `typography_system`

New skill at `.claude/commands/typography_system/SKILL.md` (or whatever the harness's skill path is — match existing convention).

**Frontmatter:**
```yaml
---
name: typography_system
description: Use when authoring or modifying any Canvas Studio block component. Enforces the H1–H4 scale, color helper API, no-hardcoded-colors rule, and prose plugin adoption per the 2026-05-16 typography spec. Trigger on any work in components/blocks/public/, components/blocks/mrb/, or when adding a new block type.
---
```

**Body sections (rough outline — write during Phase 4):**
1. Quick reference — the §12 token block from the spec, copy-pasted
2. "Which H-tier?" decision table — block role → tier
3. Color helpers — when to call which
4. Forbidden patterns (with copy-pasteable examples of wrong vs right)
5. Adding a new block — checklist (which tier for each heading, which helper for each color)
6. Pointer to spec + audit for deeper questions

This skill exists so future block authors (Claude or human) don't reintroduce the chaos.

---

## Estimated Total

| Phase | Hours |
|-------|-------|
| 0 — Pre-flight | 1 |
| 1 — Helpers + CSS | 2 |
| 2 — Block migration | 6–8 |
| 3 — Enforcement | 1 |
| 4 — Cleanup + docs | 1 |
| 5 — Visual QA | 1–2 |
| **Total** | **12–15h** |

Can be parallelized: Phase 2 sub-tasks are independent once Phase 1 ships. Two operators could split 2a/2b vs 2c/2e.

---

## Risk & Rollback

**Highest risk:** Phase 2c (Hero luminance logic). If contrast computation breaks for user-uploaded backgrounds, text becomes unreadable. Mitigation: keep the existing `resolveTextOnBg()` utility intact; only change the **fallback** path to use helpers.

**Rollback strategy:** Each phase is its own commit (or PR). Phase 1 is additive (helpers added, nothing removed) so safe by default. Phase 2 commits per-block — revert individually if a regression appears.

**Pre-commit safety:** Run `pnpm test && pnpm lint && pnpm build` before merging each phase.

---

## Tracking

Suggest a single tracking issue or short Linear task list mirroring the checkboxes above. Each Phase 2 sub-task is one commit.
