'use client';

import { useEffect, useState, useCallback } from 'react';
import { Ticket, Copy, Check, XCircle } from 'lucide-react';
import { useSite } from '@/lib/site-context';
import { useUser } from '@/lib/user-context';
import { logger } from '@/lib/logger-edge';
import { listAllVouchers, revokeVoucher } from '@/lib/modules/promo/api';
import { GrantVoucherDialog } from './GrantVoucherDialog';
import type { Voucher, VoucherStatus } from '@/lib/modules/promo/api';

type TabStatus = 'all' | VoucherStatus;

const TABS: { key: TabStatus; label: string }[] = [
    { key: 'all',     label: 'All' },
    { key: 'active',  label: 'Active' },
    { key: 'used',    label: 'Used' },
    { key: 'expired', label: 'Expired' },
];

function formatValue(voucher: Voucher): string {
    if (voucher.snapshotKind === 'percent') return `${voucher.snapshotValue}%`;
    return `Rp ${voucher.snapshotValue.toLocaleString('id-ID')}`;
}

function formatDate(ts: { toDate(): Date } | undefined): string {
    if (!ts) return 'No expiry';
    return ts.toDate().toLocaleDateString('id-ID', {
        day: '2-digit', month: 'short', year: 'numeric',
    });
}

function VoucherStatusBadge({ status }: { status: VoucherStatus }) {
    const cls: Record<VoucherStatus, string> = {
        active:  'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
        used:    'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
        expired: 'bg-gray-100 dark:bg-neutral-700 text-gray-500 dark:text-neutral-400',
    };
    const label: Record<VoucherStatus, string> = {
        active: 'Active', used: 'Used', expired: 'Expired',
    };
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${cls[status]}`}>
            {label[status]}
        </span>
    );
}

function IssuedViaBadge({ via }: { via: Voucher['issuedVia'] }) {
    const cls: Record<Voucher['issuedVia'], string> = {
        points_redemption: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
        admin_grant:       'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
        auto_grant:        'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400',
    };
    const label: Record<Voucher['issuedVia'], string> = {
        points_redemption: 'Points',
        admin_grant:       'Admin',
        auto_grant:        'Auto',
    };
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${cls[via]}`}>
            {label[via]}
        </span>
    );
}

