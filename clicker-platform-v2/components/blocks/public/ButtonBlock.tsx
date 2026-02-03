'use client';

import React from 'react';
import Link from 'next/link';
import { useTemplate } from '@/components/TemplateProvider';

export const ButtonBlock = ({ data }: { data: any }) => {
    const { templateId, theme } = useTemplate();
    const isClean = theme.cardStyle === 'clean';

    const alignClass = {
        left: 'text-left',
        center: 'text-center',
        right: 'text-right',
        full: 'text-center w-full'
    }[data.align as string] || 'text-center';

    const getVariantClass = () => {
        // Sojourner Styles
        if (isClean) {
            switch (data.variant) {
                case 'secondary': return 'bg-white border-2 border-gray-200 text-gray-800 hover:border-theme-primary hover:text-theme-primary';
                case 'outline': return 'bg-transparent border-2 border-gray-300 text-gray-700 hover:border-theme-foreground hover:text-theme-foreground';
                default: return 'bg-theme-foreground text-theme-background hover:bg-theme-primary hover:shadow-lg'; // Primary
            }
        }
        // Classic Styles
        switch (data.variant) {
            case 'secondary': return 'bg-theme-primary text-theme-foreground hover:bg-theme-primary/80';
            case 'outline': return 'bg-transparent border-[3px] border-theme-foreground text-theme-foreground hover:bg-theme-foreground hover:text-theme-background';
            default: return 'bg-theme-foreground text-theme-background hover:bg-black'; // Primary
        }
    };

    return (
        <div className={`${data.align === 'full' ? '' : alignClass}`}>
            <Link
                href={data.url || '#'}
                className={`
                    inline-block py-3 px-6 font-bold transition-all transform 
                    ${isClean ? 'shadow-sm hover:-translate-y-0.5' : 'hover:-translate-y-1 hover:shadow-lg'}
                    ${getVariantClass()} ${data.align === 'full' ? 'w-full block' : ''}
                `}
                style={{ borderRadius: 'calc(var(--theme-radius) * 0.75)' }}
            >
                {data.label || 'Click Here'}
            </Link>
        </div>
    );
};
