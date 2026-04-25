'use client';

import { useState, useEffect, useMemo } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { toast } from 'sonner';
import Link from 'next/link';
import { Search, Loader2, ShieldCheck, ChevronRight, AlertTriangle } from 'lucide-react';

interface AuthUser {
    uid: string;
    email?: string;
    displayName?: string;
    disabled?: boolean;
    customClaims?: { role?: string; siteId?: string };
}

const roleColor = (r?: string) => {
    if (r === 'superadmin') return 'bg-red-50 text-red-700 border-red-100';
    if (r === 'owner') return 'bg-brand-dark text-white border-brand-dark';
    if (r === 'manager') return 'bg-amber-50 text-amber-700 border-amber-100';
    if (r) return 'bg-gray-100 text-gray-600 border-gray-200';
    return 'bg-gray-50 text-gray-400 border-gray-200';
};

export default function UsersTab() {
    const [users, setUsers] = useState<AuthUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'no-role' | 'no-tenant'>('all');

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const fn = httpsCallable(functions, 'listUsers');
                const res: any = await fn();
                setUsers((res.data?.users || []).filter((u: any) => u.email));
            } catch (err: any) {
                toast.error('Failed to load users', { description: err.message });
            } finally {
                setLoading(false);
            }
        };
        fetchUsers();
    }, []);

    const stats = useMemo(() => {
        const total = users.length;
        const active = users.filter(u => !u.disabled).length;
        const assigned = users.filter(u => u.customClaims?.siteId).length;
        const noRole = users.filter(u => !u.customClaims?.role).length;
        return { total, active, assigned, noRole };
    }, [users]);

    const filtered = useMemo(() => {
        let list = users;

        if (filterStatus === 'no-role') list = list.filter(u => !u.customClaims?.role);
        else if (filterStatus === 'no-tenant') list = list.filter(u => !u.customClaims?.siteId);

        return list.filter(u =>
            (u.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (u.displayName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (u.customClaims?.siteId || '').toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [users, searchQuery, filterStatus]);

    return (
        <>
            {/* Stats */}
            <div className="grid grid-cols-4 gap-4 mb-6">
                <button
                    onClick={() => setFilterStatus('all')}
                    className={`text-left bg-white rounded-2xl border p-5 transition-colors ${filterStatus === 'all' ? 'border-brand-dark' : 'border-gray-200 hover:border-gray-300'}`}
                >
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Users</p>
                    <p className="text-2xl font-black text-brand-dark mt-1">{loading ? '—' : stats.total}</p>
                </button>
                <div className="bg-white rounded-2xl border border-gray-200 p-5">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Active</p>
                    <p className="text-2xl font-black text-green-600 mt-1">{loading ? '—' : stats.active}</p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-200 p-5">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Assigned to Tenant</p>
                    <p className="text-2xl font-black text-brand-dark mt-1">{loading ? '—' : stats.assigned}</p>
                </div>
                <button
                    onClick={() => setFilterStatus('no-role')}
                    className={`text-left bg-white rounded-2xl border p-5 transition-colors ${filterStatus === 'no-role' ? 'border-amber-500' : 'border-gray-200 hover:border-amber-300'}`}
                >
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                        No Role {stats.noRole > 0 && <AlertTriangle className="w-3 h-3 text-amber-500" />}
                    </p>
                    <p className="text-2xl font-black text-amber-600 mt-1">{loading ? '—' : stats.noRole}</p>
                </button>
            </div>

            {/* Search + Filter info */}
            <div className="flex items-center gap-3 mb-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm font-medium outline-none focus:border-brand-dark bg-white"
                        placeholder="Filter by email, name, or tenant..."
                    />
                </div>
                {filterStatus !== 'all' && (
                    <button
                        onClick={() => setFilterStatus('all')}
                        className="px-3 py-2 border border-gray-200 rounded-xl text-xs font-bold text-gray-500 hover:border-brand-dark transition-colors"
                    >
                        Clear filter ({filterStatus === 'no-role' ? 'no role' : 'no tenant'})
                    </button>
                )}
            </div>

            {/* Audit table */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-16 text-gray-400 gap-2">
                        <Loader2 className="w-5 h-5 animate-spin" /> Loading users...
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-16 text-gray-400 font-medium">No users match filter.</div>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="border-b border-gray-100 bg-slate-50">
                            <tr>
                                <th className="text-left px-5 py-3 text-xs font-black text-brand-dark uppercase tracking-wider">User</th>
                                <th className="text-left px-5 py-3 text-xs font-black text-brand-dark uppercase tracking-wider">Tenant</th>
                                <th className="text-left px-5 py-3 text-xs font-black text-brand-dark uppercase tracking-wider">Role</th>
                                <th className="text-left px-5 py-3 text-xs font-black text-brand-dark uppercase tracking-wider">Status</th>
                                <th className="px-5 py-3" />
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(u => (
                                <tr key={u.uid} className="border-b border-gray-50 hover:bg-slate-50/50">
                                    <td className="px-5 py-3">
                                        <div className="font-black text-brand-dark text-sm">{u.displayName || 'No Name'}</div>
                                        <div className="text-xs text-gray-400 font-mono">{u.email}</div>
                                    </td>
                                    <td className="px-5 py-3 text-xs">
                                        {u.customClaims?.siteId ? (
                                            <span className="font-mono text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{u.customClaims.siteId}</span>
                                        ) : (
                                            <span className="text-gray-300">—</span>
                                        )}
                                    </td>
                                    <td className="px-5 py-3">
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border inline-flex items-center gap-1 ${roleColor(u.customClaims?.role)}`}>
                                            <ShieldCheck className="w-3 h-3" />
                                            {u.customClaims?.role || 'no role'}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3">
                                        {u.disabled ? (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-500 border border-gray-200">
                                                <span className="w-1.5 h-1.5 rounded-full bg-gray-400" /> Disabled
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-100">
                                                <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Active
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-5 py-3 text-right">
                                        {u.customClaims?.siteId ? (
                                            <Link
                                                href={`/tenants/${u.customClaims.siteId}`}
                                                className="flex items-center justify-end gap-1 text-xs font-bold text-gray-500 hover:text-brand-dark transition-colors"
                                            >
                                                Manage in tenant <ChevronRight className="w-3 h-3" />
                                            </Link>
                                        ) : (
                                            <span className="text-xs text-gray-300">—</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <div className="mt-6 p-4 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700 max-w-2xl">
                <strong>Read-only audit view.</strong> To add, edit, or remove user access, open the relevant tenant via "Manage in tenant".
            </div>
        </>
    );
}
