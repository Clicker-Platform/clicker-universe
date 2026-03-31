'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, AlertTriangle, ChevronLeft } from 'lucide-react';
import { useSite } from '@/lib/site-context';
import { useUser } from '@/lib/user-context';
import {
    getServiceRecord,
    createServiceRecord,
    updateServiceRecord,
    findVehicleByPlate,
    createVehicle,
    getServiceTypes,
    getCarCatalog,
    addCarCatalogEntry,
    ensureCarCatalogEntry,
    getVehicles,
} from '../api';
import type { ServiceRecord, Vehicle, ServiceType, CarCatalogEntry, PaymentMethod, PaymentStatus } from '../types';

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
    { value: 'CASH',     label: 'Cash' },
    { value: 'TRANSFER', label: 'Bank Transfer' },
    { value: 'CARD',     label: 'Debit/Credit Card' },
    { value: 'QRIS',     label: 'QRIS' },
];

function RecordFormContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const recordId = searchParams.get('id');
    const { siteId } = useSite();
    const { user } = useUser();

    // Vehicle section
    const [allVehicles, setAllVehicles] = useState<Vehicle[]>([]);
    const [carCatalog, setCarCatalog] = useState<CarCatalogEntry[]>([]);
    const [showAddCar, setShowAddCar] = useState(false);
    const [plateInput, setPlateInput] = useState('');
    const [vehicleLookupDone, setVehicleLookupDone] = useState(false);
    const [foundVehicle, setFoundVehicle] = useState<Vehicle | null>(null);
    const [plateWarning, setPlateWarning] = useState<string | null>(null);
    const [showNewVehicleFields, setShowNewVehicleFields] = useState(false);
    const [vehicleForm, setVehicleForm] = useState({ make: '', model: '', color: '', type: 'OTHER' });

    // Member / customer section
    const [memberSearch, setMemberSearch] = useState('');
    const [memberResults, setMemberResults] = useState<{ memberId: string; fullName: string; phone: string }[]>([]);
    const [membershipEnabled, setMembershipEnabled] = useState(false);
    const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
    const [selectedMemberName, setSelectedMemberName] = useState('');
    const [selectedMemberPhone, setSelectedMemberPhone] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [customerEmail, setCustomerEmail] = useState('');

    // Service type
    const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
    const [selectedServiceType, setSelectedServiceType] = useState<ServiceType | null>(null);
    const [productUsed, setProductUsed] = useState('');
    const [inventoryItemId, setInventoryItemId] = useState<string | null>(null);
    const [warrantyMonths, setWarrantyMonths] = useState(12);
    const [notes, setNotes] = useState('');

    // Inventory picker state
    const [inventoryEnabled, setInventoryEnabled] = useState(false);
    const [inventoryItems, setInventoryItems] = useState<{ id: string; name: string; currentStock: number; unit: string }[]>([]);

    // Payment
    const [totalAmount, setTotalAmount] = useState(0);
    const [amountPaid, setAmountPaid] = useState(0);
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>('');

    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const isEditMode = !!recordId;

    // Derived
    const paymentStatus: PaymentStatus =
        amountPaid <= 0 ? 'UNPAID'
        : amountPaid >= totalAmount ? 'PAID'
        : 'PARTIAL';

    useEffect(() => {
        if (!siteId) return;
        initPage();
    }, [siteId, recordId]);

    async function initPage() {
        setLoading(true);
        try {
            const [types, catalog, vehicles] = await Promise.all([
                getServiceTypes(siteId, true),
                getCarCatalog(siteId),
                getVehicles(siteId),
            ]);
            setServiceTypes(types);
            setCarCatalog(catalog);
            setAllVehicles(vehicles);

            // Check optional modules
            try {
                const { isModuleEnabled } = await import('@/lib/modules/registry');
                const [membershipOn, inventoryOn] = await Promise.all([
                    isModuleEnabled('membership'),
                    isModuleEnabled('inventory'),
                ]);
                setMembershipEnabled(membershipOn);
                setInventoryEnabled(inventoryOn);

                if (inventoryOn) {
                    const { getInventory } = await import('@/lib/modules/inventory/api');
                    const items = await getInventory(siteId);
                    setInventoryItems(items.map(i => ({ id: i.id, name: i.name, currentStock: i.currentStock, unit: i.unit })));
                }
            } catch { /* ignore */ }

            // Load existing record for edit mode
            if (recordId) {
                const record = await getServiceRecord(siteId, recordId);
                if (record) {
                    setPlateInput(record.vehiclePlate);
                    setVehicleLookupDone(true);
                    // Hydrate vehicle so vehicleId is available on save
                    const existingVehicle = await findVehicleByPlate(siteId, record.vehiclePlate);
                    if (existingVehicle) {
                        setFoundVehicle(existingVehicle);
                    } else {
                        // Vehicle may have been deleted — use a stub so vehicleId is preserved
                        setFoundVehicle({ id: record.vehicleId, plateNumber: record.vehiclePlate } as Vehicle);
                    }
                    if (record.memberId) {
                        setSelectedMemberId(record.memberId);
                        setSelectedMemberName(record.memberName || '');
                        setSelectedMemberPhone(record.memberPhone || '');
                    } else {
                        setCustomerName(record.memberName || '');
                        setCustomerPhone(record.memberPhone || '');
                        setCustomerEmail(record.memberEmail || '');
                    }
                    const sType = types.find(t => t.id === record.serviceTypeId) || null;
                    setSelectedServiceType(sType);
                    setProductUsed(record.productUsed || '');
                    setInventoryItemId(record.inventoryItemId || null);
                    setWarrantyMonths(record.warrantyMonths || 12);
                    setNotes(record.notes || '');
                    setTotalAmount(record.totalAmount || 0);
                    setAmountPaid(record.amountPaid || 0);
                    setPaymentMethod(record.paymentMethod || '');
                }
            }
        } catch (err) {
            console.error('[SR RecordFormPage] initPage error:', err);
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
            console.error('[SR RecordFormPage] member search error:', err);
        }
    }

    function selectMember(member: { memberId: string; fullName: string; phone: string }) {
        setSelectedMemberId(member.memberId);
        setSelectedMemberName(member.fullName);
        setSelectedMemberPhone(member.phone);
        setMemberSearch(member.fullName);
        setMemberResults([]);
    }

    function handleServiceTypeSelect(typeId: string) {
        const type = serviceTypes.find(t => t.id === typeId) || null;
        setSelectedServiceType(type);
        if (type?.defaultWarrantyMonths) setWarrantyMonths(type.defaultWarrantyMonths);
        if (type?.defaultPrice && !isEditMode) setTotalAmount(type.defaultPrice);
    }

    async function handleSave(saveAsInProgress = false) {
        const plate = plateInput.toUpperCase().replace(/\s/g, '');
        if (!plate) { showToast('error', 'Plate number is required'); return; }
        if (!selectedServiceType) { showToast('error', 'Please select a service type'); return; }

        setSubmitting(true);
        try {
            let vehicleId = foundVehicle?.id;

            // Create vehicle if new
            if (!vehicleId && showNewVehicleFields) {
                vehicleId = await createVehicle(siteId, {
                    plateNumber: plate,
                    make: vehicleForm.make || undefined,
                    model: vehicleForm.model || undefined,
                    color: vehicleForm.color || undefined,
                    type: vehicleForm.type as any,
                    memberId: selectedMemberId || undefined,
                    memberName: selectedMemberName || undefined,
                });

                // Auto-add to car catalog if make/model provided
                if (vehicleForm.make && vehicleForm.model) {
                    ensureCarCatalogEntry(siteId, {
                        make: vehicleForm.make,
                        model: vehicleForm.model,
                        type: vehicleForm.type as any,
                    }).catch(console.error); // non-blocking
                }
            }

            if (!vehicleId) {
                showToast('error', 'Vehicle ID is missing. Please search the plate first.');
                setSubmitting(false);
                return;
            }

            const ownerName = selectedMemberId ? selectedMemberName : customerName;
            const ownerPhone = selectedMemberId ? selectedMemberPhone : customerPhone;

            const recordData = {
                vehicleId,
                vehiclePlate: plate,
                memberId: selectedMemberId || null,
                memberName: ownerName || null,
                memberPhone: ownerPhone || null,
                memberEmail: customerEmail || null,
                serviceTypeId: selectedServiceType.id,
                serviceTypeName: selectedServiceType.name,
                hasWarranty: selectedServiceType.hasWarranty,
                warrantyMonths: selectedServiceType.hasWarranty ? warrantyMonths : 0,
                productUsed: productUsed || null,
                inventoryItemId: inventoryItemId || null,
                notes: notes || null,
                totalAmount,
                amountPaid,
                paymentStatus,
                paymentMethod: paymentMethod || null,
                createdBy: user?.email || user?.uid || 'unknown',
            };

            let newId = recordId;
            if (isEditMode && recordId) {
                await updateServiceRecord(siteId, recordId, {
                    ...recordData,
                    ...(saveAsInProgress ? { status: 'IN_PROGRESS' } : {}),
                } as any);
            } else {
                newId = await createServiceRecord(siteId, recordData as any);
                if (saveAsInProgress && newId) {
                    await updateServiceRecord(siteId, newId, { status: 'IN_PROGRESS' });
                }
            }

            router.push(`/admin/service-records/detail?id=${newId}`);
        } catch (err: any) {
            console.error('[SR RecordFormPage] save error:', err);
            showToast('error', err.message || 'Failed to save record');
        } finally {
            setSubmitting(false);
        }
    }

    if (loading) {
        return (
            <div className="p-6">
                <div className="animate-pulse space-y-4 max-w-2xl">
                    <div className="h-8 bg-gray-200 dark:bg-neutral-700 rounded w-48" />
                    <div className="h-48 bg-gray-200 dark:bg-neutral-700 rounded-2xl" />
                    <div className="h-48 bg-gray-200 dark:bg-neutral-700 rounded-2xl" />
                </div>
            </div>
        );
    }

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
                <button
                    onClick={() => router.back()}
                    className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-500 dark:text-neutral-400"
                >
                    <ChevronLeft className="w-5 h-5" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-neutral-100">
                        {isEditMode ? 'Edit Record' : 'New Service Record'}
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-neutral-500 mt-0.5">Fill in vehicle, customer, and service details.</p>
                </div>
            </div>

            {/* Section 1: Vehicle */}
            <div className="bg-white dark:bg-neutral-900 p-6 rounded-2xl border border-gray-200 dark:border-neutral-800 shadow-sm space-y-4">
                <h2 className="text-base font-semibold text-gray-800 dark:text-neutral-200">Vehicle</h2>

                {/* Select existing vehicle */}
                {allVehicles.length > 0 && (
                    <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-neutral-400 mb-1">Select existing vehicle</label>
                        <select
                            value={foundVehicle?.id || ''}
                            onChange={e => {
                                const v = allVehicles.find(v => v.id === e.target.value);
                                if (v) {
                                    setFoundVehicle(v);
                                    setPlateInput(v.plateNumber);
                                    setVehicleLookupDone(true);
                                    setShowNewVehicleFields(false);
                                    if (v.memberId) {
                                        setSelectedMemberId(v.memberId);
                                        setSelectedMemberName(v.memberName || '');
                                    }
                                } else {
                                    setFoundVehicle(null);
                                    setVehicleLookupDone(false);
                                }
                            }}
                            className="w-full rounded-xl border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-gray-400 dark:focus:border-neutral-500 focus:ring-0 px-3 py-2 text-sm"
                        >
                            <option value="">— Select vehicle —</option>
                            {allVehicles.map(v => (
                                <option key={v.id} value={v.id}>
                                    {v.plateNumber} — {v.make || '?'} {v.model || ''}{v.color ? ` · ${v.color}` : ''}{v.memberName ? ` · ${v.memberName}` : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Or enter new plate */}
                {!foundVehicle && (
                    <>
                        {allVehicles.length > 0 && (
                            <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-neutral-500">
                                <div className="flex-1 border-t border-gray-200 dark:border-neutral-700" />
                                or enter new plate number
                                <div className="flex-1 border-t border-gray-200 dark:border-neutral-700" />
                            </div>
                        )}
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={plateInput}
                                onChange={e => {
                                    setPlateInput(e.target.value.toUpperCase().replace(/\s/g, ''));
                                    setVehicleLookupDone(false);
                                    setFoundVehicle(null);
                                    setShowNewVehicleFields(false);
                                }}
                                placeholder="Enter plate number"
                                className="flex-1 font-mono rounded-xl border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-gray-400 dark:focus:border-neutral-500 focus:ring-0 px-3 py-2 text-sm"
                            />
                            <button
                                type="button"
                                onClick={handlePlateSearch}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 dark:border-neutral-700 text-sm font-medium hover:bg-gray-50 dark:hover:bg-neutral-800 dark:text-neutral-200"
                            >
                                <Search className="w-4 h-4" />
                                Look up
                            </button>
                        </div>
                    </>
                )}

                {vehicleLookupDone && foundVehicle && (
                    <div className="bg-green-50 dark:bg-green-950/30 border border-green-100 dark:border-green-900/50 rounded-xl p-3 text-sm">
                        <p className="font-semibold text-green-700 dark:text-green-400">Vehicle found</p>
                        <p className="text-green-600 dark:text-green-500">
                            {foundVehicle.make ? `${foundVehicle.make} ${foundVehicle.model || ''}`.trim() : 'No make/model'}
                            {foundVehicle.color && ` · ${foundVehicle.color}`}
                            {foundVehicle.type && ` · ${foundVehicle.type}`}
                        </p>
                    </div>
                )}

                {vehicleLookupDone && !foundVehicle && showNewVehicleFields && (
                    <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 rounded-xl p-4 space-y-3">
                        <p className="text-sm font-medium text-blue-700 dark:text-blue-400">
                            No vehicle found for {plateInput}. Enter details to create a new vehicle profile.
                        </p>
                        {plateWarning && (
                            <div className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                                {plateWarning}
                            </div>
                        )}

                        {/* Car type — select from catalog or add new */}
                        <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-neutral-400 mb-1">Car Type</label>
                            {carCatalog.length > 0 && !showAddCar ? (
                                <div className="space-y-2">
                                    <select
                                        value={vehicleForm.make && vehicleForm.model
                                            ? carCatalog.find(c => c.make === vehicleForm.make && c.model === vehicleForm.model)?.id || ''
                                            : ''}
                                        onChange={e => {
                                            const car = carCatalog.find(c => c.id === e.target.value);
                                            if (car) {
                                                setVehicleForm(f => ({
                                                    ...f,
                                                    make: car.make,
                                                    model: car.model,
                                                    type: car.type,
                                                }));
                                            }
                                        }}
                                        className="w-full rounded-xl border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-gray-400 dark:focus:border-neutral-500 focus:ring-0 px-3 py-2 text-sm"
                                    >
                                        <option value="">— Select car type —</option>
                                        {carCatalog.map(car => (
                                            <option key={car.id} value={car.id}>
                                                {car.make} {car.model} ({car.type})
                                            </option>
                                        ))}
                                    </select>
                                    <button
                                        type="button"
                                        onClick={() => setShowAddCar(true)}
                                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
                                    >
                                        + Add new car type
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        <input
                                            type="text"
                                            value={vehicleForm.make}
                                            onChange={e => setVehicleForm(f => ({ ...f, make: e.target.value }))}
                                            placeholder="Make (Toyota)"
                                            className="rounded-xl border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-gray-400 dark:focus:border-neutral-500 focus:ring-0 px-3 py-2 text-sm"
                                        />
                                        <input
                                            type="text"
                                            value={vehicleForm.model}
                                            onChange={e => setVehicleForm(f => ({ ...f, model: e.target.value }))}
                                            placeholder="Model (Fortuner)"
                                            className="rounded-xl border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-gray-400 dark:focus:border-neutral-500 focus:ring-0 px-3 py-2 text-sm"
                                        />
                                    </div>
                                    <select
                                        value={vehicleForm.type}
                                        onChange={e => setVehicleForm(f => ({ ...f, type: e.target.value }))}
                                        className="w-full rounded-xl border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-gray-400 dark:focus:border-neutral-500 focus:ring-0 px-3 py-2 text-sm"
                                    >
                                        {['SEDAN','SUV','MPV','HATCHBACK','PICKUP','MOTORCYCLE','OTHER'].map(t => (
                                            <option key={t} value={t}>{t}</option>
                                        ))}
                                    </select>
                                    {carCatalog.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => setShowAddCar(false)}
                                            className="text-xs text-gray-500 dark:text-neutral-500 hover:underline"
                                        >
                                            ← Back to catalog
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Color — always separate since it's per-vehicle */}
                        <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-neutral-400 mb-1">Color</label>
                            <input
                                type="text"
                                value={vehicleForm.color}
                                onChange={e => setVehicleForm(f => ({ ...f, color: e.target.value }))}
                                placeholder="e.g. Black, White, Silver"
                                className="w-full rounded-xl border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-gray-400 dark:focus:border-neutral-500 focus:ring-0 px-3 py-2 text-sm"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Section 2: Customer */}
            <div className="bg-white dark:bg-neutral-900 p-6 rounded-2xl border border-gray-200 dark:border-neutral-800 shadow-sm space-y-4">
                <h2 className="text-base font-semibold text-gray-800 dark:text-neutral-200">Customer</h2>
                {membershipEnabled ? (
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300">Search Member</label>
                        <div className="relative">
                            <input
                                type="text"
                                value={memberSearch}
                                onChange={e => handleMemberSearch(e.target.value)}
                                placeholder="Type name or phone (min 3 chars)…"
                                className="w-full rounded-xl border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-gray-400 dark:focus:border-neutral-500 focus:ring-0 px-3 py-2 text-sm"
                            />
                            {memberResults.length > 0 && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-xl shadow-lg z-10 max-h-48 overflow-y-auto">
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
                            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 rounded-xl p-3 text-sm">
                                <p className="font-semibold text-blue-700 dark:text-blue-400">{selectedMemberName}</p>
                                <p className="text-blue-500 dark:text-blue-400/70 text-xs">{selectedMemberPhone} · Member ID: {selectedMemberId.slice(0, 8)}…</p>
                                <button
                                    type="button"
                                    onClick={() => { setSelectedMemberId(null); setSelectedMemberName(''); setSelectedMemberPhone(''); setMemberSearch(''); }}
                                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1"
                                >
                                    Clear member
                                </button>
                            </div>
                        )}
                        {!selectedMemberId && (
                            <p className="text-xs text-gray-400 dark:text-neutral-500">No member selected — record will be treated as walk-in.</p>
                        )}
                    </div>
                ) : null}

                {/* Walk-in fields — always shown if no member selected */}
                {!selectedMemberId && (
                    <div className="space-y-3">
                        {membershipEnabled && (
                            <p className="text-xs text-gray-500 dark:text-neutral-500 font-medium">Walk-in customer info (optional):</p>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-medium text-gray-600 dark:text-neutral-400 mb-1">Name</label>
                                <input
                                    type="text"
                                    value={customerName}
                                    onChange={e => setCustomerName(e.target.value)}
                                    placeholder="Customer name"
                                    className="w-full rounded-xl border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-gray-400 dark:focus:border-neutral-500 focus:ring-0 px-3 py-2 text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 dark:text-neutral-400 mb-1">Phone</label>
                                <input
                                    type="tel"
                                    value={customerPhone}
                                    onChange={e => setCustomerPhone(e.target.value)}
                                    placeholder="08xx-xxxx-xxxx"
                                    className="w-full rounded-xl border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-gray-400 dark:focus:border-neutral-500 focus:ring-0 px-3 py-2 text-sm"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-neutral-400 mb-1">Email</label>
                            <input
                                type="email"
                                value={customerEmail}
                                onChange={e => setCustomerEmail(e.target.value)}
                                placeholder="customer@email.com"
                                className="w-full rounded-xl border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-gray-400 dark:focus:border-neutral-500 focus:ring-0 px-3 py-2 text-sm"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Section 3: Service */}
            <div className="bg-white dark:bg-neutral-900 p-6 rounded-2xl border border-gray-200 dark:border-neutral-800 shadow-sm space-y-4">
                <h2 className="text-base font-semibold text-gray-800 dark:text-neutral-200">Service Details</h2>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">Service Type *</label>
                    <select
                        value={selectedServiceType?.id || ''}
                        onChange={e => handleServiceTypeSelect(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-gray-400 dark:focus:border-neutral-500 focus:ring-0 px-3 py-2 text-sm"
                    >
                        <option value="">Select service type…</option>
                        {serviceTypes.map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                    </select>
                    {selectedServiceType?.hasWarranty && (
                        <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                            ✓ This service type issues a warranty card on completion.
                        </p>
                    )}
                </div>

                {selectedServiceType?.hasWarranty && (
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">Warranty Duration (months)</label>
                        <input
                            type="number"
                            min={1}
                            max={120}
                            value={warrantyMonths}
                            onChange={e => setWarrantyMonths(parseInt(e.target.value) || 12)}
                            className="w-32 rounded-xl border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-gray-400 dark:focus:border-neutral-500 focus:ring-0 px-3 py-2 text-sm"
                        />
                    </div>
                )}

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">Product Used</label>
                    {inventoryEnabled && inventoryItems.length > 0 ? (
                        <div className="space-y-1.5">
                            <select
                                value={inventoryItemId || ''}
                                onChange={e => {
                                    const id = e.target.value;
                                    setInventoryItemId(id || null);
                                    const item = inventoryItems.find(i => i.id === id);
                                    setProductUsed(item ? item.name : '');
                                }}
                                className="w-full rounded-xl border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-gray-400 dark:focus:border-neutral-500 focus:ring-0 px-3 py-2 text-sm"
                            >
                                <option value="">— Select from inventory —</option>
                                {inventoryItems.map(item => (
                                    <option key={item.id} value={item.id}>
                                        {item.name} (Stock: {item.currentStock} {item.unit})
                                    </option>
                                ))}
                            </select>
                            {inventoryItemId && (
                                <p className="text-xs text-green-700 dark:text-green-400">
                                    1 unit will be deducted from inventory on approval.
                                </p>
                            )}
                            {!inventoryItemId && (
                                <input
                                    type="text"
                                    value={productUsed}
                                    onChange={e => setProductUsed(e.target.value)}
                                    placeholder="Or type a free-text product name…"
                                    className="w-full rounded-xl border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-gray-400 dark:focus:border-neutral-500 focus:ring-0 px-3 py-2 text-sm"
                                />
                            )}
                        </div>
                    ) : (
                        <input
                            type="text"
                            value={productUsed}
                            onChange={e => setProductUsed(e.target.value)}
                            placeholder="e.g. Ceramic Pro Gold 9H"
                            className="w-full rounded-xl border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-gray-400 dark:focus:border-neutral-500 focus:ring-0 px-3 py-2 text-sm"
                        />
                    )}
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">Notes</label>
                    <textarea
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        rows={3}
                        placeholder="Internal notes…"
                        className="w-full rounded-xl border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-gray-400 dark:focus:border-neutral-500 focus:ring-0 px-3 py-2 text-sm resize-none"
                    />
                </div>
            </div>

            {/* Section 4: Payment */}
            <div className="bg-white dark:bg-neutral-900 p-6 rounded-2xl border border-gray-200 dark:border-neutral-800 shadow-sm space-y-4">
                <h2 className="text-base font-semibold text-gray-800 dark:text-neutral-200">Payment</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">Total Amount (Rp) *</label>
                        <input
                            type="number"
                            min={0}
                            value={totalAmount || ''}
                            onChange={e => setTotalAmount(parseFloat(e.target.value) || 0)}
                            placeholder="0"
                            className="w-full rounded-xl border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-gray-400 dark:focus:border-neutral-500 focus:ring-0 px-3 py-2 text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">Amount Paid (Rp)</label>
                        <input
                            type="number"
                            min={0}
                            max={totalAmount || undefined}
                            value={amountPaid || ''}
                            onChange={e => setAmountPaid(parseFloat(e.target.value) || 0)}
                            placeholder="0"
                            className="w-full rounded-xl border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-gray-400 dark:focus:border-neutral-500 focus:ring-0 px-3 py-2 text-sm"
                        />
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">Payment Method</label>
                    <select
                        value={paymentMethod}
                        onChange={e => setPaymentMethod(e.target.value as PaymentMethod | '')}
                        className="w-full sm:w-64 rounded-xl border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-gray-400 dark:focus:border-neutral-500 focus:ring-0 px-3 py-2 text-sm"
                    >
                        <option value="">Not specified</option>
                        {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                </div>
                <div className="text-sm text-gray-500 dark:text-neutral-500">
                    Payment status: <span className={`font-medium ${
                        paymentStatus === 'PAID' ? 'text-green-600 dark:text-green-400' :
                        paymentStatus === 'PARTIAL' ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-500 dark:text-red-400'
                    }`}>{paymentStatus}</span>
                </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pb-8">
                <button
                    type="button"
                    onClick={() => router.back()}
                    className="px-5 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-700 text-sm font-medium text-gray-700 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-800"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={() => handleSave(false)}
                    disabled={submitting}
                    className="px-5 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-700 text-sm font-medium text-gray-700 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-800 disabled:opacity-50"
                >
                    {submitting ? 'Saving…' : 'Save as Draft'}
                </button>
                <button
                    type="button"
                    onClick={() => handleSave(true)}
                    disabled={submitting}
                    className="bg-studio-blue text-white px-6 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50"
                >
                    {submitting ? 'Saving…' : 'Save & Start Job'}
                </button>
            </div>
        </div>
    );
}

export default function RecordFormPage() {
    return (
        <Suspense fallback={<div className="p-6 text-sm text-gray-400 dark:text-neutral-500">Loading form…</div>}>
            <RecordFormContent />
        </Suspense>
    );
}
