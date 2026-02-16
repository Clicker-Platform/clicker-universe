import React from 'react';

export default function MemberLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="min-h-screen bg-brand-green flex flex-col items-center justify-center p-4">
            {children}
        </div>
    );
}
