'use client';

import { useMemo } from 'react';
import { useTemplate } from '@/components/TemplateProvider';
import { useDeviceView, dv } from '@/components/DeviceViewContext';
import { sanitizeRichText } from '@/lib/sanitizeHtml';
import { getProseClass } from './proseConfig';

const VERTICAL_SPACING = {
    none:   'py-0',
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
    const variant = data?.layoutVariant || 'prose';

    const verticalClass = VERTICAL_SPACING[(data.verticalSpacing || 'medium') as keyof typeof VERTICAL_SPACING] ?? 'py-8';
    const horizontalClass = HORIZONTAL_PADDING[(data.horizontalPadding || 'none') as keyof typeof HORIZONTAL_PADDING] ?? 'px-0';

    const proseClasses = getProseClass(cardStyle);

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
