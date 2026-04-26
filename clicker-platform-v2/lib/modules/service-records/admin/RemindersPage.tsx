'use client';

import { useEffect, useState } from 'react';
import { Bell, Clock, Mail } from 'lucide-react';
import { useSite } from '@/lib/site-context';
import { logger } from '@/lib/logger-edge';
import { useUser } from '@/lib/user-context';
import { getServiceConfig, updateServiceConfig, getReminderQueue } from '../api';
import type { ServiceConfig, ReminderQueueEntry } from '../types';

const TEMPLATE_VARS = [
    '{{ownerName}}', '{{vehiclePlate}}', '{{vehicleMakeModel}}',
    '{{serviceTypeName}}', '{{productUsed}}', '{{serviceDate}}',
    '{{warrantyCode}}', '{{warrantyExpiry}}', '{{warrantyUrl}}',
    '{{businessName}}',
];

const REMINDER_LABELS: Record<string, { label: string; description: string; icon: string }> = {
    r0: { label: 'R0 — Warranty Delivery', description: 'Sent immediately on completion. Only for services with warranty.', icon: '🛡️' },
    r1: { label: 'R1 — Feedback Survey', description: 'Sent N days after completion. For all service types.', icon: '⭐' },
    r2: { label: 'R2 — Maintenance Reminder', description: 'Repeating reminder every N months after completion.', icon: '🔧' },
    r3: { label: 'R3 — Warranty Expiry', description: 'Sent N days before warranty expiry. Only for services with warranty.', icon: '⚠️' },
};

