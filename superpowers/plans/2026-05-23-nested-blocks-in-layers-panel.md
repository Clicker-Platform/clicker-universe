# Nested Blocks in Layers Panel — Implementation Plan

**Goal:** Replace the flat top-level layer list in the Canvas Studio Layers panel with a full recursive tree that surfaces blocks inside Columns / Grid / FeatureCards, including their slot/card nodes.

**Spec:** [superpowers/specs/2026-05-23-nested-blocks-in-layers-panel.md](../specs/2026-05-23-nested-blocks-in-layers-panel.md)

---

## Architecture

- `BlockManager.tsx` keeps the chrome rows (header / footer / bottom nav) and the top-level DndContext, but the children inside the DndContext become `BlockTreeNode` instances instead of `BlockOutlineItem`.
- `BlockTreeNode.tsx` (new) is recursive. Given a block + depth, it renders its own row + (optionally) collapsible children. At `depth === 0` it uses the existing sortable wiring; deeper rows are plain rows.
- A helper `getBlockChildren(block)` describes the structured children: a discriminated union `{ kind: 'leaf' } | { kind: 'columns', slots: [{id, label, blocks}] } | { kind: 'grid', slots: [{id, label, block}] } | { kind: 'feature_cards', cards: [{id, label}] }`.
- Selection writes use the table from the spec (block → `{kind:'blocks'}`, slot/card → `{kind:'slots'}`).

The existing `BlockOutlineItem` is reused for its row chrome (rename, delete, drag handle). We refactor it slightly so it can be used in two modes: top-level sortable, and nested plain row. The existing top-level export stays; the inner row visual is shared.

---

## Task 1 — Add `getBlockChildren` helper

**File:** Create `clicker-platform-v2/components/admin/blocks/blockTreeChildren.ts`

### Step 1: Write the helper

```ts
import { PageBlock } from '@/data/mockData';

type ColumnSlot = { id: string; blocks: PageBlock[] };
type GridCell   = { id: string; row?: number; col?: number; block: PageBlock | null };
type FeatureCard = { id: string; headline?: string };

export type BlockChildren =
    | { kind: 'leaf' }
    | { kind: 'columns'; slots: { id: string; label: string; blocks: PageBlock[] }[] }
    | { kind: 'grid';    slots: { id: string; label: string; block: PageBlock | null }[] }
    | { kind: 'feature_cards'; cards: { id: string; label: string }[] };

export function getBlockChildren(block: PageBlock): BlockChildren {
    if (block.type === 'columns' && Array.isArray(block.data?.columns)) {
        const cols = block.data.columns as ColumnSlot[];
        return {
            kind: 'columns',
            slots: cols.map((c, i) => ({
                id: c.id,
                label: `Column ${i + 1}`,
                blocks: c.blocks ?? [],
            })),
        };
    }
    if (block.type === 'grid' && Array.isArray(block.data?.cells)) {
        const cells = block.data.cells as GridCell[];
        return {
            kind: 'grid',
            slots: cells.map(cell => ({
                id: cell.id,
                label:
                    cell.row != null && cell.col != null
                        ? `Cell ${cell.row},${cell.col}`
                        : `Cell ${cell.id.slice(0, 6)}`,
                block: cell.block ?? null,
            })),
        };
    }
    if (block.type === 'feature_cards' && Array.isArray(block.data?.cards)) {
        const cards = block.data.cards as FeatureCard[];
        return {
            kind: 'feature_cards',
            cards: cards.map((c, i) => ({
                id: c.id,
                label: c.headline?.trim() || `Untitled Card`,
            })),
        };
    }
    return { kind: 'leaf' };
}
```

### Step 2: Commit

```bash
cd /Users/andre/Repository/clicker-universe/dev
git add clicker-platform-v2/components/admin/blocks/blockTreeChildren.ts
git commit -m "feat(canvas): blockTreeChildren helper for layers panel recursion"
```

---

## Task 2 — Extract row-render bits from BlockOutlineItem

**File:** `clicker-platform-v2/components/admin/blocks/BlockOutlineItem.tsx`

The existing component handles: drag handle, label (with rename), delete button, selected highlighting. We need to be able to render the **same row visuals** without `useSortable` (for nested rows), with optional left-indent and an optional "expand" chevron prefix.

### Step 1: Refactor existing file

Split into two exports without breaking the current API:

