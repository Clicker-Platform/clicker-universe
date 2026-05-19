# Container Blocks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three container blocks — `row`, `column`, `grid` — to Canvas Studio that hold child blocks, support 12-column child sizing via side-panel sliders, drill-down child editing, and mobile auto-stack. Single-phase build.

**Architecture:** Children live at `block.data.children: ContainerChild[]` where each `ContainerChild` is `{ block: PageBlock, size: number }`. Container forms reuse `BlockFormRenderer` recursively for child editing. Public render components recursively call `BlockRenderer` per child wrapped in size-translated CSS. No changes to `PageBlock` interface, `BlockManager`, `PageStudioContext`, or `EditorContext` — preserves isolation.

**Tech Stack:** Next.js (App Router), React, TypeScript, Tailwind, `@dnd-kit/core` + `@dnd-kit/sortable` (already in use), Vitest, lucide-react icons.

**Spec source:** [`superpowers/specs/2026-05-14-container-blocks-design.md`](../specs/2026-05-14-container-blocks-design.md)

---

## File Structure

### New files
- `clicker-platform-v2/components/admin/blocks/forms/container/types.ts` — `ContainerChild` interface + size helpers
- `clicker-platform-v2/components/admin/blocks/forms/container/NestedBlockList.tsx` — shared dnd-kit child list with size sliders
- `clicker-platform-v2/components/admin/blocks/forms/container/EmptyContainerPlaceholder.tsx` — editor-only dashed placeholder
- `clicker-platform-v2/components/admin/blocks/forms/container/useDrillDown.ts` — shared drill-down state hook
- `clicker-platform-v2/components/admin/blocks/forms/container/MiniBlockPicker.tsx` — picker filtered to non-container types
- `clicker-platform-v2/components/admin/blocks/forms/RowForm.tsx`
- `clicker-platform-v2/components/admin/blocks/forms/ColumnForm.tsx`
- `clicker-platform-v2/components/admin/blocks/forms/GridForm.tsx`
- `clicker-platform-v2/components/blocks/public/DefaultRowBlock.tsx`
- `clicker-platform-v2/components/blocks/public/DefaultColumnBlock.tsx`
- `clicker-platform-v2/components/blocks/public/DefaultGridBlock.tsx`
- `clicker-platform-v2/components/admin/blocks/forms/container/__tests__/types.test.ts`
- `clicker-platform-v2/components/admin/blocks/forms/container/__tests__/NestedBlockList.test.tsx`
- `clicker-platform-v2/components/admin/blocks/forms/container/__tests__/useDrillDown.test.ts`

### Modified files
- `clicker-platform-v2/data/mockData.ts` — extend `BlockType` union with `'row' | 'column' | 'grid'`
- `clicker-platform-v2/components/admin/blocks/blockDefinitions.ts` — append `BLOCK_OPTIONS` entries + `getDefaultData` cases
- `clicker-platform-v2/components/admin/blocks/BlockFormRenderer.tsx` — add three new dynamic imports + switch cases
- `clicker-platform-v2/components/blocks/BlockRenderer.tsx` — add three new dynamic imports + switch cases

### Out of scope (deferred, per spec)
- Canvas drag-to-resize handles
- Per-breakpoint property overrides
- Picker grouping/categories
- Container-in-container nesting (enforced by MiniBlockPicker filter)

---

## Task 1: Define ContainerChild type and size helpers

**Files:**
- Create: `clicker-platform-v2/components/admin/blocks/forms/container/types.ts`
- Create: `clicker-platform-v2/components/admin/blocks/forms/container/__tests__/types.test.ts`

- [ ] **Step 1: Write failing test for `distributeSizes`**

Create `clicker-platform-v2/components/admin/blocks/forms/container/__tests__/types.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { distributeSizes, clampSize } from '../types';

describe('distributeSizes', () => {
  it('returns equal share when count divides 12', () => {
    expect(distributeSizes(3)).toEqual([4, 4, 4]);
    expect(distributeSizes(4)).toEqual([3, 3, 3, 3]);
    expect(distributeSizes(6)).toEqual([2, 2, 2, 2, 2, 2]);
  });

  it('distributes remainder left-to-right', () => {
    expect(distributeSizes(5)).toEqual([3, 3, 2, 2, 2]); // 12 = 3+3+2+2+2
    expect(distributeSizes(7)).toEqual([2, 2, 2, 2, 2, 1, 1]); // 12 = 2*5 + 1*2
  });

  it('returns [12] for single child', () => {
    expect(distributeSizes(1)).toEqual([12]);
  });

  it('returns [] for zero children', () => {
    expect(distributeSizes(0)).toEqual([]);
  });

  it('caps at 12 children when N > 12 (each = 1)', () => {
    expect(distributeSizes(12)).toEqual([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
  });
});

describe('clampSize', () => {
  it('clamps to 1–12 integer range', () => {
    expect(clampSize(0)).toBe(1);
    expect(clampSize(1)).toBe(1);
    expect(clampSize(6.7)).toBe(6);
    expect(clampSize(12)).toBe(12);
    expect(clampSize(15)).toBe(12);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd clicker-platform-v2 && pnpm test components/admin/blocks/forms/container/__tests__/types.test.ts`
Expected: FAIL with "Cannot find module '../types'"

- [ ] **Step 3: Create the types file**

Create `clicker-platform-v2/components/admin/blocks/forms/container/types.ts`:

```ts
import { PageBlock } from '@/data/mockData';

export interface ContainerChild {
  block: PageBlock;
  size: number; // 1–12, fraction of 12-column grid
}

export const SIZE_MIN = 1;
export const SIZE_MAX = 12;
export const GRID_TOTAL = 12;

export function clampSize(size: number): number {
  return Math.max(SIZE_MIN, Math.min(SIZE_MAX, Math.floor(size)));
}

/**
 * Distributes 12 column units across N children.
 * - Equal share when N divides 12.
 * - Remainder distributed left-to-right.
 * - Each child gets at least size 1 (so N > 12 produces all 1s).
 */
export function distributeSizes(count: number): number[] {
  if (count <= 0) return [];
  if (count > GRID_TOTAL) return Array(count).fill(1);
  const base = Math.floor(GRID_TOTAL / count);
  const remainder = GRID_TOTAL - base * count;
  return Array.from({ length: count }, (_, i) => (i < remainder ? base + 1 : base));
}

/**
 * Compute default size for a NEW child added to an existing list.
 * Returns the equal-share size for the resulting count; caller is responsible
 * for whether to rebalance existing children (spec says NO rebalance on add).
 */
export function defaultNewChildSize(existingCount: number): number {
  return Math.max(1, Math.floor(GRID_TOTAL / (existingCount + 1)));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd clicker-platform-v2 && pnpm test components/admin/blocks/forms/container/__tests__/types.test.ts`
Expected: PASS — all 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add clicker-platform-v2/components/admin/blocks/forms/container/types.ts \
        clicker-platform-v2/components/admin/blocks/forms/container/__tests__/types.test.ts
