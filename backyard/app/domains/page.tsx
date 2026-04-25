'use client';

import { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { toast } from 'sonner';
import { Pencil, Check, X } from 'lucide-react';
import PageShell from '@/components/PageShell';

interface Tenant {
    id: string;
    name: string;
    slug: string;
}

export default function DomainsPage() {
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const fetch = async () => {
            try {
                const fn = httpsCallable(functions, 'getTenants');
                const res: any = await fn();
                setTenants(res.data.list ?? []);
            } catch {
                toast.error('Failed to load tenants');
            } finally {
                setLoading(false);
            }
        };
        fetch();
    }, []);

    const startEdit = (tenant: Tenant) => {
        setEditingId(tenant.id);
        setEditValue(tenant.slug);
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditValue('');
    };

    const saveSlug = async (tenant: Tenant) => {
        if (!editValue.trim() || editValue === tenant.slug) {
            cancelEdit();
            return;
        }
        setSaving(true);
        try {
            const fn = httpsCallable(functions, 'updateTenantSlug');
            await fn({ siteId: tenant.id, newSlug: editValue.trim() });
            setTenants(prev => prev.map(t =>
                t.id === tenant.id ? { ...t, slug: editValue.trim() } : t
            ));
            toast.success('Slug updated');
            cancelEdit();
        } catch (err: any) {
            toast.error('Update failed', { description: err.message });
        } finally {
            setSaving(false);
        }
    };

    return (
        <PageShell title="Slug & Domain" subtitle="Manage subdomain per tenant">
            {loading ? (
                <div className="text-center py-16 text-gray-400 font-medium">Loading...</div>
            ) : (
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-gray-100">
                                <th className="text-left px-5 py-3 font-black text-xs uppercase tracking-wider text-brand-dark">Tenant</th>
                                <th className="text-left px-5 py-3 font-black text-xs uppercase tracking-wider text-brand-dark">Slug</th>
                                <th className="text-left px-5 py-3 font-black text-xs uppercase tracking-wider text-brand-dark">URL</th>
                                <th className="px-5 py-3" />
                            </tr>
                        </thead>
                        <tbody>
                            {tenants.map(tenant => (
                                <tr key={tenant.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                                    <td className="px-5 py-3 font-black text-brand-dark">{tenant.name}</td>
                                    <td className="px-5 py-3">
                                        {editingId === tenant.id ? (
                                            <input
                                                autoFocus
                                                value={editValue}
                                                onChange={e => setEditValue(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                                                className="border-2 border-brand-dark rounded-lg px-2 py-1 text-sm font-mono w-40 outline-none"
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') saveSlug(tenant);
                                                    if (e.key === 'Escape') cancelEdit();
                                                }}
                                            />
                                        ) : (
                                            <span className="font-mono text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded text-xs">{tenant.slug}</span>
                                        )}
                                    </td>
                                    <td className="px-5 py-3 text-xs text-gray-400">
                                        {editingId === tenant.id
                                            ? `${editValue || tenant.slug}.clicker.id`
                                            : `${tenant.slug}.clicker.id`}
                                    </td>
                                    <td className="px-5 py-3 text-right">
                                        {editingId === tenant.id ? (
                                            <div className="flex items-center gap-2 justify-end">
                                                <button
                                                    onClick={() => saveSlug(tenant)}
                                                    disabled={saving}
                                                    className="flex items-center gap-1 px-3 py-1.5 bg-brand-dark text-white rounded-lg text-xs font-bold"
                                                >
                                                    <Check className="w-3 h-3" /> Save
                                                </button>
                                                <button
                                                    onClick={cancelEdit}
                                                    className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-bold text-gray-500"
                                                >
                                                    <X className="w-3 h-3" /> Cancel
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => startEdit(tenant)}
                                                className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 hover:border-brand-dark rounded-lg text-xs font-bold text-gray-600 transition-colors ml-auto"
                                            >
                                                <Pencil className="w-3 h-3" /> Edit
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {tenants.length === 0 && (
                        <div className="text-center py-12 text-gray-400 font-medium">No tenants found</div>
                    )}
                </div>
            )}
        </PageShell>
    );
}
