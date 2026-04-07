# Technical Specification: Atomic Block Builder (The Bridge Architecture)

## 1. System Overview
This specification details the implementation of an **Atomic Block Builder**—a visual development environment that outputs reusable node-trees which can be natively consumed by the existing, flat-array Canvas Studio architecture.

This ensures Canvas Studio remains fast and simple for end-users, while allowing agencies and advanced users to build highly-complex custom layouts without writing code.

---

## 2. Core Data Models (Firestore)

We introduce a new Firestore collection at `sites/{siteId}/custom_blocks/{customBlockId}`.

> **Scope Note:** Custom blocks are intentionally site-scoped for v1. Cross-site or agency-wide block sharing is a known limitation and can be addressed in v2 via a global `block_templates/{id}` collection with a copy-on-use model.

### The Atomic Node Interface

```typescript
// lib/core/atomic-types.ts

// Extensible via | string to allow future primitives without breaking saved blocks
export type AtomicNodeType =
    | 'container'
    | 'text'
    | 'image'
    | 'button'
    | 'icon'
    | 'divider'
    | 'spacer'   // explicit vertical/horizontal spacing
    | 'video'    // embed or hosted video
    | string;    // escape hatch for future primitives

// Structured style object — compiled to Tailwind className strings at render time.
// Use className as a raw escape hatch only when structured fields are insufficient.
export interface AtomicStyles {
    className?: string;       // Raw Tailwind string override (escape hatch)
    layout?: 'flex' | 'grid';
    direction?: 'row' | 'col';
    wrap?: 'wrap' | 'nowrap';
    align?: 'start' | 'center' | 'end' | 'stretch';
    justify?: 'start' | 'center' | 'end' | 'between' | 'around';
    gap?: string;             // e.g. '4', '8'
    padding?: string;         // e.g. '4', 'x-4 y-6'
    margin?: string;
    width?: string;
    height?: string;
    background?: string;
    textSize?: string;
    textColor?: string;
    fontWeight?: string;
    rounded?: string;
    border?: string;
    shadow?: string;
}

export interface AtomicNode {
    id: string;                     // Unique UUID for the node
    type: AtomicNodeType;           // The layout/element primitive
    props: Record<string, any>;     // Visual/Content definitions
    styles?: AtomicStyles;          // Structured style object, compiled to Tailwind at render
    children?: AtomicNode[];        // Recursive child nodes (empty array for leaf nodes)
}

export interface CustomBlockDefinition {
    id: string;
    name: string;                   // E.g., 'Agency Hero Variant C'
    description?: string;
    thumbnailUrl?: string;          // Optional preview image for the Canvas Studio picker
    rootNode: AtomicNode;           // The top-level container node
    createdAt: any; // Firestore Timestamp
    updatedAt: any;
}
```

---

## 3. Modifying Canvas Studio's Schema

The existing `BlockType` union already extends to `| string`, so no type changes are strictly required. We add `'custom_block'` as a named literal for clarity and IDE autocompletion.

### `data/mockData.ts`

```typescript
// Add 'custom_block' to the union — the | string fallback already permits it,
// but naming it explicitly improves discoverability and type checking.
export type BlockType = 'hero' | 'products' | ... | 'custom_block' | string;
```

When a user selects a Custom Block from the Canvas Studio UI, the resulting `PageBlock` saved to the database will represent a reference:

```json
{
  "id": "block-uuid-1234",
  "type": "custom_block",
  "data": {
    "refId": "custom_block_agency_hero_c"
  }
}
```

> **Note:** `overrideProps` has been intentionally removed from the schema. Prop overrides require a defined merge strategy before introduction. Add this field only when the override feature is fully specified, to avoid a half-defined API.

---

## 4. Public Rendering

### 4.1 Update `components/blocks/BlockRenderer.tsx`

Add a `case 'custom_block':` to the existing switch statement. The `SafeBlockRenderer` wrapper that already wraps every block provides ErrorBoundary coverage for free — do not add a redundant boundary inside `CustomAtomicRenderer`.

```tsx
import { CustomAtomicRenderer } from './CustomAtomicRenderer';

// Inside the switch(block.type) statement:
case 'custom_block':
    return <CustomAtomicRenderer
               siteId={siteId}
               customBlockId={block.data.refId}
               theme={theme}
           />;
```

### 4.2 Create `components/blocks/CustomAtomicRenderer.tsx`

This component fetches the `CustomBlockDefinition` from Firestore and recursively mounts atomic primitives.

**Caching:** Use SWR (already available in the project) with `refId` as the cache key to avoid redundant Firestore reads when the same block appears multiple times or across re-renders. For SSR pages, prefer preloading the block definition server-side and passing it as a prop.

