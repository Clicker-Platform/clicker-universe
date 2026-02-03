'use client';

import React from 'react';
import { MapPin } from 'lucide-react';

interface MapBlockProps {
    data: {
        address?: string;
    };
}

import { useTemplate } from '@/components/TemplateProvider';

export const MapBlock = ({ data }: MapBlockProps) => {
    const { theme } = useTemplate();
    const isClean = theme.cardStyle === 'clean';

    // If no address is provided, don't render anything or render a placeholder
    // In a real scenario, we might want a placeholder for the editor preview if data is empty,
    // but typically blocks with empty data should handle it gracefully.

    // Encoded address for the URL
    const encodedAddress = data.address ? encodeURIComponent(data.address) : '';

    if (!data.address) {
        return null;
    }

    return (
        <div
            className={`
                w-full bg-white overflow-hidden
                ${isClean
                    ? 'rounded-2xl border border-gray-200 shadow-sm'
                    : 'border-[3px] border-theme-border shadow-sticker'
                }
            `}
            style={{ borderRadius: 'var(--theme-radius)' }}
        >
            <div className={`
                p-4 border-b flex items-center gap-2
                ${isClean ? 'border-gray-100' : 'border-theme-border'}
            `}>
                <div className={`p-2 rounded-full ${isClean ? 'bg-brand-light/10 text-brand-dark' : 'bg-brand-dark text-brand-green'}`}>
                    <MapPin size={20} />
                </div>
                <div className={`font-medium line-clamp-1 ${isClean ? 'text-gray-900' : 'text-brand-dark'}`}>
                    {data.address}
                </div>
            </div>
            <div className="w-full h-[300px] bg-gray-100 relative">
                <iframe
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    loading="lazy"
                    allowFullScreen
                    referrerPolicy="no-referrer-when-downgrade"
                    src={`https://maps.google.com/maps?q=${encodedAddress}&t=&z=13&ie=UTF8&iwloc=&output=embed`}
                ></iframe>
            </div>
        </div>
    );
};
