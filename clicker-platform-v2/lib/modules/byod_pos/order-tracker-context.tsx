'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { db, auth } from '@/lib/firebase';
import { doc, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { signInAnonymously, onAuthStateChanged, User } from 'firebase/auth';
import { toast } from 'sonner';
import { POSOrder } from './types';

interface OrderTrackerContextType {
    activeOrderIds: string[];
    orders: POSOrder[];
    trackOrder: (orderId: string) => void;
    dismissOrder: (orderId: string) => void;
    clearCompletedOrders: () => void;
    user: User | null;
    isTrackerOpen: boolean;
    setIsTrackerOpen: (isOpen: boolean) => void;
}

const OrderTrackerContext = createContext<OrderTrackerContextType | undefined>(undefined);

export function OrderTrackerProvider({ children, siteId }: { children: React.ReactNode; siteId: string }) {
    const [activeOrderIds, setActiveOrderIds] = useState<string[]>([]);
    const [orders, setOrders] = useState<POSOrder[]>([]);
    const [user, setUser] = useState<User | null>(null);
    const [isTrackerOpen, setIsTrackerOpen] = useState(false);

    // Per-order snapshot subscriptions — keyed by orderId
    const unsubsRef = useRef<Record<string, Unsubscribe>>({});
    // Orders we've already shown a cancel toast for — prevents duplicate toasts on re-render
    const dismissedRef = useRef<Set<string>>(new Set());
    // Keep a stable ref to siteId for use inside snapshot callbacks
    const siteIdRef = useRef(siteId);
    useEffect(() => { siteIdRef.current = siteId; }, [siteId]);

    // 1. Anonymous Auth & LocalStorage load
    useEffect(() => {
        try {
            const saved = localStorage.getItem('byod_active_orders');
            if (saved) setActiveOrderIds(JSON.parse(saved));
        } catch (e) {
            console.error('Failed to load tracked orders', e);
        }

        const unsubAuth = onAuthStateChanged(auth, (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
            } else {
                signInAnonymously(auth).catch((e) => {
                    console.error('Anonymous Auth Failed:', e);
                });
            }
        });

        return () => unsubAuth();
    }, []);

    // 2. Persist activeOrderIds to LocalStorage
    useEffect(() => {
        localStorage.setItem('byod_active_orders', JSON.stringify(activeOrderIds));
    }, [activeOrderIds]);

    // 3. Subscribe to new order IDs, unsubscribe from removed ones — individually
    //    so cancelling one order never disrupts listeners for others.
    useEffect(() => {
        if (!user || !siteId || siteId === 'default' || siteId === 'pending') return;

        const currentIds = new Set(activeOrderIds);
        const subscribedIds = new Set(Object.keys(unsubsRef.current));

        // Unsubscribe orders that are no longer active
        subscribedIds.forEach(id => {
            if (!currentIds.has(id)) {
                unsubsRef.current[id]?.();
                delete unsubsRef.current[id];
            }
        });

        // Subscribe to newly added order IDs
        activeOrderIds.forEach(orderId => {
            if (unsubsRef.current[orderId]) return; // already subscribed

            const unsub = onSnapshot(
                doc(db, 'sites', siteId, 'modules/byod_pos/orders', orderId),
                (docSnap) => {
                    // Document deleted = admin cancelled the order
                    if (!docSnap.exists()) {
                        if (!dismissedRef.current.has(orderId)) {
                            dismissedRef.current.add(orderId);
                            toast.error('Order Cancelled', {
                                description: `Order #${orderId.slice(-4).toUpperCase()} was cancelled.`,
                                duration: 5000,
                            });
                        }
                        unsubsRef.current[orderId]?.();
                        delete unsubsRef.current[orderId];
                        setActiveOrderIds(prev => prev.filter(id => id !== orderId));
                        setOrders(prev => prev.filter(o => o.id !== orderId));
                        return;
                    }

                    const updatedOrder = { id: docSnap.id, ...docSnap.data() } as POSOrder;

                    // Also handle explicit status='cancelled' (future-proofing)
                    if (updatedOrder.status === 'cancelled' && updatedOrder.paymentStatus !== 'paid') {
                        if (!dismissedRef.current.has(orderId)) {
                            dismissedRef.current.add(orderId);
                            toast.error('Order Cancelled', {
                                description: `Order #${orderId.slice(-4).toUpperCase()} was cancelled.`,
                                duration: 5000,
                            });
                        }
                        unsubsRef.current[orderId]?.();
                        delete unsubsRef.current[orderId];
                        setActiveOrderIds(prev => prev.filter(id => id !== orderId));
                        setOrders(prev => prev.filter(o => o.id !== orderId));
                        return;
                    }

                    setOrders(prev => {
                        const others = prev.filter(o => o.id !== orderId);
                        return [...others, updatedOrder].sort(
                            (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
                        );
                    });
                },
                (error) => {
                    if (error.code === 'permission-denied') {
                        console.warn(`Permission denied for order ${orderId}.`);
                    } else {
                        console.error('Order snapshot error:', error);
                    }
                }
            );

            unsubsRef.current[orderId] = unsub;
        });
    }, [activeOrderIds, user, siteId]);

    // Tear down all listeners on unmount
    useEffect(() => {
        return () => {
            Object.values(unsubsRef.current).forEach(unsub => unsub());
        };
    }, []);

    const trackOrder = (orderId: string) => {
        setActiveOrderIds(prev => prev.includes(orderId) ? prev : [...prev, orderId]);
    };

    const dismissOrder = (orderId: string) => {
        unsubsRef.current[orderId]?.();
        delete unsubsRef.current[orderId];
        setActiveOrderIds(prev => prev.filter(id => id !== orderId));
        setOrders(prev => prev.filter(o => o.id !== orderId));
    };

    const clearCompletedOrders = () => {
        const keepIds = orders
            .filter(o => o.paymentStatus !== 'paid' && o.status !== 'cancelled')
            .map(o => o.id);
        // Unsubscribe orders being cleared
        Object.keys(unsubsRef.current).forEach(id => {
            if (!keepIds.includes(id)) {
                unsubsRef.current[id]?.();
                delete unsubsRef.current[id];
            }
        });
        setActiveOrderIds(keepIds);
        setOrders(prev => prev.filter(o => keepIds.includes(o.id)));
    };

    return (
        <OrderTrackerContext.Provider value={{
            activeOrderIds, orders, trackOrder, dismissOrder,
            clearCompletedOrders, user, isTrackerOpen, setIsTrackerOpen
        }}>
            {children}
        </OrderTrackerContext.Provider>
    );
}

export function useOrderTracker() {
    const context = useContext(OrderTrackerContext);
    if (!context) {
        throw new Error('useOrderTracker must be used within an OrderTrackerProvider');
    }
    return context;
}
