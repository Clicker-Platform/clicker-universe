'use client';

import React, { useState } from 'react';
import { Search, UserPlus, Check, Loader2 } from 'lucide-react';
// Types are fine
import { Member } from '@/lib/modules/membership/types';
import { toast } from 'sonner';
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog';
import { useSite } from '@/lib/site-context'; // New import
import { useTemplate } from '@/components/TemplateProvider';

interface POSMemberLookupProps {
    onMemberSelect: (member: Member | null) => void;
    selectedMember: Member | null;
    submitLabel?: string;
    toggleLabel?: string;
}

export function POSMemberLookup({ onMemberSelect, selectedMember, submitLabel = "Join & Link", toggleLabel = "Not a member? Join now" }: POSMemberLookupProps) {
    const { siteId } = useSite();
    const { theme } = useTemplate();
    const isGlass = theme.decorations?.surfaceStyle === 'glass' || theme.cardStyle === 'glass';
    const surfaceBg = isGlass ? 'rgba(255,255,255,0.05)' : (theme.colors.surface || '#f9fafb');
    const borderColor = isGlass ? 'rgba(255,255,255,0.1)' : (theme.colors.border || '#e5e7eb');
    const subtleText = theme.colors.textSubtle || theme.colors.muted || theme.colors.foreground;
    const primaryColor = theme.colors.primary;
    const accentFg = theme.colors.accentForeground || '#ffffff';
    const inputStyle: React.CSSProperties = {
        backgroundColor: isGlass ? 'rgba(255,255,255,0.05)' : (theme.colors.surfaceElevated || '#ffffff'),
        borderColor,
        color: theme.colors.foreground,
    };
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
            <div className="p-3 rounded-lg border flex items-center justify-between"
                style={{ backgroundColor: `${primaryColor}10`, borderColor: `${primaryColor}30` }}>
                <div>
                    <p className="text-xs font-bold uppercase tracking-wider" style={{ color: primaryColor }}>Member Linked</p>
                    <p className="font-bold" style={{ color: theme.colors.foreground }}>{selectedMember.fullName}</p>
                    <p className="text-xs" style={{ color: subtleText }}>{selectedMember.currentPoints} pts</p>
                </div>
                <button
                    onClick={() => onMemberSelect(null)}
                    className="p-2 rounded-full hover:opacity-70 transition-opacity"
                    style={{ color: primaryColor }}
                >
                    <div className="rounded-full w-5 h-5 flex items-center justify-center"
                        style={{ backgroundColor: primaryColor, color: accentFg }}>
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
                        <label className="block text-xs font-bold uppercase mb-1" style={{ color: subtleText }}>Full Name</label>
                        <input
                            className="w-full px-3 py-2 rounded-lg text-sm border focus:outline-none transition-all"
                            style={inputStyle}
                            placeholder="e.g. John Doe"
                            required
                            autoFocus
                            value={regForm.fullName}
                            onChange={e => setRegForm({ ...regForm, fullName: e.target.value })}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold uppercase mb-1" style={{ color: subtleText }}>
                                Phone <span className="font-normal normal-case" style={{ color: subtleText }}>(Required)</span>
                            </label>
                            <input
                                className="w-full px-3 py-2 rounded-lg text-sm border focus:outline-none transition-all"
                                style={inputStyle}
                                placeholder="e.g. 081..."
                                required
                                value={regForm.phoneNumber}
                                onChange={e => setRegForm({ ...regForm, phoneNumber: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase mb-1" style={{ color: subtleText }}>
                                Email <span className="font-normal normal-case" style={{ color: subtleText }}>(Required)</span>
                            </label>
                            <input
                                className="w-full px-3 py-2 rounded-lg text-sm border focus:outline-none transition-all"
                                style={inputStyle}
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
                        className="w-full mt-2 py-2.5 rounded-lg font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2 transition-opacity hover:opacity-90 active:scale-95"
                        style={{ backgroundColor: primaryColor, color: accentFg }}
                    >
                        {loading && <Loader2 size={14} className="animate-spin" />}
                        {loading ? 'Creating Member...' : submitLabel}
                    </button>

                    <button
                        type="button"
                        onClick={() => setIsRegistering(false)}
                        className="w-full text-xs font-medium text-center hover:opacity-70 transition-opacity"
                        style={{ color: subtleText }}
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
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm border focus:outline-none transition-all"
                    style={inputStyle}
                    placeholder="Member Phone Number"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={16} style={{ color: subtleText }} />
                <button
                    onClick={handleSearch}
                    disabled={!phone}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md border disabled:opacity-0 transition-opacity hover:opacity-70"
                    style={{ backgroundColor: isGlass ? 'rgba(255,255,255,0.1)' : (theme.colors.surfaceElevated || '#ffffff'), borderColor, color: primaryColor }}
                >
                    {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                </button>
            </div>
            <button
                onClick={() => setIsRegistering(true)}
                className="w-full text-xs font-bold flex items-center justify-center gap-1 py-1 hover:opacity-70 transition-opacity"
                style={{ color: primaryColor }}
            >
                <UserPlus size={12} /> {toggleLabel}
            </button>
        </div>
    );
}
