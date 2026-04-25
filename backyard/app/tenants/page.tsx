'use client';

import { useState, useEffect, useMemo } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { toast } from 'sonner';
import { Store, Loader2, Search, ExternalLink, PowerOff, Power, Trash2, ChevronRight } from 'lucide-react';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import PageShell from '@/components/PageShell';
import Link from 'next/link';

interface Tenant {
    id: string;
    name: string;
    slug: string;
    ownerEmail: string;
    status: 'active' | 'suspended';
    modules: Record<string, boolean>;
}

export default function TenantsPage() {
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    const [name, setName] = useState('');
    const [ownerEmail, setOwnerEmail] = useState('');
    const [password, setPassword] = useState('');
    const [subdomain, setSubdomain] = useState('');
    const [hostingId, setHostingId] = useState('quattro');
    const [seedSampleData, setSeedSampleData] = useState(true);
    const [createLoading, setCreateLoading] = useState(false);
    const [showCreate, setShowCreate] = useState(false);

    const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [actionType, setActionType] = useState<'suspend' | 'activate'>('suspend');
    const [actionLoading, setActionLoading] = useState(false);

    const filteredTenants = useMemo(() =>
        tenants.filter(t =>
            t.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.slug?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.ownerEmail?.toLowerCase().includes(searchQuery.toLowerCase())
        ), [tenants, searchQuery]);

    useEffect(() => { fetchTenants(); }, []);

    const fetchTenants = async () => {
        setLoading(true);
        try {
            const fn = httpsCallable(functions, 'getTenants');
            const res: any = await fn();
            const seen = new Set();
            const unique = (res.data.list ?? []).filter((t: any) => seen.has(t.id) ? false : seen.add(t.id));
            setTenants(unique);
        } catch (err: any) {
            toast.error('Failed to load tenants', { description: err.message });
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreateLoading(true);
        try {
            const fn = httpsCallable(functions, 'createTenant');
            await fn({ name, ownerEmail, password, subdomain, hostingId, modules: {}, seedSampleData });
            toast.success('Tenant created', { description: `${name} is ready.` });
            setName(''); setOwnerEmail(''); setPassword(''); setSubdomain('');
            setHostingId('quattro'); setSeedSampleData(true); setShowCreate(false);
            await fetchTenants();
        } catch (err: any) {
            toast.error('Create failed', { description: err.message });
        } finally {
            setCreateLoading(false);
        }
    };

    const openConfirm = (tenant: Tenant, type: 'suspend' | 'activate') => {
        setSelectedTenant(tenant);
        setActionType(type);
        setConfirmOpen(true);
    };

    const handleConfirm = async () => {
        if (!selectedTenant) return;
        setActionLoading(true);
        try {
            const fn = httpsCallable(functions, 'suspendTenant');
            await fn({ siteId: selectedTenant.id, status: actionType === 'suspend' ? 'suspended' : 'active' });
            setTenants(prev => prev.map(t =>
                t.id === selectedTenant.id ? { ...t, status: actionType === 'suspend' ? 'suspended' : 'active' } : t
            ));
            toast.success(`Tenant ${actionType === 'suspend' ? 'suspended' : 'activated'}`);
            setConfirmOpen(false);
        } catch (err: any) {
            toast.error('Action failed', { description: err.message });
        } finally {
            setActionLoading(false);
        }
    };

    const handleDelete = async (tenant: Tenant) => {
        const typed = window.prompt(`Type "${tenant.id}" to permanently delete ${tenant.name}.\n\nThis cannot be undone.`);
        if (typed !== tenant.id) {
            if (typed !== null) toast.error('Confirmation text did not match');
            return;
        }
        try {
            const fn = httpsCallable(functions, 'hardDeleteTenant');
            await fn({ siteId: tenant.id });
            setTenants(prev => prev.filter(t => t.id !== tenant.id));
            toast.success('Tenant deleted', { description: `${tenant.name} has been removed.` });
        } catch (err: any) {
            toast.error('Delete failed', { description: err.message });
        }
    };

    return (
        <PageShell
            title="Tenants"
            subtitle={`${tenants.length} tenants`}
            action={
                <button
                    onClick={() => setShowCreate(!showCreate)}
                    className="px-4 py-2 bg-brand-dark text-white text-sm font-black rounded-xl hover:opacity-90 transition-opacity"
                >
                    {showCreate ? 'Cancel' : '+ New Tenant'}
                </button>
            }
        >
            {showCreate && (
                <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
                    <h2 className="text-sm font-black text-brand-dark uppercase tracking-wider mb-4">New Tenant</h2>
                    <form onSubmit={handleCreate} className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Tenant Name</label>
                            <input required value={name} onChange={e => setName(e.target.value)}
                                className="w-full mt-1 px-3 py-2 border-2 border-gray-200 rounded-xl text-sm font-medium outline-none focus:border-brand-dark"
                                placeholder="Cafe Quattro" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Subdomain (ID)</label>
                            <input required value={subdomain} onChange={e => setSubdomain(e.target.value)}
                                className="w-full mt-1 px-3 py-2 border-2 border-gray-200 rounded-xl text-sm font-mono outline-none focus:border-brand-dark"
                                placeholder="cafe-quattro" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Owner Email</label>
                            <input required type="email" value={ownerEmail} onChange={e => setOwnerEmail(e.target.value)}
                                className="w-full mt-1 px-3 py-2 border-2 border-gray-200 rounded-xl text-sm font-medium outline-none focus:border-brand-dark"
                                placeholder="owner@cafe.com" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Owner Password</label>
                            <input required type="password" value={password} onChange={e => setPassword(e.target.value)}
                                className="w-full mt-1 px-3 py-2 border-2 border-gray-200 rounded-xl text-sm font-medium outline-none focus:border-brand-dark"
                                placeholder="••••••••" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Hosting</label>
                            <div className="flex gap-2 mt-1">
                                {['quattro', 'aletra'].map(h => (
                                    <button key={h} type="button" onClick={() => setHostingId(h)}
                                        className={`flex-1 py-2 rounded-xl text-xs font-black uppercase border-2 transition-all ${hostingId === h ? 'bg-brand-dark text-white border-brand-dark' : 'border-gray-200 text-gray-400'}`}>
                                        {h}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="flex items-end">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={seedSampleData} onChange={e => setSeedSampleData(e.target.checked)}
                                    className="w-4 h-4 accent-brand-dark" />
                                <span className="text-sm font-semibold text-gray-600">Seed sample data</span>
                            </label>
                        </div>
                        <div className="col-span-2 flex justify-end">
                            <button type="submit" disabled={createLoading}
                                className="flex items-center gap-2 px-6 py-2.5 bg-brand-dark text-white text-sm font-black rounded-xl hover:opacity-90 disabled:opacity-50">
                                {createLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                                {createLoading ? 'Creating...' : 'Create Tenant'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm font-medium outline-none focus:border-brand-dark bg-white"
                    placeholder="Search by name, slug, or email..." />
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-16 text-gray-400 gap-2">
                        <Loader2 className="w-5 h-5 animate-spin" /> Loading...
                    </div>
                ) : filteredTenants.length === 0 ? (
                    <div className="text-center py-16 text-gray-400">
                        <Store className="w-10 h-10 mx-auto mb-3 opacity-30" />
                        <p className="font-semibold">No tenants found</p>
                    </div>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="border-b border-gray-100 bg-slate-50">
                            <tr>
                                <th className="text-left px-5 py-3 text-xs font-black text-brand-dark uppercase tracking-wider">Tenant</th>
                                <th className="text-left px-5 py-3 text-xs font-black text-brand-dark uppercase tracking-wider">Owner</th>
                                <th className="text-left px-5 py-3 text-xs font-black text-brand-dark uppercase tracking-wider">Status</th>
                                <th className="px-5 py-3" />
                            </tr>
                        </thead>
                        <tbody>
                            {filteredTenants.map(tenant => (
                                <tr key={tenant.id} className="border-b border-gray-50 hover:bg-slate-50/50 transition-colors">
                                    <td className="px-5 py-4">
                                        <div className="font-black text-brand-dark">{tenant.name}</div>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="font-mono text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{tenant.slug || tenant.id}</span>
                                            <a href={`https://clickerapps.web.app/${tenant.slug || tenant.id}`}
                                                target="_blank" rel="noopener noreferrer"
                                                className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1">
                                                <ExternalLink className="w-3 h-3" />
                                            </a>
                                        </div>
                                    </td>
                                    <td className="px-5 py-4 text-gray-500 text-xs">{tenant.ownerEmail}</td>
                                    <td className="px-5 py-4">
                                        {tenant.status === 'active' ? (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-100">
                                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Active
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-100">
                                                <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> Suspended
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-5 py-4">
                                        <div className="flex items-center justify-end gap-2">
                                            <button onClick={() => openConfirm(tenant, tenant.status === 'active' ? 'suspend' : 'activate')}
                                                className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:border-amber-300 hover:text-amber-600 transition-colors"
                                                title={tenant.status === 'active' ? 'Suspend' : 'Activate'}>
                                                {tenant.status === 'active' ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                                            </button>
                                            <button onClick={() => handleDelete(tenant)}
                                                className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:border-red-300 hover:text-red-600 transition-colors"
                                                title="Delete">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                            <Link href={`/tenants/${tenant.id}`}
                                                className="flex items-center gap-1 px-3 py-1.5 bg-brand-dark text-white text-xs font-bold rounded-lg hover:opacity-90 transition-opacity">
                                                Manage <ChevronRight className="w-3 h-3" />
                                            </Link>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <ConfirmationDialog
                isOpen={confirmOpen}
                onCancel={() => setConfirmOpen(false)}
                onConfirm={handleConfirm}
                title={actionType === 'suspend' ? `Suspend ${selectedTenant?.name}?` : `Activate ${selectedTenant?.name}?`}
                description={actionType === 'suspend' ? 'All services will be halted immediately.' : 'Services will be restored immediately.'}
                variant={actionType === 'suspend' ? 'warning' : 'primary'}
                loading={actionLoading}
            />
        </PageShell>
    );
}
