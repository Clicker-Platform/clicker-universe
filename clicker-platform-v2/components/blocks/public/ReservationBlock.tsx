'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Calendar } from 'lucide-react';
import { useTemplate } from '@/components/TemplateProvider';

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

        const buttonStyle = isGlass
            ? 'bg-[var(--theme-primary)] text-black rounded-xl hover:opacity-90 shadow-lg'
            : isClean
            ? 'bg-brand-dark text-white rounded-xl shadow-sm hover:bg-brand-green hover:shadow-md'
            : 'bg-theme-foreground text-theme-background border-[3px] border-theme-foreground shadow-sticker hover:bg-theme-primary hover:text-theme-foreground hover:-translate-y-1 hover:shadow-sticker-hover';

        return (
            <div className="py-8 text-center">
                <Link
                    href={data.href || "/book"}
                    className={`
                        inline-flex items-center gap-2 px-8 py-4 font-bold transition-all text-lg
                        ${buttonStyle}
                    `}
                    style={{ borderRadius: 'calc(var(--theme-radius) * 0.75)' }}
                >
                    <Calendar size={20} strokeWidth={isGlass ? 2 : isClean ? 2 : 2.5} />
                    {buttonText}
                </Link>
            </div>
        );
    }

    // Embed Mode
    return (
        <div className={`
            container mx-auto px-4
            ${isGlass
                ? 'bg-black/20 backdrop-blur-md border border-white/10 shadow-xl'
                : isClean
                ? ''
                : 'bg-white border-[3px] border-theme-border shadow-sticker'}
        `} style={{ borderRadius: isClean ? '0' : 'var(--theme-radius)' }}>
            {data.title && (
                <h2 className={`
                    text-3xl mb-8 text-center
                    ${isGlass ? 'font-bold text-white' : isClean ? 'font-bold text-gray-900' : 'font-black text-theme-foreground'}
                `}>
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
