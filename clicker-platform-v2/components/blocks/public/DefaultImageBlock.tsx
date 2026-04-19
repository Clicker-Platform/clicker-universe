'use client';

import Image from 'next/image';
import { useTemplate } from '@/components/TemplateProvider';
import { getCardClasses } from './cardStyles';
import { useDeviceView, dv } from '@/components/DeviceViewContext';

export const DefaultImageBlock = ({ data }: { data: any }) => {
    const { theme } = useTemplate();
    const d = useDeviceView();
    const cardStyle = theme.cardStyle;
    const isGlass = cardStyle === 'glass';
    const radius = theme.borderRadius || 'var(--theme-radius)';

    if (!data.url) return null;
    const variant = data.layoutVariant || 'standard';

    if (variant === 'full-width') {
        return (
            <section className="w-full">
                <div className="w-full relative">
                    <Image
                        src={data.url}
                        alt={data.caption || "Image"}
                        width={1920}
                        height={1080}
                        sizes="100vw"
                        className="w-full h-auto object-cover max-h-[70vh]"
                        style={{ width: '100%', height: 'auto' }}
                    />
                </div>
                {data.caption && (
                    <p className={`text-center text-sm font-bold mt-3 px-4 italic ${isGlass ? 'text-white/50' : 'text-gray-500'}`}>
                        {data.caption}
                    </p>
                )}
            </section>
        );
    }

    if (variant === 'rounded-card') {
        return (
            <section className={`w-full ${dv(d, 'p-4', 'md:p-8')} flex justify-center`}>
                <div className={`overflow-hidden max-w-4xl w-full ${getCardClasses(cardStyle)}`} style={{ borderRadius: radius }}>
                    <Image
                        src={data.url}
                        alt={data.caption || "Image"}
                        width={1200}
                        height={800}
                        sizes="(max-width: 1024px) 100vw, 800px"
                        className="w-full h-auto object-cover max-h-[60vh]"
                        style={{ width: '100%', height: 'auto' }}
                    />
                    {data.caption && (
                        <div className={`p-4 backdrop-blur border-t ${isGlass ? 'bg-white/5 border-white/10' : 'bg-white/50 border-gray-100'}`}>
                            <p className={`text-center text-sm font-medium ${isGlass ? 'text-white/70' : 'text-gray-600'}`}>
                                {data.caption}
                            </p>
                        </div>
                    )}
                </div>
            </section>
        );
    }

    if (variant === 'side-caption') {
        return (
            <section className={`w-full ${dv(d, 'p-6', 'md:p-12')} max-w-6xl mx-auto flex ${dv(d, 'flex-col', 'md:flex-row')} items-center gap-8`}>
                <div className={`flex-1 overflow-hidden shadow-lg ${getCardClasses(cardStyle)}`} style={{ borderRadius: radius }}>
                    <Image
                        src={data.url}
                        alt={data.caption || "Image"}
                        width={800}
                        height={800}
                        sizes="(max-width: 768px) 100vw, 50vw"
                        className={`w-full h-auto object-cover ${dv(d, 'aspect-square', 'md:aspect-auto md:h-[60vh]')}`}
                        style={{ width: '100%', height: 'auto' }}
                    />
                </div>
                {data.caption && (
                    <div className={`${dv(d, 'w-full', 'md:w-1/3')} flex items-center p-4`}>
                        <div className={`border-l-4 pl-6 py-2 ${isGlass ? 'border-[var(--theme-primary)]' : 'border-brand-dark'}`}>
                            <p className={`text-lg font-medium italic leading-relaxed ${isGlass ? 'text-white/70' : 'text-gray-700'}`}>
                                {data.caption}
                            </p>
                        </div>
                    </div>
                )}
            </section>
        );
    }

    // Default: 'standard'
    return (
        <section className={`w-full ${dv(d, 'px-4', 'md:px-8')} py-6 max-w-5xl mx-auto`}>
            <div className={`overflow-hidden shadow-md ${getCardClasses(cardStyle)}`} style={{ borderRadius: radius }}>
                <Image
                    src={data.url}
                    alt={data.caption || "Image"}
                    width={1000}
                    height={600}
                    sizes="(max-width: 1024px) 100vw, 1000px"
                    className="w-full h-auto object-cover max-h-[70vh]"
                    style={{ width: '100%', height: 'auto' }}
                />
            </div>
            {data.caption && (
                <p className={`text-center text-sm font-bold mt-4 italic ${isGlass ? 'text-white/50' : 'text-gray-500'}`}>
                    {data.caption}
                </p>
            )}
        </section>
    );
};
