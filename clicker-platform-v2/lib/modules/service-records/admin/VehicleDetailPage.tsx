'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, Car, User, ExternalLink, X } from 'lucide-react';
import { useSite } from '@/lib/site-context';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
    getVehicle,
    getCarCatalog,
    getServiceRecordsByVehiclePlate,
} from '../api';
import { getMemberHistory, MEMBERS_COLLECTION } from '@/lib/modules/membership/api';
import type { Member, LoyaltyTransaction } from '@/lib/modules/membership/types';
import type { Vehicle, CarCatalogEntry, ServiceRecord } from '../types';
import { RecordStatusBadge } from './components/RecordStatusBadge';
import { PaymentStatusBadge } from './components/PaymentStatusBadge';

function formatDate(ts: any): string {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount);
}

// ── Member Slide Panel ────────────────────────────────────────────────────────

interface MemberPanelProps {
    memberId: string;
    siteId: string;
    onClose: () => void;
    onOpenFullPage: () => void;
}

function MemberPanel({ memberId, siteId, onClose, onOpenFullPage }: MemberPanelProps) {
    const [member, setMember] = useState<Member | null>(null);
    const [history, setHistory] = useState<LoyaltyTransaction[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            try {
                const docSnap = await getDoc(doc(db, 'sites', siteId, MEMBERS_COLLECTION, memberId));
                if (docSnap.exists()) {
                    setMember({ id: docSnap.id, ...docSnap.data() } as Member);
                    const txs = await getMemberHistory(siteId, memberId);
                    setHistory(txs);
                }
            } catch (err) {
                console.error('[MemberPanel] load error:', err);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [memberId, siteId]);

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
                onClick={onClose}
            />
            {/* Panel */}
            <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-white dark:bg-neutral-900 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-neutral-800 flex-shrink-0">
                    <h2 className="text-base font-semibold text-gray-900 dark:text-neutral-100">Member Profile</h2>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onOpenFullPage}
                            className="flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                        >
                            Full Profile <ExternalLink className="w-3 h-3" />
                        </button>
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-500 dark:text-neutral-400"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="flex-1 p-5 space-y-4 animate-pulse">
                        <div className="h-20 bg-gray-100 dark:bg-neutral-800 rounded-2xl" />
                        <div className="h-32 bg-gray-100 dark:bg-neutral-800 rounded-2xl" />
                        <div className="h-48 bg-gray-100 dark:bg-neutral-800 rounded-2xl" />
                    </div>
                ) : !member ? (
                    <div className="flex-1 flex items-center justify-center text-sm text-gray-400 dark:text-neutral-500">
                        Member not found.
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto">
                        {/* Profile */}
                        <div className="p-5 border-b border-gray-100 dark:border-neutral-800">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-full bg-blue-100 dark:bg-blue-950/30 flex items-center justify-center text-2xl font-bold text-blue-600 dark:text-blue-400 flex-shrink-0">
                                    {member.fullName.charAt(0)}
                                </div>
                                <div className="min-w-0">
                                    <p className="font-bold text-gray-900 dark:text-neutral-100 truncate">{member.fullName}</p>
                                    <p className="text-sm text-gray-500 dark:text-neutral-400">{member.phoneNumber}</p>
                                    {member.email && <p className="text-xs text-gray-400 dark:text-neutral-500 truncate">{member.email}</p>}
                                </div>
                            </div>

                            {/* Stats */}
                            <div className="mt-4 grid grid-cols-3 gap-3">
                                <div className="bg-gray-50 dark:bg-neutral-800 rounded-xl p-3 text-center">
                                    <p className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-neutral-500 font-medium">Points</p>
                                    <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">{member.currentPoints.toLocaleString()}</p>
                                </div>
                                <div className="bg-gray-50 dark:bg-neutral-800 rounded-xl p-3 text-center">
                                    <p className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-neutral-500 font-medium">Spent</p>
                                    <p className="text-sm font-bold text-gray-900 dark:text-neutral-100 mt-0.5">
                                        {new Intl.NumberFormat('id-ID', { notation: 'compact' }).format(member.totalSpent || 0)}
                                    </p>
                                </div>
                                <div className="bg-gray-50 dark:bg-neutral-800 rounded-xl p-3 text-center">
                                    <p className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-neutral-500 font-medium">Visits</p>
                                    <p className="text-lg font-bold text-gray-900 dark:text-neutral-100 mt-0.5">{member.totalTransactions || 0}</p>
                                </div>
                            </div>
                        </div>

                        {/* Transaction history */}
                        <div>
                            <div className="px-5 py-3 border-b border-gray-100 dark:border-neutral-800">
                                <p className="text-xs font-semibold text-gray-500 dark:text-neutral-500 uppercase tracking-wide">Transaction History</p>
                            </div>
                            {history.length === 0 ? (
                                <div className="p-8 text-center text-sm text-gray-400 dark:text-neutral-500">No transactions yet.</div>
                            ) : (
                                <div className="divide-y divide-gray-50 dark:divide-neutral-800">
                                    {history.map(tx => (
                                        <div key={tx.id} className="px-5 py-3 flex items-center justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium text-gray-800 dark:text-neutral-200 truncate">
                                                    {tx.description.replace(/^(Completed reservation for |Reservation for )/i, '')}
                                                </p>
                                                <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">
                                                    {tx.createdAt?.toDate ? tx.createdAt.toDate().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Just now'}
                                                </p>
                                            </div>
                                            <div className="text-right flex-shrink-0">
                                                {tx.spendAmount ? (
                                                    <p className="text-xs text-gray-500 dark:text-neutral-400">
                                                        {new Intl.NumberFormat('id-ID', { notation: 'compact', style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(tx.spendAmount)}
                                                    </p>
                                                ) : null}
                                                <p className={`text-sm font-bold ${tx.pointsDelta > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                                                    {tx.pointsDelta > 0 ? '+' : ''}{tx.pointsDelta} pts
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

function VehicleDetailContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const vehicleId = searchParams.get('id');
    const { siteId } = useSite();

    const [vehicle, setVehicle] = useState<Vehicle | null>(null);
    const [catalog, setCatalog] = useState<CarCatalogEntry[]>([]);
    const [records, setRecords] = useState<ServiceRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [memberPanelId, setMemberPanelId] = useState<string | null>(null);

    useEffect(() => {
        if (!siteId || !vehicleId) return;
        load();
    }, [siteId, vehicleId]);

    async function load() {
        setLoading(true);
        try {
            const [v, cat] = await Promise.all([
                getVehicle(siteId, vehicleId!),
                getCarCatalog(siteId),
            ]);
            setVehicle(v);
            setCatalog(cat);
            if (v) {
                const recs = await getServiceRecordsByVehiclePlate(siteId, v.plateNumber);
                setRecords(recs);
            }
        } catch (err) {
            console.error('[VehicleDetailPage] load error:', err);
        } finally {
            setLoading(false);
        }
    }

    if (loading) {
        return (
            <div className="p-6 space-y-4 max-w-3xl">
                <div className="animate-pulse space-y-4">
                    <div className="h-8 bg-gray-200 dark:bg-neutral-700 rounded w-40" />
                    <div className="h-32 bg-gray-200 dark:bg-neutral-700 rounded-2xl" />
                    <div className="h-48 bg-gray-200 dark:bg-neutral-700 rounded-2xl" />
                </div>
            </div>
        );
    }

    if (!vehicle) {
        return (
            <div className="p-6">
                <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-neutral-400 dark:hover:text-neutral-200 mb-4">
                    <ChevronLeft className="w-4 h-4" /> Back
                </button>
                <p className="text-sm text-gray-500 dark:text-neutral-400">Vehicle not found.</p>
            </div>
        );
    }

    const catalogEntry = catalog.find(c => c.id === vehicle.carCatalogId);
    const completedRecords = records.filter(r => r.status === 'COMPLETED');
    const totalSpend = completedRecords.reduce((sum, r) => sum + (r.amountPaid || 0), 0);

    const latestRecord = records[0];
    const memberName = vehicle.memberName || latestRecord?.memberName;
    const memberId = vehicle.memberId || latestRecord?.memberId;
    const memberPhone = latestRecord?.memberPhone;

    return (
        <div className="p-6 max-w-3xl space-y-5">

            {/* Back */}
            <button
                onClick={() => router.push('/admin/service-records/vehicles')}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-neutral-400 dark:hover:text-neutral-200"
            >
                <ChevronLeft className="w-4 h-4" /> Vehicles
            </button>

            {/* Vehicle header */}
            <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-200 dark:border-neutral-800 shadow-sm p-6">
                <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-neutral-800 flex items-center justify-center flex-shrink-0">
                        <Car className="w-6 h-6 text-gray-500 dark:text-neutral-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-2xl font-bold font-mono tracking-wider text-gray-900 dark:text-neutral-100">{vehicle.plateNumber}</h1>
                        {catalogEntry && (
                            <p className="text-base text-gray-600 dark:text-neutral-300 mt-0.5">
                                {catalogEntry.make} {catalogEntry.model}
                                <span className="ml-2 text-xs text-gray-400 dark:text-neutral-500 font-medium">{catalogEntry.type}</span>
                            </p>
                        )}
                        {vehicle.color && (
                            <p className="text-sm text-gray-400 dark:text-neutral-500 mt-0.5">{vehicle.color}</p>
                        )}
                    </div>
                </div>

                {/* Stats */}
                <div className="mt-5 grid grid-cols-3 gap-4 pt-5 border-t border-gray-100 dark:border-neutral-800">
                    <div>
                        <p className="text-xs text-gray-500 dark:text-neutral-500 uppercase tracking-wide font-medium">Total Visits</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-neutral-100 mt-0.5">{records.length}</p>
                    </div>
                    <div>
                        <p className="text-xs text-gray-500 dark:text-neutral-500 uppercase tracking-wide font-medium">Completed</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-neutral-100 mt-0.5">{completedRecords.length}</p>
                    </div>
                    <div>
                        <p className="text-xs text-gray-500 dark:text-neutral-500 uppercase tracking-wide font-medium">Total Spend</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-neutral-100 mt-0.5">{formatCurrency(totalSpend)}</p>
                    </div>
                </div>
            </div>

            {/* Customer */}
            {memberName && (
                <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-200 dark:border-neutral-800 shadow-sm p-5">
                    <h2 className="text-sm font-semibold text-gray-500 dark:text-neutral-500 uppercase tracking-wide mb-3">Customer</h2>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-gray-100 dark:bg-neutral-800 flex items-center justify-center">
                                <User className="w-4 h-4 text-gray-500 dark:text-neutral-400" />
                            </div>
                            <div>
                                <p className="font-medium text-gray-900 dark:text-neutral-100">{memberName}</p>
                                {memberPhone && <p className="text-sm text-gray-500 dark:text-neutral-400">{memberPhone}</p>}
                            </div>
                        </div>
                        {memberId && (
                            <button
                                onClick={() => setMemberPanelId(memberId)}
                                className="flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                            >
                                View Member <ExternalLink className="w-3 h-3" />
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Service history */}
            <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-200 dark:border-neutral-800 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 dark:border-neutral-800">
                    <h2 className="text-sm font-semibold text-gray-500 dark:text-neutral-500 uppercase tracking-wide">Service History</h2>
                </div>
                {records.length === 0 ? (
                    <div className="p-10 text-center text-sm text-gray-400 dark:text-neutral-500">No service records yet for this vehicle.</div>
                ) : (
                    <>
                        {/* Desktop */}
                        <div className="hidden md:block">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 dark:bg-neutral-800 border-b border-gray-100 dark:border-neutral-700">
                                    <tr>
                                        <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wide">Date</th>
                                        <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wide">Service</th>
                                        <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wide">Status</th>
                                        <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wide">Payment</th>
                                        <th className="text-right px-5 py-3 text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wide">Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50 dark:divide-neutral-800">
                                    {records.map(r => (
                                        <tr
                                            key={r.id}
                                            onClick={() => router.push(`/admin/service-records/detail?id=${r.id}`)}
                                            className="hover:bg-gray-50 dark:hover:bg-neutral-800 cursor-pointer transition-colors"
                                        >
                                            <td className="px-5 py-3 text-gray-500 dark:text-neutral-400 whitespace-nowrap">{formatDate(r.createdAt)}</td>
                                            <td className="px-5 py-3 font-medium text-gray-900 dark:text-neutral-100">{r.serviceTypeName}</td>
                                            <td className="px-5 py-3"><RecordStatusBadge status={r.status} /></td>
                                            <td className="px-5 py-3"><PaymentStatusBadge status={r.paymentStatus} /></td>
                                            <td className="px-5 py-3 text-right text-gray-700 dark:text-neutral-300">{formatCurrency(r.amountPaid)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {/* Mobile */}
                        <div className="md:hidden divide-y divide-gray-50 dark:divide-neutral-800">
                            {records.map(r => (
                                <div
                                    key={r.id}
                                    onClick={() => router.push(`/admin/service-records/detail?id=${r.id}`)}
                                    className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <p className="font-medium text-gray-900 dark:text-neutral-100">{r.serviceTypeName}</p>
                                            <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">{formatDate(r.createdAt)}</p>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            <RecordStatusBadge status={r.status} />
                                            <p className="text-sm font-medium text-gray-700 dark:text-neutral-300">{formatCurrency(r.amountPaid)}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* Member slide panel */}
            {memberPanelId && (
                <MemberPanel
                    memberId={memberPanelId}
                    siteId={siteId}
                    onClose={() => setMemberPanelId(null)}
                    onOpenFullPage={() => {
                        setMemberPanelId(null);
                        router.push(`/admin/membership/details?id=${memberPanelId}`);
                    }}
                />
            )}
        </div>
    );
}

export default function VehicleDetailPage() {
    return (
        <Suspense fallback={<div className="p-6 text-sm text-gray-400">Loading…</div>}>
            <VehicleDetailContent />
        </Suspense>
    );
}
