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
  previewMode?: boolean;
  showGuides?: boolean;
  activeContainerSlotId?: string | null;
  passthroughProps?: Record<string, any>;
}

export function DefaultGridBlock({ data, previewMode, showGuides, activeContainerSlotId, passthroughProps = {} }: DefaultGridBlockProps) {
  const deviceView = useDeviceView();
  // Context-safe: returns undefined on public site. Used to switch active cell tab
  // on empty-cell clicks (admin canvas only).
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

  const filledCount = cells.filter(c => c.block).length;
  // When guides are on, still render the grid skeleton so the user can see structure.
  // When guides are off and no cells have blocks, show the empty-state placeholder.
  if (filledCount === 0 && !showCellGuides) {
    return previewMode ? <EmptyContainerPlaceholder type="grid" /> : null;
  }

  const maxW = MAX_WIDTH_PX[maxWidth];

  // Mobile collapse needs different strategies per deviceView:
  // - 'responsive' (real public site): use real CSS @media via a CSS variable so md: kicks in
  // - 'mobile' (canvas preview): force 1 column inline
  // - 'tablet' / 'desktop' (canvas preview): force `cols` inline
  const useResponsiveCss = deviceView === 'responsive' && stackOnMobile;
  const isMobileView = deviceView === 'mobile';
  const effectiveCols = stackOnMobile && isMobileView ? 1 : cols;

  // Render only cells within current bounds. Sort row-major so CSS grid flow matches
  // the user's intent regardless of insertion order in the cells array.
  const displayed = cells
    .filter(c => c.row <= rows && c.col <= cols)
    .sort((a, b) => (a.row - b.row) || (a.col - b.col));

  // For responsive (real site), use Tailwind's arbitrary-value syntax so the column
  // count comes from a CSS variable — keeps it static-class-safe for JIT compilation.
  // For explicit preview modes, set the template inline.
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
          const isActive = !!(previewMode && activeContainerSlotId === cell.id);
          const outlineClass = isActive
            ? 'outline outline-2 outline-blue-500 [background-color:color-mix(in_srgb,var(--theme-primary)_3%,transparent)] min-h-[40px]'
            : showCellGuides
              ? 'outline outline-1 outline-dashed outline-blue-300/60 min-h-[40px]'
              : '';
          // In admin canvas, clicking the cell's structural area (not the nested
          // block) switches the active tab to this cell. The nested block's own
          // SelectableBlock catches clicks on the block content and stops propagation.
          const handleCellClick = editor && previewMode
            ? (e: React.MouseEvent) => {
                if (e.target !== e.currentTarget) return; // nested block handled it
                e.stopPropagation();
                editor.setActiveContainerSlotId(cell.id);
                editor.setSelectedBlockId(null);
              }
            : undefined;
          return (
          <div
            key={cell.id}
            onClick={handleCellClick}
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
