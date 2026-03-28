import Image from 'next/image';
import { useTemplate } from '@/components/TemplateProvider';
import { useDeviceView, dv, type DeviceView } from '@/components/DeviceViewContext';

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

export const DefaultHeroBlock = ({ data, theme }: { data: any, theme?: any }) => {
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

    const Tagline = data?.tagline ? (
        <p className={`text-xs font-bold uppercase tracking-[0.2em] text-theme-foreground/50 mb-2 ${textAlignClass}`}
           style={data?.taglineColor ? { color: data.taglineColor } : undefined}>
            {data.tagline}
        </p>
    ) : null;

    // ─── SPLIT ────────────────────────────────────────────────────────────────
    if (variant === 'split') {
        return (
            <section
                className={`flex ${dv(d, 'flex-col', 'md:flex-row')} items-stretch w-full overflow-hidden ${cardClasses}`}
                style={{ borderRadius: 'var(--theme-radius)' }}
            >
                <div className={`flex-1 ${dv(d, 'p-8', 'md:p-12')} flex flex-col justify-center ${textAlignClass}`}>
                    {Tagline}
                    <h1 className={`${titleSizeClass} mb-4 ${isClean ? 'font-bold text-gray-900 tracking-tight' : isGlass ? 'font-extrabold text-theme-foreground' : 'font-black text-theme-foreground'}`}
                        style={data?.titleColor ? { color: data.titleColor } : undefined}>
                        {data?.title}
                    </h1>
                    {data?.subtitle && (
                        <p className={`text-xl ${isGlass ? 'text-theme-foreground/70 font-medium' : 'text-gray-600 font-medium'}`}
                           style={data?.subtitleColor ? { color: data.subtitleColor } : undefined}>
                            {data.subtitle}
                        </p>
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
                    {data?.tagline && (
                        <p className={`text-xs font-bold uppercase tracking-[0.2em] text-white/60 mb-2`}
                           style={data?.taglineColor ? { color: data.taglineColor } : undefined}>
                            {data.tagline}
                        </p>
                    )}
                    <h1 className={`${titleSizeClass} mb-4 font-bold text-white tracking-tight text-shadow-sm`}
                        style={data?.titleColor ? { color: data.titleColor } : undefined}>

                        {data?.title}
                    </h1>
                    {data?.subtitle && (
                        <p className={`${dv(d, 'text-xl', 'md:text-2xl')} text-white/90 font-medium text-shadow-sm`}
                           style={data?.subtitleColor ? { color: data.subtitleColor } : undefined}>
                            {data.subtitle}
                        </p>
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
                {Tagline}
                <h1 className={`
                    ${titleSizeClass} mb-4
                    ${isClean ? 'font-bold text-gray-900 tracking-tight' : isGlass ? 'font-extrabold text-theme-foreground' : 'font-black text-theme-foreground transform -rotate-1'}
                `}
                    style={data?.titleColor ? { color: data.titleColor } : undefined}>
                    {data?.title}
                </h1>
                {data?.subtitle && (
                    <p className={`text-xl font-medium ${isGlass ? 'text-theme-foreground/80' : 'text-gray-600'}`}
                       style={data?.subtitleColor ? { color: data.subtitleColor } : undefined}>
                        {data.subtitle}
                    </p>
                )}
                <CtaButtons primary={primaryBtn} secondary={secondaryBtn} dark={false} align={textAlign} />
            </div>
        </section>
    );
};
