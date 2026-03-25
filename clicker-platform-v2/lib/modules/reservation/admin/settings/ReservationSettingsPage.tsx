'use client';

import { useState, useEffect } from 'react';
import { Settings } from 'lucide-react';
import { useSite } from '@/lib/site-context';
import { getReservationSettings, updateReservationSettings } from '@/lib/modules/reservation/api';
import type { ReservationSettings } from '@/lib/modules/reservation/types';

export default function ReservationSettingsPage() {
    const { siteId } = useSite();
    const [settings, setSettings] = useState<ReservationSettings>({ allowStaffSelection: false, staffLabel: 'Staff' });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    useEffect(() => {
        if (!siteId) return;
        getReservationSettings(siteId)
            .then(s => setSettings(s))
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
        return <div className="p-6 text-sm text-gray-400">Loading…</div>;
    }

    return (
        <div className="p-6 max-w-2xl space-y-6">
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
                    <h1 className="text-2xl font-bold text-gray-900">Reservation Settings</h1>
                    <p className="text-sm text-gray-500 mt-0.5">Configure how the booking experience works for your business.</p>
                </div>
                <Settings className="w-6 h-6 text-gray-300" />
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100">

                {/* Staff Selection Toggle */}
                <div className="p-5 flex items-center justify-between gap-4">
                    <div>
                        <p className="text-sm font-medium text-gray-800">Allow {label} Selection</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Customers can choose a specific {label.toLowerCase()} during booking, or select "Any Available".
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setSettings(s => ({ ...s, allowStaffSelection: !s.allowStaffSelection }))}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
                            settings.allowStaffSelection ? 'bg-green-500' : 'bg-gray-200'
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
                        <label className="text-sm font-medium text-gray-800 block">
                            What do you call your staff?
                        </label>
                        <p className="text-xs text-gray-500 mt-0.5">
                            This label appears throughout the booking flow. E.g. "Technician", "Therapist", "Stylist".
                        </p>
                    </div>
                    <input
                        type="text"
                        value={settings.staffLabel ?? 'Staff'}
                        onChange={e => setSettings(s => ({ ...s, staffLabel: e.target.value }))}
                        placeholder="Staff"
                        className="w-full max-w-xs rounded-xl border border-gray-200 focus:border-gray-400 focus:ring-0 px-3 py-2 text-sm"
                    />
                    {label && (
                        <p className="text-xs text-gray-400 mt-2">
                            Preview: customers will see <span className="font-medium text-gray-600">"Any Available {label}"</span> and <span className="font-medium text-gray-600">"Select a {label}"</span>.
                        </p>
                    )}
                </div>
            </div>

            <div className="flex justify-end">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-brand-dark text-white px-5 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50"
                >
                    {saving ? 'Saving…' : 'Save Settings'}
                </button>
            </div>
        </div>
    );
}
