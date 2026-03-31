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
    const { siteId, tenantSlug } = useSite();
    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [lastDoc, setLastDoc] = useState<any>(null); // QueryDocumentSnapshot
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    const { canEdit, checkAccess } = usePermission('membership', 'members');

    // Unified Fetch Logic
    useEffect(() => {
        if (!siteId) return;
        let isCancelled = false;

        async function loadInitialData() {
            setLoading(true);
            try {
                if (searchTerm.length >= 3) {
                    // Import searchMembers from API (ensure it is exported)
                    const { searchMembers } = await import('../api');
                    const results = await searchMembers(siteId, searchTerm);
                    if (!isCancelled) {
                        setMembers(results);
                        setHasMore(false); // Search result is finite list for now
                    }
                } else {
                    // Default View (Paginated)
                    // Import getPaginatedMembers from API
                    const { getPaginatedMembers } = await import('../api');
                    const { members: newMembers, lastVisible } = await getPaginatedMembers(siteId, null, 20);
                    if (!isCancelled) {
                        setMembers(newMembers);
                        setLastDoc(lastVisible);
                        setHasMore(!!lastVisible && newMembers.length === 20);
                    }
                }
            } catch (error) {
                console.error("Error loading members:", error);
            } finally {
                if (!isCancelled) setLoading(false);
            }
        }

        const timer = setTimeout(() => {
            loadInitialData();
        }, 300); // 300ms debounce

        return () => {
            isCancelled = true;
            clearTimeout(timer);
        }
    }, [siteId, searchTerm]);

    async function loadMore() {
        if (!lastDoc || loadingMore || !siteId) return;
        setLoadingMore(true);
        try {
            const { getPaginatedMembers } = await import('../api');
            const { members: newMembers, lastVisible } = await getPaginatedMembers(siteId, lastDoc, 20);
            setMembers(prev => [...prev, ...newMembers]);
            setLastDoc(lastVisible);
            setHasMore(!!lastVisible && newMembers.length === 20);
        } catch (error) {
            console.error("Error loading more members:", error);
            toast.error("Failed to load more members");
        } finally {
            setLoadingMore(false);
        }
    }

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

            // Refresh logic: clear search term to trigger useEffect re-fetch
            if (searchTerm) {
                setSearchTerm('');
            } else {
                // If already empty, valid way to force reload is needed, or manual fetch.
                // For now, simpler to reload page or toggle stricter state.
                window.location.reload();
            }
            toast.success("Member registered successfully!");
        } catch (error) {
            console.error(error);
            toast.error("Failed to register member. Phone number might be duplicate.");
        } finally {
            setSubmitting(false);
        }
    }

    // Filter logic is now server-side/search based, so we use 'members' directly
    const filteredMembers = members;

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-neutral-200">Members</h1>
                    <p className="text-gray-500 dark:text-neutral-500">Manage members & loyalty points</p>
                </div>
                <div className="flex gap-3">

                    <button
                        onClick={() => checkAccess('edit') && setIsModalOpen(true)}
                        disabled={!canEdit}
                        className="bg-studio-blue text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-studio-blue/85 transition shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                    >
                        <Plus size={20} /> Add Member
                    </button>
                </div>
            </div>

            <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-gray-200 dark:border-neutral-800 shadow-sm overflow-hidden flex flex-col min-h-[600px]">
                {/* Search Header */}
                <div className="p-4 border-b border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-900">
                    <div className="relative max-w-md">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-neutral-600" size={18} />
                        <input
                            type="text"
                            placeholder="Search by name or phone..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 dark:text-neutral-200 dark:placeholder-neutral-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-dark/10 focus:border-brand-dark transition-all text-sm font-medium"
                        />
                    </div>
                </div>

                {/* Desktop Table View */}
                <div className="hidden xl:block flex-1 overflow-auto">
                    {loading ? (
                        <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin text-gray-400 dark:text-neutral-600" /></div>
                    ) : (
                        <>
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 dark:bg-neutral-800/50 text-gray-500 dark:text-neutral-500 font-bold text-xs uppercase tracking-wider sticky top-0 z-10">
                                    <tr>
                                        <th className="p-4 border-b border-gray-100 dark:border-neutral-800">Name</th>
                                        <th className="p-4 border-b border-gray-100 dark:border-neutral-800">Phone</th>
                                        <th className="p-4 border-b border-gray-100 dark:border-neutral-800">Email</th>
                                        <th className="p-4 text-right border-b border-gray-100 dark:border-neutral-800">Points</th>
                                        <th className="p-4 text-right border-b border-gray-100 dark:border-neutral-800">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                                    {filteredMembers.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="p-12 text-center text-gray-400 dark:text-neutral-600">
                                                <div className="flex flex-col items-center gap-2">
                                                    <User size={32} className="opacity-20" />
                                                    <p>No members found.</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredMembers.map(member => (
                                            <tr key={member.id} className="hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition group">
                                                <td className="p-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-9 h-9 rounded-full bg-brand-dark/5 flex items-center justify-center text-brand-dark font-black text-sm border border-brand-dark/10">
                                                            {member.fullName.charAt(0)}
                                                        </div>
                                                        <span className="font-bold text-gray-800 dark:text-neutral-200 group-hover:text-brand-dark transition-colors">{member.fullName}</span>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-gray-600 dark:text-neutral-400 font-medium text-sm">{member.phoneNumber}</td>
                                                <td className="p-4 text-gray-600 dark:text-neutral-400 font-medium text-sm">{member.email}</td>
                                                <td className="p-4 text-right font-black text-brand-dark text-sm">
                                                    {(member.currentPoints || 0).toLocaleString()}
                                                </td>
                                                <td className="p-4 text-right">
                                                    <Link
                                                        href={`${tenantSlug ? `/${tenantSlug}` : ''}/admin/membership/details?id=${member.id}`}
                                                        className="px-3 py-1.5 text-xs font-bold text-gray-600 dark:text-neutral-400 hover:text-brand-dark bg-gray-100 dark:bg-neutral-800 hover:bg-gray-200 dark:hover:bg-neutral-700 rounded-lg transition-colors inline-block"
                                                    >
                                                        View
                                                    </Link>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>

                            {/* Load More Trigger */}
                            {hasMore && !loading && (
                                <div className="p-4 flex justify-center border-t border-gray-100 dark:border-neutral-800">
                                    <button
                                        onClick={loadMore}
                                        disabled={loadingMore}
                                        className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-brand-dark hover:bg-brand-dark/5 rounded-lg transition-colors disabled:opacity-50"
                                    >
                                        {loadingMore ? (
                                            <Loader2 size={16} className="animate-spin" />
                                        ) : (
                                            // Make sure ChevronDown is imported
                                            <span className="text-xl">▼</span>
                                        )}
                                        {loadingMore ? 'Loading members...' : 'Load More Members'}
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Mobile/Tablet Card View */}
                <div className="xl:hidden flex-1 overflow-auto p-4 space-y-3 bg-gray-50/50 dark:bg-neutral-800/20">
                    {loading ? (
                        <div className="flex justify-center items-center h-32"><Loader2 className="animate-spin text-gray-400 dark:text-neutral-600" /></div>
                    ) : filteredMembers.length === 0 ? (
                        <div className="p-8 text-center text-gray-400 dark:text-neutral-600 flex flex-col items-center gap-2">
                            <User size={32} className="opacity-20" />
                            <p>No members found.</p>
                        </div>
                    ) : (
                        <>
                            {filteredMembers.map(member => (
                                <Link
                                    key={member.id}
                                    href={`${siteId ? `/${siteId}` : ''}/admin/membership/details?id=${member.id}`}
                                    className="block bg-white dark:bg-neutral-900 p-4 rounded-2xl border border-gray-100 dark:border-neutral-800 shadow-sm active:scale-[0.98] transition-transform"
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-brand-dark/5 flex items-center justify-center text-brand-dark font-black text-sm border border-brand-dark/10">
                                                {member.fullName.charAt(0)}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-gray-900 dark:text-neutral-100">{member.fullName}</h3>
                                                <p className="text-xs text-gray-500 dark:text-neutral-500 font-medium">{member.phoneNumber}</p>
                                            </div>
                                        </div>
                                        <div className="bg-brand-green/20 text-brand-dark px-2.5 py-1 rounded-lg text-xs font-black">
                                            {(member.currentPoints || 0).toLocaleString()} pts
                                        </div>
                                    </div>
                                </Link>
                            ))}

                            {/* Load More Trigger */}
                            {hasMore && (
                                <div className="pt-2 pb-4 flex justify-center">
                                    <button
                                        onClick={loadMore}
                                        disabled={loadingMore}
                                        className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-brand-dark bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 shadow-sm hover:bg-gray-50 dark:hover:bg-neutral-800 rounded-xl transition-all disabled:opacity-50 w-full justify-center"
                                    >
                                        {loadingMore ? (
                                            <Loader2 size={16} className="animate-spin" />
                                        ) : (
                                            <span>▼</span>
                                        )}
                                        {loadingMore ? 'Loading...' : 'Load More'}
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Registration Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}>
                    <div className="bg-white dark:bg-neutral-900 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-gray-100 dark:border-neutral-800 flex justify-between items-center bg-gray-50 dark:bg-neutral-800/50">
                            <h2 className="text-xl font-black text-brand-dark">Register New Member</h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 dark:text-neutral-600 hover:text-gray-600 dark:hover:text-neutral-400">
                                <X size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleRegister} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-neutral-500 uppercase mb-1">Full Name</label>
                                <input
                                    required
                                    type="text"
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
                                    value={newUser.fullName}
                                    onChange={e => setNewUser({ ...newUser, fullName: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-neutral-500 uppercase mb-1">Phone Number</label>
                                <input
                                    required
                                    type="tel"
                                    placeholder="+1..."
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
                                    value={newUser.phoneNumber}
                                    onChange={e => setNewUser({ ...newUser, phoneNumber: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-neutral-500 uppercase mb-1">Email</label>
                                <input
                                    required
                                    type="email"
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
                                    value={newUser.email}
                                    onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full py-3 bg-studio-blue text-white font-bold rounded-xl hover:bg-studio-blue/85 mt-2"
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
