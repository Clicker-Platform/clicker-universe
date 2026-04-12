'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, ExternalLink, CheckCircle, Loader2, Shield } from 'lucide-react';
import { useSite } from '@/lib/site-context';
import { useUser } from '@/lib/user-context';
import {
    subscribeToServiceRecord,
    getWarrantyCard,
    cancelRecord,
    voidWarrantyCard,
    generateWarrantyCardForRecord,
} from '../api';
import { RecordStatusBadge } from './components/RecordStatusBadge';
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog';
import BillModal from './components/BillModal';
import type { ServiceRecord, WarrantyCard } from '../types';

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

    const [showBillModal, setShowBillModal] = useState(false);
    const [showCancelDialog, setShowCancelDialog] = useState(false);
    const [cancelReason, setCancelReason] = useState('');
    const [showVoidDialog, setShowVoidDialog] = useState(false);
    const [voidConfirmText, setVoidConfirmText] = useState('');
    const [justCompleted, setJustCompleted] = useState(false);

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

    async function handleCancel() {
        if (!record || !cancelReason.trim()) return;
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
        setActionLoading(true);
        try {
            await voidWarrantyCard(siteId, record.warrantyCardId);
            setWarrantyCard(prev => prev ? { ...prev, status: 'VOIDED' } : prev);
            showToast('success', 'Warranty card voided');
        } catch (err: any) {
            showToast('error', err.message || 'Failed to void warranty');
        } finally {
            setActionLoading(false);
            setShowVoidDialog(false);
        }
    }

    async function handleGenerateWarranty() {
        if (!record) return;
        setActionLoading(true);
        setJustCompleted(true);
        setTimeout(() => setJustCompleted(false), 15_000);
        try {
            await generateWarrantyCardForRecord(siteId, record.id);
            showToast('success', 'Warranty card generated');
        } catch (err: any) {
            showToast('error', err.message || 'Failed to generate warranty card');
            setJustCompleted(false);
        } finally {
            setActionLoading(false);
        }
    }

    if (loading) {
        return (
            <div className="animate-pulse space-y-4 max-w-3xl">
                <div className="h-8 bg-gray-200 dark:bg-neutral-700 rounded w-64" />
                <div className="h-40 bg-gray-200 dark:bg-neutral-700 rounded-2xl" />
                <div className="h-40 bg-gray-200 dark:bg-neutral-700 rounded-2xl" />
            </div>
        );
    }

    if (!record) {
        return (
            <div className="text-center">
                <p className="text-gray-500 dark:text-neutral-400">Record not found.</p>
                <button onClick={() => router.push('/admin/service-records/records')} className="mt-4 text-sm text-brand-dark dark:text-brand-green hover:underline">
                    Back to records
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-3xl space-y-5">
            {toast && (
                <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-lg ${
                    toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                }`}>
                    {toast.message}
                </div>
            )}

            {/* Header */}
            <div className="flex items-center gap-3">
                <button onClick={() => router.push('/admin/service-records/records')} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-500 dark:text-neutral-400">
                    <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-neutral-100 font-mono">{record.vehiclePlate}</h1>
                        <RecordStatusBadge status={record.status} />
                    </div>
                    <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">
                        Created {formatDate(record.createdAt)} · {record.createdBy}
                    </p>
                </div>
            </div>

            {/* Primary Action: Ready for Delivery */}
            {record.status === 'ACTIVE' && (
                <div className="bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-gray-200 dark:border-neutral-800 shadow-sm">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                        <div>
                            <p className="text-sm font-semibold text-gray-800 dark:text-neutral-200">Car ready for delivery?</p>
                            <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5">
                                Finalize bill, collect payment, and complete the service.
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setShowBillModal(true)}
                                disabled={actionLoading}
                                className="px-5 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-semibold disabled:opacity-50"
                            >
                                Ready for Delivery
                            </button>
                            {isOwner && (
                                <button
                                    onClick={() => { setCancelReason(''); setShowCancelDialog(true); }}
                                    disabled={actionLoading}
                                    className="px-4 py-2.5 rounded-xl border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Vehicle & Customer */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-gray-200 dark:border-neutral-800 shadow-sm">
                    <p className="text-xs font-medium text-gray-500 dark:text-neutral-500 mb-3">VEHICLE</p>
                    <p className="text-xl font-mono font-bold text-gray-900 dark:text-neutral-100">{record.vehiclePlate}</p>
                    <p className="text-sm text-gray-600 dark:text-neutral-400 mt-1">{record.memberName || '—'}</p>
                </div>
                <div className="bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-gray-200 dark:border-neutral-800 shadow-sm">
                    <p className="text-xs font-medium text-gray-500 dark:text-neutral-500 mb-3">CUSTOMER</p>
                    {record.memberId ? (
                        <>
                            <p className="text-base font-semibold text-gray-900 dark:text-neutral-100">{record.memberName || 'Member'}</p>
                            <p className="text-sm text-gray-500 dark:text-neutral-500">{record.memberPhone || '—'}</p>
                            <span className="inline-block mt-1.5 text-xs bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full">Member</span>
                        </>
                    ) : (
                        <>
                            <p className="text-base font-semibold text-gray-700 dark:text-neutral-300">{record.memberName || 'Walk-in'}</p>
                            {record.memberPhone && <p className="text-sm text-gray-500 dark:text-neutral-500">{record.memberPhone}</p>}
                            {record.memberEmail && <p className="text-xs text-gray-400 dark:text-neutral-500">{record.memberEmail}</p>}
                            <span className="inline-block mt-1.5 text-xs bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-neutral-400 px-2 py-0.5 rounded-full">Walk-in</span>
                        </>
                    )}
                </div>
            </div>

            {/* Booking source */}
            {record.bookingId && record.bookingSource === 'reservation' && (
                <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-2xl p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 dark:bg-blue-950/50 rounded-full flex items-center justify-center">
                            <ExternalLink size={15} className="text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">Source</p>
                            <p className="text-sm font-medium text-blue-900 dark:text-blue-300">Created from Reservation Booking</p>
                        </div>
                    </div>
                    <a
                        href={`/admin/reservation/bookings?id=${record.bookingId}`}
                        className="text-xs font-bold text-blue-700 dark:text-blue-400 hover:underline flex items-center gap-1 flex-shrink-0"
                    >
                        View Booking <ExternalLink size={11} />
                    </a>
                </div>
            )}

            {/* Service Details */}
            <div className="bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-gray-200 dark:border-neutral-800 shadow-sm space-y-3">
                <p className="text-xs font-medium text-gray-500 dark:text-neutral-500">SERVICE</p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <p className="text-xs text-gray-400 dark:text-neutral-500">Service Type</p>
                        <p className="font-medium text-gray-900 dark:text-neutral-100 mt-0.5">{record.serviceTypeName}</p>
                    </div>
                    <div>
                        <p className="text-xs text-gray-400 dark:text-neutral-500">Warranty</p>
                        <p className="font-medium text-gray-900 dark:text-neutral-100 mt-0.5">
                            {record.hasWarranty ? `${record.warrantyMonths} months` : 'No warranty'}
                        </p>
                    </div>
                    {record.productUsed && (
                        <div className="col-span-2">
                            <p className="text-xs text-gray-400 dark:text-neutral-500">Product Used</p>
                            <p className="font-medium text-gray-900 dark:text-neutral-100 mt-0.5">{record.productUsed}</p>
                        </div>
                    )}
                    {record.consumedItems && record.consumedItems.length > 0 && (
                        <div className="col-span-2">
                            <p className="text-xs text-gray-400 dark:text-neutral-500 mb-1">Consumed Items</p>
                            <ul className="space-y-0.5">
                                {record.consumedItems.map((ci, i) => (
                                    <li key={i} className="text-sm text-gray-700 dark:text-neutral-300">
                                        {ci.name} × {ci.quantity}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {record.notes && (
                        <div className="col-span-2">
                            <p className="text-xs text-gray-400 dark:text-neutral-500">Notes</p>
                            <p className="text-gray-700 dark:text-neutral-300 mt-0.5 whitespace-pre-wrap">{record.notes}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Payment — read-only, shown only after completion */}
            {record.status === 'COMPLETED' && (
                <div className="bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-gray-200 dark:border-neutral-800 shadow-sm">
                    <p className="text-xs font-medium text-gray-500 dark:text-neutral-500 mb-3">PAYMENT</p>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <p className="text-xs text-gray-400 dark:text-neutral-500">Total</p>
                            <p className="font-semibold text-gray-900 dark:text-neutral-100 mt-0.5">
                                Rp {(record.totalAmount || 0).toLocaleString('id-ID')}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-400 dark:text-neutral-500">Paid</p>
                            <p className="font-semibold text-gray-900 dark:text-neutral-100 mt-0.5">
                                Rp {(record.amountPaid || 0).toLocaleString('id-ID')}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-400 dark:text-neutral-500">Method</p>
                            <p className="text-gray-700 dark:text-neutral-300 mt-0.5">{record.paymentMethod || '—'}</p>
                        </div>
                        {record.loyaltyPointsAwarded != null && (
                            <div>
                                <p className="text-xs text-gray-400 dark:text-neutral-500">Loyalty Points</p>
                                <p className="text-green-600 dark:text-green-400 font-medium mt-0.5">+{record.loyaltyPointsAwarded} pts</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Warranty Card */}
            {record.hasWarranty && (
                <div className="bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-gray-200 dark:border-neutral-800 shadow-sm">
                    <p className="text-xs font-medium text-gray-500 dark:text-neutral-500 mb-3">WARRANTY CARD</p>

                    {record.status !== 'COMPLETED' && !record.warrantyCardId && (
                        <p className="text-sm text-gray-400 dark:text-neutral-500 italic">
                            Warranty card will be generated when service is completed.
                        </p>
                    )}

                    {record.status === 'COMPLETED' && !record.warrantyCardId && (
                        justCompleted ? (
                            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-neutral-400">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Generating warranty card…
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <p className="text-sm text-gray-400 dark:text-neutral-500 italic">
                                    Warranty card was not generated automatically.
                                </p>
                                {isOwner && (
                                    <button
                                        onClick={handleGenerateWarranty}
                                        disabled={actionLoading}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                                    >
                                        {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Shield className="w-3.5 h-3.5" />}
                                        Generate Warranty Card
                                    </button>
                                )}
                            </div>
                        )
                    )}

                    {record.warrantyCardId && warrantyCard && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <CheckCircle className="w-5 h-5 text-green-500 dark:text-green-400" />
                                <div>
                                    <p className="text-sm font-semibold text-gray-900 dark:text-neutral-100">{warrantyCard.warrantyCode}</p>
                                    <p className="text-xs text-gray-400 dark:text-neutral-500">
                                        Issued {formatDate(warrantyCard.serviceDate)} · Expires {formatDate(warrantyCard.expiryDate)}
                                    </p>
                                </div>
                                <span className={`ml-auto inline-block text-xs px-2 py-0.5 rounded-full font-medium ${
                                    warrantyCard.status === 'ACTIVE'   ? 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400' :
                                    warrantyCard.status === 'EXPIRED'  ? 'bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-neutral-400' :
                                    'bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400'
                                }`}>
                                    {warrantyCard.status}
                                </span>
                            </div>
                            <div className="flex gap-2 flex-wrap">
                                <a
                                    href={`/warranty/${warrantyCard.warrantyCode}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-neutral-700 text-sm text-gray-700 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-800"
                                >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                    View Card
                                </a>
                                {isOwner && warrantyCard.status === 'ACTIVE' && (
                                    <button
                                        onClick={() => setShowVoidDialog(true)}
                                        disabled={actionLoading}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-sm hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50"
                                    >
                                        <Shield className="w-3.5 h-3.5" />
                                        Void Warranty
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Completion info */}
            {record.status === 'COMPLETED' && record.approvedBy && (
                <div className="bg-green-50 dark:bg-green-950/30 border border-green-100 dark:border-green-900/50 rounded-xl p-4 text-sm text-green-700 dark:text-green-400">
                    <p className="font-medium flex items-center gap-1.5">
                        <CheckCircle className="w-4 h-4" /> Service Completed
                    </p>
                    <p className="text-xs text-green-600 dark:text-green-500 mt-0.5">
                        Completed by {record.approvedBy} on {formatDate(record.approvedAt)}
                    </p>
                </div>
            )}

            {/* Cancellation info */}
            {record.status === 'CANCELLED' && record.cancelReason && (
                <div className="bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/50 rounded-xl p-4 text-sm text-red-700 dark:text-red-400">
                    <p className="font-medium">Cancellation reason:</p>
                    <p className="mt-0.5">{record.cancelReason}</p>
                </div>
            )}

            {/* Bill Modal */}
            {showBillModal && record && (
                <BillModal
                    siteId={siteId}
                    record={record}
                    approvedByEmail={user?.email || user?.uid || 'staff'}
                    onCompleted={() => {
                        setShowBillModal(false);
                        setJustCompleted(true);
                        setTimeout(() => setJustCompleted(false), 15_000);
                        showToast('success', 'Service completed — receipt and warranty generated.');
                    }}
                    onCancel={() => setShowBillModal(false)}
                />
            )}

            {/* Void Warranty Dialog */}
            <ConfirmationDialog
                isOpen={showVoidDialog}
                title="Void Warranty Card?"
                message="This will permanently void the warranty card. The customer will no longer be able to claim warranty. This cannot be undone."
                confirmLabel="Void Warranty"
                cancelLabel="Cancel"
                isDestructive
                isLoading={actionLoading}
                onConfirm={handleVoidWarranty}
                onCancel={() => { setShowVoidDialog(false); setVoidConfirmText(''); }}
                hideFooter
            >
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">
                            Type <span className="font-bold text-red-600">VOID</span> to confirm
                        </label>
                        <input
                            type="text"
                            value={voidConfirmText}
                            onChange={e => setVoidConfirmText(e.target.value.toUpperCase())}
                            placeholder="Type VOID"
                            className="w-full rounded-xl border border-gray-200 dark:border-neutral-700 focus:border-red-400 focus:ring-1 focus:ring-red-400 px-3 py-2 text-sm bg-white dark:bg-neutral-800 text-gray-900 dark:text-neutral-100"
                            autoFocus
                        />
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={() => { setShowVoidDialog(false); setVoidConfirmText(''); }}
                            disabled={actionLoading}
                            className="flex-1 px-4 py-2.5 rounded-lg font-bold text-gray-500 dark:text-neutral-400 hover:bg-gray-200 dark:hover:bg-neutral-700 disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleVoidWarranty}
                            disabled={voidConfirmText !== 'VOID' || actionLoading}
                            className="flex-1 px-4 py-2.5 rounded-lg font-bold bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
                        >
                            {actionLoading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Voiding…
                                </span>
                            ) : 'Void Warranty'}
                        </button>
                    </div>
                </div>
            </ConfirmationDialog>

            {/* Cancel Dialog */}
            {showCancelDialog && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-neutral-900 rounded-2xl w-full max-w-sm shadow-xl p-6 space-y-4">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-neutral-100">Cancel Record?</h2>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">Reason *</label>
                            <textarea
                                value={cancelReason}
                                onChange={e => setCancelReason(e.target.value)}
                                rows={3}
                                placeholder="Enter reason…"
                                className="w-full rounded-xl border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-gray-400 dark:focus:border-neutral-500 focus:ring-0 px-3 py-2 text-sm resize-none"
                            />
                        </div>
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setShowCancelDialog(false)} className="px-4 py-2 rounded-xl border border-gray-200 dark:border-neutral-700 text-sm font-medium text-gray-700 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-800">
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
        <Suspense fallback={<div className="p-6 text-sm text-gray-400 dark:text-neutral-500">Loading…</div>}>
            <RecordDetailContent />
        </Suspense>
    );
}
