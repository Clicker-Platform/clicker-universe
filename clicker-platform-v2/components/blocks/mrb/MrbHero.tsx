'use client';

import React from 'react';
import Image from 'next/image';
import { BusinessProfile } from '@/data/mockData';
import { useTemplate } from '@/components/TemplateProvider';
import { useDeviceView, dv, type DeviceView } from '@/components/DeviceViewContext';

const TITLE_SIZES = (d: DeviceView): Record<string, string> => ({
    sm: dv(d, 'text-3xl', 'md:text-4xl'),
    md: dv(d, 'text-5xl', 'md:text-6xl'),
    lg: dv(d, 'text-6xl', 'md:text-7xl'),
    xl: dv(d, 'text-7xl', 'md:text-8xl'),
});

interface CtaBtn { label?: string; url?: string; }

interface MrbHeroProps {
    profile: BusinessProfile;
    previewMode?: boolean;
    data?: {
        title?: string;
        subtitle?: string;
        tagline?: string;
        imageUrl?: string;
        imagePosition?: string;
        textAlign?: string;
        titleSize?: string;
        imageFullWidth?: boolean;
        layoutVariant?: string;
        primaryBtn?: CtaBtn | null;
        secondaryBtn?: CtaBtn | null;
        titleColor?: string;
        subtitleColor?: string;
        taglineColor?: string;
    };
}

export const MrbHero: React.FC<MrbHeroProps> = ({ profile, data }) => {
    const { theme } = useTemplate();
    const d = useDeviceView();

    const defaultHero = "https://lh3.googleusercontent.com/aida-public/AB6AXuAHd7B70Bcb1uWEcIBcn_xhhy47_DyI5SXZVEiUzf-tKxj1KFRwGS5Ud_8q_bwMYgtCRfnYaEZHQgdSmWqgw8gvdjBDjpg0DUSN_LDBYpX_1THYO_73OY2hcgMVUVrx75mGZdmaBdiL78ZPKz9UV9yIiSvcwhTkNfJ7F-Wa6nQyo0gmJUQ7nFq2lN3GGAK3YciJGqEhihA8mzcKu9FvF0jopfHK4M99Lp1sqL_7vhXIAAqgQG51V3b89V-ffqXoCGn5rQt2EvC68ayw";

    const imageUrl = data?.imageUrl || defaultHero;
    const imgPos = data?.imagePosition || 'center';
    const titleSizeClass = TITLE_SIZES(d)[data?.titleSize || 'lg']; // MrbHero default is bigger
    const borderRadius = data?.imageFullWidth ? '0' : (theme.borderRadius || '1rem');

    const isFullbleed = data?.layoutVariant === 'fullbleed';

    // Text alignment — MrbHero default is left (bottom-left layout)
    const textAlign = data?.textAlign || 'left';
    const textAlignClass = `text-${textAlign}`;
    const flexAlignClass = textAlign === 'right' ? 'items-end' : textAlign === 'center' ? 'items-center' : 'items-start';
    const justifyClass = textAlign === 'right' ? 'justify-end' : textAlign === 'center' ? 'justify-center' : 'justify-start';

    // Title: use block data title, fall back to split profile name with two-tone styling
    const titleText = data?.title;
    const nameParts = profile.name.split(' ');
    const firstName = nameParts[0] || '';
    const restName = nameParts.slice(1).join(' ');

    const tagline = data?.tagline ?? profile.tagline;
    const subtitle = data?.subtitle ?? profile.description;
    const primaryBtn: CtaBtn | null = data?.primaryBtn || null;
    const secondaryBtn: CtaBtn | null = data?.secondaryBtn || null;

    return (
        <div
            className={`relative flex h-[560px] flex-col gap-6 justify-end ${dv(d, 'px-6', 'md:px-12')} pb-16 overflow-hidden ${flexAlignClass} ${
                isFullbleed
                    ? 'rounded-none w-screen'
                    : 'w-full'
            }`}
            style={isFullbleed
                ? { border: 'none', borderRadius: '0', position: 'relative', left: '50%', transform: 'translateX(-50%)' }
                : { borderRadius }}
        >
            {/* Background image */}
            <div className="absolute inset-0 z-0">
                <Image
                    src={imageUrl}
                    alt=""
                    fill
                    priority
                    fetchPriority="high"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1200px"
                    className="object-cover"
                    style={{ objectPosition: imgPos }}
                />
                <div
                    className="absolute inset-0"
                    style={{
                        background: `linear-gradient(to top, ${theme.colors.background} 0%, ${theme.colors.background}cc 40%, ${theme.colors.background}00 100%)`
                    }}
                />
            </div>

            {/* Tagline Bubble */}
            {tagline && (
                <div className={`absolute top-8 z-10 ${dv(d, 'px-6', 'md:px-12')} w-full flex ${justifyClass}`}>
                    <span className="inline-flex items-center rounded-full px-4 py-1.5 text-[10px] font-bold uppercase border"
                        style={{
                            backgroundColor: `${theme.colors.primary}15`,
                            color: data?.taglineColor || theme.colors.primary,
                            borderColor: `${theme.colors.primary}33`,
                            letterSpacing: '0.25em'
                        }}>
                        {tagline}
                    </span>
                </div>
            )}

            {/* Text Content */}
            <div className={`flex flex-col gap-4 max-w-2xl relative z-10 w-full ${textAlignClass} ${flexAlignClass}`}>
                {titleText ? (
                    <h1 className={`${titleSizeClass} font-extrabold leading-[0.95] tracking-tighter text-white m-0`}
                        style={data?.titleColor ? { color: data.titleColor } : undefined}>
                        {titleText}
                    </h1>
                ) : (
                    <h1 className={`${titleSizeClass} font-extrabold leading-[0.95] tracking-tighter text-white m-0`}
                        style={data?.titleColor ? { color: data.titleColor } : undefined}>
                        {firstName}{restName && <><br /><span style={{ color: data?.titleColor || theme.colors.primary }}>{restName}</span></>}
                    </h1>
                )}
                {subtitle && (
                    <p className="text-lg font-medium leading-relaxed max-w-md m-0 opacity-80"
                        style={{ color: data?.subtitleColor || theme.colors.foreground }}>
                        {subtitle}
                    </p>
                )}
            </div>

            {/* CTA Buttons */}
            {(primaryBtn?.label || secondaryBtn?.label) && (
                <div className={`flex flex-wrap gap-4 relative z-10 w-full ${justifyClass}`}>
                    {primaryBtn?.label && (
                        <a href={primaryBtn.url || '#'}
                            className="inline-flex items-center px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-wide transition-all active:scale-[0.98] shadow-lg"
                            style={{ backgroundColor: theme.colors.primary, color: theme.colors.background }}>
                            {primaryBtn.label}
                        </a>
                    )}
                    {secondaryBtn?.label && (
                        <a href={secondaryBtn.url || '#'}
                            className="inline-flex items-center px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-wide border-2 transition-all active:scale-[0.98]"
                            style={{ borderColor: `${theme.colors.primary}66`, color: theme.colors.foreground }}>
                            {secondaryBtn.label}
                        </a>
                    )}
                </div>
            )}
        </div>
    );
};
