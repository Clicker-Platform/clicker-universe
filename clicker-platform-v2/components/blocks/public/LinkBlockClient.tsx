import React from 'react';
import { LinkItem } from "@/data/mockData";
import { LinkCard } from '@/components/LinkCard';

interface LinkBlockClientProps {
    link: LinkItem;
    siteId: string;
}

export const LinkBlockClient = ({ link, siteId }: LinkBlockClientProps) => {
    return (
        <div className="">
            <LinkCard item={link} siteId={siteId} />
        </div>
    );
};
