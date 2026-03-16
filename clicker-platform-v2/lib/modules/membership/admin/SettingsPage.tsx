"use client";

import React, { useState, useEffect } from 'react';
import { Save, Settings as SettingsIcon, AlertCircle, Lock } from 'lucide-react';
import { getMembershipSettings, updateMembershipSettings } from '../api';
import { MembershipSettings } from '../types';
import { useSite } from '@/lib/site-context';
import { usePermission } from '@/lib/hooks/use-permission';

export default function MembershipSettingsPage() {
    const { siteId } = useSite();
    const [settings, setSettings] = useState<MembershipSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const { canEdit, checkAccess } = usePermission('membership', 'settings');

    useEffect(() => {
        if (siteId) {
            loadSettings();
        }
    }, [siteId]);

    async function loadSettings() {
        if (!siteId) return;
        try {
            setLoading(true);
            const data = await getMembershipSettings(siteId);
            setSettings(data);
        } catch (error) {
            console.error("Failed to load settings:", error);
            setMessage({ type: 'error', text: "Failed to load settings." });
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
            await updateMembershipSettings(siteId, settings);
            setMessage({ type: 'success', text: "Settings saved successfully." });
        } catch (error) {
            console.error("Failed to save settings:", error);
            setMessage({ type: 'error', text: "Failed to save settings." });
        } finally {
            setSaving(false);
        }
    }

    if (loading) return <div className="p-8 text-center text-gray-500 dark:text-neutral-500">Loading settings...</div>;
    if (!settings) return <div className="p-8 text-center text-red-500">Error loading settings.</div>;

    return (
        <div className="max-w-4xl mx-auto p-6">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-brand-dark/5 rounded-xl flex items-center justify-center text-brand-dark">
                        <SettingsIcon size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-brand-dark">Membership Settings</h1>
                        <p className="text-gray-500 dark:text-neutral-500">Configure your loyalty program and membership rules.</p>
                    </div>
                </div>
                {!canEdit && (
                    <div className="bg-amber-50 text-amber-700 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 border border-amber-100">
                        <Lock size={16} />
                        View Only Mode
                    </div>
                )}
            </div>

            {message && (
                <div className={`p-4 rounded-xl mb-6 flex items-center gap-3 ${message.type === 'success' ? 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 border border-green-100 dark:border-green-900/50' : 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border border-red-100 dark:border-red-900/50'
                    }`}>
                    <AlertCircle size={20} />
                    <p className="font-bold">{message.text}</p>
                </div>
            )}

            <div className="bg-white dark:bg-neutral-900 rounded-3xl border-[3px] border-brand-dark shadow-sm overflow-hidden flex flex-col min-h-[600px]">
                <div className={`flex-1 overflow-auto p-8 space-y-8 ${!canEdit ? 'opacity-80 pointer-events-none grayscale-[0.5]' : ''}`}>
                    {/* General Settings */}
                    <section>
                        <h2 className="text-lg font-bold text-gray-900 dark:text-neutral-100 mb-4 flex items-center gap-2">
                            General Configuration
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-gray-50 dark:bg-neutral-800/50 p-6 rounded-2xl border border-gray-100 dark:border-neutral-800">
                                <label className="flex items-center justify-between cursor-pointer group">
                                    <div>
                                        <span className="font-bold text-gray-900 dark:text-neutral-100 block mb-1">Enable Loyalty Program</span>
                                        <span className="text-sm text-gray-500 dark:text-neutral-500">Allow members to earn and redeem points.</span>
                                    </div>
                                    <div
                                        className={`w-14 h-8 rounded-full p-1 transition-colors duration-200 ${settings.enableLoyalty ? 'bg-green-500' : 'bg-gray-300 dark:bg-neutral-600'}`}
                                        onClick={() => canEdit && setSettings({ ...settings, enableLoyalty: !settings.enableLoyalty })}
                                    >
                                        <div className={`w-6 h-6 bg-white rounded-full shadow-sm transition-transform duration-200 ${settings.enableLoyalty ? 'translate-x-6' : 'translate-x-0'}`} />
                                    </div>
                                </label>
                            </div>
                        </div>
                    </section>

                    <hr className="border-gray-100 dark:border-neutral-800" />

                    {/* Currency & Points */}
                    <section className={!settings.enableLoyalty ? 'opacity-50 pointer-events-none' : ''}>
                        <h2 className="text-lg font-bold text-gray-900 dark:text-neutral-100 mb-4">Points Configuration</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 dark:text-neutral-600 uppercase tracking-wider mb-2">
                                    Points Label
                                </label>
                                <input
                                    type="text"
                                    value={settings.pointsName}
                                    readOnly={!canEdit}
                                    onChange={(e) => setSettings({ ...settings, pointsName: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-brand-dark focus:ring-2 focus:ring-brand-dark/10 outline-none transition-all font-bold disabled:bg-gray-50 dark:disabled:bg-neutral-800"
                                    placeholder="e.g. Stars, Coins, Credits"
                                />
                                <p className="mt-2 text-xs text-gray-400 dark:text-neutral-600">What do you call your loyalty currency?</p>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-400 dark:text-neutral-600 uppercase tracking-wider mb-2">
                                    Currency Symbol
                                </label>
                                <input
                                    type="text"
                                    value={settings.currency || '$'}
                                    readOnly={!canEdit}
                                    onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-brand-dark focus:ring-2 focus:ring-brand-dark/10 outline-none transition-all font-bold disabled:bg-gray-50 dark:disabled:bg-neutral-800"
                                    placeholder="$"
                                />
                                <p className="mt-2 text-xs text-gray-400 dark:text-neutral-600">Used for display only.</p>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-400 dark:text-neutral-600 uppercase tracking-wider mb-2">
                                    Earning Rule
                                </label>
                                <div className="flex items-center gap-3">
                                    <div className="relative flex-1">
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-neutral-600 font-bold text-xs mt-0.5">
                                            {settings.currency || '$'}
                                        </div>
                                        <input
                                            type="number"
                                            min="1"
                                            step="1000"
                                            readOnly={!canEdit}
                                            value={settings.spendBlock || 1}
                                            onChange={(e) => {
                                                const spend = parseFloat(e.target.value) || 1;
                                                const visiblePoints = settings.earningRatio * (settings.spendBlock || 1);
                                                setSettings({ ...settings, spendBlock: spend, earningRatio: visiblePoints / spend });
                                            }}
                                            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-brand-dark focus:ring-2 focus:ring-brand-dark/10 outline-none transition-all font-bold pl-8 disabled:bg-gray-50 dark:disabled:bg-neutral-800"
                                            placeholder="Spend"
                                        />
                                    </div>

                                    <div className="text-gray-400 dark:text-neutral-600 font-bold text-sm">EARNS</div>

                                    <div className="relative flex-1">
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-neutral-600 font-bold text-xs mt-0.5">➕</div>
                                        <input
                                            type="number"
                                            min="1"
                                            step="1"
                                            readOnly={!canEdit}
                                            value={(settings.earningRatio * (settings.spendBlock || 1))}
                                            onChange={(e) => {
                                                const points = parseFloat(e.target.value) || 0;
                                                const spend = settings.spendBlock || 1;
                                                setSettings({ ...settings, earningRatio: points / spend });
                                            }}
                                            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-brand-dark focus:ring-2 focus:ring-brand-dark/10 outline-none transition-all font-bold pl-8 disabled:bg-gray-50 dark:disabled:bg-neutral-800"
                                            placeholder="Points"
                                        />
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-neutral-600 text-xs font-bold">Pts</div>
                                    </div>
                                </div>
                                <p className="mt-2 text-xs text-gray-400 dark:text-neutral-600">
                                    Every <strong>{settings.currency || '$'}{settings.spendBlock || 1}</strong> spent earns <strong>{Math.round((settings.earningRatio * (settings.spendBlock || 1)) * 100) / 100} {settings.pointsName}</strong>.
                                </p>
                            </div>
                        </div>
                    </section>
                </div>

                {/* Actions */}
                <div className="bg-gray-50 dark:bg-neutral-800/50 px-8 py-6 border-t border-gray-100 dark:border-neutral-800 flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={saving || !canEdit}
                        className="flex items-center gap-2 bg-brand-dark text-white font-bold py-3 px-8 rounded-xl hover:bg-brand-dark/90 transition-all shadow-lg shadow-brand-dark/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
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
