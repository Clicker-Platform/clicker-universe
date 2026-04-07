'use client';

import { Check, Columns, LayoutList, AlignLeft, Image as ImageIcon, CreditCard, LayoutTemplate } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BlockType } from '@/data/mockData';

interface LayoutVariantPickerProps {
    blockType: BlockType;
    currentVariant: string;
    templateDefault?: string;
    onChange: (variant: string) => void;
}

// Variants temporarily disabled (buggy, pending block builder fix)
const DISABLED_VARIANTS = new Set(['hero:split', 'hero:fullbleed']);

const VARIANTS: Partial<Record<BlockType, { id: string; label: string; icon: React.ElementType }[]>> = {
    hero: [
        { id: 'centered', label: 'Centered', icon: AlignLeft },
        { id: 'split', label: 'Split', icon: Columns },
        { id: 'fullbleed', label: 'Fullbleed', icon: ImageIcon },
    ],
    text: [
        { id: 'prose', label: 'Prose', icon: AlignLeft },
        { id: 'two-column', label: '2 Col', icon: Columns },
        { id: 'highlight-box', label: 'Boxed', icon: LayoutTemplate },
    ],
    image: [
        { id: 'standard', label: 'Standard', icon: ImageIcon },
        { id: 'full-width', label: 'Full', icon: ImageIcon },
        { id: 'rounded-card', label: 'Card', icon: CreditCard },
        { id: 'side-caption', label: 'Side Cap', icon: Columns },
    ],
    faq: [
        { id: 'accordion', label: 'Accordion', icon: LayoutList },
        { id: 'grid', label: 'Grid', icon: Columns },
        { id: 'simple-list', label: 'List', icon: AlignLeft },
    ],
    map: [
        { id: 'embed-full', label: 'Embed', icon: ImageIcon },
        { id: 'card-with-address', label: 'Card', icon: CreditCard },
    ],
};

export const LayoutVariantPicker = ({ blockType, currentVariant, templateDefault, onChange }: LayoutVariantPickerProps) => {
    const variants = VARIANTS[blockType];

    if (!variants || variants.length === 0) return null;

    const isOverridden = templateDefault && currentVariant !== templateDefault;

    return (
        <div className="mb-6 p-4 bg-gray-100 dark:bg-neutral-800 rounded-2xl border border-gray-300 dark:border-neutral-700 shadow-sm">
            <h4 className="text-sm font-bold text-neutral-900 dark:text-neutral-200 mb-3 flex items-center justify-between">
                Layout Variant
                {isOverridden && (
                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-300 bg-amber-100/30 dark:bg-amber-900/30 px-2 py-0.5 rounded-full border border-amber-300/30 dark:border-amber-800/30 uppercase tracking-wider">
                        Custom
                    </span>
                )}
                {!isOverridden && templateDefault && (
                    <span className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 bg-gray-100/50 dark:bg-neutral-900/50 px-2 py-0.5 rounded-full border border-gray-300 dark:border-neutral-700 uppercase tracking-wider">
                        Template default
                    </span>
                )}
            </h4>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                {variants.map((v) => {
                    const Icon = v.icon;
                    const isActive = currentVariant === v.id;
                    const isDisabled = DISABLED_VARIANTS.has(`${blockType}:${v.id}`);
                    return (
                        <button
                            type="button"
                            key={v.id}
                            disabled={isDisabled}
                            onClick={() => !isDisabled && onChange(v.id)}
                            className={cn(
                                "relative flex flex-col items-center justify-center p-3 rounded-xl border text-sm font-bold transition-all group",
                                isDisabled
                                    ? "border-transparent bg-gray-100/30 dark:bg-neutral-900/30 text-neutral-400 dark:text-neutral-700 cursor-not-allowed opacity-50"
                                    : isActive
                                        ? "border-blue-500 bg-gray-200 dark:bg-neutral-700 text-blue-400 shadow-lg"
                                        : "border-transparent bg-gray-100/50 dark:bg-neutral-900/50 text-neutral-400 dark:text-neutral-500 hover:border-gray-300 dark:hover:border-neutral-700 hover:bg-gray-200 dark:hover:bg-neutral-700 hover:text-neutral-700 dark:hover:text-neutral-300 shadow-sm"
                            )}
                        >
                            <Icon size={18} className="mb-1.5 opacity-70 transition-opacity" />
                            {v.label}
                            {isActive && !isDisabled && (
                                <div className="absolute top-1.5 right-1.5 w-3.5 h-3.5 bg-blue-500 rounded-full flex items-center justify-center shadow-sm">
                                    <Check size={10} className="text-white" strokeWidth={3} />
                                </div>
                            )}
                            {isDisabled && (
                                <span className="absolute top-1.5 right-1.5 text-[9px] font-bold text-neutral-500 dark:text-neutral-600 bg-gray-200 dark:bg-neutral-800 px-1 py-0.5 rounded uppercase tracking-wider leading-none">
                                    Soon
                                </span>
                            )}
                        </button>
                    )
                })}
            </div>
        </div>
    );
};
