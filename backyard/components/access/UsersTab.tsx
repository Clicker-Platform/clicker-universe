'use client';

import { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { toast } from 'sonner';
import { Search, Loader2, ShieldAlert, ShieldCheck, Mail } from 'lucide-react';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';

interface UserResult {
    uid: string;
    email?: string;
    displayName?: string;
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
    const [email, setEmail] = useState('');
    const [searching, setSearching] = useState(false);
    const [user, setUser] = useState<UserResult | null>(null);

    const [editing, setEditing] = useState(false);
    const [editRole, setEditRole] = useState('staff');
    const [editSiteId, setEditSiteId] = useState('');
    const [saving, setSaving] = useState(false);

    const [tenants, setTenants] = useState<Tenant[]>([]);

    const [revokeOpen, setRevokeOpen] = useState(false);

    useEffect(() => {
        const fetch = async () => {
            try {
                const fn = httpsCallable(functions, 'getTenants');
                const res: any = await fn();
                setTenants(res.data.list ?? []);
            } catch { /* non-critical */ }
        };
        fetch();
    }, []);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim()) return;
        setSearching(true);
        setUser(null);
        try {
            const fn = httpsCallable(functions, 'getUserByEmail');
            const res: any = await fn({ email: email.trim() });
            if (res.data?.user) {
                setUser(res.data.user);
            } else {
                toast.error('User not found');
            }
        } catch (err: any) {
            toast.error('Search failed', { description: err.message });
        } finally {
            setSearching(false);
        }
    };

    const startEdit = () => {
        if (!user) return;
        setEditRole(user.customClaims?.role || 'staff');
        setEditSiteId(user.customClaims?.siteId || '');
        setEditing(true);
    };

    const handleSave = async () => {
        if (!user) return;
        setSaving(true);
        try {
            const fn = httpsCallable(functions, 'setCustomClaims');
            await fn({
                uid: user.uid,
                claims: { role: editRole, siteId: editSiteId || null },
            });
            toast.success('Claims updated');
            setUser({ ...user, customClaims: { role: editRole, siteId: editSiteId || undefined } });
            setEditing(false);
        } catch (err: any) {
            toast.error('Update failed', { description: err.message });
        } finally {
            setSaving(false);
        }
    };

    const handleRevoke = async () => {
        if (!user) return;
        try {
            const fn = httpsCallable(functions, 'setCustomClaims');
            await fn({ uid: user.uid, claims: { role: null, siteId: null } });
            toast.success('Access revoked');
            setUser({ ...user, customClaims: {} });
        } catch (err: any) {
            toast.error('Revoke failed', { description: err.message });
        } finally {
            setRevokeOpen(false);
        }
    };

    return (
        <>
            <form onSubmit={handleSearch} className="bg-white rounded-2xl border border-gray-200 p-6 mb-6 max-w-2xl">
                <h2 className="text-xs font-black text-brand-dark uppercase tracking-wider mb-3">Find User by Email</h2>
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            className="w-full pl-9 pr-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm font-medium outline-none focus:border-brand-dark"
                            placeholder="user@example.com"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={searching}
                        className="flex items-center gap-2 px-5 py-2.5 bg-brand-dark text-white text-sm font-black rounded-xl hover:opacity-90 disabled:opacity-50"
                    >
                        {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                        Lookup
                    </button>
                </div>
            </form>

            {user && (
                <div className="bg-white rounded-2xl border border-gray-200 p-6 max-w-2xl">
                    <div className="flex items-start justify-between mb-5">
                        <div>
                            <h3 className="font-black text-brand-dark text-lg">{user.displayName || 'No Name'}</h3>
                            <p className="text-sm text-gray-400 font-mono">{user.email}</p>
                            <p className="text-xs text-gray-300 font-mono mt-1">UID: {user.uid}</p>
                        </div>
                        {!editing && (
                            <div className="flex gap-2">
                                <button onClick={startEdit}
                                    className="px-3 py-1.5 border border-gray-200 hover:border-brand-dark rounded-lg text-xs font-bold text-gray-600 transition-colors">
                                    Edit Claims
                                </button>
                                {user.customClaims?.role && (
                                    <button onClick={() => setRevokeOpen(true)}
                                        className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 hover:border-red-300 hover:text-red-600 rounded-lg text-xs font-bold text-gray-600 transition-colors">
                                        <ShieldAlert className="w-3.5 h-3.5" /> Revoke
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="space-y-3">
                        <div>
                            <p className="text-xs text-gray-400 font-semibold mb-1.5">Role</p>
                            {editing ? (
                                <select value={editRole} onChange={e => setEditRole(e.target.value)}
                                    className="px-3 py-2 border-2 border-gray-200 rounded-xl text-sm font-medium outline-none focus:border-brand-dark bg-white">
                                    <option value="owner">Owner</option>
                                    <option value="manager">Manager</option>
                                    <option value="staff">Staff</option>
                                    <option value="superadmin">Superadmin</option>
                                </select>
                            ) : (
                                <span className={`text-xs font-bold px-2.5 py-1 rounded-full border inline-flex items-center gap-1.5 ${roleColor(user.customClaims?.role)}`}>
                                    <ShieldCheck className="w-3 h-3" />
                                    {user.customClaims?.role || 'no role'}
                                </span>
                            )}
                        </div>
                        <div>
                            <p className="text-xs text-gray-400 font-semibold mb-1.5">Tenant (Site ID)</p>
                            {editing ? (
                                <select value={editSiteId} onChange={e => setEditSiteId(e.target.value)}
                                    className="px-3 py-2 border-2 border-gray-200 rounded-xl text-sm font-medium outline-none focus:border-brand-dark bg-white">
                                    <option value="">— No tenant —</option>
                                    {tenants.map(t => <option key={t.id} value={t.id}>{t.name} ({t.id})</option>)}
                                </select>
                            ) : (
                                user.customClaims?.siteId
                                    ? <span className="font-mono text-sm text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{user.customClaims.siteId}</span>
                                    : <span className="text-sm text-gray-300">—</span>
                            )}
                        </div>
                    </div>

                    {editing && (
                        <div className="flex gap-2 justify-end mt-6">
                            <button onClick={() => setEditing(false)}
                                className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-bold text-gray-600">Cancel</button>
                            <button onClick={handleSave} disabled={saving}
                                className="flex items-center gap-2 px-5 py-2 bg-brand-dark text-white text-sm font-black rounded-xl hover:opacity-90 disabled:opacity-50">
                                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                                Save Claims
                            </button>
                        </div>
                    )}
                </div>
            )}

            <ConfirmationDialog
                isOpen={revokeOpen}
                onCancel={() => setRevokeOpen(false)}
                onConfirm={handleRevoke}
                title={`Revoke access for ${user?.email}?`}
                description="This will clear the user's role and tenant assignment. They will lose access to admin pages."
                variant="danger"
            />
        </>
    );
}
