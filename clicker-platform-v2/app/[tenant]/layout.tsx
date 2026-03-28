import React from 'react';
import { headers } from 'next/headers';
import { fetchLightweightPublicData } from '@/lib/fetchData';
import { ChatWidgetLoader } from '@/lib/modules/ai-sales-agent/components/ChatWidgetLoader';

export default async function TenantLayout({
    children,
    params
}: {
    children: React.ReactNode;
    params: Promise<{ tenant: string }>;
}) {
    // const { tenant } = await params;
    const headersList = await headers();
    const siteId = headersList.get('x-site-id');
    const publicData = siteId ? await fetchLightweightPublicData(siteId) : null;

    return (
        <>
            {children}
            {siteId && <ChatWidgetLoader siteId={siteId} agentName={publicData?.profile?.name} />}
        </>
    );
}
