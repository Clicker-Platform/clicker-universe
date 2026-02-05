import React from 'react';

export default async function TenantLayout({
    children,
    params
}: {
    children: React.ReactNode;
    params: Promise<{ tenant: string }>;
}) {
    // const { tenant } = await params; 
    return (
        <>
            {children}
        </>
    );
}
