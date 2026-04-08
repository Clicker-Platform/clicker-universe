# Architecture Decision Log: Block Builder & Platform Restructure

**Session date:** 2026-04-05
**Status:** Brainstorm complete — open questions identified, implementation not yet started

---

## Context

This document captures the architectural decisions and reasoning from a deep brainstorm session covering the Block Builder system, the Template concept, Canvas Studio, and the Page rendering model. It supersedes the original `block_builder_implementation_plan.md`.

---

## Part 1: Template System

### Decision: Templates own Tokens + Decorations only

**Settled:** Yes

Templates no longer own layout. The full scope of what a template is responsible for:

```
Template owns:
  ✅ Design tokens — colors, typography, border, radius
  ✅ Decorations — atmospheric effects unique to the template identity
                   (e.g. glass/blur effect, neon glow, background texture)
                   Expressed as a structured config, not hardcoded CSS

Template does NOT own:
  ❌ Block layout overrides (TemplateComponents.Blocks.*)
  ❌ Page structure
  ❌ Block-level DOM
  ❌ Header/Footer layout
```

**Why:** Two sites on the same template must be allowed to have completely different page layouts. Template identity comes from visual tokens, not structural constraints.

**Decorations example:**
```typescript
decorations?: {
    cardStyle: 'glass' | 'solid' | 'outline';
    backgroundEffect: 'none' | 'noise' | 'gradient-mesh' | 'blur';
    glowColor?: string; // references a token, not hardcoded
}
```

---

### Decision: `TemplateComponents.Blocks` is deprecated

**Settled:** Yes

No new templates should use `Blocks` overrides. The interface key will be removed once MRB migration is complete (see MRB section below).

**Audit result:** Only MRB uses `Blocks` overrides. All other templates (classic, modern, sojourner, shuvo) are already compliant — they only use `defaultBlockLayouts`.

---

### Decision: Old templates (classic, modern, sojourner, shuvo) are deprecated

**Settled:** Yes

Very few sites use old templates. They will be ignored for now and cleaned up later. No migration effort required for these.

---

### Decision: MRB is the reference template

**Settled:** Yes

MRB is the newest and most complete template. Its aesthetic (dark, glassmorphism, neon orange) is the reference for how tokens and decorations should be expressed going forward.

**MRB migration required:**
MRB currently overrides 3 blocks via `TemplateComponents.Blocks`:
- `MrbHero` → becomes a Block Builder starter definition
- `MrbQuickActions` → becomes a Block Builder starter definition
- `MrbOperatingHours` → becomes a Block Builder starter definition

These components are the **reference designs** for building the first Block Builder definitions. The code doesn't disappear — it becomes the blueprint.

After migration, MRB template registration drops `Blocks` from its components object.

---

### Decision: `defaultBlockLayouts` is kept (rename deferred)

**Settled:** Yes (rename deferred)

`defaultBlockLayouts` in template config is a valid UX convenience — it controls which layout variant is pre-selected when a user adds a new block. It is not a runtime layout constraint.

Rename to `blockDefaults` when convenient. Not urgent.

---

## Part 2: Page & Section Model

### Decision: Page structure changes from flat blocks to sections

**Settled:** Yes — schema not yet designed in detail

Current:
```typescript
interface Page {
    blocks?: PageBlock[]; // flat array
}
```

Target:
```typescript
interface Page {
    sections?: PageSection[];
}

interface PageSection {
    id: string;
    role: 'header' | 'footer' | 'body';
    blockRefId?: string;   // Block Builder definition (header/footer roles)
    blocks?: PageBlock[];  // free blocks (body role only)
    locked?: boolean;      // prevents deletion in Canvas Studio UI
}
```

**Why:** Header and footer need behavioural identity (sticky, always-first/last, nav data injection) without owning their layout. The `role` field provides this. Layout inside each section is a Block Builder definition.

**Canvas Studio invariant:** Header and footer sections are always present, shown as locked in the navigator (cannot be deleted). Their layout *can* be changed by swapping the `blockRefId` to a different Block Builder definition.

---

### Decision: "Section" is a Block Builder concept, not a page concept

**Settled:** Yes

The word "Section" in wireframes refers to `container` nodes inside a Block Builder tree — not a separate page-level primitive. The page only knows about `role: header | body | footer`. Everything inside is Block Builder's domain.

---

### Decision: Header and Footer are seeded by template on activation

**Settled:** Yes

When a template is activated or a new page is created, Header and Footer sections are automatically seeded with the template's default Block Builder definitions (starter pack). The user can then swap or customise those definitions freely.

---

## Part 3: Background

### Decision: Background exists at two independent levels

**Settled:** Yes

**Page background** — the canvas itself. Behind all blocks. Set on the `Page` object:
```typescript
background?: {
    type: 'color' | 'gradient' | 'image';
    value: string;
}
```
Template sets a sensible default. Page can override it.

**Block background** — a container node's own surface (e.g. hero with full-bleed image). Owned entirely by Block Builder via `AtomicStyles`. No special treatment needed.

