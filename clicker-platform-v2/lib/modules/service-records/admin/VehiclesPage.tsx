'use client';

import { useEffect, useState } from 'react';
import { Plus, Edit2, Car, Search, AlertTriangle } from 'lucide-react';
import { useSite } from '@/lib/site-context';
import { useUser } from '@/lib/user-context';
import { getVehicles, createVehicle, updateVehicle, findVehicleByPlate } from '../api';
import type { Vehicle, VehicleType } from '../types';

const VEHICLE_TYPES: VehicleType[] = ['SEDAN', 'SUV', 'MPV', 'HATCHBACK', 'PICKUP', 'MOTORCYCLE', 'OTHER'];

const EMPTY_FORM: Partial<Omit<Vehicle, 'id' | 'outletId' | 'createdAt' | 'updatedAt'>> = {
    plateNumber: '',
    make: '',
    model: '',
    color: '',
    type: 'OTHER',
};

export default function VehiclesPage() {
    const { siteId } = useSite();
    const { user } = useUser();
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [plateWarning, setPlateWarning] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    useEffect(() => {
        if (!siteId) return;
        loadVehicles();
    }, [siteId]);

    async function loadVehicles() {
        setLoading(true);
        try {
            const list = await getVehicles(siteId);
            setVehicles(list);
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

    function openCreate() {
        setEditingVehicle(null);
        setForm(EMPTY_FORM);
        setPlateWarning(null);
        setIsModalOpen(true);
    }

    function openEdit(vehicle: Vehicle) {
        setEditingVehicle(vehicle);
        setForm({
            plateNumber: vehicle.plateNumber,
            make: vehicle.make || '',
            model: vehicle.model || '',
            color: vehicle.color || '',
            type: vehicle.type || 'OTHER',
        });
        setPlateWarning(null);
        setIsModalOpen(true);
    }

    async function handlePlateCheck(plate: string) {
        if (!plate.trim() || editingVehicle) {
            setPlateWarning(null);
            return;
        }
        const normalized = plate.toUpperCase().replace(/\s/g, '');
        if (normalized.length < 3) return;
        const existing = await findVehicleByPlate(siteId, normalized);
        if (existing) {
            setPlateWarning(`Plate ${normalized} already exists (${existing.make || ''} ${existing.model || ''}). Proceed to create another record.`);
        } else {
            setPlateWarning(null);
        }
    }

    async function handleSave(e: React.FormEvent) {
        e.preventDefault();
        const plate = (form.plateNumber || '').toUpperCase().replace(/\s/g, '');
        if (!plate) {
            showToast('error', 'Plate number is required');
            return;
        }
        setSubmitting(true);
        try {
            if (editingVehicle) {
                await updateVehicle(siteId, editingVehicle.id, {
                    plateNumber: plate,
                    make: form.make || undefined,
                    model: form.model || undefined,
                    color: form.color || undefined,
                    type: form.type,
                });
                showToast('success', 'Vehicle updated');
            } else {
                await createVehicle(siteId, {
                    plateNumber: plate,
                    make: form.make || undefined,
                    model: form.model || undefined,
                    color: form.color || undefined,
                    type: form.type,
                });
                showToast('success', 'Vehicle added');
            }
            setIsModalOpen(false);
            await loadVehicles();
        } catch (err) {
            console.error('[SR VehiclesPage] save error:', err);
            showToast('error', 'Failed to save vehicle');
        } finally {
            setSubmitting(false);
        }
    }

    const filtered = search.trim()
        ? vehicles.filter(v =>
            v.plateNumber.includes(search.toUpperCase().replace(/\s/g, '')) ||
            `${v.make || ''} ${v.model || ''}`.toLowerCase().includes(search.toLowerCase())
        )
        : vehicles;

    return (
        <div className="p-6 space-y-5">
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
                    <p className="text-sm text-gray-500 dark:text-neutral-500 mt-0.5">Vehicle profiles linked to service records.</p>
                </div>
                <button
                    onClick={openCreate}
                    className="flex items-center gap-2 bg-studio-blue text-white px-4 py-2.5 rounded-xl text-sm font-medium"
                >
                    <Plus className="w-4 h-4" />
                    Add Vehicle
                </button>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-neutral-500" />
                <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search by plate or make/model…"
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-gray-400 dark:focus:border-neutral-500 focus:ring-0 text-sm"
                />
            </div>

            {/* List */}
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
                            <button onClick={openCreate} className="mt-4 text-sm text-brand-dark dark:text-brand-green font-medium hover:underline">
                                + Add first vehicle
                            </button>
                        )}
                    </div>
                ) : (
                    <>
                        {/* Desktop table */}
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
                                        <tr key={v.id} className="hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors">
                                            <td className="px-4 py-3 font-mono font-semibold text-gray-900 dark:text-neutral-100">{v.plateNumber}</td>
                                            <td className="px-4 py-3 text-gray-700 dark:text-neutral-300">{v.make ? `${v.make} ${v.model || ''}`.trim() : '—'}</td>
                                            <td className="px-4 py-3 text-gray-500 dark:text-neutral-500 text-xs">{v.type || '—'}</td>
                                            <td className="px-4 py-3 text-gray-500 dark:text-neutral-500">{v.color || '—'}</td>
                                            <td className="px-4 py-3 text-gray-500 dark:text-neutral-500 text-xs">{v.memberName || '—'}</td>
                                            <td className="px-4 py-3">
                                                <button
                                                    onClick={() => openEdit(v)}
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
                        {/* Mobile cards */}
                        <div className="md:hidden divide-y divide-gray-50 dark:divide-neutral-800">
                            {filtered.map(v => (
                                <div key={v.id} className="p-4 flex items-center justify-between">
                                    <div>
                                        <p className="font-mono font-bold text-gray-900 dark:text-neutral-100">{v.plateNumber}</p>
                                        <p className="text-sm text-gray-500 dark:text-neutral-400">{v.make ? `${v.make} ${v.model || ''}`.trim() : 'No make/model'}</p>
                                        {v.color && <p className="text-xs text-gray-400 dark:text-neutral-500">{v.color}</p>}
                                    </div>
                                    <button onClick={() => openEdit(v)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-700 text-gray-500 dark:text-neutral-400">
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-neutral-900 rounded-2xl w-full max-w-md shadow-xl">
                        <div className="p-6 border-b border-gray-100 dark:border-neutral-800">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-neutral-100">
                                {editingVehicle ? 'Edit Vehicle' : 'Add Vehicle'}
                            </h2>
                        </div>
                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">Plate Number *</label>
                                <input
                                    type="text"
                                    value={form.plateNumber || ''}
                                    onChange={e => {
                                        const v = e.target.value.toUpperCase().replace(/\s/g, '');
                                        setForm(f => ({ ...f, plateNumber: v }));
                                    }}
                                    onBlur={() => handlePlateCheck(form.plateNumber || '')}
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
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">Make</label>
                                    <input
                                        type="text"
                                        value={form.make || ''}
                                        onChange={e => setForm(f => ({ ...f, make: e.target.value }))}
                                        placeholder="Toyota"
                                        className="w-full rounded-xl border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-gray-400 dark:focus:border-neutral-500 focus:ring-0 px-3 py-2 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">Model</label>
                                    <input
                                        type="text"
                                        value={form.model || ''}
                                        onChange={e => setForm(f => ({ ...f, model: e.target.value }))}
                                        placeholder="Fortuner"
                                        className="w-full rounded-xl border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-gray-400 dark:focus:border-neutral-500 focus:ring-0 px-3 py-2 text-sm"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">Color</label>
                                    <input
                                        type="text"
                                        value={form.color || ''}
                                        onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                                        placeholder="Silver"
                                        className="w-full rounded-xl border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-gray-400 dark:focus:border-neutral-500 focus:ring-0 px-3 py-2 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">Type</label>
                                    <select
                                        value={form.type || 'OTHER'}
                                        onChange={e => setForm(f => ({ ...f, type: e.target.value as VehicleType }))}
                                        className="w-full rounded-xl border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-gray-400 dark:focus:border-neutral-500 focus:ring-0 px-3 py-2 text-sm"
                                    >
                                        {VEHICLE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 rounded-xl text-sm font-medium border border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-800"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="bg-studio-blue text-white px-5 py-2 rounded-xl text-sm font-medium disabled:opacity-50"
                                >
                                    {submitting ? 'Saving…' : editingVehicle ? 'Update' : 'Add Vehicle'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
