import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { InventoryItem } from '@/lib/modules/inventory/types';

interface InventoryItemFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
    initialData?: InventoryItem;
    posItems: { id: string; name: string }[];
    isSubmitting: boolean;
}

export function InventoryItemForm({ isOpen, onClose, onSubmit, initialData, posItems, isSubmitting }: InventoryItemFormProps) {
    const [formData, setFormData] = useState({
        name: '',
        sku: '',
        unit: 'pcs',
        costPrice: 0,
        lowStockThreshold: 5,
        currentStock: 0,
        linkedPosItemId: ''
    });

    useEffect(() => {
        if (initialData) {
            setFormData({
                name: initialData.name,
                sku: initialData.sku,
                unit: initialData.unit,
                costPrice: initialData.costPrice || 0,
                lowStockThreshold: initialData.lowStockThreshold,
                currentStock: initialData.currentStock,
                linkedPosItemId: initialData.linkedPosItemId || ''
            });
        } else {
            setFormData({ name: '', sku: '', unit: 'pcs', costPrice: 0, lowStockThreshold: 5, currentStock: 0, linkedPosItemId: '' });
        }
    }, [initialData, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await onSubmit(formData);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-neutral-900 rounded-2xl w-full max-w-lg shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="px-6 py-4 border-b border-gray-100 dark:border-neutral-800 flex justify-between items-center bg-gray-50 dark:bg-neutral-800/50">
                    <h3 className="font-bold text-lg text-gray-800 dark:text-neutral-200">{initialData ? 'Edit Item' : 'Add New Item'}</h3>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-neutral-700 rounded-full transition-colors"
                    >
                        <X size={20} className="text-gray-400 dark:text-neutral-600" />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="block text-sm font-bold text-gray-700 dark:text-neutral-300">SKU</label>
                            <input
                                required
                                className="w-full border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 p-2.5 rounded-lg focus:ring-2 focus:ring-brand-dark/10 focus:border-brand-dark outline-none transition-all"
                                value={formData.sku}
                                onChange={e => setFormData({ ...formData, sku: e.target.value })}
                                placeholder="e.g. ESP-001"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="block text-sm font-bold text-gray-700 dark:text-neutral-300">Unit</label>
                            <input
                                required
                                className="w-full border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 p-2.5 rounded-lg focus:ring-2 focus:ring-brand-dark/10 focus:border-brand-dark outline-none transition-all"
                                value={formData.unit}
                                onChange={e => setFormData({ ...formData, unit: e.target.value })}
                                placeholder="pcs, kg..."
                            />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label className="block text-sm font-bold text-gray-700 dark:text-neutral-300">Item Name</label>
                        <input
                            required
                            className="w-full border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 p-2.5 rounded-lg focus:ring-2 focus:ring-brand-dark/10 focus:border-brand-dark outline-none transition-all"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            placeholder="e.g. Espresso Beans"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="block text-sm font-bold text-gray-700 dark:text-neutral-300">Initial Stock</label>
                            <input
                                type="number"
                                required
                                className="w-full border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 p-2.5 rounded-lg focus:ring-2 focus:ring-brand-dark/10 focus:border-brand-dark outline-none transition-all"
                                value={formData.currentStock}
                                onChange={e => setFormData({ ...formData, currentStock: e.target.value === '' ? 0 : parseInt(e.target.value) })}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="block text-sm font-bold text-gray-700 dark:text-neutral-300">Low Stock Alert</label>
                            <input
                                type="number"
                                required
                                className="w-full border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 p-2.5 rounded-lg focus:ring-2 focus:ring-brand-dark/10 focus:border-brand-dark outline-none transition-all"
                                value={formData.lowStockThreshold}
                                onChange={e => setFormData({ ...formData, lowStockThreshold: e.target.value === '' ? 0 : parseInt(e.target.value) })}
                            />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label className="block text-sm font-bold text-gray-700 dark:text-neutral-300">Linked Menu Item (Optional)</label>
                        <select
                            className="w-full border border-gray-200 dark:border-neutral-700 p-2.5 rounded-lg focus:ring-2 focus:ring-brand-dark/10 focus:border-brand-dark outline-none transition-all bg-white dark:bg-neutral-800 dark:text-neutral-200"
                            value={formData.linkedPosItemId || ''}
                            onChange={e => setFormData({ ...formData, linkedPosItemId: e.target.value })}
                        >
                            <option value="">-- No Link --</option>
                            {posItems.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                        <p className="text-xs text-gray-500 dark:text-neutral-500 mt-1">If linked, stock will be automatically deducted when this item is sold.</p>
                    </div>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className={`w-full text-white py-3 rounded-xl font-bold mt-2 transition-all transform active:scale-[0.98] ${isSubmitting
                                ? 'bg-gray-400 dark:bg-neutral-600 cursor-not-allowed'
                                : 'bg-brand-dark hover:bg-gray-800 shadow-md hover:shadow-lg'
                            }`}
                    >
                        {isSubmitting ? 'Saving...' : (initialData ? 'Save Changes' : 'Create Item')}
                    </button>
                </form>
            </div>
        </div>
    );
}
