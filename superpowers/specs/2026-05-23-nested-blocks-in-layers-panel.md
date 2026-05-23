# Nested Blocks in the Layers Panel

**Date:** 2026-05-23
**Scope:** Make the Canvas Studio Layers panel show blocks that live inside container blocks (Columns / Grid / FeatureCards). Today it's strictly flat.

---

## Problem

The Layers panel (`BlockManager`) iterates only top-level `blocks[]`. Anything nested inside a `columns`, `grid`, or `feature_cards` block is invisible in the outline:
- Selecting a nested block requires drilling on the canvas — there's no tree to scan.
- Empty slots (an empty Columns column, an empty Grid cell) can't be located from the panel.
- FeatureCards cards can't be found without first selecting the card on the canvas.

## Goal

Expose the full block tree in the Layers panel as an indented, collapsible outline. Clicking any node writes the right selection so the right panel + canvas highlight follow.

## Design

### Tree shape

For each top-level block, recurse based on type:

```
Columns block
├── Column 1   (slot node)
│   ├── Hero block
│   └── Text block
├── Column 2   (slot node)
│   └── (empty)
└── Column 3   (slot node)
    └── Button block

Grid block
├── Cell row1-col1   (slot node)
│   └── Image block
├── Cell row1-col2   (slot node)
│   └── (empty)
└── Cell row2-col1   (slot node)
    └── Columns block      ← recurse
        └── Column 1
            └── Feature Cards block   ← recurse
                ├── Card #1 — Headline
                ├── Card #2 — Headline
                └── Card #3 — Headline

Feature Cards block (top-level)
├── Card #1 — Headline
├── Card #2 — Headline
└── Card #3 — Headline
```

Rules:
- **Containers (`columns`, `grid`)** expand to slot nodes, which expand to their child blocks.
- **FeatureCards** expands directly to card nodes (no slot layer — cards are direct children).
- **All other block types** are leaves.
- **Recursion** is full-depth. A Columns inside a Grid inside a Columns is rendered as nested branches.

### Selection mapping

Click handlers write to `EditorContext.selection`:

| Node kind | Selection emitted |
| --- | --- |
| Top-level block | `{ kind: 'blocks', ids: [blockId] }` |
| Nested block (inside Columns slot or Grid cell) | `{ kind: 'blocks', ids: [blockId] }` |
| Empty Columns column | `{ kind: 'slots', containerId: <columnsBlockId>, ids: [<columnId>] }` |
| Empty Grid cell | `{ kind: 'slots', containerId: <gridBlockId>, ids: [<cellId>] }` |
| FeatureCards card | `{ kind: 'slots', containerId: <featureCardsBlockId>, ids: [<cardId>] }` |

Existing forms already handle these selection shapes after the previous round of fixes (CanvasStudio routes slot selections via `findBlockPath`; Columns/Grid forms drill on `slots`-kind selections targeting their nested children).

### Visual

- Indent each level by `pl-3` (12px) so deep trees stay scannable.
- Expand/collapse chevron on container nodes (default: expanded). State is local to BlockManager.
- Slot nodes use a muted label: "Column 1", "Cell 2,1" (row,col), with a distinct icon (e.g. `LayoutGrid` / `Columns` / `Box` smaller).
- Card nodes show the card's `headline` (or `Untitled Card`), prefixed with `#N`.
- Selected node highlights blue exactly like today's top-level row.
- The grip handle (drag-to-reorder) stays on **top-level** blocks only — nested DnD is out of scope (reordering nested blocks already happens in the Columns/Grid form, and we don't want two competing reorder UIs).
- Delete trash button stays on real block rows (top-level + nested blocks), not on slot nodes or card nodes (those are managed by their parent's form).

### Out of scope

- **Drag-to-reorder nested blocks.** The container forms already do this; surfacing it in two places creates UX conflict.
- **Drag a block from top-level into a container** (or out). The "Add to" affordance is the container form's job today; we're not changing that contract.
- **Add a new child from the Layers panel.** Empty slots are click-targets only; the user adds blocks from the right-panel container form (existing flow).
- **Breadcrumbs in the canvas toolbar.** Not part of this scope — only the Layers panel.

---

## Implementation summary

1. New `BlockTreeNode` component (recursive) that renders one row + its children, with indent depth and collapsible state.
2. New helper `getBlockChildren(block)` returns the structured children for a block: `{ kind: 'columns' | 'grid' | 'feature_cards' | 'leaf', slots?, cards? }`.
3. `BlockManager` replaces the flat `.map` with `<BlockTreeNode block={block} depth={0} />`.
4. `BlockTreeNode` uses the same `useSortable` only at `depth === 0` so top-level reorder stays intact; deeper rows render as plain rows (no `useSortable`).

## Files touched

- `clicker-platform-v2/components/admin/blocks/BlockManager.tsx` — replace flat list with tree.
- `clicker-platform-v2/components/admin/blocks/BlockOutlineItem.tsx` — extract the row UI; current top-level use is preserved.
- `clicker-platform-v2/components/admin/blocks/BlockTreeNode.tsx` — new recursive node component.

No data shape changes, no DB migration.
