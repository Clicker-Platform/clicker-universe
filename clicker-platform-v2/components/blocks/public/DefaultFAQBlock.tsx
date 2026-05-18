'use client';

import React from 'react';
import { ChevronDown } from 'lucide-react';
import { useTemplate } from '@/components/TemplateProvider';
import { getCardClasses, getHeadingColor, getMutedColor } from './cardStyles';
import { H2, H3, BODY_SM } from './typography';
import { useDeviceView, dv } from '@/components/DeviceViewContext';

export const DefaultFAQBlock = ({ data }: { data: any }) => {
    const { theme } = useTemplate();
    const d = useDeviceView();
    const cardStyle = theme.cardStyle;
    const isGlass = cardStyle === 'glass';
    const variant = data?.layoutVariant || 'accordion';

    const items = data?.items || [];
    const headingColor = getHeadingColor(cardStyle, theme);
    const mutedColor = getMutedColor(cardStyle, theme);

    // ----- Grid variant -----
    if (variant === 'grid') {
        return (
            <section className={`${dv(d, 'p-6', 'md:p-10')} ${getCardClasses(cardStyle)}`} style={{ borderRadius: 'var(--theme-radius)' }}>
                <h2 className={`${H2(d)} mb-8`} style={{ color: headingColor }}>FAQ</h2>
                <div className={`grid ${dv(d, 'grid-cols-1', 'md:grid-cols-2')} gap-6`}>
                    {items.map((item: any, i: number) => (
                        <div
                            key={i}
                            className={`p-6 border ${isGlass ? 'bg-white/10 border-white/10' : 'bg-transparent border-gray-100'}`}
                            style={{ borderRadius: 'var(--theme-radius)' }}
                        >
                            <h3 className={`${H3(d)} mb-3`} style={{ color: headingColor }}>
                                {item.question}
                            </h3>
                            <p className={BODY_SM(d)} style={{ color: mutedColor }}>
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
                <h2 className={`${H2(d)} mb-8`} style={{ color: headingColor }}>FAQ</h2>
                <div className="space-y-6">
                    {items.map((item: any, i: number) => (
                        <div key={i} className="border-l-4 border-[var(--theme-primary)] pl-6 py-1">
                            <p className={`${H3(d)} mb-2`} style={{ color: headingColor }}>{item.question}</p>
                            <p className={BODY_SM(d)} style={{ color: mutedColor }}>{item.answer}</p>
                        </div>
                    ))}
                </div>
            </section>
        );
    }

    // ----- Default: accordion -----
    return (
        <section className={`${dv(d, 'p-6', 'md:p-10')} ${getCardClasses(cardStyle)}`} style={{ borderRadius: 'var(--theme-radius)' }}>
            <h2 className={`${H2(d)} mb-6`} style={{ color: headingColor }}>FAQ</h2>
            <div className="space-y-4">
                {items.map((item: any, i: number) => (
                    <div key={i} className={`border-b-2 last:border-0 pb-4 last:pb-0 ${isGlass ? 'border-white/10' : 'border-gray-100'}`}>
                        <details className="group">
                            <summary
                                className={`flex justify-between items-center cursor-pointer list-none ${H3(d)} hover:opacity-80 transition-opacity`}
                                style={{ color: headingColor }}
                            >
                                <span>{item.question}</span>
                                <span className="transition group-open:rotate-180"><ChevronDown size={20} style={{ color: mutedColor }} /></span>
                            </summary>
                            <p
                                className={`${BODY_SM(d)} mt-2 animate-in fade-in slide-in-from-top-1`}
                                style={{ color: mutedColor }}
                            >
                                {item.answer}
                            </p>
                        </details>
                    </div>
                ))}
            </div>
        </section>
    );
};
