'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Loader2, Search, ChevronRight, Inbox, Tag } from 'lucide-react';
import PageShell from '@/components/PageShell';
import { listRegistrations } from '@/lib/registrations/api';
import type { RegistrationRequest, RegistrationStatus } from '@/lib/registrations/types';
import { StatusBadge } from '@/components/registrations/StatusBadge';

type FilterValue = RegistrationStatus | 'all';

const FILTERS: { value: FilterValue; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'pending', label: 'Pending' },
    { value: 'contacted', label: 'Contacted' },
    { value: 'activated', label: 'Activated' },
    { value: 'rejected', label: 'Rejected' },
];

function formatDate(ts: unknown): string {
    try {
        const tsAny = ts as { toDate?: () => Date } | Date | null | undefined;
        const d = typeof (tsAny as { toDate?: () => Date })?.toDate === 'function'
            ? (tsAny as { toDate: () => Date }).toDate()
            : tsAny instanceof Date ? tsAny : null;
        if (!d) return '—';
        return d.toLocaleString(undefined, {
            year: 'numeric', month: 'short', day: '2-digit',
            hour: '2-digit', minute: '2-digit',
        });
    } catch {
        return '—';
    }
}

export default function RegistrationsPage() {
    const [registrations, setRegistrations] = useState<RegistrationRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState<FilterValue>('all');

    useEffect(() => {
        let cancelled = false;
        const fetchData = async () => {
            setLoading(true);
            try {
                const list = await listRegistrations(filterStatus === 'all' ? undefined : filterStatus);
                if (!cancelled) setRegistrations(list);
            } catch (err: unknown) {
                if (!cancelled) toast.error('Failed to load registrations', { description: err instanceof Error ? err.message : String(err) });
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        fetchData();
        return () => { cancelled = true; };
    }, [filterStatus]);

    const filtered = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return registrations;
        return registrations.filter(r =>
            r.businessName?.toLowerCase().includes(q) ||
            r.name?.toLowerCase().includes(q) ||
            r.email?.toLowerCase().includes(q) ||
            r.phone?.toLowerCase().includes(q) ||
            r.city?.toLowerCase().includes(q) ||
            r.promoCode?.toLowerCase().includes(q)
        );
    }, [registrations, searchQuery]);

    const counts = useMemo(() => {
        const c: Record<string, number> = { all: registrations.length };
        for (const r of registrations) c[r.status] = (c[r.status] ?? 0) + 1;
        return c;
    }, [registrations]);

    return (
        <PageShell
            title="Registrations"
            subtitle={`${filtered.length} ${filterStatus === 'all' ? 'total' : filterStatus} ${searchQuery ? '(filtered)' : ''}`}
        >
            <div className="flex flex-wrap gap-2 mb-4">
                {FILTERS.map(f => {
                    const active = filterStatus === f.value;
                    const count = counts[f.value] ?? 0;
                    return (
                        <button
                            key={f.value}
                            onClick={() => setFilterStatus(f.value)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider border-2 transition-all ${
                                active
                                    ? 'bg-brand-dark text-white border-brand-dark'
                                    : 'bg-white border-gray-200 text-gray-500 hover:border-brand-dark/40'
                            }`}
                        >
                            {f.label}
                            {f.value !== 'all' && (
                                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${active ? 'bg-white/20' : 'bg-gray-100 text-gray-500'}`}>
                                    {count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm font-medium outline-none focus:border-brand-dark bg-white"
                    placeholder="Search by business, name, email, phone, city, promo..."
                />
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-16 text-gray-400 gap-2">
                        <Loader2 className="w-5 h-5 animate-spin" /> Loading...
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-16 text-gray-400">
                        <Inbox className="w-10 h-10 mx-auto mb-3 opacity-30" />
                        <p className="font-semibold">No registrations found</p>
                    </div>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="border-b border-gray-100 bg-slate-50">
                            <tr>
                                <th className="text-left px-5 py-3 text-xs font-black text-brand-dark uppercase tracking-wider">Business</th>
                                <th className="text-left px-5 py-3 text-xs font-black text-brand-dark uppercase tracking-wider">Contact</th>
                                <th className="text-left px-5 py-3 text-xs font-black text-brand-dark uppercase tracking-wider">Modules</th>
                                <th className="text-left px-5 py-3 text-xs font-black text-brand-dark uppercase tracking-wider">Promo</th>
                                <th className="text-left px-5 py-3 text-xs font-black text-brand-dark uppercase tracking-wider">Status</th>
                                <th className="text-left px-5 py-3 text-xs font-black text-brand-dark uppercase tracking-wider">Submitted</th>
                                <th className="px-5 py-3" />
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(r => (
                                <tr key={r.id} className="border-b border-gray-50 hover:bg-slate-50/50 transition-colors">
                                    <td className="px-5 py-4">
                                        <div className="font-black text-brand-dark">{r.businessName}</div>
                                        <div className="text-xs text-gray-400 mt-0.5">
                                            {r.city} · <span className="font-mono">{r.businessType}</span>
                                        </div>
                                    </td>
                                    <td className="px-5 py-4">
                                        <div className="text-gray-700 font-semibold text-xs">{r.name}</div>
                                        <div className="text-xs text-gray-400 mt-0.5">{r.email}</div>
                                        <div className="text-xs text-gray-400">{r.phone}</div>
                                    </td>
                                    <td className="px-5 py-4">
                                        <div className="flex items-center gap-1.5">
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 text-xs font-bold">
                                                {r.modules?.length ?? 0}
                                            </span>
                                            {r.bundle && (
                                                <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 text-[10px] font-black uppercase tracking-wider border border-amber-100">
                                                    {r.bundle}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-5 py-4">
                                        {r.promoCode ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 text-xs font-bold border border-purple-100">
                                                <Tag className="w-3 h-3" />
                                                {r.promoCode}
                                            </span>
                                        ) : (
                                            <span className="text-xs text-gray-300">—</span>
                                        )}
                                    </td>
                                    <td className="px-5 py-4">
                                        <StatusBadge status={r.status} />
                                    </td>
                                    <td className="px-5 py-4 text-xs text-gray-500">
                                        {formatDate(r.createdAt)}
                                    </td>
                                    <td className="px-5 py-4">
                                        <div className="flex items-center justify-end">
                                            <Link
                                                href={`/registrations/${r.id}`}
                                                className="flex items-center gap-1 px-3 py-1.5 bg-brand-dark text-white text-xs font-bold rounded-lg hover:opacity-90 transition-opacity"
                                            >
                                                Review <ChevronRight className="w-3 h-3" />
                                            </Link>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </PageShell>
    );
}
