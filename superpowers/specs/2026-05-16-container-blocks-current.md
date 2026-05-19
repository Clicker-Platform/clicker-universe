# Container Blocks — Current Design

**Date:** 2026-05-16
**Status:** Current source of truth for Canvas Studio container blocks.
**Supersedes:** `2026-05-14-container-blocks-design.md` (described Row/Column/Grid,
which was abandoned). The 2026-05-15 refactor plan at
`superpowers/plans/2026-05-15-container-blocks-refactor.md` captured the
execution; this spec captures the resulting design.

## Goal

Two container block types in Canvas Studio that hold child blocks:

- **Columns** — horizontal arrangement of N vertical slots; each slot holds
  multiple stacked blocks. For multi-column layouts (e.g., two-up feature
  rows, three-column card grids).
- **Grid** — 2D matrix with explicit cols × rows. Each cell holds ONE block
  (or empty). For card galleries, dashboard layouts, etc.

Industry-standard terminology: Columns aligns with Gutenberg's "Columns"
block; Grid is a true 2D matrix. Row was tried in the first attempt and
dropped (redundant with default page flow).

## Data shapes

```ts
// One vertical slot inside a Columns block.
export interface ColumnSlot {
  id: string;
  size: number;          // 1–12, fraction of 12-column grid
  blocks: PageBlock[];   // multiple stacked blocks
}

// One cell inside a Grid block.
export interface GridCell {
  id: string;
  row: number;             // 1-indexed
  col: number;             // 1-indexed
  block: PageBlock | null; // empty cell allowed
}
```

### Columns block data
```ts
{
  columns: ColumnSlot[];   // ordered left-to-right
  gap: number;             // horizontal gap between columns (px)
  blockGap: number;        // vertical gap between stacked blocks inside each column (px)
  padding: number;         // outer padding in px
  stackOnMobile: boolean;  // default true
  maxWidth: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}
```

`gap` and `blockGap` are independent: `gap` controls the horizontal space
between adjacent columns; `blockGap` controls the vertical space between
the blocks stacked inside a single column. Both default to 16px.

### Grid block data
```ts
{
  cols: number;            // 1–12 (default 3)
  rows: number;            // 1–12 (default 2)
  cells: GridCell[];       // soft-delete: cells can exist outside cols × rows
  gapX: number;
  gapY: number;
  padding: number;
  stackOnMobile: boolean;
  maxWidth: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}
```

Helpers in `components/admin/blocks/forms/container/types.ts`:

- `clampSize(n)` — clamps a column size to integer 1–12
- `distributeSizes(count)` — even distribution of 12 units across N columns
  (e.g., N=3 → [4,4,4], N=5 → [3,3,2,2,2])
- `defaultNewColumnSize(existingCount)` — `floor(12 / (count+1))` for a new
  column being added
- `newId(prefix)` — generates a unique slot id
- `findBlockPath(blocks, blockId)` — locates a block in the tree (top-level
  or nested)
- `findContainerBySlotId(blocks, slotId)` — locates the parent container
  for a given slot id

## The Columns block

### Form UX (ColumnsForm)
- Container-level fields at top: gap, padding, stack-on-mobile, maxWidth.
- A **tab strip** with one tab per column slot: `[Col 1] [Col 2] ... [+]`.
  Active tab is highlighted. Each tab has a delete `×` (disabled when one
  column left).
- Active tab area shows:
  - Width slider (1–12)
  - "Blocks in this column" — a `<NestedBlockList>` showing each block in
    that slot with drag handle, edit chevron, delete.
  - "+ Add block" button using `<MiniBlockPicker>` (excludes `columns` and
    `grid` to enforce one-level nesting).
- Drilled view: clicking a block's chevron drills into that block's form
  with "← Back to Columns" breadcrumb.

### Width sizing
- Sizes sum nominally to 12.
- New column gets `floor(12 / (N+1))`. **Auto-rebalance heuristic**: if
  existing columns are all at their `distributeSizes(N)` defaults
  (untouched), re-balance to `distributeSizes(N+1)`. If the user has
  customized widths, leave them alone and just append the new column.
- On delete: same rule. Re-balance if remaining are untouched, otherwise
  preserve user's customizations.

