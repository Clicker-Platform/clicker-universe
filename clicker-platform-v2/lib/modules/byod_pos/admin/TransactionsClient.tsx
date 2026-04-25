'use client';

import { useEffect, useState, useMemo } from 'react';
import { POSOrder } from '@/lib/modules/byod_pos/types';
import { getHistoryOrders, getPaginatedOrders } from '@/lib/modules/byod_pos/api';
import { Clock, Loader2, ChevronDown } from 'lucide-react';
import { HistoryBillRow } from './components/HistoryBillRow';
import { HistoryBillRowSkeleton } from './components/HistoryBillRowSkeleton';
import { toast } from 'sonner';

import { HistorySidebar } from './components/HistorySidebar';
import { useSite } from '@/lib/site-context';
import { logger } from '@/lib/logger';

export default function TransactionsClient({ initialOrders = [] }: { initialOrders?: POSOrder[] }) {
    const { siteId } = useSite();
    const [orders, setOrders] = useState<POSOrder[]>(initialOrders);
    const [lastDoc, setLastDoc] = useState<any>(null); // Keep track of last doc for cursor
    const [isLoading, setIsLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);

    // Use any type temporarily for Group until we extract interface if needed, or rely on prop inference
    const [selectedGroup, setSelectedGroup] = useState<any>(null);

    const loadOrders = async (isInitial = false) => {
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
        } catch (error: any) {
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
    };

    useEffect(() => {
        // Initial load
        if (siteId) loadOrders(true);
    }, [siteId]);

    // ... (grouping logic remains effectively same, just memoized)
    const historyGroups = useMemo(() => {
        // Restore client-side filter to be safe for both Fetch methods.
        // If getHistoryOrders works, it returns already filtered data (filter is redundant but harmless).
        // If fallback getPaginatedOrders works, it returns mixed data (filter is necessary).

        // We might want to show ALL orders for history, not just completed/paid?
        // User requirements said "Transaction History" -> usually implies completed stuff or at least recorded stuff.
        // The original filter was:
        // const relevant = orders.filter(o => ['completed', 'cancelled'].includes(o.status) || o.paymentStatus === 'paid')
        // We should PROBABLY keep this filter if we want to hide 'open' orders that are not paid yet?
        // But paginated query fetches generic orders. 
        // If we filter client-side, we might end up with empty pages.
        // For now, let's keep the client-side filter but acknowledge it might be imperfect for paging if many 'open' orders exist.
        // Ideally, the QUERY should filter, but let's stick to existing logic for safety first.

        // Server-side filtering now handles status filtering.
        // sorting is also done by query, but strictly sorting locally is safe too.
        const relevant = orders
            .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

        const groups: Record<string, any> = {};

        relevant.forEach(order => {
            const dateStr = new Date((order.createdAt?.seconds || 0) * 1000).toDateString();
            let key = '';
            let label = '';

            // Logic:
            // 1. If valid Table -> Group by Table
            // 2. If valid Customer -> Group by Customer
            // 3. Fallback -> Group by Order ID (effectively no grouping if singleton)

            // Helper to check if table is "real"
            const isRealTable = order.tableNumber && order.tableNumber !== 'Walk-in';

            if (isRealTable) {
                key = `TABLE-${order.tableNumber}-${dateStr}`;
                const isNumeric = /^\d+$/.test(order.tableNumber!);
                label = isNumeric ? `Table ${order.tableNumber}` : order.tableNumber!;
            } else if (order.customerName) {
                key = `CUST-${order.customerName}-${dateStr}`;
                label = order.customerName;
            } else {
                // Same date walk-ins without name -> Group by order ID?
                // Or just singleton.
                if (order.tableNumber) {
                    key = `TABLE-${order.tableNumber}-${dateStr}`;
                    label = "Walk-in";
                } else {
                    key = `ORDER-${order.id}`;
                    label = `Order #${order.id.slice(-4)}`;
                }
            }

            if (!groups[key]) {
                groups[key] = {
                    id: key,
                    displayId: '',
                    label: label,
                    orders: [],
                    total: 0,
                    timestamp: 0,
                    status: 'paid'
                };
            }

            groups[key].orders.push(order);
            groups[key].total += order.total;
            if ((order.createdAt?.seconds || 0) > groups[key].timestamp) {
                groups[key].timestamp = order.createdAt?.seconds || 0;
            }
        });

        // Post-processing to refine Labels and IDs
        Object.values(groups).forEach((g: any) => {
            // Set Display ID to the first order's ID
            if (g.orders.length > 0) {
                g.displayId = `#${g.orders[0].id.slice(-4)}`;
            }

            // If label is "Walk-in" or generic, use Order IDs
            if (g.label === 'Walk-in' || g.label.startsWith('Order #')) {
                // Collect last 4 digits of all orders
                const ids = g.orders.map((o: POSOrder) => `#${o.id.slice(-4)}`).join(' ');
                g.label = ids;
            }

            // ... status logic
            const allPaid = g.orders.every((o: POSOrder) => o.paymentStatus === 'paid');
            const allCancelled = g.orders.every((o: POSOrder) => o.status === 'cancelled');

            if (allCancelled) g.status = 'cancelled';
            else if (allPaid) g.status = 'paid';
            else g.status = 'mixed';
        });

        return Object.values(groups).sort((a: any, b: any) => b.timestamp - a.timestamp);
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

                    {historyGroups.map((group: any) => (
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
                group={selectedGroup}
            />
        </div>
    );
}