```tsx
'use client';

import { PageBlock } from '@/data/mockData';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, Box, ChevronDown, ChevronRight } from 'lucide-react';
import { memo, ReactNode, useEffect, useRef, useState } from 'react';
import { useEditor } from './EditorContext';

export const getBlockLabel = (type: string, moduleInfoName?: string) => {
    if (moduleInfoName) return moduleInfoName;
    const coreLabels: Record<string, string> = {
        'hero': 'Hero Section',
        'text': 'Text Content',
        'image': 'Image',
        'button': 'Button',
        'products': 'Product List',
        'faq': 'FAQ List',
        'link': 'Link Card',
        'map': 'Map Location',
        'image_gallery': 'Image Gallery',
        'quick_actions': 'Quick Actions',
        'hours': 'Operating Hours',
        'featured_product': 'Featured Product',
        'branches': 'Branches',
        'social_embed': 'Social Embeds',
        'content_showcase': 'Content Showcase',
        'feature_cards': 'Feature Cards',
        'columns': 'Columns',
        'grid': 'Grid',
        'heading': 'Heading',
        'marquee': 'Marquee',
        'testimonials': 'Testimonials',
        'inline_form': 'Inline Form',
    };
    return coreLabels[type] || `Module (${type})`;
};

/**
 * Lower-level row used by both the top-level sortable items and the nested
 * tree rows. Does not itself wire dnd-kit — caller provides the drag handle
 * via `dragHandle` or omits it for non-sortable rows.
 */
interface BlockOutlineRowProps {
    block: PageBlock;
    isSelected: boolean;
    onClick: () => void;
    onDelete?: (id: string) => void;
    moduleLabel?: string;
    depth?: number;
    expandable?: boolean;
    expanded?: boolean;
    onToggleExpand?: () => void;
    dragHandle?: ReactNode;
}

export const BlockOutlineRow = memo(({
    block,
    isSelected,
    onClick,
    onDelete,
    moduleLabel,
    depth = 0,
    expandable = false,
    expanded = false,
    onToggleExpand,
    dragHandle,
}: BlockOutlineRowProps) => {
    const { updateBlockData } = useEditor();
    const defaultLabel = getBlockLabel(block.type, moduleLabel);
    const displayLabel = block.data?.label?.trim() || defaultLabel;

    const [isEditing, setIsEditing] = useState(false);
    const [draft, setDraft] = useState(displayLabel);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isEditing) {
            inputRef.current?.focus();
            inputRef.current?.select();
        }
    }, [isEditing]);

    const commit = () => {
        const next = draft.trim();
        const current = block.data?.label?.trim() || '';
        if (next === defaultLabel) {
            if (current) updateBlockData(block.id, { label: '' });
        } else if (next !== current) {
            updateBlockData(block.id, { label: next });
        }
        setIsEditing(false);
    };

    const cancel = () => {
        setDraft(displayLabel);
        setIsEditing(false);
    };

    return (
        <div
            className={`flex items-center gap-1.5 px-2 py-1.5 cursor-pointer transition-colors group ${
                isSelected
                ? 'bg-blue-500/10 text-blue-400'
                : 'text-neutral-500 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-200'
            }`}
            style={{ paddingLeft: depth > 0 ? 8 + depth * 12 : undefined }}
            onClick={onClick}
        >
            {dragHandle}

            {expandable ? (
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onToggleExpand?.(); }}
                    className="p-0.5 -m-0.5 text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-200 flex-shrink-0"
                >
                    {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </button>
            ) : (
                <span className="w-3 flex-shrink-0" />
            )}

            <Box size={13} className={`flex-shrink-0 ${isSelected ? 'text-blue-400' : 'text-neutral-400 dark:text-neutral-500'}`} />

            {isEditing ? (
                <input
                    ref={inputRef}
                    type="text"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onBlur={commit}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); commit(); }
                        else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
                    }}
                    className="flex-1 min-w-0 text-xs font-medium bg-white dark:bg-neutral-900 border border-blue-500 rounded px-1 py-0.5 text-neutral-900 dark:text-neutral-100 outline-none"
                />
            ) : (
                <span
                    className="flex-1 text-xs font-medium truncate"
                    onDoubleClick={(e) => {
                        e.stopPropagation();
                        setDraft(displayLabel);
                        setIsEditing(true);
                    }}
                    title="Double-click to rename"
                >
                    {displayLabel}
                </span>
            )}

            {onDelete && (
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onDelete(block.id); }}
                    className="p-1 text-neutral-400 dark:text-neutral-600 hover:text-red-400 rounded opacity-0 group-hover:opacity-100 transition-all focus:opacity-100 flex-shrink-0"
                    title="Delete block"
                >
                    <Trash2 size={12} />
                </button>
            )}
        </div>
    );
});

BlockOutlineRow.displayName = 'BlockOutlineRow';

/**
 * Top-level sortable wrapper around BlockOutlineRow. Keeps the existing
 * grip handle and rename/delete behaviour for the page's primary block list.
 */
interface BlockOutlineItemProps {
    block: PageBlock;
    isSelected: boolean;
    onClick: () => void;
    onDelete: (id: string) => void;
    moduleLabel?: string;
    expandable?: boolean;
    expanded?: boolean;
    onToggleExpand?: () => void;
}

export const BlockOutlineItem = memo(({
    block,
    isSelected,
    onClick,
    onDelete,
    moduleLabel,
    expandable,
    expanded,
    onToggleExpand,
}: BlockOutlineItemProps) => {
    const { attributes, listeners, setNodeRef, transform, transition } =
        useSortable({ id: block.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    const dragHandle = (
        <div
            {...attributes}
            {...listeners}
            className="p-2 -m-1 rounded cursor-grab active:cursor-grabbing text-neutral-400 dark:text-neutral-600 hover:text-neutral-500 dark:hover:text-neutral-400 transition-colors flex-shrink-0 touch-none"
            onClick={(e) => e.stopPropagation()}
        >
            <GripVertical size={15} />
        </div>
    );

    return (
        <div ref={setNodeRef} style={style}>
            <BlockOutlineRow
                block={block}
                isSelected={isSelected}
                onClick={onClick}
                onDelete={onDelete}
                moduleLabel={moduleLabel}
                expandable={expandable}
                expanded={expanded}
                onToggleExpand={onToggleExpand}
                dragHandle={dragHandle}
            />
        </div>
    );
});

BlockOutlineItem.displayName = 'BlockOutlineItem';
```

