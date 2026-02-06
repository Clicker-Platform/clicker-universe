'use client';

import { useState } from 'react';
import { Search, UserPlus, Check, Loader2 } from 'lucide-react';
// Types are fine
import { Member } from '@/lib/modules/membership/types';
import { toast } from 'sonner';
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog';
import { useSite } from '@/lib/site-context'; // New import

interface POSMemberLookupProps {
    onMemberSelect: (member: Member | null) => void;
    selectedMember: Member | null;
    submitLabel?: string;
    toggleLabel?: string;
}

export function POSMemberLookup({ onMemberSelect, selectedMember, submitLabel = "Join & Link", toggleLabel = "Not a member? Join now" }: POSMemberLookupProps) {
    const { siteId } = useSite();
    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(false);
    const [isRegistering, setIsRegistering] = useState(false);

    // Registration Form
    const [regForm, setRegForm] = useState({ fullName: '', phoneNumber: '', email: '' });

    // Duplicate Detection
    const [collisionMember, setCollisionMember] = useState<Member | null>(null);

    const handleSearch = async () => {
        if (!phone || phone.length < 3 || !siteId) return;
        setLoading(true);
        try {
            // Dynamic Import for Strict Modularity
            const { findMemberByPhone } = await import('@/lib/modules/membership/api');

            const member = await findMemberByPhone(siteId, phone);
            if (member) {
                onMemberSelect(member);
                toast.success(`Welcome back, ${member.fullName}!`);
                setPhone('');
            } else {
                toast.error("Member not found. Join now?");
                setIsRegistering(true);
                setRegForm(prev => ({ ...prev, phoneNumber: phone }));
            }
        } catch (error) {
            console.error(error);
            toast.error("Error searching member");
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setLoading(true);
        try {
            if (!siteId) return;

            // Dynamic Import for Strict Modularity
            const { findMemberByPhone, findMemberByEmail, createMember } = await import('@/lib/modules/membership/api');

            // 1. Proactive Check for Duplicates
            const [existingPhone, existingEmail] = await Promise.all([
                findMemberByPhone(siteId, regForm.phoneNumber),
                regForm.email ? findMemberByEmail(siteId, regForm.email) : null
            ]);

            if (existingPhone || existingEmail) {
                setCollisionMember(existingPhone || existingEmail);
                setLoading(false);
                return;
            }

            // 2. Create if no collision
            const member = await createMember(siteId, {
                fullName: regForm.fullName,
                phoneNumber: regForm.phoneNumber,
                email: regForm.email,
                totalSpent: 0,
                totalTransactions: 0
            });

            onMemberSelect(member);
            toast.success("Member linked successfully!");
            setIsRegistering(false);
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || "Failed to register member");
        } finally {
            if (!collisionMember) setLoading(false);
        }
    };

    const handleConfirmLink = () => {
        if (collisionMember) {
            onMemberSelect(collisionMember);
            toast.success(`Linked to existing member: ${collisionMember.fullName}`);
            setCollisionMember(null);
            setIsRegistering(false);
        }
    };

    if (selectedMember) {
        return (
            <div className="bg-brand-green/10 border border-brand-green/30 p-3 rounded-lg flex items-center justify-between">
                <div>
                    <p className="text-xs text-brand-dark font-bold uppercase tracking-wider">Member Linked</p>
                    <p className="font-bold text-brand-dark">{selectedMember.fullName}</p>
                    <p className="text-xs text-gray-600">{selectedMember.currentPoints} pts</p>
                </div>
                <button
                    onClick={() => onMemberSelect(null)}
                    className="text-brand-dark hover:bg-brand-green/20 p-2 rounded-full transition-colors"
                >
                    <div className="bg-brand-green text-white rounded-full w-5 h-5 flex items-center justify-center">
                        <Check size={12} strokeWidth={4} />
                    </div>
                </button>
            </div>
        );
    }

    if (isRegistering) {
        return (
            <div className="space-y-4 animate-in fade-in zoom-in-95">
                <form onSubmit={handleRegister} className="space-y-3">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Full Name</label>
                        <input
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:border-brand-dark focus:ring-2 focus:ring-brand-dark/10 outline-none transition-all"
                            placeholder="e.g. John Doe"
                            required
                            autoFocus
                            value={regForm.fullName}
                            onChange={e => setRegForm({ ...regForm, fullName: e.target.value })}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Phone <span className="font-normal text-gray-400 normal-case">(Required)</span></label>
                            <input
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:border-brand-dark focus:ring-2 focus:ring-brand-dark/10 outline-none transition-all"
                                placeholder="e.g. 081..."
                                required
                                value={regForm.phoneNumber}
                                onChange={e => setRegForm({ ...regForm, phoneNumber: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email <span className="font-normal text-gray-400 normal-case">(Required)</span></label>
                            <input
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:border-brand-dark focus:ring-2 focus:ring-brand-dark/10 outline-none transition-all"
                                placeholder="e.g. john@example.com"
                                type="email"
                                required
                                value={regForm.email}
                                onChange={e => setRegForm({ ...regForm, email: e.target.value })}
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full mt-2 bg-brand-dark text-white py-2.5 rounded-lg font-bold text-sm hover:bg-gray-800 disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95"
                    >
                        {loading && <Loader2 size={14} className="animate-spin" />}
                        {loading ? 'Creating Member...' : submitLabel}
                    </button>

                    <button
                        type="button"
                        onClick={() => setIsRegistering(false)}
                        className="w-full text-xs text-gray-500 hover:text-gray-800 font-medium text-center"
                    >
                        Back to Search
                    </button>
                </form>

                <ConfirmationDialog
                    isOpen={!!collisionMember}
                    title="Member Already Exists"
                    message={`The phone or email provided is already linked to existing member: ${collisionMember?.fullName}. Would you like to link this member to the order instead?`}
                    confirmLabel="Link Member"
                    cancelLabel="Edit Data"
                    onConfirm={handleConfirmLink}
                    onCancel={() => {
                        setCollisionMember(null);
                        setLoading(false);
                    }}
                    isLoading={false}
                    isDestructive={false}
                />
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <div className="relative">
                <input
                    className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:bg-white focus:border-brand-dark/20 focus:outline-none transition-all"
                    placeholder="Member Phone Number"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <button
                    onClick={handleSearch}
                    disabled={!phone}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-white text-brand-dark p-1 rounded-md shadow-sm border border-gray-100 disabled:opacity-0 transition-opacity"
                >
                    {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                </button>
            </div>
            <button
                onClick={() => setIsRegistering(true)}
                className="w-full text-xs font-bold text-brand-dark/70 hover:text-brand-dark flex items-center justify-center gap-1 py-1"
            >
                <UserPlus size={12} /> {toggleLabel}
            </button>
        </div>
    );
}
