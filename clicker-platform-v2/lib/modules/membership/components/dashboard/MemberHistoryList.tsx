'use client';

import React, { useEffect, useState } from 'react';
import { getMemberHistory } from '../../api';
import { LoyaltyTransaction } from '../../types';
import { Calendar, CreditCard, ChevronRight } from 'lucide-react';

// Types are fine
import { POSOrder } from '@/lib/modules/byod_pos/types';
import { FileText, X } from 'lucide-react';
import { useSite } from '@/lib/site-context';
import { logger } from '@/lib/logger-edge';

interface MemberHistoryListProps {
    memberId: string;
}

export default function MemberHistoryList({ memberId }: MemberHistoryListProps) {
    const { siteId } = useSite();
    const [history, setHistory] = useState<LoyaltyTransaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewingReceipt, setViewingReceipt] = useState<string | null>(null); // Order ID
    const [receiptHtml, setReceiptHtml] = useState<string | null>(null);

    useEffect(() => {
        if (!memberId || !siteId) return;
        getMemberHistory(siteId, memberId).then(data => {
            setHistory(data);
            setLoading(false);
        });
    }, [memberId, siteId]);

    const handleViewReceipt = async (orderId: string) => {
        if (!siteId) return;
        // Fetch order
        try {
            // Dynamic Imports for Strict Modularity
            const [{ getOrder, getPOSSettings }, { generateReceiptHtml }] = await Promise.all([
                import('@/lib/modules/byod_pos/api'),
                import('@/lib/modules/byod_pos/receipt-generator')
            ]);

            const [order, settings] = await Promise.all([
                getOrder(siteId, orderId),
                getPOSSettings(siteId)
            ]);

            if (order) {
                const html = generateReceiptHtml(order, settings);
                setReceiptHtml(html);
                setViewingReceipt(orderId);
            } else {
                alert("Order not found");
            }
        } catch (e) {
            logger.error('membership.receipt.load.failed', { siteId, error: e });
            alert("Failed to load receipt");
        }
    };

    if (loading) {
        return <div className="p-4 text-center text-gray-400 text-sm">Loading history...</div>;
    }

    if (history.length === 0) {
        return (
            <div className="bg-white p-6 rounded-lg border border-gray-100 text-center">
                <p className="text-gray-400 text-sm">No transaction history yet.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-bold text-gray-800 px-1">Recent Activity</h3>
            <div className="space-y-3">
                {history.map((tx) => (
                    <div key={tx.id} className="bg-white p-4 rounded-lg border border-gray-100 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-full ${tx.pointsDelta >= 0 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                {tx.pointsDelta >= 0 ? <CreditCard size={18} /> : <CreditCard size={18} />}
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-gray-800">{tx.description}</p>
                                <p className="text-xs text-gray-500 flex items-center gap-1">
                                    <Calendar size={10} />
                                    {tx.createdAt.toDate().toLocaleDateString()}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className={`font-bold ${tx.pointsDelta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {tx.pointsDelta >= 0 ? '+' : ''}{tx.pointsDelta} pts
                            </div>
                            {tx.source === 'POS' && tx.sourceRefId && (
                                <button
                                    onClick={() => handleViewReceipt(tx.sourceRefId)}
                                    className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-900 transition-colors"
                                    title="View Receipt"
                                >
                                    <FileText size={18} />
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Receipt Modal */}
            {viewingReceipt && receiptHtml && (
                <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-2xl w-full max-w-sm overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                            <h3 className="font-bold text-gray-900 flex items-center gap-2">
                                <FileText size={18} />
                                Transaction Receipt
                            </h3>
                            <button
                                onClick={() => {
                                    setViewingReceipt(null);
                                    setReceiptHtml(null);
                                }}
                                className="p-2 hover:bg-gray-200 rounded-full text-gray-500"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="flex-1 bg-gray-200 overflow-hidden p-4 flex justify-center">
                            <iframe
                                srcDoc={receiptHtml}
                                className="bg-white shadow-lg w-[300px] h-full"
                                style={{ border: 'none' }}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
