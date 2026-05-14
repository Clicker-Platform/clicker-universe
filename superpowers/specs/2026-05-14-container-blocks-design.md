# Container Blocks — Design

**Date:** 2026-05-14
**Status:** Approved design, ready for implementation plan
**Sketch source:** [superpowers/notes/2026-05-14-container-blocks-sketch.md](../notes/2026-05-14-container-blocks-sketch.md)

## Goal

Add layout capability to Canvas Studio by introducing three block types that can contain other blocks — `row`, `column`, `grid` — without changing the existing core block system, page model, outline, or selection logic.

## Settled Constraints

- All three containers in scope, single phase.
- One level of nesting only: containers hold leaf blocks; containers cannot hold containers.
- Children edited via side-panel drill-down (no canvas selection changes).
- Children NOT visible in the main outline.
- Picker shows three flat entries; no grouping/categories.

## Architecture & Boundaries

### What changes
- New block types `row | column | grid` added to the `BlockType` union in `data/mockData.ts`.
- 3 new form components: `RowForm`, `ColumnForm`, `GridForm` in `components/admin/blocks/forms/`.
- 3 new public render components: `DefaultRowBlock`, `DefaultColumnBlock`, `DefaultGridBlock` in `components/blocks/public/`.
- 1 shared admin component: `NestedBlockList` — dnd-kit reorderable list of children.
- 1 shared admin component: `EmptyContainerPlaceholder` — editor-only dashed box.
- Entries in `BlockRenderer.tsx` switch, `BlockFormRenderer.tsx` switch, and `blockDefinitions.ts` (`BLOCK_OPTIONS` + `getDefaultData`).

### What does NOT change
- `PageBlock` interface — children live in `data.children`, which is already `any`-typed.
- `BlockManager`, `BlockOutlineItem` — outline stays flat, container appears as one row.
- `PageStudioContext`, `EditorContext` — no new global state.
- Block picker UI in `LeftSidebarPanels.tsx` — three new flat entries, no grouping infrastructure.
- `PublicPageRenderer` — recursion happens inside the container render components.

## Data Model

Children live at `block.data.children: PageBlock[]`.

```ts
// row default
{
  children: [],
  gap: 16,          // px
  padding: 16,      // px
  align: 'center',  // 'start' | 'center' | 'end' | 'stretch'
  justify: 'start', // 'start' | 'center' | 'end' | 'between' | 'around'
  wrap: false,      // boolean toggle (maps to flex-wrap: wrap / nowrap)
  stackOnMobile: true,
}

// column default
{
  children: [],
  gap: 16,
  padding: 16,
  align: 'stretch',
  // No stackOnMobile — column is already vertical.
}

// grid default
{
  children: [],
  columns: 3,           // desktop column count
  gapX: 16,
  gapY: 16,
  padding: 16,
  stackOnMobile: true,
}
```

## The Nested Form UX (drill-down)

State is local to the container's form, not lifted to `EditorContext`. This preserves isolation.

```ts
const [drilledChildId, setDrilledChildId] = useState<string | null>(null);
```

### Render logic (shared across Row/Column/Grid forms)

When `drilledChildId` is set:
1. Show a "← Back to {Container Label}" button.
2. Show a small label: "Editing: {child.type}".
3. Render `<BlockFormRenderer block={child} onChange={updateChild} templateId={templateId} onOpenSlideOver={onOpenSlideOver} />` — full reuse of existing form renderer.

When `drilledChildId` is null:
1. Show the container's own properties (gap/padding/align/etc.).
2. Show `<NestedBlockList>` with the children.

### `NestedBlockList` — shared component

Reusable across all three container types. Props:
```ts
{
  children: PageBlock[];
  onChildClick: (id: string) => void;
  onChildrenChange: (children: PageBlock[]) => void;
  templateId?: string;
}
```

Renders:
- `@dnd-kit/sortable` `SortableContext` with each child as a sortable row.
- Each row: drag handle, block icon, block label, edit chevron, delete button.
- "+ Add block" button → opens a mini picker that filters `BLOCK_OPTIONS` to exclude `row | column | grid`. Module blocks (from `subscribeToEnabledModules`) pass through normally.

