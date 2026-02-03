import React from 'react';
import Image from 'next/image';

export const HeroBlock = ({ data, theme }: { data: any, theme?: any }) => {
    // Default to 'clean' if theme is missing, or whatever default makes sense
    const isClean = theme?.cardStyle === 'clean';

    return (
        <section className={`
            relative w-full py-12 px-4 text-center overflow-hidden bg-white 
            ${isClean
                ? 'border border-gray-200 shadow-sm'
                : 'border-[3px] border-theme-border shadow-sticker'
            }
        `} style={{ borderRadius: 'var(--theme-radius)' }}>
            {data.imageUrl && data.imageUrl.trim() !== '' && (
                <div className="absolute inset-0 z-0">
                    <Image
                        src={data.imageUrl}
                        alt=""
                        fill
                        priority
                        sizes="100vw"
                        className="object-cover opacity-20"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-white to-transparent" />
                </div>
            )}
            <div className="relative z-10">
                <h1 className={`
                    text-4xl md:text-5xl mb-2
                    ${isClean
                        ? 'font-bold text-gray-900 tracking-tight'
                        : 'font-black text-theme-foreground transform -rotate-1'
                    }
                `}>
                    {data.title}
                </h1>
                {data.subtitle && (
                    <p className={`
                        text-xl font-bold 
                        ${isClean ? 'text-gray-500' : 'text-gray-500'}
                    `}>
                        {data.subtitle}
                    </p>
                )}
            </div>
        </section>
    );
};