### Step 2: Type check

```
cd /Users/andre/Repository/clicker-universe/dev/clicker-platform-v2 && pnpm exec tsc --noEmit 2>&1 | grep -iE "BlockOutlineItem|BlockManager" || echo "no errors"
```

### Step 3: Commit

```bash
cd /Users/andre/Repository/clicker-universe/dev
git add clicker-platform-v2/components/admin/blocks/BlockOutlineItem.tsx
git commit -m "refactor(canvas): split BlockOutlineItem into Row + sortable wrapper"
```

---

## Task 3 — Add `BlockTreeNode` (recursive row + children)

**File:** Create `clicker-platform-v2/components/admin/blocks/BlockTreeNode.tsx`

### Step 1: Write the recursive node

```tsx
'use client';

import { useState } from 'react';
import { PageBlock } from '@/data/mockData';
import { LayoutGrid, Columns as ColumnsIcon, Square } from 'lucide-react';
import { useEditor } from './EditorContext';
import { BlockOutlineItem, BlockOutlineRow } from './BlockOutlineItem';
import { getBlockChildren } from './blockTreeChildren';

interface BlockTreeNodeProps {
    block: PageBlock;
    depth: number;
    moduleBlockLabels: Record<string, string>;
    onDelete: (id: string) => void;
}

export function BlockTreeNode({ block, depth, moduleBlockLabels, onDelete }: BlockTreeNodeProps) {
    const { selection, setSelection } = useEditor();
    const [expanded, setExpanded] = useState(true);

    const children = getBlockChildren(block);
    const expandable = children.kind !== 'leaf';

    const isSelected =
        (selection.kind === 'blocks' && selection.ids.includes(block.id)) ||
        // When a card or slot inside THIS block is selected, also highlight the block row
        // so the outline reflects "we're editing inside this block."
        (selection.kind === 'slots' && selection.containerId === block.id);

    const onClickBlock = () => setSelection({ kind: 'blocks', ids: [block.id] });
    const toggle = () => setExpanded(e => !e);

    // depth 0 → sortable item with grip handle.
    // depth > 0 → plain row (no DnD).
    const Row = depth === 0 ? (
        <BlockOutlineItem
            block={block}
            isSelected={isSelected}
            onClick={onClickBlock}
            onDelete={onDelete}
            moduleLabel={moduleBlockLabels[block.type]}
            expandable={expandable}
            expanded={expanded}
            onToggleExpand={toggle}
        />
    ) : (
        <BlockOutlineRow
            block={block}
            isSelected={isSelected}
            onClick={onClickBlock}
            onDelete={onDelete}
            moduleLabel={moduleBlockLabels[block.type]}
            depth={depth}
            expandable={expandable}
            expanded={expanded}
            onToggleExpand={toggle}
        />
    );

    return (
        <>
            {Row}
            {expanded && children.kind === 'columns' && children.slots.map(slot => (
                <ColumnsSlotNode
                    key={slot.id}
                    containerId={block.id}
                    slot={slot}
                    depth={depth + 1}
                    moduleBlockLabels={moduleBlockLabels}
                    onDelete={onDelete}
                />
            ))}
            {expanded && children.kind === 'grid' && children.slots.map(slot => (
                <GridSlotNode
                    key={slot.id}
                    containerId={block.id}
                    slot={slot}
                    depth={depth + 1}
                    moduleBlockLabels={moduleBlockLabels}
                    onDelete={onDelete}
                />
            ))}
            {expanded && children.kind === 'feature_cards' && children.cards.map((card, i) => (
                <CardLeafNode
                    key={card.id}
                    containerId={block.id}
                    cardId={card.id}
                    label={card.label}
                    index={i}
                    depth={depth + 1}
                />
            ))}
        </>
    );
}

// ─── Slot nodes ────────────────────────────────────────────────────────────

function SlotRow({
    containerId,
    slotId,
    label,
    depth,
    icon,
}: {
    containerId: string;
    slotId: string;
    label: string;
    depth: number;
    icon: React.ReactNode;
}) {
    const { selection, setSelection } = useEditor();
    const isSelected =
        selection.kind === 'slots'
        && selection.containerId === containerId
        && selection.ids.includes(slotId);

    return (
        <div
            className={`flex items-center gap-1.5 px-2 py-1 cursor-pointer transition-colors text-xs ${
                isSelected
                ? 'bg-blue-500/10 text-blue-400'
                : 'text-neutral-500 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800'
            }`}
            style={{ paddingLeft: 8 + depth * 12 }}
            onClick={() => setSelection({ kind: 'slots', containerId, ids: [slotId] })}
        >
            <span className="w-3 flex-shrink-0" />
            {icon}
            <span className="flex-1 truncate font-medium">{label}</span>
        </div>
    );
}

function ColumnsSlotNode({
    containerId, slot, depth, moduleBlockLabels, onDelete,
}: {
    containerId: string;
    slot: { id: string; label: string; blocks: PageBlock[] };
    depth: number;
    moduleBlockLabels: Record<string, string>;
    onDelete: (id: string) => void;
}) {
    return (
        <>
            <SlotRow
                containerId={containerId}
                slotId={slot.id}
                label={slot.label}
                depth={depth}
                icon={<ColumnsIcon size={11} className="flex-shrink-0 opacity-60" />}
            />
            {slot.blocks.map(child => (
                <BlockTreeNode
                    key={child.id}
                    block={child}
                    depth={depth + 1}
                    moduleBlockLabels={moduleBlockLabels}
                    onDelete={onDelete}
                />
            ))}
        </>
    );
}

function GridSlotNode({
    containerId, slot, depth, moduleBlockLabels, onDelete,
}: {
    containerId: string;
    slot: { id: string; label: string; block: PageBlock | null };
    depth: number;
    moduleBlockLabels: Record<string, string>;
    onDelete: (id: string) => void;
}) {
    return (
        <>
            <SlotRow
                containerId={containerId}
                slotId={slot.id}
                label={slot.label}
                depth={depth}
                icon={<LayoutGrid size={11} className="flex-shrink-0 opacity-60" />}
            />
            {slot.block && (
                <BlockTreeNode
                    block={slot.block}
                    depth={depth + 1}
                    moduleBlockLabels={moduleBlockLabels}
                    onDelete={onDelete}
                />
            )}
        </>
    );
}

function CardLeafNode({
    containerId, cardId, label, index, depth,
}: {
    containerId: string;
    cardId: string;
    label: string;
    index: number;
    depth: number;
}) {
    const { selection, setSelection } = useEditor();
    const isSelected =
        selection.kind === 'slots'
        && selection.containerId === containerId
        && selection.ids.includes(cardId);

    return (
        <div
            className={`flex items-center gap-1.5 px-2 py-1 cursor-pointer transition-colors text-xs ${
                isSelected
                ? 'bg-blue-500/10 text-blue-400'
                : 'text-neutral-500 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800'
            }`}
            style={{ paddingLeft: 8 + depth * 12 }}
            onClick={() => setSelection({ kind: 'slots', containerId, ids: [cardId] })}
        >
            <span className="w-3 flex-shrink-0" />
            <Square size={11} className="flex-shrink-0 opacity-60" />
            <span className="flex-1 truncate"><span className="opacity-50 mr-1">#{index + 1}</span>{label}</span>
        </div>
    );
}
```

