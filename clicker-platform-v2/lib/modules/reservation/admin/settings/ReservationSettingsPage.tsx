'use client';

import { useState, useEffect } from 'react';
import { Settings } from 'lucide-react';
import { useSite } from '@/lib/site-context';
import { getReservationSettings, updateReservationSettings } from '@/lib/modules/reservation/api';
import { isModuleEnabled } from '@/lib/modules/registry';
import type { ReservationSettings, PricingDisplay } from '@/lib/modules/reservation/types';

export default function ReservationSettingsPage() {
    const { siteId } = useSite();
    const [settings, setSettings] = useState<ReservationSettings>({
        allowStaffSelection: false,
        staffLabel: 'Staff',
        pricingDisplay: 'fixed',
        bookingTitle: '',
        formConfig: {
            requireAsset: false,
            assetLabel: 'License Plate',
            assetPlaceholder: 'e.g. B 1234 CD',
            requireAssetModel: false,
            assetModelLabel: 'Vehicle Make & Model',
        },
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [serviceRecordsEnabled, setServiceRecordsEnabled] = useState(false);
    const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    useEffect(() => {
        if (!siteId) return;
        Promise.all([
            getReservationSettings(siteId),
            isModuleEnabled('service_records'),
        ])
            .then(([s, srEnabled]) => {
                setSettings(s);
                setServiceRecordsEnabled(srEnabled);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [siteId]);

    function showToast(type: 'success' | 'error', message: string) {
        setToast({ type, message });
        setTimeout(() => setToast(null), 3000);
    }

    async function handleSave() {
        if (!siteId) return;
        setSaving(true);
        try {
            await updateReservationSettings(siteId, {
                allowStaffSelection: settings.allowStaffSelection,
                staffLabel: settings.staffLabel || 'Staff',
                pricingDisplay: settings.pricingDisplay || 'fixed',
                bookingTitle: settings.bookingTitle || '',
                formConfig: settings.formConfig,
            });
            showToast('success', 'Settings saved');
        } catch (err) {
            console.error(err);
            showToast('error', 'Failed to save settings');
        } finally {
            setSaving(false);
        }
    }

    const label = settings.staffLabel?.trim() || 'Staff';

    if (loading) {
        return <div className="text-sm text-gray-400 dark:text-neutral-600">Loading…</div>;
    }

    return (
        <div className="max-w-2xl space-y-6">
            {toast && (
                <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-sm font-medium shadow-lg ${
                    toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                }`}>
                    {toast.message}
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-neutral-100">Reservation Settings</h1>
                    <p className="text-sm text-gray-500 dark:text-neutral-500 mt-0.5">Configure how the booking experience works for your business.</p>
                </div>
                <Settings className="w-6 h-6 text-gray-300 dark:text-neutral-700" />
            </div>

            <div className="bg-white dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800 divide-y divide-gray-100 dark:divide-neutral-800">

                {/* Staff Selection Toggle */}
                <div className="p-5 flex items-center justify-between gap-4">
                    <div>
                        <p className="text-sm font-medium text-gray-800 dark:text-neutral-200">Allow {label} Selection</p>
                        <p className="text-xs text-gray-500 dark:text-neutral-500 mt-0.5">
                            Customers can choose a specific {label.toLowerCase()} during booking, or select "Any Available".
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setSettings(s => ({ ...s, allowStaffSelection: !s.allowStaffSelection }))}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
                            settings.allowStaffSelection ? 'bg-green-500' : 'bg-gray-200 dark:bg-neutral-700'
                        }`}
                    >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                            settings.allowStaffSelection ? 'translate-x-6' : 'translate-x-1'
                        }`} />
                    </button>
                </div>

                {/* Staff Label */}
                <div className="p-5">
                    <div className="mb-3">
                        <label className="text-sm font-medium text-gray-800 dark:text-neutral-200 block">
                            What do you call your staff?
                        </label>
                        <p className="text-xs text-gray-500 dark:text-neutral-500 mt-0.5">
                            This label appears throughout the booking flow. E.g. "Technician", "Therapist", "Stylist".
                        </p>
                    </div>
                    <input
                        type="text"
                        value={settings.staffLabel ?? 'Staff'}
                        onChange={e => setSettings(s => ({ ...s, staffLabel: e.target.value }))}
                        placeholder="Staff"
                        className="w-full max-w-xs rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 focus:border-gray-400 dark:focus:border-neutral-500 focus:ring-0 px-3 py-2 text-sm text-gray-900 dark:text-neutral-200 placeholder-gray-400 dark:placeholder-neutral-600"
                    />
                    {label && (
                        <p className="text-xs text-gray-400 dark:text-neutral-600 mt-2">
                            Preview: customers will see <span className="font-medium text-gray-600 dark:text-neutral-400">"Any Available {label}"</span> and <span className="font-medium text-gray-600 dark:text-neutral-400">"Select a {label}"</span>.
                        </p>
                    )}
                </div>

                {/* Booking Title */}
                <div className="p-5">
                    <div className="mb-3">
                        <label className="text-sm font-medium text-gray-800 dark:text-neutral-200 block">
                            Booking Page Title
                        </label>
                        <p className="text-xs text-gray-500 dark:text-neutral-500 mt-0.5">
                            The heading shown on Step 1 of the booking form. Defaults to "Select Service".
                        </p>
                    </div>
                    <input
                        type="text"
                        value={settings.bookingTitle ?? ''}
                        onChange={e => setSettings(s => ({ ...s, bookingTitle: e.target.value }))}
                        placeholder="Select Service"
                        className="w-full max-w-xs rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 focus:border-gray-400 dark:focus:border-neutral-500 focus:ring-0 px-3 py-2 text-sm text-gray-900 dark:text-neutral-200 placeholder-gray-400 dark:placeholder-neutral-600"
                    />
                    {settings.bookingTitle?.trim() && (
                        <p className="text-xs text-gray-400 dark:text-neutral-600 mt-2">
                            Preview: Step 1 will show <span className="font-medium text-gray-600 dark:text-neutral-400">"{settings.bookingTitle.trim()}"</span> instead of "Select Service".
                        </p>
                    )}
                </div>

                {/* Pricing Display Mode */}
                <div className="p-5">
                    <div className="mb-3">
                        <label className="text-sm font-medium text-gray-800 dark:text-neutral-200 block">
                            Pricing Display
                        </label>
                        <p className="text-xs text-gray-500 dark:text-neutral-500 mt-0.5">
                            How prices are shown to customers on the booking page. Prices are always visible to admin.
                        </p>
                    </div>
                    <div className="space-y-2">
                        {([
                            { value: 'fixed', label: 'Fixed Price', desc: 'Show exact price — e.g. Rp 150.000' },
                            { value: 'starting_from', label: 'Starting From', desc: 'Show minimum price — e.g. Mulai dari Rp 150.000' },
                            { value: 'range', label: 'Price Range', desc: 'Show min–max range — e.g. Rp 150.000 – Rp 500.000' },
                            { value: 'hidden', label: 'Hidden', desc: 'Don\'t show prices — customers book first, price discussed later' },
                        ] as { value: PricingDisplay; label: string; desc: string }[]).map(opt => (
                            <label
                                key={opt.value}
                                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                                    settings.pricingDisplay === opt.value
                                        ? 'border-brand-dark dark:border-brand-dark bg-brand-dark/5 dark:bg-brand-dark/10'
                                        : 'border-gray-200 dark:border-neutral-700 hover:border-gray-300 dark:hover:border-neutral-600'
                                }`}
                            >
                                <input
                                    type="radio"
                                    name="pricingDisplay"
                                    value={opt.value}
                                    checked={settings.pricingDisplay === opt.value}
                                    onChange={() => setSettings(s => ({ ...s, pricingDisplay: opt.value }))}
                                    className="mt-0.5 accent-brand-dark"
                                />
                                <div>
                                    <p className="text-sm font-medium text-gray-800 dark:text-neutral-200">{opt.label}</p>
                                    <p className="text-xs text-gray-500 dark:text-neutral-500">{opt.desc}</p>
                                </div>
                            </label>
                        ))}
                    </div>
                </div>

                {/* Booking Form Fields — only shown when service_records module is enabled */}
                {serviceRecordsEnabled && <div className="p-5 space-y-4">
                    <div>
                        <p className="text-sm font-medium text-gray-800 dark:text-neutral-200">Booking Form Fields</p>
                        <p className="text-xs text-gray-500 dark:text-neutral-500 mt-0.5">
                            Collect additional information from customers during booking (e.g. license plate for auto services).
                        </p>
                    </div>

                    {/* Require Asset Toggle */}
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-700 dark:text-neutral-300">
                                {settings.formConfig?.assetLabel || 'Asset'} field
                            </p>
                            <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">Ask customers for a specific identifier (e.g. license plate).</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setSettings(s => ({ ...s, formConfig: { ...s.formConfig!, requireAsset: !s.formConfig?.requireAsset } }))}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
                                settings.formConfig?.requireAsset ? 'bg-green-500' : 'bg-gray-200 dark:bg-neutral-700'
                            }`}
                        >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                                settings.formConfig?.requireAsset ? 'translate-x-6' : 'translate-x-1'
                            }`} />
                        </button>
                    </div>

                    {/* Asset Label & Placeholder — shown when requireAsset is on */}
                    {settings.formConfig?.requireAsset && (
                        <div className="space-y-3 pl-1 border-l-2 border-gray-100 dark:border-neutral-800 ml-1">
                            <div>
                                <label className="text-xs font-medium text-gray-600 dark:text-neutral-400 block mb-1">Field label</label>
                                <input
                                    type="text"
                                    value={settings.formConfig?.assetLabel ?? ''}
                                    onChange={e => setSettings(s => ({ ...s, formConfig: { ...s.formConfig!, assetLabel: e.target.value } }))}
                                    placeholder="License Plate"
                                    className="w-full max-w-xs rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 focus:border-gray-400 dark:focus:border-neutral-500 focus:ring-0 px-3 py-2 text-sm text-gray-900 dark:text-neutral-200 placeholder-gray-400 dark:placeholder-neutral-600"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-gray-600 dark:text-neutral-400 block mb-1">Placeholder text</label>
                                <input
                                    type="text"
                                    value={settings.formConfig?.assetPlaceholder ?? ''}
                                    onChange={e => setSettings(s => ({ ...s, formConfig: { ...s.formConfig!, assetPlaceholder: e.target.value } }))}
                                    placeholder="e.g. B 1234 CD"
                                    className="w-full max-w-xs rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 focus:border-gray-400 dark:focus:border-neutral-500 focus:ring-0 px-3 py-2 text-sm text-gray-900 dark:text-neutral-200 placeholder-gray-400 dark:placeholder-neutral-600"
                                />
                            </div>

                            {/* Require Asset Model Toggle */}
                            <div className="flex items-center justify-between pt-1">
                                <div>
                                    <p className="text-sm text-gray-700 dark:text-neutral-300">Also ask for asset model?</p>
                                    <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">E.g. ask for vehicle make &amp; model alongside the plate.</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setSettings(s => ({ ...s, formConfig: { ...s.formConfig!, requireAssetModel: !s.formConfig?.requireAssetModel } }))}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
                                        settings.formConfig?.requireAssetModel ? 'bg-green-500' : 'bg-gray-200 dark:bg-neutral-700'
                                    }`}
                                >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                                        settings.formConfig?.requireAssetModel ? 'translate-x-6' : 'translate-x-1'
                                    }`} />
                                </button>
                            </div>

                            {/* Asset Model Label — shown when requireAssetModel is on */}
                            {settings.formConfig?.requireAssetModel && (
                                <div>
                                    <label className="text-xs font-medium text-gray-600 dark:text-neutral-400 block mb-1">Model field label</label>
                                    <input
                                        type="text"
                                        value={settings.formConfig?.assetModelLabel ?? ''}
                                        onChange={e => setSettings(s => ({ ...s, formConfig: { ...s.formConfig!, assetModelLabel: e.target.value } }))}
                                        placeholder="Vehicle Make & Model"
                                        className="w-full max-w-xs rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 focus:border-gray-400 dark:focus:border-neutral-500 focus:ring-0 px-3 py-2 text-sm text-gray-900 dark:text-neutral-200 placeholder-gray-400 dark:placeholder-neutral-600"
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </div>}
            </div>

            <div className="flex justify-end">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-studio-blue text-white px-5 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
                >
                    {saving ? 'Saving…' : 'Save Settings'}
                </button>
            </div>
        </div>
    );
}
