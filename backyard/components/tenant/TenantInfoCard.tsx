'use client';

import { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { toast } from 'sonner';
import { Check, X, Pencil, ExternalLink } from 'lucide-react';

interface Tenant {
    id: string;
    name: string;
    slug: string;
    ownerEmail: string;
    status: 'active' | 'suspended';
    modules: Record<string, boolean>;
}

interface Props {
    tenant: Tenant;
    onSlugUpdate: (newSlug: string) => void;
}

export default function TenantInfoCard({ tenant, onSlugUpdate }: Props) {
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState(tenant.slug || tenant.id);
    const [saving, setSaving] = useState(false);

    const save = async () => {
        if (!value.trim() || value === tenant.slug) {
            setEditing(false);
            return;
        }
        setSaving(true);
        try {
            const fn = httpsCallable(functions, 'updateTenantSlug');
            await fn({ siteId: tenant.id, newSlug: value.trim() });
            onSlugUpdate(value.trim());
            toast.success('Slug updated');
            setEditing(false);
        } catch (err: any) {
            toast.error('Update failed', { description: err.message });
        } finally {
            setSaving(false);
        }
    };

    return (
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
                    {editing ? (
                        <div className="flex items-center gap-2">
                            <input
                                autoFocus
                                value={value}
                                onChange={e => setValue(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                                onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
                                className="border-2 border-brand-dark rounded-lg px-2 py-1 text-sm font-mono w-40 outline-none"
                            />
                            <button onClick={save} disabled={saving} className="p-1.5 bg-brand-dark text-white rounded-lg">
                                <Check className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => { setEditing(false); setValue(tenant.slug); }}
                                className="p-1.5 border border-gray-200 rounded-lg text-gray-500">
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <span className="font-mono text-sm text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{tenant.slug || tenant.id}</span>
                            <button onClick={() => setEditing(true)} className="p-1 text-gray-400 hover:text-brand-dark transition-colors">
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
    );
}
