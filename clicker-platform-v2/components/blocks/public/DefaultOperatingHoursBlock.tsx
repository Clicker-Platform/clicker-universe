'use client';

import React from 'react';
import { BusinessHours } from '@/data/mockData';
import { useTemplate } from '@/components/TemplateProvider';
import { DaySchedule } from '@/lib/core/types';
import { isBusinessOpen } from '@/lib/core/businessHours/utils';
import { Clock } from 'lucide-react';

interface OperatingHoursProps {
    data: BusinessHours;
    schedule?: DaySchedule[];
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getHoursStr(dayConfig?: DaySchedule): string {
    if (!dayConfig || !dayConfig.isOpen || !dayConfig.hours.length) return 'Closed';
    return `${dayConfig.hours[0].start} – ${dayConfig.hours[0].end}`;
}

function buildRows(schedule: DaySchedule[]): { label: string; hours: string }[] {
    const rows: { label: string; hours: string }[] = [];
    // Group consecutive days with identical hours
    const sorted = [...schedule].sort((a, b) => {
        const order = [1, 2, 3, 4, 5, 6, 0];
        return order.indexOf(a.dayOfWeek) - order.indexOf(b.dayOfWeek);
    });

    let i = 0;
    while (i < sorted.length) {
        const cur = sorted[i];
        const curHours = getHoursStr(cur);
        let j = i + 1;
        while (j < sorted.length && getHoursStr(sorted[j]) === curHours) j++;
        const span = sorted.slice(i, j);
        const label = span.length === 1
            ? DAY_LABELS[cur.dayOfWeek]
            : `${DAY_LABELS[span[0].dayOfWeek]} – ${DAY_LABELS[span[span.length - 1].dayOfWeek]}`;
        rows.push({ label, hours: curHours });
        i = j;
    }
    return rows;
}

export const DefaultOperatingHoursBlock: React.FC<OperatingHoursProps> = ({ data, schedule }) => {
    const { theme } = useTemplate();
    const isClean = theme.cardStyle === 'clean';
    const [isOpen, setIsOpen] = React.useState(false);
    const [isMounted, setIsMounted] = React.useState(false);

    React.useEffect(() => {
        setIsMounted(true);
        if (schedule) setIsOpen(isBusinessOpen(new Date(), schedule));
    }, [schedule]);

    if (!data.enabled) return null;

    const statusText = schedule ? (isOpen ? 'Open Now' : 'Closed') : data.tagText;
    const rows = schedule && schedule.length > 0 ? buildRows(schedule) : [
        { label: 'Mon – Fri', hours: data.monFri || '' },
        { label: 'Sat – Sun', hours: data.satSun || '' },
    ];

    return (
        <div
            className={`px-5 py-4 ${isClean
                ? 'border border-gray-200 shadow-sm bg-white'
                : 'border-[3px] border-brand-dark shadow-sticker bg-white transform -rotate-1'
            }`}
            style={{ borderRadius: 'var(--theme-radius)' }}
        >
            {/* Header row */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Clock size={14} className={isClean ? 'text-gray-400' : 'text-brand-dark'} />
                    <h3 className={`text-sm font-black uppercase tracking-wide ${isClean ? 'text-gray-900' : 'text-brand-dark'}`}>
                        {data.label}
                    </h3>
                </div>
                {statusText && isMounted && (
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                        isClean
                            ? isOpen
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                            : 'bg-brand-dark text-brand-green'
                    }`}>
                        {statusText}
                    </span>
                )}
            </div>

            {/* Hours table */}
            <div className="space-y-1">
                {rows.map(({ label, hours }) => (
                    <div key={label} className="flex items-baseline justify-between gap-4">
                        <span className={`text-xs ${isClean ? 'text-gray-500' : 'font-bold text-brand-dark/70'}`}>
                            {label}
                        </span>
                        <span className={`text-xs font-bold tabular-nums ${
                            hours === 'Closed'
                                ? isClean ? 'text-red-400' : 'text-brand-dark/50'
                                : isClean ? 'text-gray-900' : 'text-brand-dark'
                        }`}>
                            {hours}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export { DefaultOperatingHoursBlock as OperatingHours };
