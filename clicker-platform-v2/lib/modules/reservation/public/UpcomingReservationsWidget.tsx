'use client';

import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Calendar, Clock, MapPin } from 'lucide-react';
import { useSite } from '@/lib/site-context';
import { logger } from '@/lib/logger-edge';

// Define strict minimal interface for what we read
interface WidgetBooking {
    id: string;
    serviceName: string;
    startAt: any; // Timestamp
    status: string;
    totalPrice: number;
}

export default function UpcomingReservationsWidget({ memberPhone }: { memberPhone?: string }) {
    const { siteId } = useSite();
    const [bookings, setBookings] = useState<WidgetBooking[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchBookings() {
            if (!memberPhone || !siteId) {
                setLoading(false);
                return;
            }

            try {
                // Find future bookings for this phone number
                const now = new Date();
                const q = query(
                    collection(db, 'sites', siteId, 'modules/reservation/bookings'),
                    where('customerPhone', '==', memberPhone),
                    where('startAt', '>=', Timestamp.fromDate(now)),
                    orderBy('startAt', 'asc')
                    // limit(3) // Optional limit
                );

                const snapshot = await getDocs(q);
                const data = snapshot.docs
                    .map(d => ({ id: d.id, ...d.data() } as WidgetBooking))
                    .filter(b => b.status === 'confirmed' || b.status === 'pending'); // Filter locally or via compound query if index exists

                setBookings(data);
            } catch (err) {
                logger.error('reservation.widget.bookings.fetch.failed', { siteId, error: err });
            } finally {
                setLoading(false);
            }
        }
        fetchBookings();
    }, [memberPhone, siteId]);

    if (loading) return <div className="animate-pulse h-20 bg-gray-100 rounded-xl"></div>;

    if (bookings.length === 0) {
        return null; // Don't show if nothing upcoming
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2 mb-2">
                <Calendar size={16} className="text-indigo-600" />
                <h3 className="font-semibold text-gray-700 text-sm">Upcoming Reservations</h3>
            </div>

            {bookings.map(booking => {
                const date = booking.startAt?.toDate ? booking.startAt.toDate() : new Date();
                return (
                    <div key={booking.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-indigo-500">
                        <div className="flex justify-between items-start">
                            <div>
                                <h4 className="font-bold text-gray-800">{booking.serviceName}</h4>
                                <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                                    <span suppressHydrationWarning className="flex items-center gap-1"><Calendar size={12} /> {date.toLocaleDateString()}</span>
                                    <span suppressHydrationWarning className="flex items-center gap-1"><Clock size={12} /> {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                            </div>
                            <span className={`text-[10px] px-2 py-1 rounded-full uppercase font-bold ${booking.status === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                {booking.status}
                            </span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
