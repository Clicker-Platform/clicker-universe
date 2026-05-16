# Editor Selection Model — Spec

**Status:** Proposed — pending user review
**Date:** 2026-05-16
**Context:** Replaces the previous Phase 3 attempt (commit `8b004bd` reverted it).

## Why this exists

The previous attempt to enable "click empty column/cell area on canvas" produced an
infinite-update-loop crash that resisted multiple tactical fixes. The root cause
was **architectural**, not a single bad line of code:

- `selectedBlockId` (string) and `activeContainerSlotId` (string) lived as two
  separate fields in `EditorContext`.
- Forms had local `activeIdx` / `activeCellId` state representing the same
  concept as `activeContainerSlotId`.
- Mirror effects synced local state → context, and reverse effects synced
  context → local state. These two effects could ping each other.

This spec defines a cleaner foundation that:

- Has exactly one owner of selection state.
- Treats every selection transition as an atomic single write.
- Is forward-compatible with multi-select (e.g. selecting multiple grid cells
  to merge into one).

## The data model

Replace `selectedBlockId: string | null` (and `activeContainerSlotId`) in
`EditorContext` with a single discriminated union:

```ts
export type EditorSelection =
  | { kind: 'none' }
  | { kind: 'blocks'; ids: string[] }
  // Container slot selection (empty column area, empty grid cell). Multiple
  // slot ids supported from day one for future "merge cells" workflows even
  // though current UI only sets length=1.
  | { kind: 'slots'; containerId: string; ids: string[] }
  // Page chrome (header/footer/bottom nav) — preserved from existing string
  // sentinel values like 'chrome:header'.
  | { kind: 'chrome'; chromeId: 'header' | 'footer' | 'bottomnav' };
```

**Single field**: `selection: EditorSelection`.
**Single setter**: `setSelection(s: EditorSelection)`.

### Why arrays from day one

Q2 of the design discussion: future work includes Cmd+click multi-select and
the grid-cell merge feature. Today both `blocks` and `slots` always have
`ids.length === 1` because there's no UI to add multiple, but the array shape
means tomorrow's multi-select is purely additive (no breaking change to the
selection model). Helpers will make single-id reads ergonomic:

```ts
export function singleBlockId(s: EditorSelection): string | null {
  return s.kind === 'blocks' && s.ids.length === 1 ? s.ids[0] : null;
}
export function singleSlotId(s: EditorSelection): string | null {
  return s.kind === 'slots' && s.ids.length === 1 ? s.ids[0] : null;
}
```

### Why `chrome` is in the union

The existing code uses string sentinels (`'chrome:header'`, `'chrome:footer'`,
`'chrome:bottomnav'`) as block ids. Keeping these as a typed variant rather
than continuing the string-sentinel pattern makes intent explicit and
type-safe. The migration converts the sentinels.

## State transitions (the complete set)

| Action | New selection |
|---|---|
| Click any top-level block on canvas | `{ kind: 'blocks', ids: [blockId] }` |
| Click a nested block inside a container | `{ kind: 'blocks', ids: [nestedId] }` |
| Click empty area inside a column slot | `{ kind: 'slots', containerId, ids: [slotId] }` |
| Click an empty grid cell | `{ kind: 'slots', containerId, ids: [cellId] }` |
| Click the page background (outside all blocks) | `{ kind: 'none' }` |
| Click site header / footer / bottom nav | `{ kind: 'chrome', chromeId: 'header' \| 'footer' \| 'bottomnav' }` |
| User clicks a form tab in the side panel (column or cell) | `{ kind: 'slots', containerId, ids: [slotId] }` |
| User adds a new block via the picker | `{ kind: 'blocks', ids: [newBlockId] }` |
| User deletes a block | `{ kind: 'none' }` |
| User switches pages | `{ kind: 'none' }` |

**No transition writes to two fields.** Every transition is a single
`setSelection(...)` call.

## Per-component responsibilities

### `EditorContext` (owner)
- Owns the `selection: EditorSelection` state.
- Exposes `selection` and `setSelection`.
- Provides backwards-compat helpers `selectedBlockId` and `activeContainerSlotId`
  derived from `selection` **temporarily** during migration commit 1.
- After commit 2: those compat helpers are removed.

### `SelectableBlock` (renderer wrapper, admin canvas only)
- Reads `selection` from context (with `useContext(EditorContext)`).
- Determines `isSelected` via `selection.kind === 'blocks' && selection.ids.includes(blockId)`.
- onClick: `setSelection({ kind: 'blocks', ids: [blockId] })`.
- No coupling to form state.

