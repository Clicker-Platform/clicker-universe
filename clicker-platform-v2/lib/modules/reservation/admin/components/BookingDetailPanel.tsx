import React, { useState, useEffect, useRef } from 'react';
import { Booking, ReservationSettings } from '@/lib/modules/reservation/types';
import { User, Calendar, Clock, X, CheckCircle, ClipboardList, ExternalLink, Car, Loader2 } from 'lucide-react';
import type { Vehicle, CarCatalogEntry } from '@/lib/modules/service-records/types';
import { StatusBadge, getStatusLabel } from './StatusBadge';
import { useSite } from '@/lib/site-context'; // New import
import { logger } from '@/lib/logger-edge';

import { ConfirmationDialog } from '@/components/common/ConfirmationDialog';

const getDate = (date: any): Date => {
    if (!date) return new Date();
    return date.toDate ? date.toDate() : new Date(date);
};

interface BookingDetailPanelProps {
    booking: Booking | null;
    onClose: () => void;
    onStatusUpdate: (id: string, status: Booking['status'], cancellationReason?: string) => Promise<void>;
    onUpdateDetails: (id: string, data: Partial<Booking>) => Promise<void>;
    settings?: Pick<ReservationSettings, 'allowStaffSelection' | 'staffLabel'>;
}

export function BookingDetailPanel({ booking, onClose, onStatusUpdate, onUpdateDetails, settings }: BookingDetailPanelProps) {
    const { siteId } = useSite();
    const showStaff = settings?.allowStaffSelection ?? false;
    const staffLabel = settings?.staffLabel || 'Staff';
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState<Partial<Booking> & { startString?: string }>({});
    const [updating, setUpdating] = useState(false);

    // Loyalty State
    const [membershipEnabled, setMembershipEnabled] = useState(false);
    const [isMember, setIsMember] = useState(false);
    const [checkingMember, setCheckingMember] = useState(false);
    const [enrolling, setEnrolling] = useState(false);
    const [showEnrollDialog, setShowEnrollDialog] = useState(false);

    // Service Records State
    const [srEnabled, setSrEnabled] = useState(false);
    const [showPlateModal, setShowPlateModal] = useState(false);
    const [plateInput, setPlateInput] = useState('');
    const [creatingSR, setCreatingSR] = useState(false);
    const [vehicleLookup, setVehicleLookup] = useState<{ status: 'idle' | 'loading' | 'found' | 'not_found'; vehicle?: Vehicle }>({ status: 'idle' });
    const [carCatalog, setCarCatalog] = useState<CarCatalogEntry[]>([]);
    const [selectedCatalogId, setSelectedCatalogId] = useState('');
    const [newVehicleColor, setNewVehicleColor] = useState('');
    const [showVehicleDetails, setShowVehicleDetails] = useState(false);
    const plateDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Cancel Dialog State
    const [showCancelDialog, setShowCancelDialog] = useState(false);
    const [cancelReason, setCancelReason] = useState('');
    const [cancelAction, setCancelAction] = useState<'cancelled'>('cancelled');

    // Debounced plate lookup
    useEffect(() => {
        const normalized = plateInput.trim().toUpperCase().replace(/\s/g, '');
        if (!normalized || !siteId) {
            setVehicleLookup({ status: 'idle' });
            return;
        }
        if (plateDebounceRef.current) clearTimeout(plateDebounceRef.current);
        setVehicleLookup({ status: 'loading' });
        plateDebounceRef.current = setTimeout(async () => {
            try {
                const { findVehicleByPlate } = await import('@/lib/modules/service-records/api');
                const vehicle = await findVehicleByPlate(siteId, normalized);
                setVehicleLookup(vehicle ? { status: 'found', vehicle } : { status: 'not_found' });
            } catch {
                setVehicleLookup({ status: 'idle' });
            }
        }, 400);
        return () => { if (plateDebounceRef.current) clearTimeout(plateDebounceRef.current); };
    }, [plateInput, siteId]);

    const handleStartServiceRecord = async () => {
        if (!booking || !siteId) return;
        setCreatingSR(true);
        try {
            const { createServiceRecord, createVehicle } = await import('@/lib/modules/service-records/api');
            const { updateBookingDetails } = await import('@/lib/modules/reservation/api');
            const { getServiceCatalogItem } = await import('@/lib/core/serviceCatalog/api');

            const normalizedPlate = plateInput.toUpperCase().replace(/\s/g, '');
            let vehicleId: string;
            let memberId: string | undefined;
            let memberName: string | undefined;

            if (vehicleLookup.status === 'found' && vehicleLookup.vehicle) {
                vehicleId = vehicleLookup.vehicle.id;
                memberId = vehicleLookup.vehicle.memberId;
                memberName = vehicleLookup.vehicle.memberName;
            } else {
                // Register the new vehicle with the selected catalog entry
                vehicleId = await createVehicle(siteId, {
                    plateNumber: normalizedPlate,
                    carCatalogId: selectedCatalogId || undefined,
                    color: newVehicleColor || undefined,
                    memberName: booking.customerName || undefined,
                });
                memberName = booking.customerName;
            }

            // Load the catalog item so we can snapshot warranty config at SR creation time
            const catalogItem = await getServiceCatalogItem(siteId, booking.serviceId);
            const srConfig = catalogItem?.serviceRecordsConfig;

            const srId = await createServiceRecord(siteId, {
                vehicleId,
                vehiclePlate: normalizedPlate,
                ...(memberId ? { memberId } : {}),
                memberName: memberName || booking.customerName,
                memberPhone: booking.customerPhone || '',
                ...(booking.customerEmail ? { memberEmail: booking.customerEmail } : {}),
                serviceTypeId: booking.serviceId,
                serviceTypeName: booking.serviceName,
                hasWarranty: srConfig?.hasWarranty ?? false,
                warrantyMonths: srConfig?.hasWarranty ? (srConfig.defaultWarrantyMonths ?? 0) : 0,
                paymentStatus: 'UNPAID',
                totalAmount: srConfig?.defaultPrice ?? booking.totalPrice ?? 0,
                amountPaid: 0,
                bookingId: booking.id,
                bookingSource: 'reservation',
                createdBy: 'admin',
            });

            // Write serviceRecordId back to booking
            await updateBookingDetails(siteId, booking.id, { serviceRecordId: srId });

            setShowPlateModal(false);
            window.location.href = `/admin/service-records/detail?id=${srId}`;
        } catch (e) {
            logger.error('reservation.booking.service-record.create.failed', { siteId, error: e });
            alert('Failed to create service record. Please try again.');
        } finally {
            setCreatingSR(false);
        }
    };

    // Reset edit state when booking changes
    useEffect(() => {
        setIsEditing(false);
        setEditForm({});
        setPlateInput('');

        // Modular: Check Membership + Service Records
        async function checkMembership() {
            setCheckingMember(true);
            try {
                const { isModuleEnabled } = await import('@/lib/modules/registry');
                const { findMemberByPhone } = await import('@/lib/modules/membership/api');

                // Run all checks in parallel
                const [enabled, srEnabledVal, member] = await Promise.all([
                    isModuleEnabled('membership'),
                    isModuleEnabled('service_records'),
                    (booking?.customerPhone && siteId)
                        ? findMemberByPhone(siteId, booking.customerPhone)
                        : Promise.resolve(null)
                ]);

                setMembershipEnabled(enabled);
                setSrEnabled(srEnabledVal);
                setIsMember(enabled && !!member);
            } catch (e) {
                logger.error('reservation.booking.loyalty-check.failed', { siteId, error: e });
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
            logger.error('reservation.booking.member-enroll.failed', { siteId, error: e });
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
            logger.error('reservation.booking.update.failed', { siteId, error });
        } finally {
            setUpdating(false);
        }
    };

    const handleStatusAction = async (status: Booking['status']) => {
        if (status === 'cancelled') {
            setCancelReason('');
            setCancelAction('cancelled');
            setShowCancelDialog(true);
            return;
        }
        setUpdating(true);
        try {
            await onStatusUpdate(booking.id, status);
        } finally {
            setUpdating(false);
        }
    };

    const confirmCancel = async () => {
        if (!cancelReason.trim()) return;
        setUpdating(true);
        try {
            await onStatusUpdate(booking.id, cancelAction, cancelReason.trim());
            setShowCancelDialog(false);
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
                    <h2 className="text-xl font-bold text-gray-900 dark:text-neutral-100 mb-1 flex flex-col items-start md:flex-row md:items-center gap-2 md:gap-3">
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
                            <div className="w-12 h-12 rounded-full bg-studio-blue text-white flex items-center justify-center font-bold text-xl flex-shrink-0 shadow-lg shadow-brand-dark/20">
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
                                                className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-500 text-indigo-600 font-semibold hover:bg-indigo-50 dark:hover:bg-indigo-950 dark:border-indigo-400 dark:text-indigo-400 transition-colors disabled:opacity-50"
                                            >
                                                {enrolling ? 'Registering...' : '+ Register as Member'}
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
                        <div className="bg-gray-50 dark:bg-neutral-800/50 p-5 rounded-lg border border-gray-100 dark:border-neutral-800">
                            <p className="font-semibold text-lg text-gray-900 dark:text-neutral-100 mb-2">{booking.serviceName}</p>
                            {booking.preferredDate ? (
                                <>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xs font-bold px-2 py-0.5 bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 rounded-full">On Request</span>
                                    </div>
                                    {booking.preferredDate && (
                                        <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-neutral-400">
                                            <Calendar size={16} className="text-brand-dark/60" />
                                            <span className="font-medium">Preferred: {booking.preferredDate}</span>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <>
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
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Edit Form or View Mode */}
                {isEditing ? (
                    <div className="bg-gray-50 dark:bg-neutral-800/50 p-6 rounded-lg border border-gray-200 dark:border-neutral-800 animate-in fade-in zoom-in-95 duration-200 mb-6">
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
                            {showStaff && (
                                <div>
                                    <label className="text-xs font-bold text-gray-500 dark:text-neutral-500 uppercase block mb-1">Assigned {staffLabel}</label>
                                    <input
                                        type="text"
                                        value={editForm.staffName || ''}
                                        onChange={e => setEditForm(prev => ({ ...prev, staffName: e.target.value }))}
                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 dark:text-neutral-200"
                                        placeholder={`Assign a ${staffLabel.toLowerCase()}...`}
                                    />
                                </div>
                            )}
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
                                className="px-6 py-2 bg-studio-blue text-white font-bold rounded-lg hover:bg-studio-blue/85 transition-all shadow-lg shadow-brand-dark/20"
                            >
                                {updating ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="mb-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {showStaff && (
                                <div>
                                    <label className="text-xs font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-wider block mb-3">Assigned {staffLabel}</label>
                                    <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-neutral-800/50 rounded-lg border border-gray-100 dark:border-neutral-800">
                                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs">
                                            {(booking.staffName || 'A').charAt(0)}
                                        </div>
                                        <p className="font-bold text-gray-900 dark:text-neutral-100">{booking.staffName || 'Any Available'}</p>
                                    </div>
                                </div>
                            )}

                            {/* Vehicle / Asset Info — only shown when the booking has assetId */}
                            {(booking as any).assetId && (
                                <div>
                                    <label className="text-xs font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-wider block mb-3">Vehicle Info</label>
                                    <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-neutral-800/50 rounded-lg border border-gray-100 dark:border-neutral-800">
                                        <Car size={18} className="text-brand-dark/60 flex-shrink-0" />
                                        <div>
                                            <p className="font-bold text-gray-900 dark:text-neutral-100 font-mono tracking-wider">{(booking as any).assetId}</p>
                                            {(booking as any).assetModel && (
                                                <p className="text-sm text-gray-500 dark:text-neutral-500">{(booking as any).assetModel}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="text-xs font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-wider block mb-3">Additional Notes</label>
                                <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-100 text-yellow-800 text-sm">
                                    {booking.notes || 'No notes provided for this booking.'}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Cancellation Reason (shown for cancelled bookings) */}
                {booking.status === 'cancelled' && booking.cancellationReason && (
                    <div className="mb-8">
                        <label className="text-xs font-bold text-red-400 dark:text-red-500 uppercase tracking-wider block mb-3">Cancellation Reason</label>
                        <div className="p-4 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-100 dark:border-red-900/30 text-red-700 dark:text-red-400 text-sm">
                            {booking.cancellationReason}
                        </div>
                    </div>
                )}

                {/* Status Action Buttons */}
                {!isEditing && (
                    <div className="border-t border-gray-100 dark:border-neutral-800 pt-6 mt-auto">
                        <div className="flex flex-wrap gap-4">
                            {booking.status === 'pending' && (
                                <>
                                    {booking.serviceRecordId ? (
                                        <div className="flex-1 flex items-center gap-2 px-4 py-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 text-sm font-medium">
                                            <ClipboardList size={16} />
                                            Linked Service Record
                                            <a
                                                href={`/admin/service-records/detail?id=${booking.serviceRecordId}`}
                                                className="ml-auto flex items-center gap-1 font-bold hover:underline"
                                            >
                                                View Record <ExternalLink size={14} />
                                            </a>
                                        </div>
                                    ) : (
                                        <ActionButton
                                            onClick={() => handleStatusAction('confirmed')}
                                            disabled={updating}
                                            label="Confirm"
                                            icon={<CheckCircle size={18} />}
                                            variant="success"
                                        />
                                    )}
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
                                    {booking.serviceRecordId ? (
                                        <div className="w-full flex flex-col gap-3">
                                            <div className="flex-1 flex items-center gap-2 px-4 py-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 text-sm font-medium">
                                                <ClipboardList size={16} />
                                                Service in Progress
                                                <a
                                                    href={`/admin/service-records/detail?id=${booking.serviceRecordId}`}
                                                    className="ml-auto flex items-center gap-1 font-bold hover:underline"
                                                >
                                                    View Record <ExternalLink size={14} />
                                                </a>
                                            </div>
                                            <p className="text-xs text-gray-400 dark:text-neutral-500">
                                                This booking will be automatically marked as completed when the Service Record is approved.
                                            </p>
                                        </div>
                                    ) : srEnabled ? (
                                        <ActionButton
                                            onClick={async () => {
                                                if ((booking as any).assetId) {
                                                    setPlateInput((booking as any).assetId);
                                                }
                                                setSelectedCatalogId('');
                                                setNewVehicleColor('');
                                                setShowVehicleDetails(false);
                                                try {
                                                    const { getCarCatalog } = await import('@/lib/modules/service-records/api');
                                                    const catalog = await getCarCatalog(siteId);
                                                    setCarCatalog(catalog);
                                                } catch { /* non-blocking */ }
                                                setShowPlateModal(true);
                                            }}
                                            disabled={updating}
                                            label="Start Service Record"
                                            icon={<ClipboardList size={18} />}
                                            variant="success"
                                        />
                                    ) : (
                                        <ActionButton
                                            onClick={() => handleStatusAction('completed')}
                                            disabled={updating}
                                            label="Mark Completed"
                                            icon={<CheckCircle size={18} />}
                                            variant="primary"
                                        />
                                    )}
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
            {/* Vehicle Plate Modal */}
            {showPlateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-neutral-900 rounded-lg w-full max-w-sm shadow-2xl p-6 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-brand-dark">Start Service Record</h3>
                            <button onClick={() => { setShowPlateModal(false); setPlateInput(''); setVehicleLookup({ status: 'idle' }); setSelectedCatalogId(''); setNewVehicleColor(''); setShowVehicleDetails(false); }} className="p-2 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-full">
                                <X size={18} />
                            </button>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-neutral-500 mb-4">
                            Enter the vehicle plate number to create a new service record pre-filled with booking data.
                        </p>
                        <div className="mb-5">
                            <label className="text-xs font-bold text-gray-500 dark:text-neutral-500 uppercase block mb-1">Vehicle Plate</label>
                            <input
                                type="text"
                                autoFocus
                                value={plateInput}
                                onChange={e => setPlateInput(e.target.value.toUpperCase())}
                                placeholder="e.g. B 1234 XYZ"
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 dark:text-neutral-200 font-mono text-lg tracking-widest uppercase focus:outline-none focus:border-brand-dark"
                                onKeyDown={e => { if (e.key === 'Enter' && plateInput.trim()) handleStartServiceRecord(); }}
                            />
                            {vehicleLookup.status === 'loading' && (
                                <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-400">
                                    <Loader2 size={12} className="animate-spin" /> Looking up plate…
                                </div>
                            )}
                            {vehicleLookup.status === 'found' && vehicleLookup.vehicle && (
                                <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 text-xs text-green-800 dark:text-green-300">
                                    <Car size={13} className="flex-shrink-0" />
                                    <span className="font-semibold">Vehicle found</span>
                                    {vehicleLookup.vehicle.memberName && (
                                        <span className="text-green-600 dark:text-green-400 ml-auto">· {vehicleLookup.vehicle.memberName}</span>
                                    )}
                                </div>
                            )}
                            {vehicleLookup.status === 'not_found' && plateInput.trim().length >= 4 && (
                                <div className="mt-3 space-y-3 p-3 rounded-lg bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={showVehicleDetails}
                                            onChange={e => setShowVehicleDetails(e.target.checked)}
                                            className="rounded border-gray-300 dark:border-neutral-600 text-brand-dark"
                                        />
                                        <span className="text-xs font-medium text-gray-600 dark:text-neutral-400">Add car details (optional)</span>
                                    </label>
                                    {showVehicleDetails && (
                                        <>
                                            <div>
                                                <label className="text-xs text-gray-500 dark:text-neutral-500 block mb-1">Car Type</label>
                                                <select
                                                    value={selectedCatalogId}
                                                    onChange={e => setSelectedCatalogId(e.target.value)}
                                                    className="w-full rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 dark:text-neutral-200 focus:outline-none focus:border-brand-dark px-3 py-2 text-sm"
                                                >
                                                    <option value="">— Select car type —</option>
                                                    {carCatalog.map(car => (
                                                        <option key={car.id} value={car.id}>
                                                            {car.make} {car.model} ({car.type})
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-xs text-gray-500 dark:text-neutral-500 block mb-1">Color</label>
                                                <input
                                                    type="text"
                                                    value={newVehicleColor}
                                                    onChange={e => setNewVehicleColor(e.target.value)}
                                                    placeholder="e.g. Black, White"
                                                    className="w-full rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 dark:text-neutral-200 focus:outline-none focus:border-brand-dark px-3 py-2 text-sm"
                                                />
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => { setShowPlateModal(false); setPlateInput(''); setVehicleLookup({ status: 'idle' }); setSelectedCatalogId(''); setNewVehicleColor(''); setShowVehicleDetails(false); }}
                                className="flex-1 py-2.5 rounded-lg font-bold bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400 hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleStartServiceRecord}
                                disabled={creatingSR || !plateInput.trim()}
                                className="flex-1 py-2.5 rounded-lg font-bold bg-studio-blue text-white hover:bg-studio-blue/85 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                <ClipboardList size={16} />
                                {creatingSR ? 'Creating…' : 'Create Record'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Enrollment Confirmation */}
            <ConfirmationDialog
                isOpen={showEnrollDialog}
                title={isMissingEmail ? "Email Required" : "Register Member"}
                message={isMissingEmail
                    ? `This customer does not have an email address. Please enter one to continue enrollment.`
                    : `Are you sure you want to register ${booking.customerName} as a member? They will start earning loyalty points immediately.`
                }
                confirmLabel="Register Member"
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

            {/* Cancel Confirmation Dialog */}
            <ConfirmationDialog
                isOpen={showCancelDialog}
                title={booking.status === 'pending' ? 'Reject Booking' : 'Cancel Booking'}
                message={`Are you sure you want to ${booking.status === 'pending' ? 'reject' : 'cancel'} this booking for ${booking.customerName}? Please provide a reason.`}
                confirmLabel={booking.status === 'pending' ? 'Reject Booking' : 'Cancel Booking'}
                onConfirm={confirmCancel}
                onCancel={() => setShowCancelDialog(false)}
                isLoading={updating}
                isDestructive
            >
                <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 dark:text-neutral-500 uppercase">Reason</label>
                    <textarea
                        autoFocus
                        required
                        rows={3}
                        placeholder="e.g. Customer requested cancellation, schedule conflict..."
                        className="w-full px-3 py-2 border border-gray-200 dark:border-neutral-700 rounded-lg text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all dark:bg-neutral-800 dark:text-neutral-200"
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                    />
                    {!cancelReason.trim() && (
                        <p className="text-xs text-red-500">A reason is required to proceed.</p>
                    )}
                </div>
            </ConfirmationDialog>
        </div>
    );
}

function ActionButton({ onClick, disabled, label, icon, variant }: { onClick: () => void, disabled: boolean, label: string, icon: React.ReactNode, variant: 'primary' | 'success' | 'danger' | 'gray' }) {
    const baseClass = "flex-1 font-bold py-3 px-4 rounded-lg transition-colors active:scale-95 flex items-center justify-center gap-2";
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

