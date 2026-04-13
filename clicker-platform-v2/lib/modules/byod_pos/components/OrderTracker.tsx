'use client';

import { useRef, useState } from 'react';
import { useOrderTracker } from '../order-tracker-context';
import { ShoppingBag, ChevronRight, CheckCircle, Clock, Play, X, Store, CreditCard } from 'lucide-react';
import { requestPayment } from '../api';
import { toast } from 'sonner';
import { POSOrder } from '../types';

import { useSite } from '@/lib/site-context';
import { useTemplate } from '@/components/TemplateProvider';
import { ThemeConfig } from '@/lib/templates/types';

export function OrderTracker() {
    const { siteId } = useSite();
    const { theme } = useTemplate();
    const { orders, dismissOrder, clearCompletedOrders, isTrackerOpen, setIsTrackerOpen } = useOrderTracker();

    if (orders.length === 0) return null;

    const isGlass = theme.decorations?.surfaceStyle === 'glass' || theme.cardStyle === 'glass';
    const surfaceBg = isGlass ? 'rgba(20,20,20,0.95)' : (theme.colors.surfaceElevated || '#ffffff');
    const surfaceMuted = isGlass ? 'rgba(255,255,255,0.05)' : (theme.colors.surface || '#f9fafb');
    const borderColor = isGlass ? 'rgba(255,255,255,0.1)' : (theme.colors.border || '#e5e7eb');
    const subtleText = theme.colors.textSubtle || theme.colors.muted || theme.colors.foreground;
    const primaryColor = theme.colors.primary;
    const accentFg = theme.colors.accentForeground || '#ffffff';

    const grandTotal = orders.reduce((sum, o) => sum + o.total, 0);
    const outstandingTotal = orders.reduce((sum, o) => (o.paymentStatus === 'paid' ? sum : sum + o.total), 0);
    const allPaid = orders.length > 0 && orders.every(o => o.paymentStatus === 'paid' || o.status === 'cancelled');

    return (
        <>
            {/* Floating Tracker Button */}
            <div className="fixed bottom-24 md:bottom-6 left-4 md:left-6 z-50 transition-all duration-300">
                <button
                    onClick={() => setIsTrackerOpen(true)}
                    className="shadow-lg rounded-2xl p-4 flex items-center gap-3 hover:scale-105 transition-transform active:scale-95 border"
                    style={{ backgroundColor: surfaceBg, borderColor }}
                >
                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-black"
                        style={{ backgroundColor: `${primaryColor}20`, color: primaryColor, border: `2px solid ${primaryColor}` }}>
                        {orders.length}
                    </div>
                    <div className="text-left">
                        <div className="text-xs font-bold uppercase tracking-wider" style={{ color: subtleText }}>
                            {outstandingTotal === 0 ? 'My Order' : 'Unpaid'}
                        </div>
                        <div className="font-black leading-none flex items-center gap-1"
                            style={{ color: outstandingTotal === 0 ? '#22c55e' : primaryColor }}>
                            {outstandingTotal === 0
                                ? 'PAID'
                                : new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(outstandingTotal)
                            }
                            <ChevronRight size={14} />
                        </div>
                    </div>
                </button>
            </div>

            {/* Order Details Modal */}
            {isTrackerOpen && (
                <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex justify-center items-end md:items-center md:p-4 animate-in fade-in duration-200">
                    <div className="w-full md:w-full md:max-w-md rounded-t-3xl md:rounded-3xl border shadow-2xl overflow-hidden flex flex-col h-[85vh] md:h-auto md:max-h-[85vh] animate-in slide-in-from-bottom duration-300"
                        style={{ backgroundColor: surfaceBg, borderColor }}>
                        {/* Header */}
                        <div className="p-4 border-b flex justify-between items-center shrink-0"
                            style={{ borderColor, backgroundColor: surfaceMuted }}>
                            <h3 className="font-black text-xl uppercase flex items-center gap-2" style={{ color: theme.colors.foreground }}>
                                <Store size={24} /> My Orders ({orders.length})
                            </h3>
                            <button onClick={() => setIsTrackerOpen(false)}
                                className="p-2 rounded-full hover:opacity-70 transition-opacity"
                                style={{ color: theme.colors.foreground }}>
                                <X size={24} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-0 overflow-y-auto flex-1" style={{ backgroundColor: surfaceMuted }}>
                            {orders.map((order) => (
                                <div key={order.id} className="border-b mb-2 last:mb-0 pb-6"
                                    style={{ backgroundColor: surfaceBg, borderColor }}>
                                    <div className="p-4 border-b flex justify-between items-center"
                                        style={{ borderColor, backgroundColor: surfaceMuted }}>
                                        <div className="flex items-center gap-2">
                                            <span className="font-black uppercase text-sm" style={{ color: subtleText }}>#{order.id.slice(-4).toUpperCase()}</span>
                                            {(order.status === 'completed' || order.status === 'cancelled') && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        dismissOrder(order.id);
                                                        toast.success("Order removed from list");
                                                    }}
                                                    className="p-1 -ml-1 rounded-full transition-colors hover:text-red-500 hover:bg-red-50"
                                                    style={{ color: subtleText }}
                                                    title="Remove from list"
                                                >
                                                    <X size={16} />
                                                </button>
                                            )}
                                        </div>
                                        <div className={`text-xs font-bold uppercase tracking-wider border px-2 py-1 rounded ${order.paymentStatus === 'pending_confirmation'
                                            ? 'bg-yellow-100 text-yellow-700 border-yellow-200 animate-pulse'
                                            : order.paymentStatus === 'paid'
                                                ? 'bg-green-100 text-green-700 border-green-200'
                                                : ''
                                            }`}
                                            style={order.paymentStatus !== 'pending_confirmation' && order.paymentStatus !== 'paid'
                                                ? { backgroundColor: surfaceMuted, borderColor, color: subtleText }
                                                : undefined
                                            }>
                                            {getStatusLabel(order)}
                                        </div>
                                    </div>

                                    <div className="px-4 pt-4">
                                        <OrderStepper status={order.status} theme={theme} />
                                    </div>

                                    <div className="p-4 space-y-3">
                                        {order.items.map((item, idx) => (
                                            <div key={idx} className="flex justify-between items-start gap-4 text-sm">
                                                <div className="flex gap-2">
                                                    <div className="font-bold min-w-[20px]" style={{ color: primaryColor }}>
                                                        {item.quantity}x
                                                    </div>
                                                    <span className="font-medium" style={{ color: theme.colors.foreground }}>{item.name} {item.variantName && `(${item.variantName})`}</span>
                                                </div>
                                                <span className="font-bold shrink-0" style={{ color: subtleText }}>
                                                    {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(item.price * item.quantity)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="px-4 flex justify-between items-center text-sm font-bold" style={{ color: subtleText }}>
                                        <span>Subtotal</span>
                                        <span>{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(order.total)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Footer / Grand Total */}
                        <div className="p-4 border-t shrink-0"
                            style={{ backgroundColor: surfaceBg, borderColor }}>
                            <div className="flex justify-between items-center mb-4">
                                <span className="font-black text-xl" style={{ color: subtleText }}>Total Pay</span>
                                <span className="font-black text-2xl"
                                    style={{ color: outstandingTotal > 0 ? primaryColor : '#22c55e' }}>
                                    {outstandingTotal > 0
                                        ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(outstandingTotal)
                                        : 'PAID'
                                    }
                                </span>
                            </div>

                            {(() => {
                                const payableOrders = orders.filter(o => o.status !== 'cancelled' && o.paymentStatus !== 'paid' && o.paymentStatus !== 'pending_confirmation');
                                const pendingOrders = orders.filter(o => o.status !== 'cancelled' && o.paymentStatus === 'pending_confirmation');

                                if (payableOrders.length > 0) {
                                    return (
                                        <button
                                            onClick={async () => {
                                                if (!siteId) return;
                                                const promises = payableOrders.map(o => requestPayment(siteId, o.id));
                                                try {
                                                    await Promise.all(promises);
                                                    toast.success("Payment Amount Requested");
                                                } catch (e) {
                                                    toast.error("Failed to request payment");
                                                }
                                            }}
                                            className="w-full py-4 mb-3 font-bold rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                                            style={{ backgroundColor: primaryColor, color: accentFg }}
                                        >
                                            <CreditCard size={20} /> Pay
                                        </button>
                                    );
                                }

                                if (pendingOrders.length > 0) {
                                    return (
                                        <div className="w-full py-4 mb-3 bg-yellow-100 text-yellow-800 font-bold rounded-xl flex items-center justify-center gap-2 animate-pulse">
                                            <Clock size={20} /> Waiting for Cashier...
                                        </div>
                                    );
                                }

                                return null;
                            })()}

                            <button
                                onClick={() => {
                                    if (allPaid) {
                                        clearCompletedOrders();
                                        toast.success("Session cleared", { description: "Ready for new order" });
                                    }
                                    setIsTrackerOpen(false);
                                }}
                                className="w-full py-4 font-bold rounded-xl border transition-opacity hover:opacity-80"
                                style={orders.some(o => o.status !== 'cancelled' && o.paymentStatus !== 'paid')
                                    ? { backgroundColor: 'transparent', borderColor, color: theme.colors.foreground }
                                    : { backgroundColor: primaryColor, color: accentFg, borderColor: primaryColor }
                                }
                            >
                                {allPaid ? 'Start New Order' : 'Close'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

function getStatusLabel(order: POSOrder) {
    if (order.paymentStatus === 'paid') return 'Paid';
    if (order.paymentStatus === 'pending_confirmation') return 'Processing Payment';

    switch (order.status) {
        case 'open': return 'Bill Open';
        case 'pending': return 'Order Placed';
        case 'preparing': return 'Processing';
        case 'ready': return 'Ready';
        case 'completed': return 'Completed';
        default: return order.status;
    }
}

function OrderStepper({ status, theme }: { status: string; theme: ThemeConfig }) {
    const isGlass = theme.decorations?.surfaceStyle === 'glass' || theme.cardStyle === 'glass';
    const surfaceBg = isGlass ? 'rgba(20,20,20,0.95)' : (theme.colors.surfaceElevated || '#ffffff');
    const borderColor = isGlass ? 'rgba(255,255,255,0.1)' : (theme.colors.border || '#e5e7eb');
    const subtleText = theme.colors.textSubtle || theme.colors.muted || theme.colors.foreground;
    const primaryColor = theme.colors.primary;
    const accentFg = theme.colors.accentForeground || '#ffffff';

    const steps = [
        { id: 'open', label: 'Bill Open', icon: ShoppingBag },
        { id: 'preparing', label: 'Kitchen', icon: Play },
        { id: 'ready', label: 'Ready', icon: Store },
        { id: 'completed', label: 'Completed', icon: CheckCircle },
    ];

    let activeIndex = 0;
    if (status === 'open') activeIndex = 0;
    if (status === 'pending') activeIndex = 0;
    if (status === 'preparing') activeIndex = 1;
    if (status === 'ready') activeIndex = 2;
    if (status === 'completed') activeIndex = 3;

    return (
        <div className="relative flex justify-between items-center px-4">
            {/* Connecting Line */}
            <div className="absolute top-1/2 left-8 right-8 h-1 -z-10 -translate-y-1/2 rounded-full"
                style={{ backgroundColor: borderColor }}>
                <div
                    className="h-full transition-all duration-500 rounded-full"
                    style={{
                        width: `${Math.min(100, (Math.max(0, activeIndex) / (steps.length - 1)) * 100)}%`,
                        backgroundColor: primaryColor
                    }}
                />
            </div>

            {steps.map((step, idx) => {
                const isActive = idx <= activeIndex;
                const isCurrent = idx === activeIndex;
                const Icon = step.icon;

                return (
                    <div key={step.id} className="flex flex-col items-center gap-2 px-2"
                        style={{ backgroundColor: surfaceBg }}>
                        <div
                            className="w-12 h-12 rounded-full flex items-center justify-center border-[3px] transition-all duration-300"
                            style={{
                                backgroundColor: isActive ? primaryColor : surfaceBg,
                                borderColor: isActive ? primaryColor : borderColor,
                                color: isActive ? accentFg : subtleText,
                                boxShadow: isCurrent ? `0 0 0 4px ${primaryColor}30` : undefined,
                                transform: isCurrent ? 'scale(1.1)' : undefined,
                            }}
                        >
                            <Icon size={20} strokeWidth={3} />
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wider transition-colors duration-300"
                            style={{ color: isActive ? primaryColor : subtleText }}>
                            {step.label}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}
