'use client';

import { useEffect, useState, useMemo } from 'react';
import {
    getBookings,
    getServices,
    getReservationSettings,
    updateBookingStatus,
    updateBookingDetails,
    getStaffMembers,
    markBookingAsRead,
    getBookingCounts
} from '@/lib/modules/reservation/api';
import { Booking, Service, Staff } from '@/lib/modules/reservation/types';
import { useSite } from '@/lib/site-context';

import Link from 'next/link';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';

// Components
import { BookingList } from './components/BookingList';
import { BookingDetailPanel } from './components/BookingDetailPanel';
import { CreateBookingModal } from './components/CreateBookingModal';
import { ReservationSkeleton } from '@/components/skeletons/ReservationSkeleton';

export default function ReservationDashboard() {
    const { siteId } = useSite();
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [lastDoc, setLastDoc] = useState<any>(null);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [counts, setCounts] = useState({ all: 0, new: 0, confirmed: 0, done: 0 });

    const [allServices, setAllServices] = useState<Service[]>([]);
    const [allStaff, setAllStaff] = useState<Staff[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [settings, setSettings] = useState({ allowStaffSelection: false });

    // Filter Tabs State
    const [activeTab, setActiveTab] = useState<'all' | 'new' | 'confirmed' | 'done'>('all');
    const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

    // Initial Data Load (Static)
    useEffect(() => {
        if (!siteId) return;

        async function loadStaticData() {
            try {
                const [services, settingsData, staffData, _counts] = await Promise.all([
                    getServices(siteId),
                    getReservationSettings(siteId),
                    getStaffMembers(siteId),
                    getBookingCounts(siteId)
                ]);

                setAllServices(services);
                setSettings(settingsData);
                setAllStaff(staffData);
                setCounts(_counts);
            } catch (error) {
                console.error("Error fetching reservation setup:", error);
                toast.error("Failed to load setup data");
            }
        }
        loadStaticData();
    }, [siteId]);

    // Fetch Bookings when Link Tab changes or Reload
    useEffect(() => {
        if (!siteId) return;
        loadBookings(false); // Reset list
    }, [activeTab, siteId]);

    const refreshCounts = async () => {
        if (!siteId) return;
        const _counts = await getBookingCounts(siteId);
        setCounts(_counts);
    }

    const loadBookings = async (isLoadMore: boolean = false) => {
        try {
            if (isLoadMore) setLoadingMore(true);
            else setLoading(true);

            const statusFilter =
                activeTab === 'all' ? undefined :
                    activeTab === 'new' ? 'pending' :
                        activeTab === 'confirmed' ? 'confirmed' :
                            ['completed', 'cancelled'];

            const cursor = isLoadMore ? lastDoc : null;

            // @ts-ignore
            const { bookings: newBookings, lastDoc: newLastDoc } = await getBookings(siteId, statusFilter, 20, cursor);

            if (isLoadMore) {
                setBookings(prev => [...prev, ...newBookings]);
            } else {
                setBookings(newBookings);
            }

            setLastDoc(newLastDoc);
            setHasMore(!!newLastDoc);
        } catch (error) {
            console.error("Error fetching bookings:", error);
            toast.error("Failed to load bookings");
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };

    // Handlers
    const handleBookingSelect = async (booking: Booking) => {
        setSelectedBooking(booking);

        // Mark as read if not already
        if (booking.isRead === false || booking.isRead === undefined) {
            setBookings(prev => prev.map(b =>
                b.id === booking.id ? { ...b, isRead: true } : b
            ));
            markBookingAsRead(siteId, booking.id).catch(console.error);
            // Update New count locally
            if (activeTab === 'new') {
                // If we are in 'New' tab, marking as read doesn't remove it from 'pending' status, 
                // but usually 'New' tab means 'pending' status. 
                // Wait, 'isRead' is just UI state, 'pending' is status.
            }
        }
    };

    const handleCreateBooking = async (formData: any) => {
        try {
            // Refresh
            loadBookings(false);
            refreshCounts();
        } catch (error) {
            console.error(error);
            toast.error("Failed to create booking");
        }
    };

    const handleStatusUpdate = async (id: string, newStatus: Booking['status'], cancellationReason?: string) => {
        const previousBookings = [...bookings];

        setBookings(prev => prev.map(b => b.id === id ? { ...b, status: newStatus, ...(cancellationReason ? { cancellationReason } : {}) } : b));

        if (selectedBooking && selectedBooking.id === id) {
            setSelectedBooking(prev => prev ? { ...prev, status: newStatus, ...(cancellationReason ? { cancellationReason } : {}) } : null);
        }

        try {
            await updateBookingStatus(siteId, id, newStatus, cancellationReason);
            toast.success(`Booking ${newStatus}`);
            refreshCounts(); // Update counts
        } catch (error) {
            console.error("Status update failed:", error);
            toast.error("Failed to update status");
            setBookings(previousBookings);
            if (selectedBooking && selectedBooking.id === id) {
                // Revert selected
            }
        }
    };

    const handleUpdateDetails = async (id: string, data: Partial<Booking>) => {
        setBookings(prev => prev.map(b => b.id === id ? { ...b, ...data } : b));
        if (selectedBooking && selectedBooking.id === id) {
            setSelectedBooking(prev => prev ? { ...prev, ...data } : null);
        }
        try {
            await updateBookingDetails(siteId, id, data);
            toast.success("Booking updated");
        } catch (error) {
            toast.error("Failed to update booking");
        }
    };

    if (loading && bookings.length === 0) {
        return <ReservationSkeleton />;
    }

    return (
        <div>
            {/* Top Bar Actions */}
            <div className="hidden md:flex items-center justify-between mb-8">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-neutral-100">Reservation</h1>
                <button
                    onClick={() => setShowCreate(true)}
                    className="flex items-center gap-1.5 bg-studio-blue text-white px-3 py-2 rounded-lg text-sm font-semibold transition-colors hover:bg-studio-blue/90 active:scale-95"
                >
                    <Plus size={15} /> New Booking
                </button>
            </div>

            {/* Mobile FAB */}
            <button
                onClick={() => setShowCreate(true)}
                className="md:hidden fixed bottom-20 right-4 z-30 w-14 h-14 bg-studio-blue text-white rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-transform"
                style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
                aria-label="New Booking"
            >
                <Plus size={24} />
            </button>

            <CreateBookingModal
                isOpen={showCreate}
                onClose={() => setShowCreate(false)}
                onSubmit={handleCreateBooking}
                services={allServices}
                staff={allStaff}

                settings={settings}
            />

            {/* Inbox Unified Container */}
            <div className="bg-white dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800 overflow-hidden grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-gray-100 dark:divide-neutral-800 h-[700px]">
                <BookingList
                    bookings={bookings}
                    selectedId={selectedBooking?.id || null}
                    onSelect={handleBookingSelect}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    counts={counts}
                    hasMore={hasMore}
                    onLoadMore={() => loadBookings(true)}
                    loadingMore={loadingMore}
                />

                <div className="hidden lg:flex lg:col-span-2 h-full overflow-y-auto bg-white dark:bg-neutral-900 flex-col relative">
                    <BookingDetailPanel
                        booking={selectedBooking}
                        onClose={() => setSelectedBooking(null)}
                        onStatusUpdate={handleStatusUpdate}
                        onUpdateDetails={handleUpdateDetails}
                        settings={settings}
                    />
                </div>
            </div>

            {/* Mobile/Tablet Detail Overlay */}
            {selectedBooking && (
                <div className="lg:hidden fixed inset-0 z-50 flex items-end md:items-stretch justify-end">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-in fade-in duration-300"
                        onClick={() => setSelectedBooking(null)}
                    />

                    {/* Responsive Panel: Bottom Sheet (Mobile) -> Sidebar (Tablet) */}
                    <div className="
                        relative z-10 bg-white dark:bg-neutral-900 shadow-2xl flex flex-col overflow-hidden
                        w-full h-[85vh] rounded-t-3xl animate-in slide-in-from-bottom duration-300
                        md:w-[600px] md:h-full md:rounded-none md:slide-in-from-right
                    ">
                        <BookingDetailPanel
                            booking={selectedBooking}
                            onClose={() => setSelectedBooking(null)}
                            onStatusUpdate={handleStatusUpdate}
                            onUpdateDetails={handleUpdateDetails}
                            settings={settings}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
