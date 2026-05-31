import React from 'react';
import { headers } from 'next/headers';
import { ChatWidgetLoader } from '@/lib/modules/ai-sales-agent/components/ChatWidgetLoader';

export default async function TenantLayout({
    children,
}: {
    children: React.ReactNode;
    params: Promise<{ tenant: string }>;
}) {
    const headersList = await headers();
    const siteId = headersList.get('x-site-id');

    return (
        <>
            {children}
            {siteId && <ChatWidgetLoader siteId={siteId} />}
        </>
    );
}
