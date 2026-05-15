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
