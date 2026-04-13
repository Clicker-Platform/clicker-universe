'use client';

import React from 'react';
import { BusinessHours } from '@/data/mockData';
import { DaySchedule } from '@/lib/core/types';
import { isBusinessOpen } from '@/lib/core/businessHours/utils';
import { useTemplate } from '@/components/TemplateProvider';

interface OperatingHoursProps {
    data: BusinessHours;
    schedule?: DaySchedule[];
}

export const MrbOperatingHours: React.FC<OperatingHoursProps> = ({ data, schedule }) => {
    const { theme } = useTemplate();
    const [isOpen, setIsOpen] = React.useState(false);
    const [isMounted, setIsMounted] = React.useState(false);

    const isGlass = theme.decorations?.surfaceStyle === 'glass';
    const surfaceFrom = isGlass ? theme.colors.surfaceElevated || '#222222' : (theme.colors.surfaceElevated || theme.colors.surface || '#ffffff');
    const surfaceTo = theme.colors.surface || surfaceFrom;

    React.useEffect(() => {
        setIsMounted(true);
        if (schedule) {
            setIsOpen(isBusinessOpen(new Date(), schedule));
        }
    }, [schedule]);

    if (!data.enabled) return null;

    const statusText = schedule ? (isOpen ? "Open Now" : "Closed") : data.tagText;

    let monFriText = data.monFri;
    let satSunText = data.satSun;

    if (schedule && schedule.length > 0) {
        const getHoursStr = (dayConfig?: DaySchedule) => {
            if (!dayConfig || !dayConfig.isOpen || !dayConfig.hours.length) return "Closed";
            return `${dayConfig.hours[0].start} - ${dayConfig.hours[0].end}`;
        };

        const mon = schedule.find(d => d.dayOfWeek === 1);
        const sat = schedule.find(d => d.dayOfWeek === 6);
        const sun = schedule.find(d => d.dayOfWeek === 0);

        monFriText = getHoursStr(mon);
        satSunText = `${getHoursStr(sat)} / ${getHoursStr(sun)}`;

        if (getHoursStr(sat) === getHoursStr(sun)) {
            satSunText = getHoursStr(sat);
        }
    }

    return (
        <section className="py-8">
            <div
                className="relative overflow-hidden rounded-2xl p-8"
                style={{
                    background: `linear-gradient(to right, ${surfaceFrom}, ${surfaceTo})`,
                    backdropFilter: isGlass ? 'blur(12px)' : undefined,
                    border: `1px solid ${theme.colors.border || `${theme.colors.foreground}10`}`,
                }}
            >
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="max-w-md">
                        <div className="flex items-center gap-3 mb-2">
                            <h2 className="text-2xl font-black" style={{ color: theme.colors.foreground }}>{data.label}</h2>
                            {statusText && (
                                <span
                                    className={`
                                        inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider
                                        border transition-opacity duration-300
                                        ${isMounted ? 'opacity-100' : 'opacity-0'}
                                        ${isOpen
                                            ? 'bg-green-500/10 text-green-400 border-green-500/20'
                                            : 'bg-red-500/10 text-red-400 border-red-500/20'}
                                    `}
                                >
                                    {statusText}
                                </span>
                            )}
                        </div>
                        <div className="text-sm font-medium space-y-1">
                            <p className="flex justify-between items-center max-w-[200px]">
                                <span style={{ color: theme.colors.textSubtle || theme.colors.muted || theme.colors.foreground }}>Mon - Fri:</span>
                                <span className="font-bold" style={{ color: theme.colors.foreground }}>{monFriText}</span>
                            </p>
                            <p className="flex justify-between items-center max-w-[200px]">
                                <span style={{ color: theme.colors.textSubtle || theme.colors.muted || theme.colors.foreground }}>Sat - Sun:</span>
                                <span className="font-bold" style={{ color: theme.colors.foreground }}>{satSunText}</span>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};
