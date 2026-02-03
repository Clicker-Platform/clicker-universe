'use client';

import ReservationWidget from '@/lib/modules/reservation/public/ReservationWidget';
import Link from 'next/link';
import { Calendar } from 'lucide-react';
import { useTemplate } from '@/components/TemplateProvider';

export const ReservationBlock = ({ data, siteId }: { data: any, siteId?: string }) => {
    const { theme } = useTemplate();
    const isClean = theme.cardStyle === 'clean';

    // Button Mode
    if (data.mode === 'button') {
        const buttonText = data.buttonText || "Book Now";

        // Dynamic Button Style based on Theme
        const buttonStyle = isClean
            ? 'bg-brand-dark text-white rounded-xl shadow-sm hover:bg-brand-green hover:shadow-md'
            : 'bg-theme-foreground text-theme-background border-[3px] border-theme-foreground shadow-sticker hover:bg-theme-primary hover:text-theme-foreground hover:-translate-y-1 hover:shadow-sticker-hover';

        return (
            <div className={`py-8 text-center ${isClean ? '' : ''}`}>
                <Link
                    href={data.href || "/book"}
                    className={`
                        inline-flex items-center gap-2 px-8 py-4 font-bold transition-all text-lg
                        ${buttonStyle}
                    `}
                    style={{ borderRadius: 'calc(var(--theme-radius) * 0.75)' }}
                >
                    <Calendar size={20} strokeWidth={isClean ? 2 : 2.5} />
                    {buttonText}
                </Link>
            </div>
        );
    }

    // Embed Mode
    return (
        <div className={`
            container mx-auto px-4 py-8
            ${isClean ? '' : 'bg-white border-[3px] border-theme-border shadow-sticker'}
        `} style={{ borderRadius: isClean ? '0' : 'var(--theme-radius)' }}>
            {data.title && (
                <h2 className={`
                    text-3xl mb-8 text-center
                    ${isClean ? 'font-bold text-gray-900' : 'font-black text-theme-foreground'}
                `}>
                    {data.title}
                </h2>
            )}
            <ReservationWidget siteId={siteId} />
        </div>
    );
};
