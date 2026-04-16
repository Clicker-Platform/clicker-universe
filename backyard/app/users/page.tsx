'use client';

import { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { toast } from 'sonner';
import { Search, ShieldAlert, UserCog, UserX, CheckCircle2, Copy, Users, Loader2 } from 'lucide-react';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import Sidebar from '@/components/Sidebar';

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

            toast.success('Identity Created', { description: `${newEmail} registered successfully.` });
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

            toast.success('Access Revoked', { description: 'User has been stripped of all platform privileges.' });
        } catch (error: any) {
            toast.error('Revoke Failed', { description: error.message });
        } finally {
            setActionLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50/50 flex font-sans">
            <Sidebar />
            <div className="flex-1 ml-64 p-8">
                <header className="mb-8">
                    <h1 className="text-3xl font-black text-brand-dark flex items-center gap-3">
                        <UserCog className="w-8 h-8" />
                        USER CONTROL
                    </h1>
                    <p className="text-gray-500 font-medium">Global Identity & Access Management (RBAC)</p>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-[calc(100vh-200px)]">

                    {/* 1. LIST PANEL */}
                    <div className="bg-white rounded-3xl border-[3px] border-brand-dark shadow-[6px_6px_0px_0px_rgba(34,34,34,1)] overflow-hidden flex flex-col">
                        <div className="p-6 border-b-[3px] border-brand-dark bg-gray-50/50 flex flex-col gap-4">
                            <div className="flex justify-between items-center">
                                <h2 className="text-xl font-bold text-brand-dark">Subjects Database</h2>
                                <div className="flex items-center gap-2">
                                    <span className="bg-brand-dark text-white px-2 py-1 rounded text-xs font-bold">{users.length} Found</span>
                                    <button
                                        onClick={() => setCreateOpen(true)}
                                        className="bg-blue-600 hover:bg-blue-700 text-white p-1.5 rounded-lg transition-colors"
                                        title="Register New Identity"
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
                                    <span className="text-xs font-bold uppercase tracking-wider">Fetching Identity Db...</span>
                                </div>
                            ) : filteredUsers.length === 0 ? (
                                <div className="p-8 text-center text-gray-400 text-sm">No subjects found matching query.</div>
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
                                        <h2 className="text-2xl font-black text-brand-dark">{user.displayName || 'Unnamed Subject'}</h2>
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
                                            <h3 className="font-black text-lg">Immutable Subject</h3>
                                            <p className="text-sm opacity-80 mt-1 max-w-xs">
                                                This is the Root Superadmin account. Its privileges are hardcoded and cannot be modified or revoked via the Master Control Program.
                                            </p>
                                        </div>
                                    )}

                                    {/* CURRENT CLAIMS */}
                                    {user.email !== 'clickerplatform@gmail.com' && (
                                        <>
                                            <div>
                                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 border-b pb-2">Current Clearance (Claims)</h3>
                                                {Object.keys(user.customClaims || {}).length === 0 ? (
                                                    <p className="text-gray-400 italic">No special privileges assigned (Standard User).</p>
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
                                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 border-b pb-2">Grant Privileges</h3>
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
                    title="Confirm Clearance Grant"
                    description={`You are about to grant "${roleType.toUpperCase()}" access for site "${roleSiteId}" to this user. This powerful permission allows them to modify tenant data.`}
                />
            </div>

            {/* CREATE USER DIALOG */}
            {createOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h3 className="font-bold text-lg text-brand-dark flex items-center gap-2">
                                <Users className="w-5 h-5 text-blue-600" />
                                Register New Identity
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
                                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Identity'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
