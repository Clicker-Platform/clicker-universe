# Backyard Tenant Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pecah Tenants page (938 baris, 7 fungsi) menjadi 3 file fokus: `/tenants` (list+create+lifecycle), `/tenants/[id]` (detail: module toggle + edit slug), dan pindahkan team management ke Users page.

**Architecture:** Tenants page lama di-replace total. Team management (add/remove member) dipindah ke Users page sebagai fitur tambahan. `/tenants/[id]` adalah Next.js dynamic route page — fetch data tenant by ID dari `getTenants` lalu filter. Module toggle dan edit slug hanya ada di detail page, tidak ada di list. Module Control dan Slug & Domain pages dihapus dari sidebar karena tidak diperlukan lagi.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, Firebase Functions callable, Firestore client SDK, Sonner toast, Lucide icons

**Worktree:** `/Users/mac/Documents/AI Project/clicker-platform/dev/.worktrees/dev-logging`

---

## File Map

| File | Action | Tanggung Jawab |
|------|--------|----------------|
| `backyard/app/tenants/page.tsx` | Replace total | List tenant + search + Create form + Suspend/Activate/Delete |
| `backyard/app/tenants/[id]/page.tsx` | Create baru | Detail 1 tenant: info, module toggles, edit slug |
| `backyard/app/users/page.tsx` | Modify — tambah team management | List Firebase Auth users + manage team per tenant |
| `backyard/app/modules/page.tsx` | Delete | Tidak diperlukan — module toggle ada di /tenants/[id] |
| `backyard/app/domains/page.tsx` | Delete | Tidak diperlukan — edit slug ada di /tenants/[id] |
| `backyard/components/Sidebar.tsx` | Modify — update nav items | Hapus Module Control + Slug & Domain dari nav |

---

## Task 1: Replace Tenants List Page

**File:** `backyard/app/tenants/page.tsx`

Replace seluruh isi file. Halaman baru ini hanya handle: list tenant, search, create form, suspend/activate, hard delete. Tidak ada team management, tidak ada module toggle, tidak ada edit slug.

- [ ] **Step 1: Baca state yang perlu dipertahankan**

```bash
grep -n "seedSampleData\|hostingId\|filteredTenants\|handleCreate\|handleSuspend\|handleHardDelete\|deleteConfirm\|actionType" "/Users/mac/Documents/AI Project/clicker-platform/dev/.worktrees/dev-logging/backyard/app/tenants/page.tsx" | head -20
```

- [ ] **Step 2: Replace seluruh isi `backyard/app/tenants/page.tsx`**

