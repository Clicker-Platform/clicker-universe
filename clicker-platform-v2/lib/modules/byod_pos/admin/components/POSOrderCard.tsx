import { Clock, CheckCircle, Play, XCircle, UserPlus, User, PackageCheck } from 'lucide-react';
import { useState, useEffect } from 'react';
import { POSMemberLookup } from '@/lib/modules/byod_pos/components/POSMemberLookup';
import { Member } from '@/lib/modules/membership/types';
import { POSOrder } from '@/lib/modules/byod_pos/types';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog';
import { useSite } from '@/lib/site-context';

interface POSOrderCardProps {
    order: POSOrder;
    onUpdateStatus?: (order: POSOrder, status: POSOrder['status']) => void;
    onCancel?: (order: POSOrder) => void;
    onProcessPayment?: (order: POSOrder) => void;
    minimal?: boolean;
    expanded?: boolean;
    onClick?: () => void;
    kds?: boolean;
}

export function POSOrderCard({ order, onUpdateStatus, onCancel, onProcessPayment, minimal, expanded, onClick, kds }: POSOrderCardProps) {
    const { siteId } = useSite();

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'open': return 'bg-blue-50 text-blue-800 border-blue-200';
            case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case 'preparing': return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'ready': return 'bg-green-100 dark:bg-green-950/30 text-green-800 dark:text-green-400 border-green-200 dark:border-green-900/50';
            case 'completed': return 'bg-gray-100 text-gray-800 border-gray-200';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const [isLinkingMember, setIsLinkingMember] = useState(false);

    const handleLinkMember = async (member: Member | null) => {
        if (!member) {
            setIsLinkingMember(false);
            return;
        }

        if (!siteId) {
            toast.error("Site ID not found");
            return;
        }

        try {
            await updateDoc(doc(db, 'sites', siteId, 'modules/byod_pos/orders', order.id), {
                memberId: member.id,
                memberName: member.fullName
            });
            toast.success("Member linked to order!");
            setIsLinkingMember(false);
        } catch (error) {
            console.error(error);
            toast.error("Failed to link member");
        }
    };


    // Simple Ticket Timer Hook
    const [elapsedTime, setElapsedTime] = useState<string>('');

    useEffect(() => {
        if (!order.createdAt) return;

        const updateTimer = () => {
            const now = new Date();
            // Handle Firebase Timestamp or standard number/date
            const created = order.createdAt.seconds ? new Date(order.createdAt.seconds * 1000) : new Date(order.createdAt as any);
            const diff = Math.floor((now.getTime() - created.getTime()) / 1000);

            const mm = Math.floor(diff / 60).toString().padStart(2, '0');
            const ss = (diff % 60).toString().padStart(2, '0');
            setElapsedTime(`${mm}:${ss}`);
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [order.createdAt]);


    const cardContent = (
        <div className={`overflow-hidden ${minimal
            ? 'bg-transparent border-0 rounded-none shadow-none'
            : `bg-white dark:bg-neutral-900 rounded-3xl shadow-sm border ${order.status === 'pending' ? 'border-gray-200 dark:border-neutral-800 ring-0' : 'border-gray-200 dark:border-neutral-800'}`
            }`}>
            {/* Header */}
            <div
                className={`p-4 flex justify-between items-start transition-colors ${minimal
                    ? 'border-b border-gray-100 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-800/50'
                    : `border-b ${order.paymentStatus === 'pending_confirmation' ? 'bg-yellow-50 border-yellow-100' : 'bg-gray-50 dark:bg-neutral-800/50 border-gray-100 dark:border-neutral-800'}`
                    }`}
                onClick={!minimal ? onClick : undefined}
                style={{ cursor: !minimal ? 'pointer' : 'default' }}
            >
                <div>
                    <h3 className="font-bold text-lg text-gray-900 dark:text-neutral-100">#{order.id.slice(-4).toUpperCase()}</h3>

                    {/* KDS: Show Timer & Order Type */}
                    {kds && (
                        <div className="flex flex-col items-start gap-1 mt-1">
                            <div className={`flex items-center gap-1 font-mono text-xl font-bold ${parseInt(elapsedTime.split(':')[0]) >= 20 ? 'text-red-600 animate-pulse' : 'text-gray-500 dark:text-neutral-500'
                                }`}>
                                <Clock size={16} />
                                {elapsedTime}
                            </div>
                            <span className="px-2 py-0.5 bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400 text-[10px] font-bold uppercase rounded border border-gray-200 dark:border-neutral-700">
                                {order.orderType || (order.tableNumber ? 'Dine-In' : 'Walk-In')}
                            </span>
                        </div>
                    )}

                    {!kds && (
                        <div suppressHydrationWarning className="text-xs text-gray-500 dark:text-neutral-500 mt-1 flex items-center gap-1">
                            <Clock size={12} />
                            {new Date((order.createdAt as any).seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                    )}
                </div>

                <div className="flex flex-col items-end gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${getStatusColor(order.status)}`}>
                        {order.status}
                    </span>
                    {/* Customer Info Badge - Simplified for KDS */}
                    {!minimal && (
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 dark:text-neutral-400 bg-white dark:bg-neutral-900 px-2 py-1 rounded border border-gray-100 dark:border-neutral-800">
                            {order.memberId ? <User size={12} className="text-brand-dark" /> : <User size={12} />}
                            {order.tableNumber ? `Table ${order.tableNumber}` : (order.memberId ? 'Member' : 'Walk-In')}
                        </div>
                    )}
                </div>
            </div>

            {/* Customer Info Row - Hidden in minimal mode */}
            {!minimal && (
                <div className="px-4 py-2 bg-white dark:bg-neutral-900 border-b border-gray-100 dark:border-neutral-800 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-sm">
                        <User size={14} className="text-gray-400 dark:text-neutral-600" />
                        <span className="font-bold text-gray-900 dark:text-neutral-100">
                            {order.memberName || order.customerName || 'Walk-In'}
                        </span>
                        {order.memberName && (
                            <span className="text-[10px] bg-brand-green/20 text-brand-dark px-2 py-0.5 rounded-full font-black uppercase tracking-wider">
                                Member
                            </span>
                        )}
                    </div>
                    {!order.memberName && order.status !== 'completed' && (
                        <button
                            onClick={() => setIsLinkingMember(true)}
                            className="flex items-center gap-1 text-blue-600 hover:text-blue-700 font-bold text-xs"
                        >
                            <UserPlus size={12} /> Link Member
                        </button>
                    )}
                </div>
            )}

            {/* Items - Hidden in minimal mode */}
            {!minimal && (
                <div className="p-4 space-y-3">
                    {order.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-start">
                            <div className="flex gap-2">
                                <span className="font-bold text-gray-900 dark:text-neutral-100 w-6">{item.quantity}x</span>
                                <div>
                                    <span className="text-gray-700 dark:text-neutral-300 block">{item.name}</span>
                                    {item.variantName && <span className="text-sm text-gray-500 dark:text-neutral-500 block">({item.variantName})</span>}
                                    {/* Placeholder for future Notes/Modifiers */}
                                </div>
                            </div>
                            {!kds && (
                                <span className="text-gray-400 dark:text-neutral-600 text-sm font-medium">
                                    {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(item.price * item.quantity)}
                                </span>
                            )}
                        </div>
                    ))}

                    {!kds && (
                        <div className="pt-3 mt-3 border-t border-dashed border-gray-200 dark:border-neutral-800">
                            <div className="flex justify-between items-center text-sm text-gray-500 dark:text-neutral-500 mb-1">
                                <span>Subtotal</span>
                                <span>{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(order.taxBreakdown?.subtotal || order.total)}</span>
                            </div>
                            {order.taxBreakdown?.serviceCharge && order.taxBreakdown.serviceCharge > 0 && (
                                <div className="flex justify-between items-center text-sm text-gray-500 dark:text-neutral-500 mb-1">
                                    <span>Service Charge ({order.taxBreakdown?.serviceChargeRate}%)</span>
                                    <span>{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(order.taxBreakdown?.serviceCharge)}</span>
                                </div>
                            )}
                            {order.taxBreakdown?.restaurantTax && order.taxBreakdown.restaurantTax > 0 && (
                                <div className="flex justify-between items-center text-sm text-gray-500 dark:text-neutral-500 mb-1">
                                    <span>PB1 ({order.taxBreakdown?.restaurantTaxRate}%)</span>
                                    <span>{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(order.taxBreakdown?.restaurantTax)}</span>
                                </div>
                            )}
                            <div className="flex justify-between items-center font-bold text-lg mt-2 pt-2 border-t border-gray-100 dark:border-neutral-800">
                                <span>Total</span>
                                <span className="text-brand-dark">
                                    {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(order.total)}
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Actions - Hidden in minimal mode */}
            {!minimal && (
                <div className="p-3 bg-gray-50 dark:bg-neutral-800/50 border-t border-gray-100 dark:border-neutral-800 grid grid-cols-2 gap-2">
                    {/* Payment Request Action - High Priority */}
                    {order.paymentStatus === 'pending_confirmation' && (
                        <button
                            onClick={() => onProcessPayment?.(order)}
                            className="col-span-2 bg-studio-blue text-white py-3 rounded-lg font-bold text-sm hover:bg-studio-blue/85 flex items-center justify-center gap-2 transition-colors active:scale-95 shadow-lg shadow-gray-200"
                        >
                            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                            Process Payment
                        </button>
                    )}

                    {(order.status === 'pending' || order.status === 'open') && (
                        <button
                            onClick={() => onUpdateStatus?.(order, 'preparing')}
                            className="col-span-2 bg-blue-600 text-white py-2 rounded-lg font-bold text-sm hover:bg-blue-700 flex items-center justify-center gap-2 transition-colors active:scale-95"
                        >
                            <Play size={16} /> Start Processing
                        </button>
                    )}
                    {order.status === 'preparing' && (
                        <button
                            onClick={() => onUpdateStatus?.(order, 'ready')}
                            className="col-span-2 bg-green-600 text-white py-2 rounded-lg font-bold text-sm hover:bg-green-700 flex items-center justify-center gap-2 transition-colors active:scale-95"
                        >
                            <PackageCheck size={16} /> Mark Ready
                        </button>
                    )}
                    {order.status === 'ready' && order.paymentStatus !== 'pending_confirmation' && (
                        <button
                            onClick={() => onUpdateStatus?.(order, 'completed')}
                            className="col-span-2 bg-gray-800 text-white py-2 rounded-lg font-bold text-sm hover:bg-gray-900 flex items-center justify-center gap-2 transition-colors active:scale-95"
                        >
                            <CheckCircle size={16} /> Complete Order
                        </button>
                    )}
                    {order.status === 'completed' && (
                        <div className="col-span-2 text-center text-gray-400 dark:text-neutral-600 text-sm font-medium py-2">
                            Completed
                        </div>
                    )}

                    {/* Generic Cancel Button available for all non-completed orders */}
                    {order.status !== 'completed' && (
                        <button
                            onClick={() => onCancel?.(order)}
                            className="col-span-2 mt-2 bg-red-50 dark:bg-red-950/30 text-red-500 py-2 rounded-lg font-bold text-xs hover:bg-red-100 dark:hover:bg-red-950/50 flex items-center justify-center gap-1 transition-colors active:scale-95"
                        >
                            <XCircle size={14} /> Cancel Order
                        </button>
                    )}
                </div>
            )}
        </div>
    );

    // Modal logic is now handled by ConfirmationDialog
    // Render ConfirmationDialog with POSMemberLookup as children
    return (
        <>
            {cardContent}

            <ConfirmationDialog
                isOpen={isLinkingMember}
                title="Enroll as Member"
                message="Search for an existing member or register a new one to link with this order."
                onConfirm={() => setIsLinkingMember(false)}
                onCancel={() => setIsLinkingMember(false)}
                hideFooter={true}
                isDestructive={false}
            >
                <div className="mt-2">
                    <POSMemberLookup
                        selectedMember={null}
                        onMemberSelect={handleLinkMember}
                        submitLabel="Enroll & Link"
                        toggleLabel="Not a member? Enroll now"
                    />
                </div>
            </ConfirmationDialog>
        </>
    );
}

