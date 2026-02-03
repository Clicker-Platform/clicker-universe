'use client';

import React, { useEffect, useState } from 'react';
import { collection, getDocs, query, limit, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Member } from '../types';
import { Loader2, Plus, Search, User, Settings, X } from 'lucide-react';
// import { Link } from 'lucide-react'; // Avoid conflict, use NextLink
import Link from 'next/link';
import { toast } from 'sonner';
import { useSite } from '@/lib/site-context';
// Import API methods
import { createMember } from '../api';
import { usePermission } from '@/lib/hooks/use-permission';

export default function MemberListPage() {
    const { siteId } = useSite();
    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const { canEdit, checkAccess } = usePermission('membership', 'members');

    useEffect(() => {
        if (!siteId) return;

        async function fetchMembers() {
            try {
                // MVP: Just fetch last 50. Real app needs pagination/search on server.
                // Scoped to sites/{siteId}/members
                const q = query(collection(db, 'sites', siteId, 'members'), orderBy('createdAt', 'desc'), limit(50));
                const snapshot = await getDocs(q);
                const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Member));
                setMembers(data);
            } catch (error) {
                console.error("Error fetching members:", error);
            } finally {
                setLoading(false);
            }
        }
        fetchMembers();
    }, [siteId]);

    const filteredMembers = members.filter(m =>
        m.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.phoneNumber.includes(searchTerm)
    );

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [newUser, setNewUser] = useState({ fullName: '', phoneNumber: '', email: '' });

    async function handleRegister(e: React.FormEvent) {
        e.preventDefault();
        if (!checkAccess('edit')) return;
        if (!siteId) return;
        setSubmitting(true);
        try {
            await createMember(siteId, {
                fullName: newUser.fullName,
                phoneNumber: newUser.phoneNumber,
                email: newUser.email,
                totalSpent: 0,
                totalTransactions: 0
            });
            setIsModalOpen(false);
            setNewUser({ fullName: '', phoneNumber: '', email: '' });
            // trigger refresh - simplest way for now is page reload or refetch
            window.location.reload();
        } catch (error) {
            console.error(error);
            toast.error("Failed to register member. Phone number might be duplicate.");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Members</h1>
                    <p className="text-gray-500">Manage members & loyalty points</p>
                </div>
                <div className="flex gap-3">

                    <button
                        onClick={() => checkAccess('edit') && setIsModalOpen(true)}
                        disabled={!canEdit}
                        className="bg-brand-dark text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-gray-800 transition shadow-lg shadow-brand-dark/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                    >
                        <Plus size={20} /> Add Member
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-3xl border-[3px] border-brand-dark shadow-sm overflow-hidden flex flex-col min-h-[600px]">
                {/* Search Header */}
                <div className="p-4 border-b border-gray-100 bg-white">
                    <div className="relative max-w-md">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search by name or phone..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-dark/10 focus:border-brand-dark transition-all text-sm font-medium"
                        />
                    </div>
                </div>

                {/* Desktop Table View */}
                <div className="hidden xl:block flex-1 overflow-auto">
                    {loading ? (
                        <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin text-gray-400" /></div>
                    ) : (
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 text-gray-500 font-bold text-xs uppercase tracking-wider sticky top-0 z-10">
                                <tr>
                                    <th className="p-4 border-b border-gray-100">Name</th>
                                    <th className="p-4 border-b border-gray-100">Phone</th>
                                    <th className="p-4 border-b border-gray-100">Email</th>
                                    <th className="p-4 text-right border-b border-gray-100">Points</th>
                                    <th className="p-4 text-right border-b border-gray-100">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredMembers.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="p-12 text-center text-gray-400">
                                            <div className="flex flex-col items-center gap-2">
                                                <User size={32} className="opacity-20" />
                                                <p>No members found.</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredMembers.map(member => (
                                        <tr key={member.id} className="hover:bg-gray-50 transition group">
                                            <td className="p-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-full bg-brand-dark/5 flex items-center justify-center text-brand-dark font-black text-sm border border-brand-dark/10">
                                                        {member.fullName.charAt(0)}
                                                    </div>
                                                    <span className="font-bold text-gray-800 group-hover:text-brand-dark transition-colors">{member.fullName}</span>
                                                </div>
                                            </td>
                                            <td className="p-4 text-gray-600 font-medium text-sm">{member.phoneNumber}</td>
                                            <td className="p-4 text-gray-600 font-medium text-sm">{member.email}</td>
                                            <td className="p-4 text-right font-black text-brand-dark text-sm">
                                                {member.currentPoints.toLocaleString()}
                                            </td>
                                            <td className="p-4 text-right">
                                                <Link
                                                    href={`/admin/membership/details?id=${member.id}`}
                                                    className="px-3 py-1.5 text-xs font-bold text-gray-600 hover:text-brand-dark bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors inline-block"
                                                >
                                                    View
                                                </Link>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Mobile/Tablet Card View */}
                <div className="xl:hidden flex-1 overflow-auto p-4 space-y-3 bg-gray-50/50">
                    {loading ? (
                        <div className="flex justify-center items-center h-32"><Loader2 className="animate-spin text-gray-400" /></div>
                    ) : filteredMembers.length === 0 ? (
                        <div className="p-8 text-center text-gray-400 flex flex-col items-center gap-2">
                            <User size={32} className="opacity-20" />
                            <p>No members found.</p>
                        </div>
                    ) : (
                        filteredMembers.map(member => (
                            <Link
                                key={member.id}
                                href={`/admin/membership/details?id=${member.id}`}
                                className="block bg-white p-4 rounded-2xl border border-gray-100 shadow-sm active:scale-[0.98] transition-transform"
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-brand-dark/5 flex items-center justify-center text-brand-dark font-black text-sm border border-brand-dark/10">
                                            {member.fullName.charAt(0)}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-gray-900">{member.fullName}</h3>
                                            <p className="text-xs text-gray-500 font-medium">{member.phoneNumber}</p>
                                        </div>
                                    </div>
                                    <div className="bg-brand-green/20 text-brand-dark px-2.5 py-1 rounded-lg text-xs font-black">
                                        {member.currentPoints.toLocaleString()} pts
                                    </div>
                                </div>
                            </Link>
                        ))
                    )}
                </div>
            </div>

            {/* Registration Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}>
                    <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h2 className="text-xl font-black text-brand-dark">Register New Member</h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                <X size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleRegister} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Full Name</label>
                                <input
                                    required
                                    type="text"
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200"
                                    value={newUser.fullName}
                                    onChange={e => setNewUser({ ...newUser, fullName: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Phone Number</label>
                                <input
                                    required
                                    type="tel"
                                    placeholder="+1..."
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200"
                                    value={newUser.phoneNumber}
                                    onChange={e => setNewUser({ ...newUser, phoneNumber: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email</label>
                                <input
                                    required
                                    type="email"
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200"
                                    value={newUser.email}
                                    onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full py-3 bg-brand-dark text-white font-bold rounded-xl hover:bg-brand-dark/90 mt-2"
                            >
                                {submitting ? 'Registering...' : 'Register Member'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
