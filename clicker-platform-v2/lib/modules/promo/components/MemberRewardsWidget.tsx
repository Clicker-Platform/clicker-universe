'use client';

import React, { useEffect, useState } from 'react';
import { Gift, Loader2 } from 'lucide-react';
import { useSite } from '@/lib/site-context';
import { logger } from '@/lib/logger-edge';
import { listClaimablePromos } from '../api/promos';
import { claimVoucher } from '../api/claim';
import type { Promo } from '../types';

interface MemberRewardsWidgetProps {
    memberId?: string;
    memberPhone?: string;
    memberPoints?: number; // optional — passed by dashboard if available
}

function formatPromoValue(promo: Promo): string {
    if (promo.kind === 'percent') return `${promo.value}% off`;
    return `Rp ${promo.value.toLocaleString('id-ID')} off`;
}

export default function MemberRewardsWidget({ memberId, memberPoints }: MemberRewardsWidgetProps) {
    const { siteId } = useSite();
    const [promos, setPromos] = useState<Promo[]>([]);
    const [loading, setLoading] = useState(true);
    const [claimingId, setClaimingId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Record<string, { type: 'success' | 'error'; text: string }>>({});

    useEffect(() => {
        async function load() {
            if (!siteId || !memberId) {
                setLoading(false);
                return;
            }
            try {
                const data = await listClaimablePromos(siteId, memberId);
                setPromos(data);
            } catch (err) {
                logger.error('promo.rewards.widget.load.failed', { siteId, error: err });
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [siteId, memberId]);

    async function handleRedeem(promo: Promo) {
        if (!siteId || !memberId) return;

        setClaimingId(promo.id);
        setMessages(prev => {
            const next = { ...prev };
            delete next[promo.id];
            return next;
        });

        try {
            await claimVoucher({ siteId, promoId: promo.id, memberId, issuedVia: 'points_redemption' });
            setMessages(prev => ({
                ...prev,
                [promo.id]: { type: 'success', text: 'Voucher claimed! Check My Vouchers.' },
            }));
        } catch (err: any) {
            logger.error('promo.rewards.widget.claim.failed', { siteId, promoId: promo.id, error: err });
            setMessages(prev => ({
                ...prev,
                [promo.id]: { type: 'error', text: err?.message ?? 'Failed to claim voucher. Please try again.' },
            }));
        } finally {
            setClaimingId(null);
        }
    }

    if (loading) {
        return (
            <div className="space-y-3">
                <div className="flex items-center gap-2 mb-2">
                    <Gift size={16} className="text-indigo-600" />
                    <h3 className="font-semibold text-gray-700 text-sm">Rewards</h3>
                </div>
                {[1, 2].map(i => (
                    <div key={i} className="animate-pulse h-20 bg-gray-100 rounded-xl" />
                ))}
            </div>
        );
    }

    if (promos.length === 0) {
        return (
            <div className="space-y-2">
                <div className="flex items-center gap-2 mb-2">
                    <Gift size={16} className="text-indigo-600" />
                    <h3 className="font-semibold text-gray-700 text-sm">Rewards</h3>
                </div>
                <p className="text-sm text-gray-400 text-center py-4">No rewards available right now.</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2 mb-2">
                <Gift size={16} className="text-indigo-600" />
                <h3 className="font-semibold text-gray-700 text-sm">Rewards</h3>
            </div>

            {promos.map(promo => {
                const cost = promo.costInPoints ?? 0;
                // TODO: if memberPoints is not available from widget context, the button remains enabled.
                // To enable the points check, pass memberPoints from MemberDashboard.
                const hasEnoughPoints = memberPoints === undefined ? true : memberPoints >= cost;
                const msg = messages[promo.id];
                const isClaiming = claimingId === promo.id;

                return (
                    <div key={promo.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                        <div className="flex justify-between items-start gap-3">
                            <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-gray-800 truncate">{promo.name}</h4>
                                {promo.description && (
                                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{promo.description}</p>
                                )}
                                <div className="flex items-center gap-3 mt-2">
                                    <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                                        {formatPromoValue(promo)}
                                    </span>
                                    <span className="text-xs text-gray-500">{cost} points</span>
                                </div>
                            </div>

                            <button
                                onClick={() => handleRedeem(promo)}
                                disabled={isClaiming || !hasEnoughPoints || msg?.type === 'success'}
                                className={`flex-shrink-0 text-xs font-bold px-3 py-2 rounded-lg transition ${
                                    msg?.type === 'success'
                                        ? 'bg-green-100 text-green-700 cursor-default'
                                        : !hasEnoughPoints
                                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                        : 'bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800'
                                }`}
                            >
                                {isClaiming ? (
                                    <Loader2 size={14} className="animate-spin" />
                                ) : msg?.type === 'success' ? (
                                    'Claimed!'
                                ) : !hasEnoughPoints ? (
                                    'Not enough points'
                                ) : (
                                    'Redeem'
                                )}
                            </button>
                        </div>

                        {msg && msg.type === 'error' && (
                            <p className="text-xs text-red-500 mt-2">{msg.text}</p>
                        )}
                        {msg && msg.type === 'success' && (
                            <p className="text-xs text-green-600 mt-2">{msg.text}</p>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
