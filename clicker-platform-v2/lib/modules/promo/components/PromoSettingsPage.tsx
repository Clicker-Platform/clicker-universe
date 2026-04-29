'use client';

import { useEffect, useState } from 'react';
import { Save, Lock, AlertCircle, Tag, Calendar, Users } from 'lucide-react';
import { getPromoSettings, updatePromoSettings } from '@/lib/modules/promo/api';
import { PromoSettings } from '@/lib/modules/promo/api';
import { useSite } from '@/lib/site-context';
import { logger } from '@/lib/logger-edge';
import { usePermission } from '@/lib/hooks/use-permission';

export default function PromoSettingsPage() {
    const { siteId } = useSite();
    const [settings, setSettings] = useState<PromoSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const { canEdit, checkAccess } = usePermission('promo', 'settings');

    useEffect(() => {
        if (siteId) {
            loadSettings();
        }
    }, [siteId]);

    async function loadSettings() {
        if (!siteId) return;
        try {
            setLoading(true);
            const data = await getPromoSettings(siteId);
            setSettings(data);
        } catch (error) {
            logger.error('promo.settings.load.failed', { siteId, error });
            setMessage({ type: 'error', text: 'Failed to load settings.' });
        } finally {
            setLoading(false);
        }
    }

    async function handleSave() {
        if (!checkAccess('edit')) return;
        if (!settings || !siteId) return;

        setSaving(true);
        setMessage(null);
        try {
            await updatePromoSettings(siteId, settings);
            setMessage({ type: 'success', text: 'Settings saved successfully.' });
        } catch (error) {
            logger.error('promo.settings.save.failed', { siteId, error });
            setMessage({ type: 'error', text: 'Failed to save settings.' });
        } finally {
            setSaving(false);
        }
    }

    if (loading) return <div className="p-8 text-center text-gray-500 dark:text-neutral-500">Loading settings...</div>;
    if (!settings) return <div className="p-8 text-center text-red-500">Error loading settings.</div>;

    return (
        <div className="max-w-4xl">
            <div className="hidden md:flex items-center justify-between mb-8">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-neutral-100">Promo Settings</h1>
                {!canEdit && (
                    <div className="bg-amber-50 text-amber-700 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 border border-amber-100">
                        <Lock size={16} />
                        View Only Mode
                    </div>
                )}
            </div>

            {message && (
                <div className={`p-4 rounded-lg mb-6 flex items-center gap-3 ${
                    message.type === 'success'
                        ? 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 border border-green-100 dark:border-green-900/50'
                        : 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border border-red-100 dark:border-red-900/50'
                }`}>
                    <AlertCircle size={20} />
                    <p className="font-bold">{message.text}</p>
                </div>
            )}

            <div className="bg-white dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800 overflow-hidden flex flex-col">
                <div className={`flex-1 p-8 space-y-8 ${!canEdit ? 'opacity-80 pointer-events-none grayscale-[0.5]' : ''}`}>
                    {/* Voucher Code Prefix */}
                    <section>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-950/30 flex items-center justify-center text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50">
                                <Tag size={18} />
                            </div>
                            <div>
                                <h2 className="text-base font-bold text-gray-900 dark:text-neutral-100">Voucher Code Prefix</h2>
                                <p className="text-sm text-gray-500 dark:text-neutral-500">Prefix used when generating voucher codes (e.g. "VCH" → VCH-AB12CD).</p>
                            </div>
                        </div>
                        <div className="max-w-xs">
                            <label className="block text-xs font-bold text-gray-400 dark:text-neutral-600 uppercase tracking-wider mb-2">
                                Code Prefix
                            </label>
                            <input
                                type="text"
                                maxLength={5}
                                readOnly={!canEdit}
                                value={settings.voucherCodePrefix}
                                onChange={(e) =>
                                    setSettings({
                                        ...settings,
                                        voucherCodePrefix: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''),
                                    })
                                }
                                placeholder="VCH"
                                className="w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-brand-dark focus:ring-2 focus:ring-brand-dark/10 outline-none transition-all font-bold tracking-widest uppercase"
                            />
                            <p className="mt-2 text-xs text-gray-400 dark:text-neutral-600">Max 5 characters. Letters and numbers only.</p>
                        </div>
                    </section>

                    <hr className="border-gray-100 dark:border-neutral-800" />

                    {/* Default Voucher Expiry */}
                    <section>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-9 h-9 rounded-full bg-orange-100 dark:bg-orange-950/30 flex items-center justify-center text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-900/50">
                                <Calendar size={18} />
                            </div>
                            <div>
                                <h2 className="text-base font-bold text-gray-900 dark:text-neutral-100">Default Voucher Expiry</h2>
                                <p className="text-sm text-gray-500 dark:text-neutral-500">Number of days before a newly issued voucher expires.</p>
                            </div>
                        </div>
                        <div className="max-w-xs">
                            <label className="block text-xs font-bold text-gray-400 dark:text-neutral-600 uppercase tracking-wider mb-2">
                                Expiry (days)
                            </label>
                            <div className="relative">
                                <input
                                    type="number"
                                    min={1}
                                    readOnly={!canEdit}
                                    value={settings.defaultVoucherExpiryDays}
                                    onChange={(e) =>
                                        setSettings({
                                            ...settings,
                                            defaultVoucherExpiryDays: Math.max(1, parseInt(e.target.value) || 1),
                                        })
                                    }
                                    className="w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-brand-dark focus:ring-2 focus:ring-brand-dark/10 outline-none transition-all font-bold"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 dark:text-neutral-600 font-bold">days</span>
                            </div>
                            <p className="mt-2 text-xs text-gray-400 dark:text-neutral-600">Minimum 1 day. Individual promos can override this.</p>
                        </div>
                    </section>

                    <hr className="border-gray-100 dark:border-neutral-800" />

                    {/* Allow Guest Codes */}
                    <section>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-9 h-9 rounded-full bg-purple-100 dark:bg-purple-950/30 flex items-center justify-center text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-900/50">
                                <Users size={18} />
                            </div>
                            <div>
                                <h2 className="text-base font-bold text-gray-900 dark:text-neutral-100">Guest Access</h2>
                                <p className="text-sm text-gray-500 dark:text-neutral-500">Control whether guests (without member login) can apply promo codes.</p>
                            </div>
                        </div>
                        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-neutral-800/50 rounded-lg max-w-md border border-gray-100 dark:border-neutral-800">
                            <div>
                                <span className="block font-bold text-gray-800 dark:text-neutral-200">Allow Guest Codes</span>
                                <span className="block text-sm text-gray-500 dark:text-neutral-500">
                                    Guests can enter and redeem promo codes without logging in.
                                </span>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 ml-4">
                                <input
                                    type="checkbox"
                                    checked={settings.allowGuestCodes}
                                    onChange={(e) => setSettings({ ...settings, allowGuestCodes: e.target.checked })}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-200 dark:bg-neutral-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-dark/10 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 dark:after:border-neutral-700 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-dark" />
                            </label>
                        </div>
                    </section>
                </div>

                {/* Actions */}
                <div className="bg-gray-50 dark:bg-neutral-800/50 px-8 py-6 border-t border-gray-100 dark:border-neutral-800 flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={saving || !canEdit}
                        className="flex items-center gap-2 bg-studio-blue text-white font-bold py-3 px-8 rounded-lg hover:bg-studio-blue/85 transition-all shadow-lg shadow-brand-dark/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                    >
                        {saving ? (
                            <>Processing...</>
                        ) : (
                            <>
                                {canEdit ? <Save size={18} /> : <Lock size={18} />}
                                {canEdit ? 'Save Settings' : 'View Only Mode'}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
