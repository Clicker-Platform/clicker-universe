'use client';

import React, { useRef, useState } from 'react';
import Image from 'next/image';

const BLUR_PLACEHOLDER = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxIiBoZWlnaHQ9IjEiPjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IiNlNWU3ZWIiLz48L3N2Zz4=';
import { BusinessProfile } from '@/data/mockData';
import { useTemplate } from '@/components/TemplateProvider';
import { useDeviceView, dv, type DeviceView } from '@/components/DeviceViewContext';
import { toolbarMouseDownRef } from '@/components/admin/blocks/InlineEditToolbar';

function FieldSelectionChrome() {
    return (
        <div className="absolute pointer-events-none z-10" style={{ inset: -2 }}>
            <div className="absolute inset-0 border-[1.5px] border-blue-500" style={{ borderRadius: 0 }} />
            <div className="absolute -top-[3.5px] -left-[3.5px] w-[7px] h-[7px] bg-white border-[1.5px] border-blue-500" />
            <div className="absolute -top-[3.5px] left-1/2 -translate-x-1/2 w-[7px] h-[7px] bg-white border-[1.5px] border-blue-500" />
            <div className="absolute -top-[3.5px] -right-[3.5px] w-[7px] h-[7px] bg-white border-[1.5px] border-blue-500" />
            <div className="absolute top-1/2 -translate-y-1/2 -left-[3.5px] w-[7px] h-[7px] bg-white border-[1.5px] border-blue-500" />
            <div className="absolute top-1/2 -translate-y-1/2 -right-[3.5px] w-[7px] h-[7px] bg-white border-[1.5px] border-blue-500" />
            <div className="absolute -bottom-[3.5px] -left-[3.5px] w-[7px] h-[7px] bg-white border-[1.5px] border-blue-500" />
            <div className="absolute -bottom-[3.5px] left-1/2 -translate-x-1/2 w-[7px] h-[7px] bg-white border-[1.5px] border-blue-500" />
            <div className="absolute -bottom-[3.5px] -right-[3.5px] w-[7px] h-[7px] bg-white border-[1.5px] border-blue-500" />
        </div>
    );
}

function EditableText({
    value,
    field,
    tag: Tag = 'span',
    className,
    style,
    placeholder,
    onInlineChange,
    onFieldFocus,
}: {
    value?: string;
    field: string;
    tag?: React.ElementType;
    className?: string;
    style?: React.CSSProperties;
    placeholder?: string;
    onInlineChange?: (field: string, value: string) => void;
    onFieldFocus?: (field: string, rect: DOMRect) => void;
}) {
    const ref = useRef<HTMLElement>(null);
    const [focused, setFocused] = useState(false);
    const El = Tag as any;

    if (!onInlineChange) {
        return <El className={className} style={style}>{value}</El>;
    }

    return (
        <div className="relative">
            <El
                ref={ref}
                contentEditable
                suppressContentEditableWarning
                data-placeholder={placeholder}
                className={`${className ?? ''} outline-none cursor-text relative
                    before:content-[attr(data-placeholder)] before:absolute before:inset-0 before:opacity-40 before:pointer-events-none
                    [&:not(:empty)]:before:hidden`}
                style={style}
                onFocus={() => {
                    setFocused(true);
                    if (onFieldFocus && ref.current) {
                        onFieldFocus(field, ref.current.getBoundingClientRect());
                    }
                }}
                onBlur={(e: React.FocusEvent<HTMLElement>) => {
                    if (!toolbarMouseDownRef.current) {
                        setFocused(false);
                        onInlineChange(field, e.currentTarget.textContent || '');
                    }
                }}
                onKeyDown={(e: React.KeyboardEvent<HTMLElement>) => {
                    if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLElement).blur(); }
                    if (e.key === 'v' && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        navigator.clipboard?.readText().then(text => {
                            document.execCommand('insertText', false, text);
                        });
                    }
                }}
                dangerouslySetInnerHTML={{ __html: value || '' }}
            />
            {focused && <FieldSelectionChrome />}
        </div>
    );
}

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
    onInlineChange?: (field: string, value: string) => void;
    onFieldFocus?: (field: string, rect: DOMRect) => void;
    data?: {
        title?: string;
        subtitle?: string;
        tagline?: string;
        imageUrl?: string;
        imagePosition?: string;
        imagePositionMobile?: string;
        imageUrlMobile?: string;
        textAlign?: string;
        titleSize?: string;
        layoutVariant?: string;
        primaryBtn?: CtaBtn | null;
        secondaryBtn?: CtaBtn | null;
        titleColor?: string;
        subtitleColor?: string;
        subtitleWeight?: string;
        taglineColor?: string;
    };
}

