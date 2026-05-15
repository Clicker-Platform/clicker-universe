'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { LinkItem } from '@/data/mockData';
import { useSite } from '@/lib/site-context';
import { usePageStudio } from '@/components/admin/blocks/PageStudioContext';
import { TemplateContext } from '@/components/TemplateProvider';
import { Loader2, Eye, EyeOff, List, LayoutGrid, Type, Link2, Palette, RotateCcw } from 'lucide-react';
import { ICON_MAP } from '@/data/icons';
import { ShoppingBag } from 'lucide-react';

interface QuickActionsBlockFormProps {
    data: Record<string, unknown>;
    onChange: (data: Record<string, unknown>) => void;
    onOpenLinks?: () => void;
}

const inputClass = "w-full px-4 py-2 bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg text-sm font-bold text-neutral-900 dark:text-neutral-200 placeholder-neutral-400 dark:placeholder-neutral-600 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none";
const labelClass = "flex items-center gap-2 text-xs font-medium text-neutral-400 dark:text-neutral-500 mb-2";

// ── Read-only link row ───────────────────────────────────────────────────────

function LinkRow({ link, isHidden, onToggle }: { link: LinkItem; isHidden: boolean; onToggle: (id: string) => void }) {
    const Icon = link.iconName && ICON_MAP[link.iconName] ? ICON_MAP[link.iconName] : ShoppingBag;
    return (
        <div className={`flex items-center gap-2 px-2 py-2 rounded-lg border transition-all ${
            isHidden
                ? 'bg-gray-100/30 dark:bg-neutral-900/30 border-gray-200/50 dark:border-neutral-800/50 opacity-50'
                : 'bg-gray-50 dark:bg-neutral-900 border-gray-200 dark:border-neutral-800'
        }`}>
            <Icon size={15} className={isHidden ? 'text-neutral-400 dark:text-neutral-600 shrink-0' : 'text-neutral-500 dark:text-neutral-400 shrink-0'} />
            <span className={`flex-1 text-sm font-bold truncate ${isHidden ? 'text-neutral-400 dark:text-neutral-600' : 'text-neutral-900 dark:text-neutral-200'}`}>
                {link.title}
            </span>
            <button
                type="button"
                onClick={() => onToggle(link.id)}
                className="p-1 rounded-md hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors flex-shrink-0"
                title={isHidden ? 'Show' : 'Hide'}
            >
                {isHidden
                    ? <EyeOff size={14} className="text-neutral-400 dark:text-neutral-600" />
                    : <Eye size={14} className="text-neutral-500 dark:text-neutral-400" />
                }
            </button>
        </div>
    );
}

// ── Main form ───────────────────────────────────────────────────────────────

