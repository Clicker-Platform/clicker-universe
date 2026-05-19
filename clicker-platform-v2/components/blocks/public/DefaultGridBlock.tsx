'use client';

import { useContext } from 'react';
import { BlockRenderer } from '../BlockRenderer';
import { useDeviceView } from '@/components/DeviceViewContext';
import type { GridCell } from '@/components/admin/blocks/forms/container/types';
import { EmptyContainerPlaceholder } from '@/components/admin/blocks/forms/container/EmptyContainerPlaceholder';
import { SelectableBlock } from '@/components/admin/blocks/SelectableBlock';
import { EditorContext } from '@/components/admin/blocks/EditorContext';

const MAX_WIDTH_PX: Record<string, string | undefined> = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  full: undefined,
};

interface DefaultGridBlockProps {
  data: any;
  containerBlockId: string;
  previewMode?: boolean;
  showGuides?: boolean;
  passthroughProps?: Record<string, any>;
}

export function DefaultGridBlock({ data, containerBlockId, previewMode, showGuides, passthroughProps = {} }: DefaultGridBlockProps) {
  const deviceView = useDeviceView();
  const editor = useContext(EditorContext);
  const cells: GridCell[] = Array.isArray(data?.cells) ? data.cells : [];
  const {
    cols = 3,
    rows = 2,
    gapX = 16,
    gapY = 16,
    padding = 16,
    stackOnMobile = true,
    maxWidth = 'full',
  } = data || {};

  const showCellGuides = !!(previewMode && showGuides);

  // Active slot for this grid, derived from selection.
  const activeSlotId: string | null = editor && previewMode
    && editor.selection.kind === 'slots'
    && editor.selection.containerId === containerBlockId
    && editor.selection.ids.length === 1
    ? editor.selection.ids[0]
    : null;

  const filledCount = cells.filter(c => c.block).length;
  // Show the empty-state placeholder only when there's nothing meaningful to
  // render (no filled cells, no guides, no active slot to highlight).
  if (filledCount === 0 && !showCellGuides && !activeSlotId) {
    return previewMode ? <EmptyContainerPlaceholder type="grid" /> : null;
  }

  const maxW = MAX_WIDTH_PX[maxWidth];

  // Mobile collapse needs different strategies per deviceView:
  // - 'responsive' (real public site): use real CSS @media via a CSS variable
  // - 'mobile' (canvas preview): force 1 column inline
  // - 'tablet' / 'desktop' (canvas preview): force `cols` inline
  const useResponsiveCss = deviceView === 'responsive' && stackOnMobile;
  const isMobileView = deviceView === 'mobile';
  const effectiveCols = stackOnMobile && isMobileView ? 1 : cols;

  const displayed = cells
    .filter(c => c.row <= rows && c.col <= cols)
    .sort((a, b) => (a.row - b.row) || (a.col - b.col));

  const gridStyle: React.CSSProperties = {
    columnGap: gapX,
    rowGap: gapY,
  };
  if (useResponsiveCss) {
    (gridStyle as any)['--grid-cols-md'] = `repeat(${cols}, 1fr)`;
  } else {
    gridStyle.gridTemplateColumns = `repeat(${effectiveCols}, 1fr)`;
  }

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
          useResponsiveCss
            ? 'grid grid-cols-1 md:[grid-template-columns:var(--grid-cols-md)]'
            : 'grid'
        }
        style={gridStyle}
      >
        {displayed.map((cell, idx) => {
          const isActive = activeSlotId === cell.id;
          const outlineClass = isActive
            ? 'outline outline-2 outline-blue-500 [background-color:color-mix(in_srgb,var(--theme-primary)_3%,transparent)] min-h-[40px]'
            : showCellGuides
              ? 'outline outline-1 outline-dashed outline-blue-300/60 min-h-[40px]'
              : '';

          // Click handler for the cell's structural area. Filled cells let the
          // nested SelectableBlock catch clicks on the block content; this fires
          // only when click lands directly on the cell wrapper (empty cell, or
          // the padding around the block).
          const handleSlotClick = editor && previewMode
            ? (e: React.MouseEvent) => {
                if (e.target !== e.currentTarget) return;
                e.stopPropagation();
                editor.setSelection({ kind: 'slots', containerId: containerBlockId, ids: [cell.id] });
              }
            : undefined;

          return (
          <div
            key={cell.id}
            onClick={handleSlotClick}
            style={cell.bgColor ? { backgroundColor: cell.bgColor } : undefined}
            className={`relative transition-[outline] duration-150 ${outlineClass} ${editor && previewMode ? 'cursor-pointer' : ''}`}
          >
            {cell.block ? (
              <SelectableBlock
                blockId={cell.block.id}
                blockType={cell.block.type}
                blockData={cell.block.data}
              >
                <BlockRenderer block={cell.block} previewMode={previewMode} {...passthroughProps} />
              </SelectableBlock>
            ) : showCellGuides ? (
              <span className="absolute top-1 right-1.5 text-[10px] font-mono text-blue-400/70 select-none pointer-events-none">
                {idx + 1}
              </span>
            ) : null}
          </div>
          );
        })}
      </div>
    </div>
  );
}
