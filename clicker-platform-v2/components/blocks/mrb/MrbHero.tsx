'use client';

import React, { useRef, useState, useEffect } from 'react';
import Image from 'next/image';
import { ImageIcon } from 'lucide-react';

const BLUR_PLACEHOLDER = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxIiBoZWlnaHQ9IjEiPjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IiNlNWU3ZWIiLz48L3N2Zz4=';
const ALIGN_CLASS = { left: 'text-left', center: 'text-center', right: 'text-right' } as const;
import { BusinessProfile } from '@/data/mockData';
import { useTemplate } from '@/components/TemplateProvider';
import { useDeviceView, dv, type DeviceView } from '@/components/DeviceViewContext';
import { FieldSelectionChrome, EditableText } from '@/components/blocks/shared/EditablePrimitives';
import { H4, BODY_LG, BUTTON_TEXT } from '@/components/blocks/public/typography';
import { UnifiedButton } from '@/components/ui/UnifiedButton';

// ─── Colour helpers ───────────────────────────────────────────────────────────

/** Return 0‥1 relative luminance from a hex colour string. */
function hexLuminance(hex: string): number {
    const clean = hex.replace('#', '');
    const full = clean.length === 3
        ? clean.split('').map(c => c + c).join('')
        : clean;
    const r = parseInt(full.slice(0, 2), 16) / 255;
    const g = parseInt(full.slice(2, 4), 16) / 255;
    const b = parseInt(full.slice(4, 6), 16) / 255;
    const toLinear = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function isColorDark(hex: string): boolean {
    try { return hexLuminance(hex) < 0.179; } catch { return true; }
}

/**
 * Resolve whether text should be light or dark based on the background mode,
 * bg colour, and optional user override.
 */
function resolveTextOnBg(
    bgMode: string,
    bgColor?: string,
    textColorMode?: string,
    imageUrl?: string,
): 'light' | 'dark' {
    if (textColorMode === 'light') return 'light';
    if (textColorMode === 'dark') return 'dark';
    if (bgMode === 'image' && imageUrl) return 'light';
    if (bgMode === 'image' && !imageUrl) {
        return bgColor && isColorDark(bgColor) ? 'light' : 'dark';
    }
    if (bgMode === 'transparent') return 'dark';
    if (bgMode === 'color' && bgColor) return isColorDark(bgColor) ? 'light' : 'dark';
    return 'dark';
}

// MRB shares the Default Hero scale in this phase. 'md' is the spec H1
// default (text-4xl md:text-6xl); other tiers scale around it. The previous
// MRB-specific oversized variants (text-7xl md:text-8xl) were dropped per
// spec §10 — variants/branding will revisit larger scales post-foundation.
const TITLE_SIZES = (d: DeviceView): Record<string, string> => ({
    sm: dv(d, 'text-3xl', 'md:text-4xl'),
    md: dv(d, 'text-4xl', 'md:text-6xl'),  // spec H1
    lg: dv(d, 'text-5xl', 'md:text-7xl'),
    xl: dv(d, 'text-6xl', 'md:text-8xl'),
});

// Non-size half of H1, shared across all size tiers. Per spec §9, the
// MRB-only tracking-tighter / leading-[0.95] are dropped in favor of the
// canonical leading-tight / tracking-tight.
// leading-[1.1] for the same reason as DefaultHeroBlock: Hero titles wrap.
const H1_BASE = 'font-extrabold leading-[1.1] tracking-tight';

interface CtaBtn { label?: string; url?: string; }

function CtaButtons({ primary, secondary, ctaJustify, onFieldFocus }: {
    primary?: CtaBtn | null;
    secondary?: CtaBtn | null;
    ctaJustify: string;
    onFieldFocus?: (field: string, rect: DOMRect) => void;
}) {
    const primaryRef = useRef<HTMLDivElement>(null);
    const secondaryRef = useRef<HTMLDivElement>(null);
    const [focusedBtn, setFocusedBtn] = useState<'primary' | 'secondary' | null>(null);

    useEffect(() => {
        if (!focusedBtn) return;
        const handler = (e: MouseEvent) => {
            const t = e.target as HTMLElement | null;
            if (primaryRef.current?.contains(t) || secondaryRef.current?.contains(t)) return;
            setFocusedBtn(null);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [focusedBtn]);

    const handleClick = (btn: 'primary' | 'secondary', ref: React.RefObject<HTMLDivElement | null>) => {
        if (!onFieldFocus || !ref.current) return;
        setFocusedBtn(btn);
        onFieldFocus('buttons', ref.current.getBoundingClientRect());
    };

    return (
        <div className={`flex flex-wrap gap-4 relative z-10 w-full ${ctaJustify}`}>
            {primary?.label && (
                <div
                    ref={primaryRef}
                    className="relative inline-flex"
                    style={{ overflow: 'visible' }}
                    onClick={() => handleClick('primary', primaryRef)}
                >
                    <UnifiedButton
                        tier="primary"
                        size="lg"
                        href={onFieldFocus ? undefined : (primary.url || '#')}
                    >
                        {primary.label}
                    </UnifiedButton>
                    {onFieldFocus && focusedBtn === 'primary' && <FieldSelectionChrome />}
                </div>
            )}
            {secondary?.label && (
                <div
                    ref={secondaryRef}
                    className="relative inline-flex"
                    style={{ overflow: 'visible' }}
                    onClick={() => handleClick('secondary', secondaryRef)}
                >
                    <UnifiedButton
                        tier="secondary"
                        size="lg"
                        href={onFieldFocus ? undefined : (secondary.url || '#')}
                    >
                        {secondary.label}
                    </UnifiedButton>
                    {onFieldFocus && focusedBtn === 'secondary' && <FieldSelectionChrome />}
                </div>
            )}
        </div>
    );
}

interface MrbHeroProps {
    profile: BusinessProfile;
    previewMode?: boolean;
    isFirst?: boolean;
    onInlineChange?: (field: string, value: string) => void;
    onFieldFocus?: (field: string, rect: DOMRect) => void;
    onFieldBlur?: () => void;
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
        taglineAlign?: string;
        titleAlign?: string;
        subtitleAlign?: string;
        ctaAlign?: string;
        /** 'image' | 'color' | 'transparent' — how to fill the hero background */
        bgMode?: string;
        /** Solid background colour, used when bgMode === 'color' */
        bgColor?: string;
        /** 'auto' | 'light' | 'dark' — override automatic text contrast detection */
        textColorMode?: string;
    };
}

export const MrbHero: React.FC<MrbHeroProps> = ({ profile, data, isFirst = true, onInlineChange, onFieldFocus, onFieldBlur }) => {
    const { theme } = useTemplate();
    const d = useDeviceView();

    // ── Background mode ───────────────────────────────────────────────────────
    // Default: 'image' when an imageUrl is saved, 'color' for brand-new blocks
    const bgMode = data?.bgMode ?? (data?.imageUrl ? 'image' : 'color');
    const bgColor = data?.bgColor || theme.colors.background || '#1a1a2e';

    // ── Image focal point helpers ─────────────────────────────────────────────
    const imageUrl = data?.imageUrl || '';
    const imgPos = data?.imagePosition || 'center';
    const imgPosMobile = data?.imagePositionMobile || imgPos;
    const imageUrlMobile = data?.imageUrlMobile || null;
    const isMobilePreview = d === 'mobile' || d === 'tablet';
    const effectiveImgPos = isMobilePreview ? imgPosMobile : imgPos;

    // ── Text colour ───────────────────────────────────────────────────────────
    const textOnBg = resolveTextOnBg(bgMode, bgColor, data?.textColorMode, imageUrl);
    const defaultTextColor = textOnBg === 'light' ? '#ffffff' : '#111111';
    const defaultSubtitleOpacity = textOnBg === 'light' ? 'rgba(255,255,255,0.82)' : 'rgba(17,17,17,0.65)';

    // ── Layout ────────────────────────────────────────────────────────────────
    const titleSizeClass = TITLE_SIZES(d)[data?.titleSize || 'lg'];
    const borderRadius = theme.borderRadius || '1rem';
    const isFullbleed = data?.layoutVariant === 'fullbleed';

    const fallbackAlign = data?.textAlign || 'left';
    const taglineAlign = data?.taglineAlign ?? fallbackAlign;
    const titleAlign = data?.titleAlign ?? fallbackAlign;
    const subtitleAlign = data?.subtitleAlign ?? fallbackAlign;
    const ctaAlign = data?.ctaAlign ?? fallbackAlign;
    const taC = ALIGN_CLASS[taglineAlign as 'left' | 'center' | 'right'] ?? 'text-left';
    const tiC = ALIGN_CLASS[titleAlign as 'left' | 'center' | 'right'] ?? 'text-left';
    const suC = ALIGN_CLASS[subtitleAlign as 'left' | 'center' | 'right'] ?? 'text-left';
    const taglineJustify = taglineAlign === 'right' ? 'justify-end' : taglineAlign === 'center' ? 'justify-center' : 'justify-start';
    const ctaJustify = ctaAlign === 'right' ? 'justify-end' : ctaAlign === 'center' ? 'justify-center' : 'justify-start';

    const titleText = data?.title;
    const nameParts = profile.name.split(' ');
    const firstName = nameParts[0] || '';
    const restName = nameParts.slice(1).join(' ');

    const tagline = data?.tagline !== null ? (data?.tagline ?? profile.tagline) : null;
    const subtitle = data?.subtitle !== null ? (data?.subtitle ?? profile.description) : null;
    const primaryBtn: CtaBtn | null = data?.primaryBtn || null;
    const secondaryBtn: CtaBtn | null = data?.secondaryBtn || null;

    // ── Render background layer ───────────────────────────────────────────────
    const renderBackground = () => {
        if (bgMode === 'transparent') return null;

        if (bgMode === 'color') {
            return (
                <div
                    className="absolute inset-0 z-0"
                    style={{ backgroundColor: bgColor }}
                />
            );
        }

        // bgMode === 'image' but no image yet — keep previous appearance (fallback to color)
        if (!imageUrl) {
            return (
                <div
                    className="absolute inset-0 z-0"
                    style={{ backgroundColor: bgColor }}
                />
            );
        }

        return (
            <div className="absolute inset-0 z-0">
                {/* Desktop image */}
                <Image
                    src={imageUrl}
                    alt=""
                    fill
                    priority={isFirst}
                    fetchPriority={isFirst ? 'high' : 'auto'}
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1200px"
                    placeholder="blur"
                    blurDataURL={BLUR_PLACEHOLDER}
                    className={`object-cover mrb-hero-bg ${imageUrlMobile ? dv(d, 'hidden', 'md:block') : ''}`}
                    style={{ objectPosition: imageUrlMobile ? imgPos : effectiveImgPos }}
                />
                {/* Option B: CSS @media overrides objectPosition for real mobile browsers */}
                {!imageUrlMobile && imgPosMobile !== imgPos && (
                    <style>{`
                        @media (max-width: 767px) {
                            .mrb-hero-bg { object-position: ${imgPosMobile} !important; }
                        }
                    `}</style>
                )}
                {/* Option A: separate mobile image */}
                {imageUrlMobile && (
                    <Image
                        src={imageUrlMobile}
                        alt=""
                        fill
                        priority={isFirst}
                        fetchPriority={isFirst ? 'high' : 'auto'}
                        sizes="100vw"
                        placeholder="blur"
                        blurDataURL={BLUR_PLACEHOLDER}
                        className={`object-cover ${dv(d, 'block', 'md:hidden')}`}
                        style={{ objectPosition: imgPosMobile }}
                    />
                )}
                {/* Gradient scrim for readability */}
                <div
                    className="absolute inset-0"
                    style={{
                        background: theme.decorations?.accentGlow === false
                            ? `linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.2) 50%, rgba(0,0,0,0) 100%)`
                            : `linear-gradient(to top, ${theme.colors.background} 0%, ${theme.colors.background}cc 40%, ${theme.colors.background}00 100%)`
                    }}
                />
            </div>
        );
    };

    return (
        <div
            className={`relative flex min-h-[560px] flex-col gap-6 justify-end ${dv(d, 'px-6', 'md:px-12')} pb-16 overflow-hidden ${
                fallbackAlign === 'center' ? 'items-center' : fallbackAlign === 'right' ? 'items-end' : 'items-start'
            } ${
                isFullbleed
                    ? 'rounded-none w-screen'
                    : 'w-full'
            }`}
            style={isFullbleed
                ? { border: 'none', borderRadius: '0', position: 'relative', left: '50%', transform: 'translateX(-50%)' }
                : { borderRadius }}
        >
            {renderBackground()}

            {/* Text Content */}
            <div className="flex flex-col gap-4 relative z-10 w-full">
                {/* Tagline Bubble — pill chrome is MRB decorative ornament (spec §10) */}
                {(tagline != null && tagline !== '' && (tagline || onInlineChange)) && (
                    <div className={`flex ${taglineJustify} ${taC}`}>
                        <EditableText
                            tag="span"
                            field="tagline"
                            value={tagline}
                            placeholder="Add tagline…"
                            onInlineChange={onInlineChange}
                            onFieldFocus={onFieldFocus}
                            onFieldBlur={onFieldBlur}
                            className={`inline-flex items-center rounded-full px-4 py-1.5 border ${H4(d)}`}
                            style={{
                                backgroundColor: `${theme.colors.primary}15`,
                                color: data?.taglineColor || theme.colors.primary,
                                borderColor: `${theme.colors.primary}33`,
                            }}
                        />
                    </div>
                )}

                {/* Title */}
                {(titleText != null && titleText !== '') || onInlineChange ? (
                    <EditableText
                        tag="h1"
                        field="title"
                        value={titleText}
                        placeholder="Add title…"
                        onInlineChange={onInlineChange}
                        onFieldFocus={onFieldFocus}
                        className={`${titleSizeClass} ${H1_BASE} ${tiC} m-0`}
                        style={{ color: data?.titleColor || defaultTextColor }}
                    />
                ) : null}

                {/* Subtitle — opacity baked into defaultSubtitleOpacity color */}
                {(subtitle != null && subtitle !== '' && (subtitle || onInlineChange)) && (
                    <EditableText
                        tag="p"
                        field="subtitle"
                        value={subtitle}
                        placeholder="Add subtitle…"
                        onInlineChange={onInlineChange}
                        onFieldFocus={onFieldFocus}
                        className={`${BODY_LG(d)} ${suC} ${data?.subtitleWeight ? `font-${data.subtitleWeight}` : ''} m-0`}
                        style={{ color: data?.subtitleColor || defaultSubtitleOpacity }}
                    />
                )}
            </div>

            {/* CTA Buttons */}
            {(primaryBtn?.label || secondaryBtn?.label) && (
                <CtaButtons
                    primary={primaryBtn}
                    secondary={secondaryBtn}
                    ctaJustify={ctaJustify}
                    onFieldFocus={onFieldFocus}
                />
            )}
        </div>
    );
};
