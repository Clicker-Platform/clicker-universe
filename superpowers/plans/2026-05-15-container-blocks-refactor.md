# Container Blocks Refactor — Plan

> **Context:** The original implementation (2026-05-14) shipped Row, Column, Grid as three near-identical containers, each holding `ContainerChild[]` (one block per slot). Industry-standard model is different. This refactor drops Row, drops the old Column, renames Grid → Columns (one block-list per column slot), and adds a real Grid (cols × rows, one block per cell).

**Status:** Refactor in place — keeps drill-down, dnd-kit, MiniBlockPicker, useDrillDown infrastructure; replaces data shapes, forms, and renderers.

---

## Final block set

### Columns block (`type: 'columns'`)
- **Mental model:** horizontal arrangement of N vertical column slots, each slot holds **multiple stacked blocks**.
- **Form UX:** tabs at top `[Col 1] [Col 2] [Col 3] [+]`. Active tab shows that column's block list (drag-reorder, drill-down to edit).
- **Auto-stacks** to 1 column on mobile when `stackOnMobile` is on.

### Grid block (`type: 'grid'`)
- **Mental model:** 2D matrix with explicit `cols × rows`. Each cell holds **one block** (or empty).
- **Form UX:** cols + rows number inputs. Cells listed in row-major order; clicking a cell drills into its block (or shows a picker if empty).
- **Auto-stacks** to 1 column on mobile when `stackOnMobile` is on.

### Dropped
- `row` block (redundant with default page flow)
- old `column` block (the vertical-stack one — replaced by the new Columns-as-container model)

---

## Data shapes

```ts
// Replaces ContainerChild
export interface ColumnSlot {
  id: string;
  size: number;          // 1–12, fraction of 12-grid total
  blocks: PageBlock[];   // multiple stacked blocks
}

export interface GridCell {
  id: string;
  block: PageBlock | null; // empty cells allowed
}
```

**Columns block data:**
```ts
{
  columns: ColumnSlot[];
  gap: number;          // px
  padding: number;      // px
  stackOnMobile: boolean;
  maxWidth: 'sm'|'md'|'lg'|'xl'|'full';
}
```

**Grid block data:**
```ts
{
  cols: number;         // 1–12
  rows: number;         // 1–12
  cells: GridCell[];    // length = cols * rows, row-major (cell at row r, col c = cells[r*cols + c])
  gapX: number;
  gapY: number;
  padding: number;
  stackOnMobile: boolean;
  maxWidth: 'sm'|'md'|'lg'|'xl'|'full';
}
```

---

## Files

### Delete
- `clicker-platform-v2/components/admin/blocks/forms/RowForm.tsx`
- `clicker-platform-v2/components/admin/blocks/forms/ColumnForm.tsx`
- `clicker-platform-v2/components/blocks/public/DefaultRowBlock.tsx`
- `clicker-platform-v2/components/blocks/public/DefaultColumnBlock.tsx`

### Rename + rebuild
- `forms/GridForm.tsx` → `forms/ColumnsForm.tsx` (new shape: column tabs + per-column NestedBlockList)
- `public/DefaultGridBlock.tsx` → `public/DefaultColumnsBlock.tsx` (renders N side-by-side columns, each containing stacked blocks)

### New
- `clicker-platform-v2/components/admin/blocks/forms/GridForm.tsx` (cols × rows form with cell grid)
- `clicker-platform-v2/components/blocks/public/DefaultGridBlock.tsx` (2D grid renderer)

### Modify
- `clicker-platform-v2/data/mockData.ts` — BlockType union: remove `'row' | 'column' | 'grid'`, add `'columns' | 'grid'` (keep grid in the new sense)
- `clicker-platform-v2/components/admin/blocks/blockDefinitions.ts` — replace row/column/grid entries with columns + grid; update `getDefaultData`
- `clicker-platform-v2/components/admin/blocks/BlockFormRenderer.tsx` — drop row/column dynamic imports + switch cases; rename grid → columns; add new grid
- `clicker-platform-v2/components/blocks/BlockRenderer.tsx` — same
- `forms/container/types.ts` — replace `ContainerChild` with `ColumnSlot` and `GridCell`; size helpers stay
- `forms/container/MiniBlockPicker.tsx` — `EXCLUDED_TYPES: ['columns', 'grid']`
- `forms/container/EmptyContainerPlaceholder.tsx` — remove 'row' variant, change 'column' → 'columns', keep 'grid'
- `forms/container/NestedBlockList.tsx` — keep, now reused inside each column slot; drop SizeMode prop (always shows "Width: N/12" since every use is width-fraction now)
- `forms/container/__tests__/types.test.ts` — update tests for renamed exports if any
- `forms/container/__tests__/NestedBlockList.test.tsx` — update for SizeMode removal

### Keep unchanged
- `forms/container/useDrillDown.ts` (works on any `{id}` list, agnostic to shape)
- `forms/container/__tests__/useDrillDown.test.ts`

---

## Task breakdown

