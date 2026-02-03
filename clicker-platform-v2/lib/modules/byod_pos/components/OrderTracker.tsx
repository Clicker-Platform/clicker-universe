'use client';

import { useRef, useState } from 'react';
import { useOrderTracker } from '../order-tracker-context';
import { ShoppingBag, ChevronRight, CheckCircle, Clock, Play, X, Store, CreditCard } from 'lucide-react';
import { requestPayment } from '../api';
import { toast } from 'sonner';
import { POSOrder } from '../types';

import { useSite } from '@/lib/site-context';

export function OrderTracker() {
    const { siteId } = useSite();
    const { orders, dismissOrder, clearCompletedOrders, isTrackerOpen, setIsTrackerOpen } = useOrderTracker();

    // Only show if there are tracked orders
    if (orders.length === 0) return null;

    // Calculate Totals
    const grandTotal = orders.reduce((sum, o) => sum + o.total, 0);
    const outstandingTotal = orders.reduce((sum, o) => (o.paymentStatus === 'paid' ? sum : sum + o.total), 0);
    const allPaid = orders.length > 0 && orders.every(o => o.paymentStatus === 'paid' || o.status === 'cancelled');

    return (
        <>
            {/* Floating Tracker Button */}
            <div className="fixed bottom-24 md:bottom-6 left-4 md:left-6 z-50 transition-all duration-300">
                <button
                    onClick={() => setIsTrackerOpen(true)}
                    className="bg-white border-[3px] border-brand-dark shadow-lg rounded-2xl p-4 flex items-center gap-3 hover:scale-105 transition-transform active:scale-95"
                >
                    <div className="w-10 h-10 rounded-full flex items-center justify-center border-2 border-brand-dark font-black bg-brand-yellow text-brand-dark">
                        {orders.length}
                    </div>
                    <div className="text-left">
                        <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                            {outstandingTotal === 0 ? 'My Order' : 'Unpaid'}
                        </div>
                        <div className={`font-black leading-none flex items-center gap-1 ${outstandingTotal === 0 ? 'text-green-600' : 'text-brand-dark'}`}>
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
                    <div className="bg-white w-full md:w-full md:max-w-md rounded-t-3xl md:rounded-3xl border-t-[3px] md:border-[3px] border-x-[3px] md:border-x-[3px] border-b-0 md:border-b-[3px] border-brand-dark shadow-2xl overflow-hidden flex flex-col h-[85vh] md:h-auto md:max-h-[85vh] animate-in slide-in-from-bottom duration-300">
                        {/* Header */}
                        <div className="bg-gray-50 p-4 border-b border-gray-100 flex justify-between items-center shrink-0">
                            <h3 className="font-black text-xl uppercase flex items-center gap-2">
                                <Store size={24} /> My Orders ({orders.length})
                            </h3>
                            <button onClick={() => setIsTrackerOpen(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-0 overflow-y-auto flex-1 bg-gray-50/50">
                            {orders.map((order) => (
                                <div key={order.id} className="bg-white border-b border-gray-100 mb-2 last:mb-0 pb-6">
                                    <div className="p-4 bg-gray-50/50 border-b border-gray-100 flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                            <span className="font-black text-gray-600 uppercase text-sm">#{order.id.slice(-4).toUpperCase()}</span>
                                            {(order.status === 'completed' || order.status === 'cancelled') && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        dismissOrder(order.id);
                                                        toast.success("Order removed from list");
                                                    }}
                                                    className="p-1 -ml-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
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
                                                : 'bg-white text-gray-700 border-gray-200'
                                            }`}>
                                            {getStatusLabel(order)}
                                        </div>
                                    </div>

                                    <div className="px-4 pt-4">
                                        <OrderStepper status={order.status} />
                                    </div>

                                    <div className="p-4 space-y-3">
                                        {order.items.map((item, idx) => (
                                            <div key={idx} className="flex justify-between items-start gap-4 text-sm">
                                                <div className="flex gap-2">
                                                    <div className="font-bold text-brand-dark min-w-[20px]">
                                                        {item.quantity}x
                                                    </div>
                                                    <span className="font-medium text-gray-800">{item.name} {item.variantName && `(${item.variantName})`}</span>
                                                </div>
                                                <span className="font-bold text-gray-600 shrink-0">
                                                    {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(item.price * item.quantity)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="px-4 flex justify-between items-center text-sm font-bold text-gray-500">
                                        <span>Subtotal</span>
                                        <span>{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(order.total)}</span>
                                    </div>

                                    {/* Action per Order (Removed - Consolidated in Footer) */}
                                </div>
                            ))}
                        </div>

                        {/* Footer / Grand Total */}
                        <div className="p-4 bg-white border-t border-gray-100 shrink-0 shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
                            <div className="flex justify-between items-center mb-4">
                                <span className="font-black text-xl text-gray-400">Total Pay</span>
                                <span className={`font-black text-2xl ${outstandingTotal > 0 ? 'text-brand-dark' : 'text-green-500'}`}>
                                    {outstandingTotal > 0
                                        ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(outstandingTotal)
                                        : 'PAID'
                                    }
                                </span>
                            </div>

                            {/* Consolidated Request Payment Action */}
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
                                            className="w-full py-4 mb-3 bg-brand-dark text-white font-bold rounded-xl hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
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
                                className={`w-full py-4 font-bold rounded-xl transition-colors ${orders.some(o => o.status !== 'cancelled' && o.paymentStatus !== 'paid')
                                    ? "bg-white border-2 border-gray-200 text-gray-600 hover:bg-gray-50"
                                    : "bg-brand-dark text-white hover:bg-gray-800"
                                    }`}
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

function OrderStepper({ status }: { status: string }) {
    // If status is 'open', show it as the first step (active)
    const steps = [
        { id: 'open', label: 'Bill Open', icon: ShoppingBag },
        { id: 'preparing', label: 'Kitchen', icon: Play },
        { id: 'ready', label: 'Ready', icon: Store },
        { id: 'completed', label: 'Completed', icon: CheckCircle },
    ];

    let activeIndex = 0;
    if (status === 'open') activeIndex = 0;
    if (status === 'pending') activeIndex = 0; // Treat pending as start
    if (status === 'preparing') activeIndex = 1;
    if (status === 'ready') activeIndex = 2;
    if (status === 'completed') activeIndex = 3;

    return (
        <div className="relative flex justify-between items-center px-4">
            {/* Connecting Line */}
            <div className="absolute top-1/2 left-8 right-8 h-1 bg-gray-100 -z-10 -translate-y-1/2 rounded-full">
                <div
                    className="h-full bg-brand-dark transition-all duration-500 rounded-full"
                    style={{ width: `${Math.min(100, (Math.max(0, activeIndex) / (steps.length - 1)) * 100)}%` }}
                />
            </div>

            {steps.map((step, idx) => {
                const isActive = idx <= activeIndex;
                const isCurrent = idx === activeIndex;
                const Icon = step.icon;

                return (
                    <div key={step.id} className="flex flex-col items-center gap-2 bg-white px-2">
                        <div className={`
                            w-12 h-12 rounded-full flex items-center justify-center border-[3px] transition-all duration-300
                            ${isActive ? 'bg-brand-dark border-brand-dark text-white' : 'bg-white border-gray-200 text-gray-300'}
                            ${isCurrent ? 'scale-110 shadow-lg ring-4 ring-brand-green/20' : ''}
                        `}>
                            <Icon size={20} strokeWidth={3} />
                        </div>
                        <span className={`text-[10px] font-bold uppercase tracking-wider transition-colors duration-300 ${isActive ? 'text-brand-dark' : 'text-gray-300'}`}>
                            {step.label}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}
