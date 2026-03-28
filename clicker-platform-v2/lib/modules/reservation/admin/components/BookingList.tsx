import React from 'react';
import { Booking } from '@/lib/modules/reservation/types';
import { Calendar, Clock } from 'lucide-react';
import { StatusBadge } from './StatusBadge';

const getDate = (date: any): Date => {
    if (!date) return new Date();
    return date.toDate ? date.toDate() : new Date(date);
};

interface BookingListProps {
    bookings: Booking[];
    selectedId: string | null;
    onSelect: (booking: Booking) => void;
    activeTab: 'all' | 'new' | 'confirmed' | 'done';
    onTabChange: (tab: 'all' | 'new' | 'confirmed' | 'done') => void;
    counts: { all: number; new: number; confirmed: number; done: number };
    hasMore: boolean;
    onLoadMore: () => void;
    loadingMore: boolean;
}

export function BookingList({ bookings, selectedId, onSelect, activeTab, onTabChange, counts, hasMore, onLoadMore, loadingMore }: BookingListProps) {
    return (
        <div className="flex flex-col h-full bg-gray-50/30 dark:bg-neutral-800/20 min-h-0">
            <div className="p-4 border-b border-gray-100 dark:border-neutral-800 flex-shrink-0 bg-white dark:bg-neutral-900">
                <h2 className="text-lg font-bold text-brand-dark mb-4">Booking List</h2>

                {/* Filter Tabs */}
                <div className="flex items-center gap-4 overflow-x-auto pb-1 scrollbar-hide">
                    <FilterTab
                        label="All"
                        count={counts.all}
                        isActive={activeTab === 'all'}
                        onClick={() => onTabChange('all')}
                    />
                    <FilterTab
                        label="New"
                        count={counts.new}
                        isActive={activeTab === 'new'}
                        onClick={() => onTabChange('new')}
                        colorClass="bg-orange-100 text-orange-700"
                    />
                    <FilterTab
                        label="Confirmed"
                        count={counts.confirmed}
                        isActive={activeTab === 'confirmed'}
                        onClick={() => onTabChange('confirmed')}
                        colorClass="bg-green-100 text-green-700"
                    />
                    <FilterTab
                        label="Done"
                        count={counts.done}
                        isActive={activeTab === 'done'}
                        onClick={() => onTabChange('done')}
                    />
                </div>
            </div>

            <div className="overflow-y-auto flex-1 min-h-0 p-2 space-y-1">
                {bookings.length === 0 ? (
                    <p className="p-8 text-center text-gray-500 dark:text-neutral-500 text-sm">No bookings in this filter.</p>
                ) : (
                    <>
                        {bookings.map((booking, index) => {
                            const currentDate = getDate(booking.createdAt || booking.startAt); // Fallback to startAt if createdAt missing
                            const dateString = currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: '2-digit' }).replace(',', ' -');

                            let showDivider = false;
                            if (index === 0) {
                                showDivider = true;
                            } else {
                                const prevDate = getDate(bookings[index - 1].createdAt || bookings[index - 1].startAt);
                                const prevDateString = prevDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: '2-digit' }).replace(',', ' -');
                                if (dateString !== prevDateString) {
                                    showDivider = true;
                                }
                            }

                            return (
                                <React.Fragment key={booking.id}>
                                    {showDivider && (
                                        <div className="sticky top-0 z-10 bg-gray-50/95 dark:bg-neutral-800/95 backdrop-blur-sm py-2 px-4 text-xs font-bold text-gray-500 dark:text-neutral-500 uppercase tracking-wider border-b border-gray-100/50 dark:border-neutral-700/50 shadow-sm mx-2 rounded-lg mt-2 mb-1">
                                            {dateString}
                                        </div>
                                    )}
                                    <div
                                        onClick={() => onSelect(booking)}
                                        className={`p-4 rounded-xl cursor-pointer transition-all border mx-2 ${selectedId === booking.id
                                            ? 'bg-white dark:bg-neutral-800 border-brand-dark shadow-sm ring-1 ring-brand-dark/5'
                                            : !booking.isRead
                                                ? 'bg-orange-50 dark:bg-orange-950/20 border-orange-100 dark:border-orange-900/30 shadow-sm'
                                                : 'bg-transparent border-transparent hover:bg-white dark:hover:bg-neutral-800 hover:border-gray-200 dark:hover:border-neutral-700 hover:shadow-sm'
                                            }`}
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <p className={`text-sm ${!booking.isRead ? 'font-bold text-gray-900 dark:text-neutral-100' : 'font-medium text-gray-700 dark:text-neutral-300'}`}>
                                                {booking.customerName}
                                                {!booking.isRead && (
                                                    <span className="ml-2 inline-block w-2 h-2 rounded-full bg-brand-dark animate-pulse" />
                                                )}
                                            </p>
                                            <StatusBadge status={booking.status} />
                                        </div>
                                        <p className="text-xs text-gray-600 dark:text-neutral-400 mb-1 font-medium">{booking.serviceName}</p>
                                        <div className="mt-2 flex items-center gap-3 text-xs font-bold text-gray-700 dark:text-neutral-300">
                                            {booking.preferredDate ? (
                                                <>
                                                    <span className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/20 px-2 py-1 rounded-md border border-amber-100 dark:border-amber-900/30 text-amber-700 dark:text-amber-400">
                                                        On Request
                                                    </span>
                                                    <span className="flex items-center gap-1.5 bg-gray-50 dark:bg-neutral-800 px-2 py-1 rounded-md border border-gray-100 dark:border-neutral-700">
                                                        <Calendar size={14} className="text-brand-dark" />
                                                        {booking.preferredDate}
                                                    </span>
                                                </>
                                            ) : (
                                                <>
                                                    <span className="flex items-center gap-1.5 bg-gray-50 dark:bg-neutral-800 px-2 py-1 rounded-md border border-gray-100 dark:border-neutral-700">
                                                        <Calendar size={14} className="text-brand-dark" />
                                                        {getDate(booking.startAt).toLocaleDateString()}
                                                    </span>
                                                    <span className="flex items-center gap-1.5 bg-gray-50 dark:bg-neutral-800 px-2 py-1 rounded-md border border-gray-100 dark:border-neutral-700">
                                                        <Clock size={14} className="text-brand-dark" />
                                                        {getDate(booking.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </React.Fragment>
                            );
                        })}

                        {hasMore && (
                            <button
                                onClick={onLoadMore}
                                disabled={loadingMore}
                                className="w-full py-3 text-sm font-bold text-gray-500 dark:text-neutral-500 hover:text-brand-dark hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-xl mt-2 transition-colors disabled:opacity-50"
                            >
                                {loadingMore ? 'Loading...' : 'Load More'}
                            </button>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

function FilterTab({ label, count, isActive, onClick, colorClass = "bg-gray-100 text-gray-500" }: { label: string, count: number, isActive: boolean, onClick: () => void, colorClass?: string }) {
    return (
        <button
            onClick={onClick}
            className={`text-sm font-bold whitespace-nowrap transition-colors relative pb-1 flex items-center gap-2 ${isActive
                ? 'text-brand-dark border-b-2 border-brand-dark'
                : 'text-gray-400 dark:text-neutral-600 hover:text-gray-600 dark:hover:text-neutral-400 border-b-2 border-transparent'
                }`}
        >
            {label}
            <span className={`px-2 py-0.5 rounded-full text-xs ${isActive && colorClass !== "bg-gray-100 text-gray-500" ? colorClass : 'bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-neutral-500'}`}>
                {count}
            </span>
        </button>
    );
}
