'use client';

import React from 'react';
import { StickerBadge } from './StickerBadge';
import { useTemplate } from './TemplateProvider';
import { ICON_MAP } from '@/data/icons';
import { Star } from 'lucide-react'; // Fallback

export const BackgroundDecorations: React.FC = () => {
    const { template } = useTemplate();
    const elements = template.config.backgroundElements || [];

    if (elements.length === 0) return null;

    return (
        <div className="fixed inset-0 pointer-events-none opacity-40 max-w-3xl mx-auto z-0">
            {elements.map((el, index) => {
                const IconComponent = ICON_MAP[el.icon] || Star;
                return (
                    <StickerBadge
                        key={index}
                        icon={IconComponent}
                        rotation={el.rotation}
                        className={`${el.position} ${el.size || 'w-12 h-12'} ${el.colorClass || ''}`}
                    />
                );
            })}
        </div>
    );
};
