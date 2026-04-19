'use client';

import React from 'react';
import { BusinessHours } from '@/data/mockData';
import { DaySchedule } from '@/lib/core/types';
import { isBusinessOpen } from '@/lib/core/businessHours/utils';
import { useTemplate } from '@/components/TemplateProvider';
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

export const MrbOperatingHours: React.FC<OperatingHoursProps> = ({ data, schedule }) => {
    const { theme } = useTemplate();
    const [isOpen, setIsOpen] = React.useState(false);
    const [isMounted, setIsMounted] = React.useState(false);

    const isGlass = theme.decorations?.surfaceStyle === 'glass';
    const surface = theme.colors.surfaceElevated || theme.colors.surface || '#1a1a1a';
    const fg = theme.colors.foreground || '#ffffff';
    const subtle = theme.colors.textSubtle || theme.colors.muted || `${fg}80`;
    const border = theme.colors.border || `${fg}15`;

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
        <section>
            <div
                className="px-5 py-4"
                style={{
                    background: surface,
                    backdropFilter: isGlass ? 'blur(12px)' : undefined,
                    border: `1px solid ${border}`,
                    borderRadius: 'var(--theme-radius)',
                }}
            >
                {/* Header row */}
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <Clock size={13} style={{ color: subtle }} />
                        <h3 className="text-sm font-black uppercase tracking-wide" style={{ color: fg }}>
                            {data.label}
                        </h3>
                    </div>
                    {statusText && (
                        <span
                            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border transition-opacity duration-300 ${isMounted ? 'opacity-100' : 'opacity-0'} ${
                                isOpen
                                    ? 'bg-green-500/10 text-green-400 border-green-500/20'
                                    : 'bg-red-500/10 text-red-400 border-red-500/20'
                            }`}
                        >
                            {statusText}
                        </span>
                    )}
                </div>

                {/* Hours table */}
                <div className="space-y-1.5">
                    {rows.map(({ label, hours }) => (
                        <div key={label} className="flex items-baseline justify-between gap-4">
                            <span className="text-xs" style={{ color: subtle }}>{label}</span>
                            <span
                                className="text-xs font-bold tabular-nums"
                                style={{ color: hours === 'Closed' ? '#f87171' : fg }}
                            >
                                {hours}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};