### Edge cases
- **Deleted drilled child:** clear `drilledChildId` if the child no longer exists in `data.children` (via `useEffect` watching `data.children`).
- **dnd-kit nesting:** outer `BlockManager` `DndContext` and inner `NestedBlockList` `DndContext` are independent. Use `child.id` as the sortable ID — already unique.
- **Duplicate-block action** (if it exists in the codebase): must deep-clone `children` with fresh IDs. Verify during implementation.

## Public Rendering

Each container render component is recursive — it calls `<BlockRenderer block={child} {...passthroughProps} />` per child, forwarding all inline-edit and context props.

### Mobile stacking via `dv()` helper

Required because Tailwind `md:` fires on real viewport, not the canvas preview frame (per [memory: feedback_canvas_preview_md_breakpoint](../../.claude/projects/-Users-andre-Repository-clicker-universe--bare/memory/feedback_canvas_preview_md_breakpoint.md)).

```tsx
// DefaultRowBlock
const flexClasses = dv({
  base: stackOnMobile ? 'flex flex-col' : 'flex flex-row',
  md:   'flex-row',
});
```

`DefaultGridBlock` uses `gridTemplateColumns: '1fr'` on mobile (when `stackOnMobile`) and `repeat(${columns}, 1fr)` at md+.

### Inline editing

Children receive `onInlineChange`, `onFieldFocus`, `onFieldBlur`. The container creates a per-child handler:
```ts
const onChildInlineChange = (childId: string) => (field: string, value: string) =>
  updateChild(childId, { ...findChild(childId).data, [field]: value });
```

### Empty state
- **Editor (`previewMode === true`) + zero children:** render `<EmptyContainerPlaceholder type="row" />` — dashed border, text "Empty Row — add blocks from the side panel" (variant per container type).
- **Public site (`previewMode !== true`) + zero children:** render `null`.

### Dynamic imports
Containers register in `BlockRenderer.tsx` via `next/dynamic` (not static), matching the pattern for non-LCP-critical blocks at lines 10–22.

## Block Picker

Three new entries in `BLOCK_OPTIONS` (order: append at end, no grouping):
```ts
{ type: 'row',    label: 'Row',    icon: <lucide icon, chosen at impl time> },
{ type: 'column', label: 'Column', icon: <lucide icon, chosen at impl time> },
{ type: 'grid',   label: 'Grid',   icon: LayoutGrid }, // already imported
```

Final icon choices for Row/Column will be picked from `lucide-react` during implementation (candidates: `Rows3`/`Columns3`, or alignment icons). This is a cosmetic decision, not a blocking design choice.

## Out of Scope (Explicit Non-Goals)

- Container-in-container nesting.
- Per-breakpoint property overrides (different gap on tablet vs desktop, etc.).
- Click-into-container selection on canvas.
- Children visible in the main outline / `BlockManager`.
- Picker grouping or categories.
- Migrations — containers are new; no backfill needed.

## Testing

### Unit
- `getDefaultData('row' | 'column' | 'grid')` returns the documented shape.
- `NestedBlockList` reorder produces correct array order.
- Drill-down state clears when the drilled child is deleted.
- Mini picker excludes `row | column | grid` from its options.

### Manual / visual
- Row/column/grid render correctly on canvas in desktop, tablet, and mobile preview modes — verifying `dv()` works as expected.
- Inline edit on a button inside a row updates the correct child.
- Full UX flow: add container → add children → reorder → drill in → edit child → back out → delete child → save.
- Empty container shows placeholder in editor, renders `null` on public site.

## Implementation Notes

- The forms are thin — most of the work is in `NestedBlockList` and the mobile-stacking render logic.
- Follow `/create_block` checklist three times (or once, batched) for the registration handoff.
- Inline edit prop-drilling through the recursive renderer is the most likely source of subtle bugs — pay attention during testing.
