'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { approveRecord, updateServiceRecord } from '../../api';
import type { ServiceRecord, PaymentMethod, ConsumedItem } from '../../types';
import { PromoApplicator } from '@/lib/modules/promo/components/PromoApplicator';
import { commitPromoUsage } from '@/lib/modules/promo/api';
import type { AppliedPromo } from '@/lib/modules/promo/api';

interface BillLineItem {
    _id: string;
    label: string;
    amount: number;    // positive = charge, negative = discount
}

interface Props {
    siteId: string;
    record: ServiceRecord;
    approvedByEmail: string;
    onCompleted: () => void;
    onCancel: () => void;
}

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
    { value: 'CASH',     label: 'Cash' },
    { value: 'TRANSFER', label: 'Bank Transfer' },
    { value: 'CARD',     label: 'Debit/Credit Card' },
    { value: 'QRIS',     label: 'QRIS' },
];

function uid() {
    return Math.random().toString(36).slice(2);
}

export default function BillModal({ siteId, record, approvedByEmail, onCompleted, onCancel }: Props) {
    // Line items — seeded with service default price
    const [lineItems, setLineItems] = useState<BillLineItem[]>(() => {
        const defaultPrice = record.totalAmount || 0;
        return [
            { _id: uid(), label: record.serviceTypeName, amount: defaultPrice },
        ];
    });

    // Payment
    const [amountPaid, setAmountPaid] = useState(0);
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>('');

    // Warranty
    const [warrantyMonths, setWarrantyMonths] = useState(record.warrantyMonths || 12);

    // Notes & product
    const [notes, setNotes] = useState(record.notes || '');
    const [productUsed, setProductUsed] = useState(record.productUsed || '');

    // Inventory items (if module enabled)
    const [inventoryEnabled, setInventoryEnabled] = useState(false);
    const [inventoryItems, setInventoryItems] = useState<{ id: string; name: string; currentStock: number; unit: string }[]>([]);
    const [consumedItems, setConsumedItems] = useState<(ConsumedItem & { _tempId: string })[]>(
        record.consumedItems?.map(ci => ({ ...ci, _tempId: uid() })) || []
    );

    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Promo
    const [appliedPromo, setAppliedPromo] = useState<AppliedPromo | null>(null);

    // Derived
    const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
    const promoDiscount = appliedPromo?.discount ?? 0;
    const total = Math.max(0, subtotal - promoDiscount);
    const balance = total - amountPaid;

    useEffect(() => {
        // Auto-fill amountPaid = total on initial mount only
        setAmountPaid(total);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        async function loadInventory() {
            try {
                const { isModuleEnabled } = await import('@/lib/modules/registry');
                if (await isModuleEnabled('inventory')) {
                    setInventoryEnabled(true);
                    const { getInventory } = await import('@/lib/modules/inventory/api');
                    const items = await getInventory(siteId);
                    setInventoryItems(items.map((i: { id: string; name: string; currentStock: number; unit?: string }) => ({
                        id: i.id,
                        name: i.name,
                        currentStock: i.currentStock,
                        unit: i.unit || '',
                    })));
                }
            } catch { /* ignore */ }
        }
        loadInventory();
    }, [siteId]);

    function addLineItem() {
        setLineItems(prev => [...prev, { _id: uid(), label: '', amount: 0 }]);
    }

    function removeLineItem(id: string) {
        setLineItems(prev => prev.filter(item => item._id !== id));
    }

    function updateLineItem(id: string, field: 'label' | 'amount', value: string | number) {
        setLineItems(prev => prev.map(item =>
            item._id === id ? { ...item, [field]: value } : item
        ));
    }

    async function handleComplete() {
        if (total <= 0) { setError('Total amount must be greater than 0'); return; }
        if (amountPaid <= 0) { setError('Amount paid must be greater than 0'); return; }
        if (!paymentMethod) { setError('Please select a payment method'); return; }

        setError(null);
        setSubmitting(true);

        try {
            // Step 1 — Update record with final bill details before completing
            await updateServiceRecord(siteId, record.id, {
                totalAmount: total,
                amountPaid,
                paymentStatus: amountPaid >= total ? 'PAID' : 'PARTIAL',
                paymentMethod,
                warrantyMonths: record.hasWarranty ? warrantyMonths : record.warrantyMonths,
                notes: notes || undefined,
                productUsed: productUsed || undefined,
                consumedItems: consumedItems.length > 0
                    ? consumedItems.map(({ _tempId: _t, ...ci }) => ci)
                    : undefined,
                ...(appliedPromo ? { appliedPromo } : {}),
            } as Parameters<typeof updateServiceRecord>[2]);

            // Step 2 — Atomically complete: warranty card + reminders + points
            await approveRecord(siteId, record.id, approvedByEmail);

            // Step 3 — Commit promo usage if a promo was applied
            if (appliedPromo) {
                await commitPromoUsage({
                    siteId,
                    applied: appliedPromo,
                    source: 'SERVICE',
                    refId: record.id,
                    memberId: record.memberId,
                });
            }

            onCompleted();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to complete service');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white dark:bg-neutral-900 rounded-t-2xl sm:rounded-lg w-full sm:max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 bg-white dark:bg-neutral-900 border-b border-gray-100 dark:border-neutral-800 px-6 py-4 rounded-t-2xl sm:rounded-t-2xl">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-neutral-100">Finalize Service</h2>
                    <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5">
                        {record.vehiclePlate} · {record.serviceTypeName}
                    </p>
                </div>

                <div className="px-6 py-5 space-y-6">
                    {/* Bill Line Items */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-semibold text-gray-500 dark:text-neutral-400 uppercase tracking-wider">Bill</p>
                            <button
                                type="button"
                                onClick={addLineItem}
                                className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
                            >
                                <Plus className="w-3.5 h-3.5" /> Add line
                            </button>
                        </div>
                        <div className="space-y-2">
                            {lineItems.map(item => (
                                <div key={item._id} className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={item.label}
                                        onChange={e => updateLineItem(item._id, 'label', e.target.value)}
                                        placeholder="Description…"
                                        className="flex-1 rounded-lg border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-gray-400 dark:focus:border-neutral-600 focus:ring-0 px-3 py-2 text-sm"
                                    />
                                    <input
                                        type="number"
                                        value={item.amount || ''}
                                        onChange={e => updateLineItem(item._id, 'amount', parseFloat(e.target.value) || 0)}
                                        placeholder="0"
                                        className="w-32 rounded-lg border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-gray-400 dark:focus:border-neutral-600 focus:ring-0 px-3 py-2 text-sm text-right"
                                    />
                                    {lineItems.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => removeLineItem(item._id)}
                                            className="p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                        <div className="mt-3 flex justify-between items-center border-t border-gray-100 dark:border-neutral-800 pt-3">
                            <p className="text-sm font-semibold text-gray-700 dark:text-neutral-300">Subtotal</p>
                            <p className="text-lg font-bold text-gray-900 dark:text-neutral-100">
                                Rp {subtotal.toLocaleString('id-ID')}
                            </p>
                        </div>
                    </div>

                    {/* Promo */}
                    <PromoApplicator
                        siteId={siteId}
                        subtotal={subtotal}
                        source="SERVICE"
                        memberId={record.memberId}
                        applied={appliedPromo}
                        onApply={setAppliedPromo}
                        onRemove={() => setAppliedPromo(null)}
                        disabled={submitting}
                    />

                    {/* Grand Total (after promo) */}
                    {promoDiscount > 0 && (
                        <div className="flex justify-between items-center text-sm font-semibold text-gray-900 dark:text-neutral-100">
                            <span>Total</span>
                            <span className="text-lg font-bold">Rp {total.toLocaleString('id-ID')}</span>
                        </div>
                    )}

                    {/* Inventory items (if enabled) */}
                    {inventoryEnabled && inventoryItems.length > 0 && (
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-semibold text-gray-500 dark:text-neutral-400 uppercase tracking-wider">Inventory Used</p>
                                <button
                                    type="button"
                                    onClick={() => setConsumedItems(prev => [...prev, { inventoryItemId: '', name: '', quantity: 1, _tempId: uid() }])}
                                    className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
                                >
                                    <Plus className="w-3.5 h-3.5" /> Add item
                                </button>
                            </div>
                            <div className="space-y-2">
                                {consumedItems.map(ci => (
                                    <div key={ci._tempId} className="flex items-center gap-2">
                                        <select
                                            value={ci.inventoryItemId}
                                            onChange={e => {
                                                const id = e.target.value;
                                                const found = inventoryItems.find(i => i.id === id);
                                                setConsumedItems(prev => prev.map(item =>
                                                    item._tempId === ci._tempId
                                                        ? { ...item, inventoryItemId: id, name: found?.name || '' }
                                                        : item
                                                ));
                                            }}
                                            className="flex-1 rounded-lg border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-gray-400 dark:focus:border-neutral-600 focus:ring-0 px-3 py-2 text-sm"
                                        >
                                            <option value="">— Select item —</option>
                                            {inventoryItems.map(item => (
                                                <option key={item.id} value={item.id}>
                                                    {item.name} (Stock: {item.currentStock} {item.unit})
                                                </option>
                                            ))}
                                        </select>
                                        <input
                                            type="number"
                                            min={1}
                                            value={ci.quantity}
                                            onChange={e => setConsumedItems(prev => prev.map(item =>
                                                item._tempId === ci._tempId
                                                    ? { ...item, quantity: Math.max(1, parseInt(e.target.value) || 1) }
                                                    : item
                                            ))}
                                            className="w-16 rounded-lg border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-gray-400 dark:focus:border-neutral-600 focus:ring-0 px-3 py-2 text-sm text-center"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setConsumedItems(prev => prev.filter(item => item._tempId !== ci._tempId))}
                                            className="p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Product used (free text) */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 dark:text-neutral-400 uppercase tracking-wider mb-2">
                            Product Used <span className="normal-case font-normal text-gray-400">(optional)</span>
                        </label>
                        <input
                            type="text"
                            value={productUsed}
                            onChange={e => setProductUsed(e.target.value)}
                            placeholder="e.g. Ceramic Pro Gold 9H"
                            className="w-full rounded-lg border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-gray-400 dark:focus:border-neutral-600 focus:ring-0 px-3 py-2 text-sm"
                        />
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 dark:text-neutral-400 uppercase tracking-wider mb-2">
                            Notes <span className="normal-case font-normal text-gray-400">(optional)</span>
                        </label>
                        <textarea
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            rows={2}
                            placeholder="Internal notes…"
                            className="w-full rounded-lg border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-gray-400 dark:focus:border-neutral-600 focus:ring-0 px-3 py-2 text-sm resize-none"
                        />
                    </div>

                    {/* Warranty duration (if applicable) */}
                    {record.hasWarranty && (
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 dark:text-neutral-400 uppercase tracking-wider mb-2">
                                Warranty Duration
                            </label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    min={1}
                                    max={120}
                                    value={warrantyMonths}
                                    onChange={e => setWarrantyMonths(parseInt(e.target.value) || 12)}
                                    className="w-24 rounded-lg border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-gray-400 dark:focus:border-neutral-600 focus:ring-0 px-3 py-2 text-sm"
                                />
                                <span className="text-sm text-gray-500 dark:text-neutral-400">months</span>
                            </div>
                        </div>
                    )}

                    {/* Payment */}
                    <div className="space-y-3">
                        <p className="text-xs font-semibold text-gray-500 dark:text-neutral-400 uppercase tracking-wider">Payment</p>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-medium text-gray-600 dark:text-neutral-400 mb-1">Amount Paid (Rp)</label>
                                <input
                                    type="number"
                                    min={0}
                                    value={amountPaid || ''}
                                    onChange={e => setAmountPaid(parseFloat(e.target.value) || 0)}
                                    className="w-full rounded-lg border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-gray-400 dark:focus:border-neutral-600 focus:ring-0 px-3 py-2 text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 dark:text-neutral-400 mb-1">Method</label>
                                <select
                                    value={paymentMethod}
                                    onChange={e => setPaymentMethod(e.target.value as PaymentMethod | '')}
                                    className="w-full rounded-lg border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-gray-400 dark:focus:border-neutral-600 focus:ring-0 px-3 py-2 text-sm"
                                >
                                    <option value="">Select…</option>
                                    {PAYMENT_METHODS.map(m => (
                                        <option key={m.value} value={m.value}>{m.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        {/* Balance summary */}
                        <div className={`rounded-lg px-4 py-3 text-sm flex justify-between items-center ${
                            balance <= 0
                                ? 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400'
                                : 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400'
                        }`}>
                            <span>{balance <= 0 ? 'Fully paid' : 'Balance remaining'}</span>
                            <span className="font-bold">
                                {balance <= 0 ? '✓' : `Rp ${balance.toLocaleString('id-ID')}`}
                            </span>
                        </div>
                    </div>

                    {/* Consequence notice */}
                    <div className="bg-gray-50 dark:bg-neutral-800 rounded-lg px-4 py-3 text-xs text-gray-500 dark:text-neutral-400 space-y-1">
                        <p className="font-semibold text-gray-700 dark:text-neutral-300">On completion:</p>
                        <p>✓ Service record will be marked COMPLETED</p>
                        {record.hasWarranty && <p>✓ Warranty card will be generated and sent</p>}
                        <p>✓ This action cannot be undone</p>
                    </div>

                    {error && (
                        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded-lg px-4 py-3">
                            {error}
                        </p>
                    )}
                </div>

                {/* Footer */}
                <div className="sticky bottom-0 bg-white dark:bg-neutral-900 border-t border-gray-100 dark:border-neutral-800 px-6 py-4 flex gap-3">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={submitting}
                        className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-neutral-700 text-sm font-medium text-gray-700 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-800 disabled:opacity-50"
                    >
                        Back
                    </button>
                    <button
                        type="button"
                        onClick={handleComplete}
                        disabled={submitting}
                        className="flex-1 px-4 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {submitting ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Completing…
                            </>
                        ) : 'Complete Service'}
                    </button>
                </div>
            </div>
        </div>
    );
}
