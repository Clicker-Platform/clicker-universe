'use client';

import React, { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { LinkItem } from '@/data/mockData';
import { useSite } from '@/lib/site-context';
import { Loader2, Eye, EyeOff, List, LayoutGrid, Type, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { ICON_MAP } from '@/data/icons';
import { ShoppingBag } from 'lucide-react';

interface QuickActionsBlockFormProps {
    data: any;
    onChange: (data: any) => void;
}

const inputClass = "w-full px-4 py-2 bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl text-sm font-bold text-neutral-900 dark:text-neutral-200 placeholder-neutral-400 dark:placeholder-neutral-600 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none";
const labelClass = "flex items-center gap-2 text-xs font-medium text-neutral-400 dark:text-neutral-500 mb-2";

export function QuickActionsBlockForm({ data, onChange }: QuickActionsBlockFormProps) {
    const safeData = data || {};
    const { siteId } = useSite();
    const [links, setLinks] = useState<LinkItem[]>([]);
    const [loading, setLoading] = useState(true);

    const hiddenLinkIds: string[] = safeData.hiddenLinkIds || [];
    const layout: 'list' | 'grid' = safeData.layout || 'list';

    useEffect(() => {
        if (!siteId) return;
        const fetchLinks = async () => {
            try {
                const q = query(collection(db, 'sites', siteId, 'links'), orderBy('order', 'asc'));
                const snapshot = await getDocs(q);
                setLinks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as LinkItem));
            } catch (err) {
                console.error('Error fetching links:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchLinks();
    }, [siteId]);

    const toggleLink = (id: string) => {
        const next = hiddenLinkIds.includes(id)
            ? hiddenLinkIds.filter(x => x !== id)
            : [...hiddenLinkIds, id];
        onChange({ ...safeData, hiddenLinkIds: next });
    };

    const setLayout = (val: 'list' | 'grid') => {
        onChange({ ...safeData, layout: val });
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* System block notice */}
            <div className="bg-blue-500/5 rounded-2xl p-5 border border-blue-500/10">
                <h4 className="font-black text-blue-400 text-xs uppercase tracking-widest mb-2">Dynamic System Block</h4>
                <p className="text-sm text-neutral-400 leading-relaxed">
                    Content is sourced from your Links. Configure visibility and layout below.
                </p>
            </div>

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
                    <button
                        onClick={() => setLayout('list')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-bold transition-all ${
                            layout === 'list'
                                ? 'bg-blue-500/10 border-blue-500/40 text-blue-400'
                                : 'bg-gray-50 dark:bg-neutral-900 border-gray-200 dark:border-neutral-800 text-neutral-400 dark:text-neutral-500 hover:border-gray-300 dark:hover:border-neutral-700'
                        }`}
                    >
                        <List size={15} />
                        List
                    </button>
                    <button
                        onClick={() => setLayout('grid')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-bold transition-all ${
                            layout === 'grid'
                                ? 'bg-blue-500/10 border-blue-500/40 text-blue-400'
                                : 'bg-gray-50 dark:bg-neutral-900 border-gray-200 dark:border-neutral-800 text-neutral-400 dark:text-neutral-500 hover:border-gray-300 dark:hover:border-neutral-700'
                        }`}
                    >
                        <LayoutGrid size={15} />
                        Grid
                    </button>
                </div>
            </div>

            {/* Link Visibility */}
            <div>
                <label className={labelClass}>
                    <Eye size={14} />
                    Link Visibility
                </label>
                <p className="text-xs text-neutral-400 dark:text-neutral-500 mb-3 leading-relaxed">
                    Toggle which links appear in this block.
                </p>

                {loading ? (
                    <div className="flex justify-center p-6 bg-gray-100/30 dark:bg-neutral-900/30 rounded-xl border border-gray-200/50 dark:border-neutral-800/50">
                        <Loader2 className="animate-spin text-blue-500" size={20} />
                    </div>
                ) : links.length === 0 ? (
                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                        <p className="text-xs font-bold text-red-400 leading-relaxed">
                            No links found. Create links in the Links menu first.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-1.5">
                        {links.map(link => {
                            const Icon = link.iconName && ICON_MAP[link.iconName] ? ICON_MAP[link.iconName] : ShoppingBag;
                            const isHidden = hiddenLinkIds.includes(link.id);
                            return (
                                <button
                                    key={link.id}
                                    onClick={() => toggleLink(link.id)}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left ${
                                        isHidden
                                            ? 'bg-gray-100/30 dark:bg-neutral-900/30 border-gray-200/50 dark:border-neutral-800/50 opacity-50'
                                            : 'bg-gray-50 dark:bg-neutral-900 border-gray-200 dark:border-neutral-800 hover:border-gray-300 dark:hover:border-neutral-700'
                                    }`}
                                >
                                    <Icon size={16} className={isHidden ? 'text-neutral-400 dark:text-neutral-600' : 'text-neutral-500 dark:text-neutral-400'} />
                                    <span className={`flex-1 text-sm font-bold truncate ${isHidden ? 'text-neutral-400 dark:text-neutral-600' : 'text-neutral-900 dark:text-neutral-200'}`}>
                                        {link.title}
                                    </span>
                                    {isHidden
                                        ? <EyeOff size={15} className="text-neutral-400 dark:text-neutral-600 shrink-0" />
                                        : <Eye size={15} className="text-neutral-500 dark:text-neutral-400 shrink-0" />
                                    }
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Manage Content link */}
            <div className="pt-4 border-t border-gray-200 dark:border-neutral-800">
                <h5 className="font-bold text-neutral-900 dark:text-neutral-200 text-xs uppercase tracking-wider mb-4">Manage Content</h5>
                <Link
                    href="/admin/links"
                    className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-gray-100 dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-200 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-neutral-700 transition-all active:scale-[0.98]"
                >
                    Edit Links
                    <ExternalLink size={16} />
                </Link>
            </div>
        </div>
    );
}
