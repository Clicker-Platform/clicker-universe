'use client';

import { EditableText } from '@/components/blocks/shared/EditablePrimitives';
import { H1, H2, H3, BODY } from './typography';

const ALIGN_CLASS = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
} as const;

// xl/lg/md map to H1/H2/H3 tiers. 'sm' kept for backwards compat → renders as H3.
const SIZE_CONFIG = {
    xl: { tag: 'h1' as const, className: H1 },
    lg: { tag: 'h2' as const, className: H2 },
    md: { tag: 'h3' as const, className: H3 },
    sm: { tag: 'h3' as const, className: H3 },
};

const VERTICAL_SPACING = {
    small:  'py-4',
    medium: 'py-8',
    tall:   'py-14',
} as const;

const HORIZONTAL_PADDING = {
    none:   'px-0',
    normal: 'px-4',
    wide:   'px-8',
} as const;

export function DefaultHeadingBlock({ data, onInlineChange, onFieldFocus, onFieldBlur }: {
    data: any;
    onInlineChange?: (field: string, value: string) => void;
    onFieldFocus?: (field: string, rect: DOMRect) => void;
    onFieldBlur?: () => void;
}) {
    if (!data) return null;

    const sizeKey = (data.headingSize || 'xl') as keyof typeof SIZE_CONFIG;
    const { tag: HeadingTag, className: sizeClass } = SIZE_CONFIG[sizeKey] ?? SIZE_CONFIG.xl;

    const headingAlignClass = ALIGN_CLASS[(data.headingAlign || 'left') as keyof typeof ALIGN_CLASS] ?? 'text-left';
    const subheadingAlignClass = ALIGN_CLASS[(data.subheadingAlign || 'left') as keyof typeof ALIGN_CLASS] ?? 'text-left';
    const verticalClass = VERTICAL_SPACING[(data.verticalSpacing || 'medium') as keyof typeof VERTICAL_SPACING] ?? 'py-8';
    const horizontalClass = HORIZONTAL_PADDING[(data.horizontalPadding || 'none') as keyof typeof HORIZONTAL_PADDING] ?? 'px-0';
    const hasSubheading = data.subheading !== null && data.subheading !== undefined;

    return (
        <section className={`w-full ${verticalClass} ${horizontalClass}`}>
            <EditableText
                tag={HeadingTag}
                field="heading"
                value={data.heading}
                placeholder="Your Headline"
                onInlineChange={onInlineChange}
                onFieldFocus={onFieldFocus}
                onFieldBlur={onFieldBlur}
                className={`${sizeClass} ${headingAlignClass} m-0`}
                style={{ color: 'var(--theme-foreground)' }}
            />
            {(hasSubheading || onInlineChange) && (
                <EditableText
                    tag="p"
                    field="subheading"
                    value={data.subheading ?? ''}
                    placeholder="Supporting text..."
                    onInlineChange={onInlineChange}
                    onFieldFocus={onFieldFocus}
                    onFieldBlur={onFieldBlur}
                    className={`${BODY} mt-2 opacity-65 ${subheadingAlignClass} m-0`}
                    style={{ color: 'var(--theme-foreground)' }}
                />
            )}
        </section>
    );
}
