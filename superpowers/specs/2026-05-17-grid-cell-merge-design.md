# Grid Cell Merge — Phase C Design Spec

> **Status:** Design, ready for implementation after Phase A + B.
> **Scope:** Implement merge/unmerge of grid cells in Canvas Studio's Grid block. Enables professional layouts (hero spanning 2 cols, asymmetric featured cells, etc.).
> **Date:** 2026-05-17
> **Estimated effort:** 6–8 hours (after Phase A and B prerequisites).

---

## 1. Problem & Goal

The current Grid block is a strict `cols × rows` matrix — every cell is exactly 1×1. Real layouts often need:

- A hero cell that spans 2 columns wide
- A featured product taking 2 rows on the left, three smaller cards stacked on the right
- An asymmetric "magazine" layout where one block dominates the visual hierarchy

**Goal:** Allow contiguous rectangular regions of grid cells to be merged into a single cell that occupies multiple rows and/or columns, with a single block at the merged position. Provide unmerge to restore the constituent cells.

---

## 2. Prerequisites (must ship first)

This spec assumes the multi-select foundation from `2026-05-16-multi-select-readiness.md`:

- **Phase A (defensive baseline, ~2h):** All consumers of `selection` tolerate `ids: string[]` with length 0/1/N. No code assumes `ids[0]`.
- **Phase B (Cmd+click gesture, ~2h):** User can Cmd/Ctrl+click grid cells to add them to selection. Selection of kind `slots` with multiple `ids` is reachable.

Without these, the merge UX has no entry point. If we ship merge before B, we'd need a fallback gesture (e.g., a "Merge mode" toggle that turns clicks into rectangle-drag selection) — not recommended; just do A and B first.

---

## 3. Data Model Change

### Current `GridCell`

```ts
type GridCell = {
  id: string;
  row: number;        // 0-indexed
  col: number;        // 0-indexed
  block: BlockData | null;
};
```

### New `GridCell`

```ts
type GridCell = {
  id: string;
  row: number;        // anchor row (top-left of merged region)
  col: number;        // anchor col
  rowSpan: number;    // default 1, >=1
  colSpan: number;    // default 1, >=1
  block: BlockData | null;
};
```

**Invariants:**

- `rowSpan >= 1`, `colSpan >= 1`.
- `row + rowSpan <= grid.rows` and `col + colSpan <= grid.cols` for visible cells. (Soft-deleted cells outside grid bounds are preserved as-is; their spans are frozen until they re-enter bounds via grid resize.)
- No two cells overlap: the rectangle `[row, row+rowSpan) × [col, col+colSpan)` of any cell is disjoint from every other cell's rectangle.
- A cell with `rowSpan === 1 && colSpan === 1` is a plain 1×1 cell.

### Migration

Existing grids in Firestore have cells without `rowSpan`/`colSpan`. Normalize on hydration:

```ts
function normalizeCell(c: Partial<GridCell>): GridCell {
  return {
    id: c.id ?? newId(),
    row: c.row ?? 0,
    col: c.col ?? 0,
    rowSpan: c.rowSpan ?? 1,
    colSpan: c.colSpan ?? 1,
    block: c.block ?? null,
  };
}
```

Apply in `getDefaultData('grid')` and wherever grid `data` is read from the canvas state. Write the new fields back on next save. No destructive migration needed — additive only.

---

## 4. Selection → Merge Validity

The merge action operates on `selection = { kind: 'slots', containerId: gridId, ids: [...] }`.

A selection is **mergeable** when all of:

1. `ids.length >= 2`.
2. All selected cell IDs belong to the same grid (`containerId` matches).
3. All selected cells are **visible** (in-bounds: `row + rowSpan <= grid.rows && col + colSpan <= grid.cols`). Hidden/soft-deleted cells cannot participate.
4. The selected cells form a **rectangular, contiguous region**: there exist `r0, c0, r1, c1` such that the union of selected rectangles equals exactly `[r0, r1] × [c0, c1]` with no holes and no extras.

If any condition fails, the Merge action is disabled (greyed out) with a tooltip explaining why.

### Rectangularity check algorithm

```ts
function getMergeRect(cells: GridCell[]): { r0: number; c0: number; r1: number; c1: number } | null {
  if (cells.length < 2) return null;
  const r0 = Math.min(...cells.map(c => c.row));
  const c0 = Math.min(...cells.map(c => c.col));
  const r1 = Math.max(...cells.map(c => c.row + c.rowSpan - 1));
  const c1 = Math.max(...cells.map(c => c.col + c.colSpan - 1));
  // Sum of areas must equal the bounding rectangle area.
  const sum = cells.reduce((acc, c) => acc + c.rowSpan * c.colSpan, 0);
  const area = (r1 - r0 + 1) * (c1 - c0 + 1);
  if (sum !== area) return null;
  // Bounding rect must be fully covered. Since cells are disjoint (invariant)
  // and sum === area, coverage is implied.
  return { r0, c0, r1, c1 };
}
```

