import React from 'react';
import { isModuleEnabled } from '@/lib/modules/registry';
import MemberDashboard from '@/lib/modules/membership/components/dashboard/MemberDashboard';

export const dynamic = 'force-dynamic'; // Ensure fresh check for module status

export default async function DashboardPage() {
    // 1. Strict Modularity Check
    const isEnabled = await isModuleEnabled('membership');

    if (!isEnabled) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 text-center p-6">
                <h1 className="text-2xl font-bold text-gray-800 mb-2">Service Unavailable</h1>
                <p className="text-gray-500">The Membership module is currently disabled.</p>
            </div>
        );
    }

    // 2. Render modular dashboard (Client Component handles Auth)
    return <MemberDashboard />;
}
