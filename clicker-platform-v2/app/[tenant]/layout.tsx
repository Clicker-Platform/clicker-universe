import React from 'react';
import { headers, cookies } from 'next/headers';
import { adminAuth } from '@/lib/firebase-admin';
import { ChatWidgetLoader } from '@/lib/modules/ai-sales-agent/components/ChatWidgetLoader';
import { BuyerAuthBar } from '@/app/[tenant]/_components/BuyerAuthBar';

export default async function TenantLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ tenant: string }>;
}) {
    const { tenant } = await params;
    const headersList = await headers();
    const siteId = headersList.get('x-site-id');

    let buyerEmail: string | null = null;
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('__buyer_session')?.value;
    if (sessionCookie) {
        try {
            const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
            buyerEmail = decoded.email ?? null;
        } catch {
            // No valid session — buyerEmail stays null, AuthBar hidden.
        }
    }

    return (
        <>
            {children}
            {buyerEmail && <BuyerAuthBar tenant={tenant} email={buyerEmail} />}
            {siteId && <ChatWidgetLoader siteId={siteId} />}
        </>
    );
}
