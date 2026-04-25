'use client';

import { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { collection, onSnapshot } from 'firebase/firestore';
import { functions, db } from '@/lib/firebase';
import { toast } from 'sonner';
import { UserX, UserPlus, Loader2 } from 'lucide-react';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';

interface Member {
    uid: string;
    displayName?: string;
    email?: string;
    role?: string;
}

interface Props {
    siteId: string;
}

export default function TenantMembersCard({ siteId }: Props) {
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

    useEffect(() => {
        if (!siteId) return;
        setLoading(true);
        const unsub = onSnapshot(
            collection(db, 'sites', siteId, 'members'),
            snap => {
                setMembers(snap.docs.map(d => ({ uid: d.id, ...(d.data() as any) })));
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
            const fn = httpsCallable(functions, 'createUser');
            await fn({
                email,
                password: password || undefined,
                displayName: name,
                role,
                siteId,
            });
            toast.success('Member added');
            setEmail(''); setPassword(''); setName(''); setRole('staff');
            setShowAdd(false);
        } catch (err: any) {
            toast.error('Add failed', { description: err.message });
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
        } catch (err: any) {
            toast.error('Remove failed', { description: err.message });
        } finally {
            setRemoveOpen(false);
            setRemoveUid(null);
        }
    };

    const roleColor = (r?: string) => {
        if (r === 'owner') return 'bg-brand-dark text-white border-brand-dark';
        if (r === 'manager') return 'bg-amber-50 text-amber-700 border-amber-100';
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
                        <option value="manager">Manager</option>
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
                            <th className="px-4 py-2" />
                        </tr>
                    </thead>
                    <tbody>
                        {members.map(m => (
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
                                <td className="px-4 py-2.5 text-right">
                                    <button
                                        onClick={() => { setRemoveUid(m.uid); setRemoveOpen(true); }}
                                        className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:border-red-300 hover:text-red-500 transition-colors"
                                        title="Remove"
                                    >
                                        <UserX className="w-4 h-4" />
                                    </button>
                                </td>
                            </tr>
                        ))}
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
        </div>
    );
}
