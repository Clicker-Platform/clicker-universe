'use client';

import { useState, useEffect } from 'react';
import { X, Tag } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import { Promo, PromoKind, PromoTrigger, PromoStatus, PromoAudience, PromoSource } from '@/lib/modules/promo/types';
import { createPromo, updatePromo } from '@/lib/modules/promo/api';
import { PROMO_SOURCES, PROMO_SOURCE_KEYS } from '@/lib/modules/promo/sources';
import { useUser } from '@/lib/user-context';

interface PromoFormProps {
    siteId: string;
    promo?: Promo;
    onClose: () => void;
    onSaved: () => void;
}

interface FormState {
    name: string;
    description: string;
    kind: PromoKind;
    value: string;
    maxDiscount: string;
    code: string;
    trigger: PromoTrigger;
    costInPoints: string;
    voucherExpiryDays: string;
    status: PromoStatus;
    maxUses: string;
    perMemberLimit: string;
    minSubtotal: string;
    validFrom: string;
    validUntil: string;
    eligibleSources: PromoSource[];
    audience: PromoAudience;
    specificMemberIds: string;
}

function tsToDateStr(ts?: Timestamp): string {
    if (!ts) return '';
    return ts.toDate().toISOString().slice(0, 10);
}

function dateStrToTs(str: string): Timestamp | undefined {
    if (!str) return undefined;
    return Timestamp.fromDate(new Date(str));
}

function initState(promo?: Promo): FormState {
    if (promo) {
        return {
            name: promo.name,
            description: promo.description ?? '',
            kind: promo.kind,
            value: String(promo.value),
            maxDiscount: promo.maxDiscount != null ? String(promo.maxDiscount) : '',
            code: promo.code ?? '',
            trigger: promo.trigger,
            costInPoints: promo.costInPoints != null ? String(promo.costInPoints) : '',
            voucherExpiryDays: promo.voucherExpiryDays != null ? String(promo.voucherExpiryDays) : '',
            status: promo.status,
            maxUses: promo.maxUses != null ? String(promo.maxUses) : '',
            perMemberLimit: promo.perMemberLimit != null ? String(promo.perMemberLimit) : '',
            minSubtotal: promo.conditions.minSubtotal != null ? String(promo.conditions.minSubtotal) : '',
            validFrom: tsToDateStr(promo.conditions.validFrom),
            validUntil: tsToDateStr(promo.conditions.validUntil),
            eligibleSources: promo.conditions.eligibleSources,
            audience: promo.conditions.audience,
            specificMemberIds: promo.conditions.specificMemberIds?.join(', ') ?? '',
        };
    }
    return {
        name: '',
        description: '',
        kind: 'percent',
        value: '',
        maxDiscount: '',
        code: '',
        trigger: 'code',
        costInPoints: '',
        voucherExpiryDays: '',
        status: 'active',
        maxUses: '',
        perMemberLimit: '',
        minSubtotal: '',
        validFrom: '',
        validUntil: '',
        eligibleSources: [],
        audience: 'public',
        specificMemberIds: '',
    };
}

const inputCls = 'w-full border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-gray-900 dark:text-neutral-200 p-2.5 rounded-lg focus:ring-2 focus:ring-brand-dark/10 focus:border-brand-dark outline-none transition-all text-sm';
const labelCls = 'block text-sm font-bold text-gray-700 dark:text-neutral-300 mb-1';
const hintCls = 'text-xs text-gray-400 dark:text-neutral-500 mt-1';
const sectionTitleCls = 'text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-neutral-500 mb-3 mt-1';

