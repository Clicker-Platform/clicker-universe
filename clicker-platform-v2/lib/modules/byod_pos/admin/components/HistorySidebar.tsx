'use client';

import { POSOrder } from '@/lib/modules/byod_pos/types';
import { X, Clock, CreditCard, Receipt, FileText, CheckCircle, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

interface HistorySidebarProps {
    isOpen: boolean;
    onClose: () => void;
    group: {
        id: string;
        label: string;
        orders: POSOrder[];
        total: number;
        timestamp: number;
        status: 'paid' | 'cancelled' | 'mixed';
    } | null;
}

export function HistorySidebar({ isOpen, onClose, group }: HistorySidebarProps) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setVisible(true);
            document.body.style.overflow = 'hidden';
        } else {
            const timer = setTimeout(() => setVisible(false), 300); // Wait for transition
            document.body.style.overflow = 'unset';
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    if (!visible && !isOpen) return null;

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    };

    const formatDate = (seconds: number) => {
        if (!seconds) return '';
        return new Date(seconds * 1000).toLocaleString('en-US', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className={`fixed inset-0 z-50 flex justify-end transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/30 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Sidebar Panel */}
            <div className={`
                relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col
                transform transition-transform duration-300 ease-in-out
                ${isOpen ? 'translate-x-0' : 'translate-x-full'}
            `}>
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-100">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                            <Receipt className="text-brand-dark" size={24} />
                            Transaction Details
                        </h2>
                        {group && (
                            <p className="text-sm text-gray-500 mt-1">
                                {formatDate(group.timestamp)}
                            </p>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500 hover:text-gray-900"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {group ? (
                        <div className="space-y-8">
                            {/* Bill Summary Card */}
                            <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <h3 className="text-2xl font-black text-gray-900 mb-1">{group.label}</h3>
                                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${group.status === 'paid' ? 'bg-green-100 text-green-700' :
                                                group.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                                            }`}>
                                            {group.status === 'paid' ? <CheckCircle size={12} /> : <XCircle size={12} />}
                                            {group.status}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm text-gray-500 mb-1">Total Amount</div>
                                        <div className="text-2xl font-black text-brand-dark">
                                            {formatCurrency(group.total)}
                                        </div>
                                    </div>
                                </div>

                                {/* Payment Methods Used */}
                                <div className="space-y-2">
                                    {Array.from(new Set(group.orders.map(o => o.paymentMethod).filter(Boolean))).map(method => (
                                        <div key={method} className="flex items-center gap-2 text-sm text-gray-600 bg-white p-2 rounded-lg border border-gray-100 shadow-sm">
                                            <CreditCard size={16} />
                                            <span className="capitalize">Paid via {method}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Order Breakdown */}
                            <div>
                                <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <FileText size={16} />
                                    Order Breakdown ({group.orders.length})
                                </h4>

                                <div className="space-y-4">
                                    {group.orders.map((order, idx) => (
                                        <div key={order.id} className="border border-gray-100 rounded-xl overflow-hidden">
                                            <div className="bg-gray-50/50 p-3 flex justify-between items-center text-xs text-gray-500 border-b border-gray-100">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-gray-200">#{order.id.slice(-4)}</span>
                                                    <span>{new Date((order.createdAt?.seconds || 0) * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                                <div className={`font-bold ${order.status === 'cancelled' ? 'text-red-600' : 'text-green-600'
                                                    }`}>
                                                    {order.status.toUpperCase()}
                                                </div>
                                            </div>

                                            <div className="p-4 space-y-3 bg-white">
                                                {order.items.map((item, i) => (
                                                    <div key={i} className="flex justify-between items-start text-sm">
                                                        <div className="flex gap-3">
                                                            <span className="font-bold text-brand-dark w-6">{item.quantity}x</span>
                                                            <div>
                                                                <div className="text-gray-900 font-medium">{item.name}</div>
                                                                {item.variantName && (
                                                                    <div className="text-xs text-gray-500 italic">{item.variantName}</div>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="text-gray-600 font-medium whitespace-nowrap">
                                                            {formatCurrency(item.price * item.quantity)}
                                                        </div>
                                                    </div>
                                                ))}

                                                <div className="pt-3 border-t border-gray-50 flex justify-between items-center mt-3">
                                                    <span className="text-xs font-medium text-gray-400">Subtotal</span>
                                                    <span className="text-sm font-bold text-gray-900">{formatCurrency(order.total)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400">
                            <Clock size={48} className="mb-4 opacity-20" />
                            <p>Select a transaction to view details</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
