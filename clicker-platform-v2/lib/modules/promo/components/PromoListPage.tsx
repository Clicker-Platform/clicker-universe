'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Tag, Pencil, Trash2, Archive, Play, Pause } from 'lucide-react';
import { useSite } from '@/lib/site-context';
import { useUser } from '@/lib/user-context';
import { logger } from '@/lib/logger-edge';
import { listPromos, setPromoStatus, deletePromo } from '@/lib/modules/promo/api';
import { PromoForm } from './PromoForm';
import type { Promo, PromoStatus } from '@/lib/modules/promo/api';

type TabStatus = 'all' | PromoStatus;

const TABS: { key: TabStatus; label: string }[] = [
    { key: 'all',      label: 'All' },
    { key: 'active',   label: 'Active' },
    { key: 'paused',   label: 'Paused' },
    { key: 'archived', label: 'Archived' },
];

function formatValue(promo: Promo): string {
    if (promo.kind === 'percent') return `${promo.value}%`;
    return `Rp ${promo.value.toLocaleString('id-ID')}`;
}

function StatusBadge({ status }: { status: PromoStatus }) {
    const cls: Record<PromoStatus, string> = {
        active:   'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
        paused:   'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
        archived: 'bg-gray-100 dark:bg-neutral-700 text-gray-500 dark:text-neutral-400',
    };
    const label: Record<PromoStatus, string> = {
        active: 'Active', paused: 'Paused', archived: 'Archived',
    };
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${cls[status]}`}>
            {label[status]}
        </span>
    );
}

function TriggerBadge({ trigger }: { trigger: Promo['trigger'] }) {
    const cls: Record<Promo['trigger'], string> = {
        code:  'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
        auto:  'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
        claim: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
    };
    const label: Record<Promo['trigger'], string> = {
        code: 'Code', auto: 'Auto', claim: 'Claim',
    };
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${cls[trigger]}`}>
            {label[trigger]}
        </span>
    );
}

function UsageText({ promo }: { promo: Promo }) {
    const count = promo.usageCount ?? 0;
    if (promo.maxUses) {
        return <span>{count} / {promo.maxUses} uses</span>;
    }
    return <span>{count} uses</span>;
}