These are independent. A page with a subtle grey background can contain a hero block with a full-bleed photo. Both coexist.

**Template decorations** cover the page-level atmospheric layer (noise, gradient mesh, blur) — distinct from the page's explicit background value.

---

## Part 4: Block Builder

### Decision: Block Builder owns all layout

**Settled:** Yes

Block Builder is the exclusive layout tool. Everything that used to live in `TemplateComponents.Blocks` moves here. Templates, Canvas Studio, and modules have no layout ownership.

---

### Decision: `AtomicStyles` is a structured typed interface

**Settled:** Yes (responsive breakpoints still open)

```typescript
interface AtomicStyles {
    className?: string;       // raw escape hatch only
    layout?: 'flex' | 'grid';
    direction?: 'row' | 'col';
    wrap?: 'wrap' | 'nowrap';
    align?: 'start' | 'center' | 'end' | 'stretch';
    justify?: 'start' | 'center' | 'end' | 'between' | 'around';
    gap?: string;
    padding?: string;
    margin?: string;
    width?: string;
    height?: string;
    background?: string;
    textSize?: string;
    textColor?: string;
    fontWeight?: string;
    rounded?: string;
    border?: string;
    shadow?: string;
}
```

Compiled to Tailwind className strings at render time via `compileStyles()`. Never store raw className strings on nodes directly.

---

### Decision: Container node is the core layout primitive

**Settled:** Yes

A `container` node with a **fullbleed/contained toggle** is the primary building block for all layouts:

| Use case | Container config |
|---|---|
| Fullbleed hero background | `padding: 0, background: image` |
| Constrained content width | `padding: x-16, max-width: screen-lg, mx: auto` |
| Two-column grid | `layout: grid, columns: 2, gap: 8` |
| Header logo + nav | `layout: flex, justify: between` |

The fullbleed/contained toggle is a first-class UI control in the Block Builder inspector — not a manual padding value.

---

### Decision: `AtomicNodeType` is extensible

**Settled:** Yes

```typescript
type AtomicNodeType =
    | 'container'
    | 'text'
    | 'image'
    | 'button'
    | 'icon'
    | 'divider'
    | 'spacer'
    | 'video'
    | string; // escape hatch for future primitives
```

Unknown types render `null` silently — never throw.

---

### Decision: `overrideProps` removed from schema

**Settled:** Yes

Intentionally deferred. Add only when the merge strategy is fully specified. A half-defined API is worse than no API.

---

### Decision: v1 has no drag-and-drop in Block Builder

**Settled:** Yes

Recursive `@dnd-kit` droppable zones are the single highest-complexity risk. Node ordering and nesting is handled via Navigator panel buttons (Add Child, Delete, Move Up, Move Down) in v1. DnD added in v2 once the tree data model is stable.

---

### Decision: Module slots are v2

**Settled:** Yes (deferred)

A `module_slot` node type that slots a live module (reservation form, product grid) into a Block Builder layout is a powerful v2 feature. The `AtomicNodeType | string` extensibility already accommodates it without schema changes.

---

### Decision: Block Builder definitions are site-scoped (v1)

**Settled:** Yes

`sites/{siteId}/custom_blocks/{customBlockId}` — blocks belong to a site. Cross-site/agency-wide sharing is a known v2 limitation. Path forward: global `block_templates/{id}` collection with copy-on-use model.

---

### Decision: CustomAtomicRenderer uses SWR for caching

**Settled:** Yes

Use SWR with `refId` as cache key. Avoids redundant Firestore reads when the same block appears multiple times. For SSR pages, prefer server-side preloading.

---

### Decision: No redundant ErrorBoundary in CustomAtomicRenderer

**Settled:** Yes

`SafeBlockRenderer` already wraps every block in BlockRenderer. CustomAtomicRenderer gets this coverage for free. Don't add a redundant boundary inside it.

---

## Part 5: User-Built Templates (Future Vision)

### Concept: Template creation belongs in Block Builder (v2)

**Status:** Open discussion — directionally agreed, deferred to v2

**The insight:** Given that templates are now just tokens + decorations + chrome, building a template is not far from building a block set. The work is:

1. Define color/typography/radius tokens (a form with token pickers)
2. Define decorations (glass, glow, background effect)
3. Build `BlockHeader-A`, `BlockFooter-A` as starter definitions (already Block Builder work)
4. Package and name it

Steps 3-4 are Block Builder work. Steps 1-2 are a token editor. There is no separate "template builder" tool needed — it's a natural extension of Block Builder for the same advanced user audience.

**Mental model:**
```
Block Builder (advanced tool)
  ├── Block definitions     (layouts: hero, content, cards...)
  ├── Block sets / groups   (collections of related blocks)
  └── Template definitions  (tokens + decorations + default block set)  ← v2
```

**The loose coupling principle:**

- A block doesn't know which template is active
- A template doesn't own specific blocks — it seeds defaults only
- Blocks and templates are independently useful, but can be intentionally paired

**Flexibility this enables:**

