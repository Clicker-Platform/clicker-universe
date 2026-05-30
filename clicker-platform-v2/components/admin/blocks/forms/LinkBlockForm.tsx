'use client';

import React, { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { LinkItem } from '@/data/mockData';
import { Loader2, Palette, RotateCcw } from 'lucide-react';
import { useSite } from '@/lib/site-context';
import { TemplateContext } from '@/components/TemplateProvider';
import { SelectMenu } from './SelectMenu';

interface LinkBlockFormProps {
    data: any;
    onChange: (data: any) => void;
}

const labelClass = "flex items-center gap-2 text-xs font-medium text-neutral-400 dark:text-neutral-500 mb-2";

export const LinkBlockForm = ({ data, onChange }: LinkBlockFormProps) => {
    const safeData = data || {};
    const { siteId } = useSite();
    const templateCtx = React.useContext(TemplateContext);
    const theme = templateCtx?.theme;
    const [links, setLinks] = useState<LinkItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!siteId) return;

        const fetchLinks = async () => {
            try {
                const q = query(collection(db, 'sites', siteId, 'links'), orderBy('order', 'asc'));
                const snapshot = await getDocs(q);
                setLinks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as LinkItem));
            } catch (error) {
                console.error("Error fetching links:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchLinks();
    }, [siteId]);

    const handleChange = (value: string) => {
        onChange({ ...safeData, linkId: value });
    };

    if (loading) {
        return <div className="flex justify-center p-8 bg-gray-100/30 dark:bg-neutral-900/30 rounded-lg border border-gray-200/50 dark:border-neutral-800/50"><Loader2 className="animate-spin text-blue-500" /></div>;
    }

    return (
        <div className="space-y-6">
            {/* Link selector */}
            <div>
                <label className="block text-xs font-medium text-neutral-400 dark:text-neutral-500 mb-2">Select Link Card</label>
                <p className="text-xs text-neutral-400 dark:text-neutral-500 mb-4 leading-relaxed">
                    Choose an existing link from your Links page to display here.
                </p>
                <SelectMenu
                    value={safeData.linkId || ''}
                    onChange={handleChange}
                    placeholder="-- Select a Link --"
                    options={links.map(link => ({
                        value: link.id,
                        label: `${link.title}${link.subtitle ? ` (${link.subtitle})` : ''}`,
                    }))}
                />
                {links.length === 0 && (
                    <div className="mt-3 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                        <p className="text-xs font-bold text-red-400 leading-relaxed">
                            No links found. Please create some links in the "Links" menu first.
                        </p>
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
                    <div className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg">
                        <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400 flex-1">Background</label>
                        <input
                            type="color"
                            value={safeData.cardBgColor || theme?.colors?.surface || '#ffffff'}
                            onChange={e => onChange({ ...safeData, cardBgColor: e.target.value })}
                            className="w-8 h-8 rounded cursor-pointer border border-gray-200 dark:border-neutral-700 bg-transparent p-0.5"
                        />
                        {safeData.cardBgColor && (
                            <button
                                type="button"
                                onClick={() => { const { cardBgColor, ...rest } = safeData; onChange(rest); }}
                                className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
                                title="Reset to template default"
                            >
                                <RotateCcw size={13} />
                            </button>
                        )}
                    </div>
                    <div className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg">
                        <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400 flex-1">Border</label>
                        <input
                            type="color"
                            value={safeData.cardBorderColor || theme?.colors?.border || '#e5e7eb'}
                            onChange={e => onChange({ ...safeData, cardBorderColor: e.target.value })}
                            className="w-8 h-8 rounded cursor-pointer border border-gray-200 dark:border-neutral-700 bg-transparent p-0.5"
                        />
                        {safeData.cardBorderColor && (
                            <button
                                type="button"
                                onClick={() => { const { cardBorderColor, ...rest } = safeData; onChange(rest); }}
                                className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
                                title="Reset to template default"
                            >
                                <RotateCcw size={13} />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