function CopyCodeButton({ code }: { code: string }) {
    const [copied, setCopied] = useState(false);

    async function handleCopy() {
        await navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    }

    return (
        <button
            onClick={handleCopy}
            title="Copy code"
            className="p-1 rounded text-gray-400 dark:text-neutral-500 hover:text-gray-600 dark:hover:text-neutral-300 transition-colors"
        >
            {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
    );
}

export default function VouchersPage() {
    const { siteId } = useSite();
    const { canEdit } = useUser();
    const [vouchers, setVouchers] = useState<Voucher[]>([]);
    const [activeTab, setActiveTab] = useState<TabStatus>('all');
    const [loading, setLoading] = useState(true);
    const [grantOpen, setGrantOpen] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const load = useCallback(async () => {
        if (!siteId) return;
        setLoading(true);
        try {
            const data = await listAllVouchers(siteId);
            setVouchers(data);
        } catch (err) {
            logger.error('promo.vouchers.load.failed', { siteId, error: err });
        } finally {
            setLoading(false);
        }
    }, [siteId]);

    useEffect(() => {
        load();
    }, [load]);

    const filtered = activeTab === 'all'
        ? vouchers
        : vouchers.filter(v => v.status === activeTab);

    async function handleRevoke(voucher: Voucher) {
        if (!canEdit('promo', 'vouchers') || !siteId) return;
        if (!window.confirm(`Revoke voucher "${voucher.code}"? This cannot be undone.`)) return;
        setActionLoading(voucher.id);
        try {
            await revokeVoucher(siteId, voucher.id);
            setVouchers(prev => prev.map(v =>
                v.id === voucher.id ? { ...v, status: 'expired' as VoucherStatus } : v
            ));
        } catch (err) {
            logger.error('promo.voucher.revoke.failed', { siteId, voucherId: voucher.id, error: err });
        } finally {
            setActionLoading(null);
        }
    }

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-neutral-100">Vouchers</h1>
                <button
                    onClick={() => setGrantOpen(true)}
                    className="flex items-center gap-1.5 bg-studio-blue text-white px-3 py-2 rounded-lg text-sm font-semibold transition-colors hover:bg-studio-blue/90 active:scale-95"
                >
                    <Ticket className="w-4 h-4" />
                    Grant Voucher
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 dark:bg-neutral-800 p-1 rounded-lg overflow-x-auto">
                {TABS.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                            activeTab === tab.key
                                ? 'bg-white dark:bg-neutral-700 shadow text-gray-900 dark:text-neutral-100'
                                : 'text-gray-600 dark:text-neutral-400 hover:bg-white/60 dark:hover:bg-neutral-700/60'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800 overflow-hidden">
                {loading ? (
                    <div className="p-8 space-y-3">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="h-10 bg-gray-100 dark:bg-neutral-800 rounded-lg animate-pulse" />
                        ))}
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="p-12 text-center">
                        <Ticket className="w-10 h-10 text-gray-300 dark:text-neutral-600 mx-auto mb-3" />
                        <p className="text-sm font-medium text-gray-500 dark:text-neutral-400">
                            {activeTab === 'all' ? 'No vouchers yet.' : `No ${activeTab} vouchers.`}
                        </p>
                        {activeTab === 'all' && (
                            <button
                                onClick={() => setGrantOpen(true)}
                                className="mt-4 text-sm text-brand-dark dark:text-brand-green font-medium hover:underline"
                            >
                                + Grant your first voucher
                            </button>
                        )}
                    </div>
                ) : (
                    <>
                        {/* Desktop table */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 dark:bg-neutral-800 border-b border-gray-100 dark:border-neutral-700">
                                    <tr>
                                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wide">Code</th>
                                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wide">Promo</th>
                                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wide">Owner</th>
                                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wide">Issued via</th>
                                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wide">Value</th>
                                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wide">Status</th>
                                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wide">Expires</th>
                                        <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wide">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50 dark:divide-neutral-800">
                                    {filtered.map(voucher => (
                                        <tr key={voucher.id} className="hover:bg-gray-50 dark:hover:bg-neutral-800/60 transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-1">
                                                    <span className="font-mono text-xs bg-gray-100 dark:bg-neutral-700 text-gray-700 dark:text-neutral-200 px-2 py-0.5 rounded">
                                                        {voucher.code}
                                                    </span>
                                                    <CopyCodeButton code={voucher.code} />
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-gray-500 dark:text-neutral-400 text-xs font-mono truncate max-w-[120px]">
                                                {voucher.promoId}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="text-sm font-medium text-gray-800 dark:text-neutral-200 truncate max-w-[120px]">
                                                    {voucher.ownerName ?? voucher.ownerMemberId}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <IssuedViaBadge via={voucher.issuedVia} />
                                            </td>
                                            <td className="px-4 py-3 font-medium text-gray-700 dark:text-neutral-300">
                                                {formatValue(voucher)}
                                                {voucher.snapshotKind === 'percent' && voucher.snapshotMaxDiscount && (
                                                    <span className="text-xs text-gray-400 dark:text-neutral-500 ml-1">
                                                        (max Rp {voucher.snapshotMaxDiscount.toLocaleString('id-ID')})
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <VoucherStatusBadge status={voucher.status} />
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-500 dark:text-neutral-400">
                                                {formatDate(voucher.expiresAt)}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-end">
                                                    {voucher.status === 'active' && (
                                                        <button
                                                            onClick={() => handleRevoke(voucher)}
                                                            disabled={actionLoading === voucher.id}
                                                            title="Revoke"
                                                            className="p-1.5 rounded-lg text-gray-400 dark:text-neutral-500 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 transition-colors disabled:opacity-40"
                                                        >
                                                            <XCircle className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile cards */}
                        <div className="md:hidden divide-y divide-gray-50 dark:divide-neutral-800">
                            {filtered.map(voucher => (
                                <div key={voucher.id} className="p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className="font-mono text-xs bg-gray-100 dark:bg-neutral-700 text-gray-700 dark:text-neutral-200 px-2 py-0.5 rounded">
                                                    {voucher.code}
                                                </span>
                                                <CopyCodeButton code={voucher.code} />
                                            </div>
                                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                                <VoucherStatusBadge status={voucher.status} />
                                                <IssuedViaBadge via={voucher.issuedVia} />
                                            </div>
                                            <p className="text-sm text-gray-600 dark:text-neutral-400 mt-1">
                                                {voucher.ownerName ?? voucher.ownerMemberId} · {formatValue(voucher)}
                                            </p>
                                            <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">
                                                Expires: {formatDate(voucher.expiresAt)}
                                            </p>
                                        </div>
                                        <div className="flex items-center flex-shrink-0">
                                            {voucher.status === 'active' && (
                                                <button
                                                    onClick={() => handleRevoke(voucher)}
                                                    disabled={actionLoading === voucher.id}
                                                    title="Revoke"
                                                    className="p-1.5 rounded-lg text-gray-400 dark:text-neutral-500 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 transition-colors disabled:opacity-40"
                                                >
                                                    <XCircle className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* Grant Voucher Dialog */}
            {grantOpen && siteId && (
                <GrantVoucherDialog
                    siteId={siteId}
                    onClose={() => setGrantOpen(false)}
                    onGranted={() => { load(); }}
                />
            )}
        </div>
    );
}
