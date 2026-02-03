'use client';

import React from 'react';
import Image from 'next/image';
import { useTemplate } from '@/components/TemplateProvider';

export const ImageBlock = ({ data }: { data: any }) => {
    const { templateId, theme } = useTemplate();
    const isClean = theme.cardStyle === 'clean';

    if (!data.url) return null;
    return (
        <section className="w-full">
            <div className={`
                overflow-hidden bg-white
                ${isClean
                    ? 'border border-gray-200 shadow-sm'
                    : 'border-[3px] border-theme-border shadow-sticker'
                }
            `} style={{ borderRadius: 'var(--theme-radius)' }}>
                <Image
                    src={data.url}
                    alt={data.caption || "Image"}
                    width={0}
                    height={0}
                    sizes="(max-width: 768px) 100vw, 800px"
                    className="w-full h-auto object-cover"
                    style={{ width: '100%', height: 'auto' }}
                />
            </div>
            {data.caption && (
                <p className="text-center text-sm font-bold text-gray-500 mt-2 italic">
                    {data.caption}
                </p>
            )}
        </section>
    );
};
