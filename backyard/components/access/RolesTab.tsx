'use client';

import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, Save } from 'lucide-react';

interface Role {
    id: string;
    label: string;
    description: string;
    builtIn?: boolean;
}

const DEFAULT_ROLES: Role[] = [
    { id: 'owner', label: 'Owner', description: 'Tenant owner with full access to their tenant', builtIn: true },
    { id: 'manager', label: 'Manager', description: 'Manage staff and most tenant features', builtIn: true },
    { id: 'staff', label: 'Staff', description: 'Daily operations access (limited write)', builtIn: true },
];

export default function RolesTab() {
    const [roles, setRoles] = useState<Role[]>(DEFAULT_ROLES);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);

    const [newId, setNewId] = useState('');
    const [newLabel, setNewLabel] = useState('');
    const [newDesc, setNewDesc] = useState('');

    useEffect(() => {
        const fetch = async () => {
            try {
                const ref = doc(db, 'platform_meta', 'rbac_config');
                const snap = await getDoc(ref);
                if (snap.exists()) {
                    const data = snap.data();
                    if (Array.isArray(data.roles)) {
                        const customRoles = data.roles.filter((r: Role) => !DEFAULT_ROLES.find(d => d.id === r.id));
                        setRoles([...DEFAULT_ROLES, ...customRoles]);
                    }
                }
            } catch { /* use defaults */ }
            finally { setLoading(false); }
        };
        fetch();
    }, []);

    const handleAdd = () => {
        const id = newId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
        if (!id || !newLabel.trim()) {
            toast.warning('ID and Label required');
            return;
        }
        if (roles.find(r => r.id === id)) {
            toast.error('Role ID already exists');
            return;
        }
        setRoles([...roles, { id, label: newLabel.trim(), description: newDesc.trim() }]);
        setNewId(''); setNewLabel(''); setNewDesc('');
        setDirty(true);
    };

    const handleRemove = (id: string) => {
        setRoles(roles.filter(r => r.id !== id));
        setDirty(true);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const customOnly = roles.filter(r => !r.builtIn);
            await setDoc(doc(db, 'platform_meta', 'rbac_config'), { roles: customOnly }, { merge: true });
            toast.success('Roles saved');
            setDirty(false);
        } catch (err: any) {
            toast.error('Save failed', { description: err.message });
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <div className="flex items-start justify-between mb-4">
                <p className="text-sm text-gray-500 font-medium max-w-xl">
                    Built-in roles cannot be removed. Add custom roles for special access patterns.
                </p>
                {dirty && (
                    <button onClick={handleSave} disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 bg-brand-dark text-white text-sm font-black rounded-xl hover:opacity-90 disabled:opacity-50">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save Changes
                    </button>
                )}
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-6">
                {loading ? (
                    <div className="text-center py-12 text-gray-400">Loading roles...</div>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="border-b border-gray-100 bg-slate-50">
                            <tr>
                                <th className="text-left px-5 py-3 text-xs font-black text-brand-dark uppercase tracking-wider">Role ID</th>
                                <th className="text-left px-5 py-3 text-xs font-black text-brand-dark uppercase tracking-wider">Label</th>
                                <th className="text-left px-5 py-3 text-xs font-black text-brand-dark uppercase tracking-wider">Description</th>
                                <th className="text-left px-5 py-3 text-xs font-black text-brand-dark uppercase tracking-wider">Type</th>
                                <th className="px-5 py-3" />
                            </tr>
                        </thead>
                        <tbody>
                            {roles.map(r => (
                                <tr key={r.id} className="border-b border-gray-50 hover:bg-slate-50/50">
                                    <td className="px-5 py-3 font-mono text-xs text-indigo-600">{r.id}</td>
                                    <td className="px-5 py-3 font-bold text-brand-dark">{r.label}</td>
                                    <td className="px-5 py-3 text-gray-500 text-xs">{r.description || '—'}</td>
                                    <td className="px-5 py-3">
                                        {r.builtIn ? (
                                            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-brand-dark text-white">Built-in</span>
                                        ) : (
                                            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100">Custom</span>
                                        )}
                                    </td>
                                    <td className="px-5 py-3 text-right">
                                        {!r.builtIn && (
                                            <button onClick={() => handleRemove(r.id)}
                                                className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:border-red-300 hover:text-red-500 transition-colors">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-6 max-w-2xl">
                <h2 className="text-xs font-black text-brand-dark uppercase tracking-wider mb-3">Add Custom Role</h2>
                <div className="grid grid-cols-3 gap-3">
                    <input value={newId} onChange={e => setNewId(e.target.value)}
                        className="px-3 py-2 border-2 border-gray-200 rounded-xl text-sm font-mono outline-none focus:border-brand-dark"
                        placeholder="role_id" />
                    <input value={newLabel} onChange={e => setNewLabel(e.target.value)}
                        className="px-3 py-2 border-2 border-gray-200 rounded-xl text-sm font-medium outline-none focus:border-brand-dark"
                        placeholder="Display Label" />
                    <input value={newDesc} onChange={e => setNewDesc(e.target.value)}
                        className="px-3 py-2 border-2 border-gray-200 rounded-xl text-sm font-medium outline-none focus:border-brand-dark"
                        placeholder="Description" />
                </div>
                <button onClick={handleAdd}
                    className="mt-3 flex items-center gap-2 px-4 py-2 bg-brand-dark text-white text-sm font-black rounded-xl hover:opacity-90">
                    <Plus className="w-4 h-4" /> Add Role
                </button>
            </div>
        </>
    );
}
