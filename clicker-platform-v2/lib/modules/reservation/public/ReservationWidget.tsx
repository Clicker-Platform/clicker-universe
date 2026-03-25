'use client';

import { useEffect, useState } from 'react';
import BookingForm from './BookingForm';
import { getServices, getReservationSettings } from '../api';
import { getStaffMembers } from '../staff';
import { Service, Staff } from '../types';
import { useSite } from '@/lib/site-context';

export default function ReservationWidget({
    siteId: propSiteId,
    initialServices,
    initialStaff,
    initialSettings
}: {
    siteId?: string;
    initialServices?: any[];
    initialStaff?: any[];
    initialSettings?: any;
}) {
    const { siteId: contextSiteId } = useSite();
    const siteId = propSiteId || contextSiteId;
    const [loading, setLoading] = useState(!Array.isArray(initialServices));
    const [data, setData] = useState<{
        services: Service[];
        staff: Staff[];
        settings: any;
    } | null>(
        Array.isArray(initialServices)
            ? { services: initialServices as Service[], staff: (initialStaff || []) as Staff[], settings: initialSettings || {} }
            : null
    );

    useEffect(() => {
        async function load() {
            if (Array.isArray(initialServices)) return;

            if (!siteId) {
                console.error("ReservationWidget: siteId is missing");
                setLoading(false);
                return;
            }

            try {
                const [services, staff, settings] = await Promise.all([
                    getServices(siteId),
                    getStaffMembers(siteId, true),
                    getReservationSettings(siteId)
                ]);
                setData({ services, staff, settings });
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
                initialSettings={data.settings}
            />
        </div>
    );
}
