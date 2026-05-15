'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSite } from '@/lib/site-context';
import { logger } from '@/lib/logger-edge';
import { useUser } from '@/lib/user-context';
import { getServiceConfig, updateServiceConfig } from '../api';
import type { ServiceConfig } from '../types';

export default function SettingsPage() {
    const { siteId } = useSite();
    const { isOwner } = useUser();
    const [_config, setConfig] = useState<ServiceConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [prefix, setPrefix] = useState('');
    const [warrantyCardsEnabled, setWarrantyCardsEnabled] = useState(true);
    const [reminderEngineEnabled, setReminderEngineEnabled] = useState(false);

    const loadConfig = useCallback(async () => {
        setLoading(true);
        try {
            const cfg = await getServiceConfig(siteId);
            setConfig(cfg);
            setPrefix(cfg.warrantyPrefix || 'SVC');
            setWarrantyCardsEnabled(cfg.featuresEnabled.warrantyCards);
            setReminderEngineEnabled(cfg.featuresEnabled.reminderEngine);
        } catch (err) {
            logger.error('service-records.settings.load.failed', { siteId, error: err });
        } finally {
            setLoading(false);
        }
    }, [siteId]);

    useEffect(() => {
        if (!siteId) return;
        loadConfig();
    }, [siteId, loadConfig]);

    function showToast(type: 'success' | 'error', message: string) {
        setToast({ type, message });
        setTimeout(() => setToast(null), 3000);
    }

    async function handleSave() {
        if (!isOwner) {
            showToast('error', 'Only owners can change settings');
            return;
        }
        const cleanPrefix = prefix.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
        if (!cleanPrefix) {
            showToast('error', 'Warranty prefix must be 1–5 alphanumeric characters');
            return;
        }
        setSaving(true);
        try {
            await updateServiceConfig(siteId, {
                warrantyPrefix: cleanPrefix,
                featuresEnabled: {
                    warrantyCards: warrantyCardsEnabled,
                    reminderEngine: reminderEngineEnabled,
                },
            });
            setPrefix(cleanPrefix);
            showToast('success', 'Settings saved');
        } catch (err) {
            logger.error('service-records.settings.save.failed', { siteId, error: err });
            showToast('error', 'Failed to save settings');
        } finally {
            setSaving(false);
        }
    }

    const previewCode = `${prefix.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5) || 'SVC'}-${new Date().getFullYear()}-A4F9`;

    if (loading) {
        return (
            <div className="animate-pulse space-y-4">
                <div className="h-8 bg-gray-200 dark:bg-neutral-700 rounded w-48" />
                <div className="h-40 bg-gray-200 dark:bg-neutral-700 rounded-lg" />
            </div>
        );
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

            <h1 className="hidden md:block text-2xl font-bold text-gray-900 dark:text-neutral-100">Service Records Settings</h1>

            {/* Warranty Card Settings */}
            <div className="bg-white dark:bg-neutral-900 p-6 rounded-lg border border-gray-200 dark:border-neutral-800 space-y-5">
                <h2 className="text-base font-semibold text-gray-800 dark:text-neutral-200">Warranty Card</h2>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">
                        Warranty Code Prefix
                    </label>
                    <div className="flex items-center gap-3">
                        <input
                            type="text"
                            value={prefix}
                            onChange={e => setPrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5))}
                            disabled={!isOwner}
                            maxLength={5}
                            placeholder="SVC"
                            className="w-32 rounded-lg border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-gray-400 dark:focus:border-neutral-500 focus:ring-0 px-3 py-2 text-sm disabled:bg-gray-50 dark:disabled:bg-neutral-800 disabled:text-gray-400 dark:disabled:text-neutral-500"
                        />
                        <div className="text-sm text-gray-500 dark:text-neutral-500">
                            Preview: <span className="font-mono font-semibold text-gray-800 dark:text-neutral-200">{previewCode}</span>
                        </div>
                    </div>
                    <p className="text-xs text-gray-400 dark:text-neutral-500 mt-1">1–5 uppercase alphanumeric characters. Used in all warranty codes for this outlet.</p>
                </div>

                <div className="flex items-center justify-between py-3 border-t border-gray-100 dark:border-neutral-800">
                    <div>
                        <p className="text-sm font-medium text-gray-700 dark:text-neutral-300">Enable Warranty Cards</p>
                        <p className="text-xs text-gray-400 dark:text-neutral-500">When disabled, warranty card UI is hidden for all service types.</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => isOwner && setWarrantyCardsEnabled(v => !v)}
                        disabled={!isOwner}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
                            warrantyCardsEnabled ? 'bg-green-500' : 'bg-gray-200 dark:bg-neutral-700'
                        }`}
                    >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                            warrantyCardsEnabled ? 'translate-x-6' : 'translate-x-1'
                        }`} />
                    </button>
                </div>
            </div>

            {/* Reminder Engine */}
            <div className="bg-white dark:bg-neutral-900 p-6 rounded-lg border border-gray-200 dark:border-neutral-800">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-semibold text-gray-800 dark:text-neutral-200">Reminder Engine</p>
                        <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">
                            Enable to write reminder queue entries on record completion. Requires Cloud Functions to be deployed for actual dispatch.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => isOwner && setReminderEngineEnabled(v => !v)}
                        disabled={!isOwner}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
                            reminderEngineEnabled ? 'bg-green-500' : 'bg-gray-200 dark:bg-neutral-700'
                        }`}
                    >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                            reminderEngineEnabled ? 'translate-x-6' : 'translate-x-1'
                        }`} />
                    </button>
                </div>
            </div>

            {/* Module Info */}
            <div className="bg-gray-50 dark:bg-neutral-800 p-4 rounded-lg border border-gray-100 dark:border-neutral-700">
                <p className="text-xs text-gray-500 dark:text-neutral-500">
                    <span className="font-medium">Module:</span> service_records v1.0.0
                    {' · '}
                    <span className="font-medium">Outlet ID:</span> {siteId}
                </p>
            </div>

            {isOwner && (
                <div className="flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-studio-blue text-white px-6 py-3 rounded-lg text-sm font-medium disabled:opacity-50"
                    >
                        {saving ? 'Saving…' : 'Save Settings'}
                    </button>
                </div>
            )}
            {!isOwner && (
                <p className="text-xs text-gray-400 dark:text-neutral-500">Only owners can modify settings.</p>
            )}
        </div>
    );
}
