'use client';

import React from 'react';
import { useTemplate } from '@/components/TemplateProvider';

export const TextBlock = ({ data }: { data: any }) => {
    if (!data) return null;
    const { templateId, theme } = useTemplate();
    const isClean = theme.cardStyle === 'clean';

    // Debugging: Check what HTML is actually being received
    // console.log('[TextBlock Debug] Content:', data.content);

    return (
        <section className={`
            bg-white p-6 md:p-8
            ${isClean
                ? 'border border-gray-200 shadow-sm'
                : 'border-[3px] border-theme-border shadow-sticker'
            }
        `} style={{
                borderRadius: 'var(--theme-radius)',
                ['--font-heading' as any]: 'var(--font-heading, inherit)',
                ['--font-body' as any]: 'var(--font-body, inherit)',
                ['--theme-foreground' as any]: 'var(--theme-foreground, #111827)',
                ['--theme-primary' as any]: 'var(--theme-primary, #0E3B2E)',
            }}>
            <div
                className={`
                    prose prose-lg max-w-none font-medium
                    
                    prose-headings:font-heading prose-headings:text-[var(--theme-foreground)]
                    prose-p:text-[var(--theme-foreground)] prose-p:font-body
                    prose-strong:text-[var(--theme-foreground)]
                    prose-ul:text-[var(--theme-foreground)] prose-ol:text-[var(--theme-foreground)]
                    prose-quote:text-[var(--theme-foreground)] prose-quote:border-l-[var(--theme-primary)]
                    
                    prose-a:text-[var(--theme-primary)]
                    
                `}
                dangerouslySetInnerHTML={{ __html: data?.content || '' }}
            />
        </section>
    );
};
