'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Plus, Search, User, X } from 'lucide-react';
import { useSite } from '@/lib/site-context';
import { createMember, getMembershipSettings } from '../api';
import { Member, MembershipSettings, getTier, TIER_COLORS, DEFAULT_TIER_THRESHOLDS } from '../types';
import { usePermission } from '@/lib/hooks/use-permission';
import { MemberDetailsPanel } from './components/MemberDetailsPanel';

// --- Helpers ---

function getInitials(fullName: string): string {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const AVATAR_PALETTES = [
    { bg: 'bg-blue-100 dark:bg-blue-900/30',   text: 'text-blue-700 dark:text-blue-300'   },
    { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-300' },
    { bg: 'bg-violet-100 dark:bg-violet-900/30', text: 'text-violet-700 dark:text-violet-300' },
    { bg: 'bg-rose-100 dark:bg-rose-900/30',   text: 'text-rose-700 dark:text-rose-300'   },
    { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300' },
    { bg: 'bg-cyan-100 dark:bg-cyan-900/30',   text: 'text-cyan-700 dark:text-cyan-300'   },
    { bg: 'bg-pink-100 dark:bg-pink-900/30',   text: 'text-pink-700 dark:text-pink-300'   },
    { bg: 'bg-teal-100 dark:bg-teal-900/30',   text: 'text-teal-700 dark:text-teal-300'   },
];

function getAvatarPalette(name: string) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return AVATAR_PALETTES[Math.abs(hash) % AVATAR_PALETTES.length];
}

function TierBadge({ points, thresholds = DEFAULT_TIER_THRESHOLDS }: { points: number; thresholds?: typeof DEFAULT_TIER_THRESHOLDS }) {
    const tier = getTier(points, thresholds);
    const colors = TIER_COLORS[tier];
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${colors.bg} ${colors.text} ${colors.border}`}>
            {tier}
        </span>
    );
}

// --- Page ---

export default function MemberListPage() {
    const { siteId } = useSite();
    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [lastDoc, setLastDoc] = useState<any>(null);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [settings, setSettings] = useState<MembershipSettings | null>(null);

    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const detailsId = searchParams.get('detailsId');

    const { canEdit, checkAccess } = usePermission('membership', 'members');

    const openDetails = (id: string) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('detailsId', id);
        router.push(`${pathname}?${params.toString()}`);
    };

    const closeDetails = () => {
        const params = new URLSearchParams(searchParams.toString());
        params.delete('detailsId');
        router.push(`${pathname}?${params.toString()}`);
    };

    // Load settings once
    useEffect(() => {
        if (!siteId) return;
        getMembershipSettings(siteId).then(setSettings).catch(console.error);
    }, [siteId]);

    // Unified Fetch Logic
    useEffect(() => {
        if (!siteId) return;
        let isCancelled = false;

        async function loadInitialData() {
            setLoading(true);
            try {
                if (searchTerm.length >= 3) {
                    const { searchMembers } = await import('../api');
                    const results = await searchMembers(siteId, searchTerm);
                    if (!isCancelled) {
                        setMembers(results);
                        setHasMore(false);
                    }
                } else {
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

        const timer = setTimeout(loadInitialData, 300);
        return () => { isCancelled = true; clearTimeout(timer); };
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
            const prefix = settings?.memberCodePrefix || undefined;
            const newMember = await createMember(siteId, {
                fullName: newUser.fullName,
                phoneNumber: newUser.phoneNumber,
                email: newUser.email,
                totalSpent: 0,
                totalTransactions: 0
            }, prefix);
            setIsModalOpen(false);
            setNewUser({ fullName: '', phoneNumber: '', email: '' });

            if (searchTerm) {
                setSearchTerm('');
            } else {
                setMembers(prev => [newMember, ...prev]);
            }
            toast.success("Member registered successfully!");
        } catch (error) {
            console.error(error);
            toast.error("Failed to register member. Phone number might be duplicate.");
        } finally {
            setSubmitting(false);
        }
    }

    const tierThresholds = settings?.tierThresholds || DEFAULT_TIER_THRESHOLDS;

    return (
        <div>
            <div className="hidden md:flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800 dark:text-neutral-200">Members</h1>
                <button
                    onClick={() => checkAccess('edit') && setIsModalOpen(true)}
                    disabled={!canEdit}
                    className="flex items-center gap-1.5 bg-studio-blue text-white px-3 py-2 rounded-lg text-sm font-semibold transition-colors hover:bg-studio-blue/90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Plus size={15} /> Add Member
                </button>
            </div>

            {/* Mobile FAB */}
            {canEdit && (
                <button
                    onClick={() => checkAccess('edit') && setIsModalOpen(true)}
                    className="md:hidden fixed bottom-20 right-4 z-30 w-14 h-14 bg-studio-blue text-white rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-transform"
                    style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
                    aria-label="Add Member"
                >
                    <Plus size={24} />
                </button>
            )}

            <div className="bg-white dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800 overflow-hidden flex flex-col min-h-[600px]">
                {/* Search Header */}
                <div className="p-4 border-b border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-2">
                    <div className="relative max-w-md">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-neutral-600" size={18} />
                        <input
                            type="text"
                            placeholder="Cari member..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 dark:text-neutral-200 dark:placeholder-neutral-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-dark/10 focus:border-brand-dark transition-all text-sm font-medium"
                        />
                    </div>
                    {!loading && (
                        <p className="text-xs text-gray-400 dark:text-neutral-600 font-medium">
                            Menampilkan {members.length} member
                        </p>
                    )}
                </div>

                {/* Desktop Table View */}
                <div className="hidden xl:block flex-1 overflow-auto">
                    {loading ? (
                        <div className="flex justify-center items-center h-64">
                            <Loader2 className="animate-spin text-gray-400 dark:text-neutral-600" />
                        </div>
                    ) : (
                        <>
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 dark:bg-neutral-800/50 text-gray-500 dark:text-neutral-500 font-bold text-xs uppercase tracking-wider sticky top-0 z-10">
                                    <tr>
                                        <th className="p-4 border-b border-gray-100 dark:border-neutral-800">Member</th>
                                        <th className="p-4 border-b border-gray-100 dark:border-neutral-800">Email</th>
                                        <th className="p-4 border-b border-gray-100 dark:border-neutral-800">Mobile</th>
                                        <th className="p-4 border-b border-gray-100 dark:border-neutral-800">Tier</th>
                                        <th className="p-4 text-right border-b border-gray-100 dark:border-neutral-800">Points</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                                    {members.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="p-12 text-center text-gray-400 dark:text-neutral-600">
                                                <div className="flex flex-col items-center gap-2">
                                                    <User size={32} className="opacity-20" />
                                                    <p>No members found.</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        members.map(member => {
                                            const palette = getAvatarPalette(member.fullName);
                                            return (
                                                <tr
                                                    key={member.id}
                                                    onClick={() => openDetails(member.id)}
                                                    className="hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition cursor-pointer group"
                                                >
                                                    <td className="p-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-sm flex-shrink-0 ${palette.bg} ${palette.text}`}>
                                                                {getInitials(member.fullName)}
                                                            </div>
                                                            <div>
                                                                <span className="font-bold text-gray-800 dark:text-neutral-200 group-hover:text-brand-dark transition-colors block">{member.fullName}</span>
                                                                <span className="text-xs text-gray-400 dark:text-neutral-600 font-medium">{member.memberCode ?? '–'}</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="p-4 text-gray-600 dark:text-neutral-400 font-medium text-sm">{member.email}</td>
                                                    <td className="p-4 text-gray-600 dark:text-neutral-400 font-medium text-sm">{member.phoneNumber}</td>
                                                    <td className="p-4">
                                                        <TierBadge points={member.currentPoints || 0} thresholds={tierThresholds} />
                                                    </td>
                                                    <td className="p-4 text-right font-black text-brand-dark text-sm">
                                                        {(member.currentPoints || 0).toLocaleString()}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>

                            {/* Load More */}
                            {hasMore && !loading && (
                                <div className="p-4 flex justify-center border-t border-gray-100 dark:border-neutral-800">
                                    <button
                                        onClick={loadMore}
                                        disabled={loadingMore}
                                        className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-brand-dark hover:bg-brand-dark/5 rounded-lg transition-colors disabled:opacity-50"
                                    >
                                        {loadingMore ? <Loader2 size={16} className="animate-spin" /> : <span className="text-xl">▼</span>}
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
                        <div className="flex justify-center items-center h-32">
                            <Loader2 className="animate-spin text-gray-400 dark:text-neutral-600" />
                        </div>
                    ) : members.length === 0 ? (
                        <div className="p-8 text-center text-gray-400 dark:text-neutral-600 flex flex-col items-center gap-2">
                            <User size={32} className="opacity-20" />
                            <p>No members found.</p>
                        </div>
                    ) : (
                        <>
                            {members.map(member => {
                                const palette = getAvatarPalette(member.fullName);
                                const tier = getTier(member.currentPoints || 0, tierThresholds);
                                const tierColors = TIER_COLORS[tier];
                                return (
                                    <button
                                        key={member.id}
                                        onClick={() => openDetails(member.id)}
                                        className="w-full text-left block bg-white dark:bg-neutral-900 p-4 rounded-lg border border-gray-100 dark:border-neutral-800 active:scale-[0.98] transition-transform"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm flex-shrink-0 ${palette.bg} ${palette.text}`}>
                                                    {getInitials(member.fullName)}
                                                </div>
                                                <div className="min-w-0">
                                                    <h3 className="font-bold text-gray-900 dark:text-neutral-100 truncate">{member.fullName}</h3>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <p className="text-xs text-gray-500 dark:text-neutral-500 font-medium">{member.phoneNumber}</p>
                                                        {member.memberCode && (
                                                            <span className="text-xs text-gray-400 dark:text-neutral-600 font-medium">{member.memberCode}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-1.5 flex-shrink-0 ml-3">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${tierColors.bg} ${tierColors.text} ${tierColors.border}`}>
                                                    {tier}
                                                </span>
                                                <span className="text-xs font-black text-brand-dark">
                                                    {(member.currentPoints || 0).toLocaleString()} pts
                                                </span>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}

                            {/* Load More */}
                            {hasMore && (
                                <div className="pt-2 pb-4 flex justify-center">
                                    <button
                                        onClick={loadMore}
                                        disabled={loadingMore}
                                        className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-brand-dark bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800 rounded-lg transition-all disabled:opacity-50 w-full justify-center"
                                    >
                                        {loadingMore ? <Loader2 size={16} className="animate-spin" /> : <span>▼</span>}
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
                    <div className="bg-white dark:bg-neutral-900 rounded-lg w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
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
                                className="w-full py-3 bg-studio-blue text-white font-bold rounded-lg hover:bg-studio-blue/85 mt-2"
                            >
                                {submitting ? 'Registering...' : 'Register Member'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Slide Panel for Member Details */}
            <MemberDetailsPanel
                memberId={detailsId}
                isOpen={!!detailsId}
                onClose={closeDetails}
            />
        </div>
    );
}
