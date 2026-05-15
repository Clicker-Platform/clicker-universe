import React from 'react';
import { LinkItem } from "@/data/mockData";
import { LinkBlockClient } from './LinkBlockClient';

export const DefaultLinkBlock = ({ data, siteId, links }: { data: Record<string, unknown>, siteId?: string, links?: Record<string, unknown>[] }) => {
    if (!data || !siteId) return null;
    const linkId = data?.linkId;

    let link: LinkItem | null = null;
    if (links && links.length > 0) {
        link = (links.find(l => l.id === linkId) as unknown as LinkItem) || null;
    }

    if (!link) return null;

    return <LinkBlockClient link={link} siteId={siteId} cardBgColor={data.cardBgColor as string | undefined} cardBorderColor={data.cardBorderColor as string | undefined} />;
};
