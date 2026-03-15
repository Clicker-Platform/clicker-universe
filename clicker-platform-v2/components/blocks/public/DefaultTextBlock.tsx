'use client';

import React from 'react';
import { useTemplate } from '@/components/TemplateProvider';

export const DefaultTextBlock = ({ data }: { data: any }) => {
    if (!data) return null;
    const { theme } = useTemplate();
    const cardStyle = theme.cardStyle || 'brutalist';

    const isClean = cardStyle === 'clean';
    const isGlass = cardStyle === 'glass';

    const cardClasses = isClean
        ? 'bg-white border border-gray-200 shadow-sm'
        : isGlass
        ? 'bg-white/5 backdrop-blur-md border border-white/10 shadow-xl'
        : 'bg-white border-[3px] border-theme-border shadow-sticker'; // brutalist

    const textClass = isGlass ? 'text-theme-foreground/90' : 'text-theme-foreground';

    const variant = data?.layoutVariant || 'prose';
    
    // Base prose classes
    const proseClasses = `prose prose-lg max-w-none font-medium ${textClass}
        prose-headings:font-heading prose-headings:text-[var(--theme-foreground)]
        prose-p:text-[var(--theme-foreground)] prose-p:font-body
        prose-strong:text-[var(--theme-foreground)]
        prose-ul:text-[var(--theme-foreground)] prose-ol:text-[var(--theme-foreground)]
        prose-a:text-[var(--theme-primary)]`;

    if (variant === 'two-column') {
        return (
            <section
                className={`p-6 md:p-10 ${cardClasses}`}
                style={{ borderRadius: 'var(--theme-radius)' }}
            >
                <div
                    className={`${proseClasses} md:columns-2 md:gap-8 lg:gap-12`}
                    dangerouslySetInnerHTML={{ __html: data?.content || '' }}
                />
            </section>
        );
    }

    if (variant === 'highlight-box') {
        return (
            <section className="py-12 px-4 md:px-8 max-w-5xl mx-auto">
                <div
                    className={`p-8 md:p-12 relative overflow-hidden ${cardClasses} border-l-8`}
                    style={{ 
                        borderRadius: 'var(--theme-radius)',
                        borderLeftColor: 'var(--theme-primary)'
                    }}
                >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--theme-primary)] opacity-5 rounded-bl-full transform translate-x-10 -translate-y-10" />
                    <div
                        className={`${proseClasses} relative z-10`}
                        dangerouslySetInnerHTML={{ __html: data?.content || '' }}
                    />
                </div>
            </section>
        );
    }

    // Default: 'prose'
    return (
        <section
            className={`p-6 md:p-10 ${isGlass ? '' : 'max-w-4xl mx-auto'} ${cardClasses}`}
            style={{ borderRadius: 'var(--theme-radius)' }}
        >
            <div
                className={proseClasses}
                dangerouslySetInnerHTML={{ __html: data?.content || '' }}
            />
        </section>
    );
};
