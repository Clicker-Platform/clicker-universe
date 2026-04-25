'use client';

import { useState, useEffect } from 'react';
import { useSite } from '@/lib/site-context';
import { db, auth } from '@/lib/firebase';
import { logger } from '@/lib/logger';
import { collection, onSnapshot, query, where, doc, getDoc } from 'firebase/firestore'; // Removed deleteDoc/setDoc as we use API
import { Plus, Mail, Shield, Trash2, X, Loader2, User, Clock } from 'lucide-react';
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog';
import { toast } from 'sonner';
import { PermissionEditor, ModuleAccess } from '@/components/admin/settings/PermissionEditor';

interface Member {
    uid: string;
    email: string;
    role: 'owner' | 'admin' | 'staff'; // Simplified roles
    permissions?: string[]; // Array of module keys
    moduleAccess?: Record<string, ModuleAccess>; // Granular permissions
    displayName?: string;
    photoURL?: string;
    status: 'active' | 'suspended';
    joinedAt: any;
}

interface Invitation {
    id: string; // Email is ID
    email: string;
    role: string;
    status: 'pending';
    createdAt: any;
    invitedBy?: string;
}

export default function TeamPage() {
    const { siteId } = useSite();
    const [members, setMembers] = useState<Member[]>([]);
    const [invitations, setInvitations] = useState<Invitation[]>([]);
    const [loading, setLoading] = useState(true);

    // Create/Edit Member Modal State
    const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
    const [editingMember, setEditingMember] = useState<Member | null>(null);
    const [memberEmail, setMemberEmail] = useState('');
    const [memberPassword, setMemberPassword] = useState('');
    const [memberPermissions, setMemberPermissions] = useState<string[]>([]);
    const [memberModuleAccess, setMemberModuleAccess] = useState<Record<string, any>>({}); // Assuming 'any' for ModuleAccess type
    const [isSaving, setIsSaving] = useState(false);

    // Site Modules Config
    const [siteModules, setSiteModules] = useState<{ [key: string]: boolean }>({});

    // Delete Confirmation
    const [itemToDelete, setItemToDelete] = useState<{ id: string, email?: string } | null>(null);

    // Data Fetching

    const MODULE_LABELS: Record<string, string> = {
        'pos': 'Legacy POS', // Hide this in UI
        'byod_pos': 'POS', // Unified Name
        'inventory': 'Inventory',
        'reservation': 'Reservations',
        'membership': 'Loyalty',
        'kitchen-display': 'Kitchen Screen',
        'finance': 'Finance & Reports',
    };

    const HIDDEN_MODULES = ['pos']; // Keys to hide from selection

    const formatPermission = (key: string) => {
        return MODULE_LABELS[key] || key.replace(/_/g, ' ').replace(/-/g, ' ');
    };

    useEffect(() => {
        if (!siteId) return;


        const unsubscribeMembers = onSnapshot(collection(db, 'sites', siteId, 'members'),
            (snapshot) => {
                const membersList: Member[] = [];
                snapshot.forEach((doc) => {
                    const data = doc.data();
                    membersList.push({
                        uid: doc.id,
                        ...data,
                    } as Member);
                });
                setMembers(membersList);
                setLoading(false);
            },
            (error) => {
                logger.error('admin.team.members.fetch.failed', { siteId, error });
                toast.error('Failed to load members: ' + error.message);
                setLoading(false);
            }
        );

        return () => {
            unsubscribeMembers();
        };
    }, [siteId]);

    // Fetch Site Settings (Modules)
    useEffect(() => {
        if (!siteId) return;

        // Subscribe to site document to get active modules
        const unsubSite = onSnapshot(doc(db, 'sites', siteId), (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                setSiteModules(data.modules || {});
            }
        });

        return () => unsubSite();
    }, [siteId]);

    const openAddModal = () => {
        setEditingMember(null);
        setMemberEmail('');
        setMemberPassword('');
        setMemberPermissions([]);
        setMemberModuleAccess({});
        setIsMemberModalOpen(true);
    };

    const openEditModal = (member: Member) => {
        setEditingMember(member);
        setMemberEmail(member.email);
        setMemberPassword(''); // Leave blank to keep unchanged
        setMemberPermissions(member.permissions || []);
        setMemberModuleAccess(member.moduleAccess || {});
        setIsMemberModalOpen(true);
    };

    const handleSaveMember = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);

        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) throw new Error("Authentication required");

            // Updated API endpoint to 'add' instead of 'invite'
            const res = await fetch('/api/admin/team/add', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-site-id': siteId, // Pass siteId in header for API
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    email: memberEmail,
                    password: memberPassword || undefined, // Send undefined if empty to avoid reset? API handles it?
                    // API: "if (password && password.length < 6) error". If password is empty string, it might trigger error or ignore?
                    // API code: `const { ... password ... } = body`. If I send undefined, password is undefined.
                    // API line 19: `if (password && password.length < 6)`. So undefined is Safe.
                    role: 'staff', // Always staff (owner set by system/metadata only)
                    permissions: memberPermissions,
                    moduleAccess: memberModuleAccess
                }),
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || 'Failed to save member');
            }

            const data = await res.json();
            toast.success(editingMember ? 'Member updated successfully' : 'Member added successfully');
            setIsMemberModalOpen(false);
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleRemove = async () => {
        if (!itemToDelete) return;

        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) throw new Error("Authentication required");

            const res = await fetch('/api/admin/team/remove', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-site-id': siteId,
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    id: itemToDelete.id, // UID or Email
                    type: 'member'
                }),
            });

            if (!res.ok) throw new Error('Failed to remove user');

            toast.success('User removed successfully');
            setItemToDelete(null);
        } catch (error: any) {
            toast.error(error.message);
        }
    };

    // Debug: Force stop loading if it changes too long
    useEffect(() => {
        const timer = setTimeout(() => {
            if (loading) {
                logger.warn('admin.team.members.load.timeout', { siteId });
            }
        }, 8000);
        return () => clearTimeout(timer);
    }, [loading]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center gap-4">
                <Loader2 className="animate-spin" />
                <div className="text-sm text-gray-400 dark:text-neutral-600">
                    Loading Team... <br />
                    Site ID: {siteId || 'Waiting...'}
                </div>
            </div>
        );
    }

    if (!siteId) {
        return <div className="text-center text-red-500">Error: Site ID missing. Please refresh.</div>;
    }

    return (
        <div className="max-w-5xl">
            {/* Debug Info (Can remove later) */}
            <div className="fixed bottom-4 right-4 text-xs text-gray-300 dark:text-neutral-700 pointer-events-none">
                {siteId}
            </div>

            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-neutral-100">Team Management</h1>
                    <p className="text-gray-500 dark:text-neutral-500">Manage access to your store dashboard.</p>
                </div>
                <button
                    onClick={openAddModal}
                    className="flex items-center gap-2 bg-studio-blue text-white px-6 py-3 rounded-lg font-bold hover:bg-studio-blue/85 transition-colors"
                >
                    <Plus size={20} />
                    Add Member
                </button>
            </div>

            {/* Active Members */}
            <div className="bg-white dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800 overflow-hidden mb-8">
                <div className="p-6 border-b border-gray-100 dark:border-neutral-800 bg-gray-50/50 dark:bg-neutral-800/50">
                    <h2 className="font-bold text-lg flex items-center gap-2 dark:text-neutral-200">
                        <User size={20} className="text-brand-dark" />
                        Active Members
                    </h2>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-neutral-800">
                    {members.length === 0 ? (
                        <div className="p-8 text-center text-gray-500 dark:text-neutral-500 italic">No members found.</div>
                    ) : (
                        members.map((member) => (
                            <div key={member.uid} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-brand-green/20 flex items-center justify-center text-brand-dark font-bold">
                                        {member.displayName?.charAt(0) || member.email.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <div className="font-bold text-gray-900 dark:text-neutral-100">{member.displayName || 'User'}</div>
                                        <div className="text-sm text-gray-500 dark:text-neutral-500">{member.email}</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-6">
                                    <div className="flex flex-col items-end gap-1">
                                        <span className={`
                                            px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider
                                            ${(member.role === 'owner' || member.role === 'admin') ? 'bg-purple-100 dark:bg-purple-950/30 text-purple-700 dark:text-purple-400' : 'bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-neutral-300'}
                                        `}>
                                            {member.role}
                                        </span>
                                        {member.role !== 'owner' && member.permissions && member.permissions.length > 0 && (
                                            <div className="flex gap-1 flex-wrap justify-end max-w-[200px]">
                                                {member.permissions
                                                    .filter(p => siteModules[p] !== false) // Only show if module is NOT disabled (undefined allows core/static perms if any)
                                                    .map(p => (
                                                        <span key={p} className="text-[10px] px-1.5 py-0.5 bg-brand-green/20 text-brand-dark rounded font-medium capitalize truncate max-w-[100px]" title={formatPermission(p)}>
                                                            {formatPermission(p)}
                                                        </span>
                                                    ))}
                                            </div>
                                        )}
                                    </div>
                                    {member.role !== 'owner' && (
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => openEditModal(member)}
                                                className="text-gray-400 dark:text-neutral-600 hover:text-blue-500 transition-colors"
                                                title="Edit Permissions"
                                            >
                                                <Shield size={18} />
                                            </button>
                                            <button
                                                onClick={() => setItemToDelete({ id: member.uid, email: member.email })}
                                                className="text-gray-400 dark:text-neutral-600 hover:text-red-500 transition-colors"
                                                title="Remove Member"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Member Modal */}
            {isMemberModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white dark:bg-neutral-900 rounded-lg w-full max-w-3xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-neutral-100">
                                {editingMember ? 'Edit Member' : 'Add New Member'}
                            </h2>
                            <button onClick={() => setIsMemberModalOpen(false)} className="text-gray-400 dark:text-neutral-600 hover:text-gray-600 dark:hover:text-neutral-400">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveMember} className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-neutral-300 mb-1">Email Address</label>
                                <input
                                    type="email"
                                    required
                                    value={memberEmail}
                                    onChange={(e) => setMemberEmail(e.target.value)}
                                    placeholder="colleague@example.com"
                                    disabled={!!editingMember}
                                    className="w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-gray-400 outline-none transition-colors disabled:bg-gray-100 dark:disabled:bg-neutral-700 disabled:text-gray-500 dark:disabled:text-neutral-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-neutral-300 mb-1">
                                    {editingMember ? 'New Password (Optional)' : 'Password'}
                                </label>
                                <input
                                    type="password"
                                    required={!editingMember}
                                    value={memberPassword}
                                    onChange={(e) => setMemberPassword(e.target.value)}
                                    placeholder="••••••••"
                                    minLength={6}
                                    className="w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-gray-400 outline-none transition-colors"
                                />
                                <p className="text-xs text-gray-400 dark:text-neutral-600 mt-1">Min. 6 characters. If user exists, this will be ignored.</p>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-neutral-300 mb-2">Access Permissions</label>
                                <PermissionEditor
                                    value={{
                                        permissions: memberPermissions,
                                        moduleAccess: memberModuleAccess
                                    }}
                                    onChange={(val) => {
                                        setMemberPermissions(val.permissions);
                                        setMemberModuleAccess(val.moduleAccess);
                                    }}
                                    siteModules={siteModules}
                                />
                                <p className="text-xs text-gray-400 dark:text-neutral-600 mt-2">Select which features this staff member can access.</p>
                            </div>

                            <button
                                type="submit"
                                disabled={isSaving}
                                className="w-full bg-studio-blue text-white py-3 rounded-lg font-bold hover:bg-studio-blue/85 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-4"
                            >
                                {isSaving ? 'Saving...' : (editingMember ? 'Update Member' : 'Add Member')}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            <ConfirmationDialog
                isOpen={!!itemToDelete}
                onCancel={() => setItemToDelete(null)}
                onConfirm={handleRemove}
                title="Remove Member?"
                message={`Are you sure you want to remove ${itemToDelete?.email || 'this user'}? They will lose access immediately.`}
                confirmLabel="Remove"
                isDestructive={true}
            />
        </div>
    );
}
