'use client';

import { useEffect, useState, useMemo } from 'react';
import { POSOrder } from '@/lib/modules/byod_pos/types';
import { subscribeToRecentOrders, updateOrderStatus, cancelOrder } from '@/lib/modules/byod_pos/api';
import { ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';
import { POSOrderCard } from './components/POSOrderCard';
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog';
import { useSite } from '@/lib/site-context'; // New import

export default function KDSClient({ initialOrders = [] }: { initialOrders?: POSOrder[] }) {
    const { siteId } = useSite();
    const [orders, setOrders] = useState<POSOrder[]>(initialOrders);

    // Cancellation State
    const [cancelConfig, setCancelConfig] = useState<{ isOpen: boolean; orderId: string | null }>({
        isOpen: false,
        orderId: null
    });

    useEffect(() => {
        if (!siteId) return;
        const unsubscribe = subscribeToRecentOrders(siteId, (fetchedOrders) => {
            setOrders(fetchedOrders);
        });
        return () => unsubscribe();
    }, [siteId]);

    const handleUpdateStatus = async (order: POSOrder, newStatus: POSOrder['status']) => {
        if (!siteId) return;
        try {
            await updateOrderStatus(siteId, order, newStatus);
            toast.success(`Order moved to ${newStatus}`);
        } catch (error: any) {
            console.error("Status update failed:", error);
            if (error.message?.includes("Item does not exist")) {
                toast.error("Inventory Item Deleted! Cannot process stock.");
            } else {
                toast.error("Failed to update status");
            }
        }
    };

    const handleCancelClick = (order: POSOrder) => {
        setCancelConfig({ isOpen: true, orderId: order.id });
    };

    const confirmCancel = async () => {
        if (!cancelConfig.orderId || !siteId) return;
        try {
            await cancelOrder(siteId, cancelConfig.orderId);
            toast.success("Order cancelled");
            setCancelConfig({ isOpen: false, orderId: null });
        } catch (error) {
            console.error("Cancellation failed:", error);
            toast.error("Failed to cancel order");
        }
    };

    // Derived Status for KDS: Open, Pending, Preparing, Ready
    // Exclude 'completed' orders as they are done for kitchen.
    const kdsOrders = useMemo(() =>
        orders.filter(o => ['open', 'pending', 'preparing', 'ready'].includes(o.status) && o.paymentStatus !== 'paid')
            .sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)),
        [orders]);

    return (
        <div>
            <div className="hidden md:flex items-center gap-4 mb-8">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-neutral-100">Kitchen display</h1>
                <div className="ml-auto flex items-center gap-2">
                    <span className="bg-studio-blue text-white px-3 py-1 rounded-full font-bold text-sm">
                        {kdsOrders.length} Active
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 md:gap-6 animate-in fade-in duration-300">
                {kdsOrders.map(order => (
                    <div key={order.id} className="transition-all duration-500 ease-out">
                        <POSOrderCard
                            order={order}
                            onUpdateStatus={handleUpdateStatus}
                            onCancel={handleCancelClick}
                            kds={true}
                        // KDS View Only: No payment processing here to keep it simple?
                        // Or allow it if kitchen handles payment (rare). 
                        // Let's pass undefined to hide it or keep minimal.
                        />
                    </div>
                ))}

                {kdsOrders.length === 0 && (
                    <div className="col-span-full py-20 flex flex-col items-center justify-center text-gray-400 dark:text-neutral-600 bg-white dark:bg-neutral-900 rounded-xl border border-dashed border-gray-200 dark:border-neutral-800">
                        <ShoppingBag size={48} className="mb-4 opacity-20" />
                        <p className="font-bold text-lg">All caught up!</p>
                        <p className="text-sm">No active orders to prepare.</p>
                    </div>
                )}
            </div>

            <ConfirmationDialog
                isOpen={cancelConfig.isOpen}
                title="Cancel Order"
                message="Are you sure you want to cancel this order? This will remove it from the list and restore relevant stock."
                confirmLabel="Yes, Cancel Order"
                cancelLabel="Keep Order"
                isDestructive={true}
                onConfirm={confirmCancel}
                onCancel={() => setCancelConfig({ isOpen: false, orderId: null })}
            />
        </div>
    );
}
