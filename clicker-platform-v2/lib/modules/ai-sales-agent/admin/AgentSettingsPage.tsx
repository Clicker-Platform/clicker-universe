'use client';

import { useState, useEffect } from 'react';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';
import { Save, Bot, MessageSquare, Loader2, Sparkles, RefreshCw, Power, Brain, Settings2 } from 'lucide-react';
import { useSite } from '@/lib/site-context';

interface AgentConfig {
    enabled: boolean;
    name: string;
    personality: string;
    model: 'gemini-2.0-flash' | 'gemini-pro' | 'gpt-4';
    temperature: number;
    systemPrompt: string;
    contextWindow: number;
    features: {
        menuKnowledge: boolean;
        reservationHandling: boolean;
        pricingInquiries: boolean;
        dietaryAdvice: boolean;
    };
}

const DEFAULT_CONFIG: AgentConfig = {
    enabled: false,
    name: 'Sales Agent',
    personality: 'professional',
    model: 'gemini-2.0-flash',
    temperature: 0.7,
    systemPrompt: 'You are a helpful restaurant assistant...',
    contextWindow: 10,
    features: {
        menuKnowledge: true,
        reservationHandling: true,
        pricingInquiries: true,
        dietaryAdvice: true,
    },
};

export default function AgentSettingsPage() {
    const { siteId } = useSite();
    const [config, setConfig] = useState<AgentConfig>(DEFAULT_CONFIG);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'general' | 'knowledge'>('general');

    useEffect(() => {
        if (!siteId) return;

        const unsub = onSnapshot(doc(db, 'sites', siteId, 'modules', 'ai_sales'), (snap) => {
            if (snap.exists()) {
                setConfig({ ...DEFAULT_CONFIG, ...snap.data() } as AgentConfig);
            }
            setLoading(false);
        }, (error) => {
            console.error("Error fetching agent config:", error);
            toast.error("Failed to load agent settings");
            setLoading(false);
        });

        return () => unsub();
    }, [siteId]);

    const handleSave = async () => {
        if (!siteId) return;

        try {
            setSaving(true);
            await setDoc(doc(db, 'sites', siteId, 'modules', 'ai_sales'), config, { merge: true });
            toast.success('Agent settings saved successfully');
        } catch (error) {
            console.error('Error saving settings:', error);
            toast.error('Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    const updateConfig = (path: string, value: any) => {
        setConfig((prev) => {
            const newConfig = { ...prev };
            const parts = path.split('.');
            let current: any = newConfig;
            for (let i = 0; i < parts.length - 1; i++) {
                current = current[parts[i]];
            }
            current[parts[parts.length - 1]] = value;
            return newConfig;
        });
    };

    if (loading) {
        return (
            <div className="p-8 flex flex-col items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-orange mb-4"></div>
                <p className="text-gray-500 dark:text-neutral-500">Loading agent settings... ({siteId})</p>
            </div>
        );
    }

    if (!siteId) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <p className="text-gray-500 dark:text-neutral-500">Site Context Missing</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-4xl mx-auto pb-20">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">AI Sales Agent</h1>
                    <p className="text-gray-500 dark:text-neutral-500 mt-1">Configure your AI assistant for customer interaction</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-2.5 bg-brand-dark text-white rounded-xl font-bold hover:opacity-90 transition disabled:opacity-50"
                >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save Changes
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-gray-200 dark:border-neutral-800 pb-2">
                <button
                    onClick={() => setActiveTab('general')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${activeTab === 'general' ? 'bg-brand-dark text-white' : 'text-gray-600 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-700'
                        }`}
                >
                    <Settings2 className="h-4 w-4" />
                    General Settings
                </button>
                <button
                    onClick={() => setActiveTab('knowledge')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${activeTab === 'knowledge' ? 'bg-brand-dark text-white' : 'text-gray-600 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-700'
                        }`}
                >
                    <Brain className="h-4 w-4" />
                    Knowledge Base
                </button>
            </div>

            {activeTab === 'general' && (
                <div className="space-y-6">
                    {/* Status Card */}
                    <div className="bg-white dark:bg-neutral-900 rounded-2xl border-[3px] border-brand-dark p-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Power className="h-5 w-5 text-brand-dark" />
                                <div>
                                    <h3 className="font-bold text-lg">Agent Status</h3>
                                    <p className="text-gray-500 dark:text-neutral-500 text-sm">Enable or disable the AI agent</p>
                                </div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={config.enabled}
                                    onChange={(e) => updateConfig('enabled', e.target.checked)}
                                    className="sr-only peer"
                                />
                                <div className="w-14 h-7 bg-gray-200 dark:bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 dark:after:border-neutral-700 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-green-500"></div>
                                <span className={`ml-3 text-sm font-medium ${config.enabled ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-neutral-500'}`}>
                                    {config.enabled ? 'Active' : 'Disabled'}
                                </span>
                            </label>
                        </div>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
                        {/* Identity Card */}
                        <div className="bg-white dark:bg-neutral-900 rounded-2xl border-[3px] border-brand-dark p-6 space-y-4">
                            <div className="flex items-center gap-2 mb-4">
                                <Bot className="h-5 w-5 text-purple-600" />
                                <h3 className="font-bold text-lg">Identity & Persona</h3>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300">Agent Name</label>
                                <input
                                    type="text"
                                    value={config.name}
                                    onChange={(e) => updateConfig('name', e.target.value)}
                                    placeholder="e.g. Maya"
                                    className="w-full px-4 py-2.5 rounded-xl border-2 border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-brand-dark focus:ring-0 outline-none transition"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300">Personality Tone</label>
                                <select
                                    value={config.personality}
                                    onChange={(e) => updateConfig('personality', e.target.value)}
                                    className="w-full px-4 py-2.5 rounded-xl border-2 border-gray-200 dark:border-neutral-700 focus:border-brand-dark focus:ring-0 outline-none transition bg-white dark:bg-neutral-800 dark:text-neutral-200"
                                >
                                    <option value="professional">Professional & Formal</option>
                                    <option value="friendly">Friendly & Casual</option>
                                    <option value="enthusiastic">Enthusiastic & Energetic</option>
                                    <option value="humorous">Witty & Humorous</option>
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300">AI Model</label>
                                <select
                                    value={config.model}
                                    onChange={(e) => updateConfig('model', e.target.value)}
                                    className="w-full px-4 py-2.5 rounded-xl border-2 border-gray-200 dark:border-neutral-700 focus:border-brand-dark focus:ring-0 outline-none transition bg-white dark:bg-neutral-800 dark:text-neutral-200"
                                >
                                    <option value="gemini-2.0-flash">Gemini 2.0 Flash (Fastest)</option>
                                    <option value="gemini-pro">Gemini Pro</option>
                                    <option value="gpt-4">GPT-4</option>
                                </select>
                            </div>
                        </div>

                        {/* Behavior Card */}
                        <div className="bg-white dark:bg-neutral-900 rounded-2xl border-[3px] border-brand-dark p-6 space-y-4">
                            <div className="flex items-center gap-2 mb-4">
                                <MessageSquare className="h-5 w-5 text-blue-600" />
                                <h3 className="font-bold text-lg">Interaction Settings</h3>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300">
                                    Context Window: {config.contextWindow} messages
                                </label>
                                <input
                                    type="range"
                                    min="1"
                                    max="20"
                                    value={config.contextWindow}
                                    onChange={(e) => updateConfig('contextWindow', parseInt(e.target.value))}
                                    className="w-full h-2 bg-gray-200 dark:bg-neutral-700 rounded-lg appearance-none cursor-pointer"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300">
                                    Creativity: {config.temperature}
                                </label>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.1"
                                    value={config.temperature}
                                    onChange={(e) => updateConfig('temperature', parseFloat(e.target.value))}
                                    className="w-full h-2 bg-gray-200 dark:bg-neutral-700 rounded-lg appearance-none cursor-pointer"
                                />
                            </div>

                            <div className="border-t dark:border-neutral-800 pt-4 mt-4">
                                <p className="text-sm font-medium text-gray-700 dark:text-neutral-300 mb-3">Active Features</p>
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { key: 'menuKnowledge', label: 'Menu Q&A' },
                                        { key: 'reservationHandling', label: 'Reservations' },
                                        { key: 'pricingInquiries', label: 'Pricing' },
                                        { key: 'dietaryAdvice', label: 'Dietary Advice' },
                                    ].map((feat) => (
                                        <label key={feat.key} className="flex items-center gap-2 p-2 border dark:border-neutral-800 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-800 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={config.features[feat.key as keyof typeof config.features]}
                                                onChange={(e) => updateConfig(`features.${feat.key}`, e.target.checked)}
                                                className="w-4 h-4 text-brand-dark border-gray-300 dark:border-neutral-700 rounded focus:ring-brand-dark"
                                            />
                                            <span className="text-sm">{feat.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* System Prompt */}
                    <div className="bg-white dark:bg-neutral-900 rounded-2xl border-[3px] border-brand-dark p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Sparkles className="h-5 w-5 text-amber-500" />
                            <h3 className="font-bold text-lg">System Prompt</h3>
                        </div>
                        <textarea
                            value={config.systemPrompt}
                            onChange={(e) => updateConfig('systemPrompt', e.target.value)}
                            className="w-full min-h-[200px] px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-brand-dark focus:ring-0 outline-none transition font-mono text-sm"
                            placeholder="You are a helpful assistant..."
                        />
                        <button
                            onClick={() => updateConfig('systemPrompt', DEFAULT_CONFIG.systemPrompt)}
                            className="mt-2 text-xs text-gray-500 dark:text-neutral-500 hover:text-brand-dark"
                        >
                            Reset to default
                        </button>
                    </div>
                </div>
            )}

            {activeTab === 'knowledge' && (
                <div className="bg-white dark:bg-neutral-900 rounded-2xl border-[3px] border-brand-dark p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Brain className="h-5 w-5 text-purple-600" />
                        <h3 className="font-bold text-lg">Knowledge Base</h3>
                    </div>
                    <p className="text-gray-500 dark:text-neutral-500 text-sm mb-4">
                        Train the AI with your website content and PDF documents. This feature is coming soon.
                    </p>
                    <div className="bg-gray-50 dark:bg-neutral-800/50 border-2 border-dashed border-gray-200 dark:border-neutral-800 rounded-xl p-8 text-center">
                        <RefreshCw className="h-8 w-8 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-400 dark:text-neutral-600">Knowledge Base Management Coming Soon</p>
                    </div>
                </div>
            )}
        </div>
    );
}
