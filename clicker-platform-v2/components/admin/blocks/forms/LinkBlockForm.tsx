'use client';

import React, { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { LinkItem } from '@/data/mockData';
import { Loader2 } from 'lucide-react';

interface LinkBlockFormProps {
    data: any;
    onChange: (data: any) => void;
}

import { useSite } from '@/lib/site-context';

export const LinkBlockForm = ({ data, onChange }: LinkBlockFormProps) => {
    const safeData = data || {};
    const { siteId } = useSite();
    const [links, setLinks] = useState<LinkItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!siteId) return;

        const fetchLinks = async () => {
            try {
                const q = query(collection(db, 'sites', siteId, 'links'), orderBy('order', 'asc'));
                const snapshot = await getDocs(q);
                const fetchedLinks = snapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data() }) as LinkItem);

                setLinks(fetchedLinks);
            } catch (error) {
                console.error("Error fetching links:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchLinks();
    }, [siteId]);

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const linkId = e.target.value;
        // Find title for easier preview if needed, but we store ID
        onChange({ ...safeData, linkId });
    };

    if (loading) {
        return <div className="flex justify-center p-8 bg-gray-100/30 dark:bg-neutral-900/30 rounded-2xl border border-gray-200/50 dark:border-neutral-800/50"><Loader2 className="animate-spin text-blue-500" /></div>;
    }

    return (
        <div className="space-y-4">
            <div>
                <label className="block text-xs font-medium text-neutral-400 dark:text-neutral-500 mb-2">Select Link Card</label>
                <p className="text-xs text-neutral-400 dark:text-neutral-500 mb-4 leading-relaxed">
                    Choose an existing link from your Links page to display here.
                </p>

                <select
                    value={safeData.linkId || ''}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl text-sm font-bold text-neutral-900 dark:text-neutral-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none appearance-none cursor-pointer"
                >
                    <option value="" className="bg-gray-50 dark:bg-neutral-900 text-neutral-400">-- Select a Link --</option>
                    {links.map(link => (
                        <option key={link.id} value={link.id} className="bg-gray-50 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-200">
                            {link.title} {link.subtitle ? `(${link.subtitle})` : ''}
                        </option>
                    ))}
                </select>
            </div>

            {links.length === 0 && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                    <p className="text-xs font-bold text-red-400 leading-relaxed">
                        No links found. Please create some links in the "Links" menu first.
                    </p>
                </div>
            )}
        </div>
    );
};
