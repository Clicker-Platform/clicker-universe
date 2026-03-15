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
        <div className="mb-6 p-4 bg-neutral-800 rounded-2xl border border-neutral-700 shadow-sm">
            <h4 className="text-sm font-bold text-neutral-200 mb-3 flex items-center justify-between">
                Layout Variant
                {isOverridden && (
                    <span className="text-[10px] font-bold text-amber-300 bg-amber-900/30 px-2 py-0.5 rounded-full border border-amber-800/30 uppercase tracking-wider">
                        Custom
                    </span>
                )}
                {!isOverridden && templateDefault && (
                    <span className="text-[10px] font-bold text-neutral-500 bg-neutral-900/50 px-2 py-0.5 rounded-full border border-neutral-700 uppercase tracking-wider">
                        Template default
                    </span>
                )}
            </h4>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                {variants.map((v) => {
                    const Icon = v.icon;
                    const isActive = currentVariant === v.id;
                    return (
                        <button
                            type="button"
                            key={v.id}
                            onClick={() => onChange(v.id)}
                            className={cn(
                                "relative flex flex-col items-center justify-center p-3 rounded-xl border-2 text-sm font-bold transition-all group",
                                isActive 
                                    ? "border-blue-500 bg-neutral-700 text-blue-400 shadow-lg" 
                                    : "border-transparent bg-neutral-900/50 text-neutral-500 hover:border-neutral-700 hover:bg-neutral-700 hover:text-neutral-300 shadow-sm"
                            )}
                        >
                            <Icon size={18} className="mb-1.5 opacity-70 group-hover:opacity-100 transition-opacity" />
                            {v.label}
                            {isActive && (
                                <div className="absolute top-1.5 right-1.5 w-3.5 h-3.5 bg-blue-500 rounded-full flex items-center justify-center shadow-sm">
                                    <Check size={10} className="text-white" strokeWidth={3} />
                                </div>
                            )}
                        </button>
                    )
                })}
            </div>
        </div>
    );
};
