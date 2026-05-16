'use client';

import React from 'react';
import { BusinessHours } from '@/data/mockData';
import { useTemplate } from '@/components/TemplateProvider';
import { DaySchedule } from '@/lib/core/types';
import { isBusinessOpen } from '@/lib/core/businessHours/utils';
import { Clock } from 'lucide-react';
import { getCardClasses, getGlassStyle, getLabelColor, getMutedColor, getHeadingColor } from './cardStyles';
import { H4 } from './typography';

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

export const DefaultOperatingHoursBlock: React.FC<OperatingHoursProps> = ({ data, schedule }) => {
    const { theme } = useTemplate();
    const cardStyle = theme.cardStyle;
    const isGlass = cardStyle === 'glass';
    const isClean = cardStyle === 'clean';
    const isBold = !isClean && !isGlass;
    const colors = theme.colors;

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

    // Status badge: semantic tokens — same defaults across all tenants.
    const statusStyle: React.CSSProperties = isOpen
        ? { backgroundColor: 'var(--theme-success-bg)', color: 'var(--theme-success)' }
        : { backgroundColor: 'var(--theme-error-bg)', color: 'var(--theme-error)' };

    const labelColor = getLabelColor(cardStyle, theme);
    const mutedColor = getMutedColor(cardStyle, theme);
    const headingColor = getHeadingColor(cardStyle, theme);

    const cardClasses = `px-5 py-4 ${getCardClasses(cardStyle)} ${isBold ? 'transform -rotate-1' : ''}`;
    const cardInlineStyle: React.CSSProperties = {
        borderRadius: 'var(--theme-radius)',
        ...(isGlass ? getGlassStyle(colors.surface) : {}),
    };

    return (
        <div className={cardClasses} style={cardInlineStyle}>
            {/* Header row */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Clock
                        size={14}
                        style={{ color: labelColor }}
                    />
                    <h3
                        className={H4}
                        style={{ color: headingColor }}
                    >
                        {data.label}
                    </h3>
                </div>
                {statusText && isMounted && (
                    <span
                        className="text-[10px] font-black uppercase px-2 py-0.5"
                        style={{
                            ...statusStyle,
                            borderRadius: 'calc(var(--theme-radius) * 0.4)',
                        }}
                    >
                        {statusText}
                    </span>
                )}
            </div>

            {/* Hours table */}
            <div className="space-y-1">
                {rows.map(({ label, hours }) => {
                    const isClosed = hours === 'Closed';
                    return (
                        <div key={label} className="flex items-baseline justify-between gap-4">
                            <span
                                className="text-xs font-medium leading-normal"
                                style={{ color: mutedColor }}
                            >
                                {label}
                            </span>
                            <span
                                className="text-xs font-semibold leading-normal tabular-nums"
                                style={{
                                    color: headingColor,
                                    opacity: isClosed ? 0.5 : 1,
                                }}
                            >
                                {hours}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export { DefaultOperatingHoursBlock as OperatingHours };
