'use client';

import { useMemo } from 'react';
import { useTemplate } from '@/components/TemplateProvider';
import { useDeviceView, dv } from '@/components/DeviceViewContext';
import { sanitizeRichText } from '@/lib/sanitizeHtml';

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

export const DefaultTextBlock = ({ data }: { data: { content?: string; layoutVariant?: string; verticalSpacing?: string; horizontalPadding?: string } | null | undefined }) => {
    const { theme } = useTemplate();
    const d = useDeviceView();
    const safeHtml = useMemo(() => sanitizeRichText(data?.content), [data?.content]);

    if (!data) return null;

    const cardStyle = theme.cardStyle || 'brutalist';
    const isGlass = cardStyle === 'glass';
    const isClean = cardStyle === 'clean';
    const isBrutalist = !isGlass && !isClean;
    const textClass = isGlass ? 'text-theme-foreground/90' : 'text-theme-foreground';
    const variant = data?.layoutVariant || 'prose';

    const verticalClass = VERTICAL_SPACING[(data.verticalSpacing || 'medium') as keyof typeof VERTICAL_SPACING] ?? 'py-8';
    const horizontalClass = HORIZONTAL_PADDING[(data.horizontalPadding || 'none') as keyof typeof HORIZONTAL_PADDING] ?? 'px-0';

    const proseClasses = `prose max-w-none font-medium ${textClass}
        ${dv(d, 'text-[15px] leading-[1.65]', 'sm:text-[16px] md:text-[18px] md:leading-[1.75]')}
        prose-headings:font-heading prose-headings:text-[var(--theme-foreground)]
        prose-headings:mt-8 prose-headings:mb-4
        prose-p:text-[var(--theme-foreground)] prose-p:font-body prose-p:my-3
        prose-strong:text-[var(--theme-foreground)]
        prose-ul:text-[var(--theme-foreground)] prose-ol:text-[var(--theme-foreground)]
        prose-ul:my-4 prose-ol:my-4 prose-li:my-1.5 prose-li:leading-snug
        prose-a:text-[var(--theme-primary)]
        prose-blockquote:text-[var(--theme-foreground)] prose-blockquote:border-l-[var(--theme-primary)]
        ${isBrutalist ? 'prose-invert' : ''}`;

    if (variant === 'two-column') {
        return (
            <section className={`${verticalClass} ${horizontalClass}`} suppressHydrationWarning>
                <div
                    className={`${proseClasses} ${dv(d, '', 'md:columns-2 md:gap-8 lg:gap-12')}`}
                    dangerouslySetInnerHTML={{ __html: safeHtml }}
                    suppressHydrationWarning
                />
            </section>
        );
    }

    if (variant === 'highlight-box') {
        return (
            <section className={`${verticalClass} ${horizontalClass} max-w-5xl mx-auto`} suppressHydrationWarning>
                <div
                    className="relative overflow-hidden border-l-8 p-8 md:p-12"
                    style={{ borderRadius: 'var(--theme-radius)', borderLeftColor: 'var(--theme-primary)' }}
                    suppressHydrationWarning
                >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--theme-primary)] opacity-5 rounded-bl-full transform translate-x-10 -translate-y-10" />
                    <div
                        className={`${proseClasses} relative z-10`}
                        dangerouslySetInnerHTML={{ __html: safeHtml }}
                        suppressHydrationWarning
                    />
                </div>
            </section>
        );
    }

    return (
        <section className={`${verticalClass} ${horizontalClass}`} suppressHydrationWarning>
            <div
                className={proseClasses}
                dangerouslySetInnerHTML={{ __html: safeHtml }}
                suppressHydrationWarning
            />
        </section>
    );
};
