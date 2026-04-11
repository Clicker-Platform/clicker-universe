'use client';

import { useEffect, useState } from 'react';
import { Plus, Edit2, Car, Search, AlertTriangle, List } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSite } from '@/lib/site-context';
import { getVehicles, createVehicle, updateVehicle, findVehicleByPlate, getCarCatalog, addCarCatalogEntry } from '../api';
import type { Vehicle, CarCatalogEntry, VehicleType } from '../types';

const VEHICLE_TYPES: VehicleType[] = ['SEDAN', 'SUV', 'MPV', 'HATCHBACK', 'PICKUP', 'MOTORCYCLE', 'OTHER'];

const EMPTY_VEHICLE_FORM: Partial<Omit<Vehicle, 'id' | 'outletId' | 'createdAt' | 'updatedAt'>> = {
    plateNumber: '',
    carCatalogId: '',
    color: '',
};

const EMPTY_CAR_TYPE_FORM = { make: '', model: '', type: 'SEDAN' as VehicleType };

type Tab = 'vehicles' | 'car-types';

export default function VehiclesPage() {
    const { siteId } = useSite();
    const router = useRouter();
    const [tab, setTab] = useState<Tab>('vehicles');

    // Vehicles state
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [carCatalog, setCarCatalog] = useState<CarCatalogEntry[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
    const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
    const [vehicleForm, setVehicleForm] = useState(EMPTY_VEHICLE_FORM);
    const [plateWarning, setPlateWarning] = useState<string | null>(null);
    const [vehicleSubmitting, setVehicleSubmitting] = useState(false);

    // Car types state
    const [isCarTypeModalOpen, setIsCarTypeModalOpen] = useState(false);
    const [carTypeForm, setCarTypeForm] = useState(EMPTY_CAR_TYPE_FORM);
    const [carTypeDupeWarning, setCarTypeDupeWarning] = useState<string | null>(null);
    const [carTypeSubmitting, setCarTypeSubmitting] = useState(false);

    const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    useEffect(() => {
        if (!siteId) return;
        loadAll();
    }, [siteId]);

    async function loadAll() {
        setLoading(true);
        try {
            const [v, c] = await Promise.all([getVehicles(siteId), getCarCatalog(siteId)]);
            setVehicles(v);
            setCarCatalog(c);
        } catch (err) {
            console.error('[SR VehiclesPage] load error:', err);
        } finally {
            setLoading(false);
        }
    }

    function showToast(type: 'success' | 'error', message: string) {
        setToast({ type, message });
        setTimeout(() => setToast(null), 3000);
    }

    // ── Vehicle CRUD ────────────────────────────────────────────────────────────

    function openCreateVehicle() {
        setEditingVehicle(null);
        setVehicleForm(EMPTY_VEHICLE_FORM);
        setPlateWarning(null);
        setIsVehicleModalOpen(true);
    }

    function openEditVehicle(vehicle: Vehicle) {
        setEditingVehicle(vehicle);
        setVehicleForm({
            plateNumber: vehicle.plateNumber,
            carCatalogId: vehicle.carCatalogId || '',
            color: vehicle.color || '',
        });
        setPlateWarning(null);
        setIsVehicleModalOpen(true);
    }

    async function handlePlateCheck(plate: string) {
        if (!plate.trim() || editingVehicle) { setPlateWarning(null); return; }
        const normalized = plate.toUpperCase().replace(/\s/g, '');
        if (normalized.length < 3) return;
        const existing = await findVehicleByPlate(siteId, normalized);
        setPlateWarning(existing ? `Plate ${normalized} already exists. Proceed to create another record.` : null);
    }

    async function handleVehicleSave(e: React.FormEvent) {
        e.preventDefault();
        const plate = (vehicleForm.plateNumber || '').toUpperCase().replace(/\s/g, '');
        if (!plate) { showToast('error', 'Plate number is required'); return; }
        setVehicleSubmitting(true);
        try {
            if (editingVehicle) {
                await updateVehicle(siteId, editingVehicle.id, {
                    plateNumber: plate,
                    carCatalogId: vehicleForm.carCatalogId || undefined,
                    color: vehicleForm.color || undefined,
                });
                showToast('success', 'Vehicle updated');
            } else {
                await createVehicle(siteId, {
                    plateNumber: plate,
                    carCatalogId: vehicleForm.carCatalogId || undefined,
                    color: vehicleForm.color || undefined,
                });
                showToast('success', 'Vehicle added');
            }
            setIsVehicleModalOpen(false);
            const [v] = await Promise.all([getVehicles(siteId)]);
            setVehicles(v);
        } catch (err) {
            console.error('[SR VehiclesPage] vehicle save error:', err);
            showToast('error', 'Failed to save vehicle');
        } finally {
            setVehicleSubmitting(false);
        }
    }

    // ── Car Type CRUD ───────────────────────────────────────────────────────────

    function openCreateCarType() {
        setCarTypeForm(EMPTY_CAR_TYPE_FORM);
        setCarTypeDupeWarning(null);
        setIsCarTypeModalOpen(true);
    }

    function checkCarTypeDupe(make: string, model: string) {
        if (!make.trim() || !model.trim()) { setCarTypeDupeWarning(null); return; }
        const dupe = carCatalog.find(
            c => c.make.toLowerCase() === make.trim().toLowerCase()
              && c.model.toLowerCase() === model.trim().toLowerCase()
        );
        setCarTypeDupeWarning(dupe ? `${make} ${model} already exists in the catalog.` : null);
    }

    async function handleCarTypeSave(e: React.FormEvent) {
        e.preventDefault();
        const make = carTypeForm.make.trim();
        const model = carTypeForm.model.trim();
        if (!make || !model) { showToast('error', 'Make and model are required'); return; }
        const dupe = carCatalog.find(
            c => c.make.toLowerCase() === make.toLowerCase()
              && c.model.toLowerCase() === model.toLowerCase()
        );
        if (dupe) { showToast('error', `${make} ${model} already exists`); return; }
        setCarTypeSubmitting(true);
        try {
            await addCarCatalogEntry(siteId, { make, model, type: carTypeForm.type });
            showToast('success', 'Car type added');
            setIsCarTypeModalOpen(false);
            const updated = await getCarCatalog(siteId);
            setCarCatalog(updated);
        } catch (err) {
            console.error('[SR VehiclesPage] car type save error:', err);
            showToast('error', 'Failed to add car type');
        } finally {
            setCarTypeSubmitting(false);
        }
    }

    // ── Helpers ─────────────────────────────────────────────────────────────────

    function getCatalogLabel(v: Vehicle): string {
        const entry = carCatalog.find(c => c.id === v.carCatalogId);
        return entry ? `${entry.make} ${entry.model}` : '—';
    }

    function getCatalogType(v: Vehicle): string {
        return carCatalog.find(c => c.id === v.carCatalogId)?.type || '—';
    }

    const filtered = search.trim()
        ? vehicles.filter(v => v.plateNumber.includes(search.toUpperCase().replace(/\s/g, '')))
        : vehicles;

    return (
        <div className="space-y-5">
            {toast && (
                <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-lg ${
                    toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                }`}>
                    {toast.message}
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-neutral-100">Vehicles</h1>
                    <p className="text-sm text-gray-500 dark:text-neutral-500 mt-0.5">Vehicle profiles and car type catalog.</p>
                </div>
                {tab === 'vehicles' ? (
                    <button
                        onClick={openCreateVehicle}
                        className="flex items-center gap-2 bg-studio-blue text-white px-4 py-2.5 rounded-xl text-sm font-medium"
                    >
                        <Plus className="w-4 h-4" /> Add Vehicle
                    </button>
                ) : (
                    <button
                        onClick={openCreateCarType}
                        className="flex items-center gap-2 bg-studio-blue text-white px-4 py-2.5 rounded-xl text-sm font-medium"
                    >
                        <Plus className="w-4 h-4" /> Add Car Type
                    </button>
                )}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 dark:bg-neutral-800 p-1 rounded-xl w-fit">
                <button
                    onClick={() => setTab('vehicles')}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        tab === 'vehicles'
                            ? 'bg-white dark:bg-neutral-900 text-gray-900 dark:text-neutral-100 shadow-sm'
                            : 'text-gray-500 dark:text-neutral-400 hover:text-gray-700 dark:hover:text-neutral-200'
                    }`}
                >
                    <Car className="w-4 h-4" /> Vehicles
                </button>
                <button
                    onClick={() => setTab('car-types')}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        tab === 'car-types'
                            ? 'bg-white dark:bg-neutral-900 text-gray-900 dark:text-neutral-100 shadow-sm'
                            : 'text-gray-500 dark:text-neutral-400 hover:text-gray-700 dark:hover:text-neutral-200'
                    }`}
                >
                    <List className="w-4 h-4" /> Car Types
                </button>
            </div>

            {/* ── Vehicles Tab ── */}
            {tab === 'vehicles' && (
                <>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-neutral-500" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search by plate…"
                            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-gray-400 dark:focus:border-neutral-500 focus:ring-0 text-sm"
                        />
                    </div>

                    <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-200 dark:border-neutral-800 shadow-sm overflow-hidden">
                        {loading ? (
                            <div className="p-8 text-center text-sm text-gray-400 dark:text-neutral-500">Loading…</div>
                        ) : filtered.length === 0 ? (
                            <div className="p-12 text-center">
                                <Car className="w-10 h-10 text-gray-300 dark:text-neutral-600 mx-auto mb-3" />
                                <p className="text-sm font-medium text-gray-500 dark:text-neutral-400">
                                    {search ? 'No vehicles match your search' : 'No vehicles yet'}
                                </p>
                                {!search && (
                                    <button onClick={openCreateVehicle} className="mt-4 text-sm text-brand-dark dark:text-brand-green font-medium hover:underline">
                                        + Add first vehicle
                                    </button>
                                )}
                            </div>
                        ) : (
                            <>
                                <div className="hidden md:block">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50 dark:bg-neutral-800 border-b border-gray-100 dark:border-neutral-700">
                                            <tr>
                                                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wide">Plate</th>
                                                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wide">Make / Model</th>
                                                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wide">Type</th>
                                                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wide">Color</th>
                                                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wide">Owner</th>
                                                <th className="px-4 py-3" />
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50 dark:divide-neutral-800">
                                            {filtered.map(v => (
                                                <tr
                                                    key={v.id}
                                                    onClick={() => router.push(`/admin/service-records/vehicles/detail?id=${v.id}`)}
                                                    className="hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                                                >
                                                    <td className="px-4 py-3 font-mono font-semibold text-gray-900 dark:text-neutral-100">{v.plateNumber}</td>
                                                    <td className="px-4 py-3 text-gray-700 dark:text-neutral-300">{getCatalogLabel(v)}</td>
                                                    <td className="px-4 py-3 text-gray-500 dark:text-neutral-500 text-xs">{getCatalogType(v)}</td>
                                                    <td className="px-4 py-3 text-gray-500 dark:text-neutral-500">{v.color || '—'}</td>
                                                    <td className="px-4 py-3 text-gray-500 dark:text-neutral-500 text-xs">{v.memberName || '—'}</td>
                                                    <td className="px-4 py-3">
                                                        <button
                                                            onClick={e => { e.stopPropagation(); openEditVehicle(v); }}
                                                            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-700 text-gray-500 dark:text-neutral-400"
                                                        >
                                                            <Edit2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="md:hidden divide-y divide-gray-50 dark:divide-neutral-800">
                                    {filtered.map(v => (
                                        <div
                                            key={v.id}
                                            onClick={() => router.push(`/admin/service-records/vehicles/detail?id=${v.id}`)}
                                            className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
                                        >
                                            <div>
                                                <p className="font-mono font-bold text-gray-900 dark:text-neutral-100">{v.plateNumber}</p>
                                                <p className="text-sm text-gray-500 dark:text-neutral-400">{getCatalogLabel(v)}</p>
                                                {v.color && <p className="text-xs text-gray-400 dark:text-neutral-500">{v.color}</p>}
                                            </div>
                                            <button
                                                onClick={e => { e.stopPropagation(); openEditVehicle(v); }}
                                                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-700 text-gray-500 dark:text-neutral-400"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </>
            )}

            {/* ── Car Types Tab ── */}
            {tab === 'car-types' && (
                <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-200 dark:border-neutral-800 shadow-sm overflow-hidden">
                    {loading ? (
                        <div className="p-8 text-center text-sm text-gray-400 dark:text-neutral-500">Loading…</div>
                    ) : carCatalog.length === 0 ? (
                        <div className="p-12 text-center">
                            <List className="w-10 h-10 text-gray-300 dark:text-neutral-600 mx-auto mb-3" />
                            <p className="text-sm font-medium text-gray-500 dark:text-neutral-400">No car types yet</p>
                            <button onClick={openCreateCarType} className="mt-4 text-sm text-brand-dark dark:text-brand-green font-medium hover:underline">
                                + Add first car type
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className="hidden md:block">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 dark:bg-neutral-800 border-b border-gray-100 dark:border-neutral-700">
                                        <tr>
                                            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wide">Make</th>
                                            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wide">Model</th>
                                            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wide">Type</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50 dark:divide-neutral-800">
                                        {carCatalog.map(c => (
                                            <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors">
                                                <td className="px-4 py-3 font-medium text-gray-900 dark:text-neutral-100">{c.make}</td>
                                                <td className="px-4 py-3 text-gray-700 dark:text-neutral-300">{c.model}</td>
                                                <td className="px-4 py-3 text-xs text-gray-500 dark:text-neutral-500">{c.type}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="md:hidden divide-y divide-gray-50 dark:divide-neutral-800">
                                {carCatalog.map(c => (
                                    <div key={c.id} className="px-4 py-3">
                                        <p className="font-medium text-gray-900 dark:text-neutral-100">{c.make} {c.model}</p>
                                        <p className="text-xs text-gray-500 dark:text-neutral-500 mt-0.5">{c.type}</p>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* ── Vehicle Modal ── */}
            {isVehicleModalOpen && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-neutral-900 rounded-2xl w-full max-w-md shadow-xl">
                        <div className="p-6 border-b border-gray-100 dark:border-neutral-800">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-neutral-100">
                                {editingVehicle ? 'Edit Vehicle' : 'Add Vehicle'}
                            </h2>
                        </div>
                        <form onSubmit={handleVehicleSave} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">Plate Number *</label>
                                <input
                                    type="text"
                                    value={vehicleForm.plateNumber || ''}
                                    onChange={e => setVehicleForm(f => ({ ...f, plateNumber: e.target.value.toUpperCase().replace(/\s/g, '') }))}
                                    onBlur={() => handlePlateCheck(vehicleForm.plateNumber || '')}
                                    placeholder="e.g. B1234XYZ"
                                    required
                                    className="w-full font-mono rounded-xl border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-gray-400 dark:focus:border-neutral-500 focus:ring-0 px-3 py-2 text-sm"
                                />
                                {plateWarning && (
                                    <div className="mt-1.5 flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                                        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                                        {plateWarning}
                                    </div>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">Car Type</label>
                                <select
                                    value={vehicleForm.carCatalogId || ''}
                                    onChange={e => setVehicleForm(f => ({ ...f, carCatalogId: e.target.value }))}
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
                                    onClick={() => { setIsVehicleModalOpen(false); setTab('car-types'); openCreateCarType(); }}
                                    className="mt-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
                                >
                                    + Add new car type
                                </button>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">Color</label>
                                <input
                                    type="text"
                                    value={vehicleForm.color || ''}
                                    onChange={e => setVehicleForm(f => ({ ...f, color: e.target.value }))}
                                    placeholder="Silver"
                                    className="w-full rounded-xl border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-gray-400 dark:focus:border-neutral-500 focus:ring-0 px-3 py-2 text-sm"
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsVehicleModalOpen(false)}
                                    className="px-4 py-2 rounded-xl text-sm font-medium border border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-800"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={vehicleSubmitting}
                                    className="bg-studio-blue text-white px-5 py-2 rounded-xl text-sm font-medium disabled:opacity-50"
                                >
                                    {vehicleSubmitting ? 'Saving…' : editingVehicle ? 'Update' : 'Add Vehicle'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Car Type Modal ── */}
            {isCarTypeModalOpen && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-neutral-900 rounded-2xl w-full max-w-sm shadow-xl">
                        <div className="p-6 border-b border-gray-100 dark:border-neutral-800">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-neutral-100">Add Car Type</h2>
                        </div>
                        <form onSubmit={handleCarTypeSave} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">Make *</label>
                                    <input
                                        type="text"
                                        value={carTypeForm.make}
                                        onChange={e => {
                                            setCarTypeForm(f => ({ ...f, make: e.target.value }));
                                            checkCarTypeDupe(e.target.value, carTypeForm.model);
                                        }}
                                        placeholder="Toyota"
                                        required
                                        className="w-full rounded-xl border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-gray-400 dark:focus:border-neutral-500 focus:ring-0 px-3 py-2 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">Model *</label>
                                    <input
                                        type="text"
                                        value={carTypeForm.model}
                                        onChange={e => {
                                            setCarTypeForm(f => ({ ...f, model: e.target.value }));
                                            checkCarTypeDupe(carTypeForm.make, e.target.value);
                                        }}
                                        placeholder="Fortuner"
                                        required
                                        className="w-full rounded-xl border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-gray-400 dark:focus:border-neutral-500 focus:ring-0 px-3 py-2 text-sm"
                                    />
                                </div>
                            </div>
                            {carTypeDupeWarning && (
                                <div className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                                    {carTypeDupeWarning}
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">Type *</label>
                                <select
                                    value={carTypeForm.type}
                                    onChange={e => setCarTypeForm(f => ({ ...f, type: e.target.value as VehicleType }))}
                                    className="w-full rounded-xl border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-gray-400 dark:focus:border-neutral-500 focus:ring-0 px-3 py-2 text-sm"
                                >
                                    {VEHICLE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsCarTypeModalOpen(false)}
                                    className="px-4 py-2 rounded-xl text-sm font-medium border border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-800"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={carTypeSubmitting || !!carTypeDupeWarning}
                                    className="bg-studio-blue text-white px-5 py-2 rounded-xl text-sm font-medium disabled:opacity-50"
                                >
                                    {carTypeSubmitting ? 'Saving…' : 'Add Car Type'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
