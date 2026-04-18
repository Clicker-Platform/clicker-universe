'use client';

import Image from 'next/image';
import { useRef, useState } from 'react';
import { useTemplate } from '@/components/TemplateProvider';
import { useDeviceView, dv, type DeviceView } from '@/components/DeviceViewContext';
import { toolbarMouseDownRef } from '@/components/admin/blocks/InlineEditToolbar';

// Selection chrome overlay — 8 square handles + border, shown on focused editable fields
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

// Inline-editable text primitive — only activates when onInlineChange is provided (canvas preview)
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
    tag?: keyof React.JSX.IntrinsicElements;
    className?: string;
    style?: React.CSSProperties;
    placeholder?: string;
    onInlineChange?: (field: string, value: string) => void;
    onFieldFocus?: (field: string, rect: DOMRect) => void;
}) {
    const ref = useRef<HTMLElement>(null);
    const [focused, setFocused] = useState(false);

    if (!onInlineChange) {
        const El = Tag as any;
        return <El className={className} style={style}>{value}</El>;
    }

    const El = Tag as any;
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
                        const text = (e.nativeEvent as any).clipboardData?.getData('text/plain') ?? '';
                        document.execCommand('insertText', false, text);
                    }
                }}
                dangerouslySetInnerHTML={{ __html: value || '' }}
            />
            {focused && <FieldSelectionChrome />}
        </div>
    );
}

const TITLE_SIZES = (d: DeviceView): Record<string, string> => ({
    sm: dv(d, 'text-2xl', 'md:text-3xl'),
    md: dv(d, 'text-4xl', 'md:text-5xl'),
    lg: dv(d, 'text-5xl', 'md:text-6xl'),
    xl: dv(d, 'text-6xl', 'md:text-7xl'),
});

interface CtaBtn { label?: string; url?: string; }

// Shared CTA button row — adapts styling to dark/light context
const CtaButtons = ({
    primary, secondary, dark = false, align = 'center',
}: {
    primary?: CtaBtn | null;
    secondary?: CtaBtn | null;
    dark?: boolean;
    align?: string;
}) => {
    if (!primary && !secondary) return null;

    const justifyClass = align === 'left' ? 'justify-start' : align === 'right' ? 'justify-end' : 'justify-center';

    return (
        <div className={`flex flex-wrap gap-3 mt-6 ${justifyClass}`}>
            {primary?.label && (
                <a
                    href={primary.url || '#'}
                    className={`inline-flex items-center px-6 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-[0.98] shadow-sm ${
                        dark
                            ? 'bg-white text-gray-900 hover:bg-white/90'
                            : 'bg-theme-primary text-white hover:opacity-90'
                    }`}
                >
                    {primary.label}
                </a>
            )}
            {secondary?.label && (
                <a
                    href={secondary.url || '#'}
                    className={`inline-flex items-center px-6 py-2.5 rounded-xl text-sm font-bold border-2 transition-all active:scale-[0.98] ${
                        dark
                            ? 'border-white/50 text-white hover:bg-white/10'
                            : 'border-theme-border text-theme-foreground hover:bg-black/5'
                    }`}
                >
                    {secondary.label}
                </a>
            )}
        </div>
    );
};

