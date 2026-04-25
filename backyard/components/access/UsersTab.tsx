'use client';

import { useState, useEffect, useMemo } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { toast } from 'sonner';
import { Search, Loader2, ShieldAlert, ShieldCheck, X, Pencil } from 'lucide-react';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';

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
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    // Edit modal
    const [editUser, setEditUser] = useState<AuthUser | null>(null);
    const [editRole, setEditRole] = useState('staff');
    const [editSiteId, setEditSiteId] = useState('');
    const [saving, setSaving] = useState(false);

    // Revoke
    const [revokeUser, setRevokeUser] = useState<AuthUser | null>(null);
    const [revokeOpen, setRevokeOpen] = useState(false);

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

        const fetchTenants = async () => {
            try {
                const fn = httpsCallable(functions, 'getTenants');
                const res: any = await fn();
                setTenants(res.data.list ?? []);
            } catch { /* non-critical */ }
        };

        fetchUsers();
        fetchTenants();
    }, []);

    const filtered = useMemo(() =>
        users.filter(u =>
            (u.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (u.displayName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (u.customClaims?.siteId || '').toLowerCase().includes(searchQuery.toLowerCase())
        ),
        [users, searchQuery]
    );

    const openEdit = (user: AuthUser) => {
        setEditUser(user);
        setEditRole(user.customClaims?.role || 'staff');
        setEditSiteId(user.customClaims?.siteId || '');
    };

    const handleSave = async () => {
        if (!editUser) return;
        setSaving(true);
        try {
            const fn = httpsCallable(functions, 'setCustomClaims');
            await fn({
                uid: editUser.uid,
                claims: { role: editRole, siteId: editSiteId || null },
            });
            toast.success('Claims updated');
            setUsers(prev => prev.map(u =>
                u.uid === editUser.uid
                    ? { ...u, customClaims: { role: editRole, siteId: editSiteId || undefined } }
                    : u
            ));
            setEditUser(null);
        } catch (err: any) {
            toast.error('Update failed', { description: err.message });
        } finally {
            setSaving(false);
        }
    };

    const handleRevoke = async () => {
        if (!revokeUser) return;
        try {
            const fn = httpsCallable(functions, 'setCustomClaims');
            await fn({ uid: revokeUser.uid, claims: { role: null, siteId: null } });
            toast.success('Access revoked');
            setUsers(prev => prev.map(u =>
                u.uid === revokeUser.uid ? { ...u, customClaims: {} } : u
            ));
        } catch (err: any) {
            toast.error('Revoke failed', { description: err.message });
        } finally {
            setRevokeOpen(false);
            setRevokeUser(null);
        }
    };

    return (
        <>
            {/* Search */}
            <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm font-medium outline-none focus:border-brand-dark bg-white"
                    placeholder="Filter by email, name, or tenant..."
                />
            </div>

            {/* User list */}
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
                                    <td className="px-5 py-3 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button onClick={() => openEdit(u)}
                                                className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 hover:border-brand-dark rounded-lg text-xs font-bold text-gray-600 transition-colors">
                                                <Pencil className="w-3 h-3" /> Edit
                                            </button>
                                            {u.customClaims?.role && (
                                                <button onClick={() => { setRevokeUser(u); setRevokeOpen(true); }}
                                                    className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:border-red-300 hover:text-red-500 transition-colors"
                                                    title="Revoke access">
                                                    <ShieldAlert className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Edit modal */}
            {editUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-xl w-full max-w-md p-6">
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <h3 className="font-black text-brand-dark text-lg">Edit Claims</h3>
                                <p className="text-sm text-gray-400 font-mono">{editUser.email}</p>
                                <p className="text-xs text-gray-300 font-mono">UID: {editUser.uid}</p>
                            </div>
                            <button onClick={() => setEditUser(null)} className="p-1 text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Role</label>
                                <select value={editRole} onChange={e => setEditRole(e.target.value)}
                                    className="w-full mt-1 px-3 py-2 border-2 border-gray-200 rounded-xl text-sm font-medium outline-none focus:border-brand-dark bg-white">
                                    <option value="owner">Owner</option>
                                    <option value="manager">Manager</option>
                                    <option value="staff">Staff</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Tenant (Site ID)</label>
                                <select value={editSiteId} onChange={e => setEditSiteId(e.target.value)}
                                    className="w-full mt-1 px-3 py-2 border-2 border-gray-200 rounded-xl text-sm font-medium outline-none focus:border-brand-dark bg-white">
                                    <option value="">— No tenant —</option>
                                    {tenants.map(t => <option key={t.id} value={t.id}>{t.name} ({t.id})</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="flex gap-2 justify-end mt-6">
                            <button onClick={() => setEditUser(null)}
                                className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-bold text-gray-600">Cancel</button>
                            <button onClick={handleSave} disabled={saving}
                                className="flex items-center gap-2 px-5 py-2 bg-brand-dark text-white text-sm font-black rounded-xl hover:opacity-90 disabled:opacity-50">
                                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                                Save Claims
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmationDialog
                isOpen={revokeOpen}
                onCancel={() => { setRevokeOpen(false); setRevokeUser(null); }}
                onConfirm={handleRevoke}
                title={`Revoke access for ${revokeUser?.email}?`}
                description="This will clear the user's role and tenant assignment. They will lose access to admin pages."
                variant="danger"
            />
        </>
    );
}