This handles selections that include already-merged cells (their `rowSpan/colSpan` count in the sum).

---

## 5. Merge Action

### Inputs
- `gridId`: container block id.
- `cellIds`: array of cell ids in the current selection (length >= 2, validated mergeable).

### Behaviour

1. Compute `rect = getMergeRect(cells)`. Abort if `null`.
2. Choose anchor: the cell at `(rect.r0, rect.c0)` — the top-left of the bounding rectangle. This is the cell whose `block` is preserved (see open question §10 for handling other cells with content).
3. Build new cell list:
   - Keep all cells outside the rectangle unchanged.
   - Remove all cells inside the rectangle except the anchor.
   - Update the anchor: `row = rect.r0, col = rect.c0, rowSpan = rect.r1 - rect.r0 + 1, colSpan = rect.c1 - rect.c0 + 1`. Keep its `id` and `block` (subject to §10).
4. Update selection to the anchor: `selection = { kind: 'slots', containerId: gridId, ids: [anchor.id] }`.
5. Atomically setData on the grid container.

### Default for non-anchor blocks (see §10)

For v1, **discard non-anchor blocks** with a confirmation dialog if any non-anchor cell has content:

> "Merging will keep the block in the top-left cell and discard 2 other blocks. Continue?"

If only the anchor has content (or all cells are empty), no confirmation — merge silently.

---

## 6. Unmerge Action

### Inputs
- `cellId`: id of a merged cell (`rowSpan > 1 || colSpan > 1`).

### Behaviour

1. Read anchor's `row, col, rowSpan, colSpan, block`.
2. The anchor becomes a 1×1 cell at `(row, col)` keeping its `block`.
3. Create `rowSpan * colSpan - 1` new empty 1×1 cells filling the rest of the rectangle, each with a fresh `newId()` and `block: null`.
4. Update selection to all `rowSpan * colSpan` resulting cells (so user can immediately remerge differently).

Unmerge never loses data — the anchor's block stays at the top-left.

---

## 7. Rendering

### Public site (`DefaultGridBlock.tsx`)

CSS Grid handles spans natively. For each cell:

```tsx
<div
  key={cell.id}
  style={{
    gridColumn: `${cell.col + 1} / span ${cell.colSpan}`,
    gridRow: `${cell.row + 1} / span ${cell.rowSpan}`,
  }}
>
  {cell.block ? renderBlock(cell.block) : null}
</div>
```

(Note the 1-indexing for CSS Grid lines.)

### Mobile

On real mobile (`md:` breakpoint), the current grid collapses to a single column stack. Merged cells render in document order at full width — `colSpan` is irrelevant when there's only one column, and `rowSpan` becomes natural vertical extent.

In canvas mobile preview (`dv(d, ...)`), apply the same collapse: ignore spans, render each cell full-width in row-major order.

### Canvas (editor)

Same `gridColumn` / `gridRow` styling as public. Selection chrome (border + handles) wraps the merged region naturally because it's a single DOM element.

---

## 8. Form UX (`GridForm.tsx`)

### Tab strip

Currently the form shows one tab per cell in row-major order. With merges:

- A merged cell appears as **one tab**, labelled `Cell R1–R2 / C1–C2` (or `Cell R1 / C1` if only one axis is spanned, e.g. `Cell 1 / C1–C3`).
- The tab strip is still in row-major reading order, anchored by the merged cell's `(row, col)`.

### Active tab derivation

Same single-source-of-truth pattern: active tab derived from `selection.ids[0]` matching a cell.id. No local state.

### Merge / Unmerge buttons

In the cell tab's body (or as a header toolbar):

- **Merge button:** visible when `selection.kind === 'slots'` and `selection.ids.length >= 2`. Disabled if not mergeable, with tooltip explaining why.
- **Unmerge button:** visible when single-selected cell has `rowSpan > 1 || colSpan > 1`. Confirmation only if anchor has a block? No — unmerge is non-destructive, no confirmation needed.

### Hidden-cells indicator

Already exists. Should continue to work — a cell is hidden iff `row + rowSpan > grid.rows || col + colSpan > grid.cols`. Hidden cells cannot participate in merge selection (filtered in §4 step 3).

---

## 9. Edge Cases

