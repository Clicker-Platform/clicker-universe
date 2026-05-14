# Container Blocks — Sketch

**Date:** 2026-05-14
**Status:** Idea sketch only. Not a spec, not a plan. Build when ready.

## Goal

Add layout capability to Canvas Studio by introducing blocks that can contain other blocks — without changing anything in the existing core block system.

## Approach

Three new blocks (split rather than one `container` with a `layout` dropdown — better UX in the block picker, cleaner property forms):

- **`row`** — horizontal flex
- **`column`** — vertical flex
- **`grid`** — CSS grid

Each holds children as a property, not as part of the page's top-level `blocks[]`. The page model stays flat; nesting lives inside one block's `properties.children`.

## Block schema (rough)

```ts
properties: {
  children: BlockInstance[]   // the key trick
  gap: number
  padding: number
  background?: string
  maxWidth?: number
  // row-specific: align, justify, wrap
  // column-specific: align
  // grid-specific: columns, responsive
}
```

## Renderer (rough)

Recursive — just call the existing `BlockRenderer` per child:

```tsx
export function RowBlock({ block }) {
  const { children = [], gap, ...rest } = block.properties
  return (
    <div style={{ display: 'flex', flexDirection: 'row', gap }}>
      {children.map(child => <BlockRenderer key={child.id} block={child} />)}
    </div>
  )
}
```

## Why this stays isolated

- No registry changes (just new entries)
- No PageStudioContext changes (page still stores flat `blocks[]`)
- No CanvasStudio selection-logic changes
- Only new piece: a property form that manages a list of nested blocks (add via block picker, expand to edit via `BlockFormRenderer`, remove/reorder)

## The one real tradeoff

Editing nested children inside a side-panel form is cramped. The "real" page-builder UX is click-into-container on canvas, but that requires touching CanvasStudio selection — which breaks the isolation constraint. Accept the nested-form UX for v1.

## When to formalize

When ready to build: invoke `/brainstorming` for the property-form UX (the only non-trivial part), then `/create_block` × 3 for the registration checklist.
