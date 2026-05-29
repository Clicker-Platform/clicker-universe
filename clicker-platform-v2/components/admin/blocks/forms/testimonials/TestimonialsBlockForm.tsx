// components/admin/blocks/forms/testimonials/TestimonialsBlockForm.tsx
'use client';

import React from 'react';
import type { TestimonialsBlockData, TestimonialItem } from '@/lib/canvas/blocks/testimonials/types';
import { makeDefaultTestimonialItem } from '@/lib/canvas/blocks/testimonials/types';
import { TestimonialItemEditor } from './TestimonialItemEditor';
import { SelectMenu } from '../SelectMenu';

interface TestimonialsBlockFormProps {
    data: TestimonialsBlockData;
    onChange: (next: TestimonialsBlockData) => void;
}

export const TestimonialsBlockForm: React.FC<TestimonialsBlockFormProps> = ({ data, onChange }) => {
    const items = data.items ?? [];

    const updateItem = (id: string, next: TestimonialItem) =>
        onChange({ ...data, items: items.map((it) => (it.id === id ? next : it)) });

    const removeItem = (id: string) =>
        onChange({ ...data, items: items.filter((it) => it.id !== id) });

    const addItem = () =>
        onChange({ ...data, items: [...items, makeDefaultTestimonialItem()] });

    const setVariant = (variant: 'single' | 'marquee') =>
        onChange({ ...data, variant });

    const visibleItems = data.variant === 'single' ? items.slice(0, 1) : items;
    const showMarqueeConfig = data.variant === 'marquee';

    const fieldLabelClass = "text-xs text-neutral-500 dark:text-neutral-400";

    return (
        <div className="flex flex-col gap-4">
            <div>
                <span className={`${fieldLabelClass} block mb-1`}>Variant</span>
                <div role="radiogroup" className="flex gap-2">
                    {(['single', 'marquee'] as const).map((v) => (
                        <button
                            key={v}
                            type="button"
                            role="radio"
                            aria-checked={data.variant === v}
                            onClick={() => setVariant(v)}
                            className={`px-3 py-1.5 rounded border text-sm transition-colors ${
                                data.variant === v
                                    ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white'
                                    : 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-200 border-gray-300 dark:border-neutral-700 hover:border-gray-400 dark:hover:border-neutral-600'
                            }`}
                        >
                            {v === 'single' ? 'Single' : 'Marquee'}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex flex-col gap-3">
                {visibleItems.map((item) => (
                    <TestimonialItemEditor
                        key={item.id}
                        item={item}
                        onChange={(next) => updateItem(item.id, next)}
                        onRemove={() => removeItem(item.id)}
                        canRemove={data.variant === 'marquee' && items.length > 1}
                    />
                ))}

                {data.variant === 'marquee' && (
                    <button
                        type="button"
                        onClick={addItem}
                        className="border border-dashed border-gray-300 dark:border-neutral-700 rounded py-2 text-sm text-neutral-600 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-900/40 transition-colors"
                    >
                        + Add testimonial
                    </button>
                )}
            </div>

            {showMarqueeConfig && (
                <fieldset className="flex flex-col gap-2.5 border border-gray-200 dark:border-neutral-800 rounded-lg p-3 bg-white dark:bg-neutral-900/30">
                    <legend className={`${fieldLabelClass} px-1`}>Marquee settings</legend>

                    <label className="block text-sm">
                        <span className={fieldLabelClass}>Direction</span>
                        <SelectMenu
                            value={data.marqueeDirection ?? 'left'}
                            onChange={(v) => onChange({ ...data, marqueeDirection: v as 'left' | 'right' })}
                            searchable={false}
                            allowClear={false}
                            options={[
                                { value: 'left', label: 'Left' },
                                { value: 'right', label: 'Right' },
                            ]}
                        />
                    </label>

                    <label className="block text-sm">
                        <span className={fieldLabelClass}>Speed</span>
                        <SelectMenu
                            value={data.marqueeSpeed ?? 'normal'}
                            onChange={(v) => onChange({ ...data, marqueeSpeed: v as 'slow' | 'normal' | 'fast' })}
                            searchable={false}
                            allowClear={false}
                            options={[
                                { value: 'slow', label: 'Slow' },
                                { value: 'normal', label: 'Normal' },
                                { value: 'fast', label: 'Fast' },
                            ]}
                        />
                    </label>

                    <label className="block text-sm">
                        <span className={fieldLabelClass}>Gap</span>
                        <SelectMenu
                            value={data.marqueeGap ?? 'normal'}
                            onChange={(v) => onChange({ ...data, marqueeGap: v as 'tight' | 'normal' | 'loose' })}
                            searchable={false}
                            allowClear={false}
                            options={[
                                { value: 'tight', label: 'Tight' },
                                { value: 'normal', label: 'Normal' },
                                { value: 'loose', label: 'Loose' },
                            ]}
                        />
                    </label>

                    <label className="flex items-center gap-2 text-sm text-neutral-900 dark:text-neutral-200">
                        <input
                            type="checkbox"
                            checked={data.marqueePauseOnHover ?? true}
                            onChange={(e) => onChange({ ...data, marqueePauseOnHover: e.target.checked })}
                        />
                        Pause on hover
                    </label>
                </fieldset>
            )}
        </div>
    );
};

export default TestimonialsBlockForm;
