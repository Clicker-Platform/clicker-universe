'use client';

import { useEffect, useState, useMemo } from 'react';
import { POSOrder, POSSettings } from '@/lib/modules/byod_pos/types';
import { subscribeToRecentOrders, confirmPayment } from '@/lib/modules/byod_pos/api';
import { commitPromoUsage, reversePromoUsage } from '@/lib/modules/promo/api';
import type { AppliedPromo } from '@/lib/modules/promo/api';
import { ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';
import { BillCard } from './components/BillCard';
import { PaymentConfirmationDialog } from './components/PaymentConfirmationDialog';
import { calculateBillTotals, createAggregatedOrder } from '../utils';
import { useReceiptPrinter } from '@/lib/modules/byod_pos/hooks/useReceiptPrinter';
import { getPOSSettings } from '@/lib/modules/byod_pos/api';
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog';
import { useSite } from '@/lib/site-context';
import { usePermission } from '@/components/admin/PermissionGuard';
import { logger } from '@/lib/logger-edge';

export default function CashierClient({ initialOrders = [] }: { initialOrders?: POSOrder[] }) {
    const { siteId } = useSite();
    const { isViewOnly } = usePermission(); // Use context
    const [orders, setOrders] = useState<POSOrder[]>(initialOrders);

    // Payment State
    const [paymentConfig, setPaymentConfig] = useState<{ isOpen: boolean; orders: POSOrder[] }>({
        isOpen: false,
        orders: []
    });

    useEffect(() => {
        if (!siteId) return;
        const unsubscribe = subscribeToRecentOrders(siteId, (fetchedOrders) => {
            setOrders(fetchedOrders);
        });
        return () => unsubscribe();
    }, [siteId]);

    const handleProcessBillPayment = (ordersToPay: POSOrder[]) => {
        setPaymentConfig({ isOpen: true, orders: ordersToPay });
    };

    // Post-Payment State
    const [postPaymentConfig, setPostPaymentConfig] = useState<{ isOpen: boolean; orders: POSOrder[] }>({
        isOpen: false,
        orders: []
    });

    const { printReceipt } = useReceiptPrinter();
    const [settings, setSettings] = useState<POSSettings | null>(null);

    useEffect(() => {
        if (!siteId) return;
        getPOSSettings(siteId).then(setSettings);
    }, [siteId]);

    const confirmPaymentProcess = async (method: POSOrder['paymentMethod'], appliedPromo: AppliedPromo | null) => {
        if (isViewOnly) { toast.error('You do not have permission to confirm payments.'); return; }
        if (paymentConfig.orders.length === 0) return;

        try {
            if (!siteId) return;
            const orderIds = paymentConfig.orders.map(o => o.id);
            await Promise.all(paymentConfig.orders.map(o => confirmPayment(siteId, o.id, method, appliedPromo ?? undefined)));

            // Commit promo usage after successful payment
            if (appliedPromo) {
                const memberId = paymentConfig.orders[0]?.memberId;
                const refId = orderIds.length === 1 ? orderIds[0] : orderIds.join(',');
                try {
                    await commitPromoUsage({ siteId, applied: appliedPromo, source: 'POS', refId, memberId });
                } catch (promoErr) {
                    logger.error('pos.cashier.promo.commit.failed', { siteId, promoErr });
                    // Non-fatal: payment already succeeded
                }
            }

            toast.success(`Payment confirmed via ${method?.toUpperCase()}`);

            // Store paid orders for printing option
            const paidOrders = [...paymentConfig.orders];
            setPaymentConfig({ isOpen: false, orders: [] });

            // Open Print Prompt
            setPostPaymentConfig({ isOpen: true, orders: paidOrders });

        } catch (error) {
            logger.error('pos.cashier.payment.failed', { siteId, error });
            toast.error("Failed to confirm payment");
        }
    };

    const handlePostPaymentPrint = () => {
        if (postPaymentConfig.orders.length === 0) return;
        const finalOrder = createAggregatedOrder(postPaymentConfig.orders);
        printReceipt(finalOrder, settings ?? undefined);
        setPostPaymentConfig({ isOpen: false, orders: [] });
    };

    // Grouping Logic for Cashier
    const billGroups = useMemo(() => {
        // Filter: Active Bills (Unpaid)
        // Includes: Open, Pending, Preparing, Ready, Completed (if Unpaid)
        // Excludes: Paid, Cancelled
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
            let key = '';
            let type: 'table' | 'member' | 'walk-in' = 'walk-in';
            let label = 'Walk-in';

            const isRealTable = order.tableNumber && order.tableNumber !== 'Walk-in';

            if (isRealTable) {
                key = `table-${order.tableNumber}`;
                type = 'table';
                label = `Table ${order.tableNumber}`;
            } else if (order.memberId) {
                key = `member-${order.memberId}`;
                type = 'member';
                label = order.memberName || 'Member';
            } else {
                key = `order-${order.id}`;
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
            const orderTime = order.createdAt?.seconds || 0;
            if (orderTime > groups[key].updatedAt) groups[key].updatedAt = orderTime;
        });

        return Object.values(groups).sort((a, b) => b.updatedAt - a.updatedAt).map(g => ({
            ...g,
            aggregatedStatus: g.orders.some(o => o.paymentStatus === 'pending_confirmation') ? 'pending_confirmation' : 'unpaid'
        })) as any[]; // using any for BillCard props compatibility
    }, [orders]);

    return (
        <div>
            <div className="flex items-center gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-neutral-100 mb-1">Cashier station</h1>
                    <p className="text-gray-600 dark:text-neutral-400 font-medium">Bill management & payment processing</p>
                </div>
            </div>

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

            <PaymentConfirmationDialog
                isOpen={paymentConfig.isOpen}
                onClose={() => setPaymentConfig({ isOpen: false, orders: [] })}
                onConfirm={confirmPaymentProcess}
                order={paymentConfig.orders.length === 1 ? paymentConfig.orders[0] : paymentConfig.orders.length > 1 ? {
                    ...paymentConfig.orders[0],
                    total: calculateBillTotals(paymentConfig.orders).total, // Use aggregated total
                    id: 'BILL-GROUP'
                } : null}
                siteId={siteId}
                memberId={paymentConfig.orders[0]?.memberId}
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
