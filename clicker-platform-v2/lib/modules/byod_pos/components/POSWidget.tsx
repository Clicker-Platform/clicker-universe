'use client';

import { useState, useEffect } from 'react';
import { ShoppingBag, X, Plus, Minus } from 'lucide-react';
import { useCart } from '@/lib/modules/byod_pos/cart-context';
import { useOrderTracker } from '../order-tracker-context';
import { toast } from 'sonner';
import { MenuGrid } from '@/lib/modules/byod_pos/components/MenuGrid';
import { db } from '@/lib/firebase';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { POSMemberLookup } from './POSMemberLookup';
import { Member } from '@/lib/modules/membership/types';
import { auth } from '@/lib/firebase';
import { getPOSSettings, addToOrder, requestPayment } from '@/lib/modules/byod_pos/api';
import { POSSettings } from '@/lib/modules/byod_pos/types';
import { useSearchParams } from 'next/navigation';
import { CartProvider } from '../cart-context';
import { useReceiptPrinter } from '@/lib/modules/byod_pos/hooks/useReceiptPrinter';
import { useSite } from '@/lib/site-context'; // New import

interface POSWidgetProps {
    initialItems?: any[];
    initialInventoryMap?: Record<string, any>;
}

export function POSWidget({ initialItems, initialInventoryMap }: POSWidgetProps) {
    const { siteId } = useSite();
    const { items, total, itemCount, removeFromCart, updateQuantity, clearCart, taxBreakdown } = useCart();
    const { trackOrder, activeOrderIds, orders, clearCompletedOrders } = useOrderTracker();
    const { printReceipt } = useReceiptPrinter();
    const [successOrder, setSuccessOrder] = useState<any | null>(null);

    const [isCartOpen, setIsCartOpen] = useState(false);
    const [isCheckingOut, setIsCheckingOut] = useState(false);
    const [member, setMember] = useState<Member | null>(null);
    const [settings, setSettings] = useState<POSSettings | null>(null);
    const [manualTableNumber, setManualTableNumber] = useState(''); // NEW STATE
    const searchParams = useSearchParams();
    const tableParam = searchParams.get('table');

    const [loadingSettings, setLoadingSettings] = useState(true);

    // Initial Settings Load
    // Use useEffect for side effects, not useState initializer
    useEffect(() => {
        if (!siteId) return;
        getPOSSettings(siteId).then((data) => {
            setSettings(data);
            setLoadingSettings(false);
        });
    }, [siteId]);

    // activeOrder detection: Any order that is NOT paid and NOT cancelled is an active open bill.
    const activeOrderDetection = activeOrderIds.find(id => {
        const o = orders.find(ord => ord.id === id);
        return o && o.status !== 'cancelled' && o.paymentStatus !== 'paid';
    }) || null;
    const activeOrder = orders.find(o => o.id === activeOrderDetection);
    const hasActiveOpenBill = activeOrder && activeOrder.status !== 'cancelled' && activeOrder.paymentStatus !== 'paid';

    const handleAction = async () => {
        // Validation: Check Table Number
        // Only validate if we are NOT adding to an existing bill
        if (!hasActiveOpenBill && settings?.requireTableNumber && !tableParam && !manualTableNumber.trim()) {
            toast.error("Table Number Required", {
                description: "Please enter your table number to proceed."
            });
            return;
        }

        // ALWAYS Create a New Order (Ticket) to maintain separate processing status
        // and ensure correct tax calculations per batch.
        await handleCheckout();
    }

    const handleRequestPayment = async () => {
        if (!activeOrderDetection || !siteId) return;
        try {
            await requestPayment(siteId, activeOrderDetection);
            toast.success("Payment Requested", { description: "Please proceed to the cashier." });
        } catch (e) {
            toast.error("Failed to request payment");
        }
    };

    const handleCheckout = async () => {
        if (!siteId) return;
        setIsCheckingOut(true);
        try {
            console.log("Checking out. Current User:", auth.currentUser?.uid);

            // 1. Create Order
            // Determine Status based on mode
            const initialStatus = settings?.mode === 'open-bill' ? 'open' : 'pending';

            // Inherit details from Active Session if adding to bill
            const effectiveTableNumber = hasActiveOpenBill ? (activeOrder?.tableNumber || 'Walk-in') : (tableParam || manualTableNumber || 'Walk-in');
            const effectiveMemberId = hasActiveOpenBill ? (activeOrder?.memberId || null) : (member?.id || null);
            const effectiveMemberName = hasActiveOpenBill ? (activeOrder?.memberName || null) : (member?.fullName || null);
            // Note: If original order had a customerName but no member, we might want to carry that over? 
            // But POSOrder usually relies on Member linking. For Walk-in, maybe not needed.

            // Tax Logic:
            // For Open Bill mode, we don't save tax on individual tickets to avoid double counting on the final bill.
            // For Fast Checkout, we MUST save the tax as this IS the final bill.
            const rawSubtotal = taxBreakdown.subtotal;
            const isFastCheckout = settings?.mode !== 'open-bill';

            const payloadTaxBreakdown = isFastCheckout ? taxBreakdown : {
                ...taxBreakdown,
                serviceCharge: 0,
                restaurantTax: 0,
                total: rawSubtotal,
                subtotal: rawSubtotal
            };

            const payload = {
                items: JSON.parse(JSON.stringify(items)),
                total: isFastCheckout ? taxBreakdown.total : rawSubtotal, // Save total depending on mode
                status: initialStatus,
                paymentStatus: 'unpaid', // Default
                createdAt: serverTimestamp(),
                tableNumber: effectiveTableNumber,
                memberId: effectiveMemberId,
                memberName: effectiveMemberName,
                creatorId: auth.currentUser?.uid || null,
                taxBreakdown: payloadTaxBreakdown
            };
            console.log("Order Payload:", payload);

            const docRef = await addDoc(collection(db, 'sites', siteId, 'modules/byod_pos/orders'), payload);

            // 2. Track Order locally
            // ONLY clear completed orders if we started a brand new session (no active bill).
            // If adding to open bill, we want to KEEP tracking the old ones too.
            if (!hasActiveOpenBill) {
                clearCompletedOrders();
            }

            trackOrder(docRef.id);

            // Success Handling
            // Construct full order object for receipt
            const fullOrder = { id: docRef.id, ...payload, createdAt: { seconds: Date.now() / 1000 } } as any;

            // If open-bill mode, regular toast is fine usually, but maybe they want to print the "ticket" for the kitchen/customer?
            // Let's show the success dialog for BOTH modes to allow printing.

            if (settings?.mode === 'open-bill' || hasActiveOpenBill) {
                toast.success(hasActiveOpenBill ? 'Added to Bill!' : 'Order Placed!', {
                    description: 'New items are being processed.'
                });
                // Do NOT show success modal for open bill
            } else {
                setSuccessOrder(fullOrder);
            }

            clearCart();
            setIsCartOpen(false);
            setManualTableNumber('');
            setMember(null);

        } catch (e: any) {
            console.error(e);
            toast.error('Checkout Failed', {
                description: e.message
            });
        } finally {
            setIsCheckingOut(false);
        }
    };

    return (
        <div className="relative">
            {/* Content */}
            <div>
                <MenuGrid initialItems={initialItems} initialInventoryMap={initialInventoryMap} />
            </div>

            {/* Floating Cart Button */}
            {itemCount > 0 && (
                <div className="fixed bottom-6 inset-x-0 z-20 flex justify-center px-4 pointer-events-none">
                    <button
                        onClick={() => setIsCartOpen(true)}
                        className="bg-brand-dark text-white rounded-full shadow-2xl w-full max-w-md py-4 px-6 flex items-center justify-between pointer-events-auto transform transition-all duration-200 active:scale-95 hover:scale-[1.02]"
                    >
                        <div className="flex items-center gap-3">
                            <div className="bg-brand-green text-brand-dark font-black w-8 h-8 rounded-full flex items-center justify-center text-sm">
                                {itemCount}
                            </div>
                            <span className="font-bold">View Cart</span>
                        </div>
                        <span className="font-bold text-lg">
                            {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(total)}
                        </span>
                    </button>
                </div>
            )}

            {/* Cart Modal / Drawer */}
            {isCartOpen && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex justify-end">
                    <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
                        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                            <h2 className="font-black text-xl uppercase">Your Order</h2>
                            <button onClick={() => setIsCartOpen(false)} className="p-2 hover:bg-gray-200 rounded-full">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {/* Previous Items (if adding to existing) */}
                            {hasActiveOpenBill && activeOrder && activeOrder.items.length > 0 && (
                                <div className="mb-6 pb-6 border-b border-dashed border-gray-200">
                                    <div className="flex items-center gap-2 mb-3 text-gray-500 font-bold text-xs uppercase tracking-wider">
                                        <div className="w-2 h-2 rounded-full bg-brand-green"></div>
                                        Previously Ordered
                                    </div>
                                    <div className="space-y-3 opacity-75 grayscale-[30%]">
                                        {activeOrder.items.map((item, idx) => (
                                            <div key={`prev-${idx}`} className="flex justify-between items-start text-sm">
                                                <div className="flex gap-2">
                                                    <span className="font-black text-gray-400">{item.quantity}x</span>
                                                    <span className="font-medium text-gray-700">{item.name} {item.variantName && `(${item.variantName})`}</span>
                                                </div>
                                                <span className="font-bold text-gray-400">
                                                    {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(item.price * item.quantity)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* New Items */}
                            {items.map((item, idx) => (
                                <div key={`${item.productId}-${item.variantId || 'base'}-${idx}`} className="flex gap-4 items-center">
                                    <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                                        {item.image && <img src={item.image} className="w-full h-full object-cover" />}
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-bold text-gray-800 line-clamp-1">
                                            {item.name}
                                            {item.variantName && <span className="text-sm font-normal text-gray-500 ml-1">({item.variantName})</span>}
                                        </h4>
                                        <div className="text-sm font-black text-brand-dark">
                                            {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(item.price)}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-1">
                                        <button onClick={() => updateQuantity(item.productId, -1, item.variantId)} className="w-8 h-8 flex items-center justify-center font-bold text-gray-500 hover:bg-white rounded shadow-sm">
                                            <Minus size={16} />
                                        </button>
                                        <span className="font-bold w-4 text-center">{item.quantity}</span>
                                        <button onClick={() => updateQuantity(item.productId, 1, item.variantId)} className="w-8 h-8 flex items-center justify-center font-bold text-brand-dark hover:bg-white rounded shadow-sm">
                                            <Plus size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="p-4 border-t border-gray-100 bg-gray-50 space-y-4">
                            <POSMemberLookup
                                selectedMember={member}
                                onMemberSelect={setMember}
                            />

                            {/* Table Number Input (If required and not in URL, and not adding to existing bill) */}
                            {settings?.requireTableNumber && !tableParam && !hasActiveOpenBill && (
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                                        Table Number <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Enter Table Number"
                                        value={manualTableNumber}
                                        onChange={(e) => setManualTableNumber(e.target.value)}
                                        className="w-full p-3 bg-white border border-gray-200 rounded-xl font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green transition-all"
                                    />
                                </div>
                            )}

                            <div className="space-y-2 mb-4">
                                <div className="flex justify-between items-center text-sm text-gray-500">
                                    <span>Subtotal</span>
                                    <span>{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(taxBreakdown?.subtotal || total)}</span>
                                </div>
                                {taxBreakdown?.serviceCharge > 0 && (
                                    <div className="flex justify-between items-center text-sm text-gray-500">
                                        <span>Service Charge ({taxBreakdown.serviceChargeRate}%)</span>
                                        <span>{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(taxBreakdown.serviceCharge)}</span>
                                    </div>
                                )}
                                {taxBreakdown?.restaurantTax > 0 && (
                                    <div className="flex justify-between items-center text-sm text-gray-500">
                                        <span>PB1 ({taxBreakdown.restaurantTaxRate}%)</span>
                                        <span>{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(taxBreakdown.restaurantTax)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                                    <span className="text-gray-900 font-bold">Total</span>
                                    <span className="text-2xl font-black text-brand-dark">
                                        {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(total)}
                                    </span>
                                </div>
                            </div>

                            <button
                                onClick={handleAction}
                                disabled={isCheckingOut || loadingSettings}
                                className="w-full bg-brand-dark text-white py-4 rounded-xl font-bold text-lg hover:bg-gray-800 disabled:bg-gray-400 flex items-center justify-center gap-2"
                            >
                                {isCheckingOut || loadingSettings ? 'Processing...' : (
                                    <>
                                        <ShoppingBag size={20} />
                                        {hasActiveOpenBill ? `Add to Open Bill` : (settings?.mode === 'open-bill' ? 'Start Open Bill' : 'Place Order')}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Success Modal */}
            {successOrder && (
                <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-3xl shadow-xl w-full max-w-sm p-6 text-center transform scale-100">
                        <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4 text-green-600">
                            <ShoppingBag size={32} />
                        </div>
                        <h3 className="text-2xl font-black text-gray-900 mb-2">Order Placed!</h3>
                        <p className="text-gray-500 mb-6">
                            Order #{successOrder.id.slice(-4)} has been successfully created.
                        </p>

                        <div className="space-y-3">
                            <button
                                onClick={() => printReceipt(successOrder, settings || undefined)}
                                className="w-full bg-gray-900 text-white py-3 rounded-xl font-bold text-sm hover:bg-gray-800 flex items-center justify-center gap-2"
                            >
                                Print Receipt
                            </button>
                            <button
                                onClick={() => setSuccessOrder(null)}
                                className="w-full bg-gray-100 text-gray-900 py-3 rounded-xl font-bold text-sm hover:bg-gray-200"
                            >
                                New Order
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

import { OrderTrackerProvider } from '../order-tracker-context';

export function POSBlock(props: POSWidgetProps) {
    const { siteId } = useSite();

    if (!siteId) {
        return <div className="p-4 text-center">Loading...</div>;
    }

    return (
        <OrderTrackerProvider siteId={siteId}>
            <CartProvider>
                <POSWidget {...props} />
            </CartProvider>
        </OrderTrackerProvider>
    );
}