### Task R1: Update `types.ts` with `ColumnSlot` and `GridCell`
- Replace `ContainerChild` interface with `ColumnSlot` and `GridCell`.
- Keep `clampSize`, `distributeSizes`, `defaultNewChildSize`, constants.
- Update `types.test.ts` if it imports `ContainerChild` (it doesn't — only tests the helpers).

### Task R2: Delete Row + Column files
- Delete `forms/RowForm.tsx`, `forms/ColumnForm.tsx`
- Delete `public/DefaultRowBlock.tsx`, `public/DefaultColumnBlock.tsx`

### Task R3: Update `BlockType` union + `blockDefinitions.ts`
- Remove `'row' | 'column'` from `BlockType` union.
- Keep `'grid'`, ADD `'columns'`.
- Remove Row, Column entries from `BLOCK_OPTIONS`.
- Rename the existing Grid entry's label to "Columns" type='columns' (since current Grid logic gets rebuilt as Columns).
- Wait — cleaner approach: just rewrite both entries fresh.
  - Remove old `row`, `column`, `grid` entries entirely.
  - Add new `{ type: 'columns', label: 'Columns', icon: Columns3 }` and `{ type: 'grid', label: 'Grid', icon: LayoutGrid }`.
- Replace `getDefaultData` cases for row/column/grid with new defaults for columns + grid.

### Task R4: Update NestedBlockList and MiniBlockPicker
- `NestedBlockList`: change `childrenList: ContainerChild[]` → `blocksList: PageBlock[]` + per-block size? **No — drop size from NestedBlockList entirely.** The size slider belongs at the column-level, not the block-level. Inside a column, blocks just stack vertically; no width sliders.
  - Props become: `blocksList: PageBlock[]`, `onBlocksChange`, `onBlockClick(blockId)`, `templateId?`.
  - Remove `sizeMode` prop, remove size slider UI.
  - Each row: drag handle + block label + edit chevron + delete.
- `MiniBlockPicker`: `EXCLUDED_TYPES = ['columns', 'grid']`.
- Update `NestedBlockList.test.tsx` — drop the size-slider test, keep reorder/edit/delete tests.

### Task R5: Build `ColumnsForm.tsx` (replace old GridForm)
- Top: tabs `[Col 1] [Col 2] [Col 3] [+]`. Active tab highlighted. Each tab shows column N + delete button (except when only 1 column).
- Active column area shows:
  - Column-level: width slider (1–12), `<NestedBlockList blocksList={col.blocks} ... />`
- Container-level fields (above tabs): gap, padding, stackOnMobile, maxWidth.
- Drill-down: when a block inside any column is clicked, swap entire form to that block's `BlockFormRenderer` with "← Back to Columns" breadcrumb.
- Tab "+": appends a new empty `ColumnSlot` with `size = floor(12/(N+1))`, fresh `id`.

### Task R6: Build new `GridForm.tsx`
- Container-level: `cols` (1–12), `rows` (1–12), gapX, gapY, padding, stackOnMobile, maxWidth.
- Below: a visual matrix of `cols × rows` cells. Each cell shows either:
  - The block's label + edit chevron + clear button (if `block !== null`)
  - "+ Add block" button (if `block === null`) — opens MiniBlockPicker
- Changing `cols` or `rows`: resize `cells` array, preserving existing cells where possible, padding with `{ id, block: null }` for new cells. Discarded cells are dropped silently.
- Drill-down on cell click → swap to that block's `BlockFormRenderer` with "← Back to Grid".

### Task R7: Build `DefaultColumnsBlock.tsx`
- Renders a horizontal flex container.
- For each `ColumnSlot`: render a `<div style={{ flex: '0 0 ${size/12*100}%' }}>` containing `blocks.map(b => <BlockRenderer block={b} />)` stacked vertically.
- Mobile stack: same `dv()` pattern as current DefaultRowBlock.
- Empty state: dashed placeholder when no columns OR all columns empty AND `previewMode`.

### Task R8: Build new `DefaultGridBlock.tsx`
- Renders `display: grid` with `gridTemplateColumns: repeat(${cols}, 1fr)`, `gridTemplateRows: repeat(${rows}, auto)`.
- Iterate `cells` in row-major order; each cell renders `block ? <BlockRenderer/> : null`.
- Mobile stack: when `stackOnMobile`, collapse to 1 column at mobile preview / via `dv()`.

### Task R9: Wire forms into `BlockFormRenderer.tsx`
- Remove old `RowForm`, `ColumnForm`, `GridForm` dynamic imports.
- Add new `ColumnsForm`, `GridForm` dynamic imports.
- Update `coreLabels` and switch cases.

### Task R10: Wire renderers into `BlockRenderer.tsx`
- Remove old `RowContainerBlock`, `ColumnContainerBlock`, `GridContainerBlock` dynamic imports.
- Add new `ColumnsContainerBlock`, `GridContainerBlock` dynamic imports.
- Update switch cases.

### Task R11: Update `EmptyContainerPlaceholder`
- Remove 'row' variant.
- Change variant `'column'` → `'columns'` (label: "Empty Columns").
- Keep 'grid' (label: "Empty Grid").

### Task R12: Run full test suite + typecheck + lint
- `pnpm test components/admin/blocks/forms/container/__tests__/` — all pass.
- `pnpm tsc --noEmit` — no new errors on container files.
- `pnpm lint` — no new errors on container files.

### Task R13: Final QA against this refactor plan
- Verify no `row`/`column` references remain in container code (grep).
- Verify `columns` and `grid` blocks register, render, persist.
- Hand off to user for browser smoke test.

---

## Out of scope (still deferred)

- Canvas drag-to-resize column widths (v2)
- Per-breakpoint column counts (v2)
- Container-in-container nesting (still banned)
- Picker grouping (still flat)
- Migrations — there's no production data to migrate; the original implementation was never committed
