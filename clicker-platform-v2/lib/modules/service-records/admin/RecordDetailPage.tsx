'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, ExternalLink, AlertTriangle, CheckCircle, Loader2, Shield } from 'lucide-react';
import { useSite } from '@/lib/site-context';
import { useUser } from '@/lib/user-context';
import {
    subscribeToServiceRecord,
    getWarrantyCard,
    approveRecord,
    submitForApproval,
    moveToInProgress,
    cancelRecord,
    voidWarrantyCard,
    updateServiceRecord,
} from '../api';
import { RecordStatusBadge } from './components/RecordStatusBadge';
import { PaymentStatusBadge } from './components/PaymentStatusBadge';
import type { ServiceRecord, WarrantyCard, PaymentMethod, PaymentStatus } from '../types';

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
    { value: 'CASH',     label: 'Cash' },
    { value: 'TRANSFER', label: 'Bank Transfer' },
    { value: 'CARD',     label: 'Debit/Credit Card' },
    { value: 'QRIS',     label: 'QRIS' },
];

function formatDate(ts: any): string {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function RecordDetailContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const recordId = searchParams.get('id');
    const { siteId } = useSite();
    const { isOwner, user } = useUser();

    const [record, setRecord] = useState<ServiceRecord | null>(null);
    const [warrantyCard, setWarrantyCard] = useState<WarrantyCard | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    // Cancel dialog
    const [showCancelDialog, setShowCancelDialog] = useState(false);
    const [cancelReason, setCancelReason] = useState('');

    // Approve dialog
    const [showApproveDialog, setShowApproveDialog] = useState(false);

    // Inline payment editing
    const [editPayment, setEditPayment] = useState(false);
    const [payTotalAmount, setPayTotalAmount] = useState(0);
    const [payAmountPaid, setPayAmountPaid] = useState(0);
    const [payMethod, setPayMethod] = useState<PaymentMethod | ''>('');

    useEffect(() => {
        if (!siteId || !recordId) return;
        setLoading(true);
        const unsub = subscribeToServiceRecord(siteId, recordId, async (rec) => {
            setRecord(rec);
            setLoading(false);
            if (rec?.warrantyCardId && !warrantyCard) {
                try {
                    const card = await getWarrantyCard(siteId, rec.warrantyCardId);
                    setWarrantyCard(card);
                } catch { /* ignore */ }
            }
        });
        return () => unsub();
    }, [siteId, recordId]);

    function showToast(type: 'success' | 'error', message: string) {
        setToast({ type, message });
        setTimeout(() => setToast(null), 4000);
    }

    async function handleMoveToInProgress() {
        if (!record) return;
        setActionLoading(true);
        try {
            await moveToInProgress(siteId, record.id);
            showToast('success', 'Moved to In Progress');
        } catch (err: any) {
            showToast('error', err.message || 'Action failed');
        } finally {
            setActionLoading(false);
        }
    }

    async function handleSubmitForApproval() {
        if (!record) return;
        if (record.paymentStatus !== 'PAID') {
            showToast('error', 'Payment must be PAID before submitting for approval');
            return;
        }
        setActionLoading(true);
        try {
            await submitForApproval(siteId, record.id);
            showToast('success', 'Submitted for approval');
        } catch (err: any) {
            showToast('error', err.message || 'Action failed');
        } finally {
            setActionLoading(false);
        }
    }

    async function handleApprove() {
        if (!record || !isOwner) return;
        setActionLoading(true);
        setShowApproveDialog(false);
        try {
            await approveRecord(siteId, record.id, user?.email || 'owner');
            showToast('success', 'Record approved and completed');
        } catch (err: any) {
            showToast('error', err.message || 'Approval failed');
        } finally {
            setActionLoading(false);
        }
    }

    async function handleCancel() {
        if (!record || !isOwner || !cancelReason.trim()) return;
        setActionLoading(true);
        setShowCancelDialog(false);
        try {
            await cancelRecord(siteId, record.id, cancelReason.trim());
            showToast('success', 'Record cancelled');
        } catch (err: any) {
            showToast('error', err.message || 'Cancel failed');
        } finally {
            setActionLoading(false);
        }
    }

    async function handleVoidWarranty() {
        if (!record?.warrantyCardId || !isOwner) return;
        if (!confirm('Void this warranty card? This action cannot be undone.')) return;
        setActionLoading(true);
        try {
            await voidWarrantyCard(siteId, record.warrantyCardId);
            setWarrantyCard(prev => prev ? { ...prev, status: 'VOIDED' } : prev);
            showToast('success', 'Warranty card voided');
        } catch (err: any) {
            showToast('error', err.message || 'Failed to void warranty');
        } finally {
            setActionLoading(false);
        }
    }

    async function handleSavePayment() {
        if (!record) return;
        setActionLoading(true);
        try {
            const payStatus: PaymentStatus =
                payAmountPaid <= 0 ? 'UNPAID'
                : payAmountPaid >= payTotalAmount ? 'PAID'
                : 'PARTIAL';
            await updateServiceRecord(siteId, record.id, {
                totalAmount: payTotalAmount,
                amountPaid: payAmountPaid,
                paymentStatus: payStatus,
                paymentMethod: payMethod || undefined,
            });
            setEditPayment(false);
            showToast('success', 'Payment updated');
        } catch (err: any) {
            showToast('error', err.message || 'Failed to update payment');
        } finally {
            setActionLoading(false);
        }
    }

    function openPaymentEdit() {
        if (!record) return;
        setPayTotalAmount(record.totalAmount || 0);
        setPayAmountPaid(record.amountPaid || 0);
        setPayMethod(record.paymentMethod || '');
        setEditPayment(true);
    }

    if (loading) {
        return (
            <div className="p-6">
                <div className="animate-pulse space-y-4 max-w-3xl">
                    <div className="h-8 bg-gray-200 rounded w-64" />
                    <div className="h-40 bg-gray-200 rounded-2xl" />
                    <div className="h-40 bg-gray-200 rounded-2xl" />
                </div>
            </div>
        );
    }

    if (!record) {
        return (
            <div className="p-6 text-center">
                <p className="text-gray-500">Record not found.</p>
                <button onClick={() => router.push('/admin/service-records/records')} className="mt-4 text-sm text-brand-dark hover:underline">
                    Back to records
                </button>
            </div>
        );
    }

    const isTerminal = record.status === 'COMPLETED' || record.status === 'CANCELLED';
    const canEdit = !isTerminal;

    return (
        <div className="p-6 max-w-3xl space-y-5">
            {toast && (
                <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-lg ${
                    toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                }`}>
                    {toast.message}
                </div>
            )}

            {/* Header */}
            <div className="flex items-center gap-3">
                <button onClick={() => router.push('/admin/service-records/records')} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500">
                    <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h1 className="text-2xl font-bold text-gray-900 font-mono">{record.vehiclePlate}</h1>
                        <RecordStatusBadge status={record.status} />
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                        Created {formatDate(record.createdAt)} · Last updated {formatDate(record.updatedAt)}
                    </p>
                </div>
                {canEdit && (
                    <button
                        onClick={() => router.push(`/admin/service-records/new?id=${record.id}`)}
                        className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                        Edit
                    </button>
                )}
            </div>

            {/* Pending approval highlight */}
            {record.status === 'PENDING_APPROVAL' && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-semibold text-amber-800">Awaiting Manager Approval</p>
                        <p className="text-xs text-amber-600 mt-0.5">
                            {record.hasWarranty
                                ? 'Approving will complete this record and generate a warranty card for the customer.'
                                : 'Approving will mark this record as completed.'}
                        </p>
                    </div>
                </div>
            )}

            {/* Status Actions */}
            {!isTerminal && (
                <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
                    <p className="text-xs font-medium text-gray-500 mb-3">ACTIONS</p>
                    <div className="flex flex-wrap gap-2">
                        {record.status === 'DRAFT' && (
                            <button
                                onClick={handleMoveToInProgress}
                                disabled={actionLoading}
                                className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium disabled:opacity-50"
                            >
                                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Start Job (→ In Progress)'}
                            </button>
                        )}
                        {record.status === 'IN_PROGRESS' && (
                            <button
                                onClick={handleSubmitForApproval}
                                disabled={actionLoading || record.paymentStatus !== 'PAID'}
                                title={record.paymentStatus !== 'PAID' ? 'Payment must be PAID first' : ''}
                                className="px-4 py-2 rounded-xl bg-amber-500 text-white text-sm font-medium disabled:opacity-50"
                            >
                                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit for Approval'}
                            </button>
                        )}
                        {record.status === 'IN_PROGRESS' && record.paymentStatus !== 'PAID' && (
                            <p className="text-xs text-amber-600 flex items-center gap-1 self-center">
                                <AlertTriangle className="w-3.5 h-3.5" /> Mark payment as PAID to submit
                            </p>
                        )}
                        {record.status === 'PENDING_APPROVAL' && isOwner && (
                            <>
                                <button
                                    onClick={() => setShowApproveDialog(true)}
                                    disabled={actionLoading}
                                    className="px-4 py-2 rounded-xl bg-green-600 text-white text-sm font-medium disabled:opacity-50"
                                >
                                    {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Approve & Complete'}
                                </button>
                                <button
                                    onClick={handleMoveToInProgress}
                                    disabled={actionLoading}
                                    className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                                >
                                    Reject & Send Back
                                </button>
                            </>
                        )}
                        {record.status === 'PENDING_APPROVAL' && !isOwner && (
                            <p className="text-xs text-gray-400 italic">Waiting for manager/owner approval…</p>
                        )}
                        {isOwner && (
                            <button
                                onClick={() => { setCancelReason(''); setShowCancelDialog(true); }}
                                disabled={actionLoading}
                                className="px-4 py-2 rounded-xl border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 disabled:opacity-50"
                            >
                                Cancel Record
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Vehicle & Customer */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                    <p className="text-xs font-medium text-gray-500 mb-3">VEHICLE</p>
                    <p className="text-xl font-mono font-bold text-gray-900">{record.vehiclePlate}</p>
                    <p className="text-sm text-gray-600 mt-1">
                        {record.memberName || '—'}
                    </p>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                    <p className="text-xs font-medium text-gray-500 mb-3">CUSTOMER</p>
                    {record.memberId ? (
                        <>
                            <p className="text-base font-semibold text-gray-900">{record.memberName || 'Member'}</p>
                            <p className="text-sm text-gray-500">{record.memberPhone || '—'}</p>
                            <span className="inline-block mt-1.5 text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">Member</span>
                        </>
                    ) : (
                        <>
                            <p className="text-base font-semibold text-gray-700">{record.memberName || 'Walk-in'}</p>
                            {record.memberPhone && <p className="text-sm text-gray-500">{record.memberPhone}</p>}
                            {record.memberEmail && <p className="text-xs text-gray-400">{record.memberEmail}</p>}
                            <span className="inline-block mt-1.5 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Walk-in</span>
                        </>
                    )}
                </div>
            </div>

            {/* Booking Source Card */}
            {record.bookingId && record.bookingSource === 'reservation' && (
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <ExternalLink size={15} className="text-blue-600" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-blue-700 uppercase tracking-wider">Source</p>
                            <p className="text-sm font-medium text-blue-900">Created from Reservation Booking</p>
                        </div>
                    </div>
                    <a
                        href={`/admin/reservation/bookings?id=${record.bookingId}`}
                        className="text-xs font-bold text-blue-700 hover:underline flex items-center gap-1 flex-shrink-0"
                    >
                        View Booking <ExternalLink size={11} />
                    </a>
                </div>
            )}

            {/* Service Details */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-3">
                <p className="text-xs font-medium text-gray-500">SERVICE</p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <p className="text-xs text-gray-400">Service Type</p>
                        <p className="font-medium text-gray-900 mt-0.5">{record.serviceTypeName}</p>
                    </div>
                    <div>
                        <p className="text-xs text-gray-400">Warranty</p>
                        <p className="font-medium text-gray-900 mt-0.5">
                            {record.hasWarranty ? `${record.warrantyMonths} months` : 'No warranty'}
                        </p>
                    </div>
                    {record.productUsed && (
                        <div className="col-span-2">
                            <p className="text-xs text-gray-400">Product Used</p>
                            <p className="font-medium text-gray-900 mt-0.5">{record.productUsed}</p>
                        </div>
                    )}
                    {record.notes && (
                        <div className="col-span-2">
                            <p className="text-xs text-gray-400">Notes</p>
                            <p className="text-gray-700 mt-0.5 whitespace-pre-wrap">{record.notes}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Payment */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-medium text-gray-500">PAYMENT</p>
                    {canEdit && !editPayment && (
                        <button onClick={openPaymentEdit} className="text-xs text-brand-dark hover:underline">Edit</button>
                    )}
                </div>
                {!editPayment ? (
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <p className="text-xs text-gray-400">Total</p>
                            <p className="font-semibold text-gray-900 mt-0.5">
                                Rp {(record.totalAmount || 0).toLocaleString()}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-400">Paid</p>
                            <p className="font-semibold text-gray-900 mt-0.5">
                                Rp {(record.amountPaid || 0).toLocaleString()}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-400">Method</p>
                            <p className="text-gray-700 mt-0.5">{record.paymentMethod || '—'}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-400">Status</p>
                            <div className="mt-0.5">
                                <PaymentStatusBadge status={record.paymentStatus} />
                            </div>
                        </div>
                        {record.loyaltyPointsAwarded != null && (
                            <div>
                                <p className="text-xs text-gray-400">Loyalty Points</p>
                                <p className="text-green-600 font-medium mt-0.5">+{record.loyaltyPointsAwarded} pts</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Total (Rp)</label>
                                <input type="number" min={0} value={payTotalAmount || ''}
                                    onChange={e => setPayTotalAmount(parseFloat(e.target.value) || 0)}
                                    className="w-full rounded-xl border border-gray-200 focus:border-gray-400 focus:ring-0 px-3 py-2 text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Paid (Rp)</label>
                                <input type="number" min={0} value={payAmountPaid || ''}
                                    onChange={e => setPayAmountPaid(parseFloat(e.target.value) || 0)}
                                    className="w-full rounded-xl border border-gray-200 focus:border-gray-400 focus:ring-0 px-3 py-2 text-sm" />
                            </div>
                        </div>
                        <select value={payMethod} onChange={e => setPayMethod(e.target.value as PaymentMethod | '')}
                            className="w-full rounded-xl border border-gray-200 focus:border-gray-400 focus:ring-0 px-3 py-2 text-sm">
                            <option value="">No method</option>
                            {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                        </select>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setEditPayment(false)} className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
                            <button onClick={handleSavePayment} disabled={actionLoading} className="px-3 py-1.5 rounded-lg bg-brand-dark text-white text-sm disabled:opacity-50">Save</button>
                        </div>
                    </div>
                )}
            </div>

            {/* Warranty Card Section */}
            {record.hasWarranty && (
                <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                    <p className="text-xs font-medium text-gray-500 mb-3">WARRANTY CARD</p>
                    {record.status === 'COMPLETED' && !record.warrantyCardId && (
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Generating warranty card…
                        </div>
                    )}
                    {record.warrantyCardId && warrantyCard && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <CheckCircle className="w-5 h-5 text-green-500" />
                                <div>
                                    <p className="text-sm font-semibold text-gray-900">{warrantyCard.warrantyCode}</p>
                                    <p className="text-xs text-gray-400">
                                        Issued {formatDate(warrantyCard.serviceDate)} · Expires {formatDate(warrantyCard.expiryDate)}
                                    </p>
                                </div>
                                <span className={`ml-auto inline-block text-xs px-2 py-0.5 rounded-full font-medium ${
                                    warrantyCard.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
                                    warrantyCard.status === 'EXPIRED' ? 'bg-gray-100 text-gray-500' :
                                    'bg-red-100 text-red-600'
                                }`}>
                                    {warrantyCard.status}
                                </span>
                            </div>
                            <div className="flex gap-2 flex-wrap">
                                <a
                                    href={`/warranty/${warrantyCard.warrantyCode}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50"
                                >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                    View Card
                                </a>
                                {isOwner && warrantyCard.status === 'ACTIVE' && (
                                    <button
                                        onClick={handleVoidWarranty}
                                        disabled={actionLoading}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-red-600 text-sm hover:bg-red-50 disabled:opacity-50"
                                    >
                                        <Shield className="w-3.5 h-3.5" />
                                        Void Warranty
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                    {!record.warrantyCardId && record.status !== 'COMPLETED' && (
                        <p className="text-sm text-gray-400 italic">Warranty card will be generated when record is approved.</p>
                    )}
                </div>
            )}

            {/* Cancel info */}
            {record.status === 'CANCELLED' && record.cancelReason && (
                <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-sm text-red-700">
                    <p className="font-medium">Cancellation reason:</p>
                    <p className="mt-0.5">{record.cancelReason}</p>
                </div>
            )}

            {/* Completion info */}
            {record.status === 'COMPLETED' && record.approvedBy && (
                <div className="bg-green-50 border border-green-100 rounded-xl p-4 text-sm text-green-700">
                    <p className="font-medium flex items-center gap-1.5">
                        <CheckCircle className="w-4 h-4" /> Completed
                    </p>
                    <p className="text-xs text-green-600 mt-0.5">
                        Approved by {record.approvedBy} on {formatDate(record.approvedAt)}
                    </p>
                </div>
            )}

            {/* Approve Confirmation Dialog */}
            {showApproveDialog && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-6 space-y-4">
                        <h2 className="text-lg font-semibold text-gray-900">Approve & Complete?</h2>
                        <p className="text-sm text-gray-600">
                            This will mark the record as COMPLETED.
                            {record.hasWarranty && ' A warranty card will be generated and sent to the customer.'}
                        </p>
                        <p className="text-xs text-amber-600 bg-amber-50 p-3 rounded-xl">
                            This action is irreversible. COMPLETED records cannot be edited.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setShowApproveDialog(false)} className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">
                                Cancel
                            </button>
                            <button onClick={handleApprove} disabled={actionLoading} className="px-4 py-2 rounded-xl bg-green-600 text-white text-sm font-medium disabled:opacity-50">
                                {actionLoading ? 'Processing…' : 'Approve & Complete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Cancel Dialog */}
            {showCancelDialog && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-6 space-y-4">
                        <h2 className="text-lg font-semibold text-gray-900">Cancel Record?</h2>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Reason for cancellation *</label>
                            <textarea
                                value={cancelReason}
                                onChange={e => setCancelReason(e.target.value)}
                                rows={3}
                                placeholder="Enter reason…"
                                className="w-full rounded-xl border border-gray-200 focus:border-gray-400 focus:ring-0 px-3 py-2 text-sm resize-none"
                            />
                        </div>
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setShowCancelDialog(false)} className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">
                                Back
                            </button>
                            <button
                                onClick={handleCancel}
                                disabled={!cancelReason.trim() || actionLoading}
                                className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-medium disabled:opacity-50"
                            >
                                {actionLoading ? 'Cancelling…' : 'Confirm Cancel'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function RecordDetailPage() {
    return (
        <Suspense fallback={<div className="p-6 text-sm text-gray-400">Loading…</div>}>
            <RecordDetailContent />
        </Suspense>
    );
}
