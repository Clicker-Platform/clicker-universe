import React, { useState } from 'react';
import { ProductVariant } from '../types';
import { X, Check } from 'lucide-react';
import { InventoryItem } from '@/lib/modules/inventory/types';

interface VariantSelectionDialogProps {
    isOpen: boolean;
    itemName: string;
    variants: ProductVariant[];
    inventoryMap: Record<string, InventoryItem>;
    onClose: () => void;
    onSelect: (variant: ProductVariant) => void;
}

export function VariantSelectionDialog({
    isOpen,
    itemName,
    variants,
    inventoryMap,
    onClose,
    onSelect
}: VariantSelectionDialogProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50">
                    <div>
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Select Option</span>
                        <h3 className="font-black text-xl text-brand-dark leading-none mt-1">{itemName}</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full text-gray-400 hover:bg-gray-200 hover:text-gray-800 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Variants List */}
                <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto">
                    {variants.map((variant) => {
                        // Check stock if linked
                        const linkedStock = variant.inventoryId ? inventoryMap[variant.inventoryId] : null;
                        const isOutOfStock = linkedStock ? linkedStock.currentStock <= 0 : false;

                        return (
                            <button
                                key={variant.id}
                                disabled={isOutOfStock}
                                onClick={() => onSelect(variant)}
                                className={`
                                    w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all duration-200 text-left group
                                    ${isOutOfStock
                                        ? 'bg-gray-50 border-gray-100 opacity-60 cursor-not-allowed'
                                        : 'bg-white border-gray-100 hover:border-brand-dark hover:shadow-md active:scale-[0.98]'
                                    }
                                `}
                            >
                                <div>
                                    <div className={`font-bold ${isOutOfStock ? 'text-gray-400' : 'text-gray-800'}`}>
                                        {variant.name}
                                    </div>
                                    {isOutOfStock ? (
                                        <span className="text-xs font-bold text-red-500">Out of Stock</span>
                                    ) : (
                                        linkedStock && linkedStock.currentStock < 5 && (
                                            <span className="text-xs font-bold text-orange-500">Only {linkedStock.currentStock} left!</span>
                                        )
                                    )}
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="font-black text-brand-dark">
                                        {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(variant.price)}
                                    </span>
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Footer Tip */}
                <div className="p-3 bg-gray-50 text-center text-xs text-gray-400 font-medium">
                    Tap an option to add to cart
                </div>
            </div>
        </div>
    );
}
