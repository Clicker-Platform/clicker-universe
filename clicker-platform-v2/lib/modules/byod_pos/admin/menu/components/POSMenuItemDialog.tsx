'use client';

import { useState, useEffect } from 'react';
import { MultiImageUpload } from '@/components/admin/MultiImageUpload';
import { SubmitButton } from '@/components/admin/SubmitButton';
import { X, Pencil, Plus } from 'lucide-react';
import { ProductVariant } from '@/lib/modules/byod_pos/types';

interface POSItemData {
    name: string;
    price: string;
    category: string;
    description: string;
    images: string[];
    isActive: boolean;
    variants?: ProductVariant[];
}

interface POSMenuItemDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: POSItemData) => Promise<void>;
    initialData?: POSItemData; // If provided, we are in Edit mode
    isLoading?: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    inventoryItems?: any[];
}

export function POSMenuItemDialog({ isOpen, onClose, onSave, initialData, isLoading = false, inventoryItems = [] }: POSMenuItemDialogProps) {
    const isEditMode = !!initialData;
    const [formData, setFormData] = useState<POSItemData>({
        name: '',
        price: '',
        category: '',
        description: '',
        images: [],
        isActive: true,
        variants: []
    });

    // Reset/Load data when dialog opens
    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                // eslint-disable-next-line react-hooks/set-state-in-effect
                setFormData(initialData);
            } else {
                // Reset for new item
                setFormData({
                    name: '',
                    price: '',
                    category: '',
                    description: '',
                    images: [],
                    isActive: true,
                    variants: []
                });
            }
        }
    }, [isOpen]); // Intentionally exclude initialData to prevent loops if reference changes upstream

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await onSave(formData);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-neutral-900 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-200 border border-gray-100 dark:border-neutral-800">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-800/50 flex-shrink-0">
                    <div className="flex items-center gap-3 text-brand-dark">
                        <div className="p-2 bg-white dark:bg-neutral-900 rounded-lg shadow-sm text-brand-dark">
                            {isEditMode ? <Pencil size={20} /> : <Plus size={20} />}
                        </div>
                        <h2 className="text-xl font-bold">{isEditMode ? 'Edit Item' : 'Add New Item'}</h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-neutral-700 rounded-full transition-colors">
                        <X size={20} className="text-gray-500 dark:text-neutral-500" />
                    </button>
                </div>

                {/* Scrollable Content */}
                <div className="p-6 overflow-y-auto flex-1">
                    <form id="pos-item-form" onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-neutral-300 mb-1">Item Name</label>
                                <input
                                    placeholder="e.g. Double Cheeseburger"
                                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-brand-dark/20 focus:border-brand-dark transition-all"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-neutral-300 mb-1">Price</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-neutral-600 font-bold text-sm">$</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            placeholder="0.00"
                                            className="w-full pl-7 pr-4 py-2.5 rounded-lg border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-brand-dark/20 focus:border-brand-dark transition-all"
                                            value={formData.price}
                                            onChange={e => {
                                                const val = e.target.value;
                                                // Allow empty string or numbers/decimals
                                                if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                                    setFormData({ ...formData, price: val });
                                                }
                                            }}
                                            onBlur={e => {
                                                const num = parseFloat(e.target.value);
                                                if (!isNaN(num)) {
                                                    setFormData({ ...formData, price: num.toFixed(2) });
                                                }
                                            }}
                                            required
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-neutral-300 mb-1">Category</label>
                                    <input
                                        placeholder="e.g. Mains"
                                        className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-brand-dark/20 focus:border-brand-dark transition-all"
                                        value={formData.category}
                                        onChange={e => setFormData({ ...formData, category: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-neutral-300 mb-1">Description</label>
                                <textarea
                                    placeholder="Describe the item..."
                                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-brand-dark/20 focus:border-brand-dark transition-all min-h-[100px]"
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                />
                            </div>

                            <div className="flex items-center gap-3 bg-gray-50 dark:bg-neutral-800/50 p-4 rounded-xl border border-gray-200 dark:border-neutral-700">
                                <div
                                    onClick={() => setFormData(prev => ({ ...prev, isActive: !prev.isActive }))}
                                    className={`
                                        relative w-12 h-7 rounded-full transition-colors cursor-pointer flex items-center
                                        ${formData.isActive ? 'bg-brand-green' : 'bg-gray-300'}
                                    `}
                                >
                                    <div className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform ml-1 ${formData.isActive ? 'translate-x-5' : ''}`} />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold text-gray-700 dark:text-neutral-300">Visible on POS</span>
                                    <span className="text-xs text-gray-500 dark:text-neutral-500">Enable or disable this item in the catalog</span>
                                </div>
                            </div>
                        </div>

                        {/* Inventory Linking (Simple) */}
                        {(!formData.variants || formData.variants.length === 0) && (
                            <div className="md:col-span-2 bg-blue-50/50 rounded-xl p-4 border border-blue-100">
                                <h3 className="text-sm font-bold text-blue-900 mb-2 flex items-center gap-2">
                                    Inventory Linking
                                    <span className="text-xs font-normal text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">Optional</span>
                                </h3>
                                <p className="text-xs text-blue-700">Link this main item to stock if it has no variants.</p>
                                {/* Future: Main Item Inventory Link dropdown here if needed */}
                            </div>
                        )}

                        {/* Variants Section */}
                        <div className="md:col-span-2 space-y-3 pt-4 border-t border-gray-100 dark:border-neutral-800">
                            <div className="flex items-center justify-between">
                                <label className="block text-sm font-bold text-gray-700 dark:text-neutral-300">Product Variants</label>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const newVariant: ProductVariant = {
                                            id: crypto.randomUUID(),
                                            name: '',
                                            price: parseFloat(formData.price) || 0, // Default to main price
                                            inventoryId: ''
                                        };
                                        setFormData(prev => ({
                                            ...prev,
                                            variants: [...(prev.variants || []), newVariant]
                                        }));
                                    }}
                                    className="text-xs font-bold text-brand-dark bg-brand-dark/10 hover:bg-brand-dark hover:text-white px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                                >
                                    <Plus size={14} /> Add Variant
                                </button>
                            </div>

                            {(!formData.variants || formData.variants.length === 0) ? (
                                <div className="text-center py-6 bg-gray-50 dark:bg-neutral-800/50 rounded-xl border border-dashed border-gray-200 dark:border-neutral-700 text-gray-400 dark:text-neutral-600 text-sm">
                                    No variants added (Standard Product)
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {formData.variants.map((variant, index) => (
                                        <div key={variant.id} className="flex flex-col sm:flex-row gap-3 bg-gray-50 dark:bg-neutral-800/50 p-3 rounded-xl border border-gray-200 dark:border-neutral-700 items-start sm:items-center relative group">
                                            <div className="flex-1 w-full sm:w-auto">
                                                <input
                                                    placeholder="Variant Name (e.g. Large)"
                                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark/20"
                                                    value={variant.name}
                                                    onChange={e => {
                                                        const newVariants = [...(formData.variants || [])];
                                                        newVariants[index] = { ...variant, name: e.target.value };
                                                        setFormData({ ...formData, variants: newVariants });
                                                    }}
                                                    required
                                                />
                                            </div>
                                            <div className="w-24 shrink-0">
                                                <input
                                                    type="number"
                                                    placeholder="Price"
                                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark/20"
                                                    value={variant.price}
                                                    onChange={e => {
                                                        const newVariants = [...(formData.variants || [])];
                                                        newVariants[index] = { ...variant, price: parseFloat(e.target.value) || 0 };
                                                        setFormData({ ...formData, variants: newVariants });
                                                    }}
                                                />
                                            </div>
                                            <div className="flex-1 w-full sm:w-auto">
                                                <select
                                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark/20 bg-white dark:bg-neutral-800 dark:text-neutral-200"
                                                    value={variant.inventoryId || ''}
                                                    onChange={e => {
                                                        const newVariants = [...(formData.variants || [])];
                                                        newVariants[index] = { ...variant, inventoryId: e.target.value };
                                                        setFormData({ ...formData, variants: newVariants });
                                                    }}
                                                >
                                                    <option value="">No Inventory Link</option>
                                                    {inventoryItems?.map(inv => (
                                                        <option key={inv.id} value={inv.id}>
                                                            {inv.name} ({inv.currentStock} {inv.unit})
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const newVariants = formData.variants?.filter((_, i) => i !== index);
                                                    setFormData({ ...formData, variants: newVariants });
                                                }}
                                                className="p-2 text-gray-400 dark:text-neutral-600 hover:text-red-500 hover:bg-white dark:hover:bg-neutral-900 rounded-lg transition-colors sm:static absolute -top-2 -right-2 sm:shadow-none shadow-sm bg-white dark:bg-neutral-900 sm:bg-transparent dark:sm:bg-transparent border sm:border-none border-gray-100 dark:border-neutral-800"
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-bold text-gray-700 dark:text-neutral-300 mb-2">Item Images</label>
                            <div className="bg-gray-50 dark:bg-neutral-800/50 rounded-xl border border-dashed border-gray-200 dark:border-neutral-700 p-4">
                                <MultiImageUpload
                                    images={formData.images}
                                    onImagesChange={(newImages) => setFormData({ ...formData, images: newImages })}
                                    maxImages={5}
                                />
                            </div>
                        </div>
                    </form>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-100 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-800/50 flex justify-end gap-3 flex-shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-2.5 rounded-xl font-bold text-gray-600 dark:text-neutral-400 hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors"
                    >
                        Cancel
                    </button>
                    <SubmitButton
                        form="pos-item-form"
                        isLoading={isLoading}
                        loadingLabel={isEditMode ? 'Updating...' : 'Creating...'}
                        label={isEditMode ? 'Save Changes' : 'Create Item'}
                        className="bg-brand-dark text-white hover:bg-brand-green hover:text-brand-dark px-8 py-2.5 rounded-xl font-bold transition-all shadow-sticker hover:shadow-none hover:translate-y-[1px]"
                    />
                </div>
            </div>
        </div>
    );
}
