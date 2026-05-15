'use client';

import { Plus, Trash2 } from 'lucide-react';

interface FAQItem {
    question: string;
    answer: string;
}

interface FAQFormProps {
    data: Record<string, unknown>;
    onChange: (data: Record<string, unknown>) => void;
}

export const FAQForm = ({ data, onChange }: FAQFormProps) => {
    const safeData = data || {};
    const items: FAQItem[] = (safeData.items as FAQItem[] | undefined) || [];

    const handleItemChange = (index: number, field: keyof FAQItem, value: string) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };
        onChange({ ...safeData, items: newItems });
    };

    const handleAddItem = () => {
        onChange({ ...safeData, items: [...items, { question: '', answer: '' }] });
    };

    const handleDeleteItem = (index: number) => {
        const newItems = items.filter((_, i) => i !== index);
        onChange({ ...safeData, items: newItems });
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-medium text-neutral-400 dark:text-neutral-500">FAQ Items</label>
                <button
                    type="button"
                    onClick={handleAddItem}
                    className="text-xs font-bold text-blue-400 flex items-center gap-1.5 hover:text-blue-300 transition-colors bg-blue-500/10 px-3 py-1.5 rounded-full border border-blue-500/20"
                >
                    <Plus size={14} /> Add Item
                </button>
            </div>

            {items.length === 0 && (
                <div className="text-center py-10 bg-gray-100/50 dark:bg-neutral-900/50 rounded-lg border-2 border-dashed border-gray-200 dark:border-neutral-800 text-neutral-400 dark:text-neutral-500 text-sm">
                    No items yet. Click &ldquo;Add Item&rdquo; to start.
                </div>
            )}

            <div className="space-y-3">
                {items.map((item, index) => (
                    <div key={index} className="p-4 bg-gray-100 dark:bg-neutral-800 rounded-lg border border-gray-300 dark:border-neutral-700 relative group">
                        <input
                            type="text"
                            value={item.question}
                            onChange={(e) => handleItemChange(index, 'question', e.target.value)}
                            className="w-full mb-3 px-4 py-2 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg text-sm font-bold text-neutral-900 dark:text-neutral-200 placeholder-neutral-400 dark:placeholder-neutral-600 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                            placeholder="Question"
                        />
                        <textarea
                            value={item.answer}
                            onChange={(e) => handleItemChange(index, 'answer', e.target.value)}
                            className="w-full px-4 py-2 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg text-sm text-neutral-700 dark:text-neutral-300 placeholder-neutral-400 dark:placeholder-neutral-600 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none resize-none"
                            placeholder="Answer"
                            rows={2}
                        />
                        <button
                            type="button"
                            onClick={() => handleDeleteItem(index)}
                            className="absolute top-2 right-2 p-1.5 bg-gray-200 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400 hover:text-red-400 rounded-lg opacity-0 group-hover:opacity-100 transition-all active:scale-90"
                            title="Delete Item"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};
