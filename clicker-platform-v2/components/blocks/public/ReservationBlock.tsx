'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Calendar } from 'lucide-react';
import { useTemplate } from '@/components/TemplateProvider';
import { getGlassStyle, getHeadingColor } from './cardStyles';
import { H2, BUTTON_TEXT } from './typography';

// Animated skeleton bar — uses CSS vars from TemplateProvider so it works across all themes.
// Renders inside the dynamic() loading prop which shows while JS chunk downloads.
function SkeletonBar({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
    return (
        <div
            className={`animate-pulse rounded-lg ${className}`}
            style={{
                background: 'color-mix(in srgb, var(--theme-foreground, #9ca3af) 12%, transparent)',
                ...style,
            }}
        />
    );
}

function ReservationSkeleton() {
    return (
        <div className="space-y-3 py-2">
            {/* Search bar skeleton */}
            <SkeletonBar style={{ height: 44 }} className="rounded-xl" />
            {/* Service card skeletons — 3 cards matches typical service count */}
            {[1, 2, 3].map(i => (
                <div
                    key={i}
                    className="p-4 rounded-xl border"
                    style={{
                        borderColor: 'color-mix(in srgb, var(--theme-foreground, #e5e7eb) 10%, transparent)',
                        background: 'color-mix(in srgb, var(--theme-foreground, #f9fafb) 5%, transparent)',
                    }}
                >
                    <div className="flex justify-between items-start mb-2">
                        <SkeletonBar style={{ width: `${50 + i * 15}%`, height: 18 }} />
                        <SkeletonBar style={{ width: 72, height: 18 }} />
                    </div>
                    <SkeletonBar style={{ width: 80, height: 14 }} />
                </div>
            ))}
        </div>
    );
}

// ssr: false is required — TimeStep and DetailsStep call new Date() at render time,
// which causes server/client hydration mismatches. The skeleton shows immediately
// in the server HTML and animates while the JS chunk loads, giving perceived speed.
const ReservationWidget = dynamic(
    () => import('@/lib/modules/reservation/public/ReservationWidget'),
    {
        loading: () => <ReservationSkeleton />,
        ssr: false,
    }
);

export const ReservationBlock = ({ data, siteId, initialServices, initialStaff, initialSettings }: { data: any, siteId?: string, initialServices?: any, initialStaff?: any, initialSettings?: any }) => {
    const { theme } = useTemplate();
    const isClean = theme.cardStyle === 'clean';
    const isGlass = theme.cardStyle === 'glass';

    // Button Mode — returns before the widget JS chunk is ever referenced.
    if (data.mode === 'button') {
        const buttonText = data.buttonText || "Book Now";

        // Contrast color for text on top of theme.primary / theme.foreground.
        const primaryContrastColor =
            theme.colors.accentForeground ??
            (theme.colors.accent && theme.colors.accent !== theme.colors.primary ? theme.colors.accent : undefined) ??
            theme.colors.background ??
            '#ffffff';

        const buttonChrome = isGlass
            ? 'rounded-xl hover:opacity-90 shadow-lg'
            : isClean
            ? 'rounded-xl shadow-sm hover:opacity-90 hover:shadow-md'
            : 'border-[3px] shadow-sticker hover:-translate-y-1 hover:shadow-sticker-hover';

        const buttonInlineStyle: React.CSSProperties = isGlass
            ? { backgroundColor: theme.colors.primary, color: primaryContrastColor }
            : isClean
            ? { backgroundColor: theme.colors.foreground, color: theme.colors.background }
            : { backgroundColor: theme.colors.foreground, color: theme.colors.background, borderColor: theme.colors.foreground };

        return (
            <div className="py-8 text-center">
                <Link
                    href={data.href || "/book"}
                    className={`inline-flex items-center gap-2 px-8 py-4 ${BUTTON_TEXT} transition-all ${buttonChrome}`}
                    style={{ ...buttonInlineStyle, borderRadius: 'calc(var(--theme-radius) * 0.75)' }}
                >
                    <Calendar size={20} strokeWidth={isGlass ? 2 : isClean ? 2 : 2.5} />
                    {buttonText}
                </Link>
            </div>
        );
    }

    // Embed Mode
    return (
        <div
            className={`
                container mx-auto px-4 sm:px-6
                ${isGlass
                    ? 'backdrop-blur-md border border-white/10 shadow-xl'
                    : isClean
                    ? ''
                    : 'bg-white border-[3px] border-theme-border shadow-sticker'}
            `}
            style={{
                borderRadius: isClean ? '0' : 'var(--theme-radius)',
                ...(isGlass ? getGlassStyle(theme.colors.surface) : {}),
            }}
        >
            {data.title && (
                <h2 className={`${H2} mb-8 text-center`} style={{ color: getHeadingColor(theme.cardStyle, theme) }}>
                    {data.title}
                </h2>
            )}
            <ReservationWidget
                siteId={siteId}
                initialServices={initialServices}
                initialStaff={initialStaff}
                initialSettings={initialSettings}
            />
        </div>
    );
};
