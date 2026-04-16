'use client';

import React from 'react';
import { DaySchedule } from '@/lib/core/types';
import { defaultBusinessSchedule } from '@/data/mockData';
import { Clock } from 'lucide-react';

interface ScheduleEditorProps {
    schedule: DaySchedule[];
    onChange: (newSchedule: DaySchedule[]) => void;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const ScheduleEditor: React.FC<ScheduleEditorProps> = ({ schedule, onChange }) => {
    // Ensure we have a complete 7-day schedule, defaulting if missing
    const fullSchedule = DAYS.map((dayName, index) => {
        const existing = schedule?.find(s => s.dayOfWeek === index);
        if (existing) return existing;
        // Fallback to default or closed
        return {
            dayOfWeek: index as 0 | 1 | 2 | 3 | 4 | 5 | 6,
            isOpen: false,
            hours: [{ start: "09:00", end: "17:00" }]
        };
    });

    const handleDayToggle = (dayIndex: number) => {
        const newSchedule = fullSchedule.map(day => {
            if (day.dayOfWeek === dayIndex) {
                return { ...day, isOpen: !day.isOpen };
            }
            return day;
        });
        onChange(newSchedule);
    };

    const handleTimeChange = (dayIndex: number, type: 'start' | 'end', value: string) => {
        const newSchedule = fullSchedule.map(day => {
            if (day.dayOfWeek === dayIndex) {
                const newHours = [...day.hours];
                if (newHours.length === 0) {
                    newHours.push({ start: "09:00", end: "17:00" });
                }
                const currentRange = newHours[0];
                newHours[0] = { ...currentRange, [type]: value };
                return { ...day, hours: newHours };
            }
            return day;
        });
        onChange(newSchedule);
    };

    // Sort starting from Monday (1) to Sunday (0)
    const sortedDays = [...fullSchedule].sort((a, b) => {
        const dayA = a.dayOfWeek === 0 ? 7 : a.dayOfWeek;
        const dayB = b.dayOfWeek === 0 ? 7 : b.dayOfWeek;
        return dayA - dayB;
    });

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
                <Clock className="text-brand-dark" size={20} />
                <h3 className="font-bold text-lg text-brand-dark">Weekly Schedule</h3>
            </div>

            <div className="space-y-3">
                {sortedDays.map((day) => (
                    <div
                        key={day.dayOfWeek}
                        className={`
                            flex items-center justify-between p-4 rounded-lg border transition-all
                            ${day.isOpen
                                ? 'bg-white dark:bg-neutral-900 border-gray-200 dark:border-neutral-700'
                                : 'bg-gray-50 dark:bg-neutral-800/50 border-gray-100 dark:border-neutral-800/50 opacity-75'
                            }
                        `}
                    >
                        <div className="flex items-center gap-4">
                            <button
                                type="button"
                                onClick={() => handleDayToggle(day.dayOfWeek)}
                                className={`
                                    relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-green focus:ring-offset-2
                                    ${day.isOpen ? 'bg-brand-green' : 'bg-gray-300 dark:bg-neutral-600'}
                                `}
                            >
                                <span
                                    className={`
                                        inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                                        ${day.isOpen ? 'translate-x-6' : 'translate-x-1'}
                                    `}
                                />
                            </button>
                            <span className={`font-bold w-24 ${day.isOpen ? 'text-gray-900 dark:text-neutral-100' : 'text-gray-400 dark:text-neutral-600'}`}>
                                {DAYS[day.dayOfWeek]}
                            </span>
                        </div>

                        {day.isOpen ? (
                            <div className="flex items-center gap-2">
                                <input
                                    type="time"
                                    value={day.hours[0]?.start || "09:00"}
                                    onChange={(e) => handleTimeChange(day.dayOfWeek, 'start', e.target.value)}
                                    className="px-3 py-2 bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 dark:text-neutral-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-brand-green outline-none"
                                />
                                <span className="text-gray-400 dark:text-neutral-600 font-bold">-</span>
                                <input
                                    type="time"
                                    value={day.hours[0]?.end || "17:00"}
                                    onChange={(e) => handleTimeChange(day.dayOfWeek, 'end', e.target.value)}
                                    className="px-3 py-2 bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 dark:text-neutral-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-brand-green outline-none"
                                />
                            </div>
                        ) : (
                            <span className="text-sm font-medium text-gray-400 dark:text-neutral-600 italic px-4">Closed</span>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};
