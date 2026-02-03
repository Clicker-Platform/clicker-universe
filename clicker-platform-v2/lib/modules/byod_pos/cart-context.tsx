'use client';

import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { CartItem } from './types';

interface CartContextType {
    items: CartItem[];
    addToCart: (item: CartItem) => void;
    removeFromCart: (productId: string, variantId?: string) => void;
    updateQuantity: (productId: string, delta: number, variantId?: string) => void;
    clearCart: () => void;
    total: number; // Keep for backward compatibility
    itemCount: number;
    taxBreakdown: {
        subtotal: number;
        serviceCharge: number;
        restaurantTax: number;
        total: number;
        serviceChargeRate: number;
        restaurantTaxRate: number;
    };
}

const CartContext = createContext<CartContextType | undefined>(undefined);

import { getPOSSettings } from './api';
import { POSSettings } from './types';
import { useSite } from '@/lib/site-context';

export function CartProvider({ children }: { children: ReactNode }) {
    const { siteId } = useSite();
    const [items, setItems] = useState<CartItem[]>([]);
    const [settings, setSettings] = useState<POSSettings | null>(null);

    useEffect(() => {
        if (siteId) {
            getPOSSettings(siteId).then(setSettings);
        }
    }, [siteId]);

    const addToCart = (newItem: CartItem) => {
        setItems(prev => {
            const existing = prev.find(i =>
                i.productId === newItem.productId && i.variantId === newItem.variantId
            );
            if (existing) {
                return prev.map(i =>
                    (i.productId === newItem.productId && i.variantId === newItem.variantId)
                        ? { ...i, quantity: i.quantity + 1 }
                        : i
                );
            }
            return [...prev, newItem];
        });
    };

    const updateQuantity = (productId: string, delta: number, variantId?: string) => {
        setItems(prev => prev.map(item => {
            if (item.productId === productId && item.variantId === variantId) {
                const newQty = Math.max(0, item.quantity + delta);
                return { ...item, quantity: newQty };
            }
            return item;
        }).filter(i => i.quantity > 0));
    };

    const removeFromCart = (productId: string, variantId?: string) => {
        setItems(prev => prev.filter(i => !(i.productId === productId && i.variantId === variantId)));
    };

    const clearCart = () => setItems([]);

    // Calculation Logic
    const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    const serviceRate = (settings?.taxSettings?.serviceCharge?.enabled && settings.taxSettings.serviceCharge.rate)
        ? settings.taxSettings.serviceCharge.rate
        : 0;

    const taxRate = (settings?.taxSettings?.restaurantTax?.enabled && settings.taxSettings.restaurantTax.rate)
        ? settings.taxSettings.restaurantTax.rate
        : 0;

    const serviceCharge = subtotal * (serviceRate / 100);
    const taxBase = subtotal + serviceCharge;
    const restaurantTax = taxBase * (taxRate / 100);
    const total = subtotal + serviceCharge + restaurantTax;

    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

    const taxBreakdown = {
        subtotal,
        serviceCharge,
        restaurantTax,
        total,
        serviceChargeRate: serviceRate,
        restaurantTaxRate: taxRate
    };

    return (
        <CartContext.Provider value={{
            items,
            addToCart,
            removeFromCart,
            updateQuantity,
            clearCart,
            total,
            itemCount,
            taxBreakdown
        }}>
            {children}
        </CartContext.Provider>
    );
}

export function useCart() {
    const context = useContext(CartContext);
    if (!context) throw new Error('useCart must be used within CartProvider');
    return context;
}
