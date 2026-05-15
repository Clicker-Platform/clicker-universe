'use client';

import { useState, useEffect, useMemo } from 'react';
import { httpsCallable } from 'firebase/functions';
import { collection, query, where, orderBy, limit, onSnapshot, getDoc, doc } from 'firebase/firestore';
import { functions, db } from '@/lib/firebase';
import { toast } from 'sonner';
import PageShell from '@/components/PageShell';
import Link from 'next/link';
import { MessageSquare, ChevronRight, Loader2 } from 'lucide-react';

interface Tenant {
    id: string;
    name: string;
}

interface TenantWA {
    id: string;
    name: string;
    phone?: string;
    enabled: boolean;
    lastErrorEvent?: string;
    lastErrorAt?: Date;
}

export default function WhatsAppPage() {
    const [tenantList, setTenantList] = useState<Tenant[]>([]);
    const [waData, setWaData] = useState<Record<string, Partial<TenantWA>>>({});
    const [recentErrors, setRecentErrors] = useState<Record<string, { event: string; at: Date }>>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetch = async () => {
            try {
                const fn = httpsCallable<unknown, { list?: Tenant[] }>(functions, 'getTenants');
                const res = await fn();
                const list: Tenant[] = res.data.list ?? [];
                setTenantList(list);

                const settingsResults = await Promise.all(
                    list.map(async (t) => {
                        try {
                            const snap = await getDoc(doc(db, 'sites', t.id, 'settings', 'whatsapp'));
                            return { id: t.id, data: snap.exists() ? snap.data() : null };
                        } catch {
                            return { id: t.id, data: null };
                        }
                    })
                );
                const map: Record<string, Partial<TenantWA>> = {};
                settingsResults.forEach(({ id, data }) => {
                    map[id] = {
                        phone: data?.phoneNumber || data?.phone,
                        enabled: !!data?.enabled,
                    };
                });
                setWaData(map);
            } catch (err: unknown) {
                toast.error('Failed to load tenants', { description: err instanceof Error ? err.message : String(err) });
            } finally {
                setLoading(false);
            }
        };
        fetch();
    }, []);

    useEffect(() => {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const q = query(
            collection(db, 'platform_logs'),
            where('level', '==', 'error'),
            orderBy('ts', 'desc'),
            limit(200)
        );
        const unsub = onSnapshot(q, snap => {
            const errMap: Record<string, { event: string; at: Date }> = {};
            snap.docs.forEach(d => {
                const data = d.data();
                const event: string = data.event || '';
                if (!event.startsWith('wa.')) return;
                const at: Date | undefined = data.ts?.toDate?.();
                if (!at || at < since) return;
                const siteId: string = data.siteId || 'platform';
                if (!errMap[siteId] || at > errMap[siteId].at) {
                    errMap[siteId] = { event, at };
                }
            });
            setRecentErrors(errMap);
        }, () => { /* non-critical */ });
        return unsub;
    }, []);

    const tenants = useMemo<TenantWA[]>(() =>
        tenantList.map(t => ({
            id: t.id,
            name: t.name,
            phone: waData[t.id]?.phone,
            enabled: waData[t.id]?.enabled ?? false,
            lastErrorEvent: recentErrors[t.id]?.event,
            lastErrorAt: recentErrors[t.id]?.at,
        })),
        [tenantList, waData, recentErrors]
    );

    const stats = useMemo(() => {
        const total = tenants.filter(t => t.enabled).length;
        const issues = tenants.filter(t => t.lastErrorEvent).length;
        const ok = total - issues;
        return { total, ok, issues };
    }, [tenants]);

    const timeAgo = (d: Date) => {
        const sec = Math.floor((Date.now() - d.getTime()) / 1000);
        if (sec < 60) return `${sec}s ago`;
        if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
        return `${Math.floor(sec / 3600)}h ago`;
    };

    return (
        <PageShell
            title="WhatsApp Manager"
            subtitle="WA connection status across tenants"
        >
            <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-white rounded-2xl border border-gray-200 p-5">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">WA Tenants</p>
                    <p className="text-2xl font-black text-brand-dark mt-1">{loading ? '—' : stats.total}</p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-200 p-5">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Healthy</p>
                    <p className="text-2xl font-black text-green-600 mt-1">{loading ? '—' : stats.ok}</p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-200 p-5">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Issues (24h)</p>
                    <p className="text-2xl font-black text-red-600 mt-1">{loading ? '—' : stats.issues}</p>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-16 text-gray-400 gap-2">
                        <Loader2 className="w-5 h-5 animate-spin" /> Loading...
                    </div>
                ) : tenants.length === 0 ? (
                    <div className="text-center py-16 text-gray-400">
                        <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
                        <p className="font-semibold">No tenants found</p>
                    </div>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="border-b border-gray-100 bg-slate-50">
                            <tr>
                                <th className="text-left px-5 py-3 text-xs font-black text-brand-dark uppercase tracking-wider">Tenant</th>
                                <th className="text-left px-5 py-3 text-xs font-black text-brand-dark uppercase tracking-wider">Phone</th>
                                <th className="text-left px-5 py-3 text-xs font-black text-brand-dark uppercase tracking-wider">Status</th>
                                <th className="text-left px-5 py-3 text-xs font-black text-brand-dark uppercase tracking-wider">Last Error (24h)</th>
                                <th className="px-5 py-3" />
                            </tr>
                        </thead>
                        <tbody>
                            {tenants.map(t => {
                                const hasError = !!t.lastErrorEvent;
                                return (
                                    <tr key={t.id} className="border-b border-gray-50 hover:bg-slate-50/50">
                                        <td className="px-5 py-3">
                                            <div className="font-black text-brand-dark text-sm">{t.name}</div>
                                            <div className="text-xs text-gray-400 font-mono">{t.id}</div>
                                        </td>
                                        <td className="px-5 py-3 font-mono text-xs text-gray-500">{t.phone || '—'}</td>
                                        <td className="px-5 py-3">
                                            {!t.enabled ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-500 border border-gray-200">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400" /> Disabled
                                                </span>
                                            ) : hasError ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-100">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> Error
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-100">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> OK
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-5 py-3 text-xs">
                                            {t.lastErrorEvent ? (
                                                <div>
                                                    <span className="font-mono text-red-600">{t.lastErrorEvent}</span>
                                                    {t.lastErrorAt && (
                                                        <div className="text-gray-400 mt-0.5">{timeAgo(t.lastErrorAt)}</div>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-gray-300">—</span>
                                            )}
                                        </td>
                                        <td className="px-5 py-3 text-right">
                                            <Link href={`/monitoring?siteId=${t.id}`}
                                                className="flex items-center justify-end gap-1 text-xs font-bold text-gray-500 hover:text-brand-dark transition-colors">
                                                View Logs <ChevronRight className="w-3 h-3" />
                                            </Link>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </PageShell>
    );
}
