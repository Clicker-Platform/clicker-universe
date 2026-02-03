import React from 'react';
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { LinkItem } from "@/data/mockData";
import { LinkBlockClient } from './LinkBlockClient';

export const LinkBlock = async ({ data, siteId }: { data: any, siteId?: string }) => {
    const linkId = data.linkId;
    if (!linkId || !siteId) return null;

    let link: LinkItem | null = null;
    try {
        const linkDoc = await getDoc(doc(db, "sites", siteId, "links", linkId));
        if (linkDoc.exists()) {
            link = { id: linkDoc.id, ...linkDoc.data() } as LinkItem;
        }
    } catch (e) {
        console.error("Failed to fetch link for block", linkId, e);
        return null;
    }

    if (!link) return null;

    return <LinkBlockClient link={link} siteId={siteId} />;
};
