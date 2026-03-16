import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { InventoryItem, TransactionReason } from '@/lib/modules/inventory/types';

interface AdjustStockDialogProps {
    isOpen: boolean;
    onClose: () => void;
    item: InventoryItem | null;
    onConfirm: (quantity: number, reason: TransactionReason) => Promise<void>;
}

export function AdjustStockDialog({ isOpen, onClose, item, onConfirm }: AdjustStockDialogProps) {
    const [adjustQuantity, setAdjustQuantity] = useState<number>(0);
    const [adjustReason, setAdjustReason] = useState<TransactionReason>('purchase');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Reset state when dialog opens or item changes
    useEffect(() => {
        if (isOpen) {
            setAdjustQuantity(0);
            setAdjustReason('purchase');
            setIsSubmitting(false);
        }
    }, [isOpen, item]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (adjustQuantity === 0) return;

        setIsSubmitting(true);
        try {
            await onConfirm(adjustQuantity, adjustReason);
            onClose();
        } catch (error) {
            // Error handling should be done by the parent content often, 
            // but we can catch here if needed. 
            // For now, let's assume parent handles toast errors or we re-throw.
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen || !item) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-neutral-900 rounded-2xl w-full max-w-md shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="px-6 py-4 border-b border-gray-100 dark:border-neutral-800 flex justify-between items-center bg-gray-50 dark:bg-neutral-800/50">
                    <h3 className="font-bold text-lg text-gray-800 dark:text-neutral-200">Adjust Stock: {item.name}</h3>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-neutral-700 rounded-full transition-colors"
                    >
                        <X size={20} className="text-gray-400 dark:text-neutral-600" />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    <div className="p-5 bg-gray-50 dark:bg-neutral-800/50 rounded-xl text-center border border-gray-100 dark:border-neutral-800">
                        <span className="text-gray-500 dark:text-neutral-500 text-xs uppercase font-bold tracking-wider">Current Stock</span>
                        <div className="text-4xl font-black text-brand-dark mt-1">{item.currentStock}</div>
                        <div className="text-sm font-medium text-gray-400 dark:text-neutral-600 mt-1">{item.unit}</div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="block text-sm font-bold text-gray-700 dark:text-neutral-300">Adjustment (+/-)</label>
                        <input
                            type="number"
                            required
                            className="w-full border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 p-3 rounded-xl text-lg font-mono focus:ring-2 focus:ring-brand-dark/10 focus:border-brand-dark outline-none transition-all"
                            value={adjustQuantity}
                            onChange={e => setAdjustQuantity(e.target.value === '' ? 0 : parseInt(e.target.value))}
                            placeholder="e.g. 10 or -5"
                            autoFocus
                        />
                        <p className="text-xs text-gray-500 dark:text-neutral-500 mt-1 flex items-center gap-1">
                            Use <span className="font-mono bg-green-100 text-green-700 px-1 rounded">+</span> to add,
                            <span className="font-mono bg-red-100 text-red-700 px-1 rounded">-</span> to remove.
                        </p>
                    </div>

                    <div className="space-y-1.5">
                        <label className="block text-sm font-bold text-gray-700 dark:text-neutral-300">Reason</label>
                        <select
                            className="w-full border border-gray-200 dark:border-neutral-700 p-2.5 rounded-lg focus:ring-2 focus:ring-brand-dark/10 focus:border-brand-dark outline-none transition-all bg-white dark:bg-neutral-800 dark:text-neutral-200"
                            value={adjustReason}
                            onChange={e => setAdjustReason(e.target.value as TransactionReason)}
                        >
                            <option value="purchase">Purchase (Stock In)</option>
                            <option value="sale">Manual Sale</option>
                            <option value="adjustment">Audit/Correction</option>
                            <option value="waste">Waste/Damage</option>
                            <option value="return">Return</option>
                        </select>
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting || adjustQuantity === 0}
                        className={`w-full text-white py-3 rounded-xl font-bold mt-2 transition-all transform active:scale-[0.98] ${isSubmitting || adjustQuantity === 0
                                ? 'bg-gray-400 dark:bg-neutral-600 cursor-not-allowed'
                                : 'bg-brand-dark hover:bg-gray-800 shadow-md hover:shadow-lg'
                            }`}
                    >
                        {isSubmitting ? 'Updating...' : 'Apply Adjustment'}
                    </button>
                </form>
            </div>
        </div>
    );
}
