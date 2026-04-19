'use client';

import React from 'react';
import { BusinessHours } from '@/data/mockData';
import { useTemplate } from '@/components/TemplateProvider';
import { DaySchedule } from '@/lib/core/types';
import { isBusinessOpen } from '@/lib/core/businessHours/utils';

interface OperatingHoursProps {
    data: BusinessHours;
    schedule?: DaySchedule[];
}

export const OperatingHours: React.FC<OperatingHoursProps> = ({ data, schedule }) => {
    const { theme } = useTemplate();
    const isClean = theme.cardStyle === 'clean';
    const [isOpen, setIsOpen] = React.useState(false);
    const [isMounted, setIsMounted] = React.useState(false);

    React.useEffect(() => {
        setIsMounted(true);
        if (schedule) {
            setIsOpen(isBusinessOpen(new Date(), schedule));
        }
    }, [schedule]);

    if (!data.enabled) return null;

    // Default tag text from data (e.g. "Opening Soon") if no schedule, 
    // OR if schedule exists, determine Open/Closed.
    // We only show Open/Closed status after mount to prevent hydration mismatch.
    const statusText = schedule ? (isOpen ? "Open Now" : "Closed") : data.tagText;

    // Determine Hours Text
    let monFriText = data.monFri;
    let satSunText = data.satSun;

    if (schedule && schedule.length > 0) {
        // Format logic: Group Mon-Fri and Sat-Sun if possible, or just simplistic
        // For MVP, simply extracting M-F (day 1-5) and S-S (day 6,0) commonality
        // This is a simplified formatter.
        const getHoursStr = (dayConfig?: DaySchedule) => {
            if (!dayConfig || !dayConfig.isOpen || !dayConfig.hours.length) return "Closed";
            return `${dayConfig.hours[0].start} - ${dayConfig.hours[0].end}`;
        };

        const mon = schedule.find(d => d.dayOfWeek === 1);
        const sat = schedule.find(d => d.dayOfWeek === 6);
        const sun = schedule.find(d => d.dayOfWeek === 0);

        // Assume M-F match for now (MVP) or just take Mon
        monFriText = getHoursStr(mon);
        satSunText = `${getHoursStr(sat)} / ${getHoursStr(sun)}`;

        // Refined formatting for Sat/Sun equality
        if (getHoursStr(sat) === getHoursStr(sun)) {
            satSunText = getHoursStr(sat);
        }
    }

    return (
        <div
            className={`bg-white p-6 mb-12 relative ${isClean
                ? 'border border-gray-200 shadow-sm'
                : 'border-[3px] border-brand-dark shadow-sticker transform -rotate-1'
            }`}
            style={{ borderRadius: 'var(--theme-radius)' }}
        >
            {statusText && isMounted && (
                <div className={`
                    absolute  px-3 py-1 text-xs font-black uppercase rounded-lg
                    ${isClean
                        ? (isOpen ? 'top-4 right-4 bg-green-100 text-green-700' : 'top-4 right-4 bg-red-100 text-red-700')
                        : '-top-4 -right-2 bg-brand-dark text-brand-green rotate-6'}
                `}>
                    {statusText}
                </div>
            )}
            <h3 className={`mb-4 text-center uppercase ${isClean ? 'font-bold text-lg text-gray-900' : 'font-black text-xl'}`}>{data.label}</h3>
            <div className={`space-y-2 text-center ${isClean ? 'text-gray-600 font-medium' : 'font-bold text-brand-dark/90'}`}>
                <p>Mon - Fri: {monFriText}</p>
                <p>Sat - Sun: {satSunText}</p>
            </div>
        </div>
    );
};
