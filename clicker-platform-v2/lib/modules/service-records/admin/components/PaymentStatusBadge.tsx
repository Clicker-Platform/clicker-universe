'use client';

import type { PaymentStatus } from '../../types';

const PAYMENT_CONFIG: Record<PaymentStatus, { label: string; className: string }> = {
    UNPAID:  { label: 'Unpaid',   className: 'bg-red-100 text-red-600' },
    PARTIAL: { label: 'Partial',  className: 'bg-yellow-100 text-yellow-700' },
    PAID:    { label: 'Paid',     className: 'bg-green-100 text-green-700' },
};

interface Props {
    status: PaymentStatus;
    size?: 'sm' | 'md';
}

export function PaymentStatusBadge({ status, size = 'md' }: Props) {
    const cfg = PAYMENT_CONFIG[status] ?? { label: status, className: 'bg-gray-100 text-gray-600' };
    const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-xs px-2.5 py-1';
    return (
        <span className={`inline-flex items-center rounded-full font-medium ${sizeClass} ${cfg.className}`}>
            {cfg.label}
        </span>
    );
}
