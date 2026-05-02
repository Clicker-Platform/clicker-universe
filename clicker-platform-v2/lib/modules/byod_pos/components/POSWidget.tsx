'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
import { logger } from '@/lib/logger-edge';
import { POSSettings } from '@/lib/modules/byod_pos/types';
import { useSearchParams } from 'next/navigation';
import { CartProvider } from '../cart-context';
import { useReceiptPrinter } from '@/lib/modules/byod_pos/hooks/useReceiptPrinter';
import { useSite } from '@/lib/site-context'; // New import
import { useTemplate } from '@/components/TemplateProvider';

interface POSWidgetProps {
    initialItems?: any[];
    settings?: POSSettings;
    onCartOpenChange?: (open: boolean) => void;
}

export function POSWidget({ initialItems, settings: propSettings, onCartOpenChange }: POSWidgetProps) {
    const { siteId } = useSite();
    const { theme } = useTemplate();
    const { items, total, itemCount, removeFromCart, updateQuantity, clearCart, taxBreakdown } = useCart();

    const isGlass = theme.decorations?.surfaceStyle === 'glass' || theme.cardStyle === 'glass';
    const surfaceBg = isGlass ? 'rgba(20,20,20,0.9)' : (theme.colors.surfaceElevated || theme.colors.surface || '#ffffff');
    const surfaceElevated = isGlass ? 'rgba(30,30,30,0.95)' : (theme.colors.surfaceElevated || '#ffffff');
    const borderColor = isGlass ? 'rgba(255,255,255,0.1)' : (theme.colors.border || '#e5e7eb');
    const subtleText = theme.colors.textSubtle || theme.colors.muted || theme.colors.foreground;
    const primaryColor = theme.colors.primary;
    const accentFg = theme.colors.accentForeground || '#ffffff';
    const { trackOrder, activeOrderIds, orders, clearCompletedOrders, user } = useOrderTracker();
    const { printReceipt } = useReceiptPrinter();
    const [successOrder, setSuccessOrder] = useState<any | null>(null);

    const [mounted, setMounted] = useState(false);
    const [isCartOpen, setIsCartOpenRaw] = useState(false);
    const setIsCartOpen = (open: boolean) => { setIsCartOpenRaw(open); onCartOpenChange?.(open); };
    const [isCheckingOut, setIsCheckingOut] = useState(false);
    const [member, setMember] = useState<Member | null>(null);
    const [settings, setSettings] = useState<POSSettings | null>(propSettings || null); // Use prop if available
    const [manualTableNumber, setManualTableNumber] = useState(''); // NEW STATE
    const searchParams = useSearchParams();
    const tableParam = searchParams.get('table');

    const [loadingSettings, setLoadingSettings] = useState(!propSettings); // Loading if no prop

    useEffect(() => { setMounted(true); return () => setMounted(false); }, []);

    // Initial Settings Load if not provided via props
    useEffect(() => {
        if (!propSettings) {
            if (siteId) {
                getPOSSettings(siteId).then((data) => {
                    setSettings(data);
                    setLoadingSettings(false);
                });
            }
        } else {
            // If propSettings changes, update state
            setSettings(propSettings);
            setLoadingSettings(false);
        }
    }, [siteId, propSettings]);


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
            logger.error('pos.order.failed', { siteId, error: e });
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
                <MenuGrid initialItems={initialItems} initialSettings={settings} />
            </div>

            {/* Floating Cart Button — portaled to escape <main> stacking context */}
            {mounted && itemCount > 0 && createPortal(
                <div className="fixed bottom-20 md:bottom-6 inset-x-0 z-[55] flex justify-center px-4 pointer-events-none">
                    <button
                        onClick={() => setIsCartOpen(true)}
                        className="rounded-full shadow-2xl w-full max-w-md py-4 px-6 flex items-center justify-between pointer-events-auto transform transition-all duration-200 active:scale-95 hover:scale-[1.02]"
                        style={{ backgroundColor: primaryColor, color: accentFg }}
                    >
                        <div className="flex items-center gap-3">
                            <div className="font-black w-8 h-8 rounded-full flex items-center justify-center text-sm"
                                style={{ backgroundColor: 'rgba(255,255,255,0.25)', color: accentFg }}>
                                {itemCount}
                            </div>
                            <span className="font-bold">View Cart</span>
                        </div>
                        <span className="font-bold text-lg">
                            {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(total)}
                        </span>
                    </button>
                </div>,
                document.body
            )}

            {/* Cart Modal / Drawer — portaled to escape <main> stacking context */}
            {mounted && isCartOpen && createPortal(
                <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex justify-end">
                    <div className="w-full max-w-md h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300"
                        style={{ backgroundColor: surfaceBg }}>
                        <div className="p-4 border-b flex items-center justify-between"
                            style={{ borderColor, backgroundColor: isGlass ? 'rgba(255,255,255,0.05)' : (theme.colors.surface || '#f9fafb') }}>
                            <h2 className="font-black text-xl uppercase" style={{ color: theme.colors.foreground }}>Your Order</h2>
                            <button onClick={() => setIsCartOpen(false)}
                                className="p-2 rounded-full hover:opacity-70 transition-opacity"
                                style={{ color: theme.colors.foreground }}>
                                <X size={24} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {/* Previous Items (if adding to existing) */}
                            {hasActiveOpenBill && activeOrder && activeOrder.items.length > 0 && (
                                <div className="mb-6 pb-6 border-b border-dashed" style={{ borderColor }}>
                                    <div className="flex items-center gap-2 mb-3 font-bold text-xs uppercase tracking-wider" style={{ color: subtleText }}>
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: primaryColor }}></div>
                                        Previously Ordered
                                    </div>
                                    <div className="space-y-3 opacity-75">
                                        {activeOrder.items.map((item, idx) => (
                                            <div key={`prev-${idx}`} className="flex justify-between items-start text-sm">
                                                <div className="flex gap-2">
                                                    <span className="font-black" style={{ color: subtleText }}>{item.quantity}x</span>
                                                    <span className="font-medium" style={{ color: theme.colors.foreground }}>{item.name} {item.variantName && `(${item.variantName})`}</span>
                                                </div>
                                                <span className="font-bold" style={{ color: subtleText }}>
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
                                    <div className="w-16 h-16 overflow-hidden flex-shrink-0"
                                        style={{ backgroundColor: isGlass ? 'rgba(255,255,255,0.08)' : (theme.colors.surface || '#f3f4f6'), borderRadius: 'calc(var(--theme-radius) * 0.65)' }}>
                                        {item.image && <img src={item.image} className="w-full h-full object-cover" />}
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-bold line-clamp-1" style={{ color: theme.colors.foreground }}>
                                            {item.name}
                                            {item.variantName && <span className="text-sm font-normal ml-1" style={{ color: subtleText }}>({item.variantName})</span>}
                                        </h4>
                                        <div className="text-sm font-black" style={{ color: primaryColor }}>
                                            {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(item.price)}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 p-1"
                                        style={{ backgroundColor: isGlass ? 'rgba(255,255,255,0.08)' : (theme.colors.surface || '#f3f4f6'), borderRadius: 'calc(var(--theme-radius) * 0.5)' }}>
                                        <button onClick={() => updateQuantity(item.productId, -1, item.variantId)}
                                            className="w-8 h-8 flex items-center justify-center font-bold rounded hover:opacity-70 transition-opacity"
                                            style={{ color: subtleText }}>
                                            <Minus size={16} />
                                        </button>
                                        <span className="font-bold w-4 text-center" style={{ color: theme.colors.foreground }}>{item.quantity}</span>
                                        <button onClick={() => updateQuantity(item.productId, 1, item.variantId)}
                                            className="w-8 h-8 flex items-center justify-center font-bold rounded hover:opacity-70 transition-opacity"
                                            style={{ color: primaryColor }}>
                                            <Plus size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="p-4 border-t space-y-4"
                            style={{ borderColor, backgroundColor: isGlass ? 'rgba(255,255,255,0.05)' : (theme.colors.surface || '#f9fafb') }}>
                            <POSMemberLookup
                                selectedMember={member}
                                onMemberSelect={setMember}
                            />

                            {/* Table Number Input */}
                            {settings?.requireTableNumber && !tableParam && !hasActiveOpenBill && (
                                <div>
                                    <label className="block text-xs font-bold uppercase mb-1" style={{ color: subtleText }}>
                                        Table Number <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Enter Table Number"
                                        value={manualTableNumber}
                                        onChange={(e) => setManualTableNumber(e.target.value)}
                                        className="w-full p-3 border font-bold focus:outline-none transition-all"
                                        style={{ backgroundColor: surfaceElevated, borderColor, color: theme.colors.foreground, borderRadius: 'calc(var(--theme-radius) * 0.75)' }}
                                    />
                                </div>
                            )}

                            <div className="space-y-2 mb-4">
                                <div className="flex justify-between items-center text-sm" style={{ color: subtleText }}>
                                    <span>Subtotal</span>
                                    <span>{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(taxBreakdown?.subtotal || total)}</span>
                                </div>
                                {taxBreakdown?.serviceCharge > 0 && (
                                    <div className="flex justify-between items-center text-sm" style={{ color: subtleText }}>
                                        <span>Service Charge ({taxBreakdown.serviceChargeRate}%)</span>
                                        <span>{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(taxBreakdown.serviceCharge)}</span>
                                    </div>
                                )}
                                {taxBreakdown?.restaurantTax > 0 && (
                                    <div className="flex justify-between items-center text-sm" style={{ color: subtleText }}>
                                        <span>PB1 ({taxBreakdown.restaurantTaxRate}%)</span>
                                        <span>{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(taxBreakdown.restaurantTax)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between items-center pt-2 border-t" style={{ borderColor }}>
                                    <span className="font-bold" style={{ color: theme.colors.foreground }}>Total</span>
                                    <span className="text-2xl font-black" style={{ color: primaryColor }}>
                                        {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(total)}
                                    </span>
                                </div>
                            </div>

                            <button
                                onClick={handleAction}
                                disabled={isCheckingOut || loadingSettings}
                                className="w-full py-4 font-bold text-lg disabled:opacity-50 flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                                style={{ backgroundColor: primaryColor, color: accentFg, borderRadius: 'calc(var(--theme-radius) * 0.75)' }}
                            >
                                {isCheckingOut || loadingSettings ? 'Processing...' : (
                                    <>
                                        <ShoppingBag size={20} />
                                        {hasActiveOpenBill ? `Add to Open Bill` : 'Start Order'}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            , document.body)}

            {/* Success Modal — portaled to escape <main> stacking context */}
            {mounted && successOrder && createPortal(
                <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="shadow-xl w-full max-w-sm p-6 text-center"
                        style={{ backgroundColor: surfaceBg, borderRadius: 'var(--theme-radius)' }}>
                        <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4"
                            style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }}>
                            <ShoppingBag size={32} />
                        </div>
                        <h3 className="text-2xl font-black mb-2" style={{ color: theme.colors.foreground }}>Order Placed!</h3>
                        <p className="mb-6" style={{ color: subtleText }}>
                            Order #{successOrder.id.slice(-4)} has been successfully created.
                        </p>

                        <div className="space-y-3">
                            <button
                                onClick={() => printReceipt(successOrder, settings || undefined)}
                                className="w-full py-3 font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                                style={{ backgroundColor: primaryColor, color: accentFg, borderRadius: 'calc(var(--theme-radius) * 0.75)' }}
                            >
                                Print Receipt
                            </button>
                            <button
                                onClick={() => setSuccessOrder(null)}
                                className="w-full py-3 font-bold text-sm border hover:opacity-70 transition-opacity"
                                style={{ backgroundColor: 'transparent', borderColor, color: theme.colors.foreground, borderRadius: 'calc(var(--theme-radius) * 0.75)' }}
                            >
                                New Order
                            </button>
                        </div>
                    </div>
                </div>
            , document.body)}
        </div>
    );
}

import { OrderTrackerProvider } from '../order-tracker-context';
import { OrderTracker } from './OrderTracker';

export function POSBlock(props: POSWidgetProps) {
    const { siteId } = useSite();

    if (!siteId) {
        return <div className="p-4 text-center">Loading...</div>;
    }

    return (
        <OrderTrackerProvider siteId={siteId}>
            <CartProvider>
                <POSWidgetWithTracker {...props} />
            </CartProvider>
        </OrderTrackerProvider>
    );
}

// Renders POSWidget + OrderTracker together so tracker can be hidden when cart is open
function POSWidgetWithTracker(props: POSWidgetProps) {
    const [isCartOpen, setIsCartOpenState] = useState(false);

    return (
        <>
            <POSWidget {...props} onCartOpenChange={setIsCartOpenState} />
            <OrderTracker hidden={isCartOpen} />
        </>
    );
}