### Step 2: Type check

```
cd /Users/andre/Repository/clicker-universe/dev/clicker-platform-v2 && pnpm exec tsc --noEmit 2>&1 | grep -iE "BlockTreeNode|BlockOutline" || echo "no errors"
```

### Step 3: Commit

```bash
cd /Users/andre/Repository/clicker-universe/dev
git add clicker-platform-v2/components/admin/blocks/BlockTreeNode.tsx
git commit -m "feat(canvas): BlockTreeNode renders recursive layers tree"
```

---

## Task 4 — Wire `BlockTreeNode` into `BlockManager`

**File:** `clicker-platform-v2/components/admin/blocks/BlockManager.tsx`

### Step 1: Replace the flat block-map with the tree

Find the `blocks.map(block => (<BlockOutlineItem ... />))` block (around line 128). Replace with:

```tsx
{blocks.map(block => (
    <BlockTreeNode
        key={block.id}
        block={block}
        depth={0}
        moduleBlockLabels={moduleBlockLabels}
        onDelete={deleteBlock}
    />
))}
```

Add the import at the top:

```tsx
import { BlockTreeNode } from './BlockTreeNode';
```

Leave the `DndContext` + `SortableContext` wrapper around it untouched — top-level sortable behavior is preserved because `BlockTreeNode` delegates to `BlockOutlineItem` (which uses `useSortable`) at `depth === 0`. `BlockOutlineItem` is no longer imported here directly; it's reached via `BlockTreeNode`. Remove the direct import if unused after the swap.

