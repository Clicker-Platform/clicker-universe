'use client';

import { useState, useEffect, useMemo } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { toast } from 'sonner';
import { Search, Loader2, Users, ShieldAlert } from 'lucide-react';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import PageShell from '@/components/PageShell';

interface AuthUser {
    uid: string;
    email?: string;
    displayName?: string;
    customClaims?: { role?: string; siteId?: string };
}

interface Tenant {
    id: string;
    name: string;
}


export default function UsersPage() {
    const [users, setUsers] = useState<AuthUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    // Create form
    const [showCreate, setShowCreate] = useState(false);
    const [newEmail, setNewEmail] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [newName, setNewName] = useState('');
    const [newSiteId, setNewSiteId] = useState('');
    const [newRole, setNewRole] = useState('owner');
    const [createLoading, setCreateLoading] = useState(false);

    // Edit role
    const [editUser, setEditUser] = useState<AuthUser | null>(null);
    const [editSiteId, setEditSiteId] = useState('');
    const [editRole, setEditRole] = useState('staff');
    const [editLoading, setEditLoading] = useState(false);

    // Revoke
    const [revokeUser, setRevokeUser] = useState<AuthUser | null>(null);
    const [revokeOpen, setRevokeOpen] = useState(false);

    // Tenants (for create form only)
    const [tenants, setTenants] = useState<Tenant[]>([]);

    const filteredUsers = useMemo(() =>
        users.filter(u =>
            (u.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (u.displayName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (u.uid || '').toLowerCase().includes(searchQuery.toLowerCase())
        ), [users, searchQuery]);

    useEffect(() => { fetchUsers(); fetchTenants(); }, []);

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

    const fetchTenants = async () => {
        try {
            const fn = httpsCallable(functions, 'getTenants');
            const res: any = await fn();
            const list = res.data.list ?? [];
            setTenants(list);
        } catch { /* non-critical */ }
    };


    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreateLoading(true);
        try {
            const fn = httpsCallable(functions, 'createUser');
            await fn({
                email: newEmail,
                password: newPassword,
                displayName: newName,
                role: newSiteId ? newRole : undefined,
                siteId: newSiteId || undefined,
            });
            toast.success('User created');
            setNewEmail(''); setNewPassword(''); setNewName(''); setNewSiteId(''); setNewRole('owner');
            setShowCreate(false);
            await fetchUsers();
        } catch (err: any) {
            toast.error('Create failed', { description: err.message });
        } finally {
            setCreateLoading(false);
        }
    };

    const openEdit = (user: AuthUser) => {
        setEditUser(user);
        setEditSiteId(user.customClaims?.siteId || '');
        setEditRole(user.customClaims?.role || 'staff');
    };

    const handleSaveRole = async () => {
        if (!editUser) return;
        setEditLoading(true);
        try {
            const fn = httpsCallable(functions, 'setCustomClaims');
            await fn({
                uid: editUser.uid,
                claims: { role: editRole, siteId: editSiteId },
            });
            toast.success('Role updated');
            setEditUser(null);
            await fetchUsers();
        } catch (err: any) {
            toast.error('Update failed', { description: err.message });
        } finally {
            setEditLoading(false);
        }
    };

    const handleRevoke = async () => {
        if (!revokeUser) return;
        try {
            const fn = httpsCallable(functions, 'setCustomClaims');
            await fn({ uid: revokeUser.uid, claims: { role: null, siteId: null } });
            toast.success('Access revoked');
            setRevokeOpen(false);
            setRevokeUser(null);
            await fetchUsers();
        } catch (err: any) {
            toast.error('Revoke failed', { description: err.message });
        }
    };

    const roleColor = (role?: string) => {
        if (role === 'superadmin') return 'bg-red-50 text-red-700 border-red-100';
        if (role === 'owner') return 'bg-brand-dark text-white border-brand-dark';
        if (role === 'manager') return 'bg-amber-50 text-amber-700 border-amber-100';
        return 'bg-gray-100 text-gray-600 border-gray-200';
    };

    return (
        <PageShell
            title="Users"
            subtitle={`${users.length} users`}
            action={
                <button
                    onClick={() => setShowCreate(!showCreate)}
                    className="px-4 py-2 bg-brand-dark text-white text-sm font-black rounded-xl hover:opacity-90 transition-opacity"
                >
                    {showCreate ? 'Cancel' : '+ New User'}
                </button>
            }
        >
            {/* CREATE FORM */}
            {showCreate && (
                <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
                    <h2 className="text-sm font-black text-brand-dark uppercase tracking-wider mb-4">New User</h2>
                    <form onSubmit={handleCreate} className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Display Name</label>
                            <input required value={newName} onChange={e => setNewName(e.target.value)}
                                className="w-full mt-1 px-3 py-2 border-2 border-gray-200 rounded-xl text-sm font-medium outline-none focus:border-brand-dark"
                                placeholder="John Doe" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Email</label>
                            <input required type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)}
                                className="w-full mt-1 px-3 py-2 border-2 border-gray-200 rounded-xl text-sm font-medium outline-none focus:border-brand-dark"
                                placeholder="user@example.com" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Password</label>
                            <input required type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                                className="w-full mt-1 px-3 py-2 border-2 border-gray-200 rounded-xl text-sm font-medium outline-none focus:border-brand-dark"
                                placeholder="••••••••" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Assign to Tenant (optional)</label>
                            <select value={newSiteId} onChange={e => setNewSiteId(e.target.value)}
                                className="w-full mt-1 px-3 py-2 border-2 border-gray-200 rounded-xl text-sm font-medium outline-none focus:border-brand-dark bg-white">
                                <option value="">— No tenant —</option>
                                {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                        </div>
                        {newSiteId && (
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Role</label>
                                <select value={newRole} onChange={e => setNewRole(e.target.value)}
                                    className="w-full mt-1 px-3 py-2 border-2 border-gray-200 rounded-xl text-sm font-medium outline-none focus:border-brand-dark bg-white">
                                    <option value="owner">Owner</option>
                                    <option value="manager">Manager</option>
                                    <option value="staff">Staff</option>
                                </select>
                            </div>
                        )}
                        <div className="col-span-2 flex justify-end">
                            <button type="submit" disabled={createLoading}
                                className="flex items-center gap-2 px-6 py-2.5 bg-brand-dark text-white text-sm font-black rounded-xl hover:opacity-90 disabled:opacity-50">
                                {createLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                                {createLoading ? 'Creating...' : 'Create User'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* SEARCH */}
            <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm font-medium outline-none focus:border-brand-dark bg-white"
                    placeholder="Search by email, name, or UID..." />
            </div>

            {/* USER LIST */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-10">
                {loading ? (
                    <div className="flex items-center justify-center py-16 text-gray-400 gap-2">
                        <Loader2 className="w-5 h-5 animate-spin" /> Loading...
                    </div>
                ) : filteredUsers.length === 0 ? (
                    <div className="text-center py-16 text-gray-400">
                        <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                        <p className="font-semibold">No users found</p>
                    </div>
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
                            {filteredUsers.map(u => (
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
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${roleColor(u.customClaims?.role)}`}>
                                            {u.customClaims?.role || 'no role'}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button onClick={() => openEdit(u)}
                                                className="px-3 py-1.5 border border-gray-200 hover:border-brand-dark rounded-lg text-xs font-bold text-gray-600 transition-colors">
                                                Edit Role
                                            </button>
                                            {u.customClaims?.role && (
                                                <button onClick={() => { setRevokeUser(u); setRevokeOpen(true); }}
                                                    className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:border-red-300 hover:text-red-600 transition-colors"
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

            {/* EDIT ROLE MODAL */}
            {editUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-xl w-full max-w-md p-6">
                        <h3 className="font-black text-brand-dark text-lg mb-1">Edit Role</h3>
                        <p className="text-sm text-gray-500 mb-4">{editUser.email}</p>
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Tenant (Site ID)</label>
                                <select value={editSiteId} onChange={e => setEditSiteId(e.target.value)}
                                    className="w-full mt-1 px-3 py-2 border-2 border-gray-200 rounded-xl text-sm font-medium outline-none focus:border-brand-dark bg-white">
                                    <option value="">— No tenant —</option>
                                    {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Role</label>
                                <select value={editRole} onChange={e => setEditRole(e.target.value)}
                                    className="w-full mt-1 px-3 py-2 border-2 border-gray-200 rounded-xl text-sm font-medium outline-none focus:border-brand-dark bg-white">
                                    <option value="owner">Owner</option>
                                    <option value="manager">Manager</option>
                                    <option value="staff">Staff</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex gap-2 mt-6 justify-end">
                            <button onClick={() => setEditUser(null)}
                                className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-bold text-gray-600">Cancel</button>
                            <button onClick={handleSaveRole} disabled={editLoading}
                                className="flex items-center gap-2 px-6 py-2 bg-brand-dark text-white text-sm font-black rounded-xl hover:opacity-90 disabled:opacity-50">
                                {editLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* DIALOGS */}
            <ConfirmationDialog
                isOpen={revokeOpen}
                onCancel={() => { setRevokeOpen(false); setRevokeUser(null); }}
                onConfirm={handleRevoke}
                title={`Revoke access for ${revokeUser?.email}?`}
                description="This will remove the user's role and tenant assignment. They will lose access to admin pages."
                variant="warning"
            />
        </PageShell>
    );
}
