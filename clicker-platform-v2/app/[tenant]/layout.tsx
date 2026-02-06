import React from 'react';
import { ChatWidget } from '@/lib/modules/ai-sales-agent/components/ChatWidget';
import { headers } from 'next/headers';

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

    return (
        <>
            {children}
            {siteId && <ChatWidget siteId={siteId} />}
        </>
    );
}
