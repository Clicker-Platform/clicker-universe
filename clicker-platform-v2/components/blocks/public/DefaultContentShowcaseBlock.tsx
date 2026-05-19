'use client';

import React, { useMemo } from 'react';
import { useDeviceView, dv, type DeviceView } from '@/components/DeviceViewContext';
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
import { useTemplate } from '@/components/TemplateProvider';
import { getHeadingColor } from './cardStyles';
import { H2, BUTTON_TEXT } from './typography';
import { getProseClass } from './proseConfig';

function normalizeRow(row: Partial<ShowcaseRow>, i: number): ShowcaseRow {
    const base: ShowcaseRow = {
        id: row.id ?? `row-${i}`,
        media: row.media ?? { type: 'image', src: '', aspectRatio: '16:9', objectFit: 'cover' },
        heading: { text: row.heading?.text ?? '' },
        content: row.content ?? '',
        layout: row.layout ?? 'inherit',
    };
    if (row.mediaColumnWidth !== undefined) base.mediaColumnWidth = row.mediaColumnWidth;
    if (row.cta !== undefined) base.cta = row.cta;
    return base;
}

function normalize(data: unknown): ContentShowcaseData {
    const d = (data as Partial<ContentShowcaseData>) || {};
    const rawRows = Array.isArray(d.rows) ? d.rows : [];
    return {
        ...DEFAULT_SHOWCASE_DATA,
        ...d,
        rowBackgrounds: { ...DEFAULT_SHOWCASE_DATA.rowBackgrounds, ...(d.rowBackgrounds || {}) },
        rows: rawRows.map((r, i) => normalizeRow(r as Partial<ShowcaseRow>, i)),
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

function ctaProps(variant: string, primaryContrastColor: string, deviceView: DeviceView): { className: string; style: React.CSSProperties } {
    const base = `inline-flex items-center gap-1.5 ${BUTTON_TEXT(deviceView)} transition-opacity hover:opacity-90`;
    const padded = `${base} px-5 py-2.5`;
    const radiusSm = 'calc(var(--theme-radius) * 0.6)';

    switch (variant) {
        case 'primary':
            return {
                className: padded,
                style: {
                    backgroundColor: 'var(--theme-primary)',
                    color: primaryContrastColor,
                    borderRadius: radiusSm,
                },
            };
        case 'secondary':
            return {
                className: padded,
                style: {
                    backgroundColor: 'var(--theme-foreground)',
                    color: 'var(--theme-background)',
                    borderRadius: radiusSm,
                },
            };
        case 'ghost':
            return {
                className: `${padded} border-2 hover:bg-[var(--theme-primary)]/10 transition-colors`,
                style: {
                    borderColor: 'var(--theme-primary)',
                    color: 'var(--theme-primary)',
                    borderRadius: radiusSm,
                },
            };
        case 'link':
            return {
                className: `${base} underline-offset-4 hover:underline`,
                style: { color: 'var(--theme-primary)' },
            };
        default:
            return { className: '', style: {} };
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
    const { theme } = useTemplate();
    const layout = resolveRowLayout(row, index, showcase.defaultLayout);
    const isLeft = layout === 'image-left';

    // Contrast color for text/icons on top of theme.primary (CTA primary variant).
    const primaryContrastColor =
        theme.colors.accentForeground ??
        (theme.colors.accent && theme.colors.accent !== theme.colors.primary ? theme.colors.accent : undefined) ??
        theme.colors.background ??
        '#ffffff';
    const mediaWidth = Math.max(25, Math.min(75, row.mediaColumnWidth ?? showcase.mediaColumnWidth));
    const contentWidth = 100 - mediaWidth;

    const bgEnabled = showcase.rowBackgrounds.enabled;
    const isEven = index % 2 === 0;
    const bgColor = bgEnabled ? (isEven ? showcase.rowBackgrounds.evenColor : showcase.rowBackgrounds.oddColor) : undefined;

    const safeContent = sanitizeRichText(row.content);
    const isPreviewMobile = d === 'mobile';

    // In canvas preview use JS-driven widths; in real browser let CSS handle it via flex-basis.
    // Tablet preview ('desktop' bucket) and real desktop use isLeft order; mobile preview always image-first.
    const isPreviewDesktop = d === 'desktop';
    const mediaStyle: React.CSSProperties = isPreviewMobile
        ? { width: '100%' }
        : isPreviewDesktop
            ? { flexBasis: `${mediaWidth}%`, flexShrink: 0, order: isLeft ? 0 : 1 }
            : { flexBasis: `${mediaWidth}%`, flexShrink: 0 };
    const contentStyle: React.CSSProperties = isPreviewMobile
        ? { width: '100%' }
        : isPreviewDesktop
            ? { flexBasis: `${contentWidth}%`, minWidth: 0, order: isLeft ? 1 : 0 }
            : { flexBasis: `${contentWidth}%`, minWidth: 0 };
    // Real browser: order only kicks in at md: (flex-row), so mobile flex-col always stacks media-first.
    const mediaOrderClass = isLeft ? 'md:order-1' : 'md:order-2';
    const contentOrderClass = isLeft ? 'md:order-2' : 'md:order-1';

    const mediaNode = (
        <div className={mediaOrderClass} style={mediaStyle}>
            <MediaView media={row.media} className="[border-radius:var(--theme-radius)]" priority={priority} />
        </div>
    );

    const contentNode = (
        <div className={`space-y-4 ${contentOrderClass}`} style={contentStyle}>
            <h3 className={H2(d)} style={{ color: getHeadingColor(theme.cardStyle, theme) }}>
                {row.heading.text}
            </h3>
            <div
                className={getProseClass(theme.cardStyle)}
                // safeContent is sanitized via sanitizeRichText() above
                dangerouslySetInnerHTML={{ __html: safeContent }}
            />
            {row.cta?.enabled && row.cta.label && (() => {
                const href = isSafeHref(row.cta.href) ? row.cta.href : '#';
                const isExternal = /^https?:\/\//i.test(href);
                const cta = ctaProps(row.cta.variant, primaryContrastColor, d);
                return (
                    <a
                        href={href}
                        className={cta.className}
                        style={cta.style}
                        target={isExternal ? '_blank' : undefined}
                        rel={isExternal ? 'noopener noreferrer' : undefined}
                    >
                        {row.cta.label}
                    </a>
                );
            })()}
        </div>
    );

    return (
        <div
            className={`${dv(d, 'py-6', 'md:py-10')} ${bgColor ? dv(d, 'px-5', 'md:px-8') : ''}`}
            style={{
                ...(bgColor ? { background: bgColor } : {}),
                borderRadius: 'var(--theme-radius)',
            }}
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
