'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { db, auth } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { signInAnonymously, onAuthStateChanged, User } from 'firebase/auth';
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

    // 1. Anonymous Auth & LocalStorage Load
    useEffect(() => {
        // Load IDs
        try {
            const saved = localStorage.getItem('byod_active_orders');
            if (saved) {
                setActiveOrderIds(JSON.parse(saved));
            }
        } catch (e) {
            console.error('Failed to load tracked orders', e);
        }

        // Anonymous Sign In
        const unsubAuth = onAuthStateChanged(auth, (currentUser) => {
            if (currentUser) {
                console.log("Anonymous Auth: Signed in as", currentUser.uid);
                setUser(currentUser);
            } else {
                console.log("Anonymous Auth: Signing in...");
                signInAnonymously(auth).catch((e) => {
                    console.error("Anonymous Auth Failed:", e);
                });
            }
        });

        return () => unsubAuth();
    }, []);

    // 2. Persist to LocalStorage whenever IDs change
    useEffect(() => {
        localStorage.setItem('byod_active_orders', JSON.stringify(activeOrderIds));
    }, [activeOrderIds]);

    // 3. Listen to Firestore for each active order
    useEffect(() => {
        // Wait for auth to be ready and siteId
        if (!user || !siteId || siteId === 'default' || siteId === 'pending' || activeOrderIds.length === 0) {
            setOrders([]);
            return;
        }

        const unsubscribers = activeOrderIds.map(orderId => {
            return onSnapshot(doc(db, 'sites', siteId, 'modules/byod_pos/orders', orderId), (docSnap) => {
                if (docSnap.exists()) {
                    setOrders(prev => {
                        const others = prev.filter(o => o.id !== orderId);
                        const data = docSnap.data();

                        // Basic data mapping
                        const updatedOrder = {
                            id: docSnap.id,
                            ...data
                        } as POSOrder;

                        return [...others, updatedOrder].sort((a, b) =>
                            // Sort by createdAt desc (newest first)
                            (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
                        );
                    });
                }
            }, (error) => {
                // Gracefully handle permission errors
                if (error.code === 'permission-denied') {
                    console.warn(`Permission denied for order ${orderId}. Waiting for auth or order might be closed.`);
                } else {
                    console.error("Order snapshot error:", error);
                }
            });
        });

        return () => {
            unsubscribers.forEach(unsub => unsub());
        };
    }, [activeOrderIds, user, siteId]);

    const trackOrder = (orderId: string) => {
        setActiveOrderIds(prev => {
            if (prev.includes(orderId)) return prev;
            return [...prev, orderId];
        });
    };

    const dismissOrder = (orderId: string) => {
        setActiveOrderIds(prev => prev.filter(id => id !== orderId));
        setOrders(prev => prev.filter(o => o.id !== orderId));
    };

    const clearCompletedOrders = () => {
        // FIX: Only remove orders that are PAID or Cancelled. 
        // Do NOT remove orders that are 'completed' (kitchen done) but 'unpaid'.
        const activeIds = orders.filter(o => o.paymentStatus !== 'paid' && o.status !== 'cancelled').map(o => o.id);
        setActiveOrderIds(activeIds);
        setOrders(prev => prev.filter(o => activeIds.includes(o.id)));
    };

    return (
        <OrderTrackerContext.Provider value={{ activeOrderIds, orders, trackOrder, dismissOrder, clearCompletedOrders, user, isTrackerOpen, setIsTrackerOpen }}>
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