- Build blocks without a template (standalone reusable layouts)
- Build a template that references a default block set
- Assign a template to a site in Canvas Studio
- Swap the template — tokens change, blocks stay (or swap too if desired)

**Who builds templates:** Same audience as Block Builder — agencies and advanced developers. Not end users.

**Why deferred:** v1 Block Builder establishes the block definition foundation. Template creation as a feature sits naturally on top of that once blocks are stable. Nothing in v1 should be designed in a way that prevents this — but nothing needs to be pre-built for it either.

**UX note (deferred):** The round-trip between Canvas Studio and Block Builder (discoverability, re-entry, "edit this block" shortcut) is intentionally deferred until functionality is built and working. Real friction points will emerge from usage.

---

## Part 6: Block Builder Starter Definitions (Block Library)

### Concept: Templates ship starter Block Builder definitions

**Status:** Agreed conceptually, not yet specced

When MRB is activated, it seeds a set of pre-built `CustomBlockDefinition` trees into the site:
- `BlockHeader-A` (MRB default header layout)
- `BlockHero-A` (MRB default hero — based on MrbHero reference)
- `BlockFooter-A` (MRB default footer layout)
- etc.

These are the user's starting point. They own them and can customise freely after seeding. The template no longer controls them at runtime.

This is the mechanism that replaces `TemplateComponents.Blocks` entirely.

---

## Part 6: Dev & Deployment Infrastructure

### Decision: Build staging environment before any Block Builder work

**Settled:** Yes — this is the immediate next step

**Required setup:**
1. Create `clicker-staging` Firebase project (mirror of production)
2. Wire `.env.local` → emulator, `.env.staging` → clicker-staging, `.env.production` → clicker-production
3. Set up Firebase emulator for local dev (Firestore, Auth, Storage, Functions)
4. Seed data script for local/staging test data
5. Firestore security rules version-controlled, identical across environments
6. CI/CD: push to `dev` → auto deploy to staging; merge to `main` → deploy to production (manual gate)
7. Feature flags for in-progress features (`NEXT_PUBLIC_FEATURE_BLOCK_BUILDER`)

**Current state:**
- Firebase CLI installed ✅
- `dev` branch separate from `main` ✅
- Manual merge `dev` → `main` → production deploy ✅
- Feature branches planned ✅
- Firestore hits production from local ❌ (must fix before Block Builder work)

**Branching model going forward:**
```
main ──────────────────────► production
  └── dev ────────────────► staging (auto deploy on push)
        └── feature/x
        └── feature/y
```

---

## Open Questions (Not Yet Settled)

### 1. Page schema migration strategy
`Page.blocks[]` → `Page.sections[]` touches every page document in every site. Needs:
- Migration script with dry-run mode
- Rollback/backup strategy
- Run on staging first, verify, then production

### 2. Navigation data injection into Header section
`NavigationProvider` currently wraps chrome. Once header is a Block Builder definition inside a section shell, how does it receive navigation data? Options: a `navigation` node type, or data injected into the header section shell at the page level.

### 3. Token system expressiveness for MRB
MRB's glass (`backdrop-blur`, `bg-white/10`), neon glow (`box-shadow` with color), and gradient overlays need to be expressible as tokens. Current theme config likely doesn't cover these. **Audit required** before Block Builder definitions can consume MRB tokens reliably.

### 4. Responsive breakpoints in `AtomicStyles`
No breakpoint concept exists yet. A 2-column grid at desktop needs to stack at mobile. Options:
```typescript
// Option A: per-field responsive variants
gridCols?: string;
gridColsMd?: string;
gridColsLg?: string;

// Option B: nested responsive wrapper
responsive?: {
    sm?: Partial<AtomicStyles>;
    md?: Partial<AtomicStyles>;
    lg?: Partial<AtomicStyles>;
}
```
This is the **single biggest design gap** in the current spec. Punting on it means all custom blocks are desktop-only by default.

### 5. Canvas Studio UI for sections
The navigator currently shows a flat block list. With sections it needs to show header/footer as locked items and body as the editable zone. UX not yet designed.

### 6. Block sets / groups
Two interpretations discussed:
- **Multi-block paste** — a named collection that drops into Canvas Studio together (Canvas Studio feature)
- **Group node** — a collapsible named container in the Block Builder navigator (editor UX feature)
Both are valid and independent. Neither is specced yet.

---

## Implementation Order (When Ready)

```
0. Staging infrastructure setup          ← DO THIS FIRST
1. Settle open questions (responsive, nav data, migration)
2. MRB token audit
3. Design PageSection schema
4. Phase 1: atomic-types.ts, CustomAtomicRenderer, BlockRenderer wiring
5. Phase 2: Canvas Studio integration (blockDefinitions, BlockFormRenderer)
6. MRB migration: convert MrbHero/MrbQuickActions/MrbOperatingHours to Block Builder definitions
7. Phase 3: Block Builder UI (Navigator + Canvas + Inspector, no DnD)
8. v2: DnD, module slots, cross-site block sharing
```
