'use client';

import { useState } from 'react';
import { GripVertical, Trash2, ChevronDown, ChevronUp, Link as LinkIcon } from 'lucide-react';
import { ICON_MAP } from '@/data/icons';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export interface SortableNavItemProps {
    item: any;
    onRemove: () => void;
    onUpdate: (field: string, val: string) => void;
    onOpenIconPicker: (currentIcon: string, onSelect: (icon: string) => void) => void;
    forms: any[];
    pages: any[];
    homepageSlug: string;
}

export function SortableNavItem({
    item,
    onRemove,
    onUpdate,
    onOpenIconPicker,
    forms,
    pages,
    homepageSlug,
}: SortableNavItemProps) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id });
    const style = { transform: CSS.Transform.toString(transform), transition };
    const [isExpanded, setIsExpanded] = useState(false);

    const Icon = item.icon && ICON_MAP[item.icon as keyof typeof ICON_MAP]
        ? ICON_MAP[item.icon as keyof typeof ICON_MAP]
        : LinkIcon;

    return (
        <div ref={setNodeRef} style={style} className="bg-gray-100 dark:bg-neutral-800 rounded-lg border border-gray-200 dark:border-neutral-700 overflow-hidden mb-2">
            <div className="flex items-center justify-between px-3 py-2 bg-gray-100/80 dark:bg-neutral-800/80">
                <div className="flex items-center gap-2">
                    <div
                        {...attributes}
                        {...listeners}
                        className="text-neutral-400 dark:text-neutral-600 hover:text-neutral-700 dark:hover:text-neutral-400 cursor-grab active:cursor-grabbing p-0.5"
                    >
                        <GripVertical size={15} />
                    </div>
                    <div className="w-6 h-6 bg-gray-200 dark:bg-neutral-700 rounded flex items-center justify-center text-neutral-700 dark:text-neutral-300">
                        <Icon size={13} />
                    </div>
                    <span className="text-sm font-medium text-neutral-900 dark:text-neutral-200 truncate max-w-[120px]">
                        {item.label || 'New Link'}
                    </span>
                    <span className="text-[10px] text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
                        {item.type === 'form' ? 'Form' : item.type === 'page' ? 'Page' : 'URL'}
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="p-1 text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
                    >
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    <button
                        type="button"
                        onClick={onRemove}
                        className="p-1 text-neutral-400 dark:text-neutral-600 hover:text-red-400 transition-colors"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>

            {isExpanded && (
                <div className="px-3 py-3 space-y-3 border-t border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-850">
                    <div>
                        <label className="block text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-1">Label</label>
                        <input
                            type="text"
                            value={item.label}
                            onChange={(e) => onUpdate('label', e.target.value)}
                            className="w-full px-3 py-1.5 text-sm bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-md text-neutral-900 dark:text-neutral-200 placeholder-neutral-400 dark:placeholder-neutral-600 focus:border-blue-500/50 focus:outline-none"
                            placeholder="e.g. Home"
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-1">Link Type</label>
                        <div className="flex gap-1">
                            {(['page', 'form', 'url'] as const).map(t => (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => onUpdate('type', t)}
                                    className={`flex-1 px-2 py-1.5 text-[10px] font-bold uppercase rounded transition-all ${
                                        (item.type === t) || (!item.type && t === 'page')
                                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                            : 'bg-gray-100 dark:bg-neutral-800 text-neutral-500 border border-gray-300 dark:border-neutral-700 hover:text-neutral-700 dark:hover:text-neutral-300'
                                    }`}
                                >
                                    {t === 'url' ? 'URL' : t}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        {item.type === 'form' ? (
                            <select
                                value={item.formId || ''}
                                onChange={(e) => onUpdate('formId', e.target.value)}
                                className="w-full px-3 py-1.5 text-sm bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-md text-neutral-900 dark:text-neutral-200 focus:border-blue-500/50 focus:outline-none"
                            >
                                <option value="">— Select Form —</option>
                                {forms.map(f => <option key={f.id} value={f.id}>{f.title}</option>)}
                            </select>
                        ) : item.type === 'page' || !item.type ? (
                            <select
                                value={item.pageId || ''}
                                onChange={(e) => {
                                    const page = pages.find(p => p.id === e.target.value);
                                    onUpdate('pageId', e.target.value);
                                    if (page) {
                                        // Homepage uses action:homepage so the nav bar resolves it to "/"
                                        const resolvedValue = page.slug === homepageSlug ? 'action:homepage' : `/${page.slug}`;
                                        onUpdate('value', resolvedValue);
                                        // Auto-fill label if still the default placeholder
                                        if (!item.label || item.label === 'New Link') {
                                            onUpdate('label', page.title);
                                        }
                                    }
                                }}
                                className="w-full px-3 py-1.5 text-sm bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-md text-neutral-900 dark:text-neutral-200 focus:border-blue-500/50 focus:outline-none"
                            >
                                <option value="">— Select Page —</option>
                                {pages.map(p => <option key={p.id} value={p.id}>{p.title} (/{p.slug})</option>)}
                            </select>
                        ) : (
                            <input
                                type="text"
                                value={item.value || ''}
                                onChange={(e) => onUpdate('value', e.target.value)}
                                className="w-full px-3 py-1.5 text-sm bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-md text-neutral-900 dark:text-neutral-200 placeholder-neutral-400 dark:placeholder-neutral-600 focus:border-blue-500/50 focus:outline-none font-mono"
                                placeholder="/path or https://"
                            />
                        )}
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-1">Icon</label>
                        <button
                            type="button"
                            onClick={() => onOpenIconPicker(item.icon || '', (icon) => onUpdate('icon', icon))}
                            className="w-full flex items-center gap-2 px-3 py-1.5 bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-md hover:border-gray-400 dark:hover:border-neutral-600 transition-colors text-left"
                        >
                            <div className="w-5 h-5 flex items-center justify-center text-neutral-700 dark:text-neutral-300">
                                <Icon size={14} />
                            </div>
                            <span className="text-sm text-neutral-700 dark:text-neutral-300">{item.icon || 'Select Icon'}</span>
                            <span className="ml-auto text-[10px] text-neutral-400 dark:text-neutral-500">Change</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
