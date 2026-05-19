# Multi-Select Readiness — Canvas Studio

**Date:** 2026-05-16
**Status:** Reference spec — captures the current state of multi-select readiness and the phased plan to actually ship it. Not yet scheduled for implementation.

## Why this spec exists

The `EditorSelection` model (see `2026-05-16-editor-selection-model.md`) was
designed with `ids: string[]` from day one, anticipating future multi-select
workflows like:

- **Cmd+click multiple blocks** to bulk-delete, bulk-copy, or change shared
  properties.
- **Select multiple grid cells to merge** into one (e.g., row 1 cells 2–3–4
  merge into a single wider cell, leaving 3 cells in that row).
- **Range select with Shift+click** for keyboard-power-user workflows.

The "arrays from day one" decision means the state shape is forward-
compatible. But **the rest of the codebase isn't**. This spec audits what
actually works today, what's missing, and the phased work to fill the gap.

## Honest readiness audit (snapshot 2026-05-16)

### ✅ Layer 1: Data shape is ready
- `EditorSelection.kind === 'blocks'` carries `ids: string[]`
- `EditorSelection.kind === 'slots'` carries `containerId: string` + `ids: string[]`
- `setSelection({ kind: 'blocks', ids: ['a', 'b', 'c'] })` is valid TypeScript today

### ✅ Layer 2: Two consumers already handle multi-id correctly
- `BlockManager.tsx:40` — outline highlights any block whose id is in the selection (uses `.includes()`)
- `SelectableBlock.tsx:58` — selection chrome shows for any block in `selection.ids`

Setting a multi-block selection programmatically right now would show all
selected blocks visually highlighted in both the outline panel and the canvas.

### ❌ Layer 3: 17 call sites assume single-id

The following consumers gate on `selection.ids.length === 1` (or equivalent)
and silently fall back to first-only or "not found" when multi-id is set:

| File | Line | Behavior with multi-id today |
|---|---|---|
| `CanvasStudio.tsx` | 54 | `selectedBlockId` derived var → `null` (no chrome render) |
| `CanvasStudio.tsx` | 656 | Form panel `'blocks'` branch skipped → falls through to placeholder |
| `CanvasStudio.tsx` | 658 | Block lookup → "Block not found" |
| `ColumnsForm.tsx` | 50 | Active-tab derivation → falls back to column 0 |
| `ColumnsForm.tsx` | 55 | Auto-drill on nested block select → skipped |
| `ColumnsForm.tsx` | 77 | `drilledBlockId` derivation → `null` (no drill) |
| `GridForm.tsx` | 57 | Active-cell from slot selection → falls back to first cell |
| `GridForm.tsx` | 62 | Active-cell from block selection → falls back |
| `GridForm.tsx` | 84 | Drilled-cell derivation → `null` |
| `DefaultColumnsBlock.tsx` | 47 | Column highlight → no column highlighted |
| `DefaultGridBlock.tsx` | 47 | Cell highlight → no cell highlighted |
| `EditorContext.tsx` | 26 | `singleBlockId()` helper → `null` (by design) |
| `EditorContext.tsx` | 31 | `singleSlotId()` helper → `null` (by design) |

### ❌ Layer 4: No UI gestures to create multi-selection
- **No Cmd+click / Shift+click handlers** in `SelectableBlock` or container
  slot click handlers. Every click writes `ids: [singleId]`, replacing prior
  selection.
- **No drag-to-select rectangle** on canvas.
- **No "select all" keyboard shortcut**.
- **`BlockManager` outline panel** is single-click only.

### ❌ Layer 5: No bulk actions defined
- No "delete N blocks" UI affordance.
- No "merge cells" action (the use case that motivated the array shape).
- No "apply same property to all" form mode.

## Realistic readiness score