git commit -m "feat(canvas): ContainerChild type + size distribution helpers"
```

---

## Task 2: Add container types to BlockType union and block definitions

**Files:**
- Modify: `clicker-platform-v2/data/mockData.ts:30`
- Modify: `clicker-platform-v2/components/admin/blocks/blockDefinitions.ts`

- [ ] **Step 1: Extend `BlockType` union**

In `clicker-platform-v2/data/mockData.ts`, replace line 30:

```ts
export type BlockType = 'hero' | 'text' | 'image' | 'button' | 'products' | 'faq' | 'link' | 'map' | 'image_gallery' | 'social_embed' | 'quick_actions' | 'hours' | 'featured_product' | 'branches' | 'reservation' | 'reservation_cta' | 'content_showcase' | 'inline_form' | 'heading' | 'feature_cards' | 'row' | 'column' | 'grid' | string;
```

(Add `'row' | 'column' | 'grid'` before the trailing `| string`.)

- [ ] **Step 2: Add picker entries**

In `clicker-platform-v2/components/admin/blocks/blockDefinitions.ts`, top of file, extend the lucide import line:

```ts
import { Type, Image as ImageIcon, Layout, Box, HelpCircle, AlignCenter, Link, Map, List, Clock, Star, MapPin, Play, Columns2, ClipboardList, LayoutGrid, Rows3, Columns3 } from 'lucide-react';
```

Then append to `BLOCK_OPTIONS` (after the `feature_cards` entry):

```ts
{ type: 'row', label: 'Row', icon: Rows3 },
{ type: 'column', label: 'Column', icon: Columns3 },
{ type: 'grid', label: 'Grid', icon: LayoutGrid },
```

- [ ] **Step 3: Add defaults to `getDefaultData`**

In the same file, inside the `getDefaultData` switch, append three cases before the `default` (or end of switch):

```ts
case 'row':
  return {
    ...baseData,
    children: [],
    gap: 16,
    padding: 16,
    align: 'center',
    justify: 'start',
    wrap: false,
    stackOnMobile: true,
    maxWidth: 'full',
  };
case 'column':
  return {
    ...baseData,
    children: [],
    gap: 16,
    padding: 16,
    align: 'stretch',
    maxWidth: 'full',
  };
case 'grid':
  return {
    ...baseData,
    children: [],
    columns: 3,
    gapX: 16,
    gapY: 16,
    padding: 16,
    stackOnMobile: true,
    maxWidth: 'full',
  };
```

- [ ] **Step 4: Type-check**

Run: `cd clicker-platform-v2 && pnpm tsc --noEmit`
Expected: no new errors. (Pre-existing errors unrelated to this change are acceptable; note any new ones tied to BlockType.)

- [ ] **Step 5: Commit**

```bash
git add clicker-platform-v2/data/mockData.ts \
        clicker-platform-v2/components/admin/blocks/blockDefinitions.ts
git commit -m "feat(canvas): register row/column/grid in BlockType + defaults"
```

---

## Task 3: useDrillDown hook for child-form navigation

**Files:**
- Create: `clicker-platform-v2/components/admin/blocks/forms/container/useDrillDown.ts`
- Create: `clicker-platform-v2/components/admin/blocks/forms/container/__tests__/useDrillDown.test.ts`

- [ ] **Step 1: Write failing test**

Create `clicker-platform-v2/components/admin/blocks/forms/container/__tests__/useDrillDown.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDrillDown } from '../useDrillDown';
import type { ContainerChild } from '../types';

const child = (id: string): ContainerChild => ({
  block: { id, type: 'button', data: {} },
  size: 6,
});