```tsx
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

    // Create form
    const [name, setName] = useState('');
    const [ownerEmail, setOwnerEmail] = useState('');
    const [password, setPassword] = useState('');
    const [subdomain, setSubdomain] = useState('');
    const [hostingId, setHostingId] = useState('quattro');
    const [seedSampleData, setSeedSampleData] = useState(true);
    const [createLoading, setCreateLoading] = useState(false);
    const [showCreate, setShowCreate] = useState(false);

    // Suspend/Delete
    const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [actionType, setActionType] = useState<'suspend' | 'activate' | 'delete'>('suspend');
    const [deleteConfirmText, setDeleteConfirmText] = useState('');
    const [actionLoading, setActionLoading] = useState(false);

    const filteredTenants = useMemo(() =>
        tenants.filter(t =>
            t.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.slug?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.ownerEmail?.toLowerCase().includes(searchQuery.toLowerCase())
        ), [tenants, searchQuery]);

    useEffect(() => {
        fetchTenants();
    }, []);

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

    const openConfirm = (tenant: Tenant, type: 'suspend' | 'activate' | 'delete') => {
        setSelectedTenant(tenant);
        setActionType(type);
        setDeleteConfirmText('');
        setConfirmOpen(true);
    };

    const handleConfirm = async () => {
        if (!selectedTenant) return;
        setActionLoading(true);
        try {
            if (actionType === 'delete') {
                if (deleteConfirmText !== selectedTenant.id) {
                    toast.error('Type the tenant ID to confirm deletion');
                    setActionLoading(false);
                    return;
                }
                const fn = httpsCallable(functions, 'hardDeleteTenant');
                await fn({ siteId: selectedTenant.id });
                setTenants(prev => prev.filter(t => t.id !== selectedTenant.id));
                toast.success('Tenant deleted');
            } else {
                const fn = httpsCallable(functions, 'suspendTenant');
                await fn({ siteId: selectedTenant.id, status: actionType === 'suspend' ? 'suspended' : 'active' });
                setTenants(prev => prev.map(t =>
                    t.id === selectedTenant.id ? { ...t, status: actionType === 'suspend' ? 'suspended' : 'active' } : t
                ));
                toast.success(`Tenant ${actionType === 'suspend' ? 'suspended' : 'activated'}`);
            }
            setConfirmOpen(false);
        } catch (err: any) {
            toast.error('Action failed', { description: err.message });
        } finally {
            setActionLoading(false);
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
            {/* Create Form */}
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

            {/* Search */}
            <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm font-medium outline-none focus:border-brand-dark bg-white"
                    placeholder="Search by name, slug, or email..." />
            </div>

            {/* List */}
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
                                            <button onClick={() => openConfirm(tenant, 'delete')}
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

            {/* Confirm Dialog */}
            <ConfirmationDialog
                isOpen={confirmOpen}
                onCancel={() => setConfirmOpen(false)}
                onConfirm={handleConfirm}
                title={
                    actionType === 'delete' ? `Delete ${selectedTenant?.name}?` :
                    actionType === 'suspend' ? `Suspend ${selectedTenant?.name}?` :
                    `Activate ${selectedTenant?.name}?`
                }
                description={
                    actionType === 'delete'
                        ? `This will permanently delete all data. Type "${selectedTenant?.id}" to confirm.`
                        : actionType === 'suspend'
                        ? 'All services will be halted immediately.'
                        : 'Services will be restored immediately.'
                }
            >
                {actionType === 'delete' && (
                    <input
                        value={deleteConfirmText}
                        onChange={e => setDeleteConfirmText(e.target.value)}
                        className="w-full mt-3 px-3 py-2 border-2 border-red-200 rounded-xl text-sm font-mono outline-none focus:border-red-400"
                        placeholder={selectedTenant?.id}
                    />
                )}
            </ConfirmationDialog>
        </PageShell>
    );
}
```

- [ ] **Step 3: Check ConfirmationDialog props**

```bash
grep -n "interface\|Props\|isOpen\|onCancel\|onConfirm\|children" "/Users/mac/Documents/AI Project/clicker-platform/dev/.worktrees/dev-logging/backyard/components/ui/confirmation-dialog.tsx" | head -15
```

Jika props berbeda (misal `open` bukan `isOpen`), sesuaikan di file above.

- [ ] **Step 4: TypeScript check**

```bash
cd "/Users/mac/Documents/AI Project/clicker-platform/dev/.worktrees/dev-logging/backyard"
npx tsc --noEmit 2>&1 | grep "tenants/page" | head -10
```

- [ ] **Step 5: Commit**

```bash
cd "/Users/mac/Documents/AI Project/clicker-platform/dev/.worktrees/dev-logging"
git add backyard/app/tenants/page.tsx
git commit -m "refactor(backyard): simplify Tenants page — list+create+lifecycle only, 938→~200 lines"
```

---

## Task 2: Buat Tenant Detail Page `/tenants/[id]`

**File:** `backyard/app/tenants/[id]/page.tsx` (CREATE)

Detail page untuk 1 tenant: fetch dari `getTenants` lalu filter by ID. Berisi: info dasar, edit slug inline, module toggles, link balik ke list.

- [ ] **Step 1: Buat direktori dan file**

```bash
mkdir -p "/Users/mac/Documents/AI Project/clicker-platform/dev/.worktrees/dev-logging/backyard/app/tenants/[id]"
```

- [ ] **Step 2: Buat `backyard/app/tenants/[id]/page.tsx`**

