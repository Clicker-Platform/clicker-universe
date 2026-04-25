'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, AlertTriangle, ChevronLeft } from 'lucide-react';
import { useSite } from '@/lib/site-context';
import { logger } from '@/lib/logger';
import { useUser } from '@/lib/user-context';
import {
    createServiceRecord,
    findVehicleByPlate,
    createVehicle,
    getServiceTypes,
    getCarCatalog,
} from '../api';
import type { Vehicle, ServiceType, CarCatalogEntry } from '../types';

function RecordFormContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { siteId } = useSite();
    const { user } = useUser();

    // Prefill from booking or query params
    const prefillPlate      = searchParams.get('plate') || '';
    const prefillMemberId   = searchParams.get('memberId') || '';
    const prefillMemberName = searchParams.get('memberName') || '';
    const prefillMemberPhone = searchParams.get('memberPhone') || '';
    const prefillServiceTypeId = searchParams.get('serviceTypeId') || '';
    const bookingId         = searchParams.get('bookingId') || undefined;
    const bookingSource     = searchParams.get('bookingSource') as 'reservation' | undefined;

    // ── Vehicle ────────────────────────────────────────────────────────────────
    const [carCatalog, setCarCatalog] = useState<CarCatalogEntry[]>([]);
    const [plateInput, setPlateInput] = useState(prefillPlate);
    const [vehicleLookupDone, setVehicleLookupDone] = useState(false);
    const [foundVehicle, setFoundVehicle] = useState<Vehicle | null>(null);
    const [plateWarning, setPlateWarning] = useState<string | null>(null);
    const [showNewVehicleFields, setShowNewVehicleFields] = useState(false);
    const [vehicleForm, setVehicleForm] = useState({ color: '', carCatalogId: '' });

    // ── Customer ───────────────────────────────────────────────────────────────
    const [membershipEnabled, setMembershipEnabled] = useState(false);
    const [memberSearch, setMemberSearch] = useState(prefillMemberName);
    const [memberResults, setMemberResults] = useState<{ memberId: string; fullName: string; phone: string }[]>([]);
    const [selectedMemberId, setSelectedMemberId] = useState<string | null>(prefillMemberId || null);
    const [selectedMemberName, setSelectedMemberName] = useState(prefillMemberName);
    const [selectedMemberPhone, setSelectedMemberPhone] = useState(prefillMemberPhone);
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [customerEmail, setCustomerEmail] = useState('');

    // ── Service Type ───────────────────────────────────────────────────────────
    const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
    const [selectedServiceType, setSelectedServiceType] = useState<ServiceType | null>(null);

    // ── UI state ───────────────────────────────────────────────────────────────
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    useEffect(() => {
        if (!siteId) return;
        initPage();
    }, [siteId]);

    async function initPage() {
        setLoading(true);
        try {
            const [types, catalog] = await Promise.all([
                getServiceTypes(siteId, true),
                getCarCatalog(siteId),
            ]);
            setServiceTypes(types);
            setCarCatalog(catalog);

            // Check membership module
            try {
                const { isModuleEnabled } = await import('@/lib/modules/registry');
                setMembershipEnabled(await isModuleEnabled('membership'));
            } catch { /* ignore */ }

            // Prefill service type from booking/query param
            if (prefillServiceTypeId) {
                const match = types.find(t => t.id === prefillServiceTypeId);
                if (match) setSelectedServiceType(match);
            }

            // Auto-lookup prefilled plate
            if (prefillPlate) {
                const vehicle = await findVehicleByPlate(siteId, prefillPlate);
                setVehicleLookupDone(true);
                if (vehicle) {
                    setFoundVehicle(vehicle);
                } else {
                    setShowNewVehicleFields(true);
                }
            }
        } catch (err) {
            logger.error('service-records.record-form.init.failed', { siteId, error: err });
        } finally {
            setLoading(false);
        }
    }

    function showToast(type: 'success' | 'error', message: string) {
        setToast({ type, message });
        setTimeout(() => setToast(null), 4000);
    }

    async function handlePlateSearch() {
        const plate = plateInput.toUpperCase().replace(/\s/g, '');
        if (!plate) return;
        setPlateWarning(null);
        const vehicle = await findVehicleByPlate(siteId, plate);
        setVehicleLookupDone(true);
        if (vehicle) {
            setFoundVehicle(vehicle);
            setShowNewVehicleFields(false);
            if (vehicle.memberId && selectedMemberId && vehicle.memberId !== selectedMemberId) {
                setPlateWarning(
                    `This plate is registered under ${vehicle.memberName || 'another member'}. Proceeding will link this record to that member.`
                );
            }
            if (vehicle.memberId) {
                setSelectedMemberId(vehicle.memberId);
                setSelectedMemberName(vehicle.memberName || '');
            }
        } else {
            setFoundVehicle(null);
            setShowNewVehicleFields(true);
        }
    }

    async function handleMemberSearch(term: string) {
        setMemberSearch(term);
        if (term.length < 3 || !membershipEnabled) return;
        try {
            const { searchMembers } = await import('@/lib/modules/membership/api');
            const results = await searchMembers(siteId, term);
            setMemberResults(results.map((m: any) => ({
                memberId: m.id,
                fullName: m.fullName || '',
                phone: m.phoneNumber || '',
            })));
        } catch (err) {
            logger.error('service-records.record-form.member-search.failed', { siteId, error: err });
        }
    }

    function selectMember(member: { memberId: string; fullName: string; phone: string }) {
        setSelectedMemberId(member.memberId);
        setSelectedMemberName(member.fullName);
        setSelectedMemberPhone(member.phone);
        setMemberSearch(member.fullName);
        setMemberResults([]);
    }

    async function handleSave() {
        const plate = plateInput.toUpperCase().replace(/\s/g, '');
        if (!plate) { showToast('error', 'Plate number is required'); return; }
        if (!vehicleLookupDone) { showToast('error', 'Please look up the plate number first'); return; }
        if (!selectedServiceType) { showToast('error', 'Please select a service type'); return; }

        setSubmitting(true);
        try {
            let vehicleId = foundVehicle?.id;

            if (!vehicleId && showNewVehicleFields) {
                vehicleId = await createVehicle(siteId, {
                    plateNumber: plate,
                    carCatalogId: vehicleForm.carCatalogId || undefined,
                    color: vehicleForm.color || undefined,
                    memberId: selectedMemberId || undefined,
                    memberName: selectedMemberName || undefined,
                });
            }

            if (!vehicleId) {
                showToast('error', 'Vehicle ID is missing. Please search the plate first.');
                setSubmitting(false);
                return;
            }

            const ownerName  = selectedMemberId ? selectedMemberName : customerName;
            const ownerPhone = selectedMemberId ? selectedMemberPhone : customerPhone;

            const newId = await createServiceRecord(siteId, {
                vehicleId,
                vehiclePlate: plate,
                memberId: selectedMemberId || null,
                memberName: ownerName || null,
                memberPhone: ownerPhone || null,
                memberEmail: customerEmail || null,
                serviceTypeId: selectedServiceType.id,
                serviceTypeName: selectedServiceType.name,
                hasWarranty: selectedServiceType.hasWarranty,
                warrantyMonths: selectedServiceType.defaultWarrantyMonths || 12,
                totalAmount: 0,
                amountPaid: 0,
                paymentStatus: 'UNPAID',
                createdBy: user?.email || user?.uid || 'unknown',
                ...(bookingId ? { bookingId, bookingSource: bookingSource || 'reservation' } : {}),
            } as any);

            router.push(`/admin/service-records/detail?id=${newId}`);
        } catch (err: any) {
            logger.error('service-records.record-form.save.failed', { siteId, error: err });
            showToast('error', err.message || 'Failed to save record');
        } finally {
            setSubmitting(false);
        }
    }

    if (loading) {
        return (
            <div className="animate-pulse space-y-4 max-w-2xl">
                <div className="h-8 bg-gray-200 dark:bg-neutral-700 rounded w-48" />
                <div className="h-48 bg-gray-200 dark:bg-neutral-700 rounded-lg" />
                <div className="h-48 bg-gray-200 dark:bg-neutral-700 rounded-lg" />
                <div className="h-32 bg-gray-200 dark:bg-neutral-700 rounded-lg" />
            </div>
        );
    }

    return (
        <div className="max-w-2xl space-y-5">
            {toast && (
                <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-sm font-medium shadow-lg ${
                    toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                }`}>
                    {toast.message}
                </div>
            )}

            {/* Header */}
            <div className="flex items-center gap-3">
                <button
                    onClick={() => router.back()}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-500 dark:text-neutral-400"
                >
                    <ChevronLeft className="w-5 h-5" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-neutral-100">New Service Record</h1>
                    <p className="text-sm text-gray-500 dark:text-neutral-500 mt-0.5">
                        {bookingId ? `From booking — fill in vehicle and confirm service.` : `Car in workshop — log it now.`}
                    </p>
                </div>
            </div>

            {/* Section 1: Customer */}
            <div className="bg-white dark:bg-neutral-900 p-6 rounded-lg border border-gray-200 dark:border-neutral-800 space-y-4">
                <h2 className="text-base font-semibold text-gray-800 dark:text-neutral-200">Customer</h2>

                {/* Member search (if membership module enabled) */}
                {membershipEnabled && (
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300">
                            Search member
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                value={memberSearch}
                                onChange={e => handleMemberSearch(e.target.value)}
                                placeholder="Type name or phone…"
                                className="w-full rounded-lg border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-gray-400 dark:focus:border-neutral-500 focus:ring-0 px-3 py-2 text-sm"
                            />
                            {memberResults.length > 0 && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                                    {memberResults.map(m => (
                                        <button
                                            key={m.memberId}
                                            type="button"
                                            onClick={() => selectMember(m)}
                                            className="w-full px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-neutral-700 text-sm"
                                        >
                                            <p className="font-medium text-gray-900 dark:text-neutral-100">{m.fullName}</p>
                                            <p className="text-xs text-gray-500 dark:text-neutral-500">{m.phone}</p>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        {selectedMemberId && (
                            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 rounded-lg p-3 text-sm">
                                <p className="font-semibold text-blue-700 dark:text-blue-400">{selectedMemberName}</p>
                                <p className="text-blue-500 dark:text-blue-400/70 text-xs">{selectedMemberPhone}</p>
                                <button
                                    type="button"
                                    onClick={() => { setSelectedMemberId(null); setSelectedMemberName(''); setSelectedMemberPhone(''); setMemberSearch(''); }}
                                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1"
                                >
                                    Clear member
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Walk-in fields */}
                {!selectedMemberId && (
                    <div className="space-y-3">
                        {membershipEnabled && (
                            <p className="text-xs text-gray-500 dark:text-neutral-500">
                                Or enter walk-in details:
                            </p>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-medium text-gray-600 dark:text-neutral-400 mb-1">Name</label>
                                <input
                                    type="text"
                                    value={customerName}
                                    onChange={e => setCustomerName(e.target.value)}
                                    placeholder="Customer name"
                                    className="w-full rounded-lg border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-gray-400 dark:focus:border-neutral-500 focus:ring-0 px-3 py-2 text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 dark:text-neutral-400 mb-1">Phone</label>
                                <input
                                    type="tel"
                                    value={customerPhone}
                                    onChange={e => setCustomerPhone(e.target.value)}
                                    placeholder="08xx-xxxx-xxxx"
                                    className="w-full rounded-lg border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-gray-400 dark:focus:border-neutral-500 focus:ring-0 px-3 py-2 text-sm"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-neutral-400 mb-1">Email</label>
                            <input
                                type="email"
                                value={customerEmail}
                                onChange={e => setCustomerEmail(e.target.value)}
                                placeholder="customer@email.com (optional)"
                                className="w-full rounded-lg border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-gray-400 dark:focus:border-neutral-500 focus:ring-0 px-3 py-2 text-sm"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Section 2: Vehicle */}
            <div className="bg-white dark:bg-neutral-900 p-6 rounded-lg border border-gray-200 dark:border-neutral-800 space-y-4">
                <h2 className="text-base font-semibold text-gray-800 dark:text-neutral-200">Vehicle</h2>

                <div className="flex gap-2">
                    <input
                        type="text"
                        value={plateInput}
                        onChange={e => {
                            setPlateInput(e.target.value.toUpperCase().replace(/\s/g, ''));
                            setVehicleLookupDone(false);
                            setFoundVehicle(null);
                            setShowNewVehicleFields(false);
                            setPlateWarning(null);
                        }}
                        placeholder="Plate number e.g. B2022XYZ"
                        className="flex-1 font-mono rounded-lg border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-gray-400 dark:focus:border-neutral-500 focus:ring-0 px-3 py-2 text-sm"
                    />
                    <button
                        type="button"
                        onClick={handlePlateSearch}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 text-sm font-medium hover:bg-gray-50 dark:hover:bg-neutral-800 dark:text-neutral-200"
                    >
                        <Search className="w-4 h-4" />
                        Look up
                    </button>
                </div>

                {plateWarning && (
                    <div className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/50 rounded-lg p-3">
                        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        {plateWarning}
                    </div>
                )}

                {vehicleLookupDone && foundVehicle && (
                    <div className="bg-green-50 dark:bg-green-950/30 border border-green-100 dark:border-green-900/50 rounded-lg p-3 text-sm">
                        <p className="font-semibold text-green-700 dark:text-green-400">Vehicle found</p>
                        <p className="text-green-600 dark:text-green-500">
                            {foundVehicle.plateNumber}{foundVehicle.color && ` · ${foundVehicle.color}`}
                        </p>
                    </div>
                )}

                {vehicleLookupDone && showNewVehicleFields && (
                    <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 rounded-lg p-4 space-y-3">
                        <p className="text-sm font-medium text-blue-700 dark:text-blue-400">
                            New vehicle — enter details to register.
                        </p>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-neutral-400 mb-1">
                                Car Type <span className="text-gray-400">(optional)</span>
                            </label>
                            <select
                                value={vehicleForm.carCatalogId}
                                onChange={e => setVehicleForm(f => ({ ...f, carCatalogId: e.target.value }))}
                                className="w-full rounded-lg border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-gray-400 dark:focus:border-neutral-500 focus:ring-0 px-3 py-2 text-sm"
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
                            <label className="block text-xs font-medium text-gray-600 dark:text-neutral-400 mb-1">
                                Color <span className="text-gray-400">(optional)</span>
                            </label>
                            <input
                                type="text"
                                value={vehicleForm.color}
                                onChange={e => setVehicleForm(f => ({ ...f, color: e.target.value }))}
                                placeholder="e.g. Black, White, Silver"
                                className="w-full rounded-lg border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-gray-400 dark:focus:border-neutral-500 focus:ring-0 px-3 py-2 text-sm"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Section 3: Service Type */}
            <div className="bg-white dark:bg-neutral-900 p-6 rounded-lg border border-gray-200 dark:border-neutral-800 space-y-4">
                <h2 className="text-base font-semibold text-gray-800 dark:text-neutral-200">Service</h2>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">
                        Service Type <span className="text-red-500">*</span>
                    </label>
                    <select
                        value={selectedServiceType?.id || ''}
                        onChange={e => {
                            const type = serviceTypes.find(t => t.id === e.target.value) || null;
                            setSelectedServiceType(type);
                        }}
                        className="w-full rounded-lg border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-gray-400 dark:focus:border-neutral-500 focus:ring-0 px-3 py-2 text-sm"
                    >
                        <option value="">Select service type…</option>
                        {serviceTypes.map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                    </select>
                    {selectedServiceType?.hasWarranty && (
                        <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                            ✓ Warranty card will be issued on completion.
                        </p>
                    )}
                </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pb-8">
                <button
                    type="button"
                    onClick={() => router.back()}
                    className="px-5 py-2.5 rounded-lg border border-gray-200 dark:border-neutral-700 text-sm font-medium text-gray-700 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-800"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={submitting}
                    className="bg-studio-blue text-white px-6 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50"
                >
                    {submitting ? 'Creating…' : 'Create Service Record'}
                </button>
            </div>
        </div>
    );
}

export default function RecordFormPage() {
    return (
        <Suspense fallback={<div className="p-6 text-sm text-gray-400 dark:text-neutral-500">Loading…</div>}>
            <RecordFormContent />
        </Suspense>
    );
}
