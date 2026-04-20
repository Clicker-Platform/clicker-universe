'use client';

import React, { useMemo } from 'react';
import { MapPin, ExternalLink } from 'lucide-react';
import { useTemplate } from '@/components/TemplateProvider';
import { getCardClasses, getTextColor } from './cardStyles';

interface MapBlockProps {
    data: {
        address?: string;
        layoutVariant?: string;
    };
}

const DefaultMapBlockInner = ({ data }: MapBlockProps) => {
    const { theme } = useTemplate();
    const cardStyle = theme.cardStyle;
    const isGlass = cardStyle === 'glass';
    const variant = data?.layoutVariant || 'card-with-address';
    const iframeFilter = isGlass ? 'invert(90%) hue-rotate(180deg)' : undefined;

    if (!data.address) return null;

    const { mapsUrl, googleMapsLink } = useMemo(() => {
        const encodedAddress = encodeURIComponent(data.address!);
        return {
            mapsUrl: `https://maps.google.com/maps?q=${encodedAddress}&t=&z=13&ie=UTF8&iwloc=&output=embed`,
            googleMapsLink: `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`,
        };
    }, [data.address]);

    // ----- Embed full -----
    if (variant === 'embed-full') {
        return (
            <section className="w-full relative overflow-hidden" style={{ borderRadius: 'var(--theme-radius)' }}>
                <div className="w-full h-[500px] bg-gray-100">
                    <iframe
                        width="100%"
                        height="100%"
                        style={{ border: 0, filter: iframeFilter }}
                        loading="lazy"
                        allowFullScreen
                        referrerPolicy="no-referrer-when-downgrade"
                        src={mapsUrl}
                        title="Google Maps location"
                    />
                </div>
                <div className={`absolute bottom-0 left-0 right-0 p-4 flex items-center gap-3 ${isGlass ? 'bg-black/50 backdrop-blur-md' : 'bg-white/90 backdrop-blur-sm border-t border-gray-200'}`}>
                    <MapPin size={18} className="text-[var(--theme-primary)] shrink-0" />
                    <span className={`text-sm font-medium line-clamp-1 flex-1 ${getTextColor(cardStyle)}`}>{data.address}</span>
                    <a
                        href={googleMapsLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 flex items-center gap-1 text-xs font-bold text-[var(--theme-primary)] hover:opacity-80 transition-opacity"
                    >
                        Open <ExternalLink size={13} />
                    </a>
                </div>
            </section>
        );
    }

    // ----- Default: card-with-address -----
    return (
        <div
            className={`w-full overflow-hidden ${getCardClasses(cardStyle)}`}
            style={{ borderRadius: 'var(--theme-radius)' }}
        >
            <div className={`p-4 border-b flex items-center gap-2 ${isGlass ? 'border-white/10' : 'border-gray-100'}`}>
                <div className={`p-2 rounded-full ${isGlass ? 'bg-white/10 text-theme-primary' : 'bg-brand-light/10 text-brand-dark'}`}>
                    <MapPin size={20} />
                </div>
                <div className={`font-medium line-clamp-1 flex-1 ${getTextColor(cardStyle)}`}>
                    {data.address}
                </div>
                <a
                    href={googleMapsLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 flex items-center gap-1 text-xs font-semibold text-[var(--theme-primary)] hover:opacity-80 transition-opacity"
                >
                    Directions <ExternalLink size={13} />
                </a>
            </div>
            <div className="w-full h-[300px] bg-gray-100 relative">
                <iframe
                    width="100%"
                    height="100%"
                    style={{ border: 0, filter: iframeFilter }}
                    loading="lazy"
                    allowFullScreen
                    referrerPolicy="no-referrer-when-downgrade"
                    src={mapsUrl}
                    title="Google Maps location"
                />
            </div>
        </div>
    );
};

export const DefaultMapBlock = React.memo(DefaultMapBlockInner);
