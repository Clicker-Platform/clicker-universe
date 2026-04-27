'use client';

import { useState, useEffect, useMemo } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { toast } from 'sonner';
import Link from 'next/link';
import { Search, Loader2, ShieldCheck, ChevronRight, AlertTriangle, UserPlus, UserMinus, X, Save } from 'lucide-react';

interface AuthUser {
    uid: string;
    email?: string;
    displayName?: string;
    disabled?: boolean;
    customClaims?: { role?: string; siteId?: string };
}

interface Tenant { id: string; name: string; }

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

    // Assign-to-tenant modal
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [assignTarget, setAssignTarget] = useState<AuthUser | null>(null);
    const [assignTenant, setAssignTenant] = useState('');
    const [assignRole, setAssignRole] = useState('staff');
    const [assignSaving, setAssignSaving] = useState(false);

    // Revoke
    const [revokeTarget, setRevokeTarget] = useState<AuthUser | null>(null);
    const [revoking, setRevoking] = useState(false);

    const fetchUsers = async () => {
        setLoading(true);
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

    useEffect(() => {
        fetchUsers();
        const fetchTenants = async () => {
            try {
                const fn = httpsCallable(functions, 'getTenants');
                const res: any = await fn();
                setTenants(res.data.list ?? []);
            } catch { /* non-critical */ }
        };
        fetchTenants();
    }, []);

    const openAssign = (user: AuthUser) => {
        setAssignTarget(user);
        setAssignTenant(tenants[0]?.id || '');
        setAssignRole('staff');
    };

    const handleAssign = async () => {
        if (!assignTarget || !assignTenant) return;
        setAssignSaving(true);
        try {
            // Create Firestore member doc (actual access)
            const createFn = httpsCallable(functions, 'createUser');
            await createFn({
                email: assignTarget.email,
                displayName: assignTarget.displayName,
                role: assignRole,
                siteId: assignTenant,
            });
            // Set siteId claim so UsersTab can track assignment state
            const claimsFn = httpsCallable(functions, 'setCustomClaims');
            await claimsFn({ uid: assignTarget.uid, claims: { siteId: assignTenant } });
            toast.success('Member added', { description: `${assignTarget.email} → ${assignTenant}` });
            setAssignTarget(null);
            await fetchUsers();
        } catch (err: any) {
            toast.error('Assign failed', { description: err.message });
        } finally {
            setAssignSaving(false);
        }
    };

    const handleRevoke = async (user: AuthUser) => {
        if (!user.customClaims?.siteId) return;
        setRevokeTarget(user);
        setRevoking(true);
        try {
            const removeFn = httpsCallable(functions, 'removeUserFromSite');
            await removeFn({ uid: user.uid, siteId: user.customClaims.siteId });
            const claimsFn = httpsCallable(functions, 'setCustomClaims');
            await claimsFn({ uid: user.uid, claims: {} });
            toast.success('Member removed', { description: `${user.email} removed from ${user.customClaims.siteId}` });
            await fetchUsers();
        } catch (err: any) {
            toast.error('Revoke failed', { description: err.message });
        } finally {
            setRevoking(false);
            setRevokeTarget(null);
        }
    };

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
                                            <div className="flex items-center justify-end gap-2">
                                                <Link
                                                    href={`/tenants/${u.customClaims.siteId}`}
                                                    className="flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-brand-dark transition-colors"
                                                >
                                                    Manage <ChevronRight className="w-3 h-3" />
                                                </Link>
                                                <button
                                                    onClick={() => handleRevoke(u)}
                                                    disabled={revoking && revokeTarget?.uid === u.uid}
                                                    className="flex items-center gap-1 px-2.5 py-1.5 border border-gray-200 hover:border-red-300 hover:text-red-500 rounded-lg text-xs font-bold text-gray-400 transition-colors disabled:opacity-50"
                                                >
                                                    {revoking && revokeTarget?.uid === u.uid
                                                        ? <Loader2 className="w-3 h-3 animate-spin" />
                                                        : <UserMinus className="w-3 h-3" />}
                                                    Revoke
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => openAssign(u)}
                                                className="flex items-center justify-end gap-1 px-3 py-1.5 bg-brand-dark text-white text-xs font-black rounded-lg hover:opacity-90 transition-opacity ml-auto"
                                            >
                                                <UserPlus className="w-3 h-3" /> Assign to tenant
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <div className="mt-6 p-4 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700 max-w-2xl">
                <strong>Audit view.</strong> Use "Assign to tenant" to onboard users without a tenant. For existing members, click "Manage in tenant" to edit role and per-module permissions.
            </div>

            {/* Assign to tenant modal */}
            {assignTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-xl w-full max-w-md p-6">
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <h3 className="font-black text-brand-dark text-lg">Assign to Tenant</h3>
                                <p className="text-sm text-gray-400 font-mono">{assignTarget.email}</p>
                            </div>
                            <button onClick={() => setAssignTarget(null)} className="p-1 text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Tenant</label>
                                <select value={assignTenant} onChange={e => setAssignTenant(e.target.value)}
                                    className="w-full mt-1 px-3 py-2 border-2 border-gray-200 rounded-xl text-sm font-medium outline-none focus:border-brand-dark bg-white">
                                    <option value="">— Select tenant —</option>
                                    {tenants.map(t => <option key={t.id} value={t.id}>{t.name} ({t.id})</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Role</label>
                                <select value={assignRole} onChange={e => setAssignRole(e.target.value)}
                                    className="w-full mt-1 px-3 py-2 border-2 border-gray-200 rounded-xl text-sm font-medium outline-none focus:border-brand-dark bg-white">
                                    <option value="owner">Owner</option>
                                    <option value="staff">Staff</option>
                                </select>
                            </div>
                            <p className="text-xs text-gray-400 pt-2">
                                Member akan ditambahkan ke tenant. Set module access di tenant detail page.
                            </p>
                        </div>
                        <div className="flex gap-2 justify-end mt-6">
                            <button onClick={() => setAssignTarget(null)}
                                className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-bold text-gray-600">Cancel</button>
                            <button onClick={handleAssign} disabled={assignSaving || !assignTenant}
                                className="flex items-center gap-2 px-5 py-2 bg-brand-dark text-white text-sm font-black rounded-xl hover:opacity-90 disabled:opacity-50">
                                {assignSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                Assign
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
