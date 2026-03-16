'use client';

import { useEffect, useState } from 'react';
import { getPOSSettings, updatePOSSettings } from '../api';
import { POSSettings } from '../types';
import { toast } from 'sonner';
import { Save, Loader2, Settings2, CreditCard, LayoutTemplate, Hash } from 'lucide-react';

import { useSite } from '@/lib/site-context';

export default function POSSettingsPage() {
    const { siteId } = useSite();
    const [settings, setSettings] = useState<POSSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (siteId) {
            loadSettings();
        }
    }, [siteId]);

    const loadSettings = async () => {
        if (!siteId) return;
        try {
            const data = await getPOSSettings(siteId);
            setSettings(data);
        } catch (error) {
            console.error(error);
            toast.error("Failed to load settings");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!settings || !siteId) return;
        setSaving(true);
        try {
            await updatePOSSettings(siteId, settings);
            toast.success("Settings saved successfully");
        } catch (error) {
            console.error(error);
            toast.error("Failed to save settings");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-brand-dark" size={32} /></div>;
    if (!settings) return <div>Error loading settings</div>;

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-brand-dark mb-2 uppercase tracking-tight flex items-center gap-3">
                        <Settings2 size={32} /> POS SETTINGS
                    </h1>
                    <p className="text-gray-600 dark:text-neutral-400 font-medium">Configure POS system</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 bg-brand-dark text-white px-6 py-3 rounded-xl font-bold hover:bg-gray-800 disabled:bg-gray-400 transition-all active:scale-95"
                >
                    {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                    Save Changes
                </button>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Operation Mode */}
                <div className="bg-white dark:bg-neutral-900 rounded-3xl border-[3px] border-brand-dark p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 border border-blue-200">
                            <LayoutTemplate size={20} />
                        </div>
                        <h3 className="font-bold text-xl text-gray-800 dark:text-neutral-200">Operation Mode</h3>
                    </div>

                    <div className="space-y-4">
                        <label className={`
                            flex items-center p-4 rounded-xl border-2 cursor-pointer transition-all
                            ${settings.mode === 'fast-checkout' ? 'border-brand-dark bg-brand-dark/5' : 'border-gray-100 dark:border-neutral-800 hover:border-gray-200 dark:hover:border-neutral-700'}
                        `}>
                            <input
                                type="radio"
                                name="mode"
                                value="fast-checkout"
                                checked={settings.mode === 'fast-checkout'}
                                onChange={() => setSettings({ ...settings, mode: 'fast-checkout' })}
                                className="w-5 h-5 text-brand-dark accent-brand-dark"
                            />
                            <div className="ml-4">
                                <span className="block font-bold text-gray-800 dark:text-neutral-200">Fast Checkout (QSR)</span>
                                <span className="block text-sm text-gray-500 dark:text-neutral-500">Each order is separate. Ideal for Takeout/Counter Service.</span>
                            </div>
                        </label>

                        <label className={`
                            flex items-center p-4 rounded-xl border-2 cursor-pointer transition-all
                            ${settings.mode === 'open-bill' ? 'border-brand-dark bg-brand-dark/5' : 'border-gray-100 dark:border-neutral-800 hover:border-gray-200 dark:hover:border-neutral-700'}
                        `}>
                            <input
                                type="radio"
                                name="mode"
                                value="open-bill"
                                checked={settings.mode === 'open-bill'}
                                onChange={() => setSettings({ ...settings, mode: 'open-bill' })}
                                className="w-5 h-5 text-brand-dark accent-brand-dark"
                            />
                            <div className="ml-4">
                                <span className="block font-bold text-gray-800 dark:text-neutral-200">Open Bill (Dine-in)</span>
                                <span className="block text-sm text-gray-500 dark:text-neutral-500">Add active orders to a Tab. Payment at the end.</span>
                            </div>
                        </label>
                    </div>
                </div>

                {/* Table Management */}
                <div className="bg-white dark:bg-neutral-900 rounded-3xl border-[3px] border-brand-dark p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 border border-purple-200">
                            <Hash size={20} />
                        </div>
                        <h3 className="font-bold text-xl text-gray-800 dark:text-neutral-200">Table Management</h3>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-neutral-800/50 rounded-xl mb-4">
                        <div>
                            <span className="block font-bold text-gray-800 dark:text-neutral-200">Require Table Number</span>
                            <span className="block text-sm text-gray-500 dark:text-neutral-500">Force users to enter table number</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={settings.requireTableNumber}
                                onChange={(e) => setSettings({ ...settings, requireTableNumber: e.target.checked })}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-200 dark:bg-neutral-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-dark/10 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 dark:after:border-neutral-700 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-dark"></div>
                        </label>
                    </div>
                </div>

                {/* Payment Methods */}
                <div className="col-span-1 xl:col-span-2 bg-white dark:bg-neutral-900 rounded-3xl border-[3px] border-brand-dark p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-950/30 flex items-center justify-center text-green-600 dark:text-green-400 border border-green-200 dark:border-green-900/50">
                            <CreditCard size={20} />
                        </div>
                        <h3 className="font-bold text-xl text-gray-800 dark:text-neutral-200">Accepted Payment Methods</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Cash */}
                        <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-neutral-800/50 rounded-xl cursor-pointer hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors">
                            <span className="font-bold text-gray-700 dark:text-neutral-300">Cash</span>
                            <input
                                type="checkbox"
                                checked={settings.paymentMethods?.cash ?? true}
                                onChange={(e) => {
                                    const currentMethods = settings.paymentMethods || { cash: true, card: true, qris: true };
                                    setSettings({
                                        ...settings,
                                        paymentMethods: { ...currentMethods, cash: e.target.checked }
                                    });
                                }}
                                className="w-5 h-5 text-brand-dark rounded focus:ring-brand-dark"
                            />
                        </label>

                        {/* Card */}
                        <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-neutral-800/50 rounded-xl cursor-pointer hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors">
                            <span className="font-bold text-gray-700 dark:text-neutral-300">Credit/Debit Card</span>
                            <input
                                type="checkbox"
                                checked={settings.paymentMethods?.card ?? true}
                                onChange={(e) => {
                                    const currentMethods = settings.paymentMethods || { cash: true, card: true, qris: true };
                                    setSettings({
                                        ...settings,
                                        paymentMethods: { ...currentMethods, card: e.target.checked }
                                    });
                                }}
                                className="w-5 h-5 text-brand-dark rounded focus:ring-brand-dark"
                            />
                        </label>

                        {/* QRIS */}
                        <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-neutral-800/50 rounded-xl cursor-pointer hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors">
                            <span className="font-bold text-gray-700 dark:text-neutral-300">QRIS / E-Wallet</span>
                            <input
                                type="checkbox"
                                checked={settings.paymentMethods?.qris ?? true}
                                onChange={(e) => {
                                    const currentMethods = settings.paymentMethods || { cash: true, card: true, qris: true };
                                    setSettings({
                                        ...settings,
                                        paymentMethods: { ...currentMethods, qris: e.target.checked }
                                    });
                                }}
                                className="w-5 h-5 text-brand-dark rounded focus:ring-brand-dark"
                            />
                        </label>
                    </div>
                </div>

                {/* Tax & Service Charge */}
                <div className="col-span-1 xl:col-span-2 bg-white dark:bg-neutral-900 rounded-3xl border-[3px] border-brand-dark p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 border border-orange-200">
                            <span className="font-bold text-lg">%</span>
                        </div>
                        <h3 className="font-bold text-xl text-gray-800 dark:text-neutral-200">Tax & Service Charge</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Service Charge */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-neutral-800/50 rounded-xl">
                                <div>
                                    <span className="block font-bold text-gray-800 dark:text-neutral-200">Service Charge</span>
                                    <span className="block text-sm text-gray-500 dark:text-neutral-500">Applied to Subtotal</span>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={settings.taxSettings?.serviceCharge?.enabled ?? false}
                                        onChange={(e) => setSettings({
                                            ...settings,
                                            taxSettings: {
                                                ...settings.taxSettings,
                                                serviceCharge: {
                                                    rate: settings.taxSettings?.serviceCharge?.rate ?? 10,
                                                    enabled: e.target.checked
                                                },
                                                restaurantTax: settings.taxSettings?.restaurantTax ?? { enabled: false, rate: 10 }
                                            }
                                        })}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-200 dark:bg-neutral-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-dark/10 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 dark:after:border-neutral-700 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-dark"></div>
                                </label>
                            </div>

                            {/* Rate Input */}
                            <div className={`transition-all duration-300 ${settings.taxSettings?.serviceCharge?.enabled ? 'opacity-100 max-h-20' : 'opacity-50 max-h-20 grayscale pointer-events-none'}`}>
                                <div className="flex items-center gap-2 p-3 border-2 border-dashed border-gray-200 dark:border-neutral-700 rounded-xl bg-white dark:bg-neutral-800">
                                    <span className="text-gray-500 dark:text-neutral-500 font-bold text-sm uppercase">Rate (%)</span>
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={settings.taxSettings?.serviceCharge?.rate ?? 10}
                                        onChange={(e) => setSettings({
                                            ...settings,
                                            taxSettings: {
                                                ...settings.taxSettings!,
                                                serviceCharge: {
                                                    ...settings.taxSettings!.serviceCharge,
                                                    rate: parseFloat(e.target.value) || 0
                                                }
                                            }
                                        })}
                                        className="flex-1 font-bold text-right outline-none text-brand-dark"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Restaurant Tax */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-neutral-800/50 rounded-xl">
                                <div>
                                    <span className="block font-bold text-gray-800 dark:text-neutral-200">Restaurant Tax (PB1)</span>
                                    <span className="block text-sm text-gray-500 dark:text-neutral-500">Applied to (Subtotal + Service)</span>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={settings.taxSettings?.restaurantTax?.enabled ?? false}
                                        onChange={(e) => setSettings({
                                            ...settings,
                                            taxSettings: {
                                                ...settings.taxSettings,
                                                restaurantTax: {
                                                    rate: settings.taxSettings?.restaurantTax?.rate ?? 10,
                                                    enabled: e.target.checked
                                                },
                                                serviceCharge: settings.taxSettings?.serviceCharge ?? { enabled: false, rate: 10 }
                                            }
                                        })}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-200 dark:bg-neutral-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-dark/10 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 dark:after:border-neutral-700 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-dark"></div>
                                </label>
                            </div>
                            {/* Rate Input */}
                            <div className={`transition-all duration-300 ${settings.taxSettings?.restaurantTax?.enabled ? 'opacity-100 max-h-20' : 'opacity-50 max-h-20 grayscale pointer-events-none'}`}>
                                <div className="flex items-center gap-2 p-3 border-2 border-dashed border-gray-200 dark:border-neutral-700 rounded-xl bg-white dark:bg-neutral-800">
                                    <span className="text-gray-500 dark:text-neutral-500 font-bold text-sm uppercase">Rate (%)</span>
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={settings.taxSettings?.restaurantTax?.rate ?? 10}
                                        onChange={(e) => setSettings({
                                            ...settings,
                                            taxSettings: {
                                                ...settings.taxSettings!,
                                                restaurantTax: {
                                                    ...settings.taxSettings!.restaurantTax,
                                                    rate: parseFloat(e.target.value) || 0
                                                }
                                            }
                                        })}
                                        className="flex-1 font-bold text-right outline-none text-brand-dark"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
