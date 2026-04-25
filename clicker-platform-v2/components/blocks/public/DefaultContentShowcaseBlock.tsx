'use client';

import React, { useMemo } from 'react';
import { useDeviceView, dv } from '@/components/DeviceViewContext';
import { sanitizeRichText } from '@/lib/sanitizeHtml';
import {
    ContentShowcaseData,
    DEFAULT_SHOWCASE_DATA,
    ShowcaseRow,
    MAX_WIDTH_CLASS,
    ROW_GAP_CLASS,
    VERTICAL_ALIGN_CLASS,
} from '@/components/blocks/content-showcase/types';
import { MediaView } from './MediaView';

function normalize(data: unknown): ContentShowcaseData {
    const d = (data as Partial<ContentShowcaseData>) || {};
    return {
        ...DEFAULT_SHOWCASE_DATA,
        ...d,
        rowBackgrounds: { ...DEFAULT_SHOWCASE_DATA.rowBackgrounds, ...(d.rowBackgrounds || {}) },
        rows: Array.isArray(d.rows) ? d.rows : [],
    };
}

function resolveRowLayout(row: ShowcaseRow, rowIndex: number, defaultLayout: ContentShowcaseData['defaultLayout']): 'image-left' | 'image-right' {
    if (row.layout === 'image-left') return 'image-left';
    if (row.layout === 'image-right') return 'image-right';
    // inherit
    if (defaultLayout === 'image-left') return 'image-left';
    if (defaultLayout === 'image-right') return 'image-right';
    // alternate: even-index (0,2,4) = image-left, odd = image-right
    return rowIndex % 2 === 0 ? 'image-left' : 'image-right';
}

function ctaClasses(variant: string): string {
    switch (variant) {
        case 'primary':
            return 'inline-flex items-center gap-1.5 px-5 py-2.5 bg-[var(--theme-primary)] text-white font-bold rounded-lg hover:opacity-90 transition-opacity';
        case 'secondary':
            return 'inline-flex items-center gap-1.5 px-5 py-2.5 bg-[var(--theme-foreground)] text-[var(--theme-background)] font-bold rounded-lg hover:opacity-90 transition-opacity';
        case 'ghost':
            return 'inline-flex items-center gap-1.5 px-5 py-2.5 border-2 border-[var(--theme-primary)] text-[var(--theme-primary)] font-bold rounded-lg hover:bg-[var(--theme-primary)]/10 transition-colors';
        case 'link':
            return 'inline-flex items-center gap-1.5 text-[var(--theme-primary)] font-bold underline-offset-4 hover:underline';
        default:
            return '';
    }
}

export const DefaultContentShowcaseBlock = ({ data }: { data: unknown }) => {
    const d = useDeviceView();
    const showcase = useMemo(() => normalize(data), [data]);

    if (showcase.rows.length === 0) return null;

    const maxWidthClass = MAX_WIDTH_CLASS[showcase.maxWidth] || MAX_WIDTH_CLASS.lg;
    const rowGapClass = ROW_GAP_CLASS[showcase.rowGap] || ROW_GAP_CLASS.lg;
    const verticalAlignClass = VERTICAL_ALIGN_CLASS[showcase.verticalAlign] || VERTICAL_ALIGN_CLASS.center;

    return (
        <section className={`w-full ${dv(d, 'py-6', 'md:py-10')}`}>
            <div className={`mx-auto ${maxWidthClass} flex flex-col ${rowGapClass}`}>
                {showcase.rows.map((row, i) => (
                    <ShowcaseRowView
                        key={row.id}
                        row={row}
                        index={i}
                        showcase={showcase}
                        verticalAlignClass={verticalAlignClass}
                    />
                ))}
            </div>
        </section>
    );
};

function ShowcaseRowView({
    row,
    index,
    showcase,
    verticalAlignClass,
}: {
    row: ShowcaseRow;
    index: number;
    showcase: ContentShowcaseData;
    verticalAlignClass: string;
}) {
    const d = useDeviceView();
    const layout = resolveRowLayout(row, index, showcase.defaultLayout);
    const isLeft = layout === 'image-left';
    const mediaWidth = Math.max(25, Math.min(75, row.mediaColumnWidth ?? showcase.mediaColumnWidth));
    const contentWidth = 100 - mediaWidth;

    const bgEnabled = showcase.rowBackgrounds.enabled;
    const isEven = index % 2 === 1;
    const bgColor = bgEnabled ? (isEven ? showcase.rowBackgrounds.evenColor : showcase.rowBackgrounds.oddColor) : undefined;

    const safeContent = sanitizeRichText(row.content);
    const isMobile = d === 'mobile';
    const mediaWidthPct = isMobile ? '100%' : `${mediaWidth}%`;
    const contentWidthPct = isMobile ? '100%' : `${contentWidth}%`;

    const mediaNode = (
        <div style={{ width: mediaWidthPct, order: isMobile ? 0 : isLeft ? 0 : 1 }}>
            <MediaView media={row.media} className="rounded-lg" />
        </div>
    );

    const contentNode = (
        <div className="space-y-4" style={{ width: contentWidthPct, order: isMobile ? 1 : isLeft ? 1 : 0 }}>
            <h3 className="text-2xl md:text-3xl font-black font-heading text-[var(--theme-foreground)] leading-tight">
                {row.heading.text}
            </h3>
            <div
                className="prose dark:prose-invert max-w-none prose-p:text-[var(--theme-foreground)]/80 prose-headings:text-[var(--theme-foreground)] prose-strong:text-[var(--theme-foreground)] prose-a:text-[var(--theme-primary)]"
                dangerouslySetInnerHTML={{ __html: safeContent }}
            />
            {row.cta?.enabled && row.cta.label && (
                <a href={row.cta.href || '#'} className={ctaClasses(row.cta.variant)}>
                    {row.cta.label}
                </a>
            )}
        </div>
    );

    return (
        <div
            className={`${dv(d, 'px-4 py-6', 'md:px-8 md:py-10')} rounded-xl`}
            style={bgColor ? { background: bgColor } : undefined}
        >
            <div
                className={`flex ${verticalAlignClass}`}
                style={{
                    flexDirection: isMobile ? 'column' : 'row',
                    gap: isMobile ? '1.5rem' : '2.5rem',
                }}
            >
                {mediaNode}
                {contentNode}
            </div>
        </div>
    );
};
