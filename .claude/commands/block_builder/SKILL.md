---
name: block_builder
description: Guide for an AI agent to implement the advanced Block Builder bridging into Canvas Studio.
---

# Skill: Implement Block Builder

You are an expert Next.js, Tailwind, and React architecture developer. Your task is to implement the "Block Builder" — a system that outputs reusable node-trees matching the `CustomBlockDefinition` interface, which can be injected natively into the existing flat-array Canvas Studio architecture.

## 1. Context & Architecture Rules

Do NOT rewrite the existing `CanvasStudio.tsx` or attempt to turn the main page builder into a recursive tree. The core Page Builder must remain a 1D flat array of `PageBlock`s.

Your goal is to build an **isolated sub-system** that generates a custom block, which Canvas Studio simply points to via a `refId`.

**Crucial Reference Document:**
You MUST read the `BLOCK_BUILDER_SPEC.md` file in this same folder for the exact Firestore schema, `AtomicNode` / `AtomicStyles` types, the rendering loop, and the v1 drag-and-drop decision before generating any code.

## 2. Execution Phases

When asked to implement this system, proceed according to the phase requested by the user.

### Phase 1: Data & Headless Rendering

1. Create `lib/core/atomic-types.ts` defining `AtomicNode`, `AtomicNodeType`, `AtomicStyles`, and `CustomBlockDefinition` exactly as specified in the spec.
2. Update `data/mockData.ts` — add `'custom_block'` to the `BlockType` union as a named literal (the `| string` tail already permits it, but naming it improves IDE support).
3. Create `components/blocks/CustomAtomicRenderer.tsx`:
   - Implement `compileStyles(styles?: AtomicStyles): string` to convert the structured `AtomicStyles` object into a Tailwind className string at render time.
   - Implement the recursive `AtomicElement` component that maps each `AtomicNodeType` to a DOM element.
   - Use SWR with `refId` as the cache key for the Firestore fetch to avoid redundant reads.
   - Unknown node types must return `null` silently — do not throw.
4. Update `components/blocks/BlockRenderer.tsx` — add `case 'custom_block':` routing to `CustomAtomicRenderer`. The existing `SafeBlockRenderer` wrapper already provides ErrorBoundary coverage; do NOT add a redundant boundary inside `CustomAtomicRenderer`.

### Phase 2: Canvas Studio Integration

The Add Block panel reads from `BLOCK_OPTIONS` dynamically, so three files need updates:

1. **`components/admin/blocks/blockDefinitions.ts`**
   - Add `{ type: 'custom_block', label: 'Custom Block', icon: Blocks }` to `BLOCK_OPTIONS`.
   - Add `case 'custom_block': return { refId: '' };` to `getDefaultData()`.

2. **`components/admin/blocks/BlockFormRenderer.tsx`**
   - Add `case 'custom_block':` that renders a `CustomBlockForm` component.
   - `CustomBlockForm` must display a dropdown/list of available custom blocks fetched from Firestore (`sites/{siteId}/custom_blocks`) and write the selected `refId` back to `block.data`.

3. **`components/admin/blocks/LeftSidebarPanels.tsx`**
   - No direct changes required — it reads `BLOCK_OPTIONS` automatically.

### Phase 3: The Tree Builder UI (Advanced)

1. Build the developer-only administrative route at `app/admin/(dashboard)/developer/blocks/page.tsx`.
2. Implement a three-panel IDE layout: Navigator (left) | Canvas preview (center) | Inspector (right).
3. **v1 — No drag-and-drop.** Node ordering and nesting is managed entirely via buttons in the Navigator panel (Add Child, Delete, Move Up, Move Down). See BLOCK_BUILDER_SPEC.md §6 for the rationale.
4. Use the `updateNode` immutable helper from the spec for all tree mutations. Use Zustand or Context + reducer for state management.
5. The Inspector panel must read `node.props` and `node.styles` of the selected node and render structured controls mapped to each `AtomicStyles` field.

## 3. Strict Development Guidelines

- Use `compileStyles()` to translate `AtomicStyles` to Tailwind classNames — never hardcode className strings directly on nodes.
- Do NOT use absolute positioning for layout. Output Flexbox or Grid Tailwind classes only.
- Always use stable `key={child.id}` when mapping over `children` arrays.
- The output JSON of the Block Builder must exactly match the `AtomicNode` interface expected by `CustomAtomicRenderer.tsx`.
- Do not introduce `overrideProps` to the schema — it is intentionally deferred until the merge strategy is defined.
