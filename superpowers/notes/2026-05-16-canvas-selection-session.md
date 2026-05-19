# Canvas Selection Model — Session Notes (2026-05-15 → 2026-05-16)

## What this session shipped

15 commits to `origin/dev`. Canvas Studio in Clicker Platform went from
"only top-level blocks selectable on canvas" to "any block or container slot
selectable, on a clean single-source-of-truth state model."

### Major milestones (in order)

| Commit | Feature |
|---|---|
| `c067a97` | Container blocks — Columns + Grid (the foundation feature) |
| `ae5f62f` | Featured Product + Inline Form theme alignment |
| `dba79dd` | Refactor plan doc for container blocks |
| `6a6e0d6` | Theme audit — removed `brand-*` legacy across 6 blocks |
| `a6843e9` | Columns padding overflow fix + isHydrating loading state + active highlight |
| `d11d93b` | Phase 1+2 of direct canvas selection (nested block clickable) — buggy Phase 3 bundled |
| `8b004bd` | Tactical Phase 3 revert (kept 1+2, dropped infinite-loop code) |
| `e190660` | `EditorSelection` model introduced (compat layer alongside old fields) |
| `b2c0233` | All consumers migrated, compat layer removed |
| `9c58085` | Form local state dropped; empty-slot canvas clicks work, no loops |

## The big architectural lesson

### The Phase 3 disaster (and why)

First Phase 3 attempt added empty-column/cell click handlers with a state
shape that caused **infinite update loops**. After ~5 attempted patches, I
gave up and reverted (`8b004bd`).

**Root cause was structural, not a bad line:** two pieces of state
(`selectedBlockId` and `activeContainerSlotId` at the context level,
`activeIdx` and `activeCellId` at the form level) were synced via
`useEffect` running in both directions. Form-state → context-state effect,
context-state → form-state effect. After enough click activity, they could
ping each other indefinitely.

The user pushed back on a tactical retry and demanded a real foundation.

### The fix that worked

Replaced 4 state pieces with one discriminated union in EditorContext:

```ts
type EditorSelection =
  | { kind: 'none' }
  | { kind: 'blocks'; ids: string[] }
  | { kind: 'slots'; containerId: string; ids: string[] }
  | { kind: 'chrome'; chromeId: 'header' | 'footer' | 'bottomnav' };
```

**One owner. One setter. Atomic single-write transitions.** Forms derive
their active tab from `selection` — no `useState`, no mirror effects.
Canvas slot clicks write directly to `selection`. The shape **cannot
oscillate**.

The state model is forward-compatible with multi-select (arrays of ids
from day one) — important for the future grid-cell-merge feature the user
mentioned (select cells, merge into one).

## Files / patterns worth remembering for next session

### Files modified
- `EditorContext.tsx` — owns `selection`, `setSelection`
- `SelectableBlock.tsx` — admin wrapper for any block (top-level or nested),
  uses `useContext(EditorContext)` with fallback for public-site safety
- `ColumnsForm.tsx`, `GridForm.tsx` — derive `safeActiveIdx`, `drilledBlockId`
  from `selection`; setters write through `setSelection`
- `DefaultColumnsBlock.tsx`, `DefaultGridBlock.tsx` — read selection from
  context (admin only); render highlight; column/cell wrapper has onClick
  with `e.target !== e.currentTarget` guard so nested clicks aren't caught
- `BlockRenderer.tsx` — passes `containerBlockId={block.id}` to container
  renderers so they can write proper slot selection
- `BlockFormRenderer.tsx` — passes `containerBlockId={block.id}` to forms
- `CanvasStudio.tsx` — `selection.kind` switch for form-panel rendering;
  `hasSelectionForForm = selection.kind !== 'none'` drives `activePanel` sync

### Key patterns
- **Single-direction data flow**: form/canvas → setSelection → context →
  re-render of derivative state. No back-edges. No useEffect that watches
  one piece and writes another.
- **Safe context access from public-side files**:
  `const editor = useContext(EditorContext)` with a fallback (`if (!editor)
  return <>{children}</>;`). Used by `SelectableBlock` and the container
  renderers so they're safe to import from both admin and public bundles.
- **`e.target !== e.currentTarget` guard** for container click handlers
  to avoid catching clicks on nested children. Critical for letting nested
  SelectableBlock catch its own clicks first.
- **`pointer-events-auto` for container block types** (`columns`, `grid`)
  inside `SelectableBlock`. Otherwise the page-root SelectableBlock's
  `pointer-events-none` content layer disables interaction with every
  nested wrapper.

### Spec doc
`superpowers/specs/2026-05-16-editor-selection-model.md` documents the
state model, transitions, per-component responsibilities, and migration
plan. Reference this before adding new selection-touching features.

## What's still deferred (future work)

1. **Inline editing for nested hero/heading blocks**. Current top-level
   inline edit (`onInlineChange`, `onFieldFocus`, `onFieldBlur`) is gated
   on `selectedBlockId === block.id` at the top level. Nested blocks don't
   get those callbacks. Requires:
   - Path-aware `updateBlockData` (recurse into container children)
   - Per-child callback synthesis in container renderers
   - Threading `setInlineFocus` so nested toolbar appears at the right
     position
   Scoped at ~1.5–2 hours. User confirmed this is on the path toward
   "inline editing everywhere" + floating contextual panels.

2. **Multi-select UI**. State shape supports it (`ids: string[]`), but no
   Cmd+click handler yet. The user wants this for "merge grid cells" UX.

3. **Floating contextual property panel** (Squarespace-style). Will sit on
   top of the `selection` foundation. The selection model is shape-ready
   for whatever positioning needs the floating panel has.

## User's overall direction (for context)

The user is building toward:
- All block text → inline editing (no side-panel for text changes)
- Floating contextual block properties (like Squarespace)
- Heavy visual canvas interactions (drag, select, multi-select, merge)

The selection model now in place is the **foundation** for all of this. The
spec doc + the no-mirror-effects discipline should be honored going forward.

## Working style notes (from this session)

- The user prefers: spec doc → review → commit-by-commit execution with
  verification between commits
- "Don't commit yet" / "no auto commit and push" — wait for explicit
  approval before pushing
- The user pushes back hard on flip-flopping and rushed fixes; honest
  acknowledgment of when I'm guessing vs verified is appreciated
- When stuck in a debugging loop with stacking patches, the right move is
  to **revert** and re-architect, not keep patching
- Working tree was deliberately kept on branch `dev` (no worktree) — the
  user prefers simplicity over isolation
