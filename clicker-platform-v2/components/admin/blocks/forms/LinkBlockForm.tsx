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
        return <div className="flex justify-center p-4"><Loader2 className="animate-spin text-gray-400" /></div>;
    }

    return (
        <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Select Link Card</label>
            <p className="text-xs text-gray-500 mb-3">
                Choose an existing link from your Links page to display here.
            </p>

            <select
                value={safeData.linkId || ''}
                onChange={handleChange}
                className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-brand-dark focus:ring-0 transition-colors bg-white font-medium"
            >
                <option value="">-- Select a Link --</option>
                {links.map(link => (
                    <option key={link.id} value={link.id}>
                        {link.title} {link.subtitle ? `(${link.subtitle})` : ''}
                    </option>
                ))}
            </select>

            {links.length === 0 && (
                <p className="text-sm text-red-500 mt-2">
                    No links found. Please create some links in the "Links" menu first.
                </p>
            )}
        </div>
    );
};
