import React from 'react';
import { ProductVariant } from '../types';
import { X } from 'lucide-react';
import { InventoryItem } from '@/lib/modules/inventory/types';
import { useTemplate } from '@/components/TemplateProvider';

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
    const { theme } = useTemplate();
    if (!isOpen) return null;

    const isGlass = theme.decorations?.surfaceStyle === 'glass' || theme.cardStyle === 'glass';
    const surfaceBg = isGlass ? 'rgba(20,20,20,0.95)' : (theme.colors.surfaceElevated || '#ffffff');
    const surfaceMuted = isGlass ? 'rgba(255,255,255,0.05)' : (theme.colors.surface || '#f9fafb');
    const borderColor = isGlass ? 'rgba(255,255,255,0.1)' : (theme.colors.border || '#e5e7eb');
    const subtleText = theme.colors.textSubtle || theme.colors.muted || theme.colors.foreground;
    const primaryColor = theme.colors.primary;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200"
                style={{ backgroundColor: surfaceBg }}>
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b"
                    style={{ borderColor, backgroundColor: surfaceMuted }}>
                    <div>
                        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: subtleText }}>Select Option</span>
                        <h3 className="font-black text-xl leading-none mt-1" style={{ color: theme.colors.foreground }}>{itemName}</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:opacity-70 transition-opacity"
                        style={{ color: subtleText }}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Variants List */}
                <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto">
                    {variants.map((variant) => {
                        const linkedStock = variant.inventoryId ? inventoryMap[variant.inventoryId] : null;
                        const isOutOfStock = linkedStock ? linkedStock.currentStock <= 0 : false;

                        return (
                            <button
                                key={variant.id}
                                disabled={isOutOfStock}
                                onClick={() => onSelect(variant)}
                                className="w-full flex items-center justify-between p-4 rounded-xl border transition-all duration-200 text-left hover:opacity-80 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                                style={{ backgroundColor: surfaceMuted, borderColor }}
                            >
                                <div>
                                    <div className="font-bold" style={{ color: isOutOfStock ? subtleText : theme.colors.foreground }}>
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
                                    <span className="font-black" style={{ color: primaryColor }}>
                                        {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(variant.price)}
                                    </span>
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Footer Tip */}
                <div className="p-3 text-center text-xs font-medium" style={{ backgroundColor: surfaceMuted, color: subtleText }}>
                    Tap an option to add to cart
                </div>
            </div>
        </div>
    );
}
