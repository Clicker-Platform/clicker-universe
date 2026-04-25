'use client';

import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { SR_WARRANTY_CARDS } from '../constants';
import type { WarrantyCard } from '../types';
import { ShieldCheck, ExternalLink, Clock } from 'lucide-react';
import { logger } from '@/lib/logger';

interface Props {
    siteId: string;
    memberPhone?: string;
    memberId?: string;
}

export default function MemberWarrantyWidget({ siteId, memberPhone, memberId }: Props) {
    const [cards, setCards] = useState<WarrantyCard[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!siteId || (!memberPhone && !memberId)) {
            setLoading(false);
            return;
        }

        async function fetchCards() {
            try {
                const coll = collection(db, 'sites', siteId, SR_WARRANTY_CARDS);
                // Query by ownerPhone if available, fall back to nothing (memberId not stored on card)
                const q = memberPhone
                    ? query(coll, where('ownerPhone', '==', memberPhone), where('status', '==', 'ACTIVE'), limit(10))
                    : query(coll, where('status', '==', 'ACTIVE'), limit(0)); // empty result if no phone

                const snap = await getDocs(q);
                setCards(snap.docs.map(d => ({ id: d.id, ...d.data() } as WarrantyCard)));
            } catch (e) {
                logger.error('service-records.warranty.fetch.failed', { siteId, error: e });
            } finally {
                setLoading(false);
            }
        }

        fetchCards();
    }, [siteId, memberPhone, memberId]);

    if (loading) {
        return (
            <div className="p-4 text-sm text-gray-400 animate-pulse">Loading warranties…</div>
        );
    }

    if (cards.length === 0) return null;

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2 mb-1">
                <ShieldCheck size={16} className="text-green-600" />
                <h3 className="text-sm font-bold text-gray-700">Active Warranties</h3>
            </div>
            {cards.map(card => {
                const expiryDate = card.expiryDate?.toDate ? card.expiryDate.toDate() : new Date(card.expiryDate as any);
                const daysLeft = Math.ceil((expiryDate.getTime() - Date.now()) / 86_400_000);

                return (
                    <div key={card.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-2">
                            <div>
                                <p className="font-bold text-gray-900 text-sm">{card.serviceTypeName}</p>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    {card.vehiclePlate}
                                    {card.productUsed && <> · {card.productUsed}</>}
                                </p>
                                <div className="flex items-center gap-1 mt-1.5 text-xs text-gray-400">
                                    <Clock size={11} />
                                    <span>
                                        Expires {expiryDate.toLocaleDateString()}
                                        {daysLeft > 0 && <> ({daysLeft}d left)</>}
                                    </span>
                                </div>
                            </div>
                            <a
                                href={`/warranty/${card.warrantyCode}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-xs font-bold text-green-700 hover:underline flex-shrink-0"
                            >
                                View <ExternalLink size={11} />
                            </a>
                        </div>
                        <div className="mt-2 pt-2 border-t border-gray-100">
                            <span className="font-mono text-[10px] text-gray-400 tracking-widest">{card.warrantyCode}</span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
