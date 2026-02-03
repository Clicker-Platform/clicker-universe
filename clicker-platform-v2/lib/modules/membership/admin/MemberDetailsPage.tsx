'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { MEMBERS_COLLECTION, getMemberHistory, awardPoints, updateMemberProfile } from '../api';
import { Member, LoyaltyTransaction } from '../types';
import { ArrowLeft, PlusCircle, MinusCircle, Lock } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog';
import { usePermission } from '@/lib/hooks/use-permission';

import { useSite } from '@/lib/site-context';

export default function MemberDetailsPage() {
    const { siteId } = useSite();
    const searchParams = useSearchParams();
    const id = searchParams.get('id');

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
        if (!id || !siteId) return;
        try {
            const docRef = doc(db, 'sites', siteId, MEMBERS_COLLECTION, id);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                setMember({ id: docSnap.id, ...docSnap.data() } as Member);
                const txs = await getMemberHistory(siteId, id);
                setHistory(txs);
            }
        } catch (e) {
            console.error(e);
            toast.error("Failed to load member data.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (siteId && id) {
            refreshData();
        }
    }, [id, siteId]);

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
            console.error(err);
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

    if (loading) return <div className="p-8 text-center text-gray-500">Loading...</div>;
    if (!member) return <div className="p-8 text-center text-red-500">Member not found.</div>;

    const parsedAmount = parseInt(pointsAmount) || 0;

    return (
        <div className="p-6 max-w-5xl mx-auto">
            <Link href="/admin/membership" className="inline-flex items-center text-gray-500 hover:text-gray-800 mb-6 gap-2">
                <ArrowLeft size={18} /> Back to List
            </Link>

            <div className="flex justify-end mb-4">
                {!canEdit && (
                    <div className="bg-amber-50 text-amber-700 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 border border-amber-100">
                        <Lock size={14} />
                        View Only
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Profile Card */}
                <div className="md:col-span-1 space-y-6">
                    <div className="bg-white p-6 rounded-3xl shadow-sm border-[3px] border-brand-dark text-center">
                        <div className="w-24 h-24 mx-auto bg-blue-100 rounded-full flex items-center justify-center text-3xl font-bold text-blue-600 mb-4">
                            {member.fullName.charAt(0)}
                        </div>
                        <h2 className="text-xl font-bold text-gray-900">{member.fullName}</h2>
                        <p className="text-gray-500 font-medium">{member.phoneNumber}</p>
                        <p className="text-sm text-gray-400 mb-6">{member.email}</p>

                        <div className="bg-gray-50 p-4 rounded-lg mb-4">
                            <span className="block text-xs uppercase tracking-wider text-gray-500 mb-1">Current Balance</span>
                            <span className="text-3xl font-bold text-indigo-600">{member.currentPoints.toLocaleString()} pts</span>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-gray-50 p-3 rounded-lg">
                                <span className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1">Total Spent</span>
                                <span className="font-bold text-gray-900">
                                    {(member.totalSpent || 0).toLocaleString()}
                                </span>
                            </div>
                            <div className="bg-gray-50 p-3 rounded-lg">
                                <span className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1">Transactions</span>
                                <span className="font-bold text-gray-900">
                                    {(member.totalTransactions || 0).toLocaleString()}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-3xl shadow-sm border-[3px] border-brand-dark">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-gray-700">Actions</h3>
                            <button
                                onClick={() => checkAccess('edit') && setIsEditModalOpen(true)}
                                className={`text-xs font-bold text-brand-dark hover:underline ${!canEdit ? 'cursor-not-allowed text-gray-400 no-underline hover:no-underline' : ''}`}
                            >
                                {canEdit ? 'Edit Profile' : 'View Only'}
                            </button>
                        </div>

                        <div className="mb-4">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Points Amount</label>
                            <input
                                type="number"
                                min="1"
                                value={pointsAmount}
                                disabled={!canEdit}
                                onChange={(e) => setPointsAmount(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-dark/20 font-bold text-center text-lg disabled:bg-gray-50"
                                placeholder="0"
                            />
                        </div>

                        <div className="space-y-2">
                            <button
                                onClick={() => handleManualAdjustmentClick(parsedAmount)}
                                disabled={adjusting || parsedAmount <= 0 || !canEdit}
                                className="w-full flex items-center justify-center gap-2 bg-green-50 text-green-700 p-2.5 rounded-xl font-bold hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
                            >
                                <PlusCircle size={18} /> Give {parsedAmount > 0 ? parsedAmount : ''} Pts
                            </button>
                            <button
                                onClick={() => handleManualAdjustmentClick(-parsedAmount)}
                                disabled={adjusting || parsedAmount <= 0 || !canEdit}
                                className="w-full flex items-center justify-center gap-2 bg-red-50 text-red-700 p-2.5 rounded-xl font-bold hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
                            >
                                <MinusCircle size={18} /> Deduct {parsedAmount > 0 ? parsedAmount : ''} Pts
                            </button>
                        </div>
                    </div>
                </div>

                {/* History */}
                <div className="md:col-span-2 bg-white rounded-3xl shadow-sm border-[3px] border-brand-dark overflow-hidden">
                    <div className="p-6 border-b border-gray-100">
                        <h3 className="font-bold text-gray-800">Transaction History</h3>
                    </div>
                    <div className="divide-y divide-gray-100">
                        {history.length === 0 ? (
                            <div className="p-8 text-center text-gray-400">No transactions yet.</div>
                        ) : (
                            history.map(tx => (
                                <div key={tx.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${tx.pointsDelta > 0 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                            {tx.pointsDelta > 0 ? '+' : '-'}
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-800">
                                                {tx.description.replace(/^(Completed reservation for |Reservation for )/i, '')}
                                            </p>
                                            <p className="text-xs text-gray-500 uppercase tracking-wide">
                                                {tx.createdAt?.toDate ? tx.createdAt.toDate().toLocaleDateString() : 'Just now'} • {tx.source === 'RESERVATION' ? 'Reservation' : tx.source}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        {tx.spendAmount ? (
                                            <p className="font-bold text-gray-900">
                                                {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(tx.spendAmount)}
                                            </p>
                                        ) : null}
                                        <p className={`font-bold text-sm ${tx.pointsDelta > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {tx.pointsDelta > 0 ? '+' : ''}{tx.pointsDelta} pts
                                        </p>
                                        <span title={`Ref: ${tx.sourceRefId}`} className="text-[10px] text-gray-300 font-mono cursor-help">
                                            #{tx.sourceRefId.slice(0, 8)}...
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

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
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
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
                                    console.error(error);
                                    toast.error("Failed to update profile.");
                                } finally {
                                    setIsSavingProfile(false);
                                }
                            }}
                            className="p-6 space-y-4"
                        >
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Full Name</label>
                                <input
                                    required
                                    type="text"
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-dark/20"
                                    value={editFormData.fullName}
                                    onChange={e => setEditFormData({ ...editFormData, fullName: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Phone Number</label>
                                <input
                                    required
                                    type="tel"
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-dark/20"
                                    value={editFormData.phoneNumber}
                                    onChange={e => setEditFormData({ ...editFormData, phoneNumber: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email</label>
                                <input
                                    required
                                    type="email"
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-dark/20"
                                    value={editFormData.email}
                                    onChange={e => setEditFormData({ ...editFormData, email: e.target.value })}
                                />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsEditModalOpen(false)}
                                    className="flex-1 py-2.5 font-bold text-gray-500 hover:bg-gray-100 rounded-xl transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSavingProfile}
                                    className="flex-1 py-2.5 bg-brand-dark text-white font-bold rounded-xl hover:bg-brand-dark/90 transition shadow-lg shadow-brand-dark/20 disabled:opacity-70"
                                >
                                    {isSavingProfile ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