| Layer | Ready? |
|---|---|
| Data shape | ✅ 100% |
| Selection setter (`setSelection`) | ✅ 100% |
| `SelectableBlock` chrome (visual) | ✅ 100% |
| `BlockManager` outline highlight | ✅ 100% |
| Container slot highlight (multi-slot) | ❌ 0% |
| Form behavior with multi-select | ❌ 0% |
| Form panel rendering for multi-block | ❌ 0% |
| UI gestures (Cmd/Shift+click, drag-rect) | ❌ 0% |
| Bulk action affordances | ❌ 0% |
| Grid-cell merge data model + UI | ❌ 0% |

**Overall: ~30% ready** — the foundation is in place, but the "easy 30%."
The remaining 70% is design work + targeted code in 5+ files.

## Phased plan

### Phase A — Tolerate (defensive baseline)
**Goal:** existing consumers stop silently breaking when multi-id selection
exists. Even without UI to create multi-selection, the codebase should be
robust to it (a future bug or someone setting `ids: ['x', 'y']` directly
shouldn't crash or show "Block not found").

For each consumer listed in Layer 3:
- If `ids.length > 1`, render a **neutral fallback** (not an error):
  - `CanvasStudio.tsx` form panel: render a small "N blocks selected — pick
    one to edit, or use bulk actions" placeholder
  - Container highlights: highlight **all** matching slots in the array
    (drop the `length === 1` gate; the matching logic already iterates)
  - Form active tab: still show the first matching tab, but don't crash
- Add `multiBlockIds()` and `multiSlotIds()` helpers in `EditorContext`
  returning the array (or null if not the matching kind). These pair with
  the existing `singleBlockId` / `singleSlotId` helpers.

**Estimate:** ~2 hours. Pure defensive work; no UX additions.

**Verification:** programmatically run `setSelection({ kind: 'blocks', ids:
['a', 'b'] })` in a console and confirm no crash, both blocks show chrome,
form panel shows a sensible placeholder.

### Phase B — Cmd+click gesture (multi-block select)
**Goal:** users can Cmd+click to add/remove blocks from a multi-selection.

- `SelectableBlock`'s onClick:
  ```ts
  const handleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (e.metaKey || e.ctrlKey) {
          // Toggle this block in the current selection
          const current = selection.kind === 'blocks' ? selection.ids : [];
          const next = current.includes(blockId)
              ? current.filter(id => id !== blockId)
              : [...current, blockId];
          setSelection(next.length === 0 ? { kind: 'none' } : { kind: 'blocks', ids: next });
      } else {
          setSelection({ kind: 'blocks', ids: [blockId] });
      }
      // ... existing inline-edit handling
  };
  ```
- Background click still clears (already correct).
- **Form panel** when multi-block: shows a panel with shared editable properties
  (e.g., "5 blocks selected" + delete button + maybe shared margin/padding controls).

**Decision needed:** which properties should be shared-editable across
heterogeneous block types? Probably just a "delete all" button initially.

**Estimate:** ~2 hours.

### Phase C — Grid cell merge (the headline use case)
**Goal:** select multiple adjacent grid cells via Cmd+click, then "Merge"
to combine them into a single cell that spans multiple rows/columns.

This requires **data model changes**:

Current `GridCell`:
```ts
interface GridCell {
    id: string;
    row: number;
    col: number;
    block: PageBlock | null;
}
```

Proposed `GridCell` (with span):
```ts
interface GridCell {
    id: string;
    row: number;
    col: number;
    rowSpan: number;  // default 1
    colSpan: number;  // default 1
    block: PageBlock | null;
}
```

When cells (a,b,c) merge: pick one as the "anchor" (top-left of the merged
region), set its `rowSpan` and `colSpan` to cover the region, **delete** the
other cells. CSS Grid renders the anchor with `grid-column: c / span colSpan`
and `grid-row: r / span rowSpan`.

**UI:**
- Cmd+click cells to build multi-selection (Phase B mechanic applied to slots)
- When multi-slot selection is **rectangular and contiguous**, show a "Merge"
  action in the GridForm.
- "Unmerge" reverses: split the anchor's span back into individual cells.

**Constraints:**
- Only rectangular contiguous selections can be merged. Non-rectangular
  selections disable the action (with a tooltip explaining why).
- Merging across hidden cells (those outside cols × rows) is disallowed.
- The form's cell tab strip needs to handle merged cells (show one tab for
  the merged region, with a "Span: 2×2" annotation).

