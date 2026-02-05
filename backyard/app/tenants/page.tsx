'use client';

import { useState, useEffect, useMemo } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions, auth } from '@/lib/firebase';
import { toast } from 'sonner';
import { Store, Power, PowerOff, Loader2, RefreshCw, Database, ExternalLink, Grid } from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { ConfirmationDialog } from '../../components/ui/confirmation-dialog';
import Sidebar from '../../components/Sidebar';
import { SYSTEM_MODULES } from '@/lib/modules/definitions';

export default function TenantsPage() {
    const [tenants, setTenants] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Create Form State
    const [name, setName] = useState('');
    const [ownerEmail, setOwnerEmail] = useState('');
    const [password, setPassword] = useState('');
    const [subdomain, setSubdomain] = useState('');
    const [hostingId, setHostingId] = useState('quattro'); // Default to quattro
    // Initialize all modules as OFF - Backyard controls everything
    const initialModules = useMemo(() => {
        const init: Record<string, boolean> = {};
        SYSTEM_MODULES.forEach((mod: any) => init[mod.id] = false);
        return init;
    }, []);
    const [modules, setModules] = useState<Record<string, boolean>>(initialModules);
    const [seedSampleData, setSeedSampleData] = useState(true); // Default to on
    const [createLoading, setCreateLoading] = useState(false);

    // Action State
    const [selectedTenant, setSelectedTenant] = useState<any>(null);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [actionType, setActionType] = useState<'suspend' | 'activate'>('suspend');
    const [actionLoading, setActionLoading] = useState(false);

    // 1. Fetch Tenants (Classic Request-Response)
    const fetchTenants = async () => {
        setLoading(true);
        try {
            const getTenantsFn = httpsCallable(functions, 'getTenants');
            const result: any = await getTenantsFn();
            setTenants(result.data.list);
        } catch (error: any) {
            console.error("Fetch Tenants Error:", error);
            // Ignore trivial permission errors during initial load if auth isn't checking
            if (error.code !== 'permission-denied') {
                toast.error("Failed to fetch tenants", { description: error.message });
            }
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
            await createTenant({ name, ownerEmail, password, subdomain, hostingId, modules, seedSampleData });
            toast.success('Tenant Forged Successfully', {
                description: `Site ID: ${subdomain.toLowerCase().replace(/[^a-z0-9]/g, '-')}`
            });
            setName('');
            setOwnerEmail('');
            setPassword('');
            setSubdomain('');
            setSubdomain('');
            setHostingId('quattro');
            setModules(initialModules); // Reset to all OFF
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

    const handleSeed = async (tenant: any) => {
        if (!confirm(`WARNING: Reset data for "${tenant.name}" (${tenant.id})? This cannot be undone.`)) return;

        const toastId = toast.loading('Seeding data...', { description: `Target: ${tenant.name}` });

        try {
            const seedFn = httpsCallable(functions, 'seedSiteData');
            await seedFn({ siteId: tenant.id });
            toast.success('Seeding Complete', {
                id: toastId,
                description: `Data for ${tenant.name} has been reset.`
            });
        } catch (error: any) {
            console.error(error);
            toast.error('Seeding Failed', {
                id: toastId,
                description: error.message
            });
        }
    };

    // 4. Handle Module Management
    const [moduleDialogOpen, setModuleDialogOpen] = useState(false);
    const [managingModules, setManagingModules] = useState<any>(null);

    const openModuleDialog = (tenant: any) => {
        setSelectedTenant(tenant);
        const currentModules = tenant.modules || { pos: false, inventory: false, booking: false, membership: false };
        setManagingModules({ ...currentModules });
        setModuleDialogOpen(true);
    };

    const saveModules = async () => {
        if (!selectedTenant) return;
        setActionLoading(true);
        try {
            const updateModulesFn = httpsCallable(functions, 'updateTenantModules');
            await updateModulesFn({ siteId: selectedTenant.id, modules: managingModules });
            toast.success('Modules updated successfully');
            setModuleDialogOpen(false);
            fetchTenants();
        } catch (error: any) {
            toast.error('Failed to update modules', { description: error.message });
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
                        <Store className="w-8 h-8" />
                        TENANT GOVERNANCE
                    </h1>
                    <p className="text-gray-500 font-medium">Manage Multi-Tenant Sites</p>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* CREATE PANEL */}
                    <div className="bg-white rounded-3xl border-[3px] border-brand-dark shadow-[6px_6px_0px_0px_rgba(34,34,34,1)] overflow-hidden h-fit">
                        <div className="p-6 border-b-[3px] border-brand-dark bg-gray-50/50">
                            <h2 className="text-xl font-bold text-brand-dark">Forge New Tenant</h2>
                        </div>
                        <form onSubmit={handleCreate} className="p-6 space-y-5">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-brand-dark uppercase tracking-wider">Site Name</label>
                                <input
                                    type="text"
                                    required
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-brand-dark outline-none font-medium transition-colors"
                                    placeholder="Cafe Quattro"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-brand-dark uppercase tracking-wider">Target Application (Hosting ID)</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setHostingId('quattro')}
                                        className={`px-4 py-3 rounded-xl border-2 font-bold text-sm transition-all ${hostingId === 'quattro'
                                            ? 'border-brand-dark bg-brand-dark text-white shadow-md'
                                            : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                                            }`}
                                    >
                                        Quattro App
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setHostingId('aletra')}
                                        className={`px-4 py-3 rounded-xl border-2 font-bold text-sm transition-all ${hostingId === 'aletra'
                                            ? 'border-brand-dark bg-brand-dark text-white shadow-md'
                                            : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                                            }`}
                                    >
                                        Aletra App
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="text-xs font-bold text-brand-dark uppercase tracking-wider">Active Modules</label>
                                <div className="grid grid-cols-2 gap-3">
                                    {SYSTEM_MODULES.map((mod: any) => (
                                        <label key={mod.id} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${modules[mod.id]
                                            ? 'border-green-500 bg-green-50'
                                            : 'border-gray-200 hover:border-gray-300'
                                            }`}>
                                            <input
                                                type="checkbox"
                                                checked={modules[mod.id] || false}
                                                onChange={(e) => setModules({ ...modules, [mod.id]: e.target.checked })}
                                                className="w-5 h-5 rounded border-gray-300 text-green-600 focus:ring-green-500"
                                            />
                                            <div>
                                                <span className="font-bold text-sm text-gray-700">{mod.displayName}</span>
                                                <p className="text-xs text-gray-400">{mod.description}</p>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="flex items-center gap-3 p-3 rounded-xl border-2 border-gray-200 cursor-pointer hover:border-brand-dark transition-all">
                                    <input
                                        type="checkbox"
                                        checked={seedSampleData}
                                        onChange={(e) => setSeedSampleData(e.target.checked)}
                                        className="w-5 h-5 rounded border-gray-300 text-brand-dark focus:ring-brand-dark"
                                    />
                                    <div>
                                        <div className="font-bold text-sm text-brand-dark">Include Starter Data</div>
                                        <div className="text-xs text-gray-500">Auto-generate sample products, profile, and settings.</div>
                                    </div>
                                </label>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-brand-dark uppercase tracking-wider">Subdomain (ID)</label>
                                <input
                                    type="text"
                                    required
                                    value={subdomain}
                                    onChange={e => setSubdomain(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-brand-dark outline-none font-medium transition-colors"
                                    placeholder="cafe-quattro"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-brand-dark uppercase tracking-wider">Owner Email</label>
                                <input
                                    type="email"
                                    required
                                    value={ownerEmail}
                                    onChange={e => setOwnerEmail(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-brand-dark outline-none font-medium transition-colors"
                                    placeholder="owner@cafe.com"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-brand-dark uppercase tracking-wider">Owner Password</label>
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-brand-dark outline-none font-medium transition-colors"
                                    placeholder="••••••••"
                                    minLength={6}
                                />
                                <p className="text-[10px] text-gray-400 font-bold uppercase">Min 6 chars. Creates user if not exists.</p>
                            </div>
                            <button
                                type="submit"
                                disabled={createLoading}
                                className="w-full py-3 bg-brand-dark text-white rounded-xl font-bold hover:bg-gray-800 hover:-translate-y-0.5 transition-all disabled:opacity-50"
                            >
                                {createLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Create Tenant'}
                            </button>
                        </form>
                    </div>

                    {/* LIST PANEL */}
                    <div className="bg-white rounded-3xl border-[3px] border-brand-dark shadow-sm overflow-hidden flex flex-col min-h-[600px]">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-brand-dark">Active Tenants</h2>
                            <div className="bg-gray-100 px-3 py-1 rounded-full text-xs font-bold text-gray-600">
                                Total: {tenants.length}
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto p-0">
                            {loading ? (
                                <div className="p-12 text-center text-gray-400">Loading Tenants...</div>
                            ) : tenants.length === 0 ? (
                                <div className="p-12 text-center text-gray-400">No tenants forged yet.</div>
                            ) : (
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider">
                                        <tr>
                                            <th className="p-4 pl-6">Site Info</th>
                                            <th className="p-4">Owner</th>
                                            <th className="p-4">Status</th>
                                            <th className="p-4 text-right pr-6">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {tenants.map((tenant) => (
                                            <tr key={tenant.id} className="hover:bg-gray-50/50 transition-colors">
                                                <td className="p-4 pl-6">
                                                    <div className="font-bold text-brand-dark">{tenant.name}</div>
                                                    <div className="text-xs text-gray-400 font-mono mb-1">{tenant.id}</div>
                                                    <a
                                                        href={`https://clickerapps.web.app/${tenant.slug || tenant.id}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 bg-blue-50 w-fit px-2 py-0.5 rounded-md border border-blue-100 transition-colors"
                                                    >
                                                        <ExternalLink className="w-3 h-3" />
                                                        {tenant.slug || tenant.id}
                                                    </a>
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
                                                    <button
                                                        onClick={() => handleToggleStatus(tenant)}
                                                        className={`p-2 rounded-lg border-2 transition-all ${tenant.status === 'active'
                                                            ? 'border-red-100 text-red-600 hover:bg-red-50 hover:border-red-200'
                                                            : 'border-green-100 text-green-600 hover:bg-green-50 hover:border-green-200'
                                                            }`}
                                                        title={tenant.status === 'active' ? 'Suspend Tenant' : 'Activate Tenant'}
                                                    >
                                                        {tenant.status === 'active' ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                                                    </button>

                                                    <button
                                                        onClick={() => openModuleDialog(tenant)}
                                                        className="p-2 rounded-lg border-2 border-blue-100 text-blue-600 hover:bg-blue-50 hover:border-blue-200 transition-all ml-2"
                                                        title="Manage Modules"
                                                    >
                                                        <Grid className="w-4 h-4" />
                                                    </button>

                                                    <button
                                                        onClick={() => handleSeed(tenant)}
                                                        className="p-2 rounded-lg border-2 border-amber-100 text-amber-600 hover:bg-amber-50 hover:border-amber-200 transition-all ml-2"
                                                        title="Seed Demo Data"
                                                    >
                                                        <Database className="w-4 h-4" />
                                                    </button>
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

                {/* MODULE MANAGEMENT DIALOG */}
                {moduleDialogOpen && selectedTenant && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                                <h3 className="font-bold text-lg text-brand-dark flex items-center gap-2">
                                    <Grid className="w-5 h-5 text-blue-600" />
                                    Manage Modules
                                </h3>
                                {/* Simple Close Button */}
                                <button type="button" onClick={() => setModuleDialogOpen(false)} className="text-gray-400 hover:text-gray-600">
                                    <span className="sr-only">Close</span>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>

                            <div className="p-6 space-y-4">
                                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-800">
                                    Configuring modules for <strong>{selectedTenant.name}</strong>.
                                </div>

                                <div className="grid grid-cols-1 gap-3">
                                    {SYSTEM_MODULES.map((mod: any) => (
                                        <label key={mod.id} className={`flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-all ${managingModules[mod.id]
                                            ? 'border-blue-500 bg-blue-50/30'
                                            : 'border-gray-100 hover:border-gray-200'
                                            }`}>
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${managingModules[mod.id] ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'
                                                    }`}>
                                                    <span className="capitalize font-bold text-xs">{mod.id.slice(0, 2)}</span>
                                                </div>
                                                <div>
                                                    <span className="font-bold text-gray-700">{mod.displayName}</span>
                                                    <p className="text-xs text-gray-400">{mod.description}</p>
                                                </div>
                                            </div>

                                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${managingModules[mod.id] ? 'bg-blue-500 border-blue-500' : 'border-gray-300 bg-white'
                                                }`}>
                                                {managingModules[mod.id] && <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                                            </div>

                                            <input
                                                type="checkbox"
                                                className="hidden"
                                                checked={managingModules[mod.id] || false}
                                                onChange={(e) => setManagingModules({ ...managingModules, [mod.id]: e.target.checked })}
                                            />
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="p-5 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50">
                                <button
                                    onClick={() => setModuleDialogOpen(false)}
                                    className="px-4 py-2 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={saveModules}
                                    disabled={actionLoading}
                                    className="px-5 py-2 rounded-xl text-sm font-bold text-white bg-brand-dark hover:bg-gray-800 shadow-md flex items-center gap-2 disabled:opacity-70"
                                >
                                    {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