export default function PromoListPage() {
    const { siteId } = useSite();
    const { canEdit } = useUser();
    const [promos, setPromos] = useState<Promo[]>([]);
    const [activeTab, setActiveTab] = useState<TabStatus>('all');
    const [loading, setLoading] = useState(true);
    const [formOpen, setFormOpen] = useState(false);
    const [editingPromo, setEditingPromo] = useState<Promo | undefined>(undefined);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const load = useCallback(async () => {
        if (!siteId) return;
        setLoading(true);
        try {
            const data = await listPromos(siteId);
            setPromos(data);
        } catch (err) {
            logger.error('promo.list.load.failed', { siteId, error: err });
        } finally {
            setLoading(false);
        }
    }, [siteId]);

    useEffect(() => {
        load();
    }, [load]);

    const filtered = activeTab === 'all'
        ? promos
        : promos.filter(p => p.status === activeTab);

    function openCreate() {
        setEditingPromo(undefined);
        setFormOpen(true);
    }

    function openEdit(promo: Promo) {
        setEditingPromo(promo);
        setFormOpen(true);
    }

    function closeForm() {
        setFormOpen(false);
        setEditingPromo(undefined);
    }

    async function handleStatusToggle(promo: Promo) {
        if (!canEdit('promo', 'promos') || !siteId) return;
        const newStatus: PromoStatus = promo.status === 'active' ? 'paused' : 'active';
        setActionLoading(promo.id + '_status');
        try {
            await setPromoStatus(siteId, promo.id, newStatus);
            setPromos(prev => prev.map(p => p.id === promo.id ? { ...p, status: newStatus } : p));
        } catch (err) {
            logger.error('promo.status.toggle.failed', { siteId, promoId: promo.id, error: err });
        } finally {
            setActionLoading(null);
        }
    }

    async function handleArchive(promo: Promo) {
        if (!canEdit('promo', 'promos') || !siteId) return;
        if (!window.confirm(`Archive "${promo.name}"? It will no longer apply to new orders.`)) return;
        setActionLoading(promo.id + '_archive');
        try {
            await setPromoStatus(siteId, promo.id, 'archived');
            setPromos(prev => prev.map(p => p.id === promo.id ? { ...p, status: 'archived' } : p));
        } catch (err) {
            logger.error('promo.archive.failed', { siteId, promoId: promo.id, error: err });
        } finally {
            setActionLoading(null);
        }
    }

    async function handleDelete(promo: Promo) {
        if (!canEdit('promo', 'promos') || !siteId) return;
        if (!window.confirm(`Delete "${promo.name}"? This cannot be undone.`)) return;
        setActionLoading(promo.id + '_delete');
        try {
            await deletePromo(siteId, promo.id);
            setPromos(prev => prev.filter(p => p.id !== promo.id));
        } catch (err) {
            logger.error('promo.delete.failed', { siteId, promoId: promo.id, error: err });
        } finally {
            setActionLoading(null);
        }
    }

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-neutral-100">Promotions</h1>
                <button
                    onClick={openCreate}
                    className="flex items-center gap-1.5 bg-studio-blue text-white px-3 py-2 rounded-lg text-sm font-semibold transition-colors hover:bg-studio-blue/90 active:scale-95"
                >
                    <Plus className="w-4 h-4" />
                    New Promo
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 dark:bg-neutral-800 p-1 rounded-lg overflow-x-auto">
                {TABS.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                            activeTab === tab.key
                                ? 'bg-white dark:bg-neutral-700 shadow text-gray-900 dark:text-neutral-100'
                                : 'text-gray-600 dark:text-neutral-400 hover:bg-white/60 dark:hover:bg-neutral-700/60'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* List */}
            <div className="bg-white dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800 overflow-hidden">
                {loading ? (
                    <div className="p-8 space-y-3">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="h-10 bg-gray-100 dark:bg-neutral-800 rounded-lg animate-pulse" />
                        ))}
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="p-12 text-center">
                        <Tag className="w-10 h-10 text-gray-300 dark:text-neutral-600 mx-auto mb-3" />
                        <p className="text-sm font-medium text-gray-500 dark:text-neutral-400">
                            {activeTab === 'all' ? 'No promotions yet.' : `No ${activeTab} promotions.`}
                        </p>
                        {activeTab === 'all' && (
                            <button
                                onClick={openCreate}
                                className="mt-4 text-sm text-brand-dark dark:text-brand-green font-medium hover:underline"
                            >
                                + Create your first promo
                            </button>
                        )}
                    </div>
                ) : (
                    <>
                        {/* Desktop table */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 dark:bg-neutral-800 border-b border-gray-100 dark:border-neutral-700">
                                    <tr>
                                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wide">Name</th>
                                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wide">Trigger</th>
                                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wide">Value</th>
                                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wide">Usage</th>
                                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wide">Status</th>
                                        <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wide">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50 dark:divide-neutral-800">
                                    {filtered.map(promo => (
                                        <tr key={promo.id} className="hover:bg-gray-50 dark:hover:bg-neutral-800/60 transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-semibold text-gray-900 dark:text-neutral-100">{promo.name}</span>
                                                    {promo.trigger === 'code' && promo.code && (
                                                        <span className="font-mono text-xs bg-gray-100 dark:bg-neutral-700 text-gray-600 dark:text-neutral-300 px-1.5 py-0.5 rounded">
                                                            {promo.code}
                                                        </span>
                                                    )}
                                                </div>
                                                {promo.description && (
                                                    <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5 truncate max-w-xs">{promo.description}</p>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <TriggerBadge trigger={promo.trigger} />
                                            </td>
                                            <td className="px-4 py-3 font-medium text-gray-700 dark:text-neutral-300">
                                                {formatValue(promo)}
                                                {promo.kind === 'percent' && promo.maxDiscount && (
                                                    <span className="text-xs text-gray-400 dark:text-neutral-500 ml-1">
                                                        (max Rp {promo.maxDiscount.toLocaleString('id-ID')})
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-gray-500 dark:text-neutral-400 text-xs">
                                                <UsageText promo={promo} />
                                            </td>
                                            <td className="px-4 py-3">
                                                <StatusBadge status={promo.status} />
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-end gap-1">
                                                    {/* Edit */}
                                                    <button
                                                        onClick={() => openEdit(promo)}
                                                        title="Edit"
                                                        className="p-1.5 rounded-lg text-gray-400 dark:text-neutral-500 hover:bg-gray-100 dark:hover:bg-neutral-700 hover:text-gray-600 dark:hover:text-neutral-300 transition-colors"
                                                    >
                                                        <Pencil className="w-4 h-4" />
                                                    </button>

                                                    {/* Pause/Activate toggle (only for active/paused) */}
                                                    {promo.status !== 'archived' && (
                                                        <button
                                                            onClick={() => handleStatusToggle(promo)}
                                                            disabled={actionLoading === promo.id + '_status'}
                                                            title={promo.status === 'active' ? 'Pause' : 'Activate'}
                                                            className="p-1.5 rounded-lg text-gray-400 dark:text-neutral-500 hover:bg-gray-100 dark:hover:bg-neutral-700 hover:text-gray-600 dark:hover:text-neutral-300 transition-colors disabled:opacity-40"
                                                        >
                                                            {promo.status === 'active'
                                                                ? <Pause className="w-4 h-4" />
                                                                : <Play className="w-4 h-4" />
                                                            }
                                                        </button>
                                                    )}

                                                    {/* Archive (only for active/paused) */}
                                                    {promo.status !== 'archived' && (
                                                        <button
                                                            onClick={() => handleArchive(promo)}
                                                            disabled={actionLoading === promo.id + '_archive'}
                                                            title="Archive"
                                                            className="p-1.5 rounded-lg text-gray-400 dark:text-neutral-500 hover:bg-amber-100 dark:hover:bg-amber-900/30 hover:text-amber-600 dark:hover:text-amber-400 transition-colors disabled:opacity-40"
                                                        >
                                                            <Archive className="w-4 h-4" />
                                                        </button>
                                                    )}

                                                    {/* Delete (for archived only) */}
                                                    {promo.status === 'archived' && (
                                                        <button
                                                            onClick={() => handleDelete(promo)}
                                                            disabled={actionLoading === promo.id + '_delete'}
                                                            title="Delete"
                                                            className="p-1.5 rounded-lg text-gray-400 dark:text-neutral-500 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 transition-colors disabled:opacity-40"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile cards */}
                        <div className="md:hidden divide-y divide-gray-50 dark:divide-neutral-800">
                            {filtered.map(promo => (
                                <div key={promo.id} className="p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-semibold text-gray-900 dark:text-neutral-100">{promo.name}</span>
                                                {promo.trigger === 'code' && promo.code && (
                                                    <span className="font-mono text-xs bg-gray-100 dark:bg-neutral-700 text-gray-600 dark:text-neutral-300 px-1.5 py-0.5 rounded">
                                                        {promo.code}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                                <TriggerBadge trigger={promo.trigger} />
                                                <StatusBadge status={promo.status} />
                                            </div>
                                            <p className="text-sm text-gray-600 dark:text-neutral-400 mt-1">
                                                {formatValue(promo)} · <UsageText promo={promo} />
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-1 flex-shrink-0">
                                            <button
                                                onClick={() => openEdit(promo)}
                                                title="Edit"
                                                className="p-1.5 rounded-lg text-gray-400 dark:text-neutral-500 hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors"
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </button>
                                            {promo.status !== 'archived' && (
                                                <button
                                                    onClick={() => handleStatusToggle(promo)}
                                                    disabled={actionLoading === promo.id + '_status'}
                                                    title={promo.status === 'active' ? 'Pause' : 'Activate'}
                                                    className="p-1.5 rounded-lg text-gray-400 dark:text-neutral-500 hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors disabled:opacity-40"
                                                >
                                                    {promo.status === 'active'
                                                        ? <Pause className="w-4 h-4" />
                                                        : <Play className="w-4 h-4" />
                                                    }
                                                </button>
                                            )}
                                            {promo.status !== 'archived' && (
                                                <button
                                                    onClick={() => handleArchive(promo)}
                                                    disabled={actionLoading === promo.id + '_archive'}
                                                    title="Archive"
                                                    className="p-1.5 rounded-lg text-gray-400 dark:text-neutral-500 hover:bg-amber-100 dark:hover:bg-amber-900/30 hover:text-amber-600 dark:hover:text-amber-400 transition-colors disabled:opacity-40"
                                                >
                                                    <Archive className="w-4 h-4" />
                                                </button>
                                            )}
                                            {promo.status === 'archived' && (
                                                <button
                                                    onClick={() => handleDelete(promo)}
                                                    disabled={actionLoading === promo.id + '_delete'}
                                                    title="Delete"
                                                    className="p-1.5 rounded-lg text-gray-400 dark:text-neutral-500 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 transition-colors disabled:opacity-40"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* PromoForm slide-over */}
            {formOpen && siteId && (
                <PromoForm
                    siteId={siteId}
                    promo={editingPromo}
                    onClose={closeForm}
                    onSaved={() => { load(); }}
                />
            )}
        </div>
    );
}