export const DefaultHeroBlock = ({ data, theme, onInlineChange, onFieldFocus }: {
    data: any;
    theme?: any;
    onInlineChange?: (field: string, value: string) => void;
    onFieldFocus?: (field: string, rect: DOMRect) => void;
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

    const cardClasses = isClean
        ? 'border border-gray-200 shadow-sm bg-white'
        : isGlass
        ? 'bg-white/5 backdrop-blur-md border border-white/10 shadow-xl'
        : 'bg-white border-[3px] border-theme-border shadow-sticker';

    const variant = data?.layoutVariant || 'centered';
    const imgPos = data?.imagePosition || 'center';
    const titleSizeClass = TITLE_SIZES(d)[data?.titleSize || 'md'];
    const primaryBtn: CtaBtn | null = data?.primaryBtn || null;
    const secondaryBtn: CtaBtn | null = data?.secondaryBtn || null;

    const defaultAlign = variant === 'split' ? 'left' : 'center';
    const textAlign: 'left' | 'center' | 'right' = data?.textAlign || defaultAlign;
    const textAlignClass = `text-${textAlign}`;

    // ─── SPLIT ────────────────────────────────────────────────────────────────
    if (variant === 'split') {
        return (
            <section
                className={`flex ${dv(d, 'flex-col', 'md:flex-row')} items-stretch w-full overflow-hidden ${cardClasses}`}
                style={{ borderRadius: 'var(--theme-radius)' }}
            >
                <div className={`flex-1 ${dv(d, 'p-8', 'md:p-12')} flex flex-col justify-center ${textAlignClass}`}>
                    {(data?.tagline || onInlineChange) && (
                        <EditableText
                            tag="p"
                            field="tagline"
                            value={data?.tagline}
                            placeholder="Add tagline…"
                            onInlineChange={onInlineChange}
                            onFieldFocus={onFieldFocus}
                            className={`text-xs font-bold uppercase tracking-[0.2em] text-theme-foreground/50 mb-2 ${textAlignClass}`}
                            style={data?.taglineColor ? { color: data.taglineColor } : undefined}
                        />
                    )}
                    <EditableText
                        tag="h1"
                        field="title"
                        value={data?.title}
                        placeholder="Add title…"
                        onInlineChange={onInlineChange}
                        className={`${titleSizeClass} mb-4 ${isClean ? 'font-bold text-gray-900 tracking-tight' : isGlass ? 'font-bold text-theme-foreground' : 'font-extrabold text-theme-foreground'}`}
                        style={data?.titleColor ? { color: data.titleColor } : undefined}
                    />
                    {(data?.subtitle || onInlineChange) && (
                        <EditableText
                            tag="p"
                            field="subtitle"
                            value={data?.subtitle}
                            placeholder="Add subtitle…"
                            onInlineChange={onInlineChange}
                            onFieldFocus={onFieldFocus}
                            className={`text-xl ${data?.subtitleWeight ? `font-${data.subtitleWeight}` : 'font-medium'} ${isGlass ? 'text-theme-foreground/70' : 'text-gray-600'}`}
                            style={data?.subtitleColor ? { color: data.subtitleColor } : undefined}
                        />
                    )}
                    <CtaButtons primary={primaryBtn} secondary={secondaryBtn} dark={false} align={textAlign} />
                </div>
                {data?.imageUrl && (
                    <div className={`flex-1 relative ${dv(d, 'min-h-[300px]', 'md:min-h-full')} bg-gray-100`}>
                        <Image
                            src={data.imageUrl}
                            alt={data?.title || 'Hero Image'}
                            fill
                            priority
                            fetchPriority="high"
                            sizes="(max-width: 768px) 100vw, 50vw"
                            className="object-cover"
                            style={{ objectPosition: imgPos }}
                        />
                    </div>
                )}
            </section>
        );
    }

    // ─── FULLBLEED ────────────────────────────────────────────────────────────
    if (variant === 'fullbleed') {
        return (
            <section className="relative w-full h-[60vh] min-h-[400px] flex items-center justify-center overflow-hidden">
                {data?.imageUrl ? (
                    <div className="absolute inset-0 z-0">
                        <Image
                            src={data.imageUrl}
                            alt=""
                            fill
                            priority
                            fetchPriority="high"
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1200px"
                            className="object-cover"
                            style={{ objectPosition: imgPos }}
                        />
                        <div className="absolute inset-0 bg-black/50" />
                    </div>
                ) : (
                    <div className="absolute inset-0 z-0" style={{ backgroundColor: themeColors?.background || '#0E3B2E' }} />
                )}
                <div className={`relative z-10 p-6 max-w-4xl mx-auto w-full ${textAlignClass}`}>
                    {(data?.tagline || onInlineChange) && (
                        <EditableText
                            tag="p"
                            field="tagline"
                            value={data?.tagline}
                            placeholder="Add tagline…"
                            onInlineChange={onInlineChange}
                            onFieldFocus={onFieldFocus}
                            className="text-xs font-bold uppercase tracking-[0.2em] text-white/60 mb-2"
                            style={data?.taglineColor ? { color: data.taglineColor } : undefined}
                        />
                    )}
                    <EditableText
                        tag="h1"
                        field="title"
                        value={data?.title}
                        placeholder="Add title…"
                        onInlineChange={onInlineChange}
                        className={`${titleSizeClass} mb-4 font-bold text-white tracking-tight text-shadow-sm`}
                        style={data?.titleColor ? { color: data.titleColor } : undefined}
                    />
                    {(data?.subtitle || onInlineChange) && (
                        <EditableText
                            tag="p"
                            field="subtitle"
                            value={data?.subtitle}
                            placeholder="Add subtitle…"
                            onInlineChange={onInlineChange}
                            onFieldFocus={onFieldFocus}
                            className={`${dv(d, 'text-xl', 'md:text-2xl')} ${data?.subtitleWeight ? `font-${data.subtitleWeight}` : 'font-medium'} text-white/90 text-shadow-sm`}
                            style={data?.subtitleColor ? { color: data.subtitleColor } : undefined}
                        />
                    )}
                    <CtaButtons primary={primaryBtn} secondary={secondaryBtn} dark={true} align={textAlign} />
                </div>
            </section>
        );
    }

    // ─── CENTERED (default) ───────────────────────────────────────────────────
    const fullWidth = data?.imageFullWidth;
    return (
        <section
            className={`relative py-16 px-6 overflow-hidden ${cardClasses} ${
                fullWidth ? `${dv(d, '-mx-4 w-[calc(100%+2rem)]', 'md:-mx-6 md:w-[calc(100%+3rem)]')}` : 'w-full'
            }`}
            style={{
                borderRadius: fullWidth ? '0' : 'var(--theme-radius)',
                minHeight: data?.imageUrl ? '400px' : 'auto',
            }}
        >
            {data?.imageUrl && data.imageUrl.trim() !== '' && (
                <div className="absolute inset-0 z-0">
                    <Image
                        src={data.imageUrl}
                        alt=""
                        fill
                        priority
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1200px"
                        className="object-cover opacity-20"
                        style={{ objectPosition: imgPos }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                </div>
            )}
            <div className={`relative z-10 max-w-3xl mx-auto ${textAlignClass}`}>
                {(data?.tagline || onInlineChange) && (
                    <EditableText
                        tag="p"
                        field="tagline"
                        value={data?.tagline}
                        placeholder="Add tagline…"
                        onInlineChange={onInlineChange}
                        className={`text-xs font-bold uppercase tracking-[0.2em] text-theme-foreground/50 mb-2 ${textAlignClass}`}
                        style={data?.taglineColor ? { color: data.taglineColor } : undefined}
                    />
                )}
                <EditableText
                    tag="h1"
                    field="title"
                    value={data?.title}
                    placeholder="Add title…"
                    onInlineChange={onInlineChange}
                    className={`${titleSizeClass} mb-4 ${isClean ? 'font-bold text-gray-900 tracking-tight' : isGlass ? 'font-bold text-theme-foreground' : 'font-extrabold text-theme-foreground transform -rotate-1'}`}
                    style={data?.titleColor ? { color: data.titleColor } : undefined}
                />
                {(data?.subtitle || onInlineChange) && (
                    <EditableText
                        tag="p"
                        field="subtitle"
                        value={data?.subtitle}
                        placeholder="Add subtitle…"
                        onInlineChange={onInlineChange}
                        className={`text-xl ${data?.subtitleWeight ? `font-${data.subtitleWeight}` : 'font-medium'} ${isGlass ? 'text-theme-foreground/80' : 'text-gray-600'}`}
                        style={data?.subtitleColor ? { color: data.subtitleColor } : undefined}
                    />
                )}
                <CtaButtons primary={primaryBtn} secondary={secondaryBtn} dark={false} align={textAlign} />
            </div>
        </section>
    );
};
