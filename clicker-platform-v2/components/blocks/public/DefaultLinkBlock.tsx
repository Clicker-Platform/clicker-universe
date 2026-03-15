import React from 'react';
import { LinkItem } from "@/data/mockData";
import { LinkBlockClient } from './LinkBlockClient';

export const DefaultLinkBlock = ({ data, siteId, links }: { data: any, siteId?: string, links?: any[] }) => {
    if (!data || !siteId) return null;
    const linkId = data?.linkId;

    let link: LinkItem | null = null;
    if (links && links.length > 0) {
        link = links.find(l => l.id === linkId) as LinkItem || null;
    }

    if (!link) return null;

    return <LinkBlockClient link={link} siteId={siteId} />;
};
