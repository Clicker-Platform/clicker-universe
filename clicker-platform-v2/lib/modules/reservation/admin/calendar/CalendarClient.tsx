'use client';

import { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Clock, Save } from 'lucide-react';
import { getWeeklySlots, saveWeeklySlots } from '@/lib/modules/reservation/api';
import { TimeSlot } from '@/lib/modules/reservation/types';
import { useSite } from '@/lib/site-context';

import { ReservationBreadcrumb } from '../components/ReservationBreadcrumb';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function CalendarClient() {
    const { siteId } = useSite();
    const [schedule, setSchedule] = useState([
        { day: 1, dayName: 'Monday', start: '09:00', end: '17:00', active: true },
        { day: 2, dayName: 'Tuesday', start: '09:00', end: '17:00', active: true },
        { day: 3, dayName: 'Wednesday', start: '09:00', end: '17:00', active: true },
        { day: 4, dayName: 'Thursday', start: '09:00', end: '17:00', active: true },
        { day: 5, dayName: 'Friday', start: '09:00', end: '17:00', active: true },
        { day: 6, dayName: 'Saturday', start: '10:00', end: '15:00', active: true },
        { day: 0, dayName: 'Sunday', start: '00:00', end: '00:00', active: false },
    ]);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    useEffect(() => {
        if (showSuccess) {
            const timer = setTimeout(() => setShowSuccess(false), 3000);
            return () => clearTimeout(timer);
        }
    }, [showSuccess]);

    useEffect(() => {
        if (!siteId) return;
        const fetchSlots = async () => {
            try {
                const slots = await getWeeklySlots(siteId);
                if (slots.length > 0) {
                    // Merge DB slots into schedule structure
                    setSchedule(prev => prev.map(dayItem => {
                        const daySlot = slots.find(s => s.dayOfWeek === dayItem.day);
                        if (daySlot) {
                            return {
                                ...dayItem,
                                start: daySlot.startTime,
                                end: daySlot.endTime,
                                active: daySlot.isActive
                            };
                        }
                        return { ...dayItem, active: false }; // If not in DB, assume closed or keep default? Let's say closed if DB has data
                    }));
                }
            } catch (error) {
                console.error("Error fetching slots:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchSlots();
    }, [siteId]);

    const handleUpdate = (index: number, field: string, value: any) => {
        const newSchedule = [...schedule];
        newSchedule[index] = { ...newSchedule[index], [field]: value };
        setSchedule(newSchedule);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            // Transform to TimeSlots
            const slotsToSave: Omit<TimeSlot, 'id'>[] = schedule.map(item => ({
                dayOfWeek: item.day,
                startTime: item.start,
                endTime: item.end,
                isActive: item.active,
                maxConcurrent: 1 // Default for now, though API checks staff count primarily
            }));

            await saveWeeklySlots(siteId, slotsToSave);
            setShowSuccess(true);
        } catch (error) {
            console.error("Error saving schedule:", error);
            alert("Failed to save schedule");
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) return <div className="p-8">Loading schedule...</div>;

    return (
        <div>
            <ReservationBreadcrumb currentPage="Calendar Settings" />
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-black text-brand-dark mb-2 uppercase">Calendar Settings</h1>
                    <p className="text-gray-600 dark:text-neutral-400 font-medium">Manage your business hours and availability</p>
                </div>
                <div className="flex items-center gap-4">
                    {showSuccess && (
                        <span className="text-green-600 font-bold bg-green-50 px-4 py-2 rounded-lg border border-green-100 animate-in fade-in slide-in-from-bottom-2">
                            Changes saved successfully
                        </span>
                    )}
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="bg-brand-dark text-white px-6 py-2.5 rounded-xl font-bold hover:bg-brand-dark/90 flex items-center gap-2 disabled:opacity-50 transition-all"
                    >
                        <Save size={20} /> {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm">
                <h2 className="text-xl font-bold text-brand-dark mb-6 flex items-center gap-2">
                    <Clock size={24} /> Weekly Schedule
                </h2>

                <div className="space-y-4">
                    {schedule.map((slot, index) => (
                        <div key={slot.day} className={`flex items-center gap-4 p-4 rounded-xl border ${slot.active ? 'border-gray-200 bg-white' : 'border-dashed border-gray-200 bg-gray-50'}`}>
                            <div className="w-32 font-bold text-brand-dark flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={slot.active}
                                    onChange={(e) => handleUpdate(index, 'active', e.target.checked)}
                                    className="w-5 h-5 rounded border-gray-300 text-brand-dark focus:ring-brand-dark"
                                />
                                {slot.dayName}
                            </div>

                            {slot.active ? (
                                <div className="flex items-center gap-3">
                                    <input
                                        type="time"
                                        value={slot.start}
                                        onChange={(e) => handleUpdate(index, 'start', e.target.value)}
                                        className="px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:border-brand-dark font-mono"
                                    />
                                    <span className="text-gray-400 font-bold">-</span>
                                    <input
                                        type="time"
                                        value={slot.end}
                                        onChange={(e) => handleUpdate(index, 'end', e.target.value)}
                                        className="px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:border-brand-dark font-mono"
                                    />
                                </div>
                            ) : (
                                <span className="text-gray-400 font-medium italic">Closed</span>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
