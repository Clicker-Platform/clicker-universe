'use client';

import { CartProvider } from '@/lib/modules/byod_pos/cart-context';
import { POSWidget } from '@/lib/modules/byod_pos/components/POSWidget';
import { useSite } from '@/lib/site-context';

import { useEffect, useState } from 'react';
import { getPOSSettings } from '@/lib/modules/byod_pos/api';
import { POSSettings } from '@/lib/modules/byod_pos/types';

interface POSInterfaceProps {
    siteId: string;
    settings: POSSettings | null;
}

function POSInterface({ siteId, settings }: POSInterfaceProps) {
    // Use businessName from POS settings, fallback to generic name
    const businessName = settings?.businessName || 'Self Order';

    return (
        <div className="min-h-screen bg-gray-50 pb-32">
            {/* Mobile Header */}
            <header className="bg-white p-4 sticky top-0 z-10 shadow-sm border-b border-gray-100 flex justify-between items-center">
                <div>
                    <h1 className="font-black text-xl text-brand-dark uppercase">{businessName}</h1>
                    <p className="text-xs text-gray-500 font-bold">Self Order</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-brand-green border border-brand-dark flex items-center justify-center font-black text-[10px]">
                    {businessName.slice(0, 1)}
                </div>
            </header>

            {/* Content */}
            <main className="max-w-md mx-auto md:max-w-4xl pt-4">
                {/* POSWidget is now rendered directly in OrderPage's main content */}
            </main>
        </div>
    );
}

import { OrderTrackerProvider } from '../order-tracker-context';
import { OrderTracker } from '../components/OrderTracker';

interface Props {
    searchParams: { [key: string]: string | string[] | undefined };
    params: { tenant: string }; // siteId
    initialSettings?: POSSettings;
}

export default function OrderPage({ params, searchParams, initialSettings }: Props) {
    const siteId = params.tenant;

    // Check if initialSettings provided, if not fetch them client-side
    const [settings, setSettings] = useState<POSSettings | null>(initialSettings || null);
    const [loadingSettings, setLoadingSettings] = useState(!initialSettings);

    // Fetch Settings if not provided (Client-side Fallback)
    useEffect(() => {
        if (!initialSettings) {
            getPOSSettings(siteId).then(s => {
                setSettings(s);
                setLoadingSettings(false);
            });
        }
    }, [siteId, initialSettings]);

    // Use settings or fallback
    const businessName = settings?.businessName || 'Loading...';
    // Logo is inside settings too now.

    if (!siteId) {
        return <div className="p-4 text-center">Loading...</div>;
    }

    return (
        <OrderTrackerProvider siteId={siteId}>
            <CartProvider>
                <POSInterface siteId={siteId} settings={settings} />
                <OrderTracker />
            </CartProvider>
        </OrderTrackerProvider>
    );
}
