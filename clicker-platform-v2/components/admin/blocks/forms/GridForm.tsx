'use client';

import { useMemo, useState, useEffect } from 'react';
import { BlockFormRenderer } from '../BlockFormRenderer';
import { MiniBlockPicker } from './container/MiniBlockPicker';
import { CellColorField } from './container/CellColorField';
import { BLOCK_OPTIONS } from '../blockDefinitions';
import { subscribeToEnabledModules } from '@/lib/modules/registry';
import type { GridCell } from './container/types';
import { newId } from './container/types';
import type { PageBlock } from '@/data/mockData';
import { ChevronLeft, X } from 'lucide-react';
import { useEditor } from '../EditorContext';

interface GridFormProps {
  data: any;
  /** The parent container block's id — needed to write proper `kind: 'slots'` selection. */
  containerBlockId: string;
  onChange: (data: any) => void;
  templateId?: string;
  onOpenSlideOver?: (panel: 'links' | 'forms' | 'products' | 'siteinfo' | 'branding') => void;
}

const MIN_DIM = 1;
const MAX_DIM = 12;

function clampDim(n: number) {
  return Math.max(MIN_DIM, Math.min(MAX_DIM, Math.floor(n)));
}

export function GridForm({ data, containerBlockId, onChange, templateId, onOpenSlideOver }: GridFormProps) {
  const safeData = data || {};
  const cols: number = clampDim(safeData.cols ?? 3);
  const rows: number = clampDim(safeData.rows ?? 2);
  const cells: GridCell[] = useMemo(
    () => (Array.isArray(safeData.cells) ? safeData.cells : []),
    [safeData.cells]
  );

  // Visible cells = cells within current cols × rows bounds, sorted row-major.
  // Cells outside the bounds stay in data (soft-delete) so resize is reversible.
  const visibleCells = useMemo(() => {
    const within = cells.filter(c => c.row <= rows && c.col <= cols);
    return within.sort((a, b) => (a.row - b.row) || (a.col - b.col));
  }, [cells, cols, rows]);

  // Hidden cells = cells outside current bounds that hold a block (worth flagging).
  const hiddenWithContent = useMemo(
    () => cells.filter(c => (c.row > rows || c.col > cols) && c.block !== null),
    [cells, cols, rows]
  );

  const { selection, setSelection } = useEditor();

  // ── Active cell (derived from selection — single source of truth) ──
  const activeCell = useMemo<GridCell | null>(() => {
    // Case 1: a slot in this grid is selected → use it.
    if (selection.kind === 'slots' && selection.containerId === containerBlockId && selection.ids.length === 1) {
      const cell = visibleCells.find(c => c.id === selection.ids[0]);
      if (cell) return cell;
    }
    // Case 2: a nested block in this grid is selected → use its cell.
    if (selection.kind === 'blocks' && selection.ids.length === 1) {
      const blockId = selection.ids[0];
      const cell = visibleCells.find(c => c.block?.id === blockId);
      if (cell) return cell;
    }
    // Fallback to first visible cell.
    return visibleCells[0] ?? null;
  }, [selection, visibleCells, containerBlockId]);

  const safeActiveIdx = activeCell ? visibleCells.indexOf(activeCell) : -1;

  /** Set active cell id — writes a slot selection. Use null to deselect. */
  const setActiveCellId = (id: string | null) => {
    if (id === null) {
      setSelection({ kind: 'none' });
    } else {
      setSelection({ kind: 'slots', containerId: containerBlockId, ids: [id] });
    }
  };

  // ── Drilled-into block (form-internal nav, derived from selection) ──
  // Two ways to be drilled into a cell's block:
  //  1. selection.kind === 'blocks' targeting the child block directly.
  //  2. selection.kind === 'slots' whose containerId IS the child block
  //     (e.g. a card inside a FeatureCards block nested in this Grid cell).
  //     Without this, the child block's form is never reachable from the
  //     right-panel and edits silently no-op.
  const drilledCell = useMemo<GridCell | null>(() => {
    if (selection.kind === 'blocks' && selection.ids.length === 1) {
      const blockId = selection.ids[0];
      return cells.find(c => c.block?.id === blockId) ?? null;
    }
    if (selection.kind === 'slots' && selection.containerId) {
      const cId = selection.containerId;
      return cells.find(c => c.block?.id === cId) ?? null;
    }
    return null;
  }, [selection, cells]);
  const drilledCellId = drilledCell?.id ?? null;

  /** Set or clear drilled cell. id !== null → select that cell's block.
   * id === null → exit drill back to the slot containing it (or none). */
  const setDrilledCellId = (id: string | null) => {
    if (id === null) {
      // Exit drill: select the cell as a slot (keeps form tab + canvas highlight).
      if (activeCell) {
        setSelection({ kind: 'slots', containerId: containerBlockId, ids: [activeCell.id] });
      } else {
        setSelection({ kind: 'none' });
      }
    } else {
      // Drilling into a cell's block: write the block selection.
      const cell = cells.find(c => c.id === id);
      if (cell?.block) {
        setSelection({ kind: 'blocks', ids: [cell.block.id] });
      }
    }
  };

  // Block label lookup for showing the type name on the active tab.
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

  const updateField = (field: string, value: any) => {
    onChange({ ...safeData, [field]: value });
  };

  const resizeMatrix = (newCols: number, newRows: number) => {
    // Keep ALL existing cells (soft-delete). For positions inside the new bounds
    // that don't already have a cell, create an empty one.
    const byPosition = new Map<string, GridCell>();
    cells.forEach(c => byPosition.set(`${c.row}:${c.col}`, c));

    const next: GridCell[] = [...cells];
    for (let r = 1; r <= newRows; r++) {
      for (let c = 1; c <= newCols; c++) {
        if (!byPosition.has(`${r}:${c}`)) {
          next.push({ id: newId('cell'), row: r, col: c, block: null });
        }
      }
    }
    onChange({ ...safeData, cols: newCols, rows: newRows, cells: next });
  };

  const discardHiddenCells = () => {
    const kept = cells.filter(c => c.row <= rows && c.col <= cols);
    onChange({ ...safeData, cells: kept });
  };

  const updateCells = (next: GridCell[]) => {
    onChange({ ...safeData, cells: next });
  };

  const setCellBlock = (cellId: string, block: PageBlock | null) => {
    updateCells(cells.map(c => (c.id === cellId ? { ...c, block } : c)));
  };

  const setCellBgColor = (cellId: string, bgColor: string | undefined) => {
    updateCells(cells.map(c => (c.id === cellId ? { ...c, bgColor } : c)));
  };

  const updateBlockData = (cellId: string, newData: any) => {
    updateCells(
      cells.map(c =>
        c.id === cellId && c.block ? { ...c, block: { ...c.block, data: newData } } : c
      )
    );
  };

  if (drilledCell?.block) {
    const block = drilledCell.block;
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setDrilledCellId(null)}
          className="flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200"
        >
          <ChevronLeft size={14} /> Back to Grid
        </button>
        <div className="text-xs text-neutral-500 dark:text-neutral-400">
          Editing: {block.type}
        </div>
        <BlockFormRenderer
          block={block}
          onChange={(_id, newData) => updateBlockData(drilledCell.id, newData)}
          templateId={templateId}
          onOpenSlideOver={onOpenSlideOver}
        />
      </div>
    );
  }

  const activeRow = activeCell?.row;
  const activeCol = activeCell?.col;

  return (
    <div className="space-y-4">
      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400 tracking-wide">
          Layout
        </legend>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-sm">
            <span className="text-neutral-700 dark:text-neutral-300">Columns</span>
            <input
              type="number"
              min={1}
              max={12}
              value={cols}
              onChange={(e) => resizeMatrix(clampDim(Number(e.target.value)), rows)}
              className="mt-1 w-full px-2 py-1 border border-gray-300 dark:border-neutral-700 rounded bg-white dark:bg-neutral-900"
            />
          </label>
          <label className="block text-sm">
            <span className="text-neutral-700 dark:text-neutral-300">Rows</span>
            <input
              type="number"
              min={1}
              max={12}
              value={rows}
              onChange={(e) => resizeMatrix(cols, clampDim(Number(e.target.value)))}
              className="mt-1 w-full px-2 py-1 border border-gray-300 dark:border-neutral-700 rounded bg-white dark:bg-neutral-900"
            />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2">
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
        </div>
        <div className="grid grid-cols-2 gap-2">
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
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={safeData.stackOnMobile !== false}
            onChange={(e) => updateField('stackOnMobile', e.target.checked)}
          />
          <span className="text-neutral-700 dark:text-neutral-300">Stack on mobile</span>
        </label>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400 tracking-wide">
          Cells ({cols} × {rows})
        </legend>
        <div className="flex items-center gap-1 flex-wrap border-b border-gray-200 dark:border-neutral-700 pb-1">
          {visibleCells.map((cell, idx) => (
            <button
              key={cell.id}
              type="button"
              onClick={() => setActiveCellId(cell.id)}
              title={`Row ${cell.row}, Col ${cell.col}`}
              className={`px-2 py-1 text-xs rounded-t ${
                idx === safeActiveIdx
                  ? 'bg-gray-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-medium'
                  : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
              } ${cell.block ? 'border-b-2 border-blue-400' : ''}`}
            >
              {idx + 1}
            </button>
          ))}
        </div>

        {hiddenWithContent.length > 0 && (
          <div className="flex items-center justify-between gap-2 px-2 py-1.5 text-[11px] bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded text-amber-800 dark:text-amber-200">
            <span>
              {hiddenWithContent.length} hidden cell{hiddenWithContent.length === 1 ? '' : 's'} with content. Resize back to recover.
            </span>
            <button
              type="button"
              onClick={discardHiddenCells}
              className="font-medium underline hover:no-underline"
            >
              Discard hidden
            </button>
          </div>
        )}

        {activeCell && (
          <div className="space-y-2 pt-2">
            <div className="text-xs text-neutral-500 dark:text-neutral-400">
              Cell {safeActiveIdx + 1} — Row {activeRow}, Col {activeCol}
            </div>
            <div className="space-y-1">
              <span className="text-xs text-neutral-700 dark:text-neutral-300">Background color</span>
              <CellColorField
                value={activeCell.bgColor}
                onChange={(c) => setCellBgColor(activeCell.id, c)}
              />
            </div>
            {activeCell.block ? (
              <div className="flex items-center gap-2 px-2 py-2 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-md">
                <span className="text-sm text-neutral-700 dark:text-neutral-300 flex-1 truncate">
                  {labelLookup[activeCell.block.type] || activeCell.block.type}
                </span>
                <button
                  type="button"
                  onClick={() => setDrilledCellId(activeCell.id)}
                  className="text-xs text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setCellBlock(activeCell.id, null)}
                  aria-label="Clear cell"
                  className="text-neutral-400 hover:text-red-500"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <MiniBlockPicker
                onPick={(b) => setCellBlock(activeCell.id, b)}
                templateId={templateId}
              />
            )}
          </div>
        )}
      </fieldset>
    </div>
  );
}
