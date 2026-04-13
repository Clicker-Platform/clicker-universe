'use client';

import { CartProvider } from '@/lib/modules/byod_pos/cart-context';
import { POSWidget } from '@/lib/modules/byod_pos/components/POSWidget';
import { useSite } from '@/lib/site-context';
import { useTemplate } from '@/components/TemplateProvider';

import { useEffect, useState } from 'react';
import { getPOSSettings } from '@/lib/modules/byod_pos/api';
import { POSSettings } from '@/lib/modules/byod_pos/types';

interface POSInterfaceProps {
    siteId: string;
    settings: POSSettings | null;
}

function POSInterface({ siteId, settings }: POSInterfaceProps) {
    const { theme } = useTemplate();
    const businessName = settings?.businessName || 'Self Order';

    const isGlass = theme.decorations?.surfaceStyle === 'glass' || theme.cardStyle === 'glass';
    const surfaceBg = isGlass ? 'rgba(20,20,20,0.9)' : (theme.colors.surfaceElevated || '#ffffff');
    const borderColor = isGlass ? 'rgba(255,255,255,0.1)' : (theme.colors.border || '#e5e7eb');
    const primaryColor = theme.colors.primary;
    const accentFg = theme.colors.accentForeground || '#ffffff';
    const subtleText = theme.colors.textSubtle || theme.colors.muted || theme.colors.foreground;

    return (
        <div className="min-h-screen pb-32" style={{ backgroundColor: theme.colors.background || '#f9fafb' }}>
            {/* Mobile Header */}
            <header className="p-4 sticky top-0 z-10 shadow-sm border-b flex justify-between items-center"
                style={{ backgroundColor: surfaceBg, borderColor }}>
                <div>
                    <h1 className="font-black text-xl uppercase" style={{ color: theme.colors.foreground }}>{businessName}</h1>
                    <p className="text-xs font-bold" style={{ color: subtleText }}>Self Order</p>
                </div>
                <div className="w-8 h-8 rounded-full flex items-center justify-center font-black text-[10px]"
                    style={{ backgroundColor: `${primaryColor}20`, color: primaryColor, border: `1px solid ${primaryColor}40` }}>
                    {businessName.slice(0, 1)}
                </div>
            </header>

            {/* Content */}
            <main className="max-w-md mx-auto md:max-w-4xl pt-4">
                <POSWidget settings={settings || undefined} />
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
