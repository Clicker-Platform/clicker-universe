'use client';

import { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { toast } from 'sonner';
import { SYSTEM_MODULES } from '@/lib/modules/definitions';

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
    onModulesUpdate: (modules: Record<string, boolean>) => void;
}

export default function TenantModulesCard({ tenant, onModulesUpdate }: Props) {
    const [updating, setUpdating] = useState<string | null>(null);

    const toggle = async (moduleId: string, current: boolean) => {
        if (updating === moduleId) return;
        const newModules = { ...tenant.modules, [moduleId]: !current };
        onModulesUpdate(newModules);
        setUpdating(moduleId);
        try {
            const fn = httpsCallable(functions, 'updateTenantModules');
            await fn({ siteId: tenant.id, modules: newModules });
            toast.success(`${moduleId} ${!current ? 'enabled' : 'disabled'}`);
        } catch (err: any) {
            onModulesUpdate({ ...tenant.modules, [moduleId]: current });
            toast.error('Update failed', { description: err.message });
        } finally {
            setUpdating(null);
        }
    };

    return (
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
                                onClick={() => toggle(mod.id, enabled)}
                                disabled={updating === mod.id}
                                className={`rounded-full transition-colors relative flex-shrink-0 ${
                                    enabled ? 'bg-brand-dark' : 'bg-gray-300'
                                } ${updating === mod.id ? 'opacity-50' : ''}`}
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
    );
}