function QueueStatusBadge({ status }: { status: ReminderQueueEntry['status'] }) {
    const cfg: Record<string, string> = {
        PENDING: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400',
        SENT: 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400',
        FAILED: 'bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400',
        SKIPPED: 'bg-gray-100 text-gray-500 dark:bg-neutral-800 dark:text-neutral-400',
    };
    return (
        <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${cfg[status] || cfg.PENDING}`}>
            {status}
        </span>
    );
}

export default function RemindersPage() {
    const { siteId } = useSite();
    const { isOwner } = useUser();
    const [config, setConfig] = useState<ServiceConfig | null>(null);
    const [queue, setQueue] = useState<ReminderQueueEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTemplate, setActiveTemplate] = useState<'r0' | 'r1' | 'r2' | 'r3'>('r0');
    const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    useEffect(() => {
        if (!siteId) return;
        loadData();
    }, [siteId]);

    async function loadData() {
        setLoading(true);
        try {
            const [cfg, queueItems] = await Promise.all([
                getServiceConfig(siteId),
                getReminderQueue(siteId),
            ]);
            setConfig(cfg);
            setQueue(queueItems);
        } catch (err) {
            logger.error('service-records.reminders.load.failed', { siteId, error: err });
        } finally {
            setLoading(false);
        }
    }

    function showToast(type: 'success' | 'error', message: string) {
        setToast({ type, message });
        setTimeout(() => setToast(null), 3000);
    }

    function updateConfig(updates: Partial<ServiceConfig>) {
        setConfig(prev => prev ? { ...prev, ...updates } : prev);
    }

    function updateReminder(field: string, value: any) {
        setConfig(prev => prev ? {
            ...prev,
            reminders: { ...prev.reminders, [field]: value }
        } : prev);
    }

    function updateTemplate(key: 'r0' | 'r1' | 'r2' | 'r3', field: 'subject' | 'body', value: string) {
        setConfig(prev => prev ? {
            ...prev,
            reminderTemplates: {
                ...prev.reminderTemplates,
                [key]: { ...prev.reminderTemplates[key], [field]: value }
            }
        } : prev);
    }

    async function handleSave() {
        if (!isOwner || !config) return;
        setSaving(true);
        try {
            await updateServiceConfig(siteId, {
                reminders: config.reminders,
                reminderTemplates: config.reminderTemplates,
                featuresEnabled: config.featuresEnabled,
            });
            showToast('success', 'Reminder settings saved');
        } catch (err) {
            logger.error('service-records.reminders.save.failed', { siteId, error: err });
            showToast('error', 'Failed to save settings');
        } finally {
            setSaving(false);
        }
    }

    if (loading || !config) {
        return (
            <div className="animate-pulse space-y-4 max-w-3xl">
                <div className="h-8 bg-gray-200 dark:bg-neutral-700 rounded w-48" />
                <div className="h-40 bg-gray-200 dark:bg-neutral-700 rounded-lg" />
            </div>
        );
    }

    const reminders = config.reminders;
    const templates = config.reminderTemplates;

    return (
        <div className="max-w-3xl space-y-5">
            {toast && (
                <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-sm font-medium shadow-lg ${
                    toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                }`}>
                    {toast.message}
                </div>
            )}

            <h1 className="hidden md:block text-2xl font-bold text-gray-900 dark:text-neutral-100">Reminders</h1>

            {/* Master toggle */}
            <div className="bg-white dark:bg-neutral-900 p-5 rounded-lg border border-gray-200 dark:border-neutral-800 flex items-center justify-between">
                <div>
                    <p className="text-sm font-semibold text-gray-800 dark:text-neutral-200">Reminder Engine</p>
                    <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">
                        {config.featuresEnabled.reminderEngine
                            ? 'Reminders will be queued on record completion.'
                            : 'Disabled — no reminders will be queued. Requires Cloud Functions for actual dispatch.'}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => isOwner && updateConfig({ featuresEnabled: { ...config.featuresEnabled, reminderEngine: !config.featuresEnabled.reminderEngine } })}
                    disabled={!isOwner}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
                        config.featuresEnabled.reminderEngine ? 'bg-green-500' : 'bg-gray-200 dark:bg-neutral-700'
                    }`}
                >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                        config.featuresEnabled.reminderEngine ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                </button>
            </div>

            {/* Reminder configurations */}
            <div className="bg-white dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800 overflow-hidden">
                {/* R0 */}
                <div className="p-5 border-b border-gray-50 dark:border-neutral-800">
                    <div className="flex items-center justify-between">
                        <div className="flex items-start gap-3">
                            <span className="text-xl">{REMINDER_LABELS.r0.icon}</span>
                            <div>
                                <p className="text-sm font-semibold text-gray-800 dark:text-neutral-200">{REMINDER_LABELS.r0.label}</p>
                                <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">{REMINDER_LABELS.r0.description}</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => isOwner && updateReminder('r0Enabled', !reminders.r0Enabled)}
                            disabled={!isOwner || !config.featuresEnabled.warrantyCards}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 ${
                                reminders.r0Enabled && config.featuresEnabled.warrantyCards ? 'bg-green-500' : 'bg-gray-200 dark:bg-neutral-700'
                            }`}
                        >
                            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                                reminders.r0Enabled && config.featuresEnabled.warrantyCards ? 'translate-x-4' : 'translate-x-0.5'
                            }`} />
                        </button>
                    </div>
                    {!config.featuresEnabled.warrantyCards && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">Enable warranty cards in Settings to activate R0.</p>
                    )}
                </div>

                {/* R1 */}
                <div className="p-5 border-b border-gray-50 dark:border-neutral-800">
                    <div className="flex items-center justify-between">
                        <div className="flex items-start gap-3">
                            <span className="text-xl">{REMINDER_LABELS.r1.icon}</span>
                            <div>
                                <p className="text-sm font-semibold text-gray-800 dark:text-neutral-200">{REMINDER_LABELS.r1.label}</p>
                                <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">{REMINDER_LABELS.r1.description}</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => isOwner && updateReminder('r1Enabled', !reminders.r1Enabled)}
                            disabled={!isOwner}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 ${
                                reminders.r1Enabled ? 'bg-green-500' : 'bg-gray-200 dark:bg-neutral-700'
                            }`}
                        >
                            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                                reminders.r1Enabled ? 'translate-x-4' : 'translate-x-0.5'
                            }`} />
                        </button>
                    </div>
                    {reminders.r1Enabled && (
                        <div className="mt-3 flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5 text-gray-400 dark:text-neutral-500" />
                            <span className="text-xs text-gray-600 dark:text-neutral-400">Send</span>
                            <input
                                type="number"
                                min={1}
                                max={30}
                                value={reminders.r1DaysAfter}
                                onChange={e => isOwner && updateReminder('r1DaysAfter', parseInt(e.target.value) || 10)}
                                disabled={!isOwner}
                                className="w-16 rounded-lg border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-gray-400 dark:focus:border-neutral-500 focus:ring-0 px-2 py-1 text-xs text-center disabled:bg-gray-50 dark:disabled:bg-neutral-800"
                            />
                            <span className="text-xs text-gray-600 dark:text-neutral-400">days after completion</span>
                        </div>
                    )}
                </div>

                {/* R2 */}
                <div className="p-5 border-b border-gray-50 dark:border-neutral-800">
                    <div className="flex items-center justify-between">
                        <div className="flex items-start gap-3">
                            <span className="text-xl">{REMINDER_LABELS.r2.icon}</span>
                            <div>
                                <p className="text-sm font-semibold text-gray-800 dark:text-neutral-200">{REMINDER_LABELS.r2.label}</p>
                                <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">{REMINDER_LABELS.r2.description}</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => isOwner && updateReminder('r2Enabled', !reminders.r2Enabled)}
                            disabled={!isOwner}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 ${
                                reminders.r2Enabled ? 'bg-green-500' : 'bg-gray-200 dark:bg-neutral-700'
                            }`}
                        >
                            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                                reminders.r2Enabled ? 'translate-x-4' : 'translate-x-0.5'
                            }`} />
                        </button>
                    </div>
                    {reminders.r2Enabled && (
                        <div className="mt-3 flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5 text-gray-400 dark:text-neutral-500" />
                            <span className="text-xs text-gray-600 dark:text-neutral-400">Repeat every</span>
                            <input
                                type="number"
                                min={1}
                                max={24}
                                value={reminders.r2MonthsAfter}
                                onChange={e => isOwner && updateReminder('r2MonthsAfter', parseInt(e.target.value) || 6)}
                                disabled={!isOwner}
                                className="w-16 rounded-lg border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-gray-400 dark:focus:border-neutral-500 focus:ring-0 px-2 py-1 text-xs text-center disabled:bg-gray-50 dark:disabled:bg-neutral-800"
                            />
                            <span className="text-xs text-gray-600 dark:text-neutral-400">months</span>
                        </div>
                    )}
                </div>

                {/* R3 */}
                <div className="p-5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-start gap-3">
                            <span className="text-xl">{REMINDER_LABELS.r3.icon}</span>
                            <div>
                                <p className="text-sm font-semibold text-gray-800 dark:text-neutral-200">{REMINDER_LABELS.r3.label}</p>
                                <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">{REMINDER_LABELS.r3.description}</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => isOwner && updateReminder('r3Enabled', !reminders.r3Enabled)}
                            disabled={!isOwner || !config.featuresEnabled.warrantyCards}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 ${
                                reminders.r3Enabled && config.featuresEnabled.warrantyCards ? 'bg-green-500' : 'bg-gray-200 dark:bg-neutral-700'
                            }`}
                        >
                            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                                reminders.r3Enabled && config.featuresEnabled.warrantyCards ? 'translate-x-4' : 'translate-x-0.5'
                            }`} />
                        </button>
                    </div>
                    {reminders.r3Enabled && config.featuresEnabled.warrantyCards && (
                        <div className="mt-3 flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5 text-gray-400 dark:text-neutral-500" />
                            <span className="text-xs text-gray-600 dark:text-neutral-400">Send</span>
                            <input
                                type="number"
                                min={1}
                                max={90}
                                value={reminders.r3DaysBeforeExpiry}
                                onChange={e => isOwner && updateReminder('r3DaysBeforeExpiry', parseInt(e.target.value) || 30)}
                                disabled={!isOwner}
                                className="w-16 rounded-lg border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-gray-400 dark:focus:border-neutral-500 focus:ring-0 px-2 py-1 text-xs text-center disabled:bg-gray-50 dark:disabled:bg-neutral-800"
                            />
                            <span className="text-xs text-gray-600 dark:text-neutral-400">days before warranty expiry</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Template Editor */}
            <div className="bg-white dark:bg-neutral-900 p-5 rounded-lg border border-gray-200 dark:border-neutral-800 space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-semibold text-gray-800 dark:text-neutral-200">Email Templates</p>
                        <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">All copy reads from here at dispatch time — never hardcoded.</p>
                    </div>
                </div>

                {/* Template tabs */}
                <div className="flex gap-1 bg-gray-100 dark:bg-neutral-800 p-1 rounded-lg">
                    {(['r0', 'r1', 'r2', 'r3'] as const).map(key => (
                        <button
                            key={key}
                            onClick={() => setActiveTemplate(key)}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                activeTemplate === key ? 'bg-white dark:bg-neutral-700 shadow text-gray-900 dark:text-neutral-100' : 'text-gray-500 dark:text-neutral-400'
                            }`}
                        >
                            {key.toUpperCase()}
                        </button>
                    ))}
                </div>

                {/* Template editor */}
                <div className="space-y-3">
                    <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-neutral-400 mb-1">Subject</label>
                        <input
                            type="text"
                            value={templates[activeTemplate].subject}
                            onChange={e => isOwner && updateTemplate(activeTemplate, 'subject', e.target.value)}
                            disabled={!isOwner}
                            className="w-full rounded-lg border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-gray-400 dark:focus:border-neutral-500 focus:ring-0 px-3 py-2 text-sm disabled:bg-gray-50 dark:disabled:bg-neutral-800"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-neutral-400 mb-1">Body</label>
                        <textarea
                            value={templates[activeTemplate].body}
                            onChange={e => isOwner && updateTemplate(activeTemplate, 'body', e.target.value)}
                            disabled={!isOwner}
                            rows={6}
                            className="w-full rounded-lg border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-gray-400 dark:focus:border-neutral-500 focus:ring-0 px-3 py-2 text-sm resize-none font-mono disabled:bg-gray-50 dark:disabled:bg-neutral-800"
                        />
                    </div>
                    {/* Template variable hints */}
                    <div>
                        <p className="text-xs text-gray-400 dark:text-neutral-500 mb-1.5">Available variables:</p>
                        <div className="flex flex-wrap gap-1">
                            {TEMPLATE_VARS.map(v => (
                                <code
                                    key={v}
                                    className="text-xs bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400 px-1.5 py-0.5 rounded font-mono cursor-pointer hover:bg-gray-200 dark:hover:bg-neutral-700"
                                    onClick={() => {
                                        if (!isOwner) return;
                                        const current = templates[activeTemplate].body;
                                        updateTemplate(activeTemplate, 'body', current + v);
                                    }}
                                    title="Click to insert"
                                >
                                    {v}
                                </code>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Save */}
            {isOwner && (
                <div className="flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-studio-blue text-white px-6 py-3 rounded-lg text-sm font-medium disabled:opacity-50"
                    >
                        {saving ? 'Saving…' : 'Save Reminder Settings'}
                    </button>
                </div>
            )}

            {/* Reminder Queue */}
            <div className="bg-white dark:bg-neutral-900 p-5 rounded-lg border border-gray-200 dark:border-neutral-800 space-y-3">
                <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-gray-400 dark:text-neutral-500" />
                    <p className="text-sm font-semibold text-gray-800 dark:text-neutral-200">Recent Queue</p>
                    <span className="text-xs text-gray-400 dark:text-neutral-500">(last 50)</span>
                </div>
                {queue.length === 0 ? (
                    <p className="text-sm text-gray-400 dark:text-neutral-500 italic">No reminder queue entries yet.</p>
                ) : (
                    <div className="divide-y divide-gray-50 dark:divide-neutral-800">
                        {queue.map(entry => (
                            <div key={entry.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                                <div>
                                    <p className="font-medium text-gray-800 dark:text-neutral-200">{entry.type}</p>
                                    <p className="text-gray-400 dark:text-neutral-500 mt-0.5">
                                        {entry.recipientName || 'Walk-in'} ·
                                        {entry.scheduledAt?.toDate ? entry.scheduledAt.toDate().toLocaleDateString() : '—'}
                                    </p>
                                </div>
                                <QueueStatusBadge status={entry.status} />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
