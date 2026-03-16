'use client';

import { useState } from 'react';
import { POSOrder } from '@/lib/modules/byod_pos/types';
import { ChevronDown, ChevronRight, CheckCircle, Clock, XCircle, User, CreditCard, Receipt } from 'lucide-react';

interface HistoryBillRowProps {
    group: {
        id: string;
        displayId?: string; // NEW
        label: string;
        orders: POSOrder[];
        total: number;
        timestamp: number;
        status: 'paid' | 'cancelled' | 'mixed';
    };
    onClick: () => void;
}

export function HistoryBillRow({ group, onClick }: HistoryBillRowProps) {

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
            month: 'numeric',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Determine aggregate status color/icon
    let StatusIcon = CheckCircle;
    let statusColor = 'text-green-500 bg-green-50';

    if (group.status === 'cancelled') {
        StatusIcon = XCircle;
        statusColor = 'text-red-500 bg-red-50';
    } else if (group.status === 'mixed') {
        StatusIcon = Clock; // Or some other icon for mixed
        statusColor = 'text-orange-500 bg-orange-50';
    }

    return (
        <div className="group border-b border-gray-100 dark:border-neutral-800 last:border-0 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors">
            {/* Header Row (Click to Open Sidebar) */}
            <div
                onClick={onClick}
                className="flex items-center gap-4 p-4 cursor-pointer"
            >
                <div className={`p-2 rounded-full ${statusColor}`}>
                    <Receipt size={20} />
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-bold text-gray-900 dark:text-neutral-100 truncate">
                            {group.label}
                        </span>
                        {/* Display ID Badge */}
                        {group.displayId && (
                            <span className="font-mono text-[10px] text-gray-500 dark:text-neutral-500 bg-gray-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded border border-gray-200 dark:border-neutral-800">
                                {group.displayId}
                            </span>
                        )}
                        <span className="text-xs text-gray-400 dark:text-neutral-600 font-medium px-1.5 py-0.5 bg-gray-100 dark:bg-neutral-800 rounded-md">
                            {group.orders.length} orders
                        </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-neutral-500">
                        <span className="flex items-center gap-1">
                            <Clock size={12} />
                            {formatDate(group.timestamp)}
                        </span>
                        {group.orders[0]?.paymentMethod && (
                            <span className="flex items-center gap-1 uppercase">
                                <CreditCard size={12} />
                                {group.orders[0].paymentMethod}
                            </span>
                        )}
                    </div>
                </div>

                <div className="text-right">
                    <div className="font-bold text-gray-900 dark:text-neutral-100">
                        {formatCurrency(group.total)}
                    </div>
                    <div className={`text-xs font-bold uppercase ${group.status === 'paid' ? 'text-green-600' :
                        group.status === 'cancelled' ? 'text-red-600' : 'text-gray-500 dark:text-neutral-500'
                        }`}>
                        {group.status}
                    </div>
                </div>

                <div className="text-gray-400 dark:text-neutral-600 group-hover:text-brand-dark transition-colors">
                    <ChevronRight size={20} />
                </div>
            </div>
        </div>
    );
}
