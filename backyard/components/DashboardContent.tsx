'use client';

import { useState, useEffect, useMemo } from 'react';
import { httpsCallable } from 'firebase/functions';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { functions, db } from '@/lib/firebase';
import Link from 'next/link';
import {
    Activity,
    AlertCircle,
    AlertTriangle,
    ChevronRight,
    Loader2,
    MessageSquare,
    PowerOff,
    Store,
    Users as UsersIcon,
} from 'lucide-react';

interface Tenant {
    id: string;
    name: string;
    status?: 'active' | 'suspended';
}

interface LogEntry {
    id: string;
    event: string;
    siteId: string;
    level: 'error' | 'warn' | 'info';
    ts: Date;
    meta?: Record<string, unknown>;
}

const timeAgo = (d: Date) => {
    const sec = Math.floor((Date.now() - d.getTime()) / 1000);
    if (sec < 60) return `${sec}s ago`;
    if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
    if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
    return `${Math.floor(sec / 86400)}d ago`;
};

export default function DashboardContent() {
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [usersCount, setUsersCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [recentLogs, setRecentLogs] = useState<LogEntry[]>([]);

    // Fetch tenants + users
    useEffect(() => {
        const fetch = async () => {
            try {
                const [tenantsRes, usersRes] = await Promise.all([
                    httpsCallable(functions, 'getTenants')(),
                    httpsCallable(functions, 'listUsers')(),
                ]);
                setTenants(((tenantsRes.data as any)?.list ?? []) as Tenant[]);
                setUsersCount(((usersRes.data as any)?.users ?? []).filter((u: any) => u.email).length);
            } catch { /* non-critical */ }
            finally { setLoading(false); }
        };
        fetch();
    }, []);

    // Live error feed (last 24h)
    useEffect(() => {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const q = query(
            collection(db, 'platform_logs'),
            where('level', '==', 'error'),
            orderBy('ts', 'desc'),
            limit(50)
        );
        const unsub = onSnapshot(q, snap => {
            const entries: LogEntry[] = snap.docs
                .map(d => {
                    const data = d.data();
                    const ts: Date | undefined = data.ts?.toDate?.();
                    if (!ts || ts < since) return null;
                    return {
                        id: d.id,
                        event: data.event || 'unknown',
                        siteId: data.siteId || 'platform',
                        level: data.level,
                        ts,
                        meta: data.meta,
                    } as LogEntry;
                })
                .filter((e): e is LogEntry => e !== null);
            setRecentLogs(entries);
        }, () => { /* non-critical */ });
        return unsub;
    }, []);

    const stats = useMemo(() => {
        const totalTenants = tenants.length;
        const suspendedTenants = tenants.filter(t => t.status === 'suspended').length;
        const errors24h = recentLogs.length;

        // Count tenants with WA errors in last 24h
        const waErrorTenants = new Set(
            recentLogs.filter(l => l.event.startsWith('wa.')).map(l => l.siteId)
        ).size;

        return { totalTenants, suspendedTenants, errors24h, waErrorTenants };
    }, [tenants, recentLogs]);

    // Tenant health: suspended OR has error in 24h
    const tenantHealth = useMemo(() => {
        const errorBySite = new Map<string, { event: string; ts: Date }>();
        recentLogs.forEach(l => {
            const existing = errorBySite.get(l.siteId);
            if (!existing || l.ts > existing.ts) {
                errorBySite.set(l.siteId, { event: l.event, ts: l.ts });
            }
        });
        return tenants
            .map(t => ({
                ...t,
                lastError: errorBySite.get(t.id),
            }))
            .filter(t => t.status === 'suspended' || t.lastError)
            .slice(0, 5);
    }, [tenants, recentLogs]);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-brand-dark">Overview</h1>
                    <p className="text-sm text-gray-400 font-medium mt-0.5">Platform health snapshot</p>
                </div>
                <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-gray-200">
                    <div className={`w-2 h-2 rounded-full ${stats.errors24h === 0 ? 'bg-green-500 animate-pulse' : 'bg-amber-500'}`}></div>
                    <span className="text-xs font-bold text-gray-600">
                        {stats.errors24h === 0 ? 'ALL HEALTHY' : `${stats.errors24h} ERRORS (24H)`}
                    </span>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-4 gap-4">
                <Link href="/tenants" className="bg-white rounded-2xl border border-gray-200 p-5 hover:border-brand-dark transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                        <Store className="w-4 h-4 text-gray-400" />
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Tenants</p>
                    </div>
                    <p className="text-3xl font-black text-brand-dark">{loading ? '—' : stats.totalTenants}</p>
                    {stats.suspendedTenants > 0 && (
                        <p className="text-xs text-red-600 font-semibold mt-1">{stats.suspendedTenants} suspended</p>
                    )}
                </Link>

                <Link href="/access" className="bg-white rounded-2xl border border-gray-200 p-5 hover:border-brand-dark transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                        <UsersIcon className="w-4 h-4 text-gray-400" />
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Users</p>
                    </div>
                    <p className="text-3xl font-black text-brand-dark">{loading ? '—' : usersCount}</p>
                </Link>

                <Link href="/monitoring" className="bg-white rounded-2xl border border-gray-200 p-5 hover:border-red-300 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="w-4 h-4 text-gray-400" />
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Errors (24h)</p>
                    </div>
                    <p className={`text-3xl font-black ${stats.errors24h > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {stats.errors24h}
                    </p>
                </Link>

                <Link href="/whatsapp" className="bg-white rounded-2xl border border-gray-200 p-5 hover:border-amber-300 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                        <MessageSquare className="w-4 h-4 text-gray-400" />
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">WA Issues</p>
                    </div>
                    <p className={`text-3xl font-black ${stats.waErrorTenants > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                        {stats.waErrorTenants}
                    </p>
                </Link>
            </div>

            {/* Two-column: Recent Errors + Tenant Health */}
            <div className="grid grid-cols-2 gap-6">
                {/* Recent Errors */}
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-slate-50">
                        <div className="flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-red-500" />
                            <h2 className="text-xs font-black text-brand-dark uppercase tracking-wider">Recent Errors</h2>
                        </div>
                        <Link href="/monitoring" className="text-xs font-bold text-gray-400 hover:text-brand-dark transition-colors flex items-center gap-1">
                            View all <ChevronRight className="w-3 h-3" />
                        </Link>
                    </div>
                    <div className="divide-y divide-gray-100 max-h-[280px] overflow-y-auto">
                        {recentLogs.length === 0 ? (
                            <div className="text-center py-10 text-gray-400">
                                <Activity className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                <p className="text-xs font-medium">No errors in the last 24h</p>
                            </div>
                        ) : (
                            recentLogs.slice(0, 5).map(log => (
                                <Link
                                    key={log.id}
                                    href={`/monitoring?event=${encodeURIComponent(log.event)}`}
                                    className="flex items-center justify-between px-5 py-3 hover:bg-slate-50/50 transition-colors"
                                >
                                    <div className="min-w-0 flex-1">
                                        <p className="font-mono text-xs text-red-600 font-semibold truncate">{log.event}</p>
                                        <p className="text-xs text-gray-400 mt-0.5">{log.siteId}</p>
                                    </div>
                                    <span className="text-xs text-gray-400 font-medium ml-3 whitespace-nowrap">{timeAgo(log.ts)}</span>
                                </Link>
                            ))
                        )}
                    </div>
                </div>

                {/* Tenant Health */}
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-slate-50">
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                            <h2 className="text-xs font-black text-brand-dark uppercase tracking-wider">Tenants Needing Attention</h2>
                        </div>
                        <Link href="/tenants" className="text-xs font-bold text-gray-400 hover:text-brand-dark transition-colors flex items-center gap-1">
                            All tenants <ChevronRight className="w-3 h-3" />
                        </Link>
                    </div>
                    <div className="divide-y divide-gray-100 max-h-[280px] overflow-y-auto">
                        {tenantHealth.length === 0 ? (
                            <div className="text-center py-10 text-gray-400">
                                <Store className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                <p className="text-xs font-medium">All tenants are healthy</p>
                            </div>
                        ) : (
                            tenantHealth.map(t => (
                                <Link
                                    key={t.id}
                                    href={`/tenants/${t.id}`}
                                    className="flex items-center justify-between px-5 py-3 hover:bg-slate-50/50 transition-colors"
                                >
                                    <div className="min-w-0 flex-1">
                                        <p className="font-bold text-sm text-brand-dark truncate">{t.name}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            {t.status === 'suspended' && (
                                                <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600">
                                                    <PowerOff className="w-3 h-3" /> Suspended
                                                </span>
                                            )}
                                            {t.lastError && (
                                                <span className="font-mono text-xs text-red-500 truncate">
                                                    {t.lastError.event} · {timeAgo(t.lastError.ts)}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-gray-300 ml-3" />
                                </Link>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