export function PromoForm({ siteId, promo, onClose, onSaved }: PromoFormProps) {
    const { canEdit } = useUser();
    const isEdit = !!promo;
    const [form, setForm] = useState<FormState>(() => initState(promo));
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setForm(initState(promo));
        setError(null);
    }, [promo]);

    const set = <K extends keyof FormState>(key: K, val: FormState[K]) =>
        setForm(prev => ({ ...prev, [key]: val }));

    const toggleSource = (src: PromoSource) => {
        setForm(prev => ({
            ...prev,
            eligibleSources: prev.eligibleSources.includes(src)
                ? prev.eligibleSources.filter(s => s !== src)
                : [...prev.eligibleSources, src],
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canEdit('promo', 'promos')) return;

        setSaving(true);
        setError(null);

        try {
            // Build conditions — only include fields that have actual values
            const conditions: Promo['conditions'] = {
                eligibleSources: form.eligibleSources,
                audience: form.audience,
            };
            if (form.minSubtotal) conditions.minSubtotal = parseFloat(form.minSubtotal);
            const validFrom = dateStrToTs(form.validFrom);
            if (validFrom) conditions.validFrom = validFrom;
            const validUntil = dateStrToTs(form.validUntil);
            if (validUntil) conditions.validUntil = validUntil;
            if (form.audience === 'specific' && form.specificMemberIds.trim()) {
                conditions.specificMemberIds = form.specificMemberIds.split(',').map(s => s.trim()).filter(Boolean);
            }

            // Build top-level payload — only include optional fields when they have values
            const payload: Omit<Promo, 'id' | 'siteId' | 'createdAt' | 'updatedAt' | 'usageCount'> = {
                name: form.name.trim(),
                kind: form.kind,
                value: parseFloat(form.value) || 0,
                trigger: form.trigger,
                status: isEdit ? form.status : 'active',
                conditions,
            };

            if (form.description.trim()) payload.description = form.description.trim();
            if (form.kind === 'percent' && form.maxDiscount) payload.maxDiscount = parseFloat(form.maxDiscount);
            if (form.trigger === 'code' && form.code.trim()) payload.code = form.code.trim();
            if (form.trigger === 'claim' && form.costInPoints) payload.costInPoints = parseInt(form.costInPoints);
            if (form.trigger === 'claim' && form.voucherExpiryDays) payload.voucherExpiryDays = parseInt(form.voucherExpiryDays);
            if (form.maxUses) payload.maxUses = parseInt(form.maxUses);
            if (form.perMemberLimit) payload.perMemberLimit = parseInt(form.perMemberLimit);

            if (isEdit && promo) {
                await updatePromo(siteId, promo.id, payload);
            } else {
                await createPromo(siteId, payload);
            }

            onSaved();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save promo.');
        } finally {
            setSaving(false);
        }
    };

    const canSubmit = canEdit('promo', 'promos');

    return (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-end backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-neutral-900 h-full w-full max-w-lg shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 dark:border-neutral-800 flex justify-between items-center bg-gray-50 dark:bg-neutral-800/50 flex-shrink-0">
                    <div className="flex items-center gap-2">
                        <Tag size={18} className="text-neutral-500 dark:text-neutral-400" />
                        <h3 className="font-bold text-lg text-gray-800 dark:text-neutral-200">
                            {isEdit ? 'Edit Promo' : 'New Promo'}
                        </h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-gray-400 dark:text-neutral-500 hover:bg-gray-200 dark:hover:bg-neutral-700 hover:text-gray-600 dark:hover:text-neutral-300 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
                    <div className="p-6 space-y-5">

                        {/* Basic Info */}
                        <div>
                            <p className={sectionTitleCls}>Basic Info</p>
                            <div className="space-y-4">
                                <div>
                                    <label className={labelCls}>Name <span className="text-red-500">*</span></label>
                                    <input
                                        required
                                        className={inputCls}
                                        placeholder="e.g. Summer Sale 10%"
                                        value={form.name}
                                        onChange={e => set('name', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className={labelCls}>Description</label>
                                    <textarea
                                        rows={2}
                                        className={inputCls + ' resize-none'}
                                        placeholder="Optional description..."
                                        value={form.description}
                                        onChange={e => set('description', e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Discount */}
                        <div>
                            <p className={sectionTitleCls}>Discount</p>
                            <div className="space-y-4">
                                <div>
                                    <label className={labelCls}>Kind</label>
                                    <div className="flex gap-3">
                                        {(['percent', 'fixed'] as PromoKind[]).map(k => (
                                            <label key={k} className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="kind"
                                                    value={k}
                                                    checked={form.kind === k}
                                                    onChange={() => set('kind', k)}
                                                    className="accent-brand-dark"
                                                />
                                                <span className="text-sm font-medium text-gray-700 dark:text-neutral-300">
                                                    {k === 'percent' ? 'Percent (%)' : 'Fixed Amount (Rp)'}
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className={labelCls}>
                                            Value {form.kind === 'percent' ? '(%)' : '(Rp)'}
                                        </label>
                                        <input
                                            required
                                            type="number"
                                            min="0"
                                            className={inputCls}
                                            placeholder={form.kind === 'percent' ? '10' : '50000'}
                                            value={form.value}
                                            onChange={e => set('value', e.target.value)}
                                        />
                                    </div>
                                    {form.kind === 'percent' && (
                                        <div>
                                            <label className={labelCls}>Max Discount (Rp)</label>
                                            <input
                                                type="number"
                                                min="0"
                                                className={inputCls}
                                                placeholder="Optional cap"
                                                value={form.maxDiscount}
                                                onChange={e => set('maxDiscount', e.target.value)}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Trigger */}
                        <div>
                            <p className={sectionTitleCls}>Trigger</p>
                            <div className="space-y-4">
                                <div>
                                    <label className={labelCls}>Trigger</label>
                                    <select
                                        className={inputCls}
                                        value={form.trigger}
                                        onChange={e => set('trigger', e.target.value as PromoTrigger)}
                                    >
                                        <option value="code">Code</option>
                                        <option value="auto">Auto-apply</option>
                                        <option value="claim">Claim (points)</option>
                                    </select>
                                </div>
                                {form.trigger === 'code' && (
                                    <div>
                                        <label className={labelCls}>Code</label>
                                        <input
                                            className={inputCls + ' uppercase'}
                                            placeholder="e.g. SUMMER10"
                                            value={form.code}
                                            onChange={e => set('code', e.target.value.toUpperCase())}
                                        />
                                        <p className={hintCls}>Leave blank to auto-generate on save.</p>
                                    </div>
                                )}
                                {form.trigger === 'claim' && (
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className={labelCls}>Cost in Points</label>
                                            <input
                                                type="number"
                                                min="0"
                                                className={inputCls}
                                                placeholder="e.g. 500"
                                                value={form.costInPoints}
                                                onChange={e => set('costInPoints', e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className={labelCls}>Voucher Expiry (days)</label>
                                            <input
                                                type="number"
                                                min="1"
                                                className={inputCls}
                                                placeholder="e.g. 30"
                                                value={form.voucherExpiryDays}
                                                onChange={e => set('voucherExpiryDays', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Usage Limits */}
                        <div>
                            <p className={sectionTitleCls}>Usage Limits</p>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={labelCls}>Max Uses</label>
                                    <input
                                        type="number"
                                        min="1"
                                        className={inputCls}
                                        placeholder="Unlimited"
                                        value={form.maxUses}
                                        onChange={e => set('maxUses', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className={labelCls}>Per Member Limit</label>
                                    <input
                                        type="number"
                                        min="1"
                                        className={inputCls}
                                        placeholder="Unlimited"
                                        value={form.perMemberLimit}
                                        onChange={e => set('perMemberLimit', e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Status (edit only) */}
                        {isEdit && (
                            <div>
                                <p className={sectionTitleCls}>Status</p>
                                <select
                                    className={inputCls}
                                    value={form.status}
                                    onChange={e => set('status', e.target.value as PromoStatus)}
                                >
                                    <option value="active">Active</option>
                                    <option value="paused">Paused</option>
                                    <option value="archived">Archived</option>
                                </select>
                            </div>
                        )}

                        {/* Conditions */}
                        <div>
                            <p className={sectionTitleCls}>Conditions</p>
                            <div className="space-y-4">
                                <div>
                                    <label className={labelCls}>Min Subtotal (Rp)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        className={inputCls}
                                        placeholder="No minimum"
                                        value={form.minSubtotal}
                                        onChange={e => set('minSubtotal', e.target.value)}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className={labelCls}>Valid From</label>
                                        <input
                                            type="date"
                                            className={inputCls}
                                            value={form.validFrom}
                                            onChange={e => set('validFrom', e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Valid Until</label>
                                        <input
                                            type="date"
                                            className={inputCls}
                                            value={form.validUntil}
                                            onChange={e => set('validUntil', e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className={labelCls}>Eligible Sources</label>
                                    <p className={hintCls + ' mb-2'}>Leave all unchecked to allow all sources.</p>
                                    <div className="flex flex-wrap gap-3">
                                        {PROMO_SOURCE_KEYS.map(src => (
                                            <label key={src} className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={form.eligibleSources.includes(src)}
                                                    onChange={() => toggleSource(src)}
                                                    className="accent-brand-dark rounded"
                                                />
                                                <span className="text-sm font-medium text-gray-700 dark:text-neutral-300">
                                                    {PROMO_SOURCES[src].label}
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className={labelCls}>Audience</label>
                                    <div className="flex flex-wrap gap-4">
                                        {([
                                            ['public', 'Public'],
                                            ['members', 'Members only'],
                                            ['specific', 'Specific members'],
                                        ] as [PromoAudience, string][]).map(([val, lbl]) => (
                                            <label key={val} className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="audience"
                                                    value={val}
                                                    checked={form.audience === val}
                                                    onChange={() => set('audience', val)}
                                                    className="accent-brand-dark"
                                                />
                                                <span className="text-sm font-medium text-gray-700 dark:text-neutral-300">{lbl}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                {form.audience === 'specific' && (
                                    <div>
                                        <label className={labelCls}>Specific Member IDs</label>
                                        <textarea
                                            rows={3}
                                            className={inputCls + ' resize-none'}
                                            placeholder="Comma-separated member IDs..."
                                            value={form.specificMemberIds}
                                            onChange={e => set('specificMemberIds', e.target.value)}
                                        />
                                        <p className={hintCls}>Separate multiple IDs with commas.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Error */}
                        {error && (
                            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-600 dark:text-red-400 font-medium">
                                {error}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="sticky bottom-0 px-6 py-4 border-t border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 rounded-lg font-bold text-gray-500 dark:text-neutral-400 border border-gray-200 dark:border-neutral-700 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving || !canSubmit}
                            className="flex-1 px-4 py-2.5 rounded-lg font-bold bg-studio-blue text-white hover:bg-studio-blue/90 transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {saving ? (
                                <>
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Saving...
                                </>
                            ) : (isEdit ? 'Save Changes' : 'Create Promo')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
