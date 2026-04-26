'use client';

import { useState, useEffect } from 'react';
import { createBooking } from '@/lib/modules/reservation/api';
import { Service, Staff } from '@/lib/modules/reservation/types';
import { Clock, User, Check, ChevronLeft, ChevronRight, Loader2, Search } from 'lucide-react';
import { useSite } from '@/lib/site-context'; // New import
import { logger } from '@/lib/logger-edge';

interface AdminBookingWizardProps {
    initialServices: Service[];
    initialStaff: Staff[];
    initialSettings: { allowStaffSelection: boolean };
    onSuccess: () => void;
    onCancel: () => void;
}

export default function AdminBookingWizard({
    initialServices,
    initialStaff,
    initialSettings,
    onSuccess,
    onCancel
}: AdminBookingWizardProps) {
    const { siteId } = useSite();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);

    // Data
    const [services] = useState<Service[]>(initialServices);
    const [selectedService, setSelectedService] = useState<Service | null>(null);
    const [staffList] = useState<Staff[]>(initialStaff);
    const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null); // null means "Any"
    const [settings] = useState(initialSettings);

    const [date, setDate] = useState<Date>(new Date());
    const [generatedSlots, setGeneratedSlots] = useState<string[]>([]);
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [selectedTime, setSelectedTime] = useState<string | null>(null);

    const [customerInfo, setCustomerInfo] = useState({
        name: '',
        email: '',
        phone: '',
        notes: '',
        id: 'guest'
    });

    // Member Search State
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    const handleSearch = async (term: string) => {
        setSearchTerm(term);
        if (term.length < 3) {
            setSearchResults([]);
            return;
        }

        setIsSearching(true);
        try {
            if (!siteId) return;
            const { searchMembers } = await import('@/lib/modules/membership/api');
            const results = await searchMembers(siteId, term);
            setSearchResults(results);
        } catch (error) {
            logger.error('reservation.wizard.member-search.failed', { siteId, error });
        } finally {
            setIsSearching(false);
        }
    };

    const [bookingRef, setBookingRef] = useState<string | null>(null);

    // Generate Slots when Date or Service changes
    useEffect(() => {
        async function fetchAvailability() {
            if (!selectedService || !siteId) return;
            setLoadingSlots(true);

            try {
                const dayOfWeek = date.getDay();

                const { getBookingsForDay, getGlobalSchedule } = await import('@/lib/modules/reservation/api');
                const [dayBookings, globalSchedule] = await Promise.all([
                    getBookingsForDay(siteId, date),
                    getGlobalSchedule(siteId)
                ]);

                const activeStaffCount = staffList.filter(s => s.isActive).length;
                const maxCapacity = selectedStaff ? 1 : activeStaffCount;

                if (maxCapacity === 0 && !selectedStaff) {
                    setGeneratedSlots([]);
                    setLoadingSlots(false);
                    return;
                }

                const candidates: string[] = [];
                const parseTime = (t: string) => t.split(':').map(Number);

                const globalDay = globalSchedule.find((d: any) => d.dayOfWeek === dayOfWeek);

                if (!globalDay || !globalDay.isOpen || globalDay.hours.length === 0) {
                    setGeneratedSlots([]);
                    setLoadingSlots(false);
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

                // Stop creating slots if the service duration would push it past closing time
                const latestStartTime = new Date(closeTime.getTime() - (selectedService.durationMinutes ?? 0) * 60000);

                while (current <= latestStartTime) {
                    // Format "HH:mm"
                    const timeString = current.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

                    // 4. Check Overlap for this specific candidate slot
                    const slotStart = current.getTime();
                    const slotEnd = slotStart + (selectedService.durationMinutes ?? 0) * 60000;

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

                    // Check Global Capacity (Active Bookings vs Total Staff)
                    const globalOverlaps = activeBookings.filter(b => {
                        const bStart = b.startAt.toDate().getTime();
                        const bEnd = b.endAt.toDate().getTime();
                        return (bStart < slotEnd) && (bEnd > slotStart);
                    });

                    const isGlobalAvailable = globalOverlaps.length < activeStaffCount;
                    const isSpecificAvailable = conflicts.length === 0;

                    if (selectedStaff) {
                        if (isSpecificAvailable && isGlobalAvailable) candidates.push(timeString);
                    } else {
                        if (isGlobalAvailable) candidates.push(timeString);
                    }

                    // Increment by 1 hour (60 mins) per user request
                    current = new Date(current.getTime() + 60 * 60000);
                }

                setGeneratedSlots(candidates);

            } catch (error) {
                logger.error('reservation.wizard.slots.failed', { siteId, error });
            } finally {
                setLoadingSlots(false);
            }
        }

        fetchAvailability();
    }, [date, selectedService, selectedStaff, staffList, siteId]);

    const handleServiceSelect = (service: Service) => {
        setSelectedService(service);
        if (settings.allowStaffSelection) {
            setStep(2);
        } else {
            setStep(3); // Skip staff
        }
    };

    const handleStaffSelect = (staff: Staff | null) => {
        setSelectedStaff(staff);
        setStep(3);
    };

    const handleTimeSelect = (time: string) => {
        setSelectedTime(time);
    };

    const handleDateChange = (days: number) => {
        const newDate = new Date(date);
        newDate.setDate(newDate.getDate() + days);
        setDate(newDate);
        setSelectedTime(null); // Reset time when date changes
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedService || !selectedTime || !siteId) return;

        setLoading(true);
        try {
            // Reconstruct Date object from date + time string
            const [hours, minutes] = selectedTime.split(':').map(Number);
            const bookingStart = new Date(date);
            bookingStart.setHours(hours, minutes, 0, 0);

            const bookingEnd = new Date(bookingStart.getTime() + (selectedService.durationMinutes ?? 0) * 60000);

            // Re-verify availability strictly before saving
            const { checkAvailability } = await import('@/lib/modules/reservation/api');
            const isAvailable = await checkAvailability(siteId, selectedService.id, bookingStart, selectedService.durationMinutes ?? 0);

            if (!isAvailable) {
                alert("Sorry, this slot was just taken. Please choose another time.");
                setStep(3); // Go back to time selection
                setLoading(false);
                return;
            }

            const id = await createBooking(siteId, {
                serviceId: selectedService.id,
                serviceName: selectedService.name,

                customerId: customerInfo.id || 'guest',
                customerName: customerInfo.name,
                customerEmail: customerInfo.email,
                customerPhone: customerInfo.phone,
                status: 'confirmed', // Admin bookings are confirmed by default
                startAt: bookingStart as any,
                endAt: bookingEnd as any,
                totalPrice: selectedService.price,
                notes: customerInfo.notes,
                staffId: selectedStaff?.id,
                staffName: selectedStaff?.name
            } as any);

            setBookingRef(id);
            setStep(5);
        } catch (error) {
            logger.error('reservation.wizard.booking.create.failed', { siteId, error });
            alert("Booking failed. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    if (step === 5) {
        return (
            <div className="text-center p-8 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-100 animate-in fade-in">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-950/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Check size={32} strokeWidth={3} />
                </div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-neutral-100 mb-2">Booking Confirmed!</h2>
                <div className="bg-white dark:bg-neutral-900 p-4 rounded-lg border border-dashed border-green-200 inline-block text-left text-sm text-gray-500 dark:text-neutral-500 mb-6">
                    <p>Reference: <span className="font-mono text-brand-dark">{bookingRef}</span></p>
                    <p>Date: <span className="font-bold text-brand-dark">{date.toLocaleDateString()} at {selectedTime}</span></p>
                </div>
                <button
                    onClick={onSuccess}
                    className="block w-full py-3 bg-studio-blue text-white font-bold rounded-lg"
                >
                    Close
                </button>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-neutral-900 min-h-[500px] flex flex-col">
            {/* Header Steps */}
            <div className="bg-gray-50 dark:bg-neutral-800/50 border-b border-gray-100 dark:border-neutral-800 p-4">
                <div className="flex items-center justify-between mb-2">
                    {step > 1 ? (
                        <button onClick={() => setStep(step - 1)} className="p-1 hover:bg-gray-200 dark:hover:bg-neutral-700 rounded-lg text-gray-600 dark:text-neutral-400">
                            <ChevronLeft size={20} /> Back
                        </button>
                    ) : (
                        <div />
                    )}
                    <span className="font-bold text-xs uppercase text-gray-400 dark:text-neutral-500">
                        Step {step} of 4
                    </span>
                    <div className="w-16"></div>
                </div>
                <h2 className="text-lg font-bold text-center text-gray-900 dark:text-neutral-100">
                    {step === 1 && "Select Service"}
                    {step === 2 && "Select Staff"}
                    {step === 3 && "Select Time"}
                    {step === 4 && "Guest Details"}
                </h2>
            </div>

            {/* Content */}
            <div className="p-6 flex-1 overflow-y-auto max-h-[60vh]">
                {/* STEP 1: SERVICES */}
                {step === 1 && (
                    <div className="space-y-3">
                        {services?.length === 0 ? (
                            <div className="text-center py-10 text-gray-400 dark:text-neutral-500">No services found.</div>
                        ) : (
                            services?.filter(s => s.isActive).map(service => (
                                <button
                                    key={service.id}
                                    onClick={() => handleServiceSelect(service)}
                                    className="w-full text-left p-4 rounded-lg border border-gray-100 dark:border-neutral-800 hover:border-brand-dark hover:shadow-md transition-all group"
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <h3 className="font-bold text-brand-dark group-hover:text-brand-blue transition-colors">
                                            {service.name}
                                        </h3>
                                        <span className="font-bold text-brand-dark">
                                            {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(service.price)}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-neutral-500">
                                        <Clock size={12} /> {service.durationMinutes} mins
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                )}

                {/* STEP 2: STAFF (Conditional) */}
                {step === 2 && (
                    <div className="space-y-3">
                        <button
                            onClick={() => handleStaffSelect(null)}
                            className="w-full text-left p-4 rounded-lg border border-gray-100 dark:border-neutral-800 hover:border-brand-dark hover:shadow-md transition-all flex items-center gap-4"
                        >
                            <div className="w-10 h-10 bg-gray-100 dark:bg-neutral-800 rounded-full flex items-center justify-center text-gray-400 dark:text-neutral-500">
                                <User size={20} />
                            </div>
                            <div>
                                <h3 className="font-bold text-brand-dark">Any Available Staff</h3>
                                <p className="text-xs text-gray-500 dark:text-neutral-500">Auto-assign</p>
                            </div>
                        </button>

                        {staffList.filter(s => s.isActive).map(staff => (
                            <button
                                key={staff.id}
                                onClick={() => handleStaffSelect(staff)}
                                className="w-full text-left p-4 rounded-lg border border-gray-100 dark:border-neutral-800 hover:border-brand-dark hover:shadow-md transition-all flex items-center gap-4"
                            >
                                <div className="w-10 h-10 bg-brand-blue/10 text-brand-blue rounded-full flex items-center justify-center font-bold">
                                    {staff.name.charAt(0)}
                                </div>
                                <div>
                                    <h3 className="font-bold text-brand-dark">{staff.name}</h3>
                                    <div className="flex flex-wrap gap-1 mt-0.5">
                                        {(staff.label || 'Staff').split(',').map((tag, i) => (
                                            <span key={i} className="text-[10px] uppercase font-bold text-gray-500 dark:text-neutral-500 bg-gray-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded">
                                                {tag.trim()}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                )}

                {/* STEP 3: DATE & TIME */}
                {step === 3 && (
                    <div>
                        <div className="flex items-center justify-between mb-6 bg-gray-50 dark:bg-neutral-800/50 p-2 rounded-lg sticky top-0 z-10">
                            <button onClick={() => handleDateChange(-1)} className="p-2 hover:bg-white dark:hover:bg-neutral-700 rounded-lg transition-colors">
                                <ChevronLeft size={20} />
                            </button>
                            <div className="text-center">
                                <p className="text-xs font-bold text-gray-400 dark:text-neutral-500 uppercase">{date.toLocaleDateString(undefined, { weekday: 'long' })}</p>
                                <p className="font-semibold text-gray-900 dark:text-neutral-100">{date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</p>
                            </div>
                            <button onClick={() => handleDateChange(1)} className="p-2 hover:bg-white dark:hover:bg-neutral-700 rounded-lg transition-colors">
                                <ChevronRight size={20} />
                            </button>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            {loadingSlots ? (
                                <div className="col-span-3 text-center py-8 text-gray-400 dark:text-neutral-500 flex flex-col items-center">
                                    <Loader2 className="animate-spin mb-2" />
                                    Checking availability...
                                </div>
                            ) : generatedSlots.length === 0 ? (
                                <div className="col-span-3 text-center py-8 text-gray-400 dark:text-neutral-500">
                                    No slots available for this date.
                                </div>
                            ) : (
                                generatedSlots.map(time => (
                                    <button
                                        key={time}
                                        onClick={() => handleTimeSelect(time)}
                                        className={`py-3 rounded-lg text-sm font-bold border transition-all ${selectedTime === time
                                            ? 'bg-studio-blue text-white border-brand-dark scale-105 shadow-lg'
                                            : 'bg-white dark:bg-neutral-800 text-gray-600 dark:text-neutral-400 border-gray-200 dark:border-neutral-700 hover:border-brand-dark hover:text-brand-dark'
                                            }`}
                                    >
                                        {time}
                                    </button>
                                )))}
                        </div>

                        <div className="mt-8 flex justify-end sticky bottom-0 bg-white dark:bg-neutral-900 pt-4 border-t border-gray-50 dark:border-neutral-800">
                            <button
                                disabled={!selectedTime}
                                onClick={() => setStep(4)}
                                className="w-full py-3 bg-studio-blue text-white font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-studio-blue/85 transition-colors"
                            >
                                Continue
                            </button>
                        </div>
                    </div>
                )}

                {/* STEP 4: DETAILS */}
                {step === 4 && (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="bg-gray-50 dark:bg-neutral-800/50 p-4 rounded-lg mb-6 text-sm">
                            <div className="flex justify-between mb-1">
                                <span className="text-gray-500 dark:text-neutral-500">Service:</span>
                                <span className="font-bold text-brand-dark">{selectedService?.name}</span>
                            </div>
                            {selectedStaff && (
                                <div className="flex justify-between mb-1">
                                    <span className="text-gray-500 dark:text-neutral-500">Staff:</span>
                                    <span className="font-bold text-brand-dark">{selectedStaff.name}</span>
                                </div>
                            )}
                            <div className="flex justify-between">
                                <span className="text-gray-500 dark:text-neutral-500">Time:</span>
                                <span className="font-bold text-brand-dark">{date.toLocaleDateString()} at {selectedTime}</span>
                            </div>
                        </div>

                        {/* Member Search */}
                        <div className="bg-brand-blue/5 border border-brand-blue/20 p-4 rounded-lg mb-6 relative">
                            <h3 className="text-brand-dark font-bold mb-2 text-sm flex items-center gap-2">
                                <Search size={16} /> Load Member (Walk-in)
                            </h3>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={e => handleSearch(e.target.value)}
                                    placeholder="Search by name or phone..."
                                    className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 text-sm focus:outline-none focus:border-brand-dark dark:bg-neutral-800 dark:text-neutral-200"
                                />
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-neutral-600" size={14} />

                                {(searchResults?.length > 0) && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-neutral-900 rounded-lg shadow-xl border border-gray-100 dark:border-neutral-800 z-50 max-h-[200px] overflow-y-auto">
                                        {searchResults.map((member: any) => (
                                            <button
                                                key={member.id}
                                                type="button"
                                                onClick={() => {
                                                    setCustomerInfo({
                                                        id: member.id,
                                                        name: member.fullName,
                                                        email: member.email || '',
                                                        phone: member.phoneNumber,
                                                        notes: customerInfo.notes
                                                    });
                                                    setSearchTerm('');
                                                    setSearchResults([]);
                                                }}
                                                className="w-full text-left p-3 hover:bg-gray-50 dark:hover:bg-neutral-800 border-b border-gray-50 dark:border-neutral-800 flex items-center justify-between group"
                                            >
                                                <div>
                                                    <div className="font-bold text-gray-800 dark:text-neutral-200 text-sm group-hover:text-brand-dark">{member.fullName}</div>
                                                    <div className="text-xs text-gray-500 dark:text-neutral-500">{member.phoneNumber}</div>
                                                </div>
                                                <div className="text-xs font-bold text-brand-blue px-2 py-1 bg-brand-blue/10 rounded">Select</div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 dark:text-neutral-500 uppercase mb-1">Full Name</label>
                            <div className="relative">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-neutral-600" size={18} />
                                <input
                                    required
                                    type="text"
                                    value={customerInfo.name}
                                    onChange={e => setCustomerInfo({ ...customerInfo, name: e.target.value })}
                                    className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-200 dark:border-neutral-700 focus:outline-none focus:border-brand-dark dark:bg-neutral-800 dark:text-neutral-200"
                                    placeholder="Guest Name / Walk-in"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-neutral-500 uppercase mb-1">Phone</label>
                                <input
                                    type="tel"
                                    value={customerInfo.phone}
                                    onChange={e => setCustomerInfo({ ...customerInfo, phone: e.target.value })}
                                    className="w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-neutral-700 focus:outline-none focus:border-brand-dark dark:bg-neutral-800 dark:text-neutral-200"
                                    placeholder="+62..."
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-neutral-500 uppercase mb-1">Email (Optional)</label>
                                <input
                                    type="email"
                                    value={customerInfo.email}
                                    onChange={e => setCustomerInfo({ ...customerInfo, email: e.target.value })}
                                    className="w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-neutral-700 focus:outline-none focus:border-brand-dark dark:bg-neutral-800 dark:text-neutral-200"
                                    placeholder="email@example.com"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 dark:text-neutral-500 uppercase mb-1">Notes</label>
                            <textarea
                                value={customerInfo.notes}
                                onChange={e => setCustomerInfo({ ...customerInfo, notes: e.target.value })}
                                className="w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-neutral-700 focus:outline-none focus:border-brand-dark dark:bg-neutral-800 dark:text-neutral-200"
                                rows={2}
                                placeholder="Any special notes?"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 bg-studio-blue text-white font-bold rounded-lg mt-4 hover:bg-studio-blue/85 transition-colors flex items-center justify-center gap-2"
                        >
                            {loading && <Loader2 size={18} className="animate-spin" />}
                            {loading ? 'Confirming...' : 'Confirm Booking'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
