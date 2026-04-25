'use client';

import { useEffect, useState } from 'react';
import BookingForm from './BookingForm';
import { getServices, getReservationSettings } from '../api';
import { getStaffMembers } from '../staff';
import { Service, Staff } from '../types';
import { useSite } from '@/lib/site-context';
import { logger } from '@/lib/logger';

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
    const hasInitialData = Array.isArray(initialServices);
    const [loading, setLoading] = useState(!hasInitialData);
    const [data, setData] = useState<{
        services: Service[];
        staff: Staff[];
        settings: any;
    } | null>(
        hasInitialData
            ? { services: initialServices as Service[], staff: (initialStaff || []) as Staff[], settings: initialSettings || {} }
            : null
    );

    useEffect(() => {
        async function load() {
            if (hasInitialData) return;

            if (!siteId) {
                logger.error('reservation.widget.siteId.missing', { siteId: 'platform' });
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
                logger.error('reservation.widget.load.failed', { siteId, error: e });
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [siteId]);

    if (loading) {
        return <div className="py-12 text-center text-[var(--theme-foreground,#6b7280)] opacity-60">Loading reservation system...</div>;
    }

    if (!data) {
        return <div className="py-12 text-center text-red-400">Unable to load reservation system.</div>;
    }

    return (
        <div>
            <BookingForm
                siteId={siteId!}
                initialServices={data.services}
                initialStaff={data.staff}
                initialSettings={data.settings}
            />
        </div>
    );
}
