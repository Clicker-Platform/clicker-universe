'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, ClipboardList } from 'lucide-react';
import { useSite } from '@/lib/site-context';
import { getServiceRecords } from '../api';
import { RecordStatusBadge } from './components/RecordStatusBadge';
import { PaymentStatusBadge } from './components/PaymentStatusBadge';
import type { ServiceRecord, RecordStatus } from '../types';
import type { QueryDocumentSnapshot } from 'firebase/firestore';

type TabStatus = 'ALL' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

const TABS: { key: TabStatus; label: string }[] = [
    { key: 'ALL',       label: 'All' },
    { key: 'ACTIVE',    label: 'Active' },
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
            console.error('[SR RecordsListPage] load error:', err);
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
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-neutral-100">Service Records</h1>
                    <p className="text-sm text-gray-500 dark:text-neutral-500 mt-0.5">Manage vehicle service jobs and warranty cards.</p>
                </div>
                <button
                    onClick={() => router.push('/admin/service-records/new')}
                    className="flex items-center gap-2 bg-studio-blue text-white px-4 py-2.5 rounded-xl text-sm font-medium"
                >
                    <Plus className="w-4 h-4" />
                    New Record
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 dark:bg-neutral-800 p-1 rounded-xl overflow-x-auto">
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
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-gray-400 dark:focus:border-neutral-500 focus:ring-0 text-sm"
                />
            </div>

            {/* Records */}
            <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-200 dark:border-neutral-800 shadow-sm overflow-hidden">
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
                                                {record.memberName || <span className="text-gray-400 dark:text-neutral-500 italic">Walk-in</span>}
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
