'use client';

import { useState, useEffect, useMemo } from 'react';
import { httpsCallable } from 'firebase/functions';
import { collection, onSnapshot } from 'firebase/firestore';
import { functions, db, auth } from '@/lib/firebase';
import { toast } from 'sonner';
import { Store, Power, PowerOff, Loader2, RefreshCw, Database, ExternalLink, Users, UserPlus, UserX, Trash2, Pencil, Search } from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { ConfirmationDialog } from '../../components/ui/confirmation-dialog';
import Sidebar from '../../components/Sidebar';
import { PermissionEditor } from '@/components/PermissionEditor';
import { ModuleAccess } from '@/lib/modules/types';

export default function TenantsPage() {
    const [tenants, setTenants] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Create Form State
    const [name, setName] = useState('');
    const [ownerEmail, setOwnerEmail] = useState('');
    const [password, setPassword] = useState('');
    const [subdomain, setSubdomain] = useState('');
    const [hostingId, setHostingId] = useState('quattro'); // Default to quattro
    const [seedSampleData, setSeedSampleData] = useState(true); // Default to on
    const [createLoading, setCreateLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Action State
    const [selectedTenant, setSelectedTenant] = useState<any>(null);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [actionType, setActionType] = useState<'suspend' | 'activate'>('suspend');
    const [actionLoading, setActionLoading] = useState(false);

    // Seed Dialog State
    const [seedDialogOpen, setSeedDialogOpen] = useState(false);
    const [seedTarget, setSeedTarget] = useState<any>(null);

    // Remove Member Dialog State
    const [removeMemberDialogOpen, setRemoveMemberDialogOpen] = useState(false);
    const [removeMemberTarget, setRemoveMemberTarget] = useState<string | null>(null);

    const filteredTenants = useMemo(() =>
        tenants.filter(t =>
            t.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.slug?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.ownerEmail?.toLowerCase().includes(searchQuery.toLowerCase())
        ), [tenants, searchQuery]);

    // 1. Fetch Tenants (Classic Request-Response)
    const fetchTenants = async (): Promise<any[]> => {
        setLoading(true);
        try {
            const getTenantsFn = httpsCallable(functions, 'getTenants');
            const result: any = await getTenantsFn();
            const seen = new Set();
            const unique = result.data.list.filter((t: any) => seen.has(t.id) ? false : seen.add(t.id));
            // Merge: prefer incoming data but keep any locally-updated modules if incoming is missing keys
            setTenants((prev: any[]) => {
                if (prev.length === 0) return unique;
                return unique.map((incoming: any) => {
                    const existing = prev.find((p: any) => p.id === incoming.id);
                    if (!existing) return incoming;
                    // Count keys — more keys = more complete data
                    const incomingKeys = Object.keys(incoming.modules || {}).length;
                    const existingKeys = Object.keys(existing.modules || {}).length;
                    return incomingKeys >= existingKeys ? incoming : { ...incoming, modules: existing.modules };
                });
            });
            return unique;
        } catch (error: any) {
            if (error.code !== 'permission-denied') {
                toast.error("Failed to fetch tenants", { description: error.message });
            }
            return [];
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
            if (user) {
                fetchTenants();
            } else {
                setLoading(false);
            }
        });

        return () => unsubscribeAuth();
    }, []);

    // 2. Handle Create Tenant
    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreateLoading(true);
        try {
            const createTenant = httpsCallable(functions, 'createTenant');
            await createTenant({ name, ownerEmail, password, subdomain, hostingId, modules: {}, seedSampleData });
            toast.success('Tenant Forged Successfully', {
                description: `Site ID: ${subdomain.toLowerCase().replace(/[^a-z0-9]/g, '-')}`
            });
            setName('');
            setOwnerEmail('');
            setPassword('');
            setSubdomain('');
            setHostingId('quattro');
            setSeedSampleData(true);
        } catch (error: any) {
            toast.error('Failed to Forge Tenant', { description: error.message });
        } finally {
            setCreateLoading(false);
        }
    };

    // 3. Handle Suspend/Activate
    const handleToggleStatus = (tenant: any) => {
        setSelectedTenant(tenant);
        setActionType(tenant.status === 'active' ? 'suspend' : 'activate');
        setConfirmOpen(true);
    };

    const confirmStatusChange = async () => {
        if (!selectedTenant) return;
        setActionLoading(true);
        try {
            const suspendTenant = httpsCallable(functions, 'suspendTenant');
            await suspendTenant({
                siteId: selectedTenant.id,
                status: actionType === 'suspend' ? 'suspended' : 'active'
            });
            toast.success(`Tenant ${actionType === 'suspend' ? 'Suspended' : 'Activated'}`, {
                description: `Target: ${selectedTenant.name}`
            });
        } catch (error: any) {
            toast.error('Status Change Failed', { description: error.message });
        } finally {
            setActionLoading(false);
            setConfirmOpen(false);
            setSelectedTenant(null);
        }
    };

    const handleSeed = (tenant: any) => {
        setSeedTarget(tenant);
        setSeedDialogOpen(true);
    };

    const confirmSeed = async () => {
        if (!seedTarget) return;
        setSeedDialogOpen(false);
        const toastId = toast.loading('Seeding data...', { description: `Target: ${seedTarget.name}` });
        try {
            const seedFn = httpsCallable(functions, 'seedSiteData');
            await seedFn({ siteId: seedTarget.id });
            toast.success('Seeding Complete', { id: toastId, description: `Data for ${seedTarget.name} has been reset.` });
        } catch (error: any) {
            toast.error('Seeding Failed', { id: toastId, description: error.message });
        }
    };

    // 4. Handle Hard Delete Tenant
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');
    const [deleteLoading, setDeleteLoading] = useState(false);

    const openDeleteDialog = (tenant: any) => {
        setSelectedTenant(tenant);
        setDeleteConfirmText('');
        setDeleteDialogOpen(true);
    };

    const handleHardDelete = async () => {
        if (!selectedTenant) return;
        if (deleteConfirmText !== selectedTenant.id) {
            toast.error('Confirmation mismatch', { description: 'Type the exact Site ID to confirm deletion.' });
            return;
        }
        setDeleteLoading(true);
        try {
            const hardDeleteFn = httpsCallable(functions, 'hardDeleteTenant');
            await hardDeleteFn({ siteId: selectedTenant.id });
            toast.success('Tenant Deleted', {
                description: `${selectedTenant.name} has been removed.`
            });
            setDeleteDialogOpen(false);
            setTenants(prev => prev.filter(t => t.id !== selectedTenant.id));
            setSelectedTenant(null);
        } catch (error: any) {
            toast.error('Hard Delete Failed', { description: error.message });
        } finally {
            setDeleteLoading(false);
        }
    };

    // 6. Handle Update URL / Slug
    const [updateUrlDialogOpen, setUpdateUrlDialogOpen] = useState(false);
    const [newSlug, setNewSlug] = useState('');
    const [updateUrlLoading, setUpdateUrlLoading] = useState(false);

    const openUpdateUrlDialog = (tenant: any) => {
        setSelectedTenant(tenant);
        setNewSlug(tenant.slug || tenant.id);
        setUpdateUrlDialogOpen(true);
    };

    const handleUpdateUrl = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedTenant || !newSlug.trim()) return;
        const sanitized = newSlug.toLowerCase().replace(/[^a-z0-9-]/g, '-');
        setUpdateUrlLoading(true);
        try {
            const updateSlugFn = httpsCallable(functions, 'updateTenantSlug');
            await updateSlugFn({ siteId: selectedTenant.id, newSlug: sanitized });
            toast.success('URL Updated', { description: `New URL: /${sanitized}` });
            setUpdateUrlDialogOpen(false);
            setTenants(prev => prev.map(t =>
                t.id === selectedTenant.id ? { ...t, slug: sanitized } : t
            ));
            setSelectedTenant(null);
        } catch (error: any) {
            toast.error('URL Update Failed', { description: error.message });
        } finally {
            setUpdateUrlLoading(false);
        }
    };

    // 7. Handle Team Management
    const [teamDialogOpen, setTeamDialogOpen] = useState(false);
    const [teamMembers, setTeamMembers] = useState<any[]>([]);
    const [teamLoading, setTeamLoading] = useState(false);

    // Add Member State
    const [newMemberEmail, setNewMemberEmail] = useState('');
    const [newMemberName, setNewMemberName] = useState('');
    const [newMemberPassword, setNewMemberPassword] = useState('');
    const [newMemberRole, setNewMemberRole] = useState('staff');
    const [permissions, setPermissions] = useState<string[]>([]);
    const [moduleAccess, setModuleAccess] = useState<Record<string, ModuleAccess>>({});

    // Subscribe to Firestore members collection
    useEffect(() => {
        if (!teamDialogOpen || !selectedTenant?.id) return;

        setTeamLoading(true);
        const unsubscribe = onSnapshot(collection(db, 'sites', selectedTenant.id, 'members'),
            (snapshot) => {
                const members: any[] = [];
                snapshot.forEach((doc) => {
                    members.push({ uid: doc.id, ...doc.data() });
                });
                setTeamMembers(members);
                setTeamLoading(false);
            },
            (error) => {
                toast.error('Failed to load team', { description: error.message });
                setTeamLoading(false);
            }
        );

        return () => unsubscribe();
    }, [teamDialogOpen, selectedTenant?.id]);

    const openTeamDialog = (tenant: any) => {
        setSelectedTenant(tenant);
        setTeamDialogOpen(true);
        // Reset form
        setNewMemberEmail('');
        setNewMemberName('');
        setNewMemberPassword('');
        setNewMemberRole('staff');
        setPermissions([]);
        setModuleAccess({});
    };

    const handleAddMember = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedTenant) return;
        setTeamLoading(true);
        try {
            const createUserFn = httpsCallable(functions, 'createUser');
            const payload = {
                email: newMemberEmail,
                password: newMemberPassword, // Optional for existing users
                displayName: newMemberName,
                role: newMemberRole, // 'owner' or 'member' (mapped to 'staff' in cloud function if not owner)
                siteId: selectedTenant.id,
                permissions: newMemberRole === 'staff' ? permissions : [],
                moduleAccess: newMemberRole === 'staff' ? moduleAccess : {}
            };
            const result: any = await createUserFn(payload);

            toast.success(result.data.message);

            // Clear form (no need to fetch, onSnapshot handles it)
            setNewMemberEmail('');
            setNewMemberName('');
            setNewMemberPassword('');
        } catch (error: any) {
            toast.error('Failed to add member', { description: error.message });
        } finally {
            setTeamLoading(false);
        }
    };

    const handleRemoveMember = (uid: string) => {
        setRemoveMemberTarget(uid);
        setRemoveMemberDialogOpen(true);
    };

    const confirmRemoveMember = async () => {
        if (!removeMemberTarget) return;
        setRemoveMemberDialogOpen(false);
        setTeamLoading(true);
        try {
            const removeUserFn = httpsCallable(functions, 'removeUserFromSite');
            await removeUserFn({ uid: removeMemberTarget, siteId: selectedTenant.id });
            toast.success('Member removed successfully');
        } catch (error: any) {
            toast.error('Failed to remove member', { description: error.message });
        } finally {
            setTeamLoading(false);
            setRemoveMemberTarget(null);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50/50 flex font-sans">
            <Sidebar />
            <div className="flex-1 ml-64 p-8">
                <header className="mb-4">
                    <h1 className="text-3xl font-black text-brand-dark flex items-center gap-3">
                        <Store className="w-8 h-8" />
                        Tenants
                    </h1>
                    <p className="text-gray-400 font-medium">Create & manage tenants</p>
                </header>

                <div className="flex flex-col gap-8">
                    {/* FORGE PANEL */}
                    <div className="bg-white rounded-2xl border-[3px] border-brand-dark overflow-hidden flex flex-col">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/30">
                            <div>
                                <h2 className="text-xl font-bold text-brand-dark">Create Tenant</h2>
                                <p className="text-xs text-gray-400 font-medium">Add a new tenant to the platform</p>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => fetchTenants()} className="p-2 hover:bg-white rounded-lg transition-all border border-transparent hover:border-gray-100">
                                    <RefreshCw className={`w-5 h-5 text-brand-dark ${loading ? 'animate-spin' : ''}`} />
                                </button>
                            </div>
                        </div>

                        <form onSubmit={handleCreate} className="p-8 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* Basic Info */}
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-brand-dark uppercase tracking-wider pl-1">Tenant Name</label>
                                        <input
                                            type="text"
                                            required
                                            value={name}
                                            onChange={e => setName(e.target.value)}
                                            className="w-full px-4 py-3 rounded-lg border-[3px] border-gray-100 focus:border-brand-dark outline-none font-bold text-sm bg-gray-50/30 transition-all"
                                            placeholder="Cafe Quattro"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-brand-dark uppercase tracking-wider pl-1">Hosting Platform</label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <button
                                                type="button"
                                                onClick={() => setHostingId('quattro')}
                                                className={`px-4 py-3 rounded-lg border-[3px] font-black text-[10px] uppercase transition-all ${hostingId === 'quattro'
                                                    ? 'border-brand-dark bg-brand-dark text-white shadow-md'
                                                    : 'border-gray-100 bg-white text-gray-400 hover:border-gray-200'
                                                    }`}
                                            >
                                                Quattro
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setHostingId('aletra')}
                                                className={`px-4 py-3 rounded-lg border-[3px] font-black text-[10px] uppercase transition-all ${hostingId === 'aletra'
                                                    ? 'border-brand-dark bg-brand-dark text-white shadow-md'
                                                    : 'border-gray-100 bg-white text-gray-400 hover:border-gray-200'
                                                    }`}
                                            >
                                                Aletra
                                            </button>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-brand-dark uppercase tracking-wider pl-1">Subdomain (ID)</label>
                                        <input
                                            type="text"
                                            required
                                            value={subdomain}
                                            onChange={e => setSubdomain(e.target.value)}
                                            className="w-full px-4 py-3 rounded-lg border-[3px] border-gray-100 focus:border-brand-dark outline-none font-bold text-sm bg-gray-50/30 transition-all"
                                            placeholder="my-business (lowercase, dashes only)"
                                        />
                                    </div>
                                </div>

                                {/* Owner + Submit (Span 2) */}
                                <div className="space-y-4 md:col-span-2">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="md:col-span-2 grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-brand-dark uppercase tracking-wider pl-1">Owner Email</label>
                                                <input
                                                    type="email"
                                                    required
                                                    value={ownerEmail}
                                                    onChange={e => setOwnerEmail(e.target.value)}
                                                    className="w-full px-4 py-3 rounded-lg border-[3px] border-gray-100 focus:border-brand-dark outline-none font-bold text-sm bg-gray-50/30"
                                                    placeholder="owner@cafe.com"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-brand-dark uppercase tracking-wider pl-1">Owner Password</label>
                                                <input
                                                    type="password"
                                                    required
                                                    value={password}
                                                    onChange={e => setPassword(e.target.value)}
                                                    className="w-full px-4 py-3 rounded-lg border-[3px] border-gray-100 focus:border-brand-dark outline-none font-bold text-sm bg-gray-50/30"
                                                    placeholder="••••••••"
                                                    minLength={6}
                                                />
                                            </div>
                                        </div>
                                        <div className="flex items-end">
                                            <button
                                                type="submit"
                                                disabled={createLoading}
                                                className="w-full py-3 bg-brand-dark text-white rounded-xl font-black uppercase text-xs tracking-widest hover:bg-gray-800 transition-all active:scale-95 shadow-xl flex items-center justify-center gap-2"
                                            >
                                                {createLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><UserPlus className="w-4 h-4" /> Create Tenant</>}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </form>
                    </div>

                    {/* LIST PANEL */}
                    <div className="bg-white rounded-2xl border-[3px] border-brand-dark overflow-hidden flex flex-col">
                        <div className="p-6 border-b border-gray-100 bg-gray-50/30">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-xl font-bold text-brand-dark">Tenant List</h2>
                                <div className="bg-brand-dark px-4 py-2 rounded-lg text-[10px] font-black text-white shadow-md uppercase tracking-widest">
                                    {tenants.length} tenants
                                </div>
                            </div>
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 rounded-lg border-2 border-gray-200 focus:border-brand-dark outline-none font-medium text-sm transition-colors"
                                    placeholder="Search by name, slug, or email..."
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto">
                            {loading ? (
                                <div className="p-12 text-center text-gray-400 uppercase font-black text-xs tracking-widest flex items-center justify-center gap-3">
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Loading tenants...
                                </div>
                            ) : tenants.length === 0 ? (
                                <div className="p-12 text-center">
                                    <Store className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                                    <h3 className="font-bold text-gray-600 mb-2">No tenants yet</h3>
                                    <p className="text-sm text-gray-400">Create your first tenant using the form above.</p>
                                </div>
                            ) : (
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50/50 border-b border-gray-100 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                                        <tr>
                                            <th className="p-6">Tenant</th>
                                            <th className="p-6">Owner</th>
                                            <th className="p-6">Status</th>
                                            <th className="p-6 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {filteredTenants.map((tenant) => (
                                            <tr key={tenant.id} className="hover:bg-gray-50/50 transition-colors">
                                                <td className="p-4 pl-6">
                                                    <div className="flex flex-col gap-1">
                                                        <div className="font-bold text-[17px] text-brand-dark tracking-tight">{tenant.name}</div>
                                                        <div className="flex items-center gap-2 text-xs text-gray-400 font-medium">
                                                            <span className="font-mono bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">{tenant.slug || tenant.id}</span>
                                                            {tenant.id !== tenant.slug && (
                                                                <span className="text-[10px] opacity-70">ID: {tenant.id.slice(0, 8)}</span>
                                                            )}
                                                        </div>
                                                        <a
                                                            href={`https://clickerapps.web.app/${tenant.slug || tenant.id}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-[11px] text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1.5 bg-blue-50/50 w-fit px-2 py-1 rounded-lg border border-blue-100/50 transition-all hover:bg-blue-50"
                                                        >
                                                            <ExternalLink className="w-3.5 h-3.5" />
                                                            clickerapps.web.app/{tenant.slug || tenant.id}
                                                        </a>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-sm text-gray-600">
                                                    {tenant.ownerEmail}
                                                </td>
                                                <td className="p-4">
                                                    {tenant.status === 'active' ? (
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-100">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                                            Active
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-100">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                                            Suspended
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="p-4 text-right pr-6">
                                                    <div className="flex justify-end items-center gap-2">
                                                        <div className="flex items-center bg-gray-50 p-1 rounded-lg border border-gray-100 gap-1">
                                                            <button
                                                                onClick={() => openTeamDialog(tenant)}
                                                                className="p-2 rounded-lg text-indigo-600 hover:bg-white hover:transition-all"
                                                                title="Manage Team"
                                                            >
                                                                <Users className="w-4.5 h-4.5" />
                                                            </button>
                                                        </div>

                                                        <div className="w-[1px] h-6 bg-gray-200 mx-1" />

                                                        <div className="flex items-center gap-1">
                                                            <button
                                                                onClick={() => openUpdateUrlDialog(tenant)}
                                                                className="p-2 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 transition-all"
                                                                title="Update URL / Slug"
                                                            >
                                                                <Pencil className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleSeed(tenant)}
                                                                className="p-2 rounded-lg border border-amber-200 text-amber-600 hover:bg-amber-50 transition-all"
                                                                title="Seed Demo Data"
                                                            >
                                                                <Database className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleToggleStatus(tenant)}
                                                                className={`p-2 rounded-lg border transition-all ${tenant.status === 'active'
                                                                    ? 'border-red-200 text-red-600 hover:bg-red-50'
                                                                    : 'border-green-200 text-green-600 hover:bg-green-50'
                                                                    }`}
                                                                title={tenant.status === 'active' ? 'Suspend' : 'Activate'}
                                                            >
                                                                {tenant.status === 'active' ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                                                            </button>
                                                            <button
                                                                onClick={() => openDeleteDialog(tenant)}
                                                                className="p-2 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 transition-all"
                                                                title="Hard Delete Tenant"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>

                <ConfirmationDialog
                    isOpen={confirmOpen}
                    onCancel={() => setConfirmOpen(false)}
                    onConfirm={confirmStatusChange}
                    title={actionType === 'suspend' ? 'Suspend Tenant Access' : 'Reactivate Tenant Access'}
                    description={
                        actionType === 'suspend'
                            ? `Are you sure you want to suspend access for "${selectedTenant?.name}"? All services for this site will be halted immediately.`
                            : `Reactivate access for "${selectedTenant?.name}"? Services will be restored immediately.`
                    }
                    variant={actionType === 'suspend' ? 'danger' : 'primary'}
                />

                <ConfirmationDialog
                    isOpen={seedDialogOpen}
                    onCancel={() => setSeedDialogOpen(false)}
                    onConfirm={confirmSeed}
                    title="Reset Site Data"
                    description={`WARNING: This will reset all data for "${seedTarget?.name}" (${seedTarget?.id}). This cannot be undone.`}
                    variant="danger"
                />

                <ConfirmationDialog
                    isOpen={removeMemberDialogOpen}
                    onCancel={() => { setRemoveMemberDialogOpen(false); setRemoveMemberTarget(null); }}
                    onConfirm={confirmRemoveMember}
                    title="Remove Member"
                    description="Are you sure you want to remove this member from the team?"
                    variant="danger"
                />

                {/* UPDATE URL DIALOG */}
                {updateUrlDialogOpen && selectedTenant && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <div className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
                                        <Pencil className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-brand-dark">Update URL</h3>
                                        <p className="text-xs text-gray-400">{selectedTenant.name}</p>
                                    </div>
                                </div>
                                <button onClick={() => setUpdateUrlDialogOpen(false)} className="text-gray-400 hover:text-gray-600">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                            <form onSubmit={handleUpdateUrl} className="p-6 space-y-5">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">New Slug / URL</label>
                                    <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                                        <span className="text-gray-400 text-sm font-medium shrink-0">clickerapps.web.app/</span>
                                        <input
                                            type="text"
                                            required
                                            value={newSlug}
                                            onChange={e => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                                            className="flex-1 bg-transparent outline-none font-bold text-sm text-brand-dark"
                                            placeholder="my-tenant-slug"
                                        />
                                    </div>
                                    <p className="text-[11px] text-gray-400">Only lowercase letters, numbers, and hyphens allowed.</p>
                                </div>
                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700 font-medium">
                                    Changing the slug will break existing links. The Site ID stays the same.
                                </div>
                                <div className="flex gap-3 pt-1">
                                    <button
                                        type="button"
                                        onClick={() => setUpdateUrlDialogOpen(false)}
                                        className="flex-1 py-2.5 rounded-lg text-sm font-bold text-gray-500 hover:bg-gray-100 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={updateUrlLoading}
                                        className="flex-1 py-2.5 rounded-lg text-sm font-bold text-white bg-brand-dark hover:bg-gray-800 shadow-md flex items-center justify-center gap-2 disabled:opacity-70"
                                    >
                                        {updateUrlLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update URL'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* HARD DELETE DIALOG */}
                {deleteDialogOpen && selectedTenant && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <div className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="p-5 border-b border-red-100 bg-red-50/50 flex items-center gap-3">
                                <div className="w-10 h-10 bg-red-100 text-red-600 rounded-lg flex items-center justify-center shrink-0">
                                    <Trash2 className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-red-700">Hard Delete Tenant</h3>
                                    <p className="text-xs text-red-400">This action is permanent and cannot be undone.</p>
                                </div>
                            </div>
                            <div className="p-6 space-y-5">
                                <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-1 text-sm text-red-700">
                                    <p className="font-bold">The following will be permanently deleted:</p>
                                    <ul className="list-disc list-inside space-y-0.5 text-red-600 font-medium">
                                        <li>All Firestore data under <code className="bg-red-100 px-1 rounded">sites/{selectedTenant.id}</code></li>
                                        <li>All Firebase Auth accounts for this site</li>
                                        <li>Site document and all associated records</li>
                                    </ul>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">
                                        Type <span className="font-mono text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-200">{selectedTenant.id}</span> to confirm
                                    </label>
                                    <input
                                        type="text"
                                        value={deleteConfirmText}
                                        onChange={e => setDeleteConfirmText(e.target.value)}
                                        className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-red-400 outline-none font-mono text-sm text-brand-dark transition-colors"
                                        placeholder={selectedTenant.id}
                                        autoComplete="off"
                                    />
                                </div>
                                <div className="flex gap-3 pt-1">
                                    <button
                                        type="button"
                                        onClick={() => { setDeleteDialogOpen(false); setDeleteConfirmText(''); }}
                                        className="flex-1 py-2.5 rounded-lg text-sm font-bold text-gray-500 hover:bg-gray-100 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleHardDelete}
                                        disabled={deleteLoading || deleteConfirmText !== selectedTenant.id}
                                        className="flex-1 py-2.5 rounded-lg text-sm font-bold text-white bg-red-600 hover:bg-red-700 shadow-md flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                    >
                                        {deleteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Trash2 className="w-4 h-4" /> Obliterate</>}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* TEAM MANAGEMENT DIALOG */}
                {teamDialogOpen && selectedTenant && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
                        <div className="bg-white rounded-2xl border-[3px] border-brand-dark shadow-2xl w-full max-w-5xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
                            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                                <h3 className="font-bold text-lg text-brand-dark flex items-center gap-2">
                                    <Users className="w-5 h-5 text-indigo-600" />
                                    Manage Team: <span className="text-gray-500">{selectedTenant.name}</span>
                                </h3>
                                <button onClick={() => setTeamDialogOpen(false)} className="text-gray-400 hover:text-gray-600">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-12 flex-1 overflow-hidden min-h-0">
                                {/* LEFT: MEMBER LIST */}
                                <div className="p-0 flex flex-col border-r border-gray-100 overflow-hidden bg-gray-50/30 md:col-span-4">
                                    <div className="p-3 border-b border-gray-100 font-bold text-xs text-gray-500 uppercase">
                                        Current Members ({teamMembers.length})
                                    </div>
                                    <div className="overflow-y-auto h-[480px] p-3 space-y-2">
                                        {teamLoading ? (
                                            <div className="text-center py-8 text-gray-400 text-sm flex flex-col items-center">
                                                <Loader2 className="w-6 h-6 animate-spin mb-2" />
                                                Loading crew...
                                            </div>
                                        ) : teamMembers.length === 0 ? (
                                            <div className="text-center py-8 text-gray-400 text-sm">
                                                No members found for this site.
                                            </div>
                                        ) : (
                                            teamMembers.map(m => (
                                                <div
                                                    key={m.uid}
                                                    onClick={() => {
                                                        setNewMemberEmail(m.email || '');
                                                        setNewMemberName(m.displayName || '');
                                                        setNewMemberRole(m.customClaims?.role || 'staff');
                                                        setPermissions(m.permissions || []);
                                                        setModuleAccess(m.moduleAccess || {});
                                                        // Prevent password edit for now or handle it separately if needed
                                                        setNewMemberPassword('');
                                                    }}
                                                    className={`p-4 rounded-lg border-[2px] transition-all flex items-center justify-between group cursor-pointer ${newMemberEmail === m.email
                                                        ? 'bg-white border-brand-dark shadow-lg -translate-y-0.5'
                                                        : 'bg-white border-gray-100 hover:border-gray-300 hover:bg-gray-50/50'
                                                        }`}
                                                >
                                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-black text-sm shrink-0 border-2 ${newMemberEmail === m.email ? 'bg-brand-dark text-white border-brand-dark' : 'bg-gray-100 text-gray-400 border-gray-200'}`}>
                                                            {(m.displayName || m.email || '?').charAt(0).toUpperCase()}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="font-black text-sm text-brand-dark truncate leading-tight">{m.displayName || 'No Name'}</div>
                                                            <div className="text-[11px] text-gray-400 font-medium truncate">{m.email}</div>
                                                            <div className="mt-1.5 flex gap-1">
                                                                {m.customClaims?.role === 'owner' ? (
                                                                    <span className="text-[9px] font-black uppercase bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded-lg">
                                                                        Owner
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-[9px] font-black uppercase bg-gray-50 text-gray-500 border border-gray-200 px-2 py-0.5 rounded-lg">
                                                                        {m.customClaims?.role || 'Staff'}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleRemoveMember(m.uid);
                                                        }}
                                                        className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all"
                                                        title="Remove from Team"
                                                    >
                                                        <UserX className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>

                                {/* Right: Add Member Form */}
                                <div className="md:col-span-8 flex flex-col h-full bg-white min-h-0">
                                    <div className="p-4 border-b border-gray-100 bg-gray-50/30 flex justify-between items-center shrink-0">
                                        <div>
                                            <h3 className="font-bold text-gray-500 text-xs uppercase tracking-wider">
                                                {teamMembers.some(m => m.email === newMemberEmail) ? 'Edit Member Access' : 'Add New Member'}
                                            </h3>
                                            <p className="text-[10px] text-gray-400">Configure identity and permissions</p>
                                        </div>
                                        {newMemberEmail && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setNewMemberEmail('');
                                                    setNewMemberName('');
                                                    setNewMemberPassword('');
                                                    setPermissions([]);
                                                    setModuleAccess({});
                                                }}
                                                className="text-[10px] font-black text-brand-dark hover:opacity-70 uppercase bg-white border border-gray-200 px-2.5 py-1.5 rounded-lg active:scale-95 transition-all"
                                            >
                                                + New Member
                                            </button>
                                        )}
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-6 h-[480px]">
                                        <form onSubmit={handleAddMember} className="space-y-5">
                                            <div className="space-y-4">
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Email Address</label>
                                                        <input
                                                            type="email"
                                                            required
                                                            value={newMemberEmail}
                                                            onChange={e => setNewMemberEmail(e.target.value)}
                                                            className="w-full px-4 py-3 rounded-lg border-[3px] border-gray-100 focus:border-brand-dark outline-none font-bold text-sm bg-gray-50/30 transition-all placeholder:text-gray-300"
                                                            placeholder="staff@cafe.com"
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Display Name</label>
                                                        <input
                                                            type="text"
                                                            required
                                                            value={newMemberName}
                                                            onChange={e => setNewMemberName(e.target.value)}
                                                            className="w-full px-4 py-3 rounded-lg border-[3px] border-gray-100 focus:border-brand-dark outline-none font-bold text-sm bg-gray-50/30 transition-all placeholder:text-gray-300"
                                                            placeholder="Jane Doe"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Password</label>
                                                        <input
                                                            type="password"
                                                            required
                                                            value={newMemberPassword}
                                                            onChange={e => setNewMemberPassword(e.target.value)}
                                                            className="w-full px-4 py-3 rounded-lg border-[3px] border-gray-100 focus:border-brand-dark outline-none font-bold text-sm bg-gray-50/30 transition-all placeholder:text-gray-300"
                                                            placeholder="••••••••"
                                                            minLength={6}
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Role</label>
                                                        <select
                                                            value={newMemberRole}
                                                            onChange={e => setNewMemberRole(e.target.value)}
                                                            className="w-full px-4 py-3 rounded-lg border-[3px] border-gray-100 focus:border-brand-dark outline-none font-bold text-sm bg-gray-50/30 transition-all appearance-none cursor-pointer"
                                                        >
                                                            <option value="staff">Staff Member</option>
                                                            <option value="owner">Admin Owner</option>
                                                        </select>
                                                    </div>
                                                </div>

                                                {newMemberRole === 'staff' && (
                                                    <div className="space-y-2 pt-2 border-t border-gray-100">
                                                        <label className="text-xs font-bold text-gray-500 uppercase">
                                                            Access Permissions
                                                        </label>
                                                        <div className="bg-gray-50/50 rounded-lg border border-gray-200 p-2">
                                                            <PermissionEditor
                                                                value={{ permissions, moduleAccess }}
                                                                onChange={(val: any) => {
                                                                    setPermissions(val.permissions);
                                                                    setModuleAccess(val.moduleAccess);
                                                                }}
                                                                siteModules={selectedTenant.modules || {}}
                                                            />
                                                        </div>
                                                    </div>
                                                )}


                                                <button
                                                    type="submit"
                                                    disabled={actionLoading}
                                                    className="w-full py-2.5 bg-brand-dark text-white rounded-lg font-bold hover:bg-gray-800 transition-all shadow-md mt-2 flex items-center justify-center gap-2"
                                                >
                                                    {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (teamMembers.some(m => m.email === newMemberEmail) ? 'Update Member' : 'Add to Team')}
                                                </button>

                                                <p className="text-[10px] text-gray-400 leading-tight">
                                                    Creating a new identity and binding it to <strong>{selectedTenant.name} ({selectedTenant.id})</strong>.
                                                </p>
                                            </div>
                                        </form>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
