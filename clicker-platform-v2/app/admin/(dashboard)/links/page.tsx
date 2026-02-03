'use client';

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import Link from 'next/link';
import LinksManager from './LinksClient';
import { LinkItem } from '@/data/mockData';
import { Loader2 } from 'lucide-react';
import { LinksSkeleton } from '@/components/skeletons/LinksSkeleton';

interface AdminLinkItem extends Omit<LinkItem, 'icon'> {
    iconName: string;
    order?: number;
}

import { useSite } from '@/lib/site-context';

export default function LinksPage() {
    const { siteId } = useSite();
    const [links, setLinks] = useState<AdminLinkItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!siteId) return;

        async function fetchLinks() {
            try {
                const linksSnap = await getDocs(collection(db, 'sites', siteId, 'links'));
                const fetchedLinks = linksSnap.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                } as AdminLinkItem));

                // Sort by order
                fetchedLinks.sort((a, b) => (a.order || 0) - (b.order || 0));

                setLinks(fetchedLinks);
            } catch (error) {
                console.error("Error fetching links:", error);
            } finally {
                setLoading(false);
            }
        }

        fetchLinks();
    }, [siteId]);

    if (loading) {
        if (loading) {
            return <LinksSkeleton />;
        }
    }

    return (
        <LinksManager initialLinks={links} />
    );
}