describe('useDrillDown', () => {
  it('starts with no drilled child', () => {
    const { result } = renderHook(() => useDrillDown([child('a'), child('b')]));
    expect(result.current.drilledChildId).toBeNull();
  });

  it('sets and clears drilledChildId', () => {
    const { result } = renderHook(() => useDrillDown([child('a')]));
    act(() => result.current.drillInto('a'));
    expect(result.current.drilledChildId).toBe('a');
    act(() => result.current.drillOut());
    expect(result.current.drilledChildId).toBeNull();
  });

  it('clears drilledChildId if drilled child is removed', () => {
    const initial = [child('a'), child('b')];
    const { result, rerender } = renderHook(({ children }) => useDrillDown(children), {
      initialProps: { children: initial },
    });
    act(() => result.current.drillInto('a'));
    expect(result.current.drilledChildId).toBe('a');
    rerender({ children: [child('b')] }); // 'a' removed
    expect(result.current.drilledChildId).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd clicker-platform-v2 && pnpm test components/admin/blocks/forms/container/__tests__/useDrillDown.test.ts`
Expected: FAIL with "Cannot find module '../useDrillDown'"

- [ ] **Step 3: Implement the hook**

Create `clicker-platform-v2/components/admin/blocks/forms/container/useDrillDown.ts`:

```ts
'use client';

import { useState, useEffect } from 'react';
import type { ContainerChild } from './types';

export function useDrillDown(children: ContainerChild[]) {
  const [drilledChildId, setDrilledChildId] = useState<string | null>(null);

  // Clear drill state if the drilled child no longer exists.
  useEffect(() => {
    if (drilledChildId && !children.some(c => c.block.id === drilledChildId)) {
      setDrilledChildId(null);
    }
  }, [children, drilledChildId]);

  return {
    drilledChildId,
    drillInto: (id: string) => setDrilledChildId(id),
    drillOut: () => setDrilledChildId(null),
  };
}
```

- [ ] **Step 4: Verify test passes**

Run: `cd clicker-platform-v2 && pnpm test components/admin/blocks/forms/container/__tests__/useDrillDown.test.ts`
Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add clicker-platform-v2/components/admin/blocks/forms/container/useDrillDown.ts \
        clicker-platform-v2/components/admin/blocks/forms/container/__tests__/useDrillDown.test.ts
git commit -m "feat(canvas): useDrillDown hook with auto-clear on child removal"
```

---

## Task 4: MiniBlockPicker (container-aware block picker)

**Files:**
- Create: `clicker-platform-v2/components/admin/blocks/forms/container/MiniBlockPicker.tsx`

- [ ] **Step 1: Write the component**

Create `clicker-platform-v2/components/admin/blocks/forms/container/MiniBlockPicker.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { BLOCK_OPTIONS, getDefaultData } from '../../blockDefinitions';
import { subscribeToEnabledModules } from '@/lib/modules/registry';
import type { BlockType, PageBlock } from '@/data/mockData';
import { Plus } from 'lucide-react';

const EXCLUDED_TYPES: BlockType[] = ['row', 'column', 'grid'];

interface MiniBlockPickerProps {
  onPick: (block: PageBlock) => void;
  templateId?: string;
}

export function MiniBlockPicker({ onPick, templateId = 'classic' }: MiniBlockPickerProps) {
  const [open, setOpen] = useState(false);
  const [moduleBlocks, setModuleBlocks] = useState<
    { type: BlockType; label: string; icon: React.ElementType }[]
  >([]);

  useEffect(() => {
    const unsubscribe = subscribeToEnabledModules((modules) => {
      const opts: { type: BlockType; label: string; icon: React.ElementType }[] = [];
      modules.forEach(mod => {
        mod.blocks?.forEach(b => {
          opts.push({ type: b.type as BlockType, label: b.label, icon: Plus });
        });
      });
      setModuleBlocks(opts);
    });
    return () => unsubscribe();
  }, []);

  const filtered = BLOCK_OPTIONS.filter(o => !EXCLUDED_TYPES.includes(o.type as BlockType));
  const allOptions = [...filtered, ...moduleBlocks];

  const handlePick = (type: BlockType) => {
    const newBlock: PageBlock = {
      id: `block-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      data: getDefaultData(type, templateId),
    };
    onPick(newBlock);
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-dashed border-gray-300 dark:border-neutral-700 rounded-md text-sm text-neutral-600 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
      >
        <Plus size={14} /> Add block
      </button>
    );
  }

  return (
    <div className="border border-gray-200 dark:border-neutral-700 rounded-md p-2 bg-white dark:bg-neutral-900 space-y-1 max-h-72 overflow-y-auto">
      <div className="flex items-center justify-between px-2 pb-1">
        <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Pick a block</span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
        >
          Cancel
        </button>
      </div>
      <div className="grid grid-cols-3 gap-1">
        {allOptions.map(opt => {
          const Icon = opt.icon;
          return (
            <button
              key={opt.type}
              type="button"
              onClick={() => handlePick(opt.type as BlockType)}
              className="flex flex-col items-center gap-1 p-2 rounded hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors text-neutral-700 dark:text-neutral-300"
            >
              <Icon size={16} />
              <span className="text-[10px] text-center leading-tight">{opt.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `cd clicker-platform-v2 && pnpm tsc --noEmit`
Expected: no new errors related to MiniBlockPicker.

- [ ] **Step 3: Commit**

```bash
git add clicker-platform-v2/components/admin/blocks/forms/container/MiniBlockPicker.tsx
git commit -m "feat(canvas): MiniBlockPicker excludes row/column/grid for one-level rule"
```

---

## Task 5: NestedBlockList — dnd-kit reorder + size sliders

**Files:**
- Create: `clicker-platform-v2/components/admin/blocks/forms/container/NestedBlockList.tsx`
- Create: `clicker-platform-v2/components/admin/blocks/forms/container/__tests__/NestedBlockList.test.tsx`

- [ ] **Step 1: Write failing test for reorder & size update**

Create `clicker-platform-v2/components/admin/blocks/forms/container/__tests__/NestedBlockList.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NestedBlockList } from '../NestedBlockList';
import type { ContainerChild } from '../types';

const child = (id: string, size = 6): ContainerChild => ({
  block: { id, type: 'button', data: { label: `Btn ${id}` } },
  size,
});

describe('NestedBlockList', () => {
  it('renders each child with its label and size', () => {
    const children = [child('a', 4), child('b', 8)];
    render(
      <NestedBlockList
        childrenList={children}
        onChildrenChange={() => {}}
        onChildClick={() => {}}
        sizeMode="flex"
      />
    );
    expect(screen.getByText('Button')).toBeInTheDocument(); // label lookup
    // Size labels — flex mode shows "Width: N/12"
    expect(screen.getByText(/4\/12/)).toBeInTheDocument();
    expect(screen.getByText(/8\/12/)).toBeInTheDocument();
  });

  it('calls onChildClick with block id when edit chevron clicked', () => {
    const onChildClick = vi.fn();
    render(
      <NestedBlockList
        childrenList={[child('a')]}
        onChildrenChange={() => {}}
        onChildClick={onChildClick}
        sizeMode="flex"
      />
    );
    fireEvent.click(screen.getByLabelText('Edit child a'));
    expect(onChildClick).toHaveBeenCalledWith('a');
  });

  it('calls onChildrenChange with updated size when slider changes', () => {
    const onChange = vi.fn();
    render(
      <NestedBlockList
        childrenList={[child('a', 4), child('b', 8)]}
        onChildrenChange={onChange}
        onChildClick={() => {}}
        sizeMode="flex"
      />
    );
    const slider = screen.getByLabelText('Size for a');
    fireEvent.change(slider, { target: { value: '6' } });
    expect(onChange).toHaveBeenCalledWith([
      { block: expect.objectContaining({ id: 'a' }), size: 6 },
      { block: expect.objectContaining({ id: 'b' }), size: 8 },
    ]);
  });

  it('removes a child when delete button is clicked', () => {
    const onChange = vi.fn();
    render(
      <NestedBlockList
        childrenList={[child('a'), child('b')]}
        onChildrenChange={onChange}
        onChildClick={() => {}}
        sizeMode="flex"
      />
    );
    fireEvent.click(screen.getByLabelText('Delete child a'));
    expect(onChange).toHaveBeenCalledWith([
      { block: expect.objectContaining({ id: 'b' }), size: 6 },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd clicker-platform-v2 && pnpm test components/admin/blocks/forms/container/__tests__/NestedBlockList.test.tsx`
Expected: FAIL with "Cannot find module '../NestedBlockList'"

- [ ] **Step 3: Implement NestedBlockList**

Create `clicker-platform-v2/components/admin/blocks/forms/container/NestedBlockList.tsx`:

```tsx
'use client';

import { useState, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, ChevronRight, Trash2 } from 'lucide-react';
import { BLOCK_OPTIONS } from '../../blockDefinitions';
import { subscribeToEnabledModules } from '@/lib/modules/registry';
import type { BlockType } from '@/data/mockData';
import type { ContainerChild } from './types';
import { clampSize } from './types';
import { MiniBlockPicker } from './MiniBlockPicker';

export type SizeMode = 'flex-row' | 'flex-column' | 'grid';

interface NestedBlockListProps {
  childrenList: ContainerChild[];
  onChildrenChange: (children: ContainerChild[]) => void;
  onChildClick: (blockId: string) => void;
  sizeMode: SizeMode;
  templateId?: string;
}

function sizeLabel(mode: SizeMode, size: number): string {
  if (mode === 'flex-row') return `Width: ${size}/12`;
  if (mode === 'flex-column') return `Height: ${size}/12`;
  return `Span: ${size}/12 cols`;
}

interface SortableChildRowProps {
  child: ContainerChild;
  labelLookup: Record<string, string>;
  sizeMode: SizeMode;
  onClick: () => void;
  onSizeChange: (size: number) => void;
  onDelete: () => void;
}

function SortableChildRow({ child, labelLookup, sizeMode, onClick, onSizeChange, onDelete }: SortableChildRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: child.block.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const label = labelLookup[child.block.type] || child.block.type;
  const blockId = child.block.id;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 px-2 py-2 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-md"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300 cursor-grab"
        aria-label={`Drag ${blockId}`}
      >
        <GripVertical size={14} />
      </button>
      <span className="text-sm text-neutral-700 dark:text-neutral-300 flex-1 truncate">{label}</span>
      <div className="flex items-center gap-1 min-w-[120px]">
        <input
          type="range"
          min={1}
          max={12}
          step={1}
          value={child.size}
          onChange={(e) => onSizeChange(clampSize(Number(e.target.value)))}
          aria-label={`Size for ${blockId}`}
          className="w-16"
        />
        <span className="text-[10px] text-neutral-500 dark:text-neutral-400 whitespace-nowrap">
          {sizeLabel(sizeMode, child.size)}
        </span>
      </div>
      <button
        type="button"
        onClick={onClick}
        aria-label={`Edit child ${blockId}`}
        className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300"
      >
        <ChevronRight size={14} />
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Delete child ${blockId}`}
        className="text-neutral-400 hover:text-red-500"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

export function NestedBlockList({
  childrenList,
  onChildrenChange,
  onChildClick,
  sizeMode,
  templateId,
}: NestedBlockListProps) {
  const [labelLookup, setLabelLookup] = useState<Record<string, string>>(() => {
    const base: Record<string, string> = {};
    BLOCK_OPTIONS.forEach(o => { base[o.type] = o.label; });
    return base;
  });

  useEffect(() => {
    const unsubscribe = subscribeToEnabledModules((modules) => {
      setLabelLookup(prev => {
        const next = { ...prev };
        modules.forEach(mod => mod.blocks?.forEach(b => { next[b.type] = b.label; }));
        return next;
      });
    });
    return () => unsubscribe();
  }, []);

  const sensors = useSensors(
    useSensor(MouseSensor),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = childrenList.findIndex(c => c.block.id === active.id);
    const newIndex = childrenList.findIndex(c => c.block.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onChildrenChange(arrayMove(childrenList, oldIndex, newIndex));
  };

  const handleSizeChange = (blockId: string, size: number) => {
    onChildrenChange(
      childrenList.map(c => (c.block.id === blockId ? { ...c, size } : c))
    );
  };

  const handleDelete = (blockId: string) => {
    onChildrenChange(childrenList.filter(c => c.block.id !== blockId));
  };

  const handleAdd = (newBlock: any) => {
    const newChild: ContainerChild = {
      block: newBlock,
      size: Math.max(1, Math.floor(12 / (childrenList.length + 1))),
    };
    onChildrenChange([...childrenList, newChild]);
  };

  return (
    <div className="space-y-2">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext
          items={childrenList.map(c => c.block.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-1">
            {childrenList.map(child => (
              <SortableChildRow
                key={child.block.id}
                child={child}
                labelLookup={labelLookup}
                sizeMode={sizeMode}
                onClick={() => onChildClick(child.block.id)}
                onSizeChange={(size) => handleSizeChange(child.block.id, size)}
                onDelete={() => handleDelete(child.block.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <MiniBlockPicker onPick={handleAdd} templateId={templateId} />
    </div>
  );
}
```

- [ ] **Step 4: Verify tests pass**

Run: `cd clicker-platform-v2 && pnpm test components/admin/blocks/forms/container/__tests__/NestedBlockList.test.tsx`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add clicker-platform-v2/components/admin/blocks/forms/container/NestedBlockList.tsx \
        clicker-platform-v2/components/admin/blocks/forms/container/__tests__/NestedBlockList.test.tsx
git commit -m "feat(canvas): NestedBlockList with dnd-kit reorder + 12-col size sliders"
```

---

## Task 6: EmptyContainerPlaceholder

**Files:**
- Create: `clicker-platform-v2/components/admin/blocks/forms/container/EmptyContainerPlaceholder.tsx`

- [ ] **Step 1: Implement the placeholder**

Create `clicker-platform-v2/components/admin/blocks/forms/container/EmptyContainerPlaceholder.tsx`:

```tsx
import { Rows3, Columns3, LayoutGrid } from 'lucide-react';

interface EmptyContainerPlaceholderProps {
  type: 'row' | 'column' | 'grid';
}

const ICONS = {
  row: Rows3,
  column: Columns3,
  grid: LayoutGrid,
};

const LABELS = {
  row: 'Empty Row',
  column: 'Empty Column',
  grid: 'Empty Grid',
};

export function EmptyContainerPlaceholder({ type }: EmptyContainerPlaceholderProps) {
  const Icon = ICONS[type];
  return (
    <div className="border-2 border-dashed border-gray-300 dark:border-neutral-700 rounded-lg p-8 flex flex-col items-center justify-center gap-2 text-neutral-400 dark:text-neutral-500">
      <Icon size={28} />
      <div className="text-sm font-medium">{LABELS[type]}</div>
      <div className="text-xs">Add blocks from the side panel</div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add clicker-platform-v2/components/admin/blocks/forms/container/EmptyContainerPlaceholder.tsx
git commit -m "feat(canvas): EmptyContainerPlaceholder editor-only visual"
```

---

## Task 7: RowForm (and shared form skeleton for Column/Grid)

**Files:**
- Create: `clicker-platform-v2/components/admin/blocks/forms/RowForm.tsx`

- [ ] **Step 1: Implement RowForm**

Create `clicker-platform-v2/components/admin/blocks/forms/RowForm.tsx`:

```tsx
'use client';

import { useMemo } from 'react';
import { BlockFormRenderer } from '../BlockFormRenderer';
import { NestedBlockList } from './container/NestedBlockList';
import { useDrillDown } from './container/useDrillDown';
import type { ContainerChild } from './container/types';
import { ChevronLeft } from 'lucide-react';

interface RowFormProps {
  data: any;
  onChange: (data: any) => void;
  templateId?: string;
  onOpenSlideOver?: (panel: 'links' | 'forms' | 'products' | 'siteinfo' | 'branding') => void;
}

export function RowForm({ data, onChange, templateId, onOpenSlideOver }: RowFormProps) {
  const safeData = data || {};
  const childrenList: ContainerChild[] = useMemo(
    () => Array.isArray(safeData.children) ? safeData.children : [],
    [safeData.children]
  );

  const { drilledChildId, drillInto, drillOut } = useDrillDown(childrenList);

  const updateField = (field: string, value: any) => {
    onChange({ ...safeData, [field]: value });
  };

  const updateChildren = (children: ContainerChild[]) => {
    onChange({ ...safeData, children });
  };

  const updateChildData = (blockId: string, newData: any) => {
    updateChildren(
      childrenList.map(c =>
        c.block.id === blockId ? { ...c, block: { ...c.block, data: newData } } : c
      )
    );
  };

  if (drilledChildId) {
    const drilled = childrenList.find(c => c.block.id === drilledChildId);
    if (!drilled) return null; // useDrillDown will clear in next tick

    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={drillOut}
          className="flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200"
        >
          <ChevronLeft size={14} /> Back to Row
        </button>
        <div className="text-xs text-neutral-500 dark:text-neutral-400">
          Editing: {drilled.block.type}
        </div>
        <BlockFormRenderer
          block={drilled.block}
          onChange={(_id, newData) => updateChildData(drilledChildId, newData)}
          templateId={templateId}
          onOpenSlideOver={onOpenSlideOver}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400 tracking-wide">
          Layout
        </legend>
        <label className="block text-sm">
          <span className="text-neutral-700 dark:text-neutral-300">Gap (px)</span>
          <input
            type="number"
            min={0}
            value={safeData.gap ?? 16}
            onChange={(e) => updateField('gap', Number(e.target.value))}
            className="mt-1 w-full px-2 py-1 border border-gray-300 dark:border-neutral-700 rounded bg-white dark:bg-neutral-900"
          />
        </label>
        <label className="block text-sm">
          <span className="text-neutral-700 dark:text-neutral-300">Padding (px)</span>
          <input
            type="number"
            min={0}
            value={safeData.padding ?? 16}
            onChange={(e) => updateField('padding', Number(e.target.value))}
            className="mt-1 w-full px-2 py-1 border border-gray-300 dark:border-neutral-700 rounded bg-white dark:bg-neutral-900"
          />
        </label>
        <label className="block text-sm">
          <span className="text-neutral-700 dark:text-neutral-300">Align (cross-axis)</span>
          <select
            value={safeData.align ?? 'center'}
            onChange={(e) => updateField('align', e.target.value)}
            className="mt-1 w-full px-2 py-1 border border-gray-300 dark:border-neutral-700 rounded bg-white dark:bg-neutral-900"
          >
            <option value="start">Start</option>
            <option value="center">Center</option>
            <option value="end">End</option>
            <option value="stretch">Stretch</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-neutral-700 dark:text-neutral-300">Justify (main-axis)</span>
          <select
            value={safeData.justify ?? 'start'}
            onChange={(e) => updateField('justify', e.target.value)}
            className="mt-1 w-full px-2 py-1 border border-gray-300 dark:border-neutral-700 rounded bg-white dark:bg-neutral-900"
          >
            <option value="start">Start</option>
            <option value="center">Center</option>
            <option value="end">End</option>
            <option value="between">Between</option>
            <option value="around">Around</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={!!safeData.wrap}
            onChange={(e) => updateField('wrap', e.target.checked)}
          />
          <span className="text-neutral-700 dark:text-neutral-300">Wrap when overflowing</span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={safeData.stackOnMobile !== false}
            onChange={(e) => updateField('stackOnMobile', e.target.checked)}
          />
          <span className="text-neutral-700 dark:text-neutral-300">Stack on mobile</span>
        </label>
        <label className="block text-sm">
          <span className="text-neutral-700 dark:text-neutral-300">Max width</span>
          <select
            value={safeData.maxWidth ?? 'full'}
            onChange={(e) => updateField('maxWidth', e.target.value)}
            className="mt-1 w-full px-2 py-1 border border-gray-300 dark:border-neutral-700 rounded bg-white dark:bg-neutral-900"
          >
            <option value="full">Full width</option>
            <option value="xl">XL (1280)</option>
            <option value="lg">LG (1024)</option>
            <option value="md">MD (768)</option>
            <option value="sm">SM (640)</option>
          </select>
        </label>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400 tracking-wide">
          Children
        </legend>
        <NestedBlockList
          childrenList={childrenList}
          onChildrenChange={updateChildren}
          onChildClick={drillInto}
          sizeMode="flex-row"
          templateId={templateId}
        />
      </fieldset>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `cd clicker-platform-v2 && pnpm tsc --noEmit`
Expected: no new errors related to RowForm.

- [ ] **Step 3: Commit**

```bash
git add clicker-platform-v2/components/admin/blocks/forms/RowForm.tsx
git commit -m "feat(canvas): RowForm with drill-down and shared NestedBlockList"
```

---

## Task 8: ColumnForm

**Files:**
- Create: `clicker-platform-v2/components/admin/blocks/forms/ColumnForm.tsx`

- [ ] **Step 1: Implement ColumnForm**

Create `clicker-platform-v2/components/admin/blocks/forms/ColumnForm.tsx`:

```tsx
'use client';

import { useMemo } from 'react';
import { BlockFormRenderer } from '../BlockFormRenderer';
import { NestedBlockList } from './container/NestedBlockList';
import { useDrillDown } from './container/useDrillDown';
import type { ContainerChild } from './container/types';
import { ChevronLeft } from 'lucide-react';

interface ColumnFormProps {
  data: any;
  onChange: (data: any) => void;
  templateId?: string;
  onOpenSlideOver?: (panel: 'links' | 'forms' | 'products' | 'siteinfo' | 'branding') => void;
}

export function ColumnForm({ data, onChange, templateId, onOpenSlideOver }: ColumnFormProps) {
  const safeData = data || {};
  const childrenList: ContainerChild[] = useMemo(
    () => Array.isArray(safeData.children) ? safeData.children : [],
    [safeData.children]
  );

  const { drilledChildId, drillInto, drillOut } = useDrillDown(childrenList);

  const updateField = (field: string, value: any) => {
    onChange({ ...safeData, [field]: value });
  };

  const updateChildren = (children: ContainerChild[]) => {
    onChange({ ...safeData, children });
  };

  const updateChildData = (blockId: string, newData: any) => {
    updateChildren(
      childrenList.map(c =>
        c.block.id === blockId ? { ...c, block: { ...c.block, data: newData } } : c
      )
    );
  };

  if (drilledChildId) {
    const drilled = childrenList.find(c => c.block.id === drilledChildId);
    if (!drilled) return null;
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={drillOut}
          className="flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200"
        >
          <ChevronLeft size={14} /> Back to Column
        </button>
        <div className="text-xs text-neutral-500 dark:text-neutral-400">
          Editing: {drilled.block.type}
        </div>
        <BlockFormRenderer
          block={drilled.block}
          onChange={(_id, newData) => updateChildData(drilledChildId, newData)}
          templateId={templateId}
          onOpenSlideOver={onOpenSlideOver}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400 tracking-wide">
          Layout
        </legend>
        <label className="block text-sm">
          <span className="text-neutral-700 dark:text-neutral-300">Gap (px)</span>
          <input
            type="number"
            min={0}
            value={safeData.gap ?? 16}
            onChange={(e) => updateField('gap', Number(e.target.value))}
            className="mt-1 w-full px-2 py-1 border border-gray-300 dark:border-neutral-700 rounded bg-white dark:bg-neutral-900"
          />
        </label>
        <label className="block text-sm">
          <span className="text-neutral-700 dark:text-neutral-300">Padding (px)</span>
          <input
            type="number"
            min={0}
            value={safeData.padding ?? 16}
            onChange={(e) => updateField('padding', Number(e.target.value))}
            className="mt-1 w-full px-2 py-1 border border-gray-300 dark:border-neutral-700 rounded bg-white dark:bg-neutral-900"
          />
        </label>
        <label className="block text-sm">
          <span className="text-neutral-700 dark:text-neutral-300">Align (cross-axis)</span>
          <select
            value={safeData.align ?? 'stretch'}
            onChange={(e) => updateField('align', e.target.value)}
            className="mt-1 w-full px-2 py-1 border border-gray-300 dark:border-neutral-700 rounded bg-white dark:bg-neutral-900"
          >
            <option value="start">Start</option>
            <option value="center">Center</option>
            <option value="end">End</option>
            <option value="stretch">Stretch</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-neutral-700 dark:text-neutral-300">Max width</span>
          <select
            value={safeData.maxWidth ?? 'full'}
            onChange={(e) => updateField('maxWidth', e.target.value)}
            className="mt-1 w-full px-2 py-1 border border-gray-300 dark:border-neutral-700 rounded bg-white dark:bg-neutral-900"
          >
            <option value="full">Full width</option>
            <option value="xl">XL (1280)</option>
            <option value="lg">LG (1024)</option>
            <option value="md">MD (768)</option>
            <option value="sm">SM (640)</option>
          </select>
        </label>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400 tracking-wide">
          Children
        </legend>
        <NestedBlockList
          childrenList={childrenList}
          onChildrenChange={updateChildren}
          onChildClick={drillInto}
          sizeMode="flex-column"
          templateId={templateId}
        />
      </fieldset>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add clicker-platform-v2/components/admin/blocks/forms/ColumnForm.tsx
git commit -m "feat(canvas): ColumnForm"
```

---

## Task 9: GridForm

**Files:**
- Create: `clicker-platform-v2/components/admin/blocks/forms/GridForm.tsx`

- [ ] **Step 1: Implement GridForm**

Create `clicker-platform-v2/components/admin/blocks/forms/GridForm.tsx`:

```tsx
'use client';

import { useMemo } from 'react';
import { BlockFormRenderer } from '../BlockFormRenderer';
import { NestedBlockList } from './container/NestedBlockList';
import { useDrillDown } from './container/useDrillDown';
import type { ContainerChild } from './container/types';
import { ChevronLeft } from 'lucide-react';

interface GridFormProps {
  data: any;
  onChange: (data: any) => void;
  templateId?: string;
  onOpenSlideOver?: (panel: 'links' | 'forms' | 'products' | 'siteinfo' | 'branding') => void;
}

export function GridForm({ data, onChange, templateId, onOpenSlideOver }: GridFormProps) {
  const safeData = data || {};
  const childrenList: ContainerChild[] = useMemo(
    () => Array.isArray(safeData.children) ? safeData.children : [],
    [safeData.children]
  );

  const { drilledChildId, drillInto, drillOut } = useDrillDown(childrenList);

  const updateField = (field: string, value: any) => {
    onChange({ ...safeData, [field]: value });
  };

  const updateChildren = (children: ContainerChild[]) => {
    onChange({ ...safeData, children });
  };

  const updateChildData = (blockId: string, newData: any) => {
    updateChildren(
      childrenList.map(c =>
        c.block.id === blockId ? { ...c, block: { ...c.block, data: newData } } : c
      )
    );
  };

  if (drilledChildId) {
    const drilled = childrenList.find(c => c.block.id === drilledChildId);
    if (!drilled) return null;
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={drillOut}
          className="flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200"
        >
          <ChevronLeft size={14} /> Back to Grid
        </button>
        <div className="text-xs text-neutral-500 dark:text-neutral-400">
          Editing: {drilled.block.type}
        </div>
        <BlockFormRenderer
          block={drilled.block}
          onChange={(_id, newData) => updateChildData(drilledChildId, newData)}
          templateId={templateId}
          onOpenSlideOver={onOpenSlideOver}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400 tracking-wide">
          Layout
        </legend>
        <label className="block text-sm">
          <span className="text-neutral-700 dark:text-neutral-300">Columns (desktop)</span>
          <input
            type="number"
            min={1}
            max={12}
            value={safeData.columns ?? 3}
            onChange={(e) => updateField('columns', Math.max(1, Math.min(12, Number(e.target.value))))}
            className="mt-1 w-full px-2 py-1 border border-gray-300 dark:border-neutral-700 rounded bg-white dark:bg-neutral-900"
          />
        </label>
        <label className="block text-sm">
          <span className="text-neutral-700 dark:text-neutral-300">Gap X (px)</span>
          <input
            type="number"
            min={0}
            value={safeData.gapX ?? 16}
            onChange={(e) => updateField('gapX', Number(e.target.value))}
            className="mt-1 w-full px-2 py-1 border border-gray-300 dark:border-neutral-700 rounded bg-white dark:bg-neutral-900"
          />
        </label>
        <label className="block text-sm">
          <span className="text-neutral-700 dark:text-neutral-300">Gap Y (px)</span>
          <input
            type="number"
            min={0}
            value={safeData.gapY ?? 16}
            onChange={(e) => updateField('gapY', Number(e.target.value))}
            className="mt-1 w-full px-2 py-1 border border-gray-300 dark:border-neutral-700 rounded bg-white dark:bg-neutral-900"
          />
        </label>
        <label className="block text-sm">
          <span className="text-neutral-700 dark:text-neutral-300">Padding (px)</span>
          <input
            type="number"
            min={0}
            value={safeData.padding ?? 16}
            onChange={(e) => updateField('padding', Number(e.target.value))}
            className="mt-1 w-full px-2 py-1 border border-gray-300 dark:border-neutral-700 rounded bg-white dark:bg-neutral-900"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={safeData.stackOnMobile !== false}
            onChange={(e) => updateField('stackOnMobile', e.target.checked)}
          />
          <span className="text-neutral-700 dark:text-neutral-300">Stack on mobile</span>
        </label>
        <label className="block text-sm">
          <span className="text-neutral-700 dark:text-neutral-300">Max width</span>
          <select
            value={safeData.maxWidth ?? 'full'}
            onChange={(e) => updateField('maxWidth', e.target.value)}
            className="mt-1 w-full px-2 py-1 border border-gray-300 dark:border-neutral-700 rounded bg-white dark:bg-neutral-900"
          >
            <option value="full">Full width</option>
            <option value="xl">XL (1280)</option>
            <option value="lg">LG (1024)</option>
            <option value="md">MD (768)</option>
            <option value="sm">SM (640)</option>
          </select>
        </label>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400 tracking-wide">
          Children
        </legend>
        <NestedBlockList
          childrenList={childrenList}
          onChildrenChange={updateChildren}
          onChildClick={drillInto}
          sizeMode="grid"
          templateId={templateId}
        />
      </fieldset>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add clicker-platform-v2/components/admin/blocks/forms/GridForm.tsx
git commit -m "feat(canvas): GridForm with column/gap controls"
```

---

## Task 10: Wire forms into BlockFormRenderer

**Files:**
- Modify: `clicker-platform-v2/components/admin/blocks/BlockFormRenderer.tsx`

- [ ] **Step 1: Add dynamic imports**

In `clicker-platform-v2/components/admin/blocks/BlockFormRenderer.tsx`, after the existing `FeatureCardsForm` dynamic import (around line 37), append:

```ts
const RowForm = dynamic(() => import('./forms/RowForm').then(mod => mod.RowForm), { loading: () => <FormSkeleton /> });
const ColumnForm = dynamic(() => import('./forms/ColumnForm').then(mod => mod.ColumnForm), { loading: () => <FormSkeleton /> });
const GridForm = dynamic(() => import('./forms/GridForm').then(mod => mod.GridForm), { loading: () => <FormSkeleton /> });
```

- [ ] **Step 2: Register in core labels and switch**

In the same file, extend `coreLabels` (around line 52) with:

```ts
'row': 'Row', 'column': 'Column', 'grid': 'Grid',
```

Add three switch cases inside the `switch (block.type)` block, before `default:`:

```ts
case 'row': return <RowForm data={block.data} onChange={handleDataChange} templateId={templateId} onOpenSlideOver={onOpenSlideOver} />;
case 'column': return <ColumnForm data={block.data} onChange={handleDataChange} templateId={templateId} onOpenSlideOver={onOpenSlideOver} />;
case 'grid': return <GridForm data={block.data} onChange={handleDataChange} templateId={templateId} onOpenSlideOver={onOpenSlideOver} />;
```

- [ ] **Step 3: Manual smoke test**

Run: `cd clicker-platform-v2 && pnpm dev`
- Open Canvas Studio on any page.
- Add a Row block from the picker. The form should render with Gap/Padding/Align/Justify/Wrap/StackOnMobile/MaxWidth + an empty "Children" section with "+ Add block".
- Add Column and Grid blocks. Verify forms render their respective fields.
- Click "+ Add block" inside a row, pick "Button". A new child row appears with a size slider showing "Width: 12/12".
- Drag the size slider to 6. The label updates live.
- Click the chevron next to the child → form swaps to the button's form with "← Back to Row" breadcrumb. Click back → returns to row form.
- Delete the child → it disappears.

Expected: all interactions work; no console errors.

- [ ] **Step 4: Commit**

```bash
git add clicker-platform-v2/components/admin/blocks/BlockFormRenderer.tsx
git commit -m "feat(canvas): wire RowForm/ColumnForm/GridForm into BlockFormRenderer"
```

---

## Task 11: DefaultRowBlock public renderer

**Files:**
- Create: `clicker-platform-v2/components/blocks/public/DefaultRowBlock.tsx`

- [ ] **Step 1: Implement DefaultRowBlock**

Create `clicker-platform-v2/components/blocks/public/DefaultRowBlock.tsx`:

```tsx
'use client';

import { BlockRenderer } from '../BlockRenderer';
import { useDeviceView, dv } from '@/components/DeviceViewContext';
import type { ContainerChild } from '@/components/admin/blocks/forms/container/types';
import { EmptyContainerPlaceholder } from '@/components/admin/blocks/forms/container/EmptyContainerPlaceholder';

const MAX_WIDTH_PX: Record<string, string | undefined> = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  full: undefined,
};

const ALIGN_MAP: Record<string, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch',
};

const JUSTIFY_MAP: Record<string, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  between: 'space-between',
  around: 'space-around',
};

interface DefaultRowBlockProps {
  data: any;
  previewMode?: boolean;
  passthroughProps?: Record<string, any>;
}

export function DefaultRowBlock({ data, previewMode, passthroughProps = {} }: DefaultRowBlockProps) {
  const deviceView = useDeviceView();
  const childrenList: ContainerChild[] = Array.isArray(data?.children) ? data.children : [];
  const {
    gap = 16,
    padding = 16,
    align = 'center',
    justify = 'start',
    wrap = false,
    stackOnMobile = true,
    maxWidth = 'full',
  } = data || {};

  if (childrenList.length === 0) {
    return previewMode ? <EmptyContainerPlaceholder type="row" /> : null;
  }

  const maxW = MAX_WIDTH_PX[maxWidth];
  const flexDirClasses = stackOnMobile
    ? dv(deviceView, 'flex flex-col', 'md:flex-row')
    : 'flex flex-row';

  return (
    <div
      style={{
        maxWidth: maxW,
        marginLeft: maxW ? 'auto' : undefined,
        marginRight: maxW ? 'auto' : undefined,
        padding,
      }}
    >
      <div
        className={flexDirClasses}
        style={{
          gap,
          alignItems: ALIGN_MAP[align] ?? 'center',
          justifyContent: JUSTIFY_MAP[justify] ?? 'flex-start',
          flexWrap: wrap ? 'wrap' : 'nowrap',
        }}
      >
        {childrenList.map(child => {
          // Mobile-stack collapses size to 100% on mobile via dv() inline class
          const widthClass = stackOnMobile
            ? dv(deviceView, 'w-full', '')
            : '';
          return (
            <div
              key={child.block.id}
              className={widthClass}
              style={{
                flex: stackOnMobile && deviceView === 'mobile'
                  ? '0 0 100%'
                  : `0 0 ${(child.size / 12) * 100}%`,
                minWidth: 0,
              }}
            >
              <BlockRenderer block={child.block} previewMode={previewMode} {...passthroughProps} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add clicker-platform-v2/components/blocks/public/DefaultRowBlock.tsx
git commit -m "feat(canvas): DefaultRowBlock public renderer with mobile auto-stack"
```

---

## Task 12: DefaultColumnBlock public renderer

**Files:**
- Create: `clicker-platform-v2/components/blocks/public/DefaultColumnBlock.tsx`

- [ ] **Step 1: Implement DefaultColumnBlock**

Create `clicker-platform-v2/components/blocks/public/DefaultColumnBlock.tsx`:

```tsx
'use client';

import { BlockRenderer } from '../BlockRenderer';
import type { ContainerChild } from '@/components/admin/blocks/forms/container/types';
import { EmptyContainerPlaceholder } from '@/components/admin/blocks/forms/container/EmptyContainerPlaceholder';

const MAX_WIDTH_PX: Record<string, string | undefined> = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  full: undefined,
};

const ALIGN_MAP: Record<string, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch',
};

interface DefaultColumnBlockProps {
  data: any;
  previewMode?: boolean;
  passthroughProps?: Record<string, any>;
}

export function DefaultColumnBlock({ data, previewMode, passthroughProps = {} }: DefaultColumnBlockProps) {
  const childrenList: ContainerChild[] = Array.isArray(data?.children) ? data.children : [];
  const {
    gap = 16,
    padding = 16,
    align = 'stretch',
    maxWidth = 'full',
  } = data || {};

  if (childrenList.length === 0) {
    return previewMode ? <EmptyContainerPlaceholder type="column" /> : null;
  }

  const maxW = MAX_WIDTH_PX[maxWidth];

  return (
    <div
      style={{
        maxWidth: maxW,
        marginLeft: maxW ? 'auto' : undefined,
        marginRight: maxW ? 'auto' : undefined,
        padding,
      }}
    >
      <div
        className="flex flex-col"
        style={{
          gap,
          alignItems: ALIGN_MAP[align] ?? 'stretch',
        }}
      >
        {childrenList.map(child => (
          <div key={child.block.id} style={{ width: '100%' }}>
            {/*
              For column, `size` semantically means proportional height share. Without
              a constrained container height, this is mostly informational. Users wanting
              fixed-height columns can set padding/min-height inside individual children.
            */}
            <BlockRenderer block={child.block} previewMode={previewMode} {...passthroughProps} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add clicker-platform-v2/components/blocks/public/DefaultColumnBlock.tsx
git commit -m "feat(canvas): DefaultColumnBlock public renderer"
```

---

## Task 13: DefaultGridBlock public renderer

**Files:**
- Create: `clicker-platform-v2/components/blocks/public/DefaultGridBlock.tsx`

- [ ] **Step 1: Implement DefaultGridBlock**

Create `clicker-platform-v2/components/blocks/public/DefaultGridBlock.tsx`:

```tsx
'use client';

import { BlockRenderer } from '../BlockRenderer';
import { useDeviceView } from '@/components/DeviceViewContext';
import type { ContainerChild } from '@/components/admin/blocks/forms/container/types';
import { EmptyContainerPlaceholder } from '@/components/admin/blocks/forms/container/EmptyContainerPlaceholder';

const MAX_WIDTH_PX: Record<string, string | undefined> = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  full: undefined,
};

interface DefaultGridBlockProps {
  data: any;
  previewMode?: boolean;
  passthroughProps?: Record<string, any>;
}

export function DefaultGridBlock({ data, previewMode, passthroughProps = {} }: DefaultGridBlockProps) {
  const deviceView = useDeviceView();
  const childrenList: ContainerChild[] = Array.isArray(data?.children) ? data.children : [];
  const {
    columns = 3,
    gapX = 16,
    gapY = 16,
    padding = 16,
    stackOnMobile = true,
    maxWidth = 'full',
  } = data || {};

  if (childrenList.length === 0) {
    return previewMode ? <EmptyContainerPlaceholder type="grid" /> : null;
  }

  const isMobileView = deviceView === 'mobile';
  const isResponsive = deviceView === 'responsive' || deviceView === 'desktop' || deviceView === 'tablet';
  const effectiveColumns = stackOnMobile && isMobileView ? 1 : columns;

  const maxW = MAX_WIDTH_PX[maxWidth];

  // For responsive viewports, use CSS media query so real mobile devices collapse.
  // For explicit preview modes, force the column count.
  const gridTemplateColumns = isResponsive && stackOnMobile
    ? `repeat(${columns}, 1fr)` // CSS media query applied via className below
    : `repeat(${effectiveColumns}, 1fr)`;

  return (
    <div
      style={{
        maxWidth: maxW,
        marginLeft: maxW ? 'auto' : undefined,
        marginRight: maxW ? 'auto' : undefined,
        padding,
      }}
    >
      <div
        className={
          isResponsive && stackOnMobile
            ? 'grid grid-cols-1 md:grid-cols-[var(--cols)]'
            : 'grid'
        }
        style={{
          gridTemplateColumns,
          columnGap: gapX,
          rowGap: gapY,
          // CSS var for the md: arbitrary value above
          ['--cols' as any]: `repeat(${columns}, 1fr)`,
        }}
      >
        {childrenList.map(child => {
          const span = stackOnMobile && isMobileView
            ? 1
            : Math.min(child.size, columns);
          return (
            <div
              key={child.block.id}
              style={{ gridColumn: `span ${span}` }}
            >
              <BlockRenderer block={child.block} previewMode={previewMode} {...passthroughProps} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add clicker-platform-v2/components/blocks/public/DefaultGridBlock.tsx
git commit -m "feat(canvas): DefaultGridBlock public renderer with mobile stack"
```

---

## Task 14: Wire public renderers into BlockRenderer

**Files:**
- Modify: `clicker-platform-v2/components/blocks/BlockRenderer.tsx`

- [ ] **Step 1: Add dynamic imports**

In `clicker-platform-v2/components/blocks/BlockRenderer.tsx`, after the existing `FeatureCardsBlock` dynamic import (line 22), append:

```ts
const RowContainerBlock = dynamic(() => import('./public/DefaultRowBlock').then(mod => mod.DefaultRowBlock));
const ColumnContainerBlock = dynamic(() => import('./public/DefaultColumnBlock').then(mod => mod.DefaultColumnBlock));
const GridContainerBlock = dynamic(() => import('./public/DefaultGridBlock').then(mod => mod.DefaultGridBlock));
```

- [ ] **Step 2: Add switch cases**

Inside the `switch (block.type)` block (before `default`), add:

```ts
case 'row':
  return <RowContainerBlock data={block.data} previewMode={previewMode} passthroughProps={{ theme, siteId, tenantSlug, templateId, phoneNumber, whatsappSettings, onInlineChange, onFieldFocus, onFieldBlur, links, contact, branches, featuredProduct, products, businessHours, businessSchedule, linkSettings, productSettings, profile, reservationServices, reservationStaff, reservationSettings }} />;
case 'column':
  return <ColumnContainerBlock data={block.data} previewMode={previewMode} passthroughProps={{ theme, siteId, tenantSlug, templateId, phoneNumber, whatsappSettings, onInlineChange, onFieldFocus, onFieldBlur, links, contact, branches, featuredProduct, products, businessHours, businessSchedule, linkSettings, productSettings, profile, reservationServices, reservationStaff, reservationSettings }} />;
case 'grid':
  return <GridContainerBlock data={block.data} previewMode={previewMode} passthroughProps={{ theme, siteId, tenantSlug, templateId, phoneNumber, whatsappSettings, onInlineChange, onFieldFocus, onFieldBlur, links, contact, branches, featuredProduct, products, businessHours, businessSchedule, linkSettings, productSettings, profile, reservationServices, reservationStaff, reservationSettings }} />;
```

- [ ] **Step 3: Manual smoke test (full flow)**

Run: `cd clicker-platform-v2 && pnpm dev`

Test on Canvas Studio (an editable page):
- Add a Row block. Confirm the dashed "Empty Row — add blocks from the side panel" placeholder appears on the canvas.
- Inside the row form, add 2 Button blocks. Each defaults to ~6/12. Buttons appear side-by-side on canvas.
- Drag size of first button to 4, second stays 6. Layout updates live; right side has empty 2/12 space.
- Toggle "Stack on mobile" off; switch canvas preview to mobile. Buttons should remain side-by-side.
- Toggle "Stack on mobile" on; mobile preview should show buttons stacked.
- Add a Column block. Add 3 Text blocks. They stack vertically.
- Add a Grid block. Set columns = 3. Add 4 blocks; they wrap to a 3-cols grid (4th wraps to row 2).
- Save the page. Reload the page. Containers and their children persist.
- View the public page (non-preview). Empty containers render nothing; populated ones render correctly.

Expected: all interactions and persistence work; no console errors on canvas or public site.

- [ ] **Step 4: Run full test suite**

Run: `cd clicker-platform-v2 && pnpm test`
Expected: all existing tests pass + new container tests pass (types, useDrillDown, NestedBlockList).

- [ ] **Step 5: Run lint and typecheck**

Run: `cd clicker-platform-v2 && pnpm lint && pnpm tsc --noEmit`
Expected: no new lint or type errors.

- [ ] **Step 6: Commit**

```bash
git add clicker-platform-v2/components/blocks/BlockRenderer.tsx
git commit -m "feat(canvas): wire container renderers into BlockRenderer"
```

---

## Task 15: Final QA pass and verification

- [ ] **Step 1: Verify spec requirements**

Walk through `superpowers/specs/2026-05-14-container-blocks-design.md` end-to-end and check each item:

- [ ] Three block types registered (`row`, `column`, `grid`)
- [ ] `ContainerChild` shape used everywhere (`{ block, size }`)
- [ ] Children at `data.children`, not on `PageBlock`
- [ ] Drill-down form UX with breadcrumb back
- [ ] Size slider 1–12 with live update
- [ ] No auto-rebalance on add (new = `floor(12/N+1)`) or delete (remaining unchanged)
- [ ] dnd-kit reorder works (nested independent of outer)
- [ ] Drill state clears when drilled child deleted
- [ ] MiniBlockPicker excludes row/column/grid
- [ ] EmptyContainerPlaceholder only in editor (`previewMode === true`)
- [ ] `dv()` helper used for mobile stack (row, grid)
- [ ] `maxWidth` translates to centered max-width band
- [ ] Inline edit on a button inside a row updates correct child (verify by editing button text inline if template supports it)
- [ ] No outline changes — containers appear as ONE row in `BlockManager`
- [ ] No `PageStudioContext` / `EditorContext` / `PageBlock` schema changes

- [ ] **Step 2: Final commit (no-op or doc tweaks if anything found)**

If issues turned up in Step 1, fix them and commit. Otherwise:

```bash
git status  # should be clean
```

---

## Notes for the implementing engineer

- **`@testing-library/react`** must already be a dependency. If `renderHook` / `render` imports fail in tests, check `package.json` and install `@testing-library/react @testing-library/jest-dom` as needed. (Existing tests in `lib/registration/__tests__/` use vitest only; if no React testing setup is present, you may need to add a Vitest setup file with jsdom — check `vitest.config.ts`.)
- **`dv()` helper context:** `useDeviceView()` comes from `@/components/DeviceViewContext`. Containers must render inside a `DeviceViewProvider`. The Canvas Studio already provides this; the public renderer wraps blocks in it where needed.
- **Inline editing:** the `passthroughProps` spread in `BlockRenderer` switch cases (Task 14) carries `onInlineChange`, `onFieldFocus`, `onFieldBlur` through to children. This is the prop-drilling the spec calls out as the most likely source of subtle bugs — test inline edit on a Heading or Text block inside a Row to confirm.
- **Existing duplicate-block action:** if `BlockManager` has a "duplicate block" action, it must deep-clone `children` with new IDs. Search for `duplicate` in `BlockManager.tsx` and verify; if needed, add a fix-up commit.
- **No migrations:** existing pages don't have container blocks; nothing to backfill.