### Render (DefaultColumnsBlock)
- Outer wrapper: `width: 100%`, `box-sizing: border-box`, padding,
  optional maxWidth (centered when set).
- Flex row of columns. Each column's `flex-basis` = `calc((size/12)*100% -
  gapDeduction)` where `gapDeduction = ((N-1) * gap) / N`. This makes the
  total (sum of basis + (N-1)*gap) exactly 100%, no overflow.
- Empty column gets `min-height: 60` so the click target is reachable.
- Children rendered recursively via `<BlockRenderer>`, each wrapped in
  `<SelectableBlock>` so it's individually clickable.

### Mobile responsive
- **Canvas preview** (`deviceView === 'mobile'` from `DeviceViewContext`):
  flex-direction inline-set to `column`, each child width forced to 100%.
- **Real public site** (`deviceView === 'responsive'`): Tailwind classes
  `flex flex-col md:flex-row` so real `md:` (≥768px) breakpoint applies.
  Below md, single column; at md+, side-by-side.
- Cannot rely on Tailwind `md:` classes alone in canvas preview because
  the preview frame width doesn't match the real viewport. See memory
  `feedback_canvas_preview_md_breakpoint`.

## The Grid block

### Form UX (GridForm)
- Container-level fields: cols (1–12), rows (1–12), gapX, gapY, padding,
  stack-on-mobile, maxWidth.
- Tab strip showing **all visible cells**: `[1] [2] [3] ... [N]`. Numeric
  labels (no row/col coords in the label, just an integer position).
- Active tab area shows:
  - Position label: "Cell N — Row R, Col C"
  - If cell is filled: block type label + Edit + Clear (×).
  - If cell is empty: `<MiniBlockPicker>` to add a block.
- Hidden cells indicator: if cells exist with `row > rows || col > cols`
  AND they contain blocks, show an amber banner: "N hidden cell(s) with
  content. Resize back to recover. [Discard hidden]".

### Soft-delete on resize
- Shrinking cols or rows does **not** delete out-of-bounds cells.
- Expanding back reveals them (their data is preserved).
- Only "Discard hidden" button explicitly purges out-of-bounds cells.
- The displayed cells list always derives from `cells.filter(c => c.row <=
  rows && c.col <= cols)`.

### Render (DefaultGridBlock)
- Outer wrapper similar to Columns.
- CSS Grid with `grid-template-columns: repeat(${effectiveCols}, 1fr)`,
  `column-gap: gapX`, `row-gap: gapY`.
- Each cell is a wrapper div. If filled, contains a `<SelectableBlock>`
  wrapping the block's render. If empty, contains a small numeric badge
  (visible only when guides are on).

### Mobile responsive
- Same dual-strategy as Columns:
  - **Canvas preview**: `gridTemplateColumns` set inline based on
    `deviceView`. Mobile preview forces 1 column when `stackOnMobile`.
  - **Real public site**: Tailwind classes `grid grid-cols-1
    md:[grid-template-columns:var(--grid-cols-md)]` with the column
    template stashed in a CSS variable so Tailwind JIT picks up a static
    class. The CSS variable holds the dynamic value at runtime.

## Default data

From `blockDefinitions.ts` `getDefaultData`:

- **`columns`**: 2 columns, each `size: 6` and `blocks: []`. Default
  `gap: 16, padding: 16, stackOnMobile: true, maxWidth: 'full'`.
- **`grid`**: `cols: 3, rows: 2`, generates 6 cells with sequential ids and
  proper row/col coordinates, all `block: null`. Default `gapX: 16,
  gapY: 16, padding: 16, stackOnMobile: true, maxWidth: 'full'`.

## Block picker integration

Both `columns` and `grid` register in `BLOCK_OPTIONS`:
```ts
{ type: 'columns', label: 'Columns', icon: Columns3 },
{ type: 'grid', label: 'Grid', icon: LayoutGrid },
```

The `MiniBlockPicker` inside `NestedBlockList` and `GridForm` excludes
both `columns` and `grid` to enforce the one-level-nesting rule:
```ts
const EXCLUDED_TYPES: BlockType[] = ['columns', 'grid'];
```

## Selection integration

**Selection model:** `EditorContext.selection` is the single source of
truth (`EditorSelection` discriminated union). See spec
`2026-05-16-editor-selection-model.md`.

Container interactions write directly to selection:

- Click a column's empty area → `setSelection({ kind: 'slots',
  containerId, ids: [slot.id] })`. Stops propagation so the page-root
  `<SelectableBlock>` doesn't catch it.
- Click an empty grid cell → same shape.
- Click a nested block → `setSelection({ kind: 'blocks', ids: [block.id]
  })` via the nested `<SelectableBlock>`.
- Click the container itself (its outer outline) → handled by the page-
  root `<SelectableBlock>` wrapping it.

Forms read from selection:

- Active tab in ColumnsForm/GridForm derived from `selection` (kind:
  'slots' matching containerId, OR the column/cell containing the
  currently selected nested block, OR fallback to index 0).
- "Drilled into a block" state derived from `selection.kind === 'blocks'`
  pointing at a nested block in this container.
- No local `useState` for active tab — pure derivation. No mirror
  effects. The shape **cannot oscillate**.

## Canvas guides

When `showGuides` is on in the editor:
- **Columns**: each column gets a dashed outline (blue, 1px, 60% opacity).
- **Grid**: each cell gets a dashed outline. Empty cells additionally
  show a small numeric badge in the top-right (matches the tab index in
  the form), making it easy to map a cell on canvas to its tab in the
  side panel.

Active slot (the one in `selection`) gets a stronger highlight: solid
2px blue outline + faint primary-tinted background via
`color-mix(in srgb, var(--theme-primary) 3%, transparent)`.

## What's intentionally NOT in scope (deferred)

- **Container-in-container nesting**. `MiniBlockPicker` enforces this
  by excluding `columns` and `grid` from its options.
- **Canvas drag-to-resize column widths**. The form has a slider; no
  drag handles on canvas yet.
- **Per-cell row span / col span in Grid**. Each cell occupies exactly
  one row × one col today. The user mentioned future multi-cell merge
  as a target use case (e.g., merge row 1 cells 2-3-4 into one); the
  `EditorSelection` model is shape-ready (arrays of slot ids) but the
  merge UI + data model changes are not done.
- **Multi-select** (Cmd+click). Selection model supports it; no UI yet.
- **Inline editing for nested hero/heading**. Currently the inline
  toolbar only fires for top-level inline-editable blocks.

## Key file index

| File | Role |
|---|---|
| `components/admin/blocks/forms/container/types.ts` | Type definitions + helper functions |
| `components/admin/blocks/forms/ColumnsForm.tsx` | Side-panel form for Columns block |
| `components/admin/blocks/forms/GridForm.tsx` | Side-panel form for Grid block |
| `components/admin/blocks/forms/container/NestedBlockList.tsx` | Reusable list with dnd-kit reorder for blocks inside a column slot |
| `components/admin/blocks/forms/container/MiniBlockPicker.tsx` | Block picker shown inside containers (excludes containers themselves) |
| `components/admin/blocks/forms/container/EmptyContainerPlaceholder.tsx` | Dashed placeholder shown when a container has zero content (editor-only) |
| `components/blocks/public/DefaultColumnsBlock.tsx` | Public renderer for Columns |
| `components/blocks/public/DefaultGridBlock.tsx` | Public renderer for Grid |
| `components/admin/blocks/blockDefinitions.ts` | `BLOCK_OPTIONS` + `getDefaultData` for both types |

## Implementation history

- **2026-05-14**: First attempt with Row + Column + Grid (`c067a97`,
  spec at `2026-05-14-container-blocks-design.md` — now superseded).
- **2026-05-15**: Refactor — dropped Row, repurposed Column → Columns.
  Plan at `superpowers/plans/2026-05-15-container-blocks-refactor.md`.
- **2026-05-15 / 16**: Theme audit (`6a6e0d6`), Columns padding overflow
  fix + isHydrating + active highlight (`a6843e9`), direct nested-block
  canvas selection (`d11d93b`).
- **2026-05-16**: Selection model refactor (`e190660`, `b2c0233`,
  `9c58085`) — enables empty-slot canvas clicks via the new
  `EditorSelection` model.

## Open questions / known issues

None at time of writing. The current implementation has been stress-
tested in this session (many-click scenario across multiple columns,
template switching, hydration races) and is stable.
