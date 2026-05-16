'use client';

import Image from 'next/image';
import { useRef, useState, useEffect } from 'react';

const BLUR_PLACEHOLDER = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxIiBoZWlnaHQ9IjEiPjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IiNlNWU3ZWIiLz48L3N2Zz4=';
const ALIGN_CLASS = { left: 'text-left', center: 'text-center', right: 'text-right' } as const;
import { useTemplate } from '@/components/TemplateProvider';
import { useDeviceView, dv, type DeviceView } from '@/components/DeviceViewContext';
import { FieldSelectionChrome, EditableText } from '@/components/blocks/shared/EditablePrimitives';
import { H4, BODY_LG, BUTTON_TEXT } from './typography';

// ─── Colour helpers ───────────────────────────────────────────────────────────

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

function resolveTextOnBg(
    bgMode: string,
    bgColor?: string,
    textColorMode?: string,
    hasImage?: boolean,
): 'light' | 'dark' {
    if (textColorMode === 'light') return 'light';
    if (textColorMode === 'dark') return 'dark';
    // Image mode — always need light text (image has scrim)
    if (bgMode === 'image' && hasImage) return 'light';
    // Transparent — default to dark text
    if (bgMode === 'transparent') return 'dark';
    if (bgMode === 'image' && !hasImage) {
        return bgColor && isColorDark(bgColor) ? 'light' : 'dark';
    }
    // Solid colour — check luminance
    if (bgMode === 'color' && bgColor) return isColorDark(bgColor) ? 'light' : 'dark';
    return 'dark';
}


// User-selectable title size. 'md' is the spec H1 default (text-4xl md:text-6xl).
// All sizes share the H1 weight/leading/tracking via H1_BASE below.
const TITLE_SIZES = (d: DeviceView): Record<string, string> => ({
    sm: dv(d, 'text-3xl', 'md:text-4xl'),
    md: dv(d, 'text-4xl', 'md:text-6xl'),  // spec H1
    lg: dv(d, 'text-5xl', 'md:text-7xl'),
    xl: dv(d, 'text-6xl', 'md:text-8xl'),
});

// Non-size half of H1 — shared by all size tiers and applied uniformly,
// removing the previous per-cardStyle font-weight branching (spec §9).
const H1_BASE = 'font-extrabold leading-tight tracking-tight';

interface CtaBtn { label?: string; url?: string; type?: string; formId?: string; pageId?: string; }

// ─── CTA button row ───────────────────────────────────────────────────────────

const CtaButtons = ({
    primary, secondary, dark = false, align = 'center', onFieldFocus,
}: {
    primary?: CtaBtn | null;
    secondary?: CtaBtn | null;
    dark?: boolean;
    align?: string;
    onFieldFocus?: (field: string, rect: DOMRect) => void;
}) => {
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

    if (!primary && !secondary) return null;

    const justifyClass = align === 'left' ? 'justify-start' : align === 'right' ? 'justify-end' : 'justify-center';

    const handleBtnClick = (btn: 'primary' | 'secondary', ref: React.RefObject<HTMLDivElement | null>) => {
        if (!onFieldFocus || !ref.current) return;
        setFocusedBtn(btn);
        onFieldFocus('buttons', ref.current.getBoundingClientRect());
    };

    return (
        <div className={`flex flex-wrap gap-3 mt-6 ${justifyClass}`}>
            {primary?.label && (
                <div
                    ref={primaryRef}
                    className="relative inline-flex"
                    style={{ overflow: 'visible' }}
                    onClick={() => handleBtnClick('primary', primaryRef)}
                >
                    <a
                        href={onFieldFocus ? undefined : (primary?.type === 'form' ? `#form-${primary.formId}` : primary.url || '#')}
                        className={`inline-flex items-center px-6 py-2.5 ${BUTTON_TEXT} transition-all shadow-sm ${
                            dark
                                ? 'bg-white text-gray-900 hover:bg-white/90'
                                : 'bg-theme-primary text-white hover:opacity-90'
                        }`}
                        style={{ borderRadius: 'var(--theme-radius)' }}
                    >
                        {primary.label}
                    </a>
                    {onFieldFocus && focusedBtn === 'primary' && <FieldSelectionChrome />}
                </div>
            )}
            {secondary?.label && (
                <div
                    ref={secondaryRef}
                    className="relative inline-flex"
                    style={{ overflow: 'visible' }}
                    onClick={() => handleBtnClick('secondary', secondaryRef)}
                >
                    <a
                        href={onFieldFocus ? undefined : (secondary?.type === 'form' ? `#form-${secondary.formId}` : secondary.url || '#')}
                        className={`inline-flex items-center px-6 py-2.5 ${BUTTON_TEXT} border-2 transition-all ${
                            dark
                                ? 'border-white/50 text-white hover:bg-white/10'
                                : 'border-theme-border text-theme-foreground hover:bg-black/5'
                        }`}
                        style={{ borderRadius: 'var(--theme-radius)' }}
                    >
                        {secondary.label}
                    </a>
                    {onFieldFocus && focusedBtn === 'secondary' && <FieldSelectionChrome />}
                </div>
            )}
        </div>
    );
};

