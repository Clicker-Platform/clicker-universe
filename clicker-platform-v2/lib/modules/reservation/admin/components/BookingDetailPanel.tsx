import React, { useState, useEffect } from 'react';
import { Booking } from '@/lib/modules/reservation/types';
import { User, Calendar, Clock, X, CheckCircle } from 'lucide-react';
import { StatusBadge, getStatusLabel } from './StatusBadge';
import { useSite } from '@/lib/site-context'; // New import

import { ConfirmationDialog } from '@/components/common/ConfirmationDialog';

const getDate = (date: any): Date => {
    if (!date) return new Date();
    return date.toDate ? date.toDate() : new Date(date);
};

interface BookingDetailPanelProps {
    booking: Booking | null;
    onClose: () => void;
    onStatusUpdate: (id: string, status: Booking['status']) => Promise<void>;
    onUpdateDetails: (id: string, data: Partial<Booking>) => Promise<void>;
}

export function BookingDetailPanel({ booking, onClose, onStatusUpdate, onUpdateDetails }: BookingDetailPanelProps) {
    const { siteId } = useSite();
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState<Partial<Booking> & { startString?: string }>({});
    const [updating, setUpdating] = useState(false);

    // Loyalty State
    const [membershipEnabled, setMembershipEnabled] = useState(false);
    const [isMember, setIsMember] = useState(false);
    const [checkingMember, setCheckingMember] = useState(false);
    const [enrolling, setEnrolling] = useState(false);
    const [showEnrollDialog, setShowEnrollDialog] = useState(false);

    // Reset edit state when booking changes
    useEffect(() => {
        setIsEditing(false);
        setEditForm({});

        // Modular: Check Membership Status
        async function checkMembership() {
            setCheckingMember(true);
            try {
                const { isModuleEnabled } = await import('@/lib/modules/registry');
                const { findMemberByPhone } = await import('@/lib/modules/membership/api');

                // Run module check and member lookup in parallel
                const [enabled, member] = await Promise.all([
                    isModuleEnabled('membership'),
                    (booking?.customerPhone && siteId)
                        ? findMemberByPhone(siteId, booking.customerPhone)
                        : Promise.resolve(null)
                ]);

                setMembershipEnabled(enabled);
                setIsMember(enabled && !!member);
            } catch (e) {
                console.error("Loyalty Check Failed", e);
            } finally {
                setCheckingMember(false);
            }
        }
        if (booking) checkMembership();
    }, [booking?.id, booking?.customerPhone]);

    // Enrollment State
    const [enrollEmail, setEnrollEmail] = useState('');
    const [isMissingEmail, setIsMissingEmail] = useState(false);

    const handleEnrollClick = () => {
        if (!booking) return;

        if (!booking.customerEmail) {
            setIsMissingEmail(true);
            setEnrollEmail('');
        } else {
            setIsMissingEmail(false);
            setEnrollEmail(booking.customerEmail);
        }
        setShowEnrollDialog(true);
    };

    const confirmEnroll = async () => {
        if (!booking) return;

        // If email was missing, we must validate the new input
        const finalEmail = isMissingEmail ? enrollEmail : booking.customerEmail;

        if (!finalEmail || !finalEmail.includes('@')) {
            alert("Please enter a valid email address to enroll.");
            return;
        }

        setEnrolling(true);
        try {
            // 1. If we collected a new email, update the booking first
            if (isMissingEmail && finalEmail !== booking.customerEmail) {
                await onUpdateDetails(booking.id, { customerEmail: finalEmail });
            }

            // 2. Create Member
            if (siteId) {
                const { createMember } = await import('@/lib/modules/membership/api');
                await createMember(siteId, {
                    fullName: booking.customerName,
                    phoneNumber: booking.customerPhone || '',
                    email: finalEmail!, // Asserted non-null by check above
                    totalSpent: 0,
                    totalTransactions: 0,
                });
            }
            setIsMember(true);
            setShowEnrollDialog(false);
        } catch (e) {
            console.error(e);
            alert("Failed to enroll member.");
        } finally {
            setEnrolling(false);
        }
    };

    if (!booking) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-gray-300 dark:text-neutral-600 p-12 text-center bg-gray-50/50 dark:bg-neutral-800/50">
                <div className="w-20 h-20 bg-gray-100 dark:bg-neutral-800 rounded-full flex items-center justify-center mb-6">
                    <Clock size={40} className="text-gray-300 dark:text-neutral-600" />
                </div>
                <p className="font-bold text-xl text-gray-400 dark:text-neutral-500 mb-2">No Booking Selected</p>
                <p className="text-gray-400 dark:text-neutral-500 max-w-xs">Select a booking from the list on the left to view details and manage the reservation.</p>
            </div>
        );
    }

    const handleSave = async () => {
        setUpdating(true);
        try {
            // Process date change if present
            const updates = { ...editForm };
            if (updates.startString) {
                const newStart = new Date(updates.startString);
                // Calculate end time based on original duration
                const originalDuration = booking.endAt.toDate().getTime() - booking.startAt.toDate().getTime();
                const newEnd = new Date(newStart.getTime() + originalDuration);

                (updates as any).startAt = newStart;
                (updates as any).endAt = newEnd;
                delete updates.startString;
            }

            await onUpdateDetails(booking.id, updates);
            setIsEditing(false);
        } catch (error) {
            console.error("Failed to update", error);
        } finally {
            setUpdating(false);
        }
    };

    const handleStatusAction = async (status: Booking['status']) => {
        setUpdating(true);
        try {
            await onStatusUpdate(booking.id, status);
        } finally {
            setUpdating(false);
        }
    };

    const startEdit = () => {
        const date = getDate(booking.startAt);
        // Format for datetime-local: YYYY-MM-DDTHH:mm
        const dateString = new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);

        setEditForm({
            staffName: booking.staffName,
            notes: booking.notes,
            startString: dateString
        });
        setIsEditing(true);
    };

    return (
        <div className="animate-in fade-in duration-300 h-full flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-gray-100 dark:border-neutral-800 flex justify-between items-center bg-white dark:bg-neutral-900 sticky top-0 z-10">
                <div>
                    <h2 className="text-2xl font-black text-brand-dark mb-1 flex flex-col items-start md:flex-row md:items-center gap-2 md:gap-3">
                        Booking Details
                        <StatusBadge status={booking.status} size="lg" />
                    </h2>
                    <div className="flex items-center gap-2">
                        <p className="text-xs text-gray-400 dark:text-neutral-600 font-mono uppercase tracking-wider">ID: {booking.id.slice(0, 8)}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {booking.status !== 'cancelled' && !isEditing && (
                        <button
                            onClick={startEdit}
                            className="px-4 py-2 bg-gray-100 dark:bg-neutral-800 text-brand-dark rounded-lg text-sm font-bold hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors"
                        >
                            Edit
                        </button>
                    )}
                    <button onClick={onClose} className="lg:hidden text-gray-400 dark:text-neutral-600">
                        <X size={24} />
                    </button>
                </div>
            </div>

            <div className="p-8 overflow-y-auto flex-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                    {/* Customer Info */}
                    <div>
                        <label className="text-xs font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-wider block mb-3">Customer Info</label>
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-full bg-brand-dark text-white flex items-center justify-center font-bold text-xl flex-shrink-0 shadow-lg shadow-brand-dark/20">
                                {booking.customerName.charAt(0)}
                            </div>
                            <div>
                                <p className="font-bold text-xl text-brand-dark leading-tight">{booking.customerName}</p>
                                <div className="mt-1 space-y-0.5">
                                    <p className="text-sm text-gray-500 dark:text-neutral-500 flex items-center gap-2">
                                        <User size={14} /> {booking.customerEmail || 'No Email'}
                                    </p>
                                    <p className="text-sm text-gray-500 dark:text-neutral-500 flex items-center gap-2">
                                        <span className="font-mono text-xs">📞</span> {booking.customerPhone || 'No Phone'}
                                    </p>
                                </div>

                                {/* Modular Loyalty Widget */}
                                {membershipEnabled && !checkingMember && (
                                    <div className="mt-3">
                                        {isMember ? (
                                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold border border-indigo-200">
                                                <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-pulse" />
                                                Member
                                            </div>
                                        ) : (
                                            <button
                                                onClick={handleEnrollClick}
                                                disabled={enrolling}
                                                className="text-xs flex items-center gap-1 text-indigo-600 font-bold hover:underline disabled:opacity-50"
                                            >
                                                {enrolling ? 'Enrolling...' : '+ Enroll as Member'}
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Service Details */}
                    <div>
                        <label className="text-xs font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-wider block mb-3">Service Details</label>
                        <div className="bg-gray-50 dark:bg-neutral-800/50 p-5 rounded-2xl border border-gray-100 dark:border-neutral-800">
                            <p className="font-black text-xl text-brand-dark mb-2">{booking.serviceName}</p>
                            <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-neutral-400 mb-1">
                                <Calendar size={16} className="text-brand-dark/60" />
                                <span className="font-medium">{getDate(booking.startAt).toLocaleDateString()}</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-neutral-400">
                                <Clock size={16} className="text-brand-dark/60" />
                                <span className="font-medium">
                                    {getDate(booking.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {getDate(booking.endAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Edit Form or View Mode */}
                {isEditing ? (
                    <div className="bg-gray-50 dark:bg-neutral-800/50 p-6 rounded-2xl border border-gray-200 dark:border-neutral-800 animate-in fade-in zoom-in-95 duration-200 mb-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-brand-dark">Edit Reservation</h3>
                            <button onClick={() => setIsEditing(false)} className="text-sm text-gray-500 dark:text-neutral-500 hover:underline">Cancel</button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="text-xs font-bold text-gray-500 dark:text-neutral-500 uppercase block mb-1">Date & Time</label>
                                <input
                                    type="datetime-local"
                                    value={editForm.startString || ''}
                                    onChange={e => setEditForm(prev => ({ ...prev, startString: e.target.value }))}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 dark:text-neutral-200"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 dark:text-neutral-500 uppercase block mb-1">Assigned Staff</label>
                                <input
                                    type="text"
                                    value={editForm.staffName || ''}
                                    onChange={e => setEditForm(prev => ({ ...prev, staffName: e.target.value }))}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 dark:text-neutral-200"
                                    placeholder="Assign a therapist..."
                                />
                            </div>
                        </div>
                        <div className="mb-4">
                            <label className="text-xs font-bold text-gray-500 dark:text-neutral-500 uppercase block mb-1">Notes</label>
                            <textarea
                                value={editForm.notes || ''}
                                onChange={e => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 dark:text-neutral-200"
                                rows={3}
                            />
                        </div>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={handleSave}
                                disabled={updating}
                                className="px-6 py-2 bg-brand-dark text-white font-bold rounded-xl hover:bg-brand-dark/90 transition-all shadow-lg shadow-brand-dark/20"
                            >
                                {updating ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="mb-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div>
                                <label className="text-xs font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-wider block mb-3">Assigned Staff</label>
                                <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-neutral-800/50 rounded-xl border border-gray-100 dark:border-neutral-800">
                                    <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs">
                                        {(booking.staffName || 'A').charAt(0)}
                                    </div>
                                    <p className="font-bold text-gray-900 dark:text-neutral-100">{booking.staffName || 'Any Available'}</p>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-wider block mb-3">Additional Notes</label>
                                <div className="p-4 bg-yellow-50 rounded-xl border border-yellow-100 text-yellow-800 text-sm">
                                    {booking.notes || 'No notes provided for this booking.'}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Status Action Buttons */}
                {!isEditing && (
                    <div className="border-t border-gray-100 dark:border-neutral-800 pt-6 mt-auto">
                        <div className="flex flex-wrap gap-4">
                            {booking.status === 'pending' && (
                                <>
                                    <ActionButton
                                        onClick={() => handleStatusAction('confirmed')}
                                        disabled={updating}
                                        label="Confirm"
                                        icon={<CheckCircle size={18} />}
                                        variant="success"
                                    />
                                    <ActionButton
                                        onClick={() => handleStatusAction('cancelled')}
                                        disabled={updating}
                                        label="Reject"
                                        icon={<X size={18} />}
                                        variant="danger"
                                    />
                                </>
                            )}
                            {booking.status === 'confirmed' && (
                                <>
                                    <ActionButton
                                        onClick={() => handleStatusAction('completed')}
                                        disabled={updating}
                                        label="Mark Completed"
                                        icon={<CheckCircle size={18} />}
                                        variant="primary"
                                    />
                                    <ActionButton
                                        onClick={() => handleStatusAction('cancelled')}
                                        disabled={updating}
                                        label="Cancel"
                                        icon={<X size={18} />}
                                        variant="gray"
                                    />
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>
            {/* Enrollment Confirmation */}
            <ConfirmationDialog
                isOpen={showEnrollDialog}
                title={isMissingEmail ? "Email Required" : "Enroll Member"}
                message={isMissingEmail
                    ? `This customer does not have an email address. Please enter one to continue enrollment.`
                    : `Are you sure you want to register ${booking.customerName} as a member? They will start earning loyalty points immediately.`
                }
                confirmLabel="Enroll Member"
                onConfirm={confirmEnroll}
                onCancel={() => setShowEnrollDialog(false)}
                isLoading={enrolling}
                isDestructive={false}
            >
                {isMissingEmail && (
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 dark:text-neutral-500 uppercase">Customer Email</label>
                        <input
                            type="email"
                            required
                            autoFocus
                            placeholder="e.g. customer@example.com"
                            className="w-full px-3 py-2 border border-gray-200 dark:border-neutral-700 rounded-lg text-sm focus:ring-2 focus:ring-brand-dark/20 focus:border-brand-dark outline-none transition-all dark:bg-neutral-800 dark:text-neutral-200"
                            value={enrollEmail}
                            onChange={(e) => setEnrollEmail(e.target.value)}
                        />
                    </div>
                )}
            </ConfirmationDialog>
        </div>
    );
}

function ActionButton({ onClick, disabled, label, icon, variant }: { onClick: () => void, disabled: boolean, label: string, icon: React.ReactNode, variant: 'primary' | 'success' | 'danger' | 'gray' }) {
    const baseClass = "flex-1 font-bold py-3 px-4 rounded-xl transition-colors active:scale-95 flex items-center justify-center gap-2";
    const variants = {
        primary: "bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-600/20",
        success: "bg-green-600 text-white hover:bg-green-700 shadow-lg shadow-green-600/20",
        danger: "bg-red-100 dark:bg-red-950/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-950/50",
        gray: "bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400 hover:bg-gray-200 dark:hover:bg-neutral-700"
    };

    return (
        <button onClick={onClick} disabled={disabled} className={`${baseClass} ${variants[variant]}`}>
            {icon} {label}
        </button>
    );
}

