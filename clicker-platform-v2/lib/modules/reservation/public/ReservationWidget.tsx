'use client';

import { useEffect, useState } from 'react';
import BookingForm from './BookingForm';
import { getServices, getWeeklySlots, getReservationSettings } from '../api';
import { getStaffMembers } from '../staff';
import { Service, Staff, TimeSlot } from '../types';
import { useSite } from '@/lib/site-context';

export default function ReservationWidget({ siteId: propSiteId }: { siteId?: string }) {
    const { siteId: contextSiteId } = useSite();
    const siteId = propSiteId || contextSiteId;
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<{
        services: Service[];
        staff: Staff[];
        slots: TimeSlot[];
        settings: any;
    } | null>(null);

    useEffect(() => {
        async function load() {
            if (!siteId) {
                console.error("ReservationWidget: siteId is missing");
                setLoading(false);
                return;
            }

            try {
                const [services, staff, slots, settings] = await Promise.all([
                    getServices(siteId),
                    getStaffMembers(siteId, true), // active only
                    getWeeklySlots(siteId),
                    getReservationSettings(siteId)
                ]);
                setData({ services, staff, slots, settings });
            } catch (e) {
                console.error("Failed to load reservation widget data", e);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [siteId]);

    if (loading) {
        return <div className="py-12 text-center text-gray-400">Loading reservation system...</div>;
    }

    if (!data) {
        return <div className="py-12 text-center text-red-400">Unable to load reservation system.</div>;
    }

    return (
        <div className="py-8">
            <BookingForm
                siteId={siteId!}
                initialServices={data.services}
                initialStaff={data.staff}
                initialWeeklySlots={data.slots}
                initialSettings={data.settings}
            />
        </div>
    );
}
