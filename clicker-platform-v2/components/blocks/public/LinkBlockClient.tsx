import React from 'react';
import { LinkItem } from "@/data/mockData";
import { LinkCard } from '@/components/LinkCard';

interface LinkBlockClientProps {
    link: LinkItem;
    siteId: string;
    cardBgColor?: string;
    cardBorderColor?: string;
}

export const LinkBlockClient = ({ link, siteId, cardBgColor, cardBorderColor }: LinkBlockClientProps) => {
    return (
        <div className="">
            <LinkCard item={link} siteId={siteId} cardBgColor={cardBgColor} cardBorderColor={cardBorderColor} />
        </div>
    );
};
