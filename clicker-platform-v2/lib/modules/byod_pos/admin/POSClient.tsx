'use client';

import { useEffect, useState, useMemo } from 'react';
import { POSOrder } from '@/lib/modules/byod_pos/types';
import { subscribeToRecentOrders, updateOrderStatus, cancelOrder, confirmPayment } from '@/lib/modules/byod_pos/api';
import { ShoppingBag, Grid, List } from 'lucide-react';
import { toast } from 'sonner';
import { POSOrderCard } from './components/POSOrderCard';
import { POSOrderRow } from './components/POSOrderRow';
import { BillCard } from './components/BillCard';
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog';
import { PaymentConfirmationDialog } from './components/PaymentConfirmationDialog';
import { Clock } from 'lucide-react';
import { createAggregatedOrder } from '../utils';
import { useReceiptPrinter } from '@/lib/modules/byod_pos/hooks/useReceiptPrinter';
import { getPOSSettings } from '@/lib/modules/byod_pos/api';
import { POSSettings } from '@/lib/modules/byod_pos/types';
import { useSite } from '@/lib/site-context';
import { usePermission } from '@/components/admin/PermissionGuard';

export default function POSClient({ initialOrders = [] }: { initialOrders?: POSOrder[] }) {
    const { siteId } = useSite();
    const { isViewOnly } = usePermission();
    const [orders, setOrders] = useState<POSOrder[]>(initialOrders);
    const [, setLoading] = useState(initialOrders.length === 0);

    // State for Confirmation Dialog
    const [cancelConfig, setCancelConfig] = useState<{ isOpen: boolean; orderId: string | null }>({
        isOpen: false,
        orderId: null
    });

    // View Mode State: 'kitchen' (KDS) or 'cashier' (Bill Management)
    const [viewMode, setViewMode] = useState<'kitchen' | 'cashier'>('kitchen');

    const [selectedOrder, setSelectedOrder] = useState<POSOrder | null>(null);

    useEffect(() => {
        if (!siteId) return;
        // Subscribe to updates (Client-side hydration for real-time)
        const unsubscribe = subscribeToRecentOrders(siteId, (fetchedOrders) => {
            setOrders(fetchedOrders);
            setLoading(false);
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
            setSelectedOrder(null);
        } catch (error) {
            console.error("Cancellation failed:", error);
            toast.error("Failed to cancel order");
        }
    };

    // State for Payment Confirmation
    // Now supports multiple orders (Bill Payment)
    const [paymentConfig, setPaymentConfig] = useState<{ isOpen: boolean; orders: POSOrder[] }>({
        isOpen: false,
        orders: []
    });

    const handleProcessBillPayment = (ordersToPay: POSOrder[]) => {
        setPaymentConfig({ isOpen: true, orders: ordersToPay });
    };

    // Single order process (from KDS) calls this with array of one
    const handleProcessSinglePayment = (order: POSOrder) => {
        handleProcessBillPayment([order]);
    };

    const { printReceipt } = useReceiptPrinter();
    const [settings, setSettings] = useState<POSSettings | null>(null);

    useEffect(() => {
        if (!siteId) return;
        getPOSSettings(siteId).then(setSettings);
    }, [siteId]);

    const [postPaymentConfig, setPostPaymentConfig] = useState<{ isOpen: boolean; orders: POSOrder[] }>({
        isOpen: false,
        orders: []
    });

    const confirmPaymentProcess = async (method: POSOrder['paymentMethod']) => {
        if (isViewOnly) { toast.error('You do not have permission to confirm payments.'); return; }
        if (paymentConfig.orders.length === 0) return;

        try {
            if (!siteId) return;
            // Process all orders in parallel
            await Promise.all(paymentConfig.orders.map(o => confirmPayment(siteId, o.id, method)));

            toast.success(`Payment confirmed via ${method?.toUpperCase()}`);

            // Store paid orders
            const paidOrders = [...paymentConfig.orders];
            setPaymentConfig({ isOpen: false, orders: [] });

            // Close details modal if open and matched
            if (selectedOrder && paidOrders.some(o => o.id === selectedOrder.id)) {
                setSelectedOrder(null);
            }

            // Open Print Prompt
            setPostPaymentConfig({ isOpen: true, orders: paidOrders });

        } catch (error) {
            console.error("Payment confirmation failed:", error);
            toast.error("Failed to confirm payment");
        }
    };

    const handlePostPaymentPrint = () => {
        if (postPaymentConfig.orders.length === 0) return;
        const finalOrder = createAggregatedOrder(postPaymentConfig.orders);
        printReceipt(finalOrder, settings ?? undefined);
        setPostPaymentConfig({ isOpen: false, orders: [] });
    };

    // Grouping Logic for Cashier View
    const billGroups = useMemo(() => {
        // Only group orders that are NOT fully paid/completed.
        // Completed orders should go to History and not clutter active bills.
        // FIX: Ensure 'completed' orders (kitchen done) that are still UNPAID are included!
        const active = orders.filter(o => o.status !== 'cancelled' && o.paymentStatus !== 'paid');

        const groups: Record<string, {
            id: string;
            type: 'table' | 'member' | 'walk-in';
            label: string;
            orders: POSOrder[];
            total: number;
            updatedAt: number;
        }> = {};

        active.forEach(order => {
            // Determine Group Key
            let key = '';
            let type: 'table' | 'member' | 'walk-in' = 'walk-in';
            let label = 'Walk-in';

            if (order.tableNumber) {
                key = `table-${order.tableNumber}`;
                type = 'table';
                label = `Table ${order.tableNumber}`;
            } else if (order.memberId) {
                key = `member-${order.memberId}`;
                type = 'member';
                label = order.memberName || 'Member';
            } else {
                key = `order-${order.id}`; // Fallback to individual
                type = 'walk-in';
                label = order.customerName || `Guest #${order.id.slice(-4)}`;
            }

            if (!groups[key]) {
                groups[key] = {
                    id: key,
                    type,
                    label,
                    orders: [],
                    total: 0,
                    updatedAt: 0
                };
            }

            groups[key].orders.push(order);
            groups[key].total += order.total;
            // Keep track of latest activity for sorting
            const orderTime = order.createdAt?.seconds || 0;
            if (orderTime > groups[key].updatedAt) groups[key].updatedAt = orderTime;
        });

        return Object.values(groups).sort((a, b) => b.updatedAt - a.updatedAt).map(g => ({
            ...g,
            aggregatedStatus: g.orders.some(o => o.paymentStatus === 'pending_confirmation') ? 'pending_confirmation' : 'unpaid'
        })) as any[];
    }, [orders]);


    // Derived State: Filtered Orders for KDS
    // Exclude 'completed' so KDS only shows what needs work or is ready. 
    // Once completed/paid, it goes to history.
    const kdsOrders = useMemo(() => orders.filter(o => ['open', 'pending', 'preparing', 'ready'].includes(o.status) && o.paymentStatus !== 'paid').sort((a, b) => a.createdAt.seconds - b.createdAt.seconds), [orders]);

    // History: Completed or Cancelled or Paid
    const completedOrders = useMemo(() => orders.filter(o => ['completed', 'cancelled'].includes(o.status) || o.paymentStatus === 'paid').sort((a, b) => b.createdAt.seconds - a.createdAt.seconds), [orders]);

    const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');

    return (
        <div>
            <div className="hidden md:flex items-center gap-4 mb-6">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-neutral-100">Order management</h1>
            </div>

            <div className="flex items-center gap-4 mb-6">
                {/* Tabs */}
                <div className="flex p-1 bg-gray-100 dark:bg-neutral-800 rounded-lg border border-gray-200 dark:border-neutral-800">
                    <button
                        onClick={() => setActiveTab('active')}
                        className={`px-4 py-2 rounded-md font-bold text-sm transition-all duration-200 flex items-center gap-2 ${activeTab === 'active' ? 'bg-white dark:bg-neutral-900 text-brand-dark' : 'text-gray-500 dark:text-neutral-500 hover:text-gray-700 dark:hover:text-neutral-300'}`}
                    >
                        Active <span className="bg-studio-blue text-white px-1.5 py-0.5 rounded text-[10px]">{kdsOrders.length}</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('completed')}
                        className={`px-4 py-2 rounded-md font-bold text-sm transition-all duration-200 flex items-center gap-2 ${activeTab === 'completed' ? 'bg-white dark:bg-neutral-900 text-brand-dark' : 'text-gray-500 dark:text-neutral-500 hover:text-gray-700 dark:hover:text-neutral-300'}`}
                    >
                        History
                    </button>
                </div>

                {/* View Toggle (only when Active tab) */}
                {activeTab === 'active' && (
                    <div className="flex p-1 bg-gray-100 dark:bg-neutral-800 rounded-lg">
                        <button
                            onClick={() => setViewMode('kitchen')}
                            className={`px-4 py-2 rounded-lg font-bold text-xs transition-all duration-200 flex items-center gap-2 ${viewMode === 'kitchen' ? 'bg-white dark:bg-neutral-900 text-brand-dark' : 'text-gray-500 dark:text-neutral-500 hover:text-gray-700 dark:hover:text-neutral-300'}`}
                        >
                            <Grid size={16} /> KDS
                        </button>
                        <button
                            onClick={() => setViewMode('cashier')}
                            className={`px-4 py-2 rounded-lg font-bold text-xs transition-all duration-200 flex items-center gap-2 ${viewMode === 'cashier' ? 'bg-white dark:bg-neutral-900 text-brand-dark' : 'text-gray-500 dark:text-neutral-500 hover:text-gray-700 dark:hover:text-neutral-300'}`}
                        >
                            <List size={16} /> Cashier
                        </button>
                    </div>
                )}
            </div>

            {activeTab === 'active' && viewMode === 'kitchen' && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 md:gap-6 animate-in fade-in duration-300">
                    {kdsOrders.map(order => (
                        <div key={order.id} className="transition-all duration-500 ease-out">
                            <POSOrderCard
                                order={order}
                                onUpdateStatus={handleUpdateStatus}
                                onCancel={handleCancelClick}
                                // In KDS, maybe we don't show payment? Or we do for quick access. 
                                // Let's keep it for flexibility.
                                onProcessPayment={handleProcessSinglePayment}
                            />
                        </div>
                    ))}

                    {kdsOrders.length === 0 && (
                        <div className="col-span-full py-20 flex flex-col items-center justify-center text-gray-400 dark:text-neutral-600 bg-white dark:bg-neutral-900 rounded-lg border border-dashed border-gray-200 dark:border-neutral-800">
                            <ShoppingBag size={48} className="mb-4 opacity-20" />
                            <p className="font-bold text-lg">All caught up!</p>
                            <p className="text-sm">No active orders to prepare.</p>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'active' && viewMode === 'cashier' && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 md:gap-6 animate-in fade-in duration-300">
                    {billGroups.map(group => (
                        <BillCard
                            key={group.id}
                            group={group}
                            onProcessPayment={handleProcessBillPayment}
                        />
                    ))}

                    {billGroups.length === 0 && (
                        <div className="col-span-full py-20 flex flex-col items-center justify-center text-gray-400 dark:text-neutral-600 bg-white dark:bg-neutral-900 rounded-lg border border-dashed border-gray-200 dark:border-neutral-800">
                            <ShoppingBag size={48} className="mb-4 opacity-20" />
                            <p className="font-bold text-lg">No active bills</p>
                            <p className="text-sm">New orders will appear here automatically.</p>
                        </div>
                    )}
                </div>
            )}

            {/* Active Orders List (Cashier/Management Mode) - REMOVED */}

            {/* Completed Orders List */}
            {activeTab === 'completed' && (
                <div className="bg-white dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800 overflow-hidden animate-in fade-in duration-300">
                    <div className="divide-y divide-gray-100 dark:divide-neutral-800">
                        {completedOrders.map(order => (
                            <POSOrderRow
                                key={order.id}
                                order={order}
                                onClick={(o) => setSelectedOrder(o)}
                            />
                        ))}
                    </div>

                    {completedOrders.length === 0 && (
                        <div className="py-20 flex flex-col items-center justify-center text-gray-400 dark:text-neutral-600">
                            <Clock size={48} className="mb-4 opacity-20" />
                            <p className="font-bold text-lg">No history yet</p>
                            <p className="text-sm">Completed orders will appear here.</p>
                        </div>
                    )}
                </div>
            )}

            {/* Order Details Modal (Reuse existing for singular details if needed) */}
            {selectedOrder && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="w-full max-w-lg relative animate-in zoom-in-95 duration-200">
                        {/* Close Button outside/absolute */}
                        <button
                            onClick={() => setSelectedOrder(null)}
                            className="absolute -top-12 right-0 text-white hover:text-gray-200 transition-colors p-2"
                        >
                            <span className="font-bold text-sm">Close</span>
                        </button>

                        <POSOrderCard
                            order={selectedOrder}
                            onUpdateStatus={handleUpdateStatus}
                            onCancel={() => handleCancelClick(selectedOrder)}
                            onProcessPayment={handleProcessSinglePayment}
                        />
                    </div>
                    {/* Backdrop click to close */}
                    <div className="absolute inset-0 -z-10" onClick={() => setSelectedOrder(null)} />
                </div>
            )}

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

            <PaymentConfirmationDialog
                isOpen={paymentConfig.isOpen}
                onClose={() => setPaymentConfig({ isOpen: false, orders: [] })}
                onConfirm={confirmPaymentProcess}
                // Calculate aggregated total for the dialog
                order={paymentConfig.orders.length === 1 ? paymentConfig.orders[0] : {
                    ...paymentConfig.orders[0], // fallback mocks
                    total: paymentConfig.orders.reduce((sum, o) => sum + o.total, 0),
                    id: 'BILL-GROUP' // Hide ID if multiple? Or show "Multi"
                }}
            />
            <ConfirmationDialog
                isOpen={postPaymentConfig.isOpen}
                title="Payment Successful"
                message={`Payment recorded. Do you want to print the receipt now?\n\nYou can also print it later from Transaction History.`}
                confirmLabel="Print Receipt"
                cancelLabel="Close"
                isDestructive={false}
                onConfirm={handlePostPaymentPrint}
                onCancel={() => setPostPaymentConfig({ isOpen: false, orders: [] })}
            />
        </div>
    );
}
