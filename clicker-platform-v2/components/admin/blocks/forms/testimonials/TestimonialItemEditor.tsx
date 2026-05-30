// components/admin/blocks/forms/testimonials/TestimonialItemEditor.tsx
'use client';

import React from 'react';
import type { TestimonialItem, TestimonialRating } from '@/lib/canvas/blocks/testimonials/types';
import { TESTIMONIAL_CONTENT_SOFT_LIMIT } from '@/lib/canvas/blocks/testimonials/types';
import { BlockImageUploader } from '@/components/admin/blocks/BlockImageUploader';
import { SelectMenu } from '../SelectMenu';

interface TestimonialItemEditorProps {
    item: TestimonialItem;
    onChange: (next: TestimonialItem) => void;
    onRemove?: () => void;
    canRemove?: boolean;
}

const RATING_OPTIONS: { value: TestimonialRating | ''; label: string }[] = [
    { value: '', label: 'No rating' },
    { value: 1, label: '★ 1' },
    { value: 2, label: '★★ 2' },
    { value: 3, label: '★★★ 3' },
    { value: 4, label: '★★★★ 4' },
    { value: 5, label: '★★★★★ 5' },
];

export const TestimonialItemEditor: React.FC<TestimonialItemEditorProps> = ({
    item,
    onChange,
    onRemove,
    canRemove,
}) => {
    const update = <K extends keyof TestimonialItem>(key: K, value: TestimonialItem[K]) =>
        onChange({ ...item, [key]: value });

    const overLimit = item.content.length > TESTIMONIAL_CONTENT_SOFT_LIMIT;

    return (
        <div className="testimonial-item-editor border border-gray-200 dark:border-neutral-800 rounded-lg p-3 flex flex-col gap-2.5 bg-white dark:bg-neutral-900/30">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="text-xs text-neutral-500 dark:text-neutral-400">Testimonial</span>
                {canRemove && onRemove && (
                    <button type="button" onClick={onRemove} className="text-xs text-red-600 hover:underline">
                        Remove
                    </button>
                )}
            </div>

            <label className="block text-sm">
                <span className="text-xs text-neutral-500 dark:text-neutral-400">Person name *</span>
                <input
                    type="text"
                    value={item.personName}
                    onChange={(e) => update('personName', e.target.value)}
                    className="mt-1 w-full border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 rounded px-2 py-1 text-neutral-900 dark:text-neutral-200"
                    required
                />
            </label>

            <label className="block text-sm">
                <span className="text-xs text-neutral-500 dark:text-neutral-400">Role / title</span>
                <input
                    type="text"
                    value={item.personRole ?? ''}
                    onChange={(e) => update('personRole', e.target.value || undefined)}
                    className="mt-1 w-full border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 rounded px-2 py-1 text-neutral-900 dark:text-neutral-200"
                    placeholder="e.g. Marketing Director"
                />
            </label>

            <BlockImageUploader
                label="Photo"
                currentUrl={item.personPhoto}
                onUpload={(url) => update('personPhoto', url)}
                onRemove={() => update('personPhoto', undefined)}
            />

            <label className="block text-sm">
                <span className="text-xs text-neutral-500 dark:text-neutral-400">Brand name</span>
                <input
                    type="text"
                    value={item.brandName ?? ''}
                    onChange={(e) => update('brandName', e.target.value || undefined)}
                    className="mt-1 w-full border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 rounded px-2 py-1 text-neutral-900 dark:text-neutral-200"
                    placeholder="e.g. Acme Corp"
                />
            </label>

            <BlockImageUploader
                label="Brand logo"
                currentUrl={item.brandLogo}
                onUpload={(url) => update('brandLogo', url)}
                onRemove={() => update('brandLogo', undefined)}
            />

            <label className="block text-sm">
                <span className="text-xs text-neutral-500 dark:text-neutral-400">Rating</span>
                <SelectMenu
                    value={item.rating != null ? String(item.rating) : ''}
                    onChange={(v) => {
                        update('rating', v === '' ? undefined : (Number(v) as TestimonialRating));
                    }}
                    searchable={false}
                    allowClear={false}
                    options={RATING_OPTIONS.map((opt) => ({ value: String(opt.value), label: opt.label }))}
                />
            </label>

            <label className="block text-sm">
                <span className="text-xs text-neutral-500 dark:text-neutral-400">Quote *</span>
                <textarea
                    value={item.content}
                    onChange={(e) => update('content', e.target.value)}
                    rows={4}
                    className="mt-1 w-full border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 rounded px-2 py-1 text-neutral-900 dark:text-neutral-200"
                    required
                />
                <div
                    className={`flex justify-end mt-0.5 text-[11px] ${overLimit ? 'text-red-700 dark:text-red-400' : 'text-neutral-500 dark:text-neutral-400'}`}
                >
                    {item.content.length} / {TESTIMONIAL_CONTENT_SOFT_LIMIT}
                    {overLimit && ' — long testimonials may be hard to read'}
                </div>
            </label>
        </div>
    );
};

export default TestimonialItemEditor;
