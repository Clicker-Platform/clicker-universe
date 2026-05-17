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
  containerBlockId: string;
  previewMode?: boolean;
  showGuides?: boolean;
  passthroughProps?: Record<string, any>;
}

export function DefaultColumnsBlock({ data, containerBlockId, previewMode, showGuides, passthroughProps = {} }: DefaultColumnsBlockProps) {
  const deviceView = useDeviceView();
  // Context-safe: undefined on public site where no EditorProvider is mounted.
  const editor = useContext(EditorContext);
  const columns: ColumnSlot[] = Array.isArray(data?.columns) ? data.columns : [];
  const {
    gap = 16,         // horizontal gap between columns
    blockGap = 16,    // vertical gap between stacked blocks inside each column
    padding = 16,
    stackOnMobile = true,
    maxWidth = 'full',
  } = data || {};

  const showColumnGuides = !!(previewMode && showGuides);

  // Active slot for this container, derived from selection.
  // Single direction: canvas reads selection → highlights matching slot.
  // No setState here, no useEffect, pure derivation.
  const activeSlotId: string | null = editor && previewMode
    && editor.selection.kind === 'slots'
    && editor.selection.containerId === containerBlockId
    && editor.selection.ids.length === 1
    ? editor.selection.ids[0]
    : null;

  if (columns.length === 0) {
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
          // (sum of basis + (N-1)*gap) stays within 100%.
          const N = columns.length;
          const gapDeduction = N > 1 ? `${((N - 1) * gap) / N}px` : '0px';
          const flexBasis = isStackedMobile
            ? '100%'
            : `calc(${(col.size / 12) * 100}% - ${gapDeduction})`;
          const isActive = activeSlotId === col.id;
          const outlineClass = isActive
            ? 'outline outline-2 outline-blue-500 [background-color:color-mix(in_srgb,var(--theme-primary)_3%,transparent)]'
            : showColumnGuides
              ? 'outline outline-1 outline-dashed outline-blue-300/60'
              : '';

          // Click handler for empty area inside the column slot. Only fires when
          // the click target is THIS div (not a nested block bubbling up). Atomic
          // write to selection: { kind: 'slots', containerId, ids: [col.id] }.
          const handleSlotClick = editor && previewMode
            ? (e: React.MouseEvent) => {
                if (e.target !== e.currentTarget) return;
                e.stopPropagation();
                editor.setSelection({ kind: 'slots', containerId: containerBlockId, ids: [col.id] });
              }
            : undefined;

          // Vertical alignment of stacked children within this column.
          // Column is `flex flex-col`, so the vertical axis = main axis,
          // which is controlled by justifyContent (not alignItems).
          // undefined or 'stretch' = unset (default; children stack from top
          // and the column grows to fit content — visually identical to current).
          const justifyContent =
            col.verticalAlign === 'top' ? 'flex-start' :
            col.verticalAlign === 'center' ? 'center' :
            col.verticalAlign === 'bottom' ? 'flex-end' :
            undefined;

          return (
          <div
            key={col.id}
            onClick={handleSlotClick}
            style={{
              flex: `0 0 ${flexBasis}`,
              minWidth: 0,
              boxSizing: 'border-box',
              minHeight: col.blocks.length === 0 ? 60 : undefined,
              gap: blockGap,
              justifyContent,
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
