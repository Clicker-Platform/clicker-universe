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

function isSafeHref(href: string | undefined | null): boolean {
    if (!href) return false;
    return /^(https?:\/\/|\/|#|mailto:|tel:)/i.test(href);
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

export const DefaultContentShowcaseBlock = ({ data, isFirst = false }: { data: unknown; isFirst?: boolean }) => {
    const d = useDeviceView();
    const showcase = useMemo(() => normalize(data), [data]);

    if (showcase.rows.length === 0) return null;

    const maxWidthClass = MAX_WIDTH_CLASS[showcase.maxWidth] || MAX_WIDTH_CLASS.lg;
    const rowGapClass = ROW_GAP_CLASS[showcase.rowGap] || ROW_GAP_CLASS.lg;
    const verticalAlignClass = VERTICAL_ALIGN_CLASS[showcase.verticalAlign] || VERTICAL_ALIGN_CLASS.center;

    return (
        <section className={`w-full ${dv(d, 'py-6 px-4', 'md:py-10 md:px-8')}`}>
            <div className={`mx-auto ${maxWidthClass} flex flex-col ${rowGapClass}`}>
                {showcase.rows.map((row, i) => (
                    <ShowcaseRowView
                        key={row.id}
                        row={row}
                        index={i}
                        showcase={showcase}
                        verticalAlignClass={verticalAlignClass}
                        priority={isFirst && i === 0}
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
    priority = false,
}: {
    row: ShowcaseRow;
    index: number;
    showcase: ContentShowcaseData;
    verticalAlignClass: string;
    priority?: boolean;
}) {
    const d = useDeviceView();
    const layout = resolveRowLayout(row, index, showcase.defaultLayout);
    const isLeft = layout === 'image-left';
    const mediaWidth = Math.max(25, Math.min(75, row.mediaColumnWidth ?? showcase.mediaColumnWidth));
    const contentWidth = 100 - mediaWidth;

    const bgEnabled = showcase.rowBackgrounds.enabled;
    const isEven = index % 2 === 0;
    const bgColor = bgEnabled ? (isEven ? showcase.rowBackgrounds.evenColor : showcase.rowBackgrounds.oddColor) : undefined;

    const safeContent = sanitizeRichText(row.content);
    const isPreviewMobile = d === 'mobile';

    // In canvas preview use JS-driven widths; in real browser let CSS handle it via flex-basis
    const mediaStyle: React.CSSProperties = isPreviewMobile
        ? { width: '100%', order: 0 }
        : { flexBasis: `${mediaWidth}%`, flexShrink: 0, order: isLeft ? 0 : 1 };
    const contentStyle: React.CSSProperties = isPreviewMobile
        ? { width: '100%', order: 1 }
        : { flexBasis: `${contentWidth}%`, minWidth: 0, order: isLeft ? 1 : 0 };

    const mediaNode = (
        <div style={mediaStyle}>
            <MediaView media={row.media} className="rounded-lg" priority={priority} />
        </div>
    );

    const contentNode = (
        <div className="space-y-4" style={contentStyle}>
            <h3 className="text-2xl md:text-3xl font-black font-heading text-[var(--theme-foreground)] leading-tight">
                {row.heading.text}
            </h3>
            <div
                className="prose dark:prose-invert max-w-none prose-p:text-[var(--theme-foreground)]/80 prose-headings:text-[var(--theme-foreground)] prose-strong:text-[var(--theme-foreground)] prose-a:text-[var(--theme-primary)]"
                dangerouslySetInnerHTML={{ __html: safeContent }}
            />
            {row.cta?.enabled && row.cta.label && (
                <a href={isSafeHref(row.cta.href) ? row.cta.href : '#'} className={ctaClasses(row.cta.variant)}>
                    {row.cta.label}
                </a>
            )}
        </div>
    );

    return (
        <div
            className={`${dv(d, 'py-6', 'md:py-10')} rounded-xl`}
            style={bgColor ? { background: bgColor } : undefined}
        >
            <div
                className={`flex flex-col md:flex-row ${verticalAlignClass}`}
                style={{ flexDirection: isPreviewMobile ? 'column' : undefined, gap: isPreviewMobile ? '1.5rem' : '2.5rem' }}
            >
                {mediaNode}
                {contentNode}
            </div>
        </div>
    );
};
