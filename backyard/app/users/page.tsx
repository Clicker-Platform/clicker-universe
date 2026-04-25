'use client';

import { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { collection, onSnapshot } from 'firebase/firestore';
import { functions, db } from '@/lib/firebase';
import { toast } from 'sonner';
import { Search, ShieldAlert, UserCog, UserX, CheckCircle2, Copy, Users, Loader2 } from 'lucide-react';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import PageShell from '@/components/PageShell';

export default function UsersPage() {
    // Data State
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Search/Filter State
    const [searchQuery, setSearchQuery] = useState('');

    // Selected User State
    const [user, setUser] = useState<any>(null);

    // Action State
    const [roleSiteId, setRoleSiteId] = useState('');
    const [roleType, setRoleType] = useState('staff');
    const [actionLoading, setActionLoading] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);

    // Create User State
    const [createOpen, setCreateOpen] = useState(false);
    const [newEmail, setNewEmail] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [newName, setNewName] = useState('');
    const [newSiteId, setNewSiteId] = useState('');
    const [newRole, setNewRole] = useState('owner'); // Default to owner for easy tenant setup

    // Team Management state
    const [tenants, setTenants] = useState<any[]>([]);
    const [selectedTenantId, setSelectedTenantId] = useState('');
    const [teamMembers, setTeamMembers] = useState<any[]>([]);
    const [teamLoading, setTeamLoading] = useState(false);
    const [removeMemberUid, setRemoveMemberUid] = useState<string | null>(null);
    const [removeMemberConfirm, setRemoveMemberConfirm] = useState(false);

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setActionLoading(true);
        try {
            const createUser = httpsCallable(functions, 'createUser');
            const result: any = await createUser({
                email: newEmail,
                password: newPassword,
                displayName: newName,
                // If Site ID is provided, we bind them immediately
                role: newSiteId ? newRole : undefined,
                siteId: newSiteId ? newSiteId : undefined
            });

            toast.success('User Created', { description: `${newEmail} registered successfully.` });
            setCreateOpen(false);

            // Reset Form
            setNewEmail('');
            setNewPassword('');
            setNewName('');
            setNewSiteId('');

            // Refresh List
            // Note: optimally we'd push the new user to the list, but fetching is safer
            const listUsers = httpsCallable(functions, 'listUsers');
            const refresh = await listUsers();
            setUsers((refresh.data as any).users || []);

            // Select the new user if possible
            if (result.data?.uid) {
                // We might need to find it in the new list, handled by select logic
            }

        } catch (error: any) {
            toast.error('Registration Failed', { description: error.message });
        } finally {
            setActionLoading(false);
        }
    };

    // 1. Fetch Users on Mount
    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const listUsers = httpsCallable(functions, 'listUsers');
                const result = await listUsers();
                setUsers((result.data as any).users || []);
            } catch (error: any) {
                toast.error('Failed to Load Users', { description: error.message });
            } finally {
                setLoading(false);
            }
        };
        fetchUsers();
    }, []);

    // 1b. Fetch Tenants for Team Management
    useEffect(() => {
        const fetchTenants = async () => {
            try {
                const fn = httpsCallable(functions, 'getTenants');
                const res: any = await fn();
                const list = res.data.list ?? [];
                setTenants(list);
                if (list.length > 0) setSelectedTenantId(list[0].id);
            } catch {
                // non-critical
            }
        };
        fetchTenants();
    }, []);

    // 1c. Fetch Team Members when tenant changes
    useEffect(() => {
        if (!selectedTenantId) return;
        setTeamLoading(true);
        const unsub = onSnapshot(
            collection(db, 'sites', selectedTenantId, 'members'),
            snap => {
                setTeamMembers(snap.docs.map(d => ({ uid: d.id, ...d.data() })));
                setTeamLoading(false);
            },
            () => setTeamLoading(false)
        );
        return unsub;
    }, [selectedTenantId]);

    // 2. Filter Users
    const filteredUsers = users
        .filter(u => u.email) // Exclude anonymous users (no email)
        .filter(u =>
            u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            u.uid.toLowerCase().includes(searchQuery.toLowerCase()) ||
            u.displayName?.toLowerCase().includes(searchQuery.toLowerCase())
        );

    // 3. Handle Role Assignment
    const handleAssignRole = async () => {
        if (!user || !roleSiteId) {
            toast.warning('Missing Data', { description: 'Please enter a Site ID to assign access.' });
            return;
        }

        setActionLoading(true);
        try {
            const setCustomClaims = httpsCallable(functions, 'setCustomClaims');
            const claims = {
                role: roleType,
                siteId: roleSiteId
            };

            await setCustomClaims({ uid: user.uid, claims });

            // Update local state to reflect change immediately
            const updatedUser = { ...user, customClaims: { ...user.customClaims, ...claims } };
            setUser(updatedUser);

            // Update list state as well
            setUsers(users.map(u => u.uid === user.uid ? updatedUser : u));

            toast.success('Access Granted', {
                description: `${user.email} is now ${roleType} of ${roleSiteId}`
            });
            setConfirmOpen(false);
        } catch (error: any) {
            toast.error('Assignment Failed', { description: error.message });
        } finally {
            setActionLoading(false);
        }
    };

    // 4. Handle Ban/Revoke (Clear All Claims)
    const handleRevoke = async () => {
        if (!user) return;
        setActionLoading(true);
        try {
            const setCustomClaims = httpsCallable(functions, 'setCustomClaims');
            await setCustomClaims({ uid: user.uid, claims: { role: null, siteId: null } });

            const updatedUser = { ...user, customClaims: {} };
            setUser(updatedUser);
            setUsers(users.map(u => u.uid === user.uid ? updatedUser : u));

            toast.success('Access Revoked', { description: 'All roles removed.' });
        } catch (error: any) {
            toast.error('Revoke Failed', { description: error.message });
        } finally {
            setActionLoading(false);
        }
    };

    // 5. Handle Remove Team Member
    const handleRemoveMember = async (uid: string) => {
        try {
            const fn = httpsCallable(functions, 'removeUserFromSite');
            await fn({ uid, siteId: selectedTenantId });
            toast.success('Member removed');
        } catch (err: any) {
            toast.error('Remove failed', { description: err.message });
        }
    };

    return (
        <>
        <PageShell title="Users" subtitle="Firebase Auth users + Team management">
            <header className="mb-8">
                <h1 className="text-3xl font-black text-brand-dark flex items-center gap-3">
                    <UserCog className="w-8 h-8" />
                    Users
                </h1>
                <p className="text-gray-500 font-medium">Manage users & roles</p>
            </header>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-[calc(100vh-200px)]">

                    {/* 1. LIST PANEL */}
                    <div className="bg-white rounded-3xl border-[3px] border-brand-dark shadow-sticker overflow-hidden flex flex-col">
                        <div className="p-6 border-b-[3px] border-brand-dark bg-gray-50/50 flex flex-col gap-4">
                            <div className="flex justify-between items-center">
                                <h2 className="text-xl font-bold text-brand-dark">Users</h2>
                                <div className="flex items-center gap-2">
                                    <span className="bg-brand-dark text-white px-2 py-1 rounded text-xs font-bold">{users.length} users</span>
                                    <button
                                        onClick={() => setCreateOpen(true)}
                                        className="bg-brand-dark hover:bg-brand-dark/80 text-white p-1.5 rounded-lg transition-colors"
                                        title="Create User"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                    </button>
                                </div>
                            </div>
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 rounded-lg border-2 border-gray-200 focus:border-brand-dark outline-none font-medium text-sm transition-colors"
                                    placeholder="Search by email, name or UID..."
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto p-2 space-y-2">
                            {loading ? (
                                <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-2">
                                    <Loader2 className="w-8 h-8 animate-spin" />
                                    <span className="text-xs font-bold uppercase tracking-wider">Loading users...</span>
                                </div>
                            ) : filteredUsers.length === 0 ? (
                                <div className="p-8 text-center text-gray-400 text-sm">No users found.</div>
                            ) : (
                                filteredUsers.map((u) => (
                                    <button
                                        key={u.uid}
                                        onClick={() => setUser(u)}
                                        className={`w-full text-left p-4 rounded-lg border-2 transition-all flex items-center gap-4 group ${user?.uid === u.uid
                                            ? 'border-brand-dark bg-brand-dark text-white shadow-md'
                                            : 'border-transparent hover:bg-gray-50 hover:border-gray-200'
                                            }`}
                                    >
                                        <div className={`p-3 rounded-full ${user?.uid === u.uid ? 'bg-white/10 text-white' : 'bg-gray-100 text-gray-500'}`}>
                                            <Users className="w-5 h-5" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-bold truncate">{u.displayName || 'No Name'}</div>
                                            <div className={`text-xs truncate font-mono ${user?.uid === u.uid ? 'text-gray-300' : 'text-gray-400'}`}>{u.email}</div>
                                        </div>
                                        {(u.customClaims?.role) && (
                                            <div className={`text-[10px] font-black uppercase px-2 py-1 rounded border ${user?.uid === u.uid
                                                ? 'bg-white text-brand-dark border-transparent'
                                                : 'bg-brand-dark text-white border-brand-dark'
                                                }`}>
                                                {u.customClaims.role}
                                            </div>
                                        )}
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    {/* 2. USER DETAILS PANEL */}
                    <div className="h-full">
                        {!user ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded-3xl bg-gray-50/50">
                                <UserCog className="w-12 h-12 mb-4 opacity-20" />
                                <p className="font-medium">Select a subject to manage access.</p>
                            </div>
                        ) : (
                            <div className="bg-white rounded-3xl border-[3px] border-brand-dark overflow-hidden flex flex-col h-full">
                                <div className="p-6 border-b border-gray-100 bg-gray-50/30 flex justify-between items-start">
                                    <div>
                                        <h2 className="text-2xl font-black text-brand-dark">{user.displayName || 'No Name'}</h2>
                                        <div className="flex items-center gap-2 mt-1">
                                            <code className="bg-gray-200 px-2 py-0.5 rounded text-xs text-gray-600 font-mono">{user.uid}</code>
                                            <button
                                                onClick={() => { navigator.clipboard.writeText(user.uid); toast.success('UID Copied'); }}
                                                className="text-gray-400 hover:text-brand-dark transition-colors"
                                            >
                                                <Copy className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Status</div>
                                        <div className="flex items-center gap-2 text-green-600 font-bold bg-green-50 px-3 py-1 rounded-full border border-green-100">
                                            <CheckCircle2 className="w-4 h-4" />
                                            Registered
                                        </div>
                                    </div>
                                </div>

                                <div className="p-8 flex-1 space-y-8 overflow-auto">
                                    {/* SUPERADMIN LOCK */}
                                    {user.email === 'clickerplatform@gmail.com' && (
                                        <div className="bg-red-50 border-2 border-red-100 rounded-lg p-6 flex flex-col items-center text-center text-red-900">
                                            <ShieldAlert className="w-10 h-10 mb-3 text-red-600" />
                                            <h3 className="font-black text-lg">Protected Account</h3>
                                            <p className="text-sm opacity-80 mt-1 max-w-xs">
                                                Root admin account. Privileges cannot be modified.
                                            </p>
                                        </div>
                                    )}

                                    {/* CURRENT CLAIMS */}
                                    {user.email !== 'clickerplatform@gmail.com' && (
                                        <>
                                            <div>
                                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 border-b pb-2">Current Roles</h3>
                                                {Object.keys(user.customClaims || {}).length === 0 ? (
                                                    <p className="text-gray-400 italic">No roles assigned.</p>
                                                ) : (
                                                    <div className="grid grid-cols-2 gap-4">
                                                        {Object.entries(user.customClaims || {}).map(([key, val]: any) => (
                                                            <div key={key} className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                                                                <div className="text-xs text-gray-400 font-mono mb-1">{key}</div>
                                                                <div className="font-bold text-brand-dark">{String(val)}</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            {/* ACTION ZONE */}
                                            <div>
                                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 border-b pb-2">Assign Role</h3>
                                                <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                                        <div className="space-y-2">
                                                            <label className="text-xs font-bold text-gray-600">Target Tenant (Site ID)</label>
                                                            <input
                                                                type="text"
                                                                value={roleSiteId}
                                                                onChange={e => setRoleSiteId(e.target.value)}
                                                                className="w-full px-3 py-2 rounded-lg border-2 border-gray-200 focus:border-brand-dark outline-none font-medium"
                                                                placeholder="e.g. cafe-quattro"
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <label className="text-xs font-bold text-gray-600">Role Level</label>
                                                            <select
                                                                value={roleType}
                                                                onChange={e => setRoleType(e.target.value)}
                                                                className="w-full px-3 py-2 rounded-lg border-2 border-gray-200 focus:border-brand-dark outline-none font-medium bg-white"
                                                            >
                                                                <option value="staff">Staff (Limited)</option>
                                                                <option value="owner">Owner (Full Site Access)</option>
                                                                <option value="admin">Admin (Site Manager)</option>
                                                            </select>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-4">
                                                        <button
                                                            onClick={() => setConfirmOpen(true)}
                                                            className="flex-1 py-3 bg-brand-dark text-white rounded-lg font-bold hover:bg-gray-800 transition-all hover:-translate-y-0.5"
                                                        >
                                                            Assign Role
                                                        </button>
                                                        <button
                                                            onClick={handleRevoke}
                                                            className="px-6 py-3 border-2 border-red-100 text-red-600 bg-red-50 rounded-lg font-bold hover:bg-red-100 transition-colors flex items-center gap-2"
                                                        >
                                                            <UserX className="w-5 h-5" />
                                                            Revoke
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* TIPS PANEL MOVED HERE */}
                                            <div className="bg-blue-50 rounded-lg border border-blue-100 p-4 text-xs text-blue-800 flex gap-2">
                                                <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                                                <p>
                                                    Use <strong>Tenant ID</strong> (subdomain) to verify roles. Platform roles are strictly enforced.
                                                </p>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <ConfirmationDialog
                    isOpen={confirmOpen}
                    onCancel={() => setConfirmOpen(false)}
                    onConfirm={handleAssignRole}
                    title="Confirm Role Assignment"
                    description={`Grant ${roleType.toUpperCase()} access for site "${roleSiteId}" to this user?`}
                />

                {/* Team Management Section */}
                <div className="mt-10">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xs font-black uppercase tracking-wider text-gray-400">Team Management</h2>
                        <select
                            value={selectedTenantId}
                            onChange={e => setSelectedTenantId(e.target.value)}
                            className="border-2 border-gray-200 rounded-xl px-3 py-1.5 text-sm font-medium outline-none focus:border-brand-dark"
                        >
                            {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                    </div>
                    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                        {teamLoading ? (
                            <div className="text-center py-8 text-gray-400 text-sm">Loading members...</div>
                        ) : teamMembers.length === 0 ? (
                            <div className="text-center py-8 text-gray-400 text-sm">No members for this tenant.</div>
                        ) : (
                            <table className="w-full text-sm">
                                <thead className="border-b border-gray-100 bg-slate-50">
                                    <tr>
                                        <th className="text-left px-5 py-3 text-xs font-black text-brand-dark uppercase tracking-wider">Member</th>
                                        <th className="text-left px-5 py-3 text-xs font-black text-brand-dark uppercase tracking-wider">Role</th>
                                        <th className="px-5 py-3" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {teamMembers.map(m => (
                                        <tr key={m.uid} className="border-b border-gray-50 hover:bg-slate-50/50">
                                            <td className="px-5 py-3">
                                                <div className="font-semibold text-gray-800">{m.displayName || 'No Name'}</div>
                                                <div className="text-xs text-gray-400">{m.email}</div>
                                            </td>
                                            <td className="px-5 py-3">
                                                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{m.role || 'staff'}</span>
                                            </td>
                                            <td className="px-5 py-3 text-right">
                                                <button
                                                    onClick={() => { setRemoveMemberUid(m.uid); setRemoveMemberConfirm(true); }}
                                                    className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:border-red-300 hover:text-red-500 transition-colors"
                                                    title="Remove from team"
                                                >
                                                    <UserX className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                    <ConfirmationDialog
                        isOpen={removeMemberConfirm}
                        onCancel={() => setRemoveMemberConfirm(false)}
                        onConfirm={async () => {
                            if (removeMemberUid) await handleRemoveMember(removeMemberUid);
                            setRemoveMemberConfirm(false);
                        }}
                        title="Remove member?"
                        description="This will remove the member's access to this tenant."
                        variant="danger"
                    />
                </div>

                {/* CREATE USER DIALOG */}
                {createOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h3 className="font-bold text-lg text-brand-dark flex items-center gap-2">
                                <Users className="w-5 h-5 text-brand-dark" />
                                Create User
                            </h3>
                            <button onClick={() => setCreateOpen(false)} className="text-gray-400 hover:text-gray-600">
                                <UserX className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateUser} className="p-6 space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-600 uppercase">Email Address</label>
                                <input
                                    type="email"
                                    required
                                    value={newEmail}
                                    onChange={e => setNewEmail(e.target.value)}
                                    className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-brand-dark outline-none font-medium text-sm"
                                    placeholder="user@example.com"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-600 uppercase">Display Name</label>
                                <input
                                    type="text"
                                    required
                                    value={newName}
                                    onChange={e => setNewName(e.target.value)}
                                    className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-brand-dark outline-none font-medium text-sm"
                                    placeholder="John Doe"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-600 uppercase">Password</label>
                                <input
                                    type="password"
                                    required
                                    minLength={6}
                                    value={newPassword}
                                    onChange={e => setNewPassword(e.target.value)}
                                    className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-brand-dark outline-none font-medium text-sm"
                                    placeholder="••••••••"
                                />
                            </div>

                            <div className="pt-4 border-t border-gray-100">
                                <div className="text-xs font-bold text-blue-600 mb-2">OPTIONAL: BIND TO TENANT</div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase">Site ID</label>
                                        <input
                                            type="text"
                                            value={newSiteId}
                                            onChange={e => setNewSiteId(e.target.value)}
                                            className="w-full px-3 py-2 rounded-lg border-2 border-gray-100 focus:border-blue-500 outline-none font-mono text-xs"
                                            placeholder="cafe-quattro"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase">Start Role</label>
                                        <select
                                            className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all appearance-none"
                                            value={newRole}
                                            onChange={(e) => setNewRole(e.target.value)}
                                        >
                                            <option value="owner">Owner</option>
                                            <option value="member">Member</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={actionLoading}
                                className="w-full py-3 mt-2 bg-brand-dark text-white rounded-lg font-bold hover:bg-gray-800 transition-all shadow-md flex items-center justify-center gap-2"
                            >
                                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create User'}
                            </button>
                        </form>
                    </div>
                </div>
                )}
            </PageShell>
        </>
    );
}
