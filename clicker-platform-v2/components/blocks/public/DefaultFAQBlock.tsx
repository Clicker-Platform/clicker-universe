'use client';

import React from 'react';
import { ChevronDown } from 'lucide-react';
import { useTemplate } from '@/components/TemplateProvider';
import { getCardClasses, getTextColor } from './cardStyles';
import { useDeviceView, dv } from '@/components/DeviceViewContext';

export const DefaultFAQBlock = ({ data }: { data: any }) => {
    const { theme } = useTemplate();
    const d = useDeviceView();
    const cardStyle = theme.cardStyle;
    const isGlass = cardStyle === 'glass';
    const variant = data?.layoutVariant || 'accordion';

    const items = data?.items || [];

    // ----- Grid variant -----
    if (variant === 'grid') {
        return (
            <section className={`${dv(d, 'p-6', 'md:p-10')} ${getCardClasses(cardStyle)}`} style={{ borderRadius: 'var(--theme-radius)' }}>
                <h2 className={`text-2xl mb-8 font-black ${getTextColor(cardStyle)}`}>FAQ</h2>
                <div className={`grid ${dv(d, 'grid-cols-1', 'md:grid-cols-2')} gap-6`}>
                    {items.map((item: any, i: number) => (
                        <div
                            key={i}
                            className={`p-6 border ${isGlass ? 'bg-white/10 border-white/10' : 'bg-transparent border-gray-100'}`}
                            style={{ borderRadius: 'var(--theme-radius)' }}
                        >
                            <h3 className={`font-bold text-base mb-3 leading-snug ${getTextColor(cardStyle)}`}>
                                {item.question}
                            </h3>
                            <p className={`text-sm leading-relaxed ${getTextColor(cardStyle, true)}`}>
                                {item.answer}
                            </p>
                        </div>
                    ))}
                </div>
            </section>
        );
    }

    // ----- Simple list variant -----
    if (variant === 'simple-list') {
        return (
            <section className={`${dv(d, 'p-6', 'md:p-10')} max-w-3xl mx-auto`}>
                <h2 className={`text-2xl mb-8 font-black ${getTextColor(cardStyle)}`}>FAQ</h2>
                <div className="space-y-6">
                    {items.map((item: any, i: number) => (
                        <div key={i} className="border-l-4 border-[var(--theme-primary)] pl-6 py-1">
                            <p className={`font-bold text-lg mb-2 ${getTextColor(cardStyle)}`}>{item.question}</p>
                            <p className={`leading-relaxed ${getTextColor(cardStyle, true)}`}>{item.answer}</p>
                        </div>
                    ))}
                </div>
            </section>
        );
    }

    // ----- Default: accordion -----
    return (
        <section className={`${dv(d, 'p-6', 'md:p-10')} ${getCardClasses(cardStyle)}`} style={{ borderRadius: 'var(--theme-radius)' }}>
            <h2 className={`text-2xl mb-6 font-black ${getTextColor(cardStyle)}`}>FAQ</h2>
            <div className="space-y-4">
                {items.map((item: any, i: number) => (
                    <div key={i} className={`border-b-2 last:border-0 pb-4 last:pb-0 ${isGlass ? 'border-white/10' : 'border-gray-100'}`}>
                        <details className="group">
                            <summary className={`flex justify-between items-center cursor-pointer list-none font-bold text-lg hover:opacity-80 transition-opacity ${getTextColor(cardStyle)}`}>
                                <span className={getTextColor(cardStyle)}>{item.question}</span>
                                <span className="transition group-open:rotate-180"><ChevronDown size={20} className={getTextColor(cardStyle, true)} /></span>
                            </summary>
                            <p className={`mt-2 font-medium leading-relaxed animate-in fade-in slide-in-from-top-1 ${getTextColor(cardStyle, true)}`}>
                                {item.answer}
                            </p>
                        </details>
                    </div>
                ))}
            </div>
        </section>
    );
};
