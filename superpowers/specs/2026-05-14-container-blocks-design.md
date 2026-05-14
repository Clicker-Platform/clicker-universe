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

Children live at `block.data.children: ContainerChild[]`, where:

```ts
interface ContainerChild {
  block: PageBlock; // the actual child block
  size: number;     // 1–12, fraction of 12-column grid; default 12/N for N children (equal)
}
```

Sizes are stored on the container, not on the child block — keeps the child block's `data` shape free of context-specific fields, so the same block can live at the page root or inside any container without schema mismatch.

All containers render at 100% of the page content width by default. An optional `maxWidth` property caps the inner content width and centers it horizontally within the page band.

`maxWidth` values: `'sm' | 'md' | 'lg' | 'xl' | 'full'` (default `'full'` = no cap). Pixel mapping resolved at render time (e.g., `sm`=640, `md`=768, `lg`=1024, `xl`=1280; final values aligned to existing Tailwind breakpoints during implementation).

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
  maxWidth: 'full', // 'sm' | 'md' | 'lg' | 'xl' | 'full'
}

// column default
{
  children: [],
  gap: 16,
  padding: 16,
  align: 'stretch',
  maxWidth: 'full',
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
  maxWidth: 'full',
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
  children: ContainerChild[];
  onChildClick: (blockId: string) => void;
  onChildrenChange: (children: ContainerChild[]) => void;
  templateId?: string;
  sizeMode: 'flex' | 'grid'; // controls size slider semantics + label
}
```

Renders:

- `@dnd-kit/sortable` `SortableContext` with each `ContainerChild` as a sortable row.
- Each row: drag handle, block icon, block label, **size slider (1–12)**, edit chevron, delete button.
- "+ Add block" button → opens a mini picker that filters `BLOCK_OPTIONS` to exclude `row | column | grid`. Module blocks (from `subscribeToEnabledModules`) pass through normally.

### Size slider behavior

- Range 1–12, integer snap (no free-form percentages).
- Label adapts: `sizeMode === 'flex'` shows "Width: 6/12" for row, "Height: 6/12" for column. `sizeMode === 'grid'` shows "Span: 6/12 cols".
- Dragging updates `data.children[i].size` immediately → canvas re-renders in real time.
- No auto-balance: if the user creates an unbalanced row (3+3+3 = 9), the remaining 3/12 is empty space governed by `justify`. This is intentional — preserves the user's intent.
- On add: new child defaults to equal share — `size = floor(12 / N)` where N is the new count; remainder distributed left-to-right.
- On delete: remaining children keep their sizes (no rebalance).
- On mobile when `stackOnMobile === true`: sizes collapse to full-width (every child renders at 12/12).

### Edge cases
- **Deleted drilled child:** clear `drilledChildId` if the child no longer exists in `data.children` (via `useEffect` watching `data.children`).
- **dnd-kit nesting:** outer `BlockManager` `DndContext` and inner `NestedBlockList` `DndContext` are independent. Use `child.id` as the sortable ID — already unique.
- **Duplicate-block action** (if it exists in the codebase): must deep-clone `children` with fresh IDs. Verify during implementation.

## Public Rendering

Each container render component is recursive — it iterates `data.children: ContainerChild[]` and renders each via `<BlockRenderer block={child.block} {...passthroughProps} />`, wrapped in a sized container.

### Size translation

- **Row** (`flex-direction: row`): each child wrapper gets `flex: 0 0 ${size/12 * 100}%`. Children sum to ≤ 12; remainder is empty space governed by `justify`.
- **Column** (`flex-direction: column`): each child wrapper gets `flex: 0 0 ${size/12 * 100}%` of the container's height. Most columns won't have a constrained height, so size mostly acts as a min-height ratio; document this limitation in the form helper text.
- **Grid**: each child wrapper gets `gridColumn: span ${Math.min(size, columns)}`. Overflow wraps to the next row (standard CSS grid behavior).
- **Mobile + `stackOnMobile === true`**: ignore `size`; every child renders full-width via `dv()` overriding the size styles at base, restoring at `md`.

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

Children receive `onInlineChange`, `onFieldFocus`, `onFieldBlur`. The container creates a per-child handler that updates the `block.data` inside the `ContainerChild` wrapper (the `size` field is untouched):

```ts
const onChildInlineChange = (childBlockId: string) => (field: string, value: string) =>
  updateChildBlockData(childBlockId, prev => ({ ...prev, [field]: value }));
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
- Canvas drag-to-resize (handles on rendered children). v1 uses side-panel sliders only. Same data shape, so v2 can add canvas handles without schema changes.

## Testing

### Unit

- `getDefaultData('row' | 'column' | 'grid')` returns the documented shape.
- `NestedBlockList` reorder produces correct array order.
- Drill-down state clears when the drilled child is deleted.
- Mini picker excludes `row | column | grid` from its options.
- Size slider clamps to 1–12; new child gets `floor(12/N)` with remainder distributed left-to-right.
- Delete preserves remaining children's sizes (no auto-rebalance).

### Manual / visual
- Row/column/grid render correctly on canvas in desktop, tablet, and mobile preview modes — verifying `dv()` works as expected.
- Inline edit on a button inside a row updates the correct child.
- Full UX flow: add container → add children → reorder → resize via slider → drill in → edit child → back out → delete child → save.
- Unbalanced row (3+3+3 = 9/12) renders with empty space on the right, governed by `justify`.
- Mobile preview: sized row collapses to full-width children when `stackOnMobile` is on.
- Empty container shows placeholder in editor, renders `null` on public site.

## Implementation Notes

- The forms are thin — most of the work is in `NestedBlockList` and the mobile-stacking render logic.
- Follow `/create_block` checklist three times (or once, batched) for the registration handoff.
- Inline edit prop-drilling through the recursive renderer is the most likely source of subtle bugs — pay attention during testing.