### `DefaultColumnsBlock`, `DefaultGridBlock` (public renderers)
- Read `selection` from context safely (`useContext` with fallback for public site).
- For each slot, determines highlight: `selection.kind === 'slots' && selection.ids.includes(slot.id) && selection.containerId === parentBlockId`.
- onClick on column/cell wrapper: writes `{ kind: 'slots', containerId, ids: [slot.id] }` to context. Uses `e.target === e.currentTarget` to avoid catching nested-block clicks.

### `ColumnsForm`, `GridForm`
- **No local active-index state.**
- Derive active tab from `selection` (when `kind === 'slots'` and `containerId` matches the form's block id, the active tab is the column/cell with matching id).
- Tab click handler: writes `{ kind: 'slots', containerId, ids: [slotId] }` directly to context.
- **Drill-down state stays local** — `drilledBlockId` is form-internal navigation, not selection. When `selection.kind === 'blocks'` matches a nested block, the form auto-drills via a useEffect (this is the only form effect that reads selection, and it only writes form-internal state).

### `CanvasStudio` (form panel rendering)
- Reads `selection`. Form-rendering logic switches on `selection.kind`:
  - `'none'` → page-level Title/Slug panel (unless user explicitly opened SEO/background tab)
  - `'chrome'` → corresponding chrome panel
  - `'blocks'` (length 1) → top-level form, or parent container form with drill-down
  - `'slots'` → parent container form, tab derived from `slotId`
  - `'blocks'` (length >1, future) → "multi-select properties" panel (out of scope)
- `activePanel` (existing state for page/seo/background tabs) becomes simpler: it's only consulted when `selection.kind === 'none'`. When a block or slot is selected, `activePanel` is effectively ignored — no need for the sync effects that previously fought over it.

### `BlockManager` (outline panel)
- Reads `selection` to highlight the matching outline entry.
- Click on outline entry writes appropriate selection.

## Migration plan (3 commits)

### Commit 1: Introduce `selection` alongside existing fields
- Add `selection: EditorSelection` + `setSelection` to `EditorContext`.
- Compute `selectedBlockId` and `activeContainerSlotId` as derived getters from
  `selection` (temporary backwards-compat layer).
- All existing consumers continue to read `selectedBlockId` and
  `activeContainerSlotId` unchanged.
- No new features added. No behavior change.
- **Verify**: existing Phase 1+2 selection still works exactly as before.

### Commit 2: Migrate consumers to `selection`
- Replace all reads of `selectedBlockId` and `activeContainerSlotId` with
  reads of `selection` (using helpers).
- Replace all writes to those individual setters with `setSelection({...})`.
- Remove the backwards-compat getters from EditorContext.
- Forms still have local `activeIdx` / `activeCellId` state.
- **Verify**: existing Phase 1+2 selection still works. No regressions.

### Commit 3: Add empty-slot click handlers + drop form local state
- Add onClick to column wrapper / cell wrapper in `DefaultColumnsBlock` and
  `DefaultGridBlock`.
- Remove `activeIdx`/`activeCellId` local state from `ColumnsForm`/`GridForm`.
  Derive directly from `selection`.
- Tab click handlers write to context directly.
- Form rendering in CanvasStudio handles `selection.kind === 'slots'` case to
  render the parent container form when only a slot is selected.
- **Verify**: empty column / cell click works. Clicking many blocks in
  succession does not crash.

Each commit is verifiable on its own. If Commit 3 introduces problems, we can
land Commits 1+2 (clean architecture) and defer Commit 3.

## Out of scope

- **Multi-select UI** (Cmd+click). Shape supports it, but no handler added.
- **Grid cell merge** workflow. Future feature using multi-select.
- **Inline editing for nested hero/heading blocks**. Separate problem
  (path-aware `updateBlockData`). Tracked separately.
- **Floating contextual property panel.** Future UX initiative; this spec is
  a foundation it can sit on.
- **Selection persistence across page reloads.** Not needed; selection is
  session state.
- **Keyboard shortcuts** for selection (arrow keys, escape, etc.). Future.

## Risks

1. **Migration touches many files**. Mitigation: 3-commit staging means each
   intermediate state is verifiable.
2. **Existing string-sentinel `'chrome:header'` ids**. Migration must
   correctly map these to `{ kind: 'chrome', chromeId: 'header' }`.
3. **Form drill-down state interaction**. When `selection.kind === 'blocks'`
   for a nested block, the form should auto-drill. Need to verify this works
   without re-introducing a sync loop. The key is: only ONE direction
   (`selection` → form's `drilledBlockId`). Form clicks on "Back to Columns"
   writes `{ kind: 'slots', ... }` to selection; selection writes never
   originate from the drill-down effect.

## Open questions

None at time of writing. User has reviewed the discriminated-union shape and
the array-from-day-one decision.