// ─── Main component ───────────────────────────────────────────────────────────

export const DefaultHeroBlock = ({ data, theme, isFirst = true, onInlineChange, onFieldFocus, onFieldBlur }: {
    data: any;
    theme?: any;
    isFirst?: boolean;
    onInlineChange?: (field: string, value: string) => void;
    onFieldFocus?: (field: string, rect: DOMRect) => void;
    onFieldBlur?: () => void;
}) => {
    if (!data) return null;

    const deviceView = useDeviceView();
    const d = deviceView;

    let cardStyle = 'brutalist';
    let themeColors: any = null;
    try {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const { theme: templateTheme } = useTemplate();
        cardStyle = templateTheme.cardStyle || 'brutalist';
        themeColors = templateTheme.colors || null;
    } catch {
        if (theme?.cardStyle) cardStyle = theme.cardStyle;
    }

    const isClean = cardStyle === 'clean';
    const isGlass = cardStyle === 'glass';

    // ── Background mode ───────────────────────────────────────────────────────
    const hasImage = !!(data?.imageUrl && data.imageUrl.trim() !== '');
    const bgMode: string = data?.bgMode ?? (hasImage ? 'image' : 'color');
    const bgColor: string = data?.bgColor || '#f3f4f6';
    const textColorMode: string | undefined = data?.textColorMode;

    const textOnBg = resolveTextOnBg(bgMode, bgColor, textColorMode, hasImage);
    const isDark = textOnBg === 'light'; // i.e. the background is dark

    const variant = data?.layoutVariant || 'centered';
    const imgPos = data?.imagePosition || 'center';
    const titleSizeClass = TITLE_SIZES(d)[data?.titleSize || 'md'];
    const primaryBtn: CtaBtn | null = data?.primaryBtn || null;
    const secondaryBtn: CtaBtn | null = data?.secondaryBtn || null;

    const defaultAlign = variant === 'split' ? 'left' : 'center';
    const fallback: 'left' | 'center' | 'right' = data?.textAlign || defaultAlign;
    const taglineAlign: 'left' | 'center' | 'right' = data?.taglineAlign ?? fallback;
    const titleAlign: 'left' | 'center' | 'right' = data?.titleAlign ?? fallback;
    const subtitleAlign: 'left' | 'center' | 'right' = data?.subtitleAlign ?? fallback;
    const ctaAlign: 'left' | 'center' | 'right' = data?.ctaAlign ?? fallback;
    const taC = ALIGN_CLASS[taglineAlign];
    const tiC = ALIGN_CLASS[titleAlign];
    const suC = ALIGN_CLASS[subtitleAlign];

    // Resolved default text colours (used when no per-field override is set)
    // Transparent+auto: inherit from theme CSS vars so page background (dark/light) drives the color
    const isTransparentAuto = bgMode === 'transparent' && !textColorMode;
    const defaultTitleColor = isTransparentAuto ? 'var(--theme-foreground)' : isDark ? '#ffffff' : '#111111';
    const defaultSubtitleColor = isTransparentAuto ? 'var(--theme-foreground)' : isDark ? 'rgba(255,255,255,0.80)' : '#4b5563';
    const defaultTaglineColor = isTransparentAuto ? 'var(--theme-foreground)' : isDark ? 'rgba(255,255,255,0.55)' : undefined;

    // ─── SPLIT ────────────────────────────────────────────────────────────────
    if (variant === 'split') {
        // Split: text on left, image/colour on right
        const splitBgStyle: React.CSSProperties = bgMode === 'color'
            ? { backgroundColor: bgColor }
            : bgMode === 'transparent'
            ? { backgroundColor: 'transparent' }
            : {}; // image handled separately on right panel

        // Card chrome: when bgMode is color/transparent, drop the default bg-white
        const leftClasses = bgMode === 'image'
            ? isClean
                ? 'border border-gray-200 shadow-sm bg-white'
                : isGlass
                ? 'bg-white/5 backdrop-blur-md border border-white/10'
                : 'bg-white border-[3px] border-theme-border shadow-sticker'
            : '';  // colour/transparent: inline style takes over

        return (
            <section
                className={`flex ${dv(d, 'flex-col', 'md:flex-row')} items-stretch w-full overflow-hidden ${
                    bgMode === 'image' ? (isClean ? 'border border-gray-200 shadow-sm' : isGlass ? 'bg-white/5 backdrop-blur-md border border-white/10 shadow-xl' : 'bg-white border-[3px] border-theme-border shadow-sticker') : ''
                }`}
                style={{
                    borderRadius: 'var(--theme-radius)',
                    ...(bgMode !== 'image' ? splitBgStyle : {}),
                }}
            >
                <div className={`flex-1 ${dv(d, 'p-8', 'md:p-12')} flex flex-col justify-center`}>
                    {(data?.tagline != null && data.tagline !== '' && (data.tagline || onInlineChange)) && (
                        <EditableText
                            tag="p"
                            field="tagline"
                            value={data?.tagline}
                            placeholder="Add tagline…"
                            onInlineChange={onInlineChange}
                            onFieldFocus={onFieldFocus}
                            onFieldBlur={onFieldBlur}
                            className={`${H4} mb-2 ${taC}`}
                            style={data?.taglineColor
                                ? { color: data.taglineColor }
                                : defaultTaglineColor
                                ? { color: defaultTaglineColor }
                                : undefined}
                        />
                    )}
                    <EditableText
                        tag="h1"
                        field="title"
                        value={data?.title}
                        placeholder="Add title…"
                        onInlineChange={onInlineChange}
                        onFieldFocus={onFieldFocus}
                        onFieldBlur={onFieldBlur}
                        className={`${titleSizeClass} ${H1_BASE} mb-4 ${tiC}`}
                        style={{ color: data?.titleColor || defaultTitleColor }}
                    />
                    {(data?.subtitle != null && data.subtitle !== '' && (data.subtitle || onInlineChange)) && (
                        <EditableText
                            tag="p"
                            field="subtitle"
                            value={data?.subtitle}
                            placeholder="Add subtitle…"
                            onInlineChange={onInlineChange}
                            onFieldFocus={onFieldFocus}
                            onFieldBlur={onFieldBlur}
                            className={`${BODY_LG} ${suC} ${data?.subtitleWeight ? `font-${data.subtitleWeight}` : ''}`}
                            style={{ color: data?.subtitleColor || defaultSubtitleColor }}
                        />
                    )}
                    <CtaButtons primary={primaryBtn} secondary={secondaryBtn} dark={isDark} align={ctaAlign} onFieldFocus={onFieldFocus} />
                </div>
                {/* Right panel: image or colour fill */}
                <div className={`flex-1 relative ${dv(d, 'min-h-[300px]', 'md:min-h-full')} ${bgMode !== 'image' ? '' : 'bg-gray-100'}`}
                    style={bgMode === 'color' ? { backgroundColor: bgColor } : bgMode === 'transparent' ? {} : {}}>
                    {bgMode === 'image' && hasImage && (
                        <Image
                            src={data.imageUrl}
                            alt={data?.title || 'Hero Image'}
                            fill
                            priority={isFirst}
                            fetchPriority={isFirst ? 'high' : 'auto'}
                            sizes="(max-width: 768px) 100vw, 50vw"
                            placeholder="blur"
                            blurDataURL={BLUR_PLACEHOLDER}
                            className="object-cover"
                            style={{ objectPosition: imgPos }}
                        />
                    )}
                </div>
            </section>
        );
    }

    // ─── FULLBLEED ────────────────────────────────────────────────────────────
    if (variant === 'fullbleed') {
        return (
            <section className="relative w-full h-[60vh] min-h-[400px] flex items-center justify-center overflow-hidden">
                {/* Background layer */}
                {bgMode === 'image' && hasImage ? (
                    <div className="absolute inset-0 z-0">
                        <Image
                            src={data.imageUrl}
                            alt=""
                            fill
                            priority={isFirst}
                            fetchPriority={isFirst ? 'high' : 'auto'}
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1200px"
                            placeholder="blur"
                            blurDataURL={BLUR_PLACEHOLDER}
                            className="object-cover"
                            style={{ objectPosition: imgPos }}
                        />
                        <div className="absolute inset-0 bg-black/50" />
                    </div>
                ) : bgMode === 'color' ? (
                    <div className="absolute inset-0 z-0" style={{ backgroundColor: bgColor }} />
                ) : bgMode === 'transparent' ? null : (
                    // image mode but no photo yet — use theme fallback colour
                    <div className="absolute inset-0 z-0" style={{ backgroundColor: themeColors?.background || '#0E3B2E' }} />
                )}

                <div className="relative z-10 p-6 max-w-4xl mx-auto w-full">
                    {(data?.tagline != null && data.tagline !== '' && (data.tagline || onInlineChange)) && (
                        <EditableText
                            tag="p"
                            field="tagline"
                            value={data?.tagline}
                            placeholder="Add tagline…"
                            onInlineChange={onInlineChange}
                            onFieldFocus={onFieldFocus}
                            onFieldBlur={onFieldBlur}
                            className={`${H4} mb-2 ${taC}`}
                            style={data?.taglineColor
                                ? { color: data.taglineColor }
                                : { color: isTransparentAuto ? 'var(--theme-foreground)' : isDark ? 'rgba(255,255,255,0.60)' : 'rgba(0,0,0,0.50)' }}
                        />
                    )}
                    <EditableText
                        tag="h1"
                        field="title"
                        value={data?.title}
                        placeholder="Add title…"
                        onInlineChange={onInlineChange}
                        onFieldFocus={onFieldFocus}
                        onFieldBlur={onFieldBlur}
                        className={`${titleSizeClass} ${H1_BASE} mb-4 ${tiC}`}
                        style={{ color: data?.titleColor || defaultTitleColor }}
                    />
                    {(data?.subtitle != null && data.subtitle !== '' && (data.subtitle || onInlineChange)) && (
                        <EditableText
                            tag="p"
                            field="subtitle"
                            value={data?.subtitle}
                            placeholder="Add subtitle…"
                            onInlineChange={onInlineChange}
                            onFieldFocus={onFieldFocus}
                            onFieldBlur={onFieldBlur}
                            className={`${BODY_LG} ${suC} ${data?.subtitleWeight ? `font-${data.subtitleWeight}` : ''}`}
                            style={{ color: data?.subtitleColor || defaultSubtitleColor }}
                        />
                    )}
                    <CtaButtons primary={primaryBtn} secondary={secondaryBtn} dark={isDark} align={ctaAlign} onFieldFocus={onFieldFocus} />
                </div>
            </section>
        );
    }

    // ─── CENTERED (default) ───────────────────────────────────────────────────
    const fullWidth = data?.imageFullWidth;

    // Card chrome classes — only meaningful when bgMode is 'image' (photo behind text)
    const cardClasses = bgMode === 'image'
        ? isClean
            ? 'border border-gray-200 shadow-sm bg-white'
            : isGlass
            ? 'bg-white/5 backdrop-blur-md border border-white/10 shadow-xl'
            : 'bg-white border-[3px] border-theme-border shadow-sticker'
        : ''; // colour/transparent: inline style carries the bg

    const sectionStyle: React.CSSProperties = {
        borderRadius: fullWidth ? '0' : 'var(--theme-radius)',
        minHeight: hasImage ? '400px' : 'auto',
        ...(bgMode === 'color' ? { backgroundColor: bgColor } : {}),
        ...(bgMode === 'transparent' ? { backgroundColor: 'transparent' } : {}),
    };

    return (
        <section
            className={`relative py-16 px-6 overflow-hidden ${cardClasses} ${
                fullWidth ? `${dv(d, '-mx-4 w-[calc(100%+2rem)]', 'md:-mx-6 md:w-[calc(100%+3rem)]')}` : 'w-full'
            }`}
            style={sectionStyle}
        >
            {/* Background image layer — only when bgMode === 'image' */}
            {bgMode === 'image' && hasImage && (
                <div className="absolute inset-0 z-0">
                    <Image
                        src={data.imageUrl}
                        alt=""
                        fill
                        priority={isFirst}
                        fetchPriority={isFirst ? 'high' : 'auto'}
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1200px"
                        placeholder="blur"
                        blurDataURL={BLUR_PLACEHOLDER}
                        className="object-cover opacity-20"
                        style={{ objectPosition: imgPos }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                </div>
            )}

            <div className="relative z-10 max-w-3xl mx-auto">
                {(data?.tagline || onInlineChange) && (
                    <EditableText
                        tag="p"
                        field="tagline"
                        value={data?.tagline}
                        placeholder="Add tagline…"
                        onInlineChange={onInlineChange}
                        className={`${H4} mb-2 ${taC}`}
                        style={data?.taglineColor
                            ? { color: data.taglineColor }
                            : { color: isTransparentAuto ? 'var(--theme-foreground)' : isDark ? 'rgba(255,255,255,0.55)' : undefined }}
                    />
                )}
                <EditableText
                    tag="h1"
                    field="title"
                    value={data?.title}
                    placeholder="Add title…"
                    onInlineChange={onInlineChange}
                    onFieldFocus={onFieldFocus}
                    onFieldBlur={onFieldBlur}
                    className={`${titleSizeClass} ${H1_BASE} mb-4 ${tiC} ${!isClean && !isGlass ? 'transform -rotate-1' : ''}`}
                    style={{ color: data?.titleColor || defaultTitleColor }}
                />
                {(data?.subtitle || onInlineChange) && (
                    <EditableText
                        tag="p"
                        field="subtitle"
                        value={data?.subtitle}
                        placeholder="Add subtitle…"
                        onInlineChange={onInlineChange}
                        className={`${BODY_LG} ${suC} ${data?.subtitleWeight ? `font-${data.subtitleWeight}` : ''}`}
                        style={{ color: data?.subtitleColor || defaultSubtitleColor }}
                    />
                )}
                <CtaButtons primary={primaryBtn} secondary={secondaryBtn} dark={isDark} align={ctaAlign} onFieldFocus={onFieldFocus} />
            </div>
        </section>
    );
};
