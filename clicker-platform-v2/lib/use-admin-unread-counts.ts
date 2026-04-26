'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { db, auth } from '@/lib/firebase';
import { useSite } from '@/lib/site-context';
import { logger } from '@/lib/logger-edge';

interface AdminUnreadCounts {
    unreadInbox: number;
    newBookings: number;
}

export function useAdminUnreadCounts(): AdminUnreadCounts {
    const { siteId } = useSite();
    const [unreadInbox, setUnreadInbox] = useState(0);
    const [newBookings, setNewBookings] = useState(0);

    useEffect(() => {
        if (!siteId || siteId === 'default' || siteId === 'pending') return;

        let unsubInbox: (() => void) | null = null;
        let unsubBookings: (() => void) | null = null;

        const unsubAuth = onAuthStateChanged(auth, (user: FirebaseUser | null) => {
            if (unsubInbox) { unsubInbox(); unsubInbox = null; }
            if (unsubBookings) { unsubBookings(); unsubBookings = null; }

            if (user) {
                try {
                    unsubInbox = onSnapshot(
                        query(collection(db, 'sites', siteId, 'inbox'), where('status', '==', 'new')),
                        (snap) => setUnreadInbox(snap.size),
                        (err) => logger.error('admin.inbox.listener.failed', { siteId, error: err }),
                    );
                    unsubBookings = onSnapshot(
                        query(collection(db, 'sites', siteId, 'modules/reservation/bookings'), where('status', '==', 'pending')),
                        (snap) => setNewBookings(snap.size),
                        (err) => logger.error('admin.bookings.listener.failed', { siteId, error: err }),
                    );
                } catch (e) {
                    logger.error('admin.unread.setup.failed', { siteId: siteId ?? 'platform', error: e });
                }
            } else {
                setUnreadInbox(0);
                setNewBookings(0);
            }
        });

        return () => {
            unsubAuth();
            if (unsubInbox) unsubInbox();
            if (unsubBookings) unsubBookings();
        };
    }, [siteId]);

    return { unreadInbox, newBookings };
}
