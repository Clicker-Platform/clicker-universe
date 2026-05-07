'use client';

import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { MediaField } from '@/components/admin/blocks/media-field/MediaField';
import { DEFAULT_MEDIA } from '@/components/admin/blocks/media-field/types';
import type { FeatureCard, FeatureCardsData } from '@/components/blocks/feature-cards/types';

const inputClass = "w-full px-4 py-2.5 bg-gray-100 dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded-xl text-sm text-neutral-900 dark:text-neutral-200 placeholder-neutral-400 dark:placeholder-neutral-600 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-medium";
const labelClass = "block text-xs font-medium text-neutral-500 dark:text-neutral-500 mb-1";
const sectionClass = "p-3 bg-gray-50 dark:bg-neutral-900/50 rounded-xl border border-gray-200 dark:border-neutral-800 space-y-3";

interface Props {
    data: FeatureCardsData;
    onChange: (data: FeatureCardsData) => void;
}

function TagInput({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
    const [input, setInput] = useState('');

    const add = () => {
        const v = input.trim();
        if (!v || tags.includes(v)) return;
        onChange([...tags, v]);
        setInput('');
    };

    return (
        <div className="space-y-2">
            <div className="flex gap-2">
                <input
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); } }}
                    placeholder="Add tag, press Enter"
                    className={inputClass + ' flex-1'}
                />
                <button
                    type="button"
                    onClick={add}
                    className="px-3 py-2 bg-gray-200 dark:bg-neutral-700 rounded-xl text-xs text-neutral-700 dark:text-neutral-300 hover:bg-gray-300 dark:hover:bg-neutral-600 transition-colors"
                >
                    Add
                </button>
            </div>
            {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {tags.map((tag, i) => (
                        <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-200 dark:bg-neutral-700 rounded-full text-xs text-neutral-700 dark:text-neutral-300">
                            {tag}
                            <button type="button" onClick={() => onChange(tags.filter((_, j) => j !== i))} className="hover:text-red-400 transition-colors">×</button>
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}

function CardItem({ card, index, total, onChange, onDelete, onMove }: {
    card: FeatureCard;
    index: number;
    total: number;
    onChange: (card: FeatureCard) => void;
    onDelete: () => void;
    onMove: (dir: 'up' | 'down') => void;
}) {
    const [expanded, setExpanded] = useState(true);
    const [showMedia, setShowMedia] = useState(!!card.media?.src);

    const set = (field: keyof FeatureCard, value: any) => onChange({ ...card, [field]: value });

    return (
        <div className="bg-gray-100 dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2.5">
                <button type="button" onClick={() => setExpanded(e => !e)} className="flex-1 flex items-center gap-2 text-left">
                    <span className="text-xs font-bold text-neutral-400">#{index + 1}</span>
                    <span className="text-sm font-medium text-neutral-700 dark:text-neutral-200 truncate">{card.headline || 'Untitled Card'}</span>
                    {expanded ? <ChevronUp size={14} className="ml-auto text-neutral-400" /> : <ChevronDown size={14} className="ml-auto text-neutral-400" />}
                </button>
                <div className="flex items-center gap-1">
                    <button type="button" disabled={index === 0} onClick={() => onMove('up')} className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 disabled:opacity-30 transition-colors">↑</button>
                    <button type="button" disabled={index === total - 1} onClick={() => onMove('down')} className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 disabled:opacity-30 transition-colors">↓</button>
                    <button type="button" onClick={onDelete} className="p-1 text-neutral-400 hover:text-red-400 transition-colors"><Trash2 size={13} /></button>
                </div>
            </div>

            {expanded && (
                <div className="p-3 space-y-3 border-t border-gray-200 dark:border-neutral-700">
                    <div>
                        <label className={labelClass}>Headline *</label>
                        <input value={card.headline} onChange={e => set('headline', e.target.value)} className={inputClass} placeholder="Card Headline" />
                    </div>

                    <div>
                        <label className={labelClass}>Label (optional)</label>
                        <input value={card.label || ''} onChange={e => set('label', e.target.value)} className={inputClass} placeholder="CATEGORY" />
                    </div>

                    <div>
                        <label className={labelClass}>Body text (optional)</label>
                        <textarea value={card.body || ''} onChange={e => set('body', e.target.value)} className={inputClass + ' resize-none'} rows={2} placeholder="Supporting description..." />
                    </div>

                    <div>
                        <label className={labelClass}>Tags (decorative)</label>
                        <TagInput tags={card.tags || []} onChange={tags => set('tags', tags)} />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelClass}>Background color</label>
                            <div className="flex gap-2 items-center">
                                <input
                                    type="color"
                                    value={card.bgColor || '#ffffff'}
                                    onChange={e => set('bgColor', e.target.value)}
                                    className="w-8 h-8 rounded cursor-pointer border border-gray-300 dark:border-neutral-600 bg-transparent"
                                />
                                <input
                                    value={card.bgColor || ''}
                                    onChange={e => set('bgColor', e.target.value || undefined)}
                                    className={inputClass + ' flex-1'}
                                    placeholder="None (white)"
                                />
                            </div>
                        </div>
                        <div>
                            <label className={labelClass}>Text color</label>
                            <div className="flex gap-2 items-center">
                                <input
                                    type="color"
                                    value={card.textColor || '#ffffff'}
                                    onChange={e => set('textColor', e.target.value)}
                                    className="w-8 h-8 rounded cursor-pointer border border-gray-300 dark:border-neutral-600 bg-transparent"
                                />
                                <input
                                    value={card.textColor || ''}
                                    onChange={e => set('textColor', e.target.value || undefined)}
                                    className={inputClass + ' flex-1'}
                                    placeholder="Auto"
                                />
                            </div>
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className={labelClass + ' mb-0'}>Media (optional)</label>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowMedia(s => !s);
                                    if (showMedia) set('media', undefined);
                                    else set('media', { ...DEFAULT_MEDIA });
                                }}
                                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                            >
                                {showMedia ? 'Remove' : '+ Add media'}
                            </button>
                        </div>
                        {showMedia && (
                            <MediaField
                                value={card.media || { ...DEFAULT_MEDIA }}
                                onChange={val => set('media', val)}
                            />
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export function FeatureCardsForm({ data, onChange }: Props) {
    const safeData: FeatureCardsData = {
        title: data?.title ?? '',
        subtitle: data?.subtitle ?? '',
        columns: data?.columns ?? 3,
        cards: data?.cards ?? [],
    };

    const update = (patch: Partial<FeatureCardsData>) => onChange({ ...safeData, ...patch });

    const updateCard = (index: number, card: FeatureCard) => {
        const cards = [...safeData.cards];
        cards[index] = card;
        update({ cards });
    };

    const addCard = () => {
        update({ cards: [...safeData.cards, { id: uuidv4(), headline: 'New Card' }] });
    };

    const deleteCard = (index: number) => {
        update({ cards: safeData.cards.filter((_, i) => i !== index) });
    };

    const moveCard = (index: number, dir: 'up' | 'down') => {
        const cards = [...safeData.cards];
        const target = dir === 'up' ? index - 1 : index + 1;
        [cards[index], cards[target]] = [cards[target], cards[index]];
        update({ cards });
    };

    return (
        <div className="space-y-5">
            <div className={sectionClass}>
                <div>
                    <label className={labelClass}>Block title (optional)</label>
                    <input value={safeData.title} onChange={e => update({ title: e.target.value })} className={inputClass} placeholder="Why Choose Us" />
                </div>
                <div>
                    <label className={labelClass}>Subtitle (optional)</label>
                    <input value={safeData.subtitle} onChange={e => update({ subtitle: e.target.value })} className={inputClass} placeholder="A short supporting line" />
                </div>
                <div>
                    <label className={labelClass}>Columns</label>
                    <div className="flex gap-2">
                        {([2, 3, 4] as const).map(n => (
                            <button
                                key={n}
                                type="button"
                                onClick={() => update({ columns: n })}
                                className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors border ${safeData.columns === n ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-100 dark:bg-neutral-800 border-gray-300 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 hover:border-gray-400 dark:hover:border-neutral-500'}`}
                            >
                                {n}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div>
                <div className="flex justify-between items-center mb-2">
                    <label className={labelClass + ' mb-0'}>Cards ({safeData.cards.length})</label>
                    <button
                        type="button"
                        onClick={addCard}
                        className="text-xs font-bold text-blue-400 flex items-center gap-1.5 hover:text-blue-300 transition-colors bg-blue-500/10 px-3 py-1.5 rounded-full border border-blue-500/20"
                    >
                        <Plus size={14} /> Add Card
                    </button>
                </div>

                {safeData.cards.length === 0 && (
                    <div className="text-center py-8 bg-gray-50 dark:bg-neutral-900/50 rounded-xl border-2 border-dashed border-gray-200 dark:border-neutral-800 text-neutral-400 dark:text-neutral-500 text-sm">
                        No cards yet. Click &quot;Add Card&quot; to start.
                    </div>
                )}

                <div className="space-y-2">
                    {safeData.cards.map((card, i) => (
                        <CardItem
                            key={card.id}
                            card={card}
                            index={i}
                            total={safeData.cards.length}
                            onChange={c => updateCard(i, c)}
                            onDelete={() => deleteCard(i)}
                            onMove={dir => moveCard(i, dir)}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
