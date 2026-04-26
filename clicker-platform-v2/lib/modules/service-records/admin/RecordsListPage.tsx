'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, ClipboardList } from 'lucide-react';
import { useSite } from '@/lib/site-context';
import { logger } from '@/lib/logger-edge';
import { getServiceRecords } from '../api';
import { RecordStatusBadge } from './components/RecordStatusBadge';
import { PaymentStatusBadge } from './components/PaymentStatusBadge';
import type { ServiceRecord, RecordStatus } from '../types';
import type { QueryDocumentSnapshot } from 'firebase/firestore';

type TabStatus = 'ALL' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

const TABS: { key: TabStatus; label: string; highlight?: boolean }[] = [
    { key: 'ALL',       label: 'All' },
    { key: 'ACTIVE',    label: 'Active', highlight: true },
    { key: 'COMPLETED', label: 'Completed' },
    { key: 'CANCELLED', label: 'Cancelled' },
];

function formatDate(ts: any): string {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function RecordsListPage() {
    const router = useRouter();
    const { siteId } = useSite();
    const [records, setRecords] = useState<ServiceRecord[]>([]);
    const [activeTab, setActiveTab] = useState<TabStatus>('ALL');
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
    const [hasMore, setHasMore] = useState(false);

    const PAGE_SIZE = 50;

    const load = useCallback(async (tab: TabStatus, reset = true) => {
        if (!siteId) return;
        if (reset) setLoading(true);
        else setLoadingMore(true);
        try {
            const filters = {
                status: tab === 'ALL' ? undefined : tab as RecordStatus,
                limit: PAGE_SIZE,
            };
            const { records: newRecords, lastDoc: newLastDoc } = await getServiceRecords(
                siteId,
                filters,
                reset ? null : lastDoc
            );
            setRecords(prev => reset ? newRecords : [...prev, ...newRecords]);
            setLastDoc(newLastDoc);
            setHasMore(newRecords.length === PAGE_SIZE);
        } catch (err) {
            logger.error('service-records.records-list.load.failed', { siteId, error: err });
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [siteId, lastDoc]);

    useEffect(() => {
        load(activeTab, true);
    }, [siteId, activeTab]);

    function handleTabChange(tab: TabStatus) {
        setActiveTab(tab);
        setRecords([]);
        setLastDoc(null);
        setSearch('');
    }

    const filtered = search.trim()
        ? records.filter(r =>
            r.vehiclePlate.includes(search.toUpperCase().replace(/\s/g, '')) ||
            (r.memberName || '').toLowerCase().includes(search.toLowerCase()) ||
            (r.serviceTypeName || '').toLowerCase().includes(search.toLowerCase())
        )
        : records;

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h1 className="hidden md:block text-2xl font-bold text-gray-900 dark:text-neutral-100">Service Records</h1>
                <button
                    onClick={() => router.push('/admin/service-records/new')}
                    className="hidden md:flex items-center gap-1.5 bg-studio-blue text-white px-3 py-2 rounded-lg text-sm font-semibold transition-colors hover:bg-studio-blue/90 active:scale-95"
                >
                    <Plus className="w-4 h-4" />
                    New Record
                </button>
            </div>

            {/* Mobile FAB */}
            <button
                onClick={() => router.push('/admin/service-records/new')}
                className="md:hidden fixed bottom-20 right-4 z-30 w-14 h-14 bg-studio-blue text-white rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-transform"
                style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
                aria-label="New Record"
            >
                <Plus className="w-6 h-6" />
            </button>

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 dark:bg-neutral-800 p-1 rounded-lg overflow-x-auto">
                {TABS.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => handleTabChange(tab.key)}
                        className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                            activeTab === tab.key
                                ? 'bg-white dark:bg-neutral-700 shadow text-gray-900 dark:text-neutral-100'
                                : tab.highlight
                                    ? 'text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30'
                                    : 'text-gray-600 dark:text-neutral-400 hover:bg-white/60 dark:hover:bg-neutral-700/60'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-neutral-500" />
                <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search by plate, owner, or service type…"
                    className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-gray-400 dark:focus:border-neutral-500 focus:ring-0 text-sm"
                />
            </div>

            {/* Records */}
            <div className="bg-white dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800 overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-sm text-gray-400 dark:text-neutral-500">Loading records…</div>
                ) : filtered.length === 0 ? (
                    <div className="p-12 text-center">
                        <ClipboardList className="w-10 h-10 text-gray-300 dark:text-neutral-600 mx-auto mb-3" />
                        <p className="text-sm font-medium text-gray-500 dark:text-neutral-400">
                            {search ? 'No records match your search' : 'No service records yet'}
                        </p>
                        {!search && (
                            <button
                                onClick={() => router.push('/admin/service-records/new')}
                                className="mt-4 text-sm text-brand-dark dark:text-brand-green font-medium hover:underline"
                            >
                                + Create first service record
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
                                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wide">Plate</th>
                                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wide">Owner / Customer</th>
                                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wide">Service Type</th>
                                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wide">Status</th>
                                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wide">Payment</th>
                                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wide">Total</th>
                                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wide">Updated</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50 dark:divide-neutral-800">
                                    {filtered.map(record => (
                                        <tr
                                            key={record.id}
                                            onClick={() => router.push(`/admin/service-records/detail?id=${record.id}`)}
                                            className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors ${
                                                ''
                                            }`}
                                        >
                                            <td className="px-4 py-3 font-mono font-semibold text-gray-900 dark:text-neutral-100">{record.vehiclePlate}</td>
                                            <td className="px-4 py-3 text-gray-700 dark:text-neutral-300">
                                                <span className="flex items-center gap-1.5 flex-wrap">
                                                    {record.memberName || <span className="text-gray-400 dark:text-neutral-500 italic">Walk-in</span>}
                                                    {record.memberId && (
                                                        <span className="text-xs bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-full font-medium">Member</span>
                                                    )}
                                                </span>
                                                {record.memberPhone && (
                                                    <p className="text-xs text-gray-400 dark:text-neutral-500">{record.memberPhone}</p>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-gray-700 dark:text-neutral-300">{record.serviceTypeName}</td>
                                            <td className="px-4 py-3">
                                                <RecordStatusBadge status={record.status} size="sm" />
                                            </td>
                                            <td className="px-4 py-3">
                                                <PaymentStatusBadge status={record.paymentStatus} size="sm" />
                                            </td>
                                            <td className="px-4 py-3 text-gray-700 dark:text-neutral-300 font-medium">
                                                {record.paymentStatus === 'PAID'
                                                    ? (record.amountPaid ? `Rp ${record.amountPaid.toLocaleString()}` : '—')
                                                    : (record.totalAmount ? `Rp ${record.totalAmount.toLocaleString()}` : '—')}
                                            </td>
                                            <td className="px-4 py-3 text-gray-400 dark:text-neutral-500 text-xs">{formatDate(record.updatedAt)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile cards */}
                        <div className="md:hidden divide-y divide-gray-50 dark:divide-neutral-800">
                            {filtered.map(record => (
                                <div
                                    key={record.id}
                                    onClick={() => router.push(`/admin/service-records/detail?id=${record.id}`)}
                                    className={`p-4 cursor-pointer active:bg-gray-50 dark:active:bg-neutral-800 ${
                                        ''
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <p className="font-mono font-bold text-gray-900 dark:text-neutral-100">{record.vehiclePlate}</p>
                                            <p className="text-sm text-gray-600 dark:text-neutral-400 mt-0.5">{record.serviceTypeName}</p>
                                            <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">
                                                {record.memberName || 'Walk-in'} · {formatDate(record.updatedAt)}
                                            </p>
                                        </div>
                                        <div className="flex flex-col items-end gap-1.5">
                                            <RecordStatusBadge status={record.status} size="sm" />
                                            <PaymentStatusBadge status={record.paymentStatus} size="sm" />
                                        </div>
                                    </div>
                                    {(record.paymentStatus === 'PAID' ? record.amountPaid : record.totalAmount) > 0 && (
                                        <p className="text-sm font-semibold text-gray-800 dark:text-neutral-200 mt-1">
                                            Rp {(record.paymentStatus === 'PAID' ? record.amountPaid : record.totalAmount).toLocaleString()}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Load more */}
                        {hasMore && (
                            <div className="p-4 text-center border-t border-gray-50 dark:border-neutral-800">
                                <button
                                    onClick={() => load(activeTab, false)}
                                    disabled={loadingMore}
                                    className="text-sm text-brand-dark dark:text-brand-green font-medium hover:underline disabled:opacity-50"
                                >
                                    {loadingMore ? 'Loading…' : 'Load more'}
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
