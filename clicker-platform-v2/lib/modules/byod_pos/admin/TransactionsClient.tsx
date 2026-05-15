'use client';

import { useCallback, useEffect, useState, useMemo } from 'react';
import { QueryDocumentSnapshot } from 'firebase/firestore';
import { POSOrder } from '@/lib/modules/byod_pos/types';
import { getHistoryOrders, getPaginatedOrders } from '@/lib/modules/byod_pos/api';
import { Clock, Loader2, ChevronDown } from 'lucide-react';
import { HistoryBillRow } from './components/HistoryBillRow';
import { HistoryBillRowSkeleton } from './components/HistoryBillRowSkeleton';
import { toast } from 'sonner';

import { HistorySidebar } from './components/HistorySidebar';
import { useSite } from '@/lib/site-context';
import { logger } from '@/lib/logger-edge';

export default function TransactionsClient({ initialOrders = [] }: { initialOrders?: POSOrder[] }) {
    const { siteId } = useSite();
    const [orders, setOrders] = useState<POSOrder[]>(initialOrders);
    const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null); // Keep track of last doc for cursor
    const [isLoading, setIsLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);

    const [selectedGroup, setSelectedGroup] = useState<Record<string, unknown> | null>(null);

    const loadOrders = useCallback(async (isInitial = false) => {
        if (!siteId) return;
        setIsLoading(true);
        try {
            const cursor = isInitial ? null : lastDoc;
            // Try optimized fetch first
            const { orders: newOrders, lastVisible } = await getHistoryOrders(siteId, cursor, 20);

            if (isInitial) {
                setOrders(newOrders);
            } else {
                setOrders(prev => [...prev, ...newOrders]);
            }

            setLastDoc(lastVisible);
            setHasMore(newOrders.length === 20);
        } catch (error: unknown) {
            logger.warn('pos.transactions.history.optimized.failed', { siteId, error });

            // Fallback: Standard fetch
            try {
                const cursor = isInitial ? null : lastDoc;
                const { orders: newOrders, lastVisible } = await getPaginatedOrders(siteId, cursor, 20);

                if (isInitial) {
                    setOrders(newOrders);
                } else {
                    setOrders(prev => [...prev, ...newOrders]);
                }

                setLastDoc(lastVisible);
                setHasMore(newOrders.length === 20);

                if (isInitial && newOrders.length === 0) {
                    // Silent failure or empty
                }
            } catch (fallbackError) {
                logger.error('pos.transactions.history.fallback.failed', { siteId, error: fallbackError });
                toast.error("Failed to load history");
            }
        } finally {
            setIsLoading(false);
        }
    }, [siteId, lastDoc]);

    useEffect(() => {
        // Initial load
        if (siteId) loadOrders(true);
    }, [siteId, loadOrders]);

    // Each order is its own row — no grouping. Combining causes confusion when
    // unrelated walk-in orders share table/customer keys.
    const historyGroups = useMemo(() => {
        const sorted = [...orders].sort(
            (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
        );

        return sorted.map(order => {
            const isRealTable = order.tableNumber && order.tableNumber !== 'Walk-in';
            let label: string;
            if (isRealTable) {
                const isNumeric = /^\d+$/.test(order.tableNumber!);
                label = isNumeric ? `Table ${order.tableNumber}` : order.tableNumber!;
            } else if (order.customerName) {
                label = order.customerName;
            } else {
                label = `#${order.id.slice(-4)}`;
            }

            const status: 'paid' | 'cancelled' | 'mixed' =
                order.status === 'cancelled' ? 'cancelled'
                : order.paymentStatus === 'paid' ? 'paid'
                : 'mixed';

            return {
                id: order.id,
                displayId: `#${order.id.slice(-4)}`,
                label,
                orders: [order],
                total: order.total,
                timestamp: order.createdAt?.seconds || 0,
                status,
            };
        });
    }, [orders]);

    return (
        <div>
            <div className="hidden md:flex items-center gap-4 mb-8">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-neutral-100">Transaction history</h1>
            </div>

            <div className="bg-white dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800 overflow-hidden animate-in fade-in duration-300">
                <div className="divide-y divide-gray-100 dark:divide-neutral-800">
                    {/* Skeleton Loading State */}
                    {isLoading && orders.length === 0 && (
                        Array.from({ length: 5 }).map((_, i) => (
                            <HistoryBillRowSkeleton key={i} />
                        ))
                    )}

                    {historyGroups.map((group) => (
                        <HistoryBillRow
                            key={group.id}
                            group={group}
                            onClick={() => setSelectedGroup(group)}
                        />
                    ))}
                </div>

                {historyGroups.length === 0 && !isLoading && (
                    <div className="py-20 flex flex-col items-center justify-center text-gray-400 dark:text-neutral-600">
                        <Clock size={48} className="mb-4 opacity-20" />
                        <p className="font-bold text-lg">No history yet</p>
                        <p className="text-sm">Completed transactions will appear here.</p>
                    </div>
                )}

                {/* Load More Trigger */}
                {historyGroups.length > 0 && hasMore && (
                    <div className="p-4 flex justify-center bg-gray-50 dark:bg-neutral-800/50 border-t border-gray-100 dark:border-neutral-800">
                        <button
                            onClick={() => loadOrders(false)}
                            disabled={isLoading}
                            className="flex items-center gap-2 px-6 py-2 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-full text-sm font-bold text-gray-600 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-800 hover:border-gray-300 dark:hover:border-neutral-700 transition-all disabled:opacity-50"
                        >
                            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <ChevronDown size={16} />}
                            {isLoading ? 'Loading...' : 'Load More Transactions'}
                        </button>
                    </div>
                )}
            </div>

            <HistorySidebar
                isOpen={!!selectedGroup}
                onClose={() => setSelectedGroup(null)}
                group={selectedGroup as unknown as { id: string; label: string; orders: import('@/lib/modules/byod_pos/types').POSOrder[]; total: number; timestamp: number; status: 'cancelled' | 'paid' | 'mixed' } | null}
            />
        </div>
    );
}
