'use client';

import { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { collection, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { functions, db } from '@/lib/firebase';
import { toast } from 'sonner';
import { UserX, UserPlus, Loader2, Settings, X, Save } from 'lucide-react';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { SYSTEM_MODULES } from '@/lib/modules/definitions';

interface Member {
    uid: string;
    displayName?: string;
    email?: string;
    role?: string;
    permissions?: string[];
    moduleAccess?: Record<string, Record<string, string>>;
}

interface Props {
    siteId: string;
    siteModules: Record<string, boolean>;
}

export default function TenantMembersCard({ siteId, siteModules }: Props) {
    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);

    // Add member form
    const [showAdd, setShowAdd] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [role, setRole] = useState('staff');
    const [adding, setAdding] = useState(false);

    // Remove
    const [removeUid, setRemoveUid] = useState<string | null>(null);
    const [removeOpen, setRemoveOpen] = useState(false);

    // Permissions modal
    const [permTarget, setPermTarget] = useState<Member | null>(null);
    const [checkedModules, setCheckedModules] = useState<Set<string>>(new Set());
    const [savingPerm, setSavingPerm] = useState(false);

    const activeModules = SYSTEM_MODULES.filter(m => siteModules?.[m.id]);

    const getModuleDisplay = (permissions: string[] = []) => {
        const names = permissions
            .map(id => activeModules.find(m => m.id === id)?.displayName || id)
            .filter(Boolean);
        if (names.length === 0) return null;
        if (names.length <= 3) return names.join(', ');
        return `${names.slice(0, 3).join(', ')} (+${names.length - 3} more)`;
    };

    useEffect(() => {
        if (!siteId) return;
        setLoading(true);
        const unsub = onSnapshot(
            collection(db, 'sites', siteId, 'members'),
            snap => {
                setMembers(snap.docs.map(d => ({ uid: d.id, ...(d.data() as Omit<Member, 'uid'>) })));
                setLoading(false);
            },
            () => setLoading(false)
        );
        return unsub;
    }, [siteId]);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        setAdding(true);
        try {
            const fn = httpsCallable<unknown, { userId?: string }>(functions, 'createUser');
            const result = await fn({
                email,
                password: password || undefined,
                displayName: name,
                role,
                siteId,
            });
            toast.success('Member added', {
                description: role === 'owner' ? 'Owner has full access automatically' : 'Set custom permissions next',
            });

            const newUid = result.data?.userId;
            const addedRole = role;
            const addedEmail = email;
            const addedName = name;

            setEmail(''); setPassword(''); setName(''); setRole('staff');
            setShowAdd(false);

            // Auto-open permissions modal for non-owner roles
            if (newUid && addedRole !== 'owner') {
                setPermTarget({ uid: newUid, email: addedEmail, displayName: addedName, role: addedRole });
                setCheckedModules(new Set());
            }
        } catch (err: unknown) {
            toast.error('Add failed', { description: err instanceof Error ? err.message : String(err) });
        } finally {
            setAdding(false);
        }
    };

    const handleRemove = async () => {
        if (!removeUid) return;
        try {
            const fn = httpsCallable(functions, 'removeUserFromSite');
            await fn({ uid: removeUid, siteId });
            toast.success('Member removed');
        } catch (err: unknown) {
            toast.error('Remove failed', { description: err instanceof Error ? err.message : String(err) });
        } finally {
            setRemoveOpen(false);
            setRemoveUid(null);
        }
    };

    const openPermissions = (member: Member) => {
        setPermTarget(member);
        const initial = new Set<string>(
            (member.permissions || []).filter(id => siteModules?.[id])
        );
        Object.entries(member.moduleAccess || {}).forEach(([moduleId, access]) => {
            if (siteModules?.[moduleId] && Object.values(access).some(v => v === 'full' || v === 'view')) {
                initial.add(moduleId);
            }
        });
        setCheckedModules(initial);
    };

    const handleSavePermissions = async () => {
        if (!permTarget) return;
        setSavingPerm(true);
        try {
            await setDoc(
                doc(db, 'sites', siteId, 'members', permTarget.uid),
                {
                    permissions: [...checkedModules],
                    moduleAccess: {},
                },
                { merge: true }
            );
            toast.success('Permissions saved');
            setPermTarget(null);
        } catch (err: unknown) {
            toast.error('Save failed', { description: err instanceof Error ? err.message : String(err) });
        } finally {
            setSavingPerm(false);
        }
    };

    const roleColor = (r?: string) => {
        if (r === 'owner') return 'bg-brand-dark text-white border-brand-dark';
        return 'bg-gray-100 text-gray-600 border-gray-200';
    };

    return (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 col-span-2">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-black uppercase tracking-wider text-gray-400">Members ({members.length})</h2>
                <button
                    onClick={() => setShowAdd(!showAdd)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-dark text-white text-xs font-black rounded-lg hover:opacity-90"
                >
                    <UserPlus className="w-3.5 h-3.5" /> {showAdd ? 'Cancel' : 'Add Member'}
                </button>
            </div>

            {showAdd && (
                <form onSubmit={handleAdd} className="grid grid-cols-2 gap-3 mb-4 p-4 bg-slate-50 rounded-xl">
                    <input required value={name} onChange={e => setName(e.target.value)}
                        className="px-3 py-2 border-2 border-gray-200 rounded-lg text-sm font-medium outline-none focus:border-brand-dark bg-white"
                        placeholder="Display Name" />
                    <input required type="email" value={email} onChange={e => setEmail(e.target.value)}
                        className="px-3 py-2 border-2 border-gray-200 rounded-lg text-sm font-medium outline-none focus:border-brand-dark bg-white"
                        placeholder="Email" />
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                        className="px-3 py-2 border-2 border-gray-200 rounded-lg text-sm font-medium outline-none focus:border-brand-dark bg-white"
                        placeholder="Password (optional if user exists)" />
                    <select value={role} onChange={e => setRole(e.target.value)}
                        className="px-3 py-2 border-2 border-gray-200 rounded-lg text-sm font-medium outline-none focus:border-brand-dark bg-white">
                        <option value="owner">Owner</option>
                        <option value="staff">Staff</option>
                    </select>
                    <div className="col-span-2 flex justify-end">
                        <button type="submit" disabled={adding}
                            className="flex items-center gap-2 px-4 py-2 bg-brand-dark text-white text-sm font-black rounded-lg hover:opacity-90 disabled:opacity-50">
                            {adding && <Loader2 className="w-4 h-4 animate-spin" />}
                            Add
                        </button>
                    </div>
                </form>
            )}

            {loading ? (
                <div className="text-center py-8 text-gray-400 text-sm">Loading members...</div>
            ) : members.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">No members yet. Add one above.</div>
            ) : (
                <table className="w-full text-sm">
                    <thead className="border-b border-gray-100 bg-slate-50">
                        <tr>
                            <th className="text-left px-4 py-2 text-xs font-black text-brand-dark uppercase tracking-wider">Member</th>
                            <th className="text-left px-4 py-2 text-xs font-black text-brand-dark uppercase tracking-wider">Role</th>
                            <th className="text-left px-4 py-2 text-xs font-black text-brand-dark uppercase tracking-wider">Modules</th>
                            <th className="px-4 py-2" />
                        </tr>
                    </thead>
                    <tbody>
                        {members.map(m => {
                            return (
                                <tr key={m.uid} className="border-b border-gray-50 hover:bg-slate-50/50">
                                    <td className="px-4 py-2.5">
                                        <div className="font-semibold text-gray-800">{m.displayName || 'No Name'}</div>
                                        <div className="text-xs text-gray-400">{m.email}</div>
                                    </td>
                                    <td className="px-4 py-2.5">
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${roleColor(m.role)}`}>
                                            {m.role || 'staff'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-2.5 text-xs text-gray-500">
                                        {m.role === 'owner' ? (
                                            <span className="font-semibold text-brand-dark">Full access</span>
                                        ) : getModuleDisplay(m.permissions) ? (
                                            <span className="text-gray-600">{getModuleDisplay(m.permissions)}</span>
                                        ) : (
                                            <span className="text-gray-300">No access</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-2.5 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => openPermissions(m)}
                                                className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 hover:border-brand-dark rounded-lg text-xs font-bold text-gray-600 transition-colors"
                                                title="Manage permissions"
                                            >
                                                <Settings className="w-3.5 h-3.5" /> Permissions
                                            </button>
                                            <button
                                                onClick={() => { setRemoveUid(m.uid); setRemoveOpen(true); }}
                                                className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:border-red-300 hover:text-red-500 transition-colors"
                                                title="Remove"
                                            >
                                                <UserX className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            )}

            <ConfirmationDialog
                isOpen={removeOpen}
                onCancel={() => { setRemoveOpen(false); setRemoveUid(null); }}
                onConfirm={handleRemove}
                title="Remove member?"
                description="This will remove the member's access to this tenant."
                variant="danger"
            />

            {/* Permissions modal */}
            {permTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
                        <div className="flex items-start justify-between p-6 border-b border-gray-100">
                            <div>
                                <h3 className="font-black text-brand-dark text-lg">Manage Permissions</h3>
                                <p className="text-sm text-gray-400 font-mono">{permTarget.email}</p>
                                <p className="text-xs text-gray-300 mt-0.5">Role: {permTarget.role || 'staff'}</p>
                            </div>
                            <button onClick={() => setPermTarget(null)} className="p-1 text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6">
                            {permTarget.role === 'owner' ? (
                                <div className="text-center py-8">
                                    <p className="text-sm font-semibold text-brand-dark mb-1">Owner has full access</p>
                                    <p className="text-xs text-gray-400">Owners always have access to all enabled modules.</p>
                                </div>
                            ) : activeModules.length === 0 ? (
                                <p className="text-center py-8 text-sm text-gray-400">No modules enabled for this tenant.</p>
                            ) : (
                                <div className="space-y-2">
                                    {activeModules.map(module => (
                                        <label key={module.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-brand-dark/20 hover:bg-gray-50 cursor-pointer transition-all">
                                            <input
                                                type="checkbox"
                                                className="w-4 h-4 accent-brand-dark"
                                                checked={checkedModules.has(module.id)}
                                                onChange={e => {
                                                    const next = new Set(checkedModules);
                                                    if (e.target.checked) next.add(module.id);
                                                    else next.delete(module.id);
                                                    setCheckedModules(next);
                                                }}
                                            />
                                            <div>
                                                <div className="text-sm font-bold text-gray-800">{module.displayName}</div>
                                                {module.description && (
                                                    <div className="text-xs text-gray-400">{module.description}</div>
                                                )}
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>
                        {permTarget.role !== 'owner' && (
                            <div className="flex justify-end gap-2 p-6 border-t border-gray-100">
                                <button onClick={() => setPermTarget(null)}
                                    className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-bold text-gray-600">Cancel</button>
                                <button onClick={handleSavePermissions} disabled={savingPerm}
                                    className="flex items-center gap-2 px-5 py-2 bg-brand-dark text-white text-sm font-black rounded-xl hover:opacity-90 disabled:opacity-50">
                                    {savingPerm ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    Save Permissions
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
