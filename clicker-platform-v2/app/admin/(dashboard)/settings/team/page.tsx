'use client';

import { useState, useEffect } from 'react';
import { useSite } from '@/lib/site-context';
import { db, auth } from '@/lib/firebase';
import { logger } from '@/lib/logger-edge';
import { collection, onSnapshot, doc } from 'firebase/firestore'; // Removed deleteDoc/setDoc as we use API
import { Plus, Shield, Trash2, X, Loader2, User } from 'lucide-react';
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog';
import { toast } from 'sonner';
import { ModuleDefinition } from '@/lib/modules/types';
import { subscribeToEnabledModules } from '@/lib/modules/registry';

interface Member {
    uid: string;
    email: string;
    role: 'owner' | 'admin' | 'staff'; // Simplified roles
    permissions?: string[]; // Array of module keys
    moduleAccess?: Record<string, Record<string, string>>; // Granular permissions
    displayName?: string;
    photoURL?: string;
    status: 'active' | 'suspended';
    joinedAt: unknown;
}

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

export default function TeamPage() {
    const { siteId } = useSite();
    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);

    // Create/Edit Member Modal State
    const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
    const [editingMember, setEditingMember] = useState<Member | null>(null);
    const [memberEmail, setMemberEmail] = useState('');
    const [memberPassword, setMemberPassword] = useState('');
    const [memberPermissions, setMemberPermissions] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [enabledModules, setEnabledModules] = useState<ModuleDefinition[]>([]);
    const [allModules, setAllModules] = useState<ModuleDefinition[]>([]);

    // Site Modules Config
    const [siteModules, setSiteModules] = useState<{ [key: string]: boolean }>({});

    // Delete Confirmation
    const [itemToDelete, setItemToDelete] = useState<{ id: string, email?: string } | null>(null);

    // Data Fetching

    const formatModuleList = (permissions: string[]) => {
        const visible = permissions
            .filter(p => !HIDDEN_MODULES.includes(p))
            .map(p => MODULE_LABELS[p] || p.replace(/_/g, ' ').replace(/-/g, ' '));
        if (visible.length <= 3) return visible.join(', ');
        return `${visible.slice(0, 3).join(', ')} (+${visible.length - 3} lagi)`;
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

    // Subscribe to enabled modules list
    useEffect(() => {
        const unsubscribe = subscribeToEnabledModules(setAllModules);
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const active = allModules.filter(m => siteModules[m.id] && !HIDDEN_MODULES.includes(m.id));
        setEnabledModules(active);
    }, [allModules, siteModules]);

    const openAddModal = () => {
        setEditingMember(null);
        setMemberEmail('');
        setMemberPassword('');
        setMemberPermissions([]);
        setIsMemberModalOpen(true);
    };

    const openEditModal = (member: Member) => {
        setEditingMember(member);
        setMemberEmail(member.email);
        setMemberPassword('');

        // Derive checked modules dari kedua field (permissions[] dan granular moduleAccess)
        const fromPermissions = new Set(member.permissions || []);
        const fromModuleAccess = new Set(
            Object.entries(member.moduleAccess || {})
                .filter(([, routes]) => Object.values(routes).some(v => v === 'full' || v === 'view'))
                .map(([moduleId]) => moduleId)
        );
        setMemberPermissions(Array.from(new Set([...fromPermissions, ...fromModuleAccess])));
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
                    moduleAccess: {}
                }),
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || 'Failed to save member');
            }

            await res.json();
            toast.success(editingMember ? 'Member updated successfully' : 'Member added successfully');
            setIsMemberModalOpen(false);
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : 'An error occurred');
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
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : 'An error occurred');
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center gap-4">
                <Loader2 className="animate-spin" />
                <div className="text-sm text-gray-400 dark:text-neutral-600">
                    Loading Team...
                </div>
            </div>
        );
    }

    if (!siteId) {
        return <div className="text-center text-red-500">Error: Site ID missing. Please refresh.</div>;
    }

    return (
        <div className="max-w-5xl">
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
                                            <p className="text-xs text-gray-500 dark:text-neutral-500 text-right max-w-[200px]">
                                                {formatModuleList(member.permissions)}
                                            </p>
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
                                <label className="block text-sm font-bold text-gray-700 dark:text-neutral-300 mb-2">Modul yang bisa diakses</label>
                                {enabledModules.length === 0 ? (
                                    <p className="text-sm text-gray-400 dark:text-neutral-600 py-4 text-center">
                                        Belum ada modul aktif. Aktifkan modul di Site Settings terlebih dahulu.
                                    </p>
                                ) : (
                                    <div className="space-y-2 border border-gray-200 dark:border-neutral-700 rounded-lg p-4">
                                        {enabledModules.map(module => (
                                            <label key={module.id} className="flex items-center gap-3 cursor-pointer group">
                                                <input
                                                    type="checkbox"
                                                    className="w-4 h-4 rounded border-gray-300 dark:border-neutral-600 text-studio-blue focus:ring-studio-blue dark:bg-neutral-800"
                                                    checked={memberPermissions.includes(module.id)}
                                                    onChange={(e) => {
                                                        setMemberPermissions(prev =>
                                                            e.target.checked
                                                                ? [...prev, module.id]
                                                                : prev.filter(p => p !== module.id)
                                                        );
                                                    }}
                                                />
                                                <span className="text-sm font-medium text-gray-700 dark:text-neutral-300 group-hover:text-gray-900 dark:group-hover:text-neutral-100 transition-colors">
                                                    {module.displayName || module.id}
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                )}
                                <p className="text-xs text-gray-400 dark:text-neutral-600 mt-2">Pilih fitur mana yang bisa diakses staff ini.</p>
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