export function QuickActionsBlockForm({ data, onChange, onOpenLinks }: QuickActionsBlockFormProps) {
    const safeData = (data || {}) as {
        title?: string;
        layout?: 'list' | 'grid';
        hiddenLinkIds?: string[];
        cardBgColor?: string;
        cardBorderColor?: string;
    };
    const { siteId } = useSite();
    const { linksVersion } = usePageStudio();
    const templateCtx = React.useContext(TemplateContext);
    const theme = templateCtx?.theme;
    const [links, setLinks] = useState<LinkItem[]>([]);
    const [loading, setLoading] = useState(true);

    const hiddenLinkIds: string[] = safeData.hiddenLinkIds || [];
    const layout: 'list' | 'grid' = (safeData.layout as 'list' | 'grid') || 'list';

    const fetchLinks = useCallback(async () => {
        if (!siteId) return;
        try {
            const q = query(collection(db, 'sites', siteId, 'links'), orderBy('order', 'asc'));
            const snapshot = await getDocs(q);
            setLinks(snapshot.docs
                .map(d => ({ id: d.id, ...d.data() }) as LinkItem & { deletedAt?: unknown })
                .filter(l => !l.deletedAt));
        } catch (err) {
            console.error('Error fetching links:', err);
        } finally {
            setLoading(false);
        }
    }, [siteId]);

    useEffect(() => {
        fetchLinks();
    }, [fetchLinks]);

    // Re-fetch when LinksPanel makes changes (add/delete/reorder)
    useEffect(() => {
        if (linksVersion === 0) return;
        fetchLinks();
    }, [linksVersion, fetchLinks]);

    const toggleLink = (id: string) => {
        const next = hiddenLinkIds.includes(id)
            ? hiddenLinkIds.filter(x => x !== id)
            : [...hiddenLinkIds, id];
        onChange({ ...safeData, hiddenLinkIds: next });
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Section Title Override */}
            <div>
                <label className={labelClass}>
                    <Type size={14} />
                    Section Title Override
                </label>
                <input
                    type="text"
                    value={safeData.title || ''}
                    onChange={e => onChange({ ...safeData, title: e.target.value })}
                    placeholder="Leave blank for default"
                    className={inputClass}
                />
                <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-2 leading-relaxed">
                    Optional. Leave empty to use the default title or hide it.
                </p>
            </div>

            {/* Layout Toggle */}
            <div>
                <label className={labelClass}>
                    <LayoutGrid size={14} />
                    Layout
                </label>
                <div className="flex gap-2">
                    {(['list', 'grid'] as const).map(val => (
                        <button
                            key={val}
                            onClick={() => onChange({ ...safeData, layout: val })}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-bold transition-all ${
                                layout === val
                                    ? 'bg-blue-500/10 border-blue-500/40 text-blue-400'
                                    : 'bg-gray-50 dark:bg-neutral-900 border-gray-200 dark:border-neutral-800 text-neutral-400 dark:text-neutral-500 hover:border-gray-300 dark:hover:border-neutral-700'
                            }`}
                        >
                            {val === 'list' ? <List size={15} /> : <LayoutGrid size={15} />}
                            {val.charAt(0).toUpperCase() + val.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            {/* Link list — visibility only; reorder via LinksPanel */}
            <div>
                <label className={labelClass}>
                    <Eye size={14} />
                    Links
                </label>
                <p className="text-xs text-neutral-400 dark:text-neutral-500 mb-3 leading-relaxed">
                    Toggle eye to show/hide in this block. To reorder, use the Links panel (L).
                </p>

                {loading ? (
                    <div className="flex justify-center p-6 bg-gray-100/30 dark:bg-neutral-900/30 rounded-lg border border-gray-200/50 dark:border-neutral-800/50">
                        <Loader2 className="animate-spin text-blue-500" size={20} />
                    </div>
                ) : links.length === 0 ? (
                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                        <p className="text-xs font-bold text-red-400 leading-relaxed">
                            No links found. Add links using the button below.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-1.5">
                        {links.map(link => (
                            <LinkRow
                                key={link.id}
                                link={link}
                                isHidden={hiddenLinkIds.includes(link.id)}
                                onToggle={toggleLink}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Card Colors */}
            <div>
                <label className={labelClass}>
                    <Palette size={14} />
                    Card Colors
                </label>
                <p className="text-xs text-neutral-400 dark:text-neutral-500 mb-3 leading-relaxed">
                    Overrides template defaults. Text and icons auto-adjust for contrast.
                </p>
                <div className="space-y-2">
                    {/* Background */}
                    <div className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg">
                        <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400 flex-1">Background</label>
                        <input
                            type="color"
                            value={safeData.cardBgColor || theme?.colors.surface || '#ffffff'}
                            onChange={e => onChange({ ...safeData, cardBgColor: e.target.value })}
                            className="w-8 h-8 rounded cursor-pointer border border-gray-200 dark:border-neutral-700 bg-transparent p-0.5"
                        />
                        {safeData.cardBgColor && (
                            <button
                                type="button"
                                onClick={() => { const { cardBgColor: _cardBgColor, ...rest } = safeData; onChange(rest); }}
                                className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
                                title="Reset to template default"
                            >
                                <RotateCcw size={13} />
                            </button>
                        )}
                    </div>
                    {/* Border */}
                    <div className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg">
                        <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400 flex-1">Border</label>
                        <input
                            type="color"
                            value={safeData.cardBorderColor || theme?.colors.border || '#e5e7eb'}
                            onChange={e => onChange({ ...safeData, cardBorderColor: e.target.value })}
                            className="w-8 h-8 rounded cursor-pointer border border-gray-200 dark:border-neutral-700 bg-transparent p-0.5"
                        />
                        {safeData.cardBorderColor && (
                            <button
                                type="button"
                                onClick={() => { const { cardBorderColor: _cardBorderColor, ...rest } = safeData; onChange(rest); }}
                                className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
                                title="Reset to template default"
                            >
                                <RotateCcw size={13} />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Manage Content */}
            <div className="pt-4 border-t border-gray-200 dark:border-neutral-800">
                <h5 className="font-bold text-neutral-900 dark:text-neutral-200 text-xs uppercase tracking-wider mb-4">Manage Content</h5>
                <button
                    type="button"
                    onClick={onOpenLinks}
                    disabled={!onOpenLinks}
                    className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-gray-100 dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-200 rounded-lg font-bold hover:bg-gray-200 dark:hover:bg-neutral-700 transition-all active:scale-[0.98] disabled:opacity-40"
                >
                    <Link2 size={16} />
                    Edit Links
                </button>
            </div>
        </div>
    );
}
