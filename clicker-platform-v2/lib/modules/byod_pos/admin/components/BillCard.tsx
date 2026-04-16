
import { useState } from 'react';
import { POSOrder } from '@/lib/modules/byod_pos/types';
import { cancelOrderItem } from '@/lib/modules/byod_pos/api';
import { POSOrderCard } from './POSOrderCard';
import { calculateBillTotals } from '../../utils';
import { CreditCard, Clock, User, Armchair, X } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog';
import { useSite } from '@/lib/site-context';

interface BillCardProps {
    group: {
        id: string;
        type: 'table' | 'member' | 'walk-in';
        label: string;
        orders: POSOrder[];
        total: number;
        updatedAt: number;
        aggregatedStatus: 'paid' | 'partial' | 'unpaid' | 'pending_confirmation';
    };
    onProcessPayment: (orders: POSOrder[]) => void;
    disabled?: boolean;
}

export function BillCard({ group, onProcessPayment, disabled }: BillCardProps) {
    const { siteId } = useSite();
    // Calculate aggregated totals for the entire bill
    const billTotals = calculateBillTotals(group.orders);

    const [cancelTarget, setCancelTarget] = useState<{ order: POSOrder, itemIndex: number, itemName: string } | null>(null);
    const [isCancelling, setIsCancelling] = useState(false);

    const handleCancelItem = async () => {
        if (!cancelTarget || !siteId) return;

        setIsCancelling(true);
        try {
            await cancelOrderItem(siteId, cancelTarget.order.id, cancelTarget.itemIndex);
            toast.success(`Cancelled ${cancelTarget.itemName}`);
            setCancelTarget(null);
        } catch (error) {
            console.error("Failed to cancel item:", error);
            toast.error("Failed to cancel item");
        } finally {
            setIsCancelling(false);
        }
    };

    // Helpers for UI
    const getIcon = (type: string) => {
        switch (type) {
            case 'table': return <Armchair size={20} />;
            case 'member': return <User size={20} />;
            default: return <User size={20} />;
        }
    };

    const formatTime = (seconds: number) => {
        if (!seconds) return '';
        return new Date(seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-gray-200 dark:border-neutral-800 overflow-hidden scale-100 hover:scale-[1.01] transition-transform duration-300">
            {/* Header */}
            <div className="p-4 flex justify-between items-start bg-white dark:bg-neutral-900 border-b border-gray-100 dark:border-neutral-800">
                <div className="flex-1">
                    <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-full ${group.type === 'table' ? 'bg-studio-blue text-white' :
                                group.type === 'member' ? 'bg-brand-green/10 text-brand-dark' : 'bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-neutral-500'
                                }`}>
                                {getIcon(group.type)}
                            </div>
                            <div>
                                <span className="text-xs font-bold text-gray-400 dark:text-neutral-600 uppercase tracking-wider">{group.type}</span>
                                <h3 className="font-black text-xl text-brand-dark leading-none">{group.label}</h3>
                            </div>
                        </div>

                        {/* Top Right Status (A) */}
                        <div className="text-right">
                            <div className="text-sm font-medium text-gray-500 dark:text-neutral-500 mb-1">
                                {group.orders.length} order{group.orders.length > 1 ? 's' : ''}
                            </div>
                            <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${group.aggregatedStatus === 'pending_confirmation' ? 'bg-amber-100 text-amber-700' : 'bg-red-50 dark:bg-red-950/30 text-red-500'
                                }`}>
                                {group.aggregatedStatus === 'pending_confirmation' ? 'Confirm' : 'Unpaid'}
                            </span>
                        </div>
                    </div>

                    {/* Last Update Line (B) */}
                    <div className="flex items-center gap-2 text-sm text-gray-400 dark:text-neutral-600 font-medium ml-1">
                        <Clock size={14} />
                        <span>Last update: {formatTime(group.updatedAt)}</span>
                    </div>
                </div>
            </div>

            {/* List of Orders (Always Expanded) */}
            <div className="bg-white dark:bg-neutral-900">
                {group.orders.map(order => (
                    <div key={order.id} className="border-b border-gray-100 dark:border-neutral-800 last:border-0 relative">
                        {/* Order Header */}
                        <POSOrderCard
                            order={order}
                            minimal={true}
                        />

                        {/* List Items (C: Removed pl-12) */}
                        <div className="p-4 text-sm space-y-2">
                            {order.items.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center text-gray-600 dark:text-neutral-400 group/item relative pl-6">
                                    <div className="flex gap-2 items-center">
                                        {/* Cancel Button - Only show if not paid/processed */}
                                        {order.status !== 'completed' && order.status !== 'cancelled' && order.paymentStatus !== 'paid' && (
                                            <button
                                                onClick={() => setCancelTarget({ order, itemIndex: idx, itemName: item.name })}
                                                className="absolute left-0 top-1/2 -translate-y-1/2 p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-full w-6 h-6 flex items-center justify-center transition-colors"
                                                title="Cancel Item"
                                            >
                                                <X size={14} />
                                            </button>
                                        )}
                                        <span className="font-bold text-brand-dark">{item.quantity}x</span>
                                        <span>{item.name} {item.variantName && `(${item.variantName})`}</span>
                                    </div>
                                    <span className="font-medium text-gray-900 dark:text-neutral-100">
                                        {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(item.price * item.quantity)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* Aggregated Bill Footer */}
            <div className="p-4 bg-white dark:bg-neutral-900 border-t border-gray-200 dark:border-neutral-800">
                <div className="space-y-1 text-sm mb-4">
                    <div className="flex justify-between text-gray-500 dark:text-neutral-500">
                        <span>Subtotal</span>
                        <span>{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(billTotals.subtotal)}</span>
                    </div>
                    {billTotals.serviceCharge > 0 && (
                        <div className="flex justify-between text-gray-500 dark:text-neutral-500">
                            <span>Service ({billTotals.serviceChargeRate}%)</span>
                            <span>{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(billTotals.serviceCharge)}</span>
                        </div>
                    )}
                    {billTotals.restaurantTax > 0 && (
                        <div className="flex justify-between text-gray-500 dark:text-neutral-500">
                            <span>PB1 ({billTotals.restaurantTaxRate}%)</span>
                            <span>{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(billTotals.restaurantTax)}</span>
                        </div>
                    )}
                    <div className="flex justify-between font-black text-xl text-brand-dark pt-3 border-t border-dashed border-gray-200 dark:border-neutral-800 mt-3">
                        <span>Total</span>
                        <span>{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(billTotals.total)}</span>
                    </div>
                </div>

                {/* Settle Bill Button - Moved to Bottom */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onProcessPayment(group.orders);
                    }}
                    disabled={disabled}
                    className={`w-full py-3 rounded-lg font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''} ${group.aggregatedStatus === 'pending_confirmation'
                        ? 'bg-amber-400 text-amber-900 hover:bg-amber-300 animate-pulse'
                        : 'bg-studio-blue text-white hover:bg-studio-blue/90'
                        }`}
                >
                    <CreditCard size={18} />
                    {group.aggregatedStatus === 'pending_confirmation' ? 'Confirm Payment' : 'Pay'}
                </button>
            </div>
            {/* Cancel Confirmation Dialog */}
            <ConfirmationDialog
                isOpen={!!cancelTarget}
                title="Cancel Item?"
                message={`Are you sure you want to remove "${cancelTarget?.itemName}" from this order? This action typically cannot be undone.`}
                confirmLabel="Remove It"
                cancelLabel="Keep It"
                onConfirm={handleCancelItem}
                onCancel={() => setCancelTarget(null)}
                isLoading={isCancelling}
                isDestructive={true}
            />
        </div>
    );
}
