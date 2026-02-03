'use client';

import { Plus, Trash2 } from 'lucide-react';

interface FAQItem {
    question: string;
    answer: string;
}

interface FAQFormProps {
    data: any;
    onChange: (data: any) => void;
}

export const FAQForm = ({ data, onChange }: FAQFormProps) => {
    const items: FAQItem[] = data.items || [];

    const handleItemChange = (index: number, field: keyof FAQItem, value: string) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };
        onChange({ ...data, items: newItems });
    };

    const handleAddItem = () => {
        onChange({ ...data, items: [...items, { question: '', answer: '' }] });
    };

    const handleDeleteItem = (index: number) => {
        const newItems = items.filter((_, i) => i !== index);
        onChange({ ...data, items: newItems });
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-bold text-gray-500">FAQ Items</label>
                <button
                    type="button"
                    onClick={handleAddItem}
                    className="text-xs font-bold text-brand-dark flex items-center gap-1 hover:underline"
                >
                    <Plus size={12} /> Add Item
                </button>
            </div>

            {items.length === 0 && (
                <div className="text-center py-6 bg-gray-50 rounded-lg border border-dashed border-gray-300 text-gray-400 text-sm">
                    No items yet. Click "Add Item" to start.
                </div>
            )}

            <div className="space-y-3">
                {items.map((item, index) => (
                    <div key={index} className="p-3 bg-gray-50 rounded-lg border border-gray-200 relative group">
                        <input
                            type="text"
                            value={item.question}
                            onChange={(e) => handleItemChange(index, 'question', e.target.value)}
                            className="w-full mb-2 p-2 border border-gray-200 rounded text-sm font-bold focus:border-brand-dark focus:ring-0"
                            placeholder="Question"
                        />
                        <textarea
                            value={item.answer}
                            onChange={(e) => handleItemChange(index, 'answer', e.target.value)}
                            className="w-full p-2 border border-gray-200 rounded text-sm focus:border-brand-dark focus:ring-0"
                            placeholder="Answer"
                            rows={2}
                        />
                        <button
                            type="button"
                            onClick={() => handleDeleteItem(index)}
                            className="absolute top-2 right-2 p-1.5 bg-white text-gray-400 hover:text-red-600 rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
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