The `isBlockSelected` helper inside BlockManager is no longer referenced by the tree (each node computes its own selection), so it can be deleted; but if it has other call sites, leave it.

### Step 2: Type check

```
cd /Users/andre/Repository/clicker-universe/dev/clicker-platform-v2 && pnpm exec tsc --noEmit 2>&1 | grep -iE "BlockManager|BlockTreeNode" || echo "no errors"
```

### Step 3: Commit

```bash
cd /Users/andre/Repository/clicker-universe/dev
git add clicker-platform-v2/components/admin/blocks/BlockManager.tsx
git commit -m "feat(canvas): Layers panel shows nested blocks (Columns / Grid / FeatureCards)"
```

---

## Manual verification

1. Drop a Columns block with 3 columns, populate one column with a Hero and a Text block, leave another empty. Layers panel shows: `Columns ▾ → Column 1 → Hero, Text → Column 2 (empty) → Column 3 (empty)`.
2. Click "Column 2" → right panel switches to ColumnsForm with column 2 highlighted as the active column tab. Canvas highlights match.
3. Click "Hero" inside Column 1 → right panel switches to HeroForm. Edits persist (verifies the previous nested-update fix is still good).
4. Drop a Grid block, place a FeatureCards block in one cell. Tree: `Grid → Cell 1,1 → Feature Cards → Card #1, Card #2, Card #3`.
5. Click "Card #2" deep in the tree → right panel switches via outer Grid form → FeatureCardsForm with Card #2 expanded. Type in the headline → reflected on canvas.
6. Reorder top-level blocks via the grip handle — still works.
7. Collapse / expand chevrons work at every depth.
8. Renaming via double-click on a nested block writes to its `data.label` (verify in the page JSON if needed).

## Self-review checklist before reporting done

- Does the empty-card-list `getBlockChildren('feature_cards')` still produce a `feature_cards` kind with `cards: []`? Yes — the existence check is on `Array.isArray(block.data?.cards)`, not length.
- Does `BlockOutlineItem`'s prior single-purpose API still work? Yes — its props are extended with optional fields, not breaking.
- Does collapse state persist across renders? Local to the node — collapsing then re-expanding the parent recreates child state. For now this is acceptable (containers default to expanded). If users complain, lift the expanded set into a Map keyed by block id later.
- Are slot nodes selectable but not deletable? Yes — `SlotRow` has no trash button.
- Does the depth indentation collide with the existing left-border (`border-l-2 border-dashed`) drawn by BlockManager? Test visually; if it's noisy, drop the dashed border for tree mode or keep it as is (it bounds the top-level list).
