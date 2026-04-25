import { useState, useEffect } from 'react';
import { X, History, TrendingUp, TrendingDown, Clock, User, StickyNote } from 'lucide-react';
import { InventoryItem, StockTransaction } from '@/lib/modules/inventory/types';
import { getInventoryTransactions } from '@/lib/modules/inventory/api';
import { toast } from 'sonner';
import { useSite } from '@/lib/site-context'; // New import
import { logger } from '@/lib/logger';

interface StockHistoryDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    item: InventoryItem | null;
}

export function StockHistoryDrawer({ isOpen, onClose, item }: StockHistoryDrawerProps) {
    const { siteId } = useSite();
    const [transactions, setTransactions] = useState<StockTransaction[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isOpen && item && siteId) {
            fetchHistory(item.id);
        } else {
            setTransactions([]); // Clear on close
        }
    }, [isOpen, item, siteId]);

    const fetchHistory = async (itemId: string) => {
        setLoading(true);
        try {
            if (!siteId) return;
            const data = await getInventoryTransactions(siteId, itemId);
            setTransactions(data);
        } catch (error) {
            logger.error('inventory.stock-history.load.failed', { siteId, error });
            toast.error("Failed to load history.");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen || !item) return null;

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-in fade-in duration-300"
                onClick={onClose}
            />

            {/* Drawer */}
            <div className="relative bg-white dark:bg-neutral-900 w-full max-w-md h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-neutral-800 bg-gray-50/50 dark:bg-neutral-800/50">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800 dark:text-neutral-200 flex items-center gap-2">
                            <History size={20} className="text-brand-dark" />
                            Stock History
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-neutral-500 mt-1 font-medium">{item.name}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded-full transition-colors text-gray-400 dark:text-neutral-600 hover:text-gray-600 dark:hover:text-neutral-400"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-0">
                    {loading ? (
                        <div className="p-8 space-y-4">
                            {[...Array(5)].map((_, i) => (
                                <div key={i} className="animate-pulse flex gap-4">
                                    <div className="h-10 w-10 bg-gray-200 dark:bg-neutral-700 rounded-full" />
                                    <div className="flex-1 space-y-2">
                                        <div className="h-4 w-3/4 bg-gray-200 dark:bg-neutral-700 rounded" />
                                        <div className="h-3 w-1/2 bg-gray-100 dark:bg-neutral-800 rounded" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : transactions.length > 0 ? (
                        <div className="divide-y divide-gray-100 dark:divide-neutral-800">
                            {transactions.map((tx) => {
                                const isPositive = tx.change > 0;
                                return (
                                    <div key={tx.id} className="p-6 hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-colors flex gap-4">
                                        <div className={`
                                            flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center
                                            ${isPositive ? 'bg-green-100 dark:bg-green-950/30 text-green-600 dark:text-green-400' : 'bg-red-100 dark:bg-red-950/30 text-red-600 dark:text-red-400'}
                                        `}>
                                            {isPositive ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start mb-1">
                                                <span className={`font-bold text-lg ${isPositive ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                                                    {isPositive ? '+' : ''}{tx.change} {item.unit}
                                                </span>
                                                <span className="text-xs font-medium px-2 py-1 rounded-md bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400 uppercase tracking-wide">
                                                    {tx.reason}
                                                </span>
                                            </div>

                                            <div className="space-y-1.5 text-sm">
                                                <div className="flex items-center gap-2 text-gray-500 dark:text-neutral-500">
                                                    <Clock size={14} />
                                                    <span>
                                                        {tx.timestamp?.toDate ? tx.timestamp.toDate().toLocaleString() : 'Just now'}
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-2 text-gray-500 dark:text-neutral-500">
                                                    <User size={14} />
                                                    <span className="truncate">{tx.performedBy || 'Unknown User'}</span>
                                                </div>

                                                {(tx.notes || tx.referenceId) && (
                                                    <div className="flex items-start gap-2 text-gray-500 dark:text-neutral-500 mt-2 bg-gray-50 dark:bg-neutral-800 p-2 rounded text-xs">
                                                        <StickyNote size={14} className="mt-0.5 flex-shrink-0" />
                                                        <div className="break-words">
                                                            {tx.referenceId && <span className="block font-mono mb-0.5">Ref: {tx.referenceId}</span>}
                                                            {tx.notes}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-64 text-center p-8 text-gray-400 dark:text-neutral-600">
                            <History size={48} className="mb-4 opacity-20" />
                            <p className="font-medium">No history found</p>
                            <p className="text-sm">Transactions will appear here when stock levels change.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
