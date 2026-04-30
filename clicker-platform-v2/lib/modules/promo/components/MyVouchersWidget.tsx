'use client';

import React, { useEffect, useState } from 'react';
import { Ticket, Copy, Check } from 'lucide-react';
import { useSite } from '@/lib/site-context';
import { logger } from '@/lib/logger-edge';
import { listMemberVouchers } from '../api/vouchers';
import type { Voucher } from '../types';

interface MyVouchersWidgetProps {
    memberId?: string;
    memberPhone?: string;
}

function formatVoucherValue(voucher: Voucher): string {
    if (voucher.snapshotKind === 'percent') return `${voucher.snapshotValue}% off`;
    return `Rp ${voucher.snapshotValue.toLocaleString('id-ID')} off`;
}

function formatExpiry(voucher: Voucher): string {
    if (!voucher.expiresAt) return 'No expiry';
    const date = voucher.expiresAt.toDate ? voucher.expiresAt.toDate() : new Date();
    return `Expires ${date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

const STATUS_STYLES: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    used: 'bg-gray-100 text-gray-500',
    expired: 'bg-red-100 text-red-500',
};

export default function MyVouchersWidget({ memberId }: MyVouchersWidgetProps) {
    const { siteId } = useSite();
    const [vouchers, setVouchers] = useState<Voucher[]>([]);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState<string | null>(null);

    useEffect(() => {
        async function load() {
            if (!siteId || !memberId) {
                setLoading(false);
                return;
            }
            try {
                const data = await listMemberVouchers(siteId, memberId);
                // Sort: active first, then used/expired
                const sorted = [...data].sort((a, b) => {
                    if (a.status === 'active' && b.status !== 'active') return -1;
                    if (a.status !== 'active' && b.status === 'active') return 1;
                    return 0;
                });
                setVouchers(sorted);
            } catch (err) {
                logger.error('promo.my-vouchers.widget.load.failed', { siteId, error: err });
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [siteId, memberId]);

    async function handleCopy(code: string) {
        try {
            await navigator.clipboard.writeText(code);
            setCopied(code);
            setTimeout(() => setCopied(null), 2000);
        } catch {
            // clipboard not available in some environments
        }
    }

    if (loading) {
        return (
            <div className="space-y-3">
                <div className="flex items-center gap-2 mb-2">
                    <Ticket size={16} className="text-indigo-600" />
                    <h3 className="font-semibold text-gray-700 text-sm">My Vouchers</h3>
                </div>
                {[1, 2].map(i => (
                    <div key={i} className="animate-pulse h-16 bg-gray-100 rounded-xl" />
                ))}
            </div>
        );
    }

    if (vouchers.length === 0) {
        return (
            <div className="space-y-2">
                <div className="flex items-center gap-2 mb-2">
                    <Ticket size={16} className="text-indigo-600" />
                    <h3 className="font-semibold text-gray-700 text-sm">My Vouchers</h3>
                </div>
                <p className="text-sm text-gray-400 text-center py-4">
                    No vouchers yet. Redeem your points for rewards!
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2 mb-2">
                <Ticket size={16} className="text-indigo-600" />
                <h3 className="font-semibold text-gray-700 text-sm">My Vouchers</h3>
            </div>

            {vouchers.map(voucher => (
                <div
                    key={voucher.id}
                    className={`bg-white p-4 rounded-xl shadow-sm border border-gray-100 ${
                        voucher.status !== 'active' ? 'opacity-60' : ''
                    }`}
                >
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                            {/* Code row */}
                            <div className="flex items-center gap-2">
                                <span className="font-mono text-sm font-bold text-gray-800 tracking-widest">
                                    {voucher.code}
                                </span>
                                <button
                                    onClick={() => handleCopy(voucher.code)}
                                    className="text-gray-400 hover:text-indigo-600 transition"
                                    aria-label="Copy code"
                                >
                                    {copied === voucher.code ? (
                                        <Check size={13} className="text-green-500" />
                                    ) : (
                                        <Copy size={13} />
                                    )}
                                </button>
                            </div>

                            {/* Value + expiry */}
                            <div className="flex items-center gap-3 mt-1">
                                <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                                    {formatVoucherValue(voucher)}
                                </span>
                                <span className="text-xs text-gray-400">{formatExpiry(voucher)}</span>
                            </div>
                        </div>

                        {/* Status badge */}
                        <span
                            className={`flex-shrink-0 text-[10px] px-2 py-1 rounded-full uppercase font-bold ${
                                STATUS_STYLES[voucher.status] ?? 'bg-gray-100 text-gray-500'
                            }`}
                        >
                            {voucher.status}
                        </span>
                    </div>
                </div>
            ))}
        </div>
    );
}