**Estimate:** ~6-8 hours including the data model migration, render changes,
form changes, and the merge/unmerge actions. **Not trivial** — this is its
own feature, not a "small extension."

### Phase D — Range select (Shift+click)
**Goal:** Shift+click on a block or cell selects everything between the
previously selected one and the clicked one.

Requires tracking the "anchor" of the range (last single-clicked item).
Stored either in `EditorContext` as a separate field (`rangeAnchorId:
string | null`) or computed from `selection.ids[selection.ids.length - 1]`
(the most-recently-added id).

**Estimate:** ~1.5 hours after Phases A and B are done.

### Phase E — Drag-to-select rectangle (optional)
**Goal:** click-and-drag on empty canvas area to draw a marquee that selects
all blocks whose bounding boxes intersect it.

This is a real engineering project — requires bounding-box computation, a
draggable overlay div, modifier-key handling for Add vs Replace. Useful for
Figma-style power-user workflows but not essential.

**Estimate:** ~6-10 hours. Skip unless explicitly prioritized.

## Recommended order

For incremental value with bounded risk:

1. **Phase A first** (defensive baseline). Cheap, makes the codebase robust
   to multi-selection regardless of what UI we add later.
2. **Phase B** (Cmd+click). The minimum useful gesture. Once this lands,
   the codebase has end-to-end multi-select for blocks.
3. **Phase C** (grid-cell merge). The headline use case. Only do this when
   the user actually needs it.
4. Phases D and E only if specifically requested.

## Non-goals

- **Cross-page multi-select**. Selection is scoped to the currently active
  page.
- **Multi-select across nested boundaries**. Selecting "a top-level block
  AND a block nested inside a Columns container" is allowed by the type but
  has no useful action; UI should not produce such selections.
- **Persistence**. Multi-selection is session-only, not saved.
- **Undo/redo for selection changes**. Selection state is not part of the
  undo history (block edits are, but not "I had B and C selected, now I
  have just C").

## Open questions

1. **What's the right behavior of the form panel with multi-block?** Show
   a generic "N selected" panel with bulk actions? Show the form of the
   first-selected block? Hybrid? Need a small design pass before Phase A
   to pick.
2. **For merged grid cells, how do hidden (out-of-bounds) cells interact?**
   The current soft-delete model means cells with `row > rows || col >
   cols` persist invisibly. Probably: merged regions can only include
   visible cells; merging would fail if any selected cell is hidden.
3. **Multi-select indicator in form panel** — is there a counter ("5
   blocks selected")? An explicit "Clear selection" button?

## Risks / pitfalls

- **Sync regressions**. The Phase 3 selection bug was an oscillating state
  loop between context and form local state. The single-source-of-truth
  model in the current selection spec prevents that. Multi-select work
  must continue to honor this — **no form local state mirroring `selection`**.
- **Heterogeneous selection panels**. If you select 5 different block types
  (a Heading, two Buttons, an Image, a FAQ), the "shared properties" set is
  small. Most form panels will need to show "no shared properties" gracefully.
- **Click event handling complexity**. Cmd/Shift/regular click in the
  presence of stopPropagation, nested SelectableBlocks, and the page-root
  background-click handler can produce surprising combinations. Phase B
  testing must cover edge cases: Cmd+click empty space (does nothing?),
  Cmd+click background (clears?), Cmd+click chrome (allow?), etc.

## Implementation history

None yet. This spec is forward-looking. Last updated 2026-05-16.

## References

- `superpowers/specs/2026-05-16-editor-selection-model.md` — the selection model foundation
- `superpowers/specs/2026-05-16-container-blocks-current.md` — current Columns + Grid implementation (where slot selection lives)
- `superpowers/notes/2026-05-16-canvas-selection-session.md` — session retro that captured the "arrays from day one" decision
