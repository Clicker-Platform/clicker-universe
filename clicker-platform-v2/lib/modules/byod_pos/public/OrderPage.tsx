'use client';

import { CartProvider } from '@/lib/modules/byod_pos/cart-context';
import { POSWidget } from '@/lib/modules/byod_pos/components/POSWidget';
import { useSite } from '@/lib/site-context';

function POSInterface() {
    return (
        <div className="min-h-screen bg-gray-50 pb-32">
            {/* Mobile Header */}
            <header className="bg-white p-4 sticky top-0 z-10 shadow-sm border-b border-gray-100 flex justify-between items-center">
                <div>
                    <h1 className="font-black text-xl text-brand-dark uppercase">Alina POS</h1>
                    <p className="text-xs text-gray-500 font-bold">Self Order</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-brand-green border border-brand-dark"></div>
            </header>

            {/* Content */}
            <main className="max-w-md mx-auto md:max-w-4xl pt-4">
                <POSWidget />
            </main>
        </div>
    );
}

import { OrderTrackerProvider } from '../order-tracker-context';
import { OrderTracker } from '../components/OrderTracker';

export default function OrderPage() {
    const { siteId } = useSite();

    if (!siteId) {
        return <div className="p-4 text-center">Loading...</div>;
    }

    return (
        <OrderTrackerProvider siteId={siteId}>
            <CartProvider>
                <POSInterface />
                <OrderTracker />
            </CartProvider>
        </OrderTrackerProvider>
    );
}
