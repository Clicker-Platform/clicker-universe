'use client';

import React from 'react';
import { useTemplate } from '@/components/TemplateProvider';
import { useDeviceView, dv } from '@/components/DeviceViewContext';
import { getCardClasses } from './cardStyles';

export const DefaultTextBlock = ({ data }: { data: any }) => {
    if (!data) return null;
    const { theme } = useTemplate();
    const d = useDeviceView();
    const cardStyle = theme.cardStyle || 'brutalist';

    const isGlass = cardStyle === 'glass';

    const cardClasses = getCardClasses(cardStyle);

    const textClass = isGlass ? 'text-theme-foreground/90' : 'text-theme-foreground';

    const variant = data?.layoutVariant || 'prose';
    
    // Custom Prose & Typography configuration
    const proseClasses = `prose max-w-none font-medium ${textClass}
        ${dv(d, 'text-[15px] leading-[1.65]', 'sm:text-[16px] md:text-[18px] md:leading-[1.75]')}
        prose-headings:font-heading prose-headings:text-[var(--theme-foreground)] 
        prose-headings:mt-8 prose-headings:mb-4
        prose-p:text-[var(--theme-foreground)] prose-p:font-body prose-p:my-3
        prose-strong:text-[var(--theme-foreground)]
        prose-ul:text-[var(--theme-foreground)] prose-ol:text-[var(--theme-foreground)]
        prose-ul:my-4 prose-ol:my-4 prose-li:my-1.5 prose-li:leading-snug
        prose-a:text-[var(--theme-primary)]`;

    if (variant === 'two-column') {
        return (
            <section
                className={`${dv(d, 'p-6', 'md:p-10')} ${cardClasses}`}
                style={{ borderRadius: 'var(--theme-radius)' }}
                suppressHydrationWarning
            >
                <div
                    className={`${proseClasses} ${dv(d, '', 'md:columns-2 md:gap-8 lg:gap-12')}`}
                    dangerouslySetInnerHTML={{ __html: data?.content || '' }}
                    suppressHydrationWarning
                />
            </section>
        );
    }

    if (variant === 'highlight-box') {
        return (
            <section className={`py-12 ${dv(d, 'px-4', 'md:px-8')} max-w-5xl mx-auto`} suppressHydrationWarning>
                <div
                    className={`${dv(d, 'p-8', 'md:p-12')} relative overflow-hidden ${cardClasses} border-l-8`}
                    style={{
                        borderRadius: 'var(--theme-radius)',
                        borderLeftColor: 'var(--theme-primary)'
                    }}
                    suppressHydrationWarning
                >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--theme-primary)] opacity-5 rounded-bl-full transform translate-x-10 -translate-y-10" />
                    <div
                        className={`${proseClasses} relative z-10`}
                        dangerouslySetInnerHTML={{ __html: data?.content || '' }}
                        suppressHydrationWarning
                    />
                </div>
            </section>
        );
    }

    // Default: 'prose'
    return (
        <section
            className={`${dv(d, 'p-6', 'md:p-10')} ${cardClasses}`}
            style={{ borderRadius: 'var(--theme-radius)' }}
            suppressHydrationWarning
        >
            <div
                className={proseClasses}
                dangerouslySetInnerHTML={{ __html: data?.content || '' }}
                suppressHydrationWarning
            />
        </section>
    );
};
