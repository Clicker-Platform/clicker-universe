'use client';

import { BlockRenderer } from '../BlockRenderer';
import { useDeviceView } from '@/components/DeviceViewContext';
import type { ColumnSlot } from '@/components/admin/blocks/forms/container/types';
import { EmptyContainerPlaceholder } from '@/components/admin/blocks/forms/container/EmptyContainerPlaceholder';

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
  passthroughProps?: Record<string, any>;
}

export function DefaultColumnsBlock({ data, previewMode, showGuides, passthroughProps = {} }: DefaultColumnsBlockProps) {
  const deviceView = useDeviceView();
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
        maxWidth: maxW,
        marginLeft: maxW ? 'auto' : undefined,
        marginRight: maxW ? 'auto' : undefined,
        padding,
      }}
    >
      <div
        className={flexClass}
        style={{
          gap,
          flexDirection: inlineFlexDirection,
        }}
      >
        {columns.map(col => (
          <div
            key={col.id}
            style={{
              flex: isStackedMobile
                ? '0 0 100%'
                : `0 0 ${(col.size / 12) * 100}%`,
              minWidth: 0,
            }}
            className={`flex flex-col ${showColumnGuides ? 'outline outline-1 outline-dashed outline-blue-300/60' : ''}`}
          >
            {col.blocks.map(block => (
              <BlockRenderer key={block.id} block={block} previewMode={previewMode} {...passthroughProps} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
