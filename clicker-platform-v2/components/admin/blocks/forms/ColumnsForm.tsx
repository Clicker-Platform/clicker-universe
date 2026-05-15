'use client';

import { useMemo, useState } from 'react';
import { BlockFormRenderer } from '../BlockFormRenderer';
import { NestedBlockList } from './container/NestedBlockList';
import type { ColumnSlot } from './container/types';
import { clampSize, defaultNewColumnSize, distributeSizes, newId } from './container/types';
import type { PageBlock } from '@/data/mockData';
import { ChevronLeft, Plus, X } from 'lucide-react';

// Returns true when the columns' sizes match the distributeSizes(N) pattern,
// i.e., they look "untouched" (default equal share). Used to decide whether
// to auto-rebalance on add/remove.
function isAllEqual(cols: ColumnSlot[]): boolean {
  if (cols.length === 0) return true;
  const expected = distributeSizes(cols.length);
  return cols.every((c, i) => c.size === expected[i]);
}

function rebalance(cols: ColumnSlot[]): ColumnSlot[] {
  const sizes = distributeSizes(cols.length);
  return cols.map((c, i) => ({ ...c, size: sizes[i] }));
}

interface ColumnsFormProps {
  data: any;
  onChange: (data: any) => void;
  templateId?: string;
  onOpenSlideOver?: (panel: 'links' | 'forms' | 'products' | 'siteinfo' | 'branding') => void;
}

export function ColumnsForm({ data, onChange, templateId, onOpenSlideOver }: ColumnsFormProps) {
  const safeData = data || {};
  const columns: ColumnSlot[] = useMemo(
    () => (Array.isArray(safeData.columns) ? safeData.columns : []),
    [safeData.columns]
  );

  const [activeIdx, setActiveIdx] = useState(0);
  const [drilledBlockId, setDrilledBlockId] = useState<string | null>(null);

  const safeActiveIdx = Math.min(activeIdx, Math.max(0, columns.length - 1));

  const drilledLocation = useMemo(() => {
    if (!drilledBlockId) return null;
    for (let ci = 0; ci < columns.length; ci++) {
      const bi = columns[ci].blocks.findIndex(b => b.id === drilledBlockId);
      if (bi !== -1) return { columnIdx: ci, blockIdx: bi, block: columns[ci].blocks[bi] };
    }
    return null;
  }, [drilledBlockId, columns]);

  if (drilledBlockId && !drilledLocation) {
    setDrilledBlockId(null);
  }

  const updateField = (field: string, value: any) => {
    onChange({ ...safeData, [field]: value });
  };

  const updateColumns = (next: ColumnSlot[]) => {
    onChange({ ...safeData, columns: next });
  };

  const updateColumnBlocks = (colIdx: number, blocks: PageBlock[]) => {
    updateColumns(columns.map((c, i) => (i === colIdx ? { ...c, blocks } : c)));
  };

  const updateBlockData = (colIdx: number, blockId: string, newData: any) => {
    updateColumns(
      columns.map((c, i) =>
        i === colIdx
          ? { ...c, blocks: c.blocks.map(b => (b.id === blockId ? { ...b, data: newData } : b)) }
          : c
      )
    );
  };

  const setColumnSize = (colIdx: number, size: number) => {
    updateColumns(columns.map((c, i) => (i === colIdx ? { ...c, size: clampSize(size) } : c)));
  };

  const addColumn = () => {
    const newCol: ColumnSlot = {
      id: newId('col'),
      size: defaultNewColumnSize(columns.length),
      blocks: [],
    };
    const appended = [...columns, newCol];
    // Auto-rebalance widths only if existing columns were at their equal-share defaults
    // (untouched). Preserves the user's tuned widths when they've customized.
    const next = isAllEqual(columns) ? rebalance(appended) : appended;
    updateColumns(next);
    setActiveIdx(columns.length);
  };

  const removeColumn = (idx: number) => {
    if (columns.length <= 1) return;
    const remaining = columns.filter((_, i) => i !== idx);
    // Same logic on remove: rebalance only if widths were untouched.
    const next = isAllEqual(columns) ? rebalance(remaining) : remaining;
    updateColumns(next);
    if (safeActiveIdx >= columns.length - 1) setActiveIdx(Math.max(0, columns.length - 2));
  };

  if (drilledLocation) {
    const { columnIdx, block } = drilledLocation;
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setDrilledBlockId(null)}
          className="flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200"
        >
          <ChevronLeft size={14} /> Back to Columns
        </button>
        <div className="text-xs text-neutral-500 dark:text-neutral-400">
          Editing: {block.type} (in Col {columnIdx + 1})
        </div>
        <BlockFormRenderer
          block={block}
          onChange={(_id, newData) => updateBlockData(columnIdx, block.id, newData)}
          templateId={templateId}
          onOpenSlideOver={onOpenSlideOver}
        />
      </div>
    );
  }

  const activeColumn = columns[safeActiveIdx];

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
          Columns
        </legend>
        <div className="flex items-center gap-1 flex-wrap border-b border-gray-200 dark:border-neutral-700 pb-1">
          {columns.map((col, idx) => (
            <button
              key={col.id}
              type="button"
              onClick={() => setActiveIdx(idx)}
              className={`px-2 py-1 text-xs rounded-t flex items-center gap-1 ${
                idx === safeActiveIdx
                  ? 'bg-gray-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-medium'
                  : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
              }`}
            >
              Col {idx + 1}
              {columns.length > 1 && (
                <span
                  role="button"
                  tabIndex={0}
                  aria-label={`Remove column ${idx + 1}`}
                  onClick={(e) => { e.stopPropagation(); removeColumn(idx); }}
                  className="text-neutral-400 hover:text-red-500 cursor-pointer"
                >
                  <X size={10} />
                </span>
              )}
            </button>
          ))}
          <button
            type="button"
            onClick={addColumn}
            aria-label="Add column"
            className="px-2 py-1 text-xs text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 flex items-center gap-1"
          >
            <Plus size={12} /> Add column
          </button>
        </div>

        {activeColumn && (
          <div className="space-y-3 pt-2">
            <label className="block text-sm">
              <span className="text-neutral-700 dark:text-neutral-300">
                Column width: {activeColumn.size}/12
              </span>
              <input
                type="range"
                min={1}
                max={12}
                step={1}
                value={activeColumn.size}
                onChange={(e) => setColumnSize(safeActiveIdx, Number(e.target.value))}
                aria-label={`Width for column ${safeActiveIdx + 1}`}
                className="mt-1 w-full"
              />
            </label>
            <div>
              <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">
                Blocks in this column
              </div>
              <NestedBlockList
                blocksList={activeColumn.blocks}
                onBlocksChange={(blocks) => updateColumnBlocks(safeActiveIdx, blocks)}
                onBlockClick={setDrilledBlockId}
                templateId={templateId}
              />
            </div>
          </div>
        )}
      </fieldset>
    </div>
  );
}
