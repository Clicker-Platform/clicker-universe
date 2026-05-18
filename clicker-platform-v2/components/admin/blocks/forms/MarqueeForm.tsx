'use client';

import React from 'react';
import { Plus } from 'lucide-react';
import {
    DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent,
} from '@dnd-kit/core';
import {
    SortableContext, arrayMove, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
    MarqueeBlockData,
    MarqueeSpeed,
    MarqueeDirection,
    MarqueeIconSize,
    MarqueeItemGap,
    makeDefaultMarqueeItem,
} from '@/components/blocks/marquee/types';
import { SortableMarqueeItem } from './marquee/SortableMarqueeItem';

interface MarqueeFormProps {
    data: MarqueeBlockData;
    onChange: (next: MarqueeBlockData) => void;
}

const SPEEDS: MarqueeSpeed[] = ['slow', 'normal', 'fast'];
const SIZES: MarqueeIconSize[] = ['sm', 'md', 'lg'];
const GAPS: MarqueeItemGap[] = ['tight', 'normal', 'loose'];

function Segmented<T extends string>({ value, options, onChange, labels }: { value: T; options: T[]; onChange: (v: T) => void; labels?: Record<string, string> }) {
    return (
        <div className="inline-flex border border-gray-200 rounded overflow-hidden">
            {options.map((opt) => (
                <button
                    key={opt}
                    type="button"
                    onClick={() => onChange(opt)}
                    className={`px-3 py-1 text-xs capitalize ${value === opt ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                >
                    {labels?.[opt] ?? opt}
                </button>
            ))}
        </div>
    );
}

export const MarqueeForm: React.FC<MarqueeFormProps> = ({ data, onChange }) => {
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const oldIndex = data.items.findIndex((i) => i.id === active.id);
        const newIndex = data.items.findIndex((i) => i.id === over.id);
        if (oldIndex < 0 || newIndex < 0) return;
        onChange({ ...data, items: arrayMove(data.items, oldIndex, newIndex) });
    };

    return (
        <div className="space-y-4 p-3">
            <section>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Items</h3>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={data.items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                        <div className="space-y-2">
                            {data.items.map((item, idx) => (
                                <SortableMarqueeItem
                                    key={item.id}
                                    item={item}
                                    onChange={(next) => {
                                        const items = [...data.items];
                                        items[idx] = next;
                                        onChange({ ...data, items });
                                    }}
                                    onDelete={() => {
                                        const items = data.items.filter((i) => i.id !== item.id);
                                        onChange({ ...data, items });
                                    }}
                                />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
                <button
                    type="button"
                    onClick={() => onChange({ ...data, items: [...data.items, makeDefaultMarqueeItem()] })}
                    className="mt-2 inline-flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded"
                >
                    <Plus size={14} /> Add item
                </button>
            </section>

            <section className="space-y-3">
                <h3 className="text-sm font-medium text-gray-700">Layout & motion</h3>

                <div className="flex items-center justify-between">
                    <label className="text-xs text-gray-600">Speed</label>
                    <Segmented<MarqueeSpeed> value={data.speed} options={SPEEDS} onChange={(v) => onChange({ ...data, speed: v })} />
                </div>

                <div className="flex items-center justify-between">
                    <label className="text-xs text-gray-600">Direction</label>
                    <Segmented<MarqueeDirection>
                        value={data.direction}
                        options={['left', 'right']}
                        onChange={(v) => onChange({ ...data, direction: v })}
                        labels={{ left: '← Left', right: 'Right →' }}
                    />
                </div>

                <div className="flex items-center justify-between">
                    <label className="text-xs text-gray-600">Icon size</label>
                    <Segmented<MarqueeIconSize> value={data.iconSize} options={SIZES} onChange={(v) => onChange({ ...data, iconSize: v })} />
                </div>

                <div className="flex items-center justify-between">
                    <label className="text-xs text-gray-600">Item gap</label>
                    <Segmented<MarqueeItemGap> value={data.itemGap} options={GAPS} onChange={(v) => onChange({ ...data, itemGap: v })} />
                </div>
            </section>

            <section>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Color</h3>
                <div className="flex items-center gap-2">
                    <input
                        type="color"
                        value={data.color || '#374151'}
                        onChange={(e) => onChange({ ...data, color: e.target.value })}
                        className="w-8 h-8 border border-gray-200 rounded cursor-pointer"
                    />
                    <input
                        type="text"
                        value={data.color || ''}
                        onChange={(e) => onChange({ ...data, color: e.target.value })}
                        placeholder="#374151 or theme token"
                        className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded"
                    />
                    {data.color && (
                        <button type="button" onClick={() => onChange({ ...data, color: undefined })} className="text-xs text-gray-500 hover:text-gray-700">
                            Reset
                        </button>
                    )}
                </div>
                <p className="mt-1 text-xs text-gray-400">Drives icon stroke + label color via currentColor.</p>
            </section>
        </div>
    );
};

export default MarqueeForm;
