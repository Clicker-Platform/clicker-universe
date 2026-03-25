import { Service, Staff } from '../../types';
import { ChevronLeft, ChevronRight, Loader2, Calendar as CalendarIcon } from 'lucide-react';
import { useState, useEffect } from 'react';


interface TimeStepProps {
    siteId: string;
    date: Date;
    setDate: (date: Date) => void;
    selectedService: Service;
    selectedStaff: Staff | null;
    staffList: Staff[];
    onSelectTime: (time: string) => void;
    isGlass?: boolean;
}

export default function TimeStep({
    siteId,
    date,
    setDate,
    selectedService,
    selectedStaff,
    staffList,
    onSelectTime,
    isGlass = false,
}: TimeStepProps) {
    const [loadingSlots, setLoadingSlots] = useState(false);
    interface SlotStatus {
        time: string;
        available: boolean;
        reason?: 'booked' | 'past' | 'closed';
    }

    const [generatedSlots, setGeneratedSlots] = useState<SlotStatus[]>([]);
    const [selectedTime, setSelectedTime] = useState<string | null>(null);

    // Format Date for Input - use local time for date input to avoid timezone shifts
    const formattedDate = date.toLocaleDateString('en-CA'); // YYYY-MM-DD
    const todayStr = new Date().toLocaleDateString('en-CA');
    const isToday = formattedDate === todayStr;

    const handleDateChange = (newDate: Date) => {
        // Prevent selecting past dates
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        if (newDate < now) return;

        setDate(newDate);
        setSelectedTime(null);
    };

    const handleInputDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const d = new Date(e.target.value);
        // Correct for timezone offset when parsing from input string
        const userTimezoneOffset = d.getTimezoneOffset() * 60000;
        const adjustedDate = new Date(d.getTime() + userTimezoneOffset);

        if (!isNaN(adjustedDate.getTime())) {
            handleDateChange(adjustedDate);
        }
    };

    // Generate Slots when Date or Dependencies change
    useEffect(() => {
        async function fetchAvailability() {
            setLoadingSlots(true);
            try {
                const dayOfWeek = date.getDay(); // 0=Sunday

                const { getBookingsForDay, getGlobalSchedule } = await import('@/lib/modules/reservation/api');
                const [dayBookings, globalSchedule] = await Promise.all([
                    getBookingsForDay(siteId, date),
                    getGlobalSchedule(siteId)
                ]);

                const activeStaffCount = staffList.filter(s => s.isActive).length;
                // If no staff configured, treat capacity as 1 (unmanaged mode — slots based on hours only)
                const maxCapacity = selectedStaff ? 1 : (activeStaffCount || 1);

                // Generate candidate slots
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

                const startHour = Math.floor(minTime / 60);
                const startMinute = minTime % 60;
                const endHour = Math.floor(maxTime / 60);
                const endMinute = maxTime % 60;

                let current = new Date(date);
                current.setHours(startHour, startMinute, 0, 0);

                const closeTime = new Date(date);
                closeTime.setHours(endHour, endMinute, 0, 0);

                // We need to ensure service finishes before the specific slot's end time (as per weeklySlots)
                // AND fits within Global Schedule.
                const serviceDuration = (selectedService.durationMinutes ?? 60) * 60000;
                const latestStartTime = new Date(closeTime.getTime() - serviceDuration);

                while (current <= latestStartTime) {
                    const timeString = current.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
                    const slotStart = current.getTime();
                    const slotEnd = slotStart + serviceDuration;

                    const activeBookings = dayBookings.filter(b => b.status !== 'cancelled' && b.status !== 'completed');

                    let relevantBookings = activeBookings;
                    if (selectedStaff) {
                        relevantBookings = activeBookings.filter(b => b.staffId === selectedStaff.id);
                    }

                    // Check specific staff conflicts
                    const conflicts = relevantBookings.filter(b => {
                        const bStart = b.startAt.toDate().getTime();
                        const bEnd = b.endAt.toDate().getTime();
                        return (bStart < slotEnd) && (bEnd > slotStart);
                    });

                    // Check Global Capacity
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
                        if (isSpecificAvailable && isGlobalAvailable) {
                            available = true;
                        } else {
                            reason = 'booked';
                        }
                    } else {
                        if (isGlobalAvailable) {
                            available = true;
                        } else {
                            reason = 'booked';
                        }
                    }

                    candidates.push({ time: timeString, available, reason });
                    current.setHours(current.getHours() + 1);
                }

                setGeneratedSlots(candidates);

            } catch (error) {
                console.error("Error generating slots:", error);
            } finally {
                setLoadingSlots(false);
            }
        }

        fetchAvailability();
    }, [date, selectedService, selectedStaff, staffList]);

    return (
        <div>
            {/* Date Navigation */}
            <div className={`flex items-center justify-between mb-6 p-2 rounded-xl ${
                isGlass ? 'bg-white/5' : 'bg-gray-50'
            }`}>
                <button
                    onClick={() => {
                        const d = new Date(date);
                        d.setDate(d.getDate() - 1);
                        handleDateChange(d);
                    }}
                    disabled={isToday}
                    className={`p-2 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                        isGlass ? 'hover:bg-white/10 text-white' : 'hover:bg-white'
                    }`}
                >
                    <ChevronLeft size={20} />
                </button>

                <div className="text-center relative group cursor-pointer">
                    <p className={`text-xs font-bold uppercase ${isGlass ? 'text-white/40' : 'text-gray-400'}`}>
                        {date.toLocaleDateString(undefined, { weekday: 'long' })}
                    </p>
                    <div className="flex items-center justify-center gap-2">
                        <p className={`font-black text-lg ${isGlass ? 'text-white' : 'text-gray-900'}`}>
                            {date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </p>
                        <CalendarIcon size={16} className={`opacity-50 group-hover:opacity-100 ${isGlass ? 'text-white' : 'text-brand-blue'}`} />
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
                    onClick={() => {
                        const d = new Date(date);
                        d.setDate(d.getDate() + 1);
                        handleDateChange(d);
                    }}
                    className={`p-2 rounded-lg transition-colors ${
                        isGlass ? 'hover:bg-white/10 text-white' : 'hover:bg-white'
                    }`}
                >
                    <ChevronRight size={20} />
                </button>
            </div>

            <div className="grid grid-cols-3 gap-3">
                {loadingSlots ? (
                    <div className={`col-span-3 text-center py-8 flex flex-col items-center ${isGlass ? 'text-white/40' : 'text-gray-400'}`}>
                        <Loader2 className="animate-spin mb-2" />
                        Checking availability...
                    </div>
                ) : generatedSlots.length === 0 ? (
                    <div className={`col-span-3 text-center py-8 ${isGlass ? 'text-white/40' : 'text-gray-400'}`}>
                        No slots available for this date.
                    </div>
                ) : (
                    generatedSlots.map((slot: any) => {
                        const time = typeof slot === 'string' ? slot : slot.time;
                        const available = typeof slot === 'string' ? true : slot.available;
                        const reason = typeof slot === 'string' ? undefined : slot.reason;
                        let isPast = false;
                        if (isToday) {
                            const now = new Date();
                            const [slotHour, slotMinute] = time.split(':').map(Number);
                            const slotTime = new Date(date);
                            slotTime.setHours(slotHour, slotMinute, 0, 0);
                            if (slotTime < new Date(now.getTime() + 30 * 60000)) {
                                isPast = true;
                            }
                        }

                        const isDisabled = !available || isPast;

                        return (
                            <button
                                key={time}
                                disabled={isDisabled}
                                onClick={() => {
                                    if (!isDisabled) setSelectedTime(time);
                                }}
                                className={`py-3 rounded-xl text-sm font-bold border transition-all ${
                                    isDisabled
                                        ? isGlass
                                            ? 'bg-white/5 text-white/20 border-white/5 cursor-not-allowed'
                                            : 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed'
                                        : selectedTime === time
                                            ? isGlass
                                                ? 'bg-[var(--theme-primary)] text-black border-transparent scale-105 shadow-lg'
                                                : 'bg-brand-dark text-white border-brand-dark scale-105 shadow-lg'
                                            : isGlass
                                                ? 'bg-white/5 text-white border-white/10 hover:bg-white/10 hover:border-white/20'
                                                : 'bg-white text-gray-600 border-gray-200 hover:border-brand-dark hover:text-brand-dark'
                                }`}
                            >
                                <span className={isPast ? 'line-through decoration-2 decoration-gray-300' : ''}>
                                    {time}
                                </span>
                                {!available && !isPast && (
                                    <span className="block text-[10px] font-normal opacity-70">
                                        Booked
                                    </span>
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
                    className={`w-full py-3 font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                        isGlass
                            ? 'bg-[var(--theme-primary)] text-black hover:opacity-90'
                            : 'bg-brand-dark text-white hover:bg-brand-dark/90'
                    }`}
                >
                    Continue
                </button>
            </div>
        </div>
    );
}
