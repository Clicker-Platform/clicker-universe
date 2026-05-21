// components/admin/blocks/forms/testimonials/TestimonialItemEditor.tsx
'use client';

import React from 'react';
import type { TestimonialItem, TestimonialRating } from '@/lib/canvas/blocks/testimonials/types';
import { TESTIMONIAL_CONTENT_SOFT_LIMIT } from '@/lib/canvas/blocks/testimonials/types';
import { BlockImageUploader } from '@/components/admin/blocks/BlockImageUploader';

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
        <div
            className="testimonial-item-editor"
            style={{
                border: '1px solid var(--border, #e5e7eb)',
                borderRadius: 8,
                padding: 12,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, opacity: 0.6 }}>Testimonial</span>
                {canRemove && onRemove && (
                    <button type="button" onClick={onRemove} className="text-xs text-red-600 hover:underline">
                        Remove
                    </button>
                )}
            </div>

            <label className="block text-sm">
                <span className="text-xs opacity-70">Person name *</span>
                <input
                    type="text"
                    value={item.personName}
                    onChange={(e) => update('personName', e.target.value)}
                    className="mt-1 w-full border rounded px-2 py-1"
                    required
                />
            </label>

            <label className="block text-sm">
                <span className="text-xs opacity-70">Role / title</span>
                <input
                    type="text"
                    value={item.personRole ?? ''}
                    onChange={(e) => update('personRole', e.target.value || undefined)}
                    className="mt-1 w-full border rounded px-2 py-1"
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
                <span className="text-xs opacity-70">Brand name</span>
                <input
                    type="text"
                    value={item.brandName ?? ''}
                    onChange={(e) => update('brandName', e.target.value || undefined)}
                    className="mt-1 w-full border rounded px-2 py-1"
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
                <span className="text-xs opacity-70">Rating</span>
                <select
                    value={item.rating ?? ''}
                    onChange={(e) => {
                        const v = e.target.value;
                        update('rating', v === '' ? undefined : (Number(v) as TestimonialRating));
                    }}
                    className="mt-1 w-full border rounded px-2 py-1"
                >
                    {RATING_OPTIONS.map((opt) => (
                        <option key={String(opt.value)} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
            </label>

            <label className="block text-sm">
                <span className="text-xs opacity-70">Quote *</span>
                <textarea
                    value={item.content}
                    onChange={(e) => update('content', e.target.value)}
                    rows={4}
                    className="mt-1 w-full border rounded px-2 py-1"
                    required
                />
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        fontSize: 11,
                        marginTop: 2,
                        color: overLimit ? '#b91c1c' : 'inherit',
                    }}
                >
                    {item.content.length} / {TESTIMONIAL_CONTENT_SOFT_LIMIT}
                    {overLimit && ' — long testimonials may be hard to read'}
                </div>
            </label>
        </div>
    );
};

export default TestimonialItemEditor;
