'use client';

import { useState } from 'react';
import { X, Settings2, ChevronDown, Check } from 'lucide-react';
import { POSCategory } from '@/lib/modules/byod_pos/api';
import { useIsMobile } from '@/hooks/useIsMobile';
import { MobileBottomSheet } from '@/components/admin/blocks/MobileBottomSheet';

const COLOR_PRESETS: { label: string; value: string }[] = [
    { label: 'Blue',   value: 'bg-blue-100 text-blue-700' },
    { label: 'Purple', value: 'bg-purple-100 text-purple-700' },
    { label: 'Amber',  value: 'bg-amber-100 text-amber-700' },
    { label: 'Cyan',   value: 'bg-cyan-100 text-cyan-700' },
    { label: 'Green',  value: 'bg-green-100 text-green-700' },
    { label: 'Red',    value: 'bg-red-100 text-red-700' },
    { label: 'Pink',   value: 'bg-pink-100 text-pink-700' },
    { label: 'Gray',   value: 'bg-gray-100 text-gray-600' },
];

// ─── Category Manager Modal ───────────────────────────────────────────────────

interface POSCategoryManagerModalProps {
    categories: POSCategory[];
    onSave: (cats: POSCategory[]) => Promise<void>;
    onClose: () => void;
}

export function POSCategoryManagerModal({ categories, onSave, onClose }: POSCategoryManagerModalProps) {
    const isMobile = useIsMobile();
    const [cats, setCats] = useState<POSCategory[]>(categories);
    const [newLabel, setNewLabel] = useState('');
    const [newColor, setNewColor] = useState(COLOR_PRESETS[0].value);
    const [saving, setSaving] = useState(false);

    const addCategory = () => {
        const label = newLabel.trim().toUpperCase();
        if (!label || cats.some(c => c.label === label)) return;
        const id = label.toLowerCase().replace(/[^a-z0-9]/g, '_');
        setCats(prev => [...prev, { id, label, color: newColor }]);
        setNewLabel('');
        setNewColor(COLOR_PRESETS[0].value);
    };

    const removeCategory = (id: string) => {
        setCats(prev => prev.filter(c => c.id !== id));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await onSave(cats);
            onClose();
        } finally {
            setSaving(false);
        }
    };

    const content = (
        <div className="flex flex-col flex-1 overflow-hidden">
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
                {/* Existing categories */}
                <div className="space-y-2">
                    {cats.length === 0 && (
                        <p className="text-sm text-gray-400 dark:text-neutral-600 text-center py-4">No categories yet.</p>
                    )}
                    {cats.map(cat => (
                        <div key={cat.id} className="flex items-center justify-between gap-3 px-3 py-2.5 bg-gray-50 dark:bg-neutral-800 rounded-lg">
                            <span className={`px-2.5 py-0.5 rounded-md text-xs font-bold uppercase tracking-wide ${cat.color}`}>
                                {cat.label}
                            </span>
                            <button
                                onClick={() => removeCategory(cat.id)}
                                className="p-1 hover:bg-red-50 dark:hover:bg-red-950/30 text-gray-400 hover:text-red-500 rounded-lg transition-colors"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    ))}
                </div>

                {/* Add new */}
                <div className="border-t border-gray-100 dark:border-neutral-800 pt-4 space-y-3">
                    <p className="text-xs font-bold text-gray-500 dark:text-neutral-500 uppercase tracking-wide">Add category</p>
                    <input
                        type="text"
                        placeholder="e.g. MAINS"
                        value={newLabel}
                        onChange={e => setNewLabel(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCategory())}
                        className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 focus:outline-none focus:border-brand-dark dark:bg-neutral-800 dark:text-neutral-200 text-sm"
                    />
                    <div className="flex flex-wrap gap-2">
                        {COLOR_PRESETS.map(preset => (
                            <button
                                key={preset.value}
                                type="button"
                                onClick={() => setNewColor(preset.value)}
                                className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${preset.value} ${newColor === preset.value ? 'ring-2 ring-offset-1 ring-brand-dark' : ''}`}
                            >
                                {preset.label}
                            </button>
                        ))}
                    </div>
                    <button
                        type="button"
                        onClick={addCategory}
                        disabled={!newLabel.trim()}
                        className="w-full py-2 rounded-lg border-2 border-dashed border-gray-300 dark:border-neutral-700 text-sm font-bold text-gray-500 dark:text-neutral-500 hover:border-brand-dark hover:text-brand-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        + Add Category
                    </button>
                </div>
            </div>

            <div className="p-5 border-t border-gray-100 dark:border-neutral-800 flex gap-3 flex-shrink-0">
                <button
                    onClick={onClose}
                    className="flex-1 py-2.5 rounded-lg font-bold text-gray-600 dark:text-neutral-400 bg-gray-100 dark:bg-neutral-800 hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors"
                >
                    Cancel
                </button>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 py-2.5 rounded-lg font-bold text-white bg-studio-blue hover:bg-studio-blue/85 transition-colors disabled:opacity-50"
                >
                    {saving ? 'Saving…' : 'Save Categories'}
                </button>
            </div>
        </div>
    );

    if (isMobile) {
        return (
            <MobileBottomSheet
                isOpen={true}
                onClose={onClose}
                title="Manage Categories"
                height="80vh"
            >
                {content}
            </MobileBottomSheet>
        );
    }

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-neutral-900 rounded-lg w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
                <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-neutral-800 flex-shrink-0">
                    <h2 className="text-lg font-bold text-brand-dark">Manage Categories</h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-full transition-colors">
                        <X size={18} />
                    </button>
                </div>
                {content}
            </div>
        </div>
    );
}

// ─── Category Picker Dropdown ─────────────────────────────────────────────────

interface POSCategoryPickerProps {
    value: string;
    onChange: (v: string) => void;
    categories: POSCategory[];
    onRequestManage: () => void;
}

export function POSCategoryPicker({ value, onChange, categories, onRequestManage }: POSCategoryPickerProps) {
    const [open, setOpen] = useState(false);

    const selected = categories.find(c => c.label === value);
    const colorClass = selected?.color ?? 'bg-gray-100 text-gray-600';

    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 focus:outline-none focus:border-brand-dark text-sm dark:text-neutral-200"
            >
                {value ? (
                    <span className={`px-2 py-0.5 rounded-md text-xs font-bold uppercase tracking-wide ${colorClass}`}>
                        {value}
                    </span>
                ) : (
                    <span className="text-gray-400 dark:text-neutral-500">Select category</span>
                )}
                <ChevronDown size={16} className="text-gray-400 shrink-0" />
            </button>
            {open && (
                <div className="absolute z-50 mt-1 w-full bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg shadow-lg overflow-hidden">
                    <div className="max-h-48 overflow-y-auto">
                        {categories.length === 0 && (
                            <p className="px-4 py-3 text-sm text-gray-400 dark:text-neutral-500">No categories yet.</p>
                        )}
                        {categories.map(cat => (
                            <button
                                key={cat.id}
                                type="button"
                                onClick={() => { onChange(cat.label); setOpen(false); }}
                                className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-neutral-700 transition-colors text-left"
                            >
                                <span className={`px-2 py-0.5 rounded-md text-xs font-bold uppercase tracking-wide ${cat.color}`}>
                                    {cat.label}
                                </span>
                                {value === cat.label && <Check size={14} className="text-brand-dark" />}
                            </button>
                        ))}
                    </div>
                    <div className="border-t border-gray-100 dark:border-neutral-700">
                        <button
                            type="button"
                            onClick={() => { setOpen(false); onRequestManage(); }}
                            className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-brand-dark hover:bg-gray-50 dark:hover:bg-neutral-700 transition-colors"
                        >
                            <Settings2 size={13} /> Manage categories…
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