```tsx
// Compile AtomicStyles to a Tailwind className string at render time
const compileStyles = (styles?: AtomicStyles): string => {
    if (!styles) return '';
    if (styles.className) return styles.className; // raw escape hatch wins
    const classes: string[] = [];
    if (styles.layout) classes.push(styles.layout);
    if (styles.direction) classes.push(`flex-${styles.direction}`);
    if (styles.gap) classes.push(`gap-${styles.gap}`);
    if (styles.padding) classes.push(`p-${styles.padding}`);
    // ... extend per AtomicStyles fields
    return classes.join(' ');
};

const AtomicElement = ({ node }: { node: AtomicNode }) => {
    const className = compileStyles(node.styles);
    switch (node.type) {
        case 'container':
            return (
                <div className={className}>
                    {node.children?.map(child => <AtomicElement key={child.id} node={child} />)}
                </div>
            );
        case 'text':
            return <p className={className}>{node.props.content}</p>;
        case 'button':
            return <button className={className}>{node.props.label}</button>;
        case 'image':
            return <img src={node.props.src} alt={node.props.alt ?? ''} className={className} />;
        case 'divider':
            return <hr className={className} />;
        case 'spacer':
            return <div className={className} aria-hidden="true" />;
        default:
            // Unknown future primitive — fail silently per node rather than crashing the tree
            return null;
    }
};
```

---

## 5. Canvas Studio Integration

Beyond `BlockRenderer.tsx`, three additional files must be updated to make the custom block available inside the editor:

### 5.1 `components/admin/blocks/blockDefinitions.ts`

- Add `{ type: 'custom_block', label: 'Custom Block', icon: Blocks }` to `BLOCK_OPTIONS`.
- Add a `case 'custom_block':` to `getDefaultData()` returning `{ refId: '' }`.

### 5.2 `components/admin/blocks/BlockFormRenderer.tsx`

- Add a `case 'custom_block':` that renders a `CustomBlockForm` — a dropdown picker of available `custom_blocks` from Firestore, which writes the selected `refId` back to `block.data`.

### 5.3 `components/admin/blocks/LeftSidebarPanels.tsx`

- No direct changes required — the Add Block panel reads from `BLOCK_OPTIONS` dynamically.

---

## 6. The Advanced Editor UI

This is an entirely new route, completely abstracted away from normal users.

**Admin Route:** `app/admin/(dashboard)/developer/blocks/page.tsx`

### Interface Architecture

An IDE-style layout with three panels:

1. **Left Panel (Navigator):** A recursive tree view showing the node hierarchy (e.g., `Container > Container > Text`). Node manipulation (add child, delete, move up/down) is done via buttons in this panel.
2. **Center Panel (Canvas):** A scaled div showing the live preview of the `rootNode`, re-rendered whenever the tree state changes.
3. **Right Panel (Inspector):** When a user clicks a node, this panel reads `node.props` and `node.styles`. It displays structured visual controls mapped to the `AtomicStyles` fields (Padding, Margin, Flexbox alignment, Typography).

### Drag-and-Drop Strategy (v1 vs v2)
**v1 (this implementation):** Do NOT implement drag-and-drop in the initial release. Recursive `@dnd-kit` droppable zones require custom collision detection and nested sortable context handling — this is the single highest-complexity risk in the project. Node ordering and nesting is fully achievable via the Navigator panel buttons.

**v2:** Add `@dnd-kit/sortable` drag-and-drop to the Navigator panel as an enhancement once the tree data model is stable.

### State Management
Because you are mutating a deep JSON tree, use a lightweight Zustand store or standard Context with immutable tree helper functions.

**Mutation pattern:** To modify a node, recursively map through `children` until the target `node.id` is found, return the updated node, and bubble the new tree back to the root.

```typescript
// Helper: immutable deep update
function updateNode(root: AtomicNode, targetId: string, patch: Partial<AtomicNode>): AtomicNode {
    if (root.id === targetId) return { ...root, ...patch };
    return {
        ...root,
        children: root.children?.map(child => updateNode(child, targetId, patch))
    };
}
```

---

## 7. Architecture & Fault Isolation Diagram

```mermaid
graph TD
    subgraph "Advanced Route (The Developer Sandbox)"
        BB["Block Builder UI (Route: /admin/developer/blocks)"] -->|Builds Recursive Node Tree| DB["Firestore: custom_blocks Collection"]
        note1["⚠️ High Complexity (If this crashes, it only affects the Developer)"] -.-> BB
        style note1 fill:#ffe5e5,stroke:#ff4d4d,color:#b30000
    end

    subgraph "Main Application (The Stable Core)"
        CS["Canvas Studio UI (Main Page Builder)"] -->|Loads Available Blocks| DB
        CS -->|User Drops 'Custom Block' into page - Saves simple Reference ID| PG["Firestore: pages Collection"]
        note2["✅ Highly Stable (Unaffected by Block Builder bugs)"] -.-> CS
        style note2 fill:#e5ffe5,stroke:#4dff4d,color:#008000
    end

    subgraph "Public Website Render Pipeline"
        PG --> BR["BlockRenderer.tsx"]
        BR -->|Type: Hero, Products, etc.| SR["Standard Components"]
        BR -->|Type: custom_block| CAB["CustomAtomicRenderer.tsx (Covered by existing SafeBlockRenderer boundary)"]
        CAB -->|Fetches Tree (SWR cached)| DB
    end

    style BB fill:#ffcfcf,stroke:#ff6b6b,stroke-width:2px
    style CS fill:#cfefcf,stroke:#5bc25b,stroke-width:2px
    style CAB fill:#fff3cf,stroke:#f5c042,stroke-width:2px
```