```tsx
'use client';

import { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { toast } from 'sonner';
import { SYSTEM_MODULES } from '@/lib/modules/definitions';
import PageShell from '@/components/PageShell';
import Link from 'next/link';
import { ArrowLeft, Check, X, Pencil, ExternalLink } from 'lucide-react';
import { use } from 'react';

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

    // Slug edit
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
                {/* Info Card */}
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

                {/* Modules Card */}
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
                                        className={`w-10 h-5.5 rounded-full transition-colors relative flex-shrink-0 ${
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
```

- [ ] **Step 3: TypeScript check**

```bash
cd "/Users/mac/Documents/AI Project/clicker-platform/dev/.worktrees/dev-logging/backyard"
npx tsc --noEmit 2>&1 | grep "tenants/\[id\]" | head -10
```

- [ ] **Step 4: Commit**

```bash
cd "/Users/mac/Documents/AI Project/clicker-platform/dev/.worktrees/dev-logging"
git add "backyard/app/tenants/[id]/page.tsx"
git commit -m "feat(backyard): add tenant detail page with module toggles and slug edit"
```

---

## Task 3: Pindahkan Team Management ke Users Page

**File:** `backyard/app/users/page.tsx` (MODIFY)

Tambahkan section "Manage Team" di Users page — dropdown pilih tenant, lalu tampilkan members. Gunakan logic yang sudah ada di tenants page (onSnapshot members collection, handleAddMember, handleRemoveMember).

- [ ] **Step 1: Baca Users page saat ini**

```bash
wc -l "/Users/mac/Documents/AI Project/clicker-platform/dev/.worktrees/dev-logging/backyard/app/users/page.tsx"
grep -n "import\|useState\|useEffect\|return\|Sidebar" "/Users/mac/Documents/AI Project/clicker-platform/dev/.worktrees/dev-logging/backyard/app/users/page.tsx" | head -20
```

- [ ] **Step 2: Baca team management logic di tenants page lama**

```bash
sed -n '229,340p' "/Users/mac/Documents/AI Project/clicker-platform/dev/.worktrees/dev-logging/backyard/app/tenants/page.tsx"
```

- [ ] **Step 3: Update `backyard/app/users/page.tsx`**

Tambahkan imports berikut di bagian atas (setelah imports yang sudah ada):
```tsx
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import PageShell from '@/components/PageShell';
```

Tambahkan state berikut di dalam komponen (setelah state yang sudah ada):
```tsx
// Team Management
const [tenants, setTenants] = useState<any[]>([]);
const [selectedTenantId, setSelectedTenantId] = useState('');
const [teamMembers, setTeamMembers] = useState<any[]>([]);
const [teamLoading, setTeamLoading] = useState(false);
const [removeMemberUid, setRemoveMemberUid] = useState<string | null>(null);
const [removeMemberConfirm, setRemoveMemberConfirm] = useState(false);
```

Tambahkan useEffect untuk fetch tenants (setelah useEffect yang sudah ada):
```tsx
useEffect(() => {
    const fetch = async () => {
        try {
            const fn = httpsCallable(functions, 'getTenants');
            const res: any = await fn();
            const list = res.data.list ?? [];
            setTenants(list);
            if (list.length > 0) setSelectedTenantId(list[0].id);
        } catch { /* non-critical */ }
    };
    fetch();
}, []);
```

Tambahkan useEffect untuk fetch members (setelah useEffect tenants):
```tsx
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
```

Tambahkan handler remove member:
```tsx
const handleRemoveMember = async (uid: string) => {
    try {
        const fn = httpsCallable(functions, 'removeUserFromSite');
        await fn({ uid, siteId: selectedTenantId });
        toast.success('Member removed');
    } catch (err: any) {
        toast.error('Remove failed', { description: err.message });
    }
};
```

Di dalam return, ganti `<Sidebar />` boilerplate dengan `<PageShell>` dan tambahkan Team Management section di bawah user list yang sudah ada:

```tsx
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
    />
</div>
```

- [ ] **Step 4: Replace layout boilerplate dengan PageShell**

Cari di `users/page.tsx`:
```tsx
<div className="min-h-screen bg-gray-50/50 flex font-sans">
    <Sidebar />
    <div className="flex-1 ml-64 p-8">
```

Replace dengan:
```tsx
<PageShell title="Users" subtitle="Firebase Auth users">
```

Dan closing `</div></div>` di akhir ganti dengan `</PageShell>`.

Hapus `import Sidebar from '@/components/Sidebar';` karena PageShell sudah include Sidebar.

- [ ] **Step 5: TypeScript check**

```bash
cd "/Users/mac/Documents/AI Project/clicker-platform/dev/.worktrees/dev-logging/backyard"
npx tsc --noEmit 2>&1 | grep "users/page" | head -10
```

- [ ] **Step 6: Commit**

```bash
cd "/Users/mac/Documents/AI Project/clicker-platform/dev/.worktrees/dev-logging"
git add backyard/app/users/page.tsx
git commit -m "feat(backyard): move team management to Users page, use PageShell"
```

---

## Task 4: Hapus Module Control + Slug & Domain Pages, Update Sidebar

**Files:**
- Delete: `backyard/app/modules/page.tsx`
- Delete: `backyard/app/domains/page.tsx`
- Modify: `backyard/components/Sidebar.tsx`

- [ ] **Step 1: Hapus kedua pages**

```bash
rm "/Users/mac/Documents/AI Project/clicker-platform/dev/.worktrees/dev-logging/backyard/app/modules/page.tsx"
rmdir "/Users/mac/Documents/AI Project/clicker-platform/dev/.worktrees/dev-logging/backyard/app/modules" 2>/dev/null || true
rm "/Users/mac/Documents/AI Project/clicker-platform/dev/.worktrees/dev-logging/backyard/app/domains/page.tsx"
rmdir "/Users/mac/Documents/AI Project/clicker-platform/dev/.worktrees/dev-logging/backyard/app/domains" 2>/dev/null || true
```

- [ ] **Step 2: Update NAV_ITEMS di Sidebar.tsx**

Buka `backyard/components/Sidebar.tsx`. Ganti `NAV_ITEMS` array:

```tsx
const NAV_ITEMS: NavItem[] = [
    { label: 'Overview', href: '/' },
    { label: '—' as any, href: '' },
    { label: 'Tenants', href: '/tenants' },
    { label: '—' as any, href: '' },
    { label: 'Users', href: '/users' },
    { label: 'Claims & Roles', href: '/claims', isNew: true },
    { label: 'RBAC Settings', href: '/rbac', isNew: true },
    { label: '—' as any, href: '' },
    { label: 'Monitoring', href: '/monitoring' },
    { label: 'Sync Control', href: '/sync', isNew: true },
    { label: 'Seed Tools', href: '/seed', isNew: true },
    { label: '—' as any, href: '' },
    { label: 'WhatsApp', href: '/whatsapp', isNew: true },
    { label: 'Settings', href: '/settings' },
];
```

- [ ] **Step 3: TypeScript check**

```bash
cd "/Users/mac/Documents/AI Project/clicker-platform/dev/.worktrees/dev-logging/backyard"
npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -20
```

Expected: tidak ada error baru.

- [ ] **Step 4: Commit**

```bash
cd "/Users/mac/Documents/AI Project/clicker-platform/dev/.worktrees/dev-logging"
git rm backyard/app/modules/page.tsx backyard/app/domains/page.tsx
git add backyard/components/Sidebar.tsx
git commit -m "refactor(backyard): remove Module Control + Slug & Domain pages, update sidebar to 10 items"
```

---

## Task 5: Final Verification

- [ ] **Step 1: Verify file structure**

```bash
find "/Users/mac/Documents/AI Project/clicker-platform/dev/.worktrees/dev-logging/backyard/app" -name "page.tsx" | sort
```

Expected:
```
backyard/app/monitoring/page.tsx
backyard/app/seed/page.tsx
backyard/app/settings/page.tsx
backyard/app/sync/page.tsx  (jika sudah ada dari plan sebelumnya)
backyard/app/tenants/[id]/page.tsx
backyard/app/tenants/page.tsx
backyard/app/users/page.tsx
backyard/app/whatsapp/page.tsx (jika sudah ada)
backyard/app/page.tsx
```

- [ ] **Step 2: Verify modules dan domains page sudah dihapus**

```bash
ls "/Users/mac/Documents/AI Project/clicker-platform/dev/.worktrees/dev-logging/backyard/app/" | grep -E "modules|domains"
```

Expected: tidak ada output.

- [ ] **Step 3: Full TypeScript check**

```bash
cd "/Users/mac/Documents/AI Project/clicker-platform/dev/.worktrees/dev-logging/backyard"
npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -30
```

Expected: tidak ada error.

- [ ] **Step 4: Verify Sidebar 10 items**

```bash
grep -c "href:" "/Users/mac/Documents/AI Project/clicker-platform/dev/.worktrees/dev-logging/backyard/components/Sidebar.tsx"
```

Expected: `10` (Overview, Tenants, Users, Claims & Roles, RBAC Settings, Monitoring, Sync Control, Seed Tools, WhatsApp, Settings)

- [ ] **Step 5: Commit cleanup jika ada**

```bash
cd "/Users/mac/Documents/AI Project/clicker-platform/dev/.worktrees/dev-logging"
git status
git add -A && git commit -m "fix(backyard): tenant refactor final verification cleanup" 2>/dev/null || echo "Nothing to commit"
```
