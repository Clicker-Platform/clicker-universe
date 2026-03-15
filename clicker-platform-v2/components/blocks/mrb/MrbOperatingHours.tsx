'use client';

import React from 'react';
import { BusinessHours } from '@/data/mockData';
import { DaySchedule } from '@/lib/core/types';
import { isBusinessOpen } from '@/lib/core/businessHours/utils';

interface OperatingHoursProps {
    data: BusinessHours;
    schedule?: DaySchedule[];
}

export const MrbOperatingHours: React.FC<OperatingHoursProps> = ({ data, schedule }) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const [isMounted, setIsMounted] = React.useState(false);

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
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#262626] to-[#1a1a1a] p-8 glass-effect border border-white/5">
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="max-w-md">
                        <div className="flex items-center gap-3 mb-2">
                            <h2 className="text-white text-2xl font-black">{data.label}</h2>
                            {statusText && isMounted && (
                                <span className={`
                                    inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider
                                    border
                                    ${isOpen 
                                        ? 'bg-green-500/10 text-green-400 border-green-500/20' 
                                        : 'bg-red-500/10 text-red-400 border-red-500/20'}
                                `}>
                                    {statusText}
                                </span>
                            )}
                        </div>
                        <div className="text-slate-300 text-sm font-medium space-y-1">
                            <p className="flex justify-between items-center max-w-[200px]">
                                <span className="text-slate-500">Mon - Fri:</span> 
                                <span className="text-white font-bold">{monFriText}</span>
                            </p>
                            <p className="flex justify-between items-center max-w-[200px]">
                                <span className="text-slate-500">Sat - Sun:</span> 
                                <span className="text-white font-bold">{satSunText}</span>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};
