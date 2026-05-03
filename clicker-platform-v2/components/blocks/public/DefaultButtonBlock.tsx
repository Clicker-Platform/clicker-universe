'use client';

import React from 'react';
import Link from 'next/link';
import { useTemplate } from '@/components/TemplateProvider';

export const DefaultButtonBlock = ({ data, previewMode }: { data: any; previewMode?: boolean }) => {
    const { theme } = useTemplate();
    const isClean = theme.cardStyle === 'clean';
    const isGlass = theme.cardStyle === 'glass';

    const alignClass = {
        left: 'text-left',
        center: 'text-center',
        right: 'text-right',
        full: 'text-center w-full'
    }[data.align as string] || 'text-center';

    const getVariantClass = () => {
        // Glass / MRB Styles
        if (isGlass) {
            switch (data.variant) {
                case 'secondary': return 'bg-white/10 border border-white/20 text-white hover:bg-white/20';
                case 'outline': return 'bg-transparent border border-white/30 text-white hover:border-[var(--theme-primary)] hover:text-[var(--theme-primary)]';
                default: return 'bg-[var(--theme-primary)] text-[var(--theme-background)] font-bold hover:opacity-90';
            }
        }
        // Sojourner / Clean Styles
        if (isClean) {
            switch (data.variant) {
                case 'secondary': return 'bg-white border-2 border-gray-200 text-gray-800 hover:border-[var(--theme-primary)] hover:text-[var(--theme-primary)]';
                case 'outline': return 'bg-transparent border-2 border-[var(--theme-foreground)] text-[var(--theme-foreground)] hover:bg-[var(--theme-foreground)] hover:text-[var(--theme-background)]';
                default: return 'bg-[var(--theme-foreground)] text-[var(--theme-background)] hover:bg-[var(--theme-primary)] hover:shadow-lg';
            }
        }
        // Classic / Brutalist Styles
        switch (data.variant) {
            case 'secondary': return 'bg-[var(--theme-primary)] text-[var(--theme-foreground)] hover:opacity-80';
            case 'outline': return 'bg-transparent border-[3px] border-[var(--theme-foreground)] text-[var(--theme-foreground)] hover:bg-[var(--theme-foreground)] hover:text-[var(--theme-background)]';
            default: return 'bg-[var(--theme-foreground)] text-[var(--theme-background)] hover:opacity-80';
        }
    };

    const className = `
        inline-block py-3 px-6 font-bold transition-all transform
        ${isClean ? 'shadow-sm hover:-translate-y-0.5' : isGlass ? 'hover:-translate-y-0.5 hover:shadow-lg' : 'hover:-translate-y-1 hover:shadow-lg'}
        ${getVariantClass()} ${data.align === 'full' ? 'w-full block' : ''}
    `;

    const buttonStyle = { borderRadius: 'calc(var(--theme-radius) * 0.75)' };

    return (
        <div className={`${data.align === 'full' ? '' : alignClass}`}>
            {previewMode ? (
                <span className={className} style={buttonStyle}>
                    {data.label || 'Click Here'}
                </span>
            ) : (
                <Link
                    href={data.url || '#'}
                    className={className}
                    style={buttonStyle}
                >
                    {data.label || 'Click Here'}
                </Link>
            )}
        </div>
    );
};
