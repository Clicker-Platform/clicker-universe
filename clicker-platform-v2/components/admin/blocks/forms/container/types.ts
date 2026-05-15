import { PageBlock } from '@/data/mockData';

export interface ColumnSlot {
  id: string;
  size: number;          // 1–12, fraction of 12-column grid
  blocks: PageBlock[];   // multiple stacked blocks inside this column
}

export interface GridCell {
  id: string;
  row: number;             // 1-indexed
  col: number;             // 1-indexed
  block: PageBlock | null; // empty cell allowed
}

export const SIZE_MIN = 1;
export const SIZE_MAX = 12;
export const GRID_TOTAL = 12;

export function clampSize(size: number): number {
  return Math.max(SIZE_MIN, Math.min(SIZE_MAX, Math.floor(size)));
}

/**
 * Distributes 12 column units across N items.
 * - Equal share when N divides 12.
 * - Remainder distributed left-to-right.
 * - Each item gets at least size 1 (so N > 12 produces all 1s).
 */
export function distributeSizes(count: number): number[] {
  if (count <= 0) return [];
  if (count > GRID_TOTAL) return Array(count).fill(1);
  const base = Math.floor(GRID_TOTAL / count);
  const remainder = GRID_TOTAL - base * count;
  return Array.from({ length: count }, (_, i) => (i < remainder ? base + 1 : base));
}

/**
 * Compute default size for a NEW column slot added to an existing list.
 */
export function defaultNewColumnSize(existingCount: number): number {
  return Math.max(1, Math.floor(GRID_TOTAL / (existingCount + 1)));
}

export function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Result of finding a block by id within a tree of top-level blocks that may
 * contain nested children inside container blocks (Columns / Grid).
 *
 * - kind: 'top' — block is at the page root
 * - kind: 'columns-child' — block is a child of a Columns container at parentBlock,
 *   inside the column slot with id slotId, at index childIdx in that slot's blocks
 * - kind: 'grid-cell' — block is in a Grid cell with id slotId at parentBlock
 */
export type BlockLocation =
  | { kind: 'top'; index: number; block: PageBlock }
  | { kind: 'columns-child'; parentBlock: PageBlock; slotId: string; childIdx: number; block: PageBlock }
  | { kind: 'grid-cell'; parentBlock: PageBlock; slotId: string; block: PageBlock };

/**
 * Walks top-level blocks to find which container owns a given slot id (ColumnSlot.id
 * or GridCell.id). Returns the parent container block, or null if no container has
 * a matching slot. Used to render the parent's form when a user clicks an empty
 * column/cell area on canvas (no block selected, just a slot active).
 */
export function findContainerBySlotId(
  blocks: PageBlock[],
  slotId: string
): PageBlock | null {
  for (const b of blocks) {
    if (b.type === 'columns' && Array.isArray(b.data?.columns)) {
      const slots = b.data.columns as ColumnSlot[];
      if (slots.some(s => s.id === slotId)) return b;
    } else if (b.type === 'grid' && Array.isArray(b.data?.cells)) {
      const cells = b.data.cells as GridCell[];
      if (cells.some(c => c.id === slotId)) return b;
    }
  }
  return null;
}

/**
 * Walks the page's block tree (including nested container children) to find a block
 * by id. Returns null if not found. Used by BlockFormRenderer to render the right
 * form when a nested block is selected on canvas, and by container forms to
 * auto-drill when their nested block becomes selected.
 */
export function findBlockPath(
  blocks: PageBlock[],
  targetId: string
): BlockLocation | null {
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.id === targetId) {
      return { kind: 'top', index: i, block: b };
    }
    if (b.type === 'columns' && Array.isArray(b.data?.columns)) {
      const slots = b.data.columns as ColumnSlot[];
      for (const slot of slots) {
        const childIdx = slot.blocks?.findIndex(c => c.id === targetId) ?? -1;
        if (childIdx !== -1) {
          return {
            kind: 'columns-child',
            parentBlock: b,
            slotId: slot.id,
            childIdx,
            block: slot.blocks[childIdx],
          };
        }
      }
    } else if (b.type === 'grid' && Array.isArray(b.data?.cells)) {
      const cells = b.data.cells as GridCell[];
      for (const cell of cells) {
        if (cell.block?.id === targetId) {
          return {
            kind: 'grid-cell',
            parentBlock: b,
            slotId: cell.id,
            block: cell.block,
          };
        }
      }
    }
  }
  return null;
}