- **Single-cell "merge" (1 cell selected):** Merge action disabled. Use Cmd+click to add cells first.
- **Empty merge (all cells empty):** Allowed; produces an empty merged cell at the anchor.
- **Merging across a hidden cell's footprint:** Impossible by validity rule (hidden cells excluded). If a user soft-deletes (by resizing grid down) cells that were *inside* a merged region, the merged cell's footprint may now extend out of bounds — it becomes hidden as a whole. On resize back up, it returns to visibility intact. Don't try to "split" merged cells on grid resize.
- **Grid resize down chops a merged cell:** If the merged anchor itself goes out of bounds (e.g. `anchor.row >= newRows`), it's hidden. If only part of the span goes out of bounds (e.g. `anchor.row + rowSpan > newRows` but `anchor.row < newRows`), the cell remains visible but clamp its rendered span to fit: `effectiveRowSpan = Math.min(rowSpan, newRows - row)`. Store original span unchanged; clamping is render-time only. On resize back up, full span restores.
- **Block at anchor is a container (columns/grid):** Not allowed currently (single-level nesting rule). Continues to hold — the block at a merged cell is a leaf block.

---

## 10. Open Design Questions

These should be answered before implementation begins.

### Q1: What happens to non-anchor cells' blocks on merge?

Options:

- **A. Discard with confirmation (recommended for v1).** Anchor's block wins. Confirm if any non-anchor cell has content. Simple, predictable.
- **B. Block if any non-anchor has content.** Refuse merge until user clears them. Safest, but adds friction.
- **C. Auto-pick the "best" block (e.g., the one with most content).** Magic. Unpredictable.
- **D. Show a small chooser UI: "Which block to keep?"** Most flexible but adds modal complexity for an edge case.

**Recommendation: A.** Matches the "atomic transition with explicit user intent" pattern. Confirmation prevents accidental data loss.

### Q2: What does the form tab show for a merged cell?

Options:

- **A. Just the block editor for the anchor's block.** Same as a 1×1 cell. Span info shown in tab label only.
- **B. Block editor + a "Span" section showing `rowSpan × colSpan` with an Unmerge button.**
- **C. B, plus drag-to-resize span handles in the canvas.**

**Recommendation: B for v1, C as a follow-up.** B gives clear affordance without adding canvas-side gestures. C is a separate UX project (cell-edge drag handles) that competes with grid resize gestures.

---

## 11. Implementation Breakdown (6–8 hours)

| # | Task | Est |
|---|------|-----|
| 1 | Data model: add `rowSpan`/`colSpan`, normalize on hydration, update types | 0.5h |
| 2 | `getMergeRect()` helper + unit tests for rectangularity edge cases | 1h |
| 3 | `mergeCells()` and `unmergeCells()` actions in form helpers + tests | 1h |
| 4 | `DefaultGridBlock.tsx`: render with `gridColumn`/`gridRow` spans, mobile collapse | 0.5h |
| 5 | `GridForm.tsx`: tab labels for merged cells, Merge/Unmerge buttons | 1h |
| 6 | Merge confirmation dialog (block-discard warning) | 0.5h |
| 7 | Grid-resize clamping for partially-out-of-bounds merged cells | 0.5h |
| 8 | Manual smoke tests across templates; resolve any selection-chrome glitches on merged cells | 1h |
| 9 | Update spec docs (current container-blocks spec + memory) | 0.5h |
| | **Total** | **6.5h** |

Add 1–2h buffer for unforeseen interaction with selection chrome and the soft-delete system.

---

## 12. Out of Scope (Future Phases)

- Drag-to-resize a merged cell's span by dragging its edge (different gesture; competes with grid-resize sliders).
- Shift-click range selection across cells (Phase D in multi-select-readiness — would make merging a 3×3 region a 2-click operation instead of 9).
- Drag-rectangle selection (Phase E).
- Non-rectangular merges (L-shapes, etc.) — CSS Grid doesn't support them; not worth the layout system rewrite.

---

## 13. Definition of Done

- [ ] Cells have `rowSpan`/`colSpan`; existing grids normalize without data loss.
- [ ] `Cmd+click` two adjacent cells → Merge button enabled → click merges them, anchor block survives, others discarded after confirm.
- [ ] Merged cell renders correctly on canvas, public desktop, public mobile, and all canvas preview modes.
- [ ] Selecting a merged cell shows a single tab with `Cell R-R / C-C` label and an Unmerge button.
- [ ] Unmerge restores N empty cells (anchor keeps block).
- [ ] Resizing grid down past a merged cell's footprint clamps render span without mutating stored spans; resizing back up restores.
- [ ] Hidden cells cannot participate in merge selection.
- [ ] Smoke test passes: build a 3×3 grid, merge top row, merge left 2×2 of remaining region, unmerge, resize down, resize up — all data preserved.
