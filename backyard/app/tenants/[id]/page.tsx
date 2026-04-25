'use client';

import { useState, useEffect, use } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { toast } from 'sonner';
import { SYSTEM_MODULES } from '@/lib/modules/definitions';
import PageShell from '@/components/PageShell';
import Link from 'next/link';
import { ArrowLeft, Check, X, Pencil, ExternalLink } from 'lucide-react';

interface Tenant {
    id: string;
    name: string;
    slug: string;
    ownerEmail: string;
    status: 'active' | 'suspended';
    modules: Record<string, boolean>;
}

export default function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [tenant, setTenant] = useState<Tenant | null>(null);
    const [loading, setLoading] = useState(true);
    const [updatingModule, setUpdatingModule] = useState<string | null>(null);

    const [editingSlug, setEditingSlug] = useState(false);
    const [slugValue, setSlugValue] = useState('');
    const [savingSlug, setSavingSlug] = useState(false);

    useEffect(() => {
        const fetch = async () => {
            try {
                const fn = httpsCallable(functions, 'getTenants');
                const res: any = await fn();
                const found = (res.data.list ?? []).find((t: any) => t.id === id);
                if (found) {
                    setTenant(found);
                    setSlugValue(found.slug || found.id);
                } else {
                    toast.error('Tenant not found');
                }
            } catch (err: any) {
                toast.error('Failed to load tenant', { description: err.message });
            } finally {
                setLoading(false);
            }
        };
        fetch();
    }, [id]);

    const handleToggleModule = async (moduleId: string, current: boolean) => {
        if (!tenant || updatingModule === moduleId) return;
        const newModules = { ...tenant.modules, [moduleId]: !current };
        setTenant(prev => prev ? { ...prev, modules: newModules } : prev);
        setUpdatingModule(moduleId);
        try {
            const fn = httpsCallable(functions, 'updateTenantModules');
            await fn({ siteId: tenant.id, modules: newModules });
            toast.success(`${moduleId} ${!current ? 'enabled' : 'disabled'}`);
        } catch (err: any) {
            setTenant(prev => prev ? { ...prev, modules: { ...prev.modules, [moduleId]: current } } : prev);
            toast.error('Update failed', { description: err.message });
        } finally {
            setUpdatingModule(null);
        }
    };

    const handleSaveSlug = async () => {
        if (!tenant || !slugValue.trim() || slugValue === tenant.slug) {
            setEditingSlug(false);
            return;
        }
        setSavingSlug(true);
        try {
            const fn = httpsCallable(functions, 'updateTenantSlug');
            await fn({ siteId: tenant.id, newSlug: slugValue.trim() });
            setTenant(prev => prev ? { ...prev, slug: slugValue.trim() } : prev);
            toast.success('Slug updated');
            setEditingSlug(false);
        } catch (err: any) {
            toast.error('Update failed', { description: err.message });
        } finally {
            setSavingSlug(false);
        }
    };

    if (loading) {
        return (
            <PageShell title="Loading...">
                <div className="text-center py-16 text-gray-400">Loading tenant...</div>
            </PageShell>
        );
    }

    if (!tenant) {
        return (
            <PageShell title="Not Found">
                <div className="text-center py-16 text-gray-400">Tenant not found.</div>
            </PageShell>
        );
    }

    return (
        <PageShell
            title={tenant.name}
            subtitle={`ID: ${tenant.id}`}
            action={
                <Link href="/tenants" className="flex items-center gap-1.5 text-sm font-bold text-gray-500 hover:text-brand-dark transition-colors">
                    <ArrowLeft className="w-4 h-4" /> Back to Tenants
                </Link>
            }
        >
            <div className="grid grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl border border-gray-200 p-6">
                    <h2 className="text-xs font-black uppercase tracking-wider text-gray-400 mb-4">Info</h2>
                    <div className="space-y-3">
                        <div>
                            <p className="text-xs text-gray-400 font-semibold mb-1">Owner</p>
                            <p className="text-sm font-semibold text-gray-700">{tenant.ownerEmail}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-400 font-semibold mb-1">Status</p>
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                                tenant.status === 'active'
                                    ? 'bg-green-50 text-green-700 border border-green-100'
                                    : 'bg-red-50 text-red-700 border border-red-100'
                            }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${tenant.status === 'active' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                                {tenant.status === 'active' ? 'Active' : 'Suspended'}
                            </span>
                        </div>
                        <div>
                            <p className="text-xs text-gray-400 font-semibold mb-1">Slug / URL</p>
                            {editingSlug ? (
                                <div className="flex items-center gap-2">
                                    <input
                                        autoFocus
                                        value={slugValue}
                                        onChange={e => setSlugValue(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                                        onKeyDown={e => { if (e.key === 'Enter') handleSaveSlug(); if (e.key === 'Escape') setEditingSlug(false); }}
                                        className="border-2 border-brand-dark rounded-lg px-2 py-1 text-sm font-mono w-40 outline-none"
                                    />
                                    <button onClick={handleSaveSlug} disabled={savingSlug}
                                        className="p-1.5 bg-brand-dark text-white rounded-lg">
                                        <Check className="w-3.5 h-3.5" />
                                    </button>
                                    <button onClick={() => { setEditingSlug(false); setSlugValue(tenant.slug); }}
                                        className="p-1.5 border border-gray-200 rounded-lg text-gray-500">
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <span className="font-mono text-sm text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{tenant.slug || tenant.id}</span>
                                    <button onClick={() => setEditingSlug(true)}
                                        className="p-1 text-gray-400 hover:text-brand-dark transition-colors">
                                        <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <a href={`https://clickerapps.web.app/${tenant.slug || tenant.id}`}
                                        target="_blank" rel="noopener noreferrer"
                                        className="p-1 text-gray-400 hover:text-blue-500 transition-colors">
                                        <ExternalLink className="w-3.5 h-3.5" />
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 p-6">
                    <h2 className="text-xs font-black uppercase tracking-wider text-gray-400 mb-4">Modules</h2>
                    <div className="space-y-2">
                        {SYSTEM_MODULES.map(mod => {
                            const enabled = tenant.modules?.[mod.id] ?? false;
                            return (
                                <div key={mod.id} className="flex items-center justify-between py-1.5">
                                    <div>
                                        <p className="text-sm font-semibold text-gray-700">{mod.displayName}</p>
                                        {mod.description && <p className="text-xs text-gray-400">{mod.description}</p>}
                                    </div>
                                    <button
                                        onClick={() => handleToggleModule(mod.id, enabled)}
                                        disabled={updatingModule === mod.id}
                                        className={`rounded-full transition-colors relative flex-shrink-0 ${
                                            enabled ? 'bg-brand-dark' : 'bg-gray-300'
                                        } ${updatingModule === mod.id ? 'opacity-50' : ''}`}
                                        style={{ height: '22px', width: '40px' }}
                                    >
                                        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
                                            enabled ? 'left-[20px]' : 'left-0.5'
                                        }`} />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </PageShell>
    );
}
