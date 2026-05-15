'use client';

import { useContext } from 'react';
import { BlockRenderer } from '../BlockRenderer';
import { useDeviceView } from '@/components/DeviceViewContext';
import type { ColumnSlot } from '@/components/admin/blocks/forms/container/types';
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

interface DefaultColumnsBlockProps {
  data: any;
  previewMode?: boolean;
  showGuides?: boolean;
  activeContainerSlotId?: string | null;
  passthroughProps?: Record<string, any>;
}

export function DefaultColumnsBlock({ data, previewMode, showGuides, activeContainerSlotId, passthroughProps = {} }: DefaultColumnsBlockProps) {
  const deviceView = useDeviceView();
  // Context-safe: returns undefined on public site where no EditorProvider is mounted.
  // Used to switch active column tab on slot-area clicks (admin canvas only).
  const editor = useContext(EditorContext);
  const columns: ColumnSlot[] = Array.isArray(data?.columns) ? data.columns : [];
  const {
    gap = 16,
    padding = 16,
    stackOnMobile = true,
    maxWidth = 'full',
  } = data || {};

  const showColumnGuides = !!(previewMode && showGuides);

  const totalBlocks = columns.reduce((sum, c) => sum + c.blocks.length, 0);
  if (columns.length === 0 || totalBlocks === 0) {
    return previewMode ? <EmptyContainerPlaceholder type="columns" /> : null;
  }

  const maxW = MAX_WIDTH_PX[maxWidth];

  // Canvas preview ('mobile' | 'tablet' | 'desktop') sizes the container by inline
  // flexDirection (Tailwind's md: breakpoint can't be relied on inside a constrained
  // preview frame). Public site ('responsive') uses real CSS media queries.
  const isStackedMobile = stackOnMobile && deviceView === 'mobile';
  const useResponsiveClasses = deviceView === 'responsive' && stackOnMobile;

  const flexClass = useResponsiveClasses ? 'flex flex-col md:flex-row' : 'flex';
  const inlineFlexDirection = useResponsiveClasses
    ? undefined
    : isStackedMobile ? 'column' : 'row';

  return (
    <div
      style={{
        width: '100%',
        maxWidth: maxW,
        marginLeft: maxW ? 'auto' : undefined,
        marginRight: maxW ? 'auto' : undefined,
        padding,
        boxSizing: 'border-box',
      }}
    >
      <div
        className={flexClass}
        style={{
          gap,
          flexDirection: inlineFlexDirection,
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        {columns.map(col => {
          // Subtract this column's share of the inter-column gap so total width
          // (sum of basis + (N-1)*gap) stays within 100%. Each column "donates"
          // ((N-1)*gap / N) to make room. Skips when stacked (1-col layout has no
          // inter-column gap consuming horizontal width).
          const N = columns.length;
          const gapDeduction = N > 1 ? `${((N - 1) * gap) / N}px` : '0px';
          const flexBasis = isStackedMobile
            ? '100%'
            : `calc(${(col.size / 12) * 100}% - ${gapDeduction})`;
          const isActive = !!(previewMode && activeContainerSlotId === col.id);
          // Active column gets a stronger solid outline + faint tint to anchor the user's
          // attention. Inactive columns keep the existing dashed guide (when on).
          const outlineClass = isActive
            ? 'outline outline-2 outline-blue-500 [background-color:color-mix(in_srgb,var(--theme-primary)_3%,transparent)]'
            : showColumnGuides
              ? 'outline outline-1 outline-dashed outline-blue-300/60'
              : '';
          // In admin canvas (editor available + previewMode), clicking the column's
          // structural area (not a nested block) switches the active tab to this column.
          // Stops propagation so the page-root SelectableBlock doesn't catch it and
          // re-select the entire Columns container. Clears selectedBlockId so the form
          // panel shows the Columns properties (with this column's tab active), not a
          // drilled-in child form.
          const handleColumnClick = editor && previewMode
            ? (e: React.MouseEvent) => {
                if (e.target !== e.currentTarget) return; // a nested block handled it
                e.stopPropagation();
                editor.setActiveContainerSlotId(col.id);
                editor.setSelectedBlockId(null);
              }
            : undefined;
          return (
          <div
            key={col.id}
            onClick={handleColumnClick}
            style={{
              flex: `0 0 ${flexBasis}`,
              minWidth: 0,
              boxSizing: 'border-box',
            }}
            className={`flex flex-col transition-[outline] duration-150 ${outlineClass} ${editor && previewMode ? 'cursor-pointer' : ''}`}
          >
            {col.blocks.map(block => (
              <SelectableBlock
                key={block.id}
                blockId={block.id}
                blockType={block.type}
                blockData={block.data}
              >
                <BlockRenderer block={block} previewMode={previewMode} {...passthroughProps} />
              </SelectableBlock>
            ))}
          </div>
          );
        })}
      </div>
    </div>
  );
}
