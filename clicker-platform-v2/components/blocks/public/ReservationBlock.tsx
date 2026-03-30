'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Calendar, Loader2 } from 'lucide-react';
import { useTemplate } from '@/components/TemplateProvider';
import ReservationWidgetDirect from '@/lib/modules/reservation/public/ReservationWidget';

const ReservationWidgetLazy = dynamic(
    () => import('@/lib/modules/reservation/public/ReservationWidget'),
    {
        loading: () => (
            <div className="flex items-center justify-center py-16">
                <Loader2 size={28} className="animate-spin text-[var(--theme-primary,#666)]" />
            </div>
        ),
        ssr: false
    }
);

export const ReservationBlock = ({ data, siteId, initialServices, initialStaff, initialSettings }: { data: any, siteId?: string, initialServices?: any, initialStaff?: any, initialSettings?: any }) => {
    const { theme } = useTemplate();
    const isClean = theme.cardStyle === 'clean';
    const isGlass = theme.cardStyle === 'glass';

    // Button Mode
    if (data.mode === 'button') {
        const buttonText = data.buttonText || "Book Now";

        // Dynamic Button Style based on Theme
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
            {Array.isArray(initialServices)
                ? <ReservationWidgetDirect siteId={siteId} initialServices={initialServices} initialStaff={initialStaff} initialSettings={initialSettings} />
                : <ReservationWidgetLazy siteId={siteId} />
            }
        </div>
    );
};
