import React from 'react';
import { Inter } from 'next/font/google';
import { headers } from 'next/headers';
import { fetchLightweightPublicData } from '@/lib/fetchData';
import { ChatWidgetLoader } from '@/lib/modules/ai-sales-agent/components/ChatWidgetLoader';

const inter = Inter({
    subsets: ['latin'],
    variable: '--font-inter',
    weight: ['400', '500', '600', '700'],
    display: 'swap',
});

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
        <div className={inter.variable}>
            {children}
            {siteId && <ChatWidgetLoader siteId={siteId} agentName={publicData?.profile?.name} />}
        </div>
    );
}
