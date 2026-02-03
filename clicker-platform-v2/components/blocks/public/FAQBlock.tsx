'use client';

import React from 'react';
import { ChevronDown } from 'lucide-react';
import { useTemplate } from '@/components/TemplateProvider';

export const FAQBlock = ({ data }: { data: any }) => {
    const { templateId, theme } = useTemplate();
    const isClean = theme.cardStyle === 'clean';

    return (
        <section className={`
            bg-white p-6
            ${isClean
                ? 'border border-gray-200 shadow-sm'
                : 'border-[3px] border-theme-border shadow-sticker'
            }
        `} style={{ borderRadius: 'var(--theme-radius)' }}>
            <h2 className={`text-2xl mb-6 ${isClean ? 'font-bold text-gray-900' : 'font-black text-theme-foreground'}`}>FAQ</h2>
            <div className="space-y-4">
                {data.items?.map((item: any, i: number) => (
                    <div key={i} className="border-b-2 border-gray-100 last:border-0 pb-4 last:pb-0">
                        <details className="group">
                            <summary className="flex justify-between items-center cursor-pointer list-none font-bold text-lg text-gray-800 hover:text-theme-foreground transition-colors">
                                <span className={isClean ? 'text-gray-800' : 'text-theme-foreground'}>{item.question}</span>
                                <span className="transition group-open:rotate-180">
                                    <ChevronDown size={20} className={isClean ? 'text-gray-400' : 'text-theme-foreground'} />
                                </span>
                            </summary>
                            <p className={`mt-2 font-medium leading-relaxed animate-in fade-in slide-in-from-top-1 ${isClean ? 'text-gray-500' : 'text-gray-600'}`}>
                                {item.answer}
                            </p>
                        </details>
                    </div>
                ))}
            </div>
        </section>
    );
};
