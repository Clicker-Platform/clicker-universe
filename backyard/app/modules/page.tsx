'use client';

import { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { toast } from 'sonner';
import { SYSTEM_MODULES } from '@/lib/modules/definitions';
import PageShell from '@/components/PageShell';

interface Tenant {
    id: string;
    name: string;
    modules: Record<string, boolean>;
}

export default function ModulesPage() {
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState<string | null>(null);

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

    const handleToggle = async (tenant: Tenant, moduleId: string, current: boolean) => {
        const key = `${tenant.id}:${moduleId}`;
        if (updating === key) return;

        setTenants(prev => prev.map(t =>
            t.id === tenant.id
                ? { ...t, modules: { ...t.modules, [moduleId]: !current } }
                : t
        ));
        setUpdating(key);

        try {
            const fn = httpsCallable(functions, 'updateTenantModules');
            await fn({ siteId: tenant.id, modules: { ...tenant.modules, [moduleId]: !current } });
            toast.success(`${moduleId} ${!current ? 'enabled' : 'disabled'} for ${tenant.name}`);
        } catch (err: any) {
            setTenants(prev => prev.map(t =>
                t.id === tenant.id
                    ? { ...t, modules: { ...t.modules, [moduleId]: current } }
                    : t
            ));
            toast.error('Update failed', { description: err.message });
        } finally {
            setUpdating(null);
        }
    };

    return (
        <PageShell title="Module Control" subtitle="Toggle modules per tenant">
            {loading ? (
                <div className="text-center py-16 text-gray-400 font-medium">Loading tenants...</div>
            ) : (
                <div className="bg-white rounded-2xl border border-gray-100 overflow-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-gray-100">
                                <th className="text-left px-5 py-3 font-black text-brand-dark text-xs uppercase tracking-wider w-40">Tenant</th>
                                {SYSTEM_MODULES.map(mod => (
                                    <th key={mod.id} className="px-3 py-3 font-bold text-gray-400 text-xs uppercase tracking-wider text-center whitespace-nowrap">
                                        {mod.displayName}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {tenants.map(tenant => (
                                <tr key={tenant.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                                    <td className="px-5 py-3 font-black text-brand-dark">{tenant.name}</td>
                                    {SYSTEM_MODULES.map(mod => {
                                        const enabled = tenant.modules?.[mod.id] ?? false;
                                        const key = `${tenant.id}:${mod.id}`;
                                        return (
                                            <td key={mod.id} className="px-3 py-3 text-center">
                                                <button
                                                    onClick={() => handleToggle(tenant, mod.id, enabled)}
                                                    disabled={updating === key}
                                                    className={`w-9 h-5 rounded-full transition-colors relative ${
                                                        enabled ? 'bg-brand-green' : 'bg-gray-200'
                                                    } ${updating === key ? 'opacity-50' : ''}`}
                                                >
                                                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
                                                        enabled ? 'left-[18px]' : 'left-0.5'
                                                    }`} />
                                                </button>
                                            </td>
                                        );
                                    })}
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
