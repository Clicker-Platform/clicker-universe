'use client';

import { useEffect, useState } from 'react';
import { collection, query, where, orderBy, getDocs, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { SR_RECORDS, OUTLET_ID_V1 } from '../constants';
import type { ServiceRecord } from '../types';
import { Wrench } from 'lucide-react';

interface Props {
    siteId: string;
    memberPhone?: string;
    memberId?: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    ACTIVE:    { label: 'Active',    color: 'bg-blue-100 text-blue-700' },
    COMPLETED: { label: 'Completed', color: 'bg-green-100 text-green-700' },
    CANCELLED: { label: 'Cancelled', color: 'bg-red-100 text-red-500' },
};

export default function MemberServiceHistoryWidget({ siteId, memberPhone, memberId }: Props) {
    const [records, setRecords] = useState<ServiceRecord[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!siteId || (!memberPhone && !memberId)) {
            setLoading(false);
            return;
        }

        async function fetchRecords() {
            try {
                const outletId = OUTLET_ID_V1(siteId);
                const coll = collection(db, 'sites', siteId, SR_RECORDS);

                // Prefer memberId lookup; fall back to memberPhone
                const q = memberId
                    ? query(coll, where('outletId', '==', outletId), where('memberId', '==', memberId), orderBy('updatedAt', 'desc'), limit(10))
                    : query(coll, where('outletId', '==', outletId), where('memberPhone', '==', memberPhone), orderBy('updatedAt', 'desc'), limit(10));

                const snap = await getDocs(q);
                setRecords(snap.docs.map(d => ({ id: d.id, ...d.data() } as ServiceRecord)));
            } catch (e) {
                console.error('[MemberServiceHistoryWidget] fetch error', e);
            } finally {
                setLoading(false);
            }
        }

        fetchRecords();
    }, [siteId, memberPhone, memberId]);

    if (loading) {
        return (
            <div className="p-4 text-sm text-gray-400 animate-pulse">Loading service history…</div>
        );
    }

    if (records.length === 0) return null;

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2 mb-1">
                <Wrench size={16} className="text-gray-500" />
                <h3 className="text-sm font-bold text-gray-700">Service History</h3>
            </div>
            {records.map(record => {
                const updatedAt = record.updatedAt?.toDate ? record.updatedAt.toDate() : new Date(record.updatedAt as any);
                const badge = STATUS_LABELS[record.status] || { label: record.status, color: 'bg-gray-100 text-gray-500' };

                return (
                    <div key={record.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm flex items-center justify-between gap-3">
                        <div className="min-w-0">
                            <p className="font-bold text-gray-900 text-sm truncate">{record.serviceTypeName}</p>
                            <p className="text-xs text-gray-500 mt-0.5">
                                {record.vehiclePlate}
                                {record.productUsed && <> · {record.productUsed}</>}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">{updatedAt.toLocaleDateString()}</p>
                        </div>
                        <span className={`flex-shrink-0 text-[10px] font-bold uppercase px-2 py-1 rounded-full ${badge.color}`}>
                            {badge.label}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}
