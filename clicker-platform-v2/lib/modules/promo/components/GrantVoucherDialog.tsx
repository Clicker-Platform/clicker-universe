'use client';

import { useEffect, useState } from 'react';
import { X, Ticket, Loader2 } from 'lucide-react';
import { logger } from '@/lib/logger-edge';
import { listPromos, grantVoucher } from '@/lib/modules/promo/api';
import type { Promo } from '@/lib/modules/promo/api';

export interface GrantVoucherDialogProps {
    siteId: string;
    onClose: () => void;
    onGranted: () => void;
}

function formatPromoOption(promo: Promo): string {
    const value = promo.kind === 'percent'
        ? `${promo.value}%`
        : `Rp ${promo.value.toLocaleString('id-ID')}`;
    return `${promo.name} — ${value}`;
}

export function GrantVoucherDialog({ siteId, onClose, onGranted }: GrantVoucherDialogProps) {
    const [promos, setPromos] = useState<Promo[]>([]);
    const [loadingPromos, setLoadingPromos] = useState(true);

    const [promoId, setPromoId] = useState('');
    const [memberId, setMemberId] = useState('');
    const [memberName, setMemberName] = useState('');

    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchPromos() {
            try {
                const all = await listPromos(siteId);
                const data = all.filter(p => p.status === 'active');
                setPromos(data);
                if (data.length > 0) setPromoId(data[0].id);
            } catch (err) {
                logger.error('promo.grant-dialog.load-promos.failed', { siteId, error: err });
            } finally {
                setLoadingPromos(false);
            }
        }
        fetchPromos();
    }, [siteId]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!promoId || !memberId.trim()) return;

        setSubmitting(true);
        setError(null);
        try {
            await grantVoucher({
                siteId,
                promoId,
                memberId: memberId.trim(),
                memberName: memberName.trim() || undefined,
            });
            onGranted();
            onClose();
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Failed to grant voucher';
            setError(msg);
            logger.error('promo.grant-dialog.grant.failed', { siteId, promoId, memberId, error: err });
        } finally {
            setSubmitting(false);
        }
    }

    return (
        /* Backdrop */
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-xl w-full max-w-md border border-gray-200 dark:border-neutral-700">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-neutral-800">
                    <div className="flex items-center gap-2">
                        <Ticket className="w-5 h-5 text-studio-blue" />
                        <h2 className="text-base font-semibold text-gray-900 dark:text-neutral-100">Grant Voucher</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-gray-400 dark:text-neutral-500 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    {/* Promo select */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1.5">
                            Promo <span className="text-red-500">*</span>
                        </label>
                        {loadingPromos ? (
                            <div className="h-10 bg-gray-100 dark:bg-neutral-800 rounded-lg animate-pulse" />
                        ) : promos.length === 0 ? (
                            <p className="text-sm text-gray-400 dark:text-neutral-500 italic">
                                No active promos available.
                            </p>
                        ) : (
                            <select
                                value={promoId}
                                onChange={e => setPromoId(e.target.value)}
                                required
                                className="w-full rounded-lg border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-gray-900 dark:text-neutral-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-studio-blue/50"
                            >
                                {promos.map(p => (
                                    <option key={p.id} value={p.id}>
                                        {formatPromoOption(p)}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>

                    {/* Member ID */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1.5">
                            Member ID <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={memberId}
                            onChange={e => setMemberId(e.target.value)}
                            required
                            placeholder="e.g. member_abc123"
                            className="w-full rounded-lg border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-gray-900 dark:text-neutral-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-studio-blue/50 placeholder:text-gray-400 dark:placeholder:text-neutral-500"
                        />
                    </div>

                    {/* Member name (optional) */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1.5">
                            Member Name <span className="text-xs text-gray-400 dark:text-neutral-500 font-normal">(optional)</span>
                        </label>
                        <input
                            type="text"
                            value={memberName}
                            onChange={e => setMemberName(e.target.value)}
                            placeholder="e.g. John Doe"
                            className="w-full rounded-lg border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-gray-900 dark:text-neutral-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-studio-blue/50 placeholder:text-gray-400 dark:placeholder:text-neutral-500"
                        />
                        <p className="mt-1 text-xs text-gray-400 dark:text-neutral-500">
                            Stored for display purposes only.
                        </p>
                    </div>

                    {/* Error */}
                    {error && (
                        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
                            {error}
                        </p>
                    )}

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={submitting}
                            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors disabled:opacity-40"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting || loadingPromos || promos.length === 0 || !memberId.trim()}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-studio-blue text-white hover:bg-studio-blue/90 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            Grant Voucher
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
