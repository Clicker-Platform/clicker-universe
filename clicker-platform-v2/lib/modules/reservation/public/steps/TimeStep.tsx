import { Service, Staff } from '../../types';
import { ChevronLeft, ChevronRight, Loader2, Calendar as CalendarIcon } from 'lucide-react';
import { useState, useEffect } from 'react';
import { ThemeConfig } from '@/lib/templates/types';
import { logger } from '@/lib/logger';

interface TimeStepProps {
    siteId: string;
    date: Date;
    setDate: (date: Date) => void;
    selectedService: Service;
    selectedStaff: Staff | null;
    staffList: Staff[];
    onSelectTime: (time: string) => void;
    theme: ThemeConfig;
}

export default function TimeStep({
    siteId,
    date,
    setDate,
    selectedService,
    selectedStaff,
    staffList,
    onSelectTime,
    theme,
}: TimeStepProps) {
    const [loadingSlots, setLoadingSlots] = useState(false);
    interface SlotStatus {
        time: string;
        available: boolean;
        reason?: 'booked' | 'past' | 'closed';
    }

    const [generatedSlots, setGeneratedSlots] = useState<SlotStatus[]>([]);
    const [selectedTime, setSelectedTime] = useState<string | null>(null);

    const isGlass = theme.decorations?.surfaceStyle === 'glass' || theme.cardStyle === 'glass';
    const surfaceBg = theme.colors.surface || '#f9fafb';
    const borderColor = isGlass ? 'rgba(255,255,255,0.1)' : (theme.colors.border || '#e5e7eb');
    const mutedText = theme.colors.textMuted || theme.colors.foreground;
    const subtleText = theme.colors.textSubtle || theme.colors.muted || theme.colors.foreground;

    const formattedDate = date.toLocaleDateString('en-CA');
    const todayStr = new Date().toLocaleDateString('en-CA');
    const isToday = formattedDate === todayStr;

    const handleDateChange = (newDate: Date) => {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        if (newDate < now) return;
        setDate(newDate);
        setSelectedTime(null);
    };

    const handleInputDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const d = new Date(e.target.value);
        const userTimezoneOffset = d.getTimezoneOffset() * 60000;
        const adjustedDate = new Date(d.getTime() + userTimezoneOffset);
        if (!isNaN(adjustedDate.getTime())) handleDateChange(adjustedDate);
    };

    useEffect(() => {
        async function fetchAvailability() {
            setLoadingSlots(true);
            try {
                const dayOfWeek = date.getDay();
                const { getBookingsForDay, getGlobalSchedule } = await import('@/lib/modules/reservation/api');
                const [dayBookings, globalSchedule] = await Promise.all([
                    getBookingsForDay(siteId, date),
                    getGlobalSchedule(siteId)
                ]);

                const activeStaffCount = staffList.filter(s => s.isActive).length;
                const maxCapacity = selectedStaff ? 1 : (activeStaffCount || 1);
                const candidates: SlotStatus[] = [];
                const parseTime = (t: string) => t.split(':').map(Number);
                const globalDay = globalSchedule.find((d: any) => d.dayOfWeek === dayOfWeek);

                if (!globalDay || !globalDay.isOpen || globalDay.hours.length === 0) {
                    setGeneratedSlots([]);
                    return;
                }

                let minTime = 24 * 60, maxTime = 0;
                globalDay.hours.forEach((h: any) => {
                    const [sH, sM] = parseTime(h.start);
                    const [eH, eM] = parseTime(h.end);
                    const startMins = sH * 60 + sM;
                    const endMins = eH * 60 + eM;
                    if (startMins < minTime) minTime = startMins;
                    if (endMins > maxTime) maxTime = endMins;
                });

                let current = new Date(date);
                current.setHours(Math.floor(minTime / 60), minTime % 60, 0, 0);
                const closeTime = new Date(date);
                closeTime.setHours(Math.floor(maxTime / 60), maxTime % 60, 0, 0);

                const serviceDuration = (selectedService.durationMinutes ?? 60) * 60000;
                const latestStartTime = new Date(closeTime.getTime() - serviceDuration);

                while (current <= latestStartTime) {
                    const timeString = current.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
                    const slotStart = current.getTime();
                    const slotEnd = slotStart + serviceDuration;
                    const activeBookings = dayBookings.filter(b => b.status !== 'cancelled' && b.status !== 'completed');
                    let relevantBookings = activeBookings;
                    if (selectedStaff) relevantBookings = activeBookings.filter(b => b.staffId === selectedStaff.id);

                    const conflicts = relevantBookings.filter(b => {
                        const bStart = b.startAt.toDate().getTime();
                        const bEnd = b.endAt.toDate().getTime();
                        return (bStart < slotEnd) && (bEnd > slotStart);
                    });
                    const globalOverlaps = activeBookings.filter(b => {
                        const bStart = b.startAt.toDate().getTime();
                        const bEnd = b.endAt.toDate().getTime();
                        return (bStart < slotEnd) && (bEnd > slotStart);
                    });

                    const isGlobalAvailable = globalOverlaps.length < maxCapacity;
                    const isSpecificAvailable = conflicts.length === 0;
                    let available = false;
                    let reason: SlotStatus['reason'] = undefined;

                    if (selectedStaff) {
                        available = isSpecificAvailable && isGlobalAvailable;
                        if (!available) reason = 'booked';
                    } else {
                        available = isGlobalAvailable;
                        if (!available) reason = 'booked';
                    }

                    candidates.push({ time: timeString, available, reason });
                    current.setHours(current.getHours() + 1);
                }

                setGeneratedSlots(candidates);
            } catch (error) {
                logger.error('reservation.time-step.slots.failed', { siteId, error });
            } finally {
                setLoadingSlots(false);
            }
        }
        fetchAvailability();
    }, [date, selectedService, selectedStaff, staffList]);

    return (
        <div>
            {/* Date Navigation */}
            <div className="flex items-center justify-between mb-6 p-2"
                style={{ backgroundColor: surfaceBg, borderRadius: 'var(--theme-radius)' }}>
                <button
                    onClick={() => { const d = new Date(date); d.setDate(d.getDate() - 1); handleDateChange(d); }}
                    disabled={isToday}
                    className="p-2 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-70"
                    style={{ color: theme.colors.foreground }}
                >
                    <ChevronLeft size={20} />
                </button>

                <div className="text-center relative group cursor-pointer">
                    <p className="text-xs font-bold uppercase" style={{ color: subtleText }}>
                        {date.toLocaleDateString(undefined, { weekday: 'long' })}
                    </p>
                    <div className="flex items-center justify-center gap-2">
                        <p className="font-black text-lg" style={{ color: theme.colors.foreground }}>
                            {date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </p>
                        <CalendarIcon size={16} className="opacity-50 group-hover:opacity-100"
                            style={{ color: theme.colors.primary }} />
                    </div>
                    <input
                        type="date"
                        min={todayStr}
                        value={formattedDate}
                        onChange={handleInputDateChange}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                </div>

                <button
                    onClick={() => { const d = new Date(date); d.setDate(d.getDate() + 1); handleDateChange(d); }}
                    className="p-2 rounded-lg transition-colors hover:opacity-70"
                    style={{ color: theme.colors.foreground }}
                >
                    <ChevronRight size={20} />
                </button>
            </div>

            <div className="grid grid-cols-3 gap-3">
                {loadingSlots ? (
                    <div className="col-span-3 text-center py-8 flex flex-col items-center"
                        style={{ color: subtleText }}>
                        <Loader2 className="animate-spin mb-2" />
                        Checking availability...
                    </div>
                ) : generatedSlots.length === 0 ? (
                    <div className="col-span-3 text-center py-8" style={{ color: subtleText }}>
                        No slots available for this date.
                    </div>
                ) : (
                    generatedSlots.map((slot: any) => {
                        const time = typeof slot === 'string' ? slot : slot.time;
                        const available = typeof slot === 'string' ? true : slot.available;
                        let isPast = false;
                        if (isToday) {
                            const [slotHour, slotMinute] = time.split(':').map(Number);
                            const slotTime = new Date(date);
                            slotTime.setHours(slotHour, slotMinute, 0, 0);
                            if (slotTime < new Date(Date.now() + 30 * 60000)) isPast = true;
                        }
                        const isDisabled = !available || isPast;
                        const isSelected = selectedTime === time;

                        let slotStyle: React.CSSProperties;
                        if (isDisabled) {
                            slotStyle = { backgroundColor: surfaceBg, color: subtleText, borderColor, cursor: 'not-allowed', opacity: 0.5 };
                        } else if (isSelected) {
                            slotStyle = { backgroundColor: theme.colors.primary, color: theme.colors.accentForeground || '#ffffff', borderColor: theme.colors.primary };
                        } else {
                            slotStyle = { backgroundColor: surfaceBg, color: theme.colors.foreground, borderColor };
                        }

                        return (
                            <button
                                key={time}
                                disabled={isDisabled}
                                onClick={() => { if (!isDisabled) setSelectedTime(time); }}
                                className="py-3 text-sm font-bold border transition-all"
                                style={{ ...slotStyle, borderRadius: 'calc(var(--theme-radius) * 0.75)' }}
                            >
                                <span className={isPast ? 'line-through decoration-2' : ''}>{time}</span>
                                {!available && !isPast && (
                                    <span className="block text-[10px] font-normal opacity-70">Booked</span>
                                )}
                            </button>
                        );
                    })
                )}
            </div>

            <div className="mt-8">
                <button
                    disabled={!selectedTime}
                    onClick={() => selectedTime && onSelectTime(selectedTime)}
                    className="w-full py-3 font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-opacity hover:opacity-90"
                    style={{ backgroundColor: theme.colors.primary, color: theme.colors.accentForeground || '#ffffff', borderRadius: 'calc(var(--theme-radius) * 0.75)' }}
                >
                    Continue
                </button>
            </div>
        </div>
    );
}
