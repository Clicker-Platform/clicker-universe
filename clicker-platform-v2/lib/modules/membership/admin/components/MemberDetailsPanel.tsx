'use client';

import React, { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { MEMBERS_COLLECTION, getMemberHistory, awardPoints, updateMemberProfile } from '../../api';
import { Member, LoyaltyTransaction, getTier, TIER_COLORS, DEFAULT_TIER_THRESHOLDS, TierThreshold } from '../../types';
import { PlusCircle, MinusCircle, Lock, User, Menu } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog';
import { usePermission } from '@/lib/hooks/use-permission';
import { useSite } from '@/lib/site-context';
import { logger } from '@/lib/logger-edge';
import { SlideOverPanel } from '@/components/admin/blocks/SlideOverPanel';
import { MobileBottomSheet } from '@/components/admin/blocks/MobileBottomSheet';

// Simple hook to determine mobile view
function useMediaQuery(query: string) {
    const [matches, setMatches] = useState(false);
    useEffect(() => {
        const media = window.matchMedia(query);
        if (media.matches !== matches) setMatches(media.matches);
        const listener = () => setMatches(media.matches);
        media.addEventListener('change', listener);
        return () => media.removeEventListener('change', listener);
    }, [matches, query]);
    return matches;
}

interface MemberDetailsPanelProps {
    memberId: string | null;
    isOpen: boolean;
    onClose: () => void;
}

export function MemberDetailsPanel({ memberId, isOpen, onClose }: MemberDetailsPanelProps) {
    const { siteId } = useSite();
    const isMobile = useMediaQuery('(max-width: 768px)');
    
    const [member, setMember] = useState<Member | null>(null);
    const [history, setHistory] = useState<LoyaltyTransaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [adjusting, setAdjusting] = useState(false);
    const [pointsAmount, setPointsAmount] = useState<string>('10');

    // Edit Profile State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editFormData, setEditFormData] = useState({ fullName: '', phoneNumber: '', email: '' });
    const [isSavingProfile, setIsSavingProfile] = useState(false);

    const { canEdit, checkAccess } = usePermission('membership', 'members');

    // Dialog Configuration
    const [confirmConfig, setConfirmConfig] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        action: () => Promise<void>;
        isDestructive: boolean;
    }>({
        isOpen: false,
        title: '',
        message: '',
        action: async () => { },
        isDestructive: false
    });

    const refreshData = async () => {
        if (!memberId || !siteId) return;
        setLoading(true);
        try {
            const docRef = doc(db, 'sites', siteId, MEMBERS_COLLECTION, memberId);
            const [docSnap, txs] = await Promise.all([
                getDoc(docRef),
                getMemberHistory(siteId, memberId),
            ]);
            if (docSnap.exists()) {
                setMember({ id: docSnap.id, ...docSnap.data() } as Member);
                setHistory(txs);
            }
        } catch (e) {
            logger.error('membership.member-detail.load.failed', { siteId, error: e });
            toast.error("Failed to load member data.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen && memberId && siteId) {
            refreshData();
        }
    }, [isOpen, memberId, siteId]);

    // Reset state after panel finishes closing (avoids flash of loading spinner on reopen)
    useEffect(() => {
        if (!isOpen) {
            const t = setTimeout(() => {
                setMember(null);
                setHistory([]);
                setLoading(true);
            }, 300); // matches slide-out animation duration
            return () => clearTimeout(t);
        }
    }, [isOpen]);

    useEffect(() => {
        if (member) {
            setEditFormData({
                fullName: member.fullName || '',
                phoneNumber: member.phoneNumber || '',
                email: member.email || ''
            });
        }
    }, [member]);

    const executeAdjustment = async (amount: number) => {
        if (!checkAccess('edit')) return;
        if (!member || !siteId) return;
        setAdjusting(true);
        try {
            await awardPoints(siteId, member.id, amount, 'MANUAL', 'admin_adjustment', 'Manual adjustment by admin');
            await refreshData();
            setPointsAmount('10'); // Reset to default after success
            toast.success(`Successfully ${amount > 0 ? 'added' : 'deducted'} ${Math.abs(amount)} points.`);
            closeConfirm();
        } catch (err) {
            logger.error('membership.member-detail.points.failed', { siteId, error: err });
            toast.error('Failed to update points: ' + err);
        } finally {
            setAdjusting(false);
        }
    };

    const handleManualAdjustmentClick = (amount: number) => {
        if (!checkAccess('edit')) return;
        const isDeduct = amount < 0;
        const absAmount = Math.abs(amount);

        setConfirmConfig({
            isOpen: true,
            title: isDeduct ? 'Deduct Points?' : 'Give Points?',
            message: `Are you sure you want to ${isDeduct ? 'deduct' : 'give'} ${absAmount} points ${isDeduct ? 'from' : 'to'} ${member?.fullName}?`,
            action: () => executeAdjustment(amount),
            isDestructive: isDeduct
        });
    };

    const closeConfirm = () => {
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
    };

    const renderContent = () => {
        if (loading) return <div className="p-8 text-center text-gray-500 dark:text-neutral-500">Loading details...</div>;
        if (!member) return <div className="p-8 text-center text-red-500">Member not found.</div>;

        const parsedAmount = parseInt(pointsAmount) || 0;

        return (
            // flex-col fills the panel height; top section is fixed, history scrolls
            <div className="flex flex-col h-full min-h-0">

                {/* ── Compact Top Section (does NOT scroll) ── */}
                <div className="flex-shrink-0 p-3 space-y-2">

                    {!canEdit && (
                        <div className="bg-amber-50 text-amber-700 px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 border border-amber-100 mb-1">
                            <Lock size={12} /> View Only
                        </div>
                    )}

                    {/* Ultra-compact Profile Card: horizontal avatar + info */}
                    <div className="bg-white dark:bg-neutral-900 px-3 py-2.5 rounded-lg border border-gray-200 dark:border-neutral-800">
                        <div className="flex items-center gap-3">
                            {/* Avatar */}
                            <div className="w-10 h-10 flex-shrink-0 rounded-full bg-blue-100 dark:bg-blue-950/30 flex items-center justify-center text-base font-bold text-blue-600 dark:text-blue-400">
                                {(() => {
                                    const parts = member.fullName.trim().split(/\s+/);
                                    return parts.length === 1
                                        ? parts[0].slice(0, 2).toUpperCase()
                                        : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
                                })()}
                            </div>
                            {/* Name + contact */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <p className="font-bold text-sm text-gray-900 dark:text-neutral-100 truncate">{member.fullName}</p>
                                    {canEdit && (
                                        <button
                                            onClick={() => setIsEditModalOpen(true)}
                                            className="flex-shrink-0 text-[10px] font-bold text-studio-blue hover:underline"
                                        >
                                            Edit
                                        </button>
                                    )}
                                </div>
                                {member.memberCode && (
                                    <p className="text-[10px] text-gray-400 dark:text-neutral-600 font-medium">{member.memberCode}</p>
                                )}
                                <p className="text-xs text-gray-500 dark:text-neutral-500 truncate">{member.phoneNumber}</p>
                                <p className="text-[10px] text-gray-400 dark:text-neutral-600 truncate">{member.email}</p>
                            </div>
                            {/* Points + Tier badge */}
                            <div className="flex-shrink-0 text-right">
                                {(() => {
                                    const tier = getTier(member.currentPoints || 0, DEFAULT_TIER_THRESHOLDS);
                                    const colors = TIER_COLORS[tier];
                                    return (
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border mb-1 ${colors.bg} ${colors.text} ${colors.border}`}>
                                            {tier}
                                        </span>
                                    );
                                })()}
                                <p className="text-lg font-black text-indigo-600 dark:text-indigo-400 leading-tight">{member.currentPoints.toLocaleString()}</p>
                                <p className="text-[10px] text-gray-400 dark:text-neutral-600">pts</p>
                            </div>
                        </div>

                        {/* Stats row */}
                        <div className="flex gap-2 mt-2 pt-2 border-t border-gray-100 dark:border-neutral-800">
                            <div className="flex-1 bg-gray-50 dark:bg-neutral-800 px-2 py-1.5 rounded-lg text-center">
                                <p className="text-[9px] uppercase tracking-wider text-gray-400 dark:text-neutral-600">Spent</p>
                                <p className="font-bold text-xs text-gray-900 dark:text-neutral-100">{(member.totalSpent || 0).toLocaleString()}</p>
                            </div>
                            <div className="flex-1 bg-gray-50 dark:bg-neutral-800 px-2 py-1.5 rounded-lg text-center">
                                <p className="text-[9px] uppercase tracking-wider text-gray-400 dark:text-neutral-600">Transactions</p>
                                <p className="font-bold text-xs text-gray-900 dark:text-neutral-100">{(member.totalTransactions || 0).toLocaleString()}</p>
                            </div>
                        </div>
                    </div>

                    {/* Ultra-compact Actions Card */}
                    <div className="bg-white dark:bg-neutral-900 px-3 py-2.5 rounded-lg border border-gray-200 dark:border-neutral-800">
                        <div className="flex items-center mb-2">
                            <p className="text-xs font-bold text-gray-600 dark:text-neutral-400 uppercase tracking-wider">Adjust Points</p>
                        </div>

                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                min="1"
                                value={pointsAmount}
                                disabled={!canEdit}
                                onChange={(e) => setPointsAmount(e.target.value)}
                                className="w-20 px-2 py-1.5 border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-dark/20 font-bold text-center text-sm disabled:bg-gray-50 dark:disabled:bg-neutral-800"
                                placeholder="0"
                            />
                            <button
                                onClick={() => handleManualAdjustmentClick(parsedAmount)}
                                disabled={adjusting || parsedAmount <= 0 || !canEdit}
                                className="flex-1 flex items-center justify-center gap-1 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 py-1.5 rounded-lg font-bold text-xs hover:bg-green-100 dark:hover:bg-green-950/50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                            >
                                <PlusCircle size={13} /> Give
                            </button>
                            <button
                                onClick={() => handleManualAdjustmentClick(-parsedAmount)}
                                disabled={adjusting || parsedAmount <= 0 || !canEdit}
                                className="flex-1 flex items-center justify-center gap-1 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 py-1.5 rounded-lg font-bold text-xs hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
                            >
                                <MinusCircle size={13} /> Deduct
                            </button>
                        </div>
                    </div>
                </div>

                {/* ── Scrollable Transaction History ── */}
                <div className="flex-1 min-h-0 overflow-y-auto">
                    <div className="px-3 pb-3">
                        <div className="bg-white dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800 overflow-hidden">
                            <div className="px-3 py-2 border-b border-gray-100 dark:border-neutral-800">
                                <h3 className="font-bold text-gray-800 dark:text-neutral-200 text-xs uppercase tracking-wider">Transaction History</h3>
                            </div>
                            <div className="divide-y divide-gray-100 dark:divide-neutral-800">
                                {history.length === 0 ? (
                                    <div className="p-6 text-center text-sm text-gray-400 dark:text-neutral-600">No transactions yet.</div>
                                ) : (
                                    history.map(tx => (
                                        <div key={tx.id} className="px-3 py-2.5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-neutral-800/50">
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <div className={`w-7 h-7 flex-shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${tx.pointsDelta > 0 ? 'bg-green-100 dark:bg-green-950/30 text-green-600 dark:text-green-400' : 'bg-red-100 dark:bg-red-950/30 text-red-600 dark:text-red-400'}`}>
                                                    {tx.pointsDelta > 0 ? '+' : '-'}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-medium text-xs text-gray-800 dark:text-neutral-200 truncate pr-2">
                                                        {tx.description.replace(/^(Completed reservation for |Reservation for )/i, '')}
                                                    </p>
                                                    <p className="text-[10px] text-gray-400 dark:text-neutral-600 uppercase tracking-wide">
                                                        {tx.createdAt?.toDate ? tx.createdAt.toDate().toLocaleDateString() : 'Just now'} · {tx.source === 'RESERVATION' ? 'Resv' : tx.source}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right flex-shrink-0 ml-2">
                                                {tx.spendAmount ? (
                                                    <p className="font-bold text-[10px] text-gray-900 dark:text-neutral-100">
                                                        {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(tx.spendAmount)}
                                                    </p>
                                                ) : null}
                                                <p className={`font-bold text-xs ${tx.pointsDelta > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                                    {tx.pointsDelta > 0 ? '+' : ''}{tx.pointsDelta} pts
                                                </p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    if (!isOpen) return null;


    return (
        <>
            {isMobile ? (
                <MobileBottomSheet
                    isOpen={isOpen}
                    onClose={onClose}
                    title="Member Details"
                    icon={User}
                    height="90vh"
                >
                    {renderContent()}
                </MobileBottomSheet>
            ) : (
                <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm flex justify-end animate-in fade-in">
                    <div className="h-full bg-white dark:bg-neutral-900 animate-in slide-in-from-right duration-300">
                        <SlideOverPanel
                            title="Member Details"
                            icon={User}
                            onClose={onClose}
                        >
                            {renderContent()}
                        </SlideOverPanel>
                    </div>
                </div>
            )}

            <ConfirmationDialog
                isOpen={confirmConfig.isOpen}
                title={confirmConfig.title}
                message={confirmConfig.message}
                onConfirm={confirmConfig.action}
                onCancel={closeConfirm}
                isDestructive={confirmConfig.isDestructive}
                isLoading={adjusting}
                confirmLabel={confirmConfig.isDestructive ? 'Deduct Points' : 'Give Points'}
            />

            {/* Edit Profile Modal */}
            {isEditModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setIsEditModalOpen(false)}>
                    <div className="bg-white dark:bg-neutral-900 rounded-lg w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-gray-100 dark:border-neutral-800 flex justify-between items-center bg-gray-50 dark:bg-neutral-800/50">
                            <h2 className="text-xl font-black text-brand-dark">Edit Member Profile</h2>
                        </div>
                        <form
                            onSubmit={async (e) => {
                                e.preventDefault();
                                if (!checkAccess('edit')) return;
                                setIsSavingProfile(true);
                                try {
                                    if (!member || !siteId) return;
                                    await updateMemberProfile(siteId, member.id, editFormData);
                                    await refreshData();
                                    setIsEditModalOpen(false);
                                    toast.success("Profile updated successfully!");
                                } catch (error) {
                                    logger.error('membership.member-detail.profile.update.failed', { siteId, error });
                                    toast.error("Failed to update profile.");
                                } finally {
                                    setIsSavingProfile(false);
                                }
                            }}
                            className="p-6 space-y-4"
                        >
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-neutral-500 uppercase mb-1">Full Name</label>
                                <input
                                    required
                                    type="text"
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-brand-dark/20"
                                    value={editFormData.fullName}
                                    onChange={e => setEditFormData({ ...editFormData, fullName: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-neutral-500 uppercase mb-1">Phone Number</label>
                                <input
                                    required
                                    type="tel"
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-brand-dark/20"
                                    value={editFormData.phoneNumber}
                                    onChange={e => setEditFormData({ ...editFormData, phoneNumber: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-neutral-500 uppercase mb-1">Email</label>
                                <input
                                    required
                                    type="email"
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-brand-dark/20"
                                    value={editFormData.email}
                                    onChange={e => setEditFormData({ ...editFormData, email: e.target.value })}
                                />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsEditModalOpen(false)}
                                    className="flex-1 py-2.5 font-bold text-gray-500 dark:text-neutral-500 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded-lg transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSavingProfile}
                                    className="flex-1 py-2.5 bg-studio-blue text-white font-bold rounded-lg hover:bg-studio-blue/85 transition shadow-lg shadow-brand-dark/20 disabled:opacity-70"
                                >
                                    {isSavingProfile ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