export const MrbHero: React.FC<MrbHeroProps> = ({ profile, data, onInlineChange, onFieldFocus }) => {
    const { theme } = useTemplate();
    const d = useDeviceView();

    const defaultHero = "https://lh3.googleusercontent.com/aida-public/AB6AXuAHd7B70Bcb1uWEcIBcn_xhhy47_DyI5SXZVEiUzf-tKxj1KFRwGS5Ud_8q_bwMYgtCRfnYaEZHQgdSmWqgw8gvdjBDjpg0DUSN_LDBYpX_1THYO_73OY2hcgMVUVrx75mGZdmaBdiL78ZPKz9UV9yIiSvcwhTkNfJ7F-Wa6nQyo0gmJUQ7nFq2lN3GGAK3YciJGqEhihA8mzcKu9FvF0jopfHK4M99Lp1sqL_7vhXIAAqgQG51V3b89V-ffqXoCGn5rQt2EvC68ayw";

    const imageUrl = data?.imageUrl || defaultHero;
    // Desktop focal point
    const imgPos = data?.imagePosition || 'center';
    // Mobile: use dedicated focal point if set, otherwise fall back to desktop (Option B default)
    const imgPosMobile = data?.imagePositionMobile || imgPos;
    // Optional separate mobile image (Option A escape hatch)
    const imageUrlMobile = data?.imageUrlMobile || null;

    // For Canvas Studio preview: d is 'mobile' | 'tablet' | 'desktop' | 'responsive'.
    // On real public pages d = 'responsive', so the CSS @media style tag handles mobile.
    // In Canvas Studio mobile/tablet preview we apply the mobile focal point directly via inline style.
    const isMobilePreview = d === 'mobile' || d === 'tablet';
    // If a separate mobile image exists, effectiveImgPos controls ITS position in Canvas preview.
    // Otherwise it controls the single shared image's focal point.
    const effectiveImgPos = isMobilePreview ? imgPosMobile : imgPos;

    const titleSizeClass = TITLE_SIZES(d)[data?.titleSize || 'lg']; // MrbHero default is bigger
    const borderRadius = theme.borderRadius || '1rem';

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
                {/* Desktop image — hidden on mobile only when a separate mobile image is provided */}
                <Image
                    src={imageUrl}
                    alt=""
                    fill
                    priority
                    fetchPriority="high"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1200px"
                    placeholder="blur"
                    blurDataURL={BLUR_PLACEHOLDER}
                    className={`object-cover mrb-hero-bg ${imageUrlMobile ? dv(d, 'hidden', 'md:block') : ''}`}
                    style={{ objectPosition: imageUrlMobile ? imgPos : effectiveImgPos }}
                />
                {/* Option B: CSS @media overrides objectPosition for real mobile browsers (d='responsive') */}
                {!imageUrlMobile && imgPosMobile !== imgPos && (
                    <style>{`
                        @media (max-width: 767px) {
                            .mrb-hero-bg { object-position: ${imgPosMobile} !important; }
                        }
                    `}</style>
                )}
                {/* Option A escape hatch: separate mobile image, shown only on small screens */}
                {imageUrlMobile && (
                    <Image
                        src={imageUrlMobile}
                        alt=""
                        fill
                        priority
                        fetchPriority="high"
                        sizes="100vw"
                        placeholder="blur"
                        blurDataURL={BLUR_PLACEHOLDER}
                        className={`object-cover ${dv(d, 'block', 'md:hidden')}`}
                        style={{ objectPosition: imgPosMobile }}
                    />
                )}
                <div
                    className="absolute inset-0"
                    style={{
                        background: theme.decorations?.accentGlow === false
                            // Light theme: subtle dark scrim so text is readable, no heavy color wash
                            ? `linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.2) 50%, rgba(0,0,0,0) 100%)`
                            // Dark theme: fade to background color
                            : `linear-gradient(to top, ${theme.colors.background} 0%, ${theme.colors.background}cc 40%, ${theme.colors.background}00 100%)`
                    }}
                />
            </div>

            {/* Text Content */}
            <div className={`flex flex-col gap-4 max-w-2xl relative z-10 w-full ${textAlignClass} ${flexAlignClass}`}>
                {/* Tagline Bubble — in flow so it aligns with title/subtitle */}
                {(tagline || onInlineChange) && (
                    <div className={`flex ${justifyClass}`}>
                        <EditableText
                            tag="span"
                            field="tagline"
                            value={tagline}
                            placeholder="Add tagline…"
                            onInlineChange={onInlineChange}
                            onFieldFocus={onFieldFocus}
                            className="inline-flex items-center rounded-full px-4 py-1.5 text-[10px] font-bold uppercase border"
                            style={{
                                backgroundColor: `${theme.colors.primary}15`,
                                color: data?.taglineColor || theme.colors.primary,
                                borderColor: `${theme.colors.primary}33`,
                                letterSpacing: '0.25em',
                            }}
                        />
                    </div>
                )}
                {/* When onInlineChange is active always show an editable title field;
                    otherwise fall back to the split profile name when no data.title set */}
                {(titleText || onInlineChange) ? (
                    <EditableText
                        tag="h1"
                        field="title"
                        value={titleText}
                        placeholder="Add title…"
                        onInlineChange={onInlineChange}
                        onFieldFocus={onFieldFocus}
                        className={`${titleSizeClass} font-extrabold leading-[0.95] tracking-tighter m-0`}
                        style={{ color: data?.titleColor || '#ffffff' }}
                    />
                ) : (
                    <h1 className={`${titleSizeClass} font-extrabold leading-[0.95] tracking-tighter m-0`}
                        style={{ color: data?.titleColor || '#ffffff' }}>
                        {firstName}{restName && <><br /><span style={{ color: data?.titleColor || theme.colors.primary }}>{restName}</span></>}
                    </h1>
                )}
                {(subtitle || onInlineChange) && (
                    <EditableText
                        tag="p"
                        field="subtitle"
                        value={subtitle}
                        placeholder="Add subtitle…"
                        onInlineChange={onInlineChange}
                        onFieldFocus={onFieldFocus}
                        className={`text-lg ${data?.subtitleWeight ? `font-${data.subtitleWeight}` : 'font-medium'} leading-relaxed max-w-md m-0 opacity-80`}
                        style={{ color: data?.subtitleColor || '#ffffff' }}
                    />
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
