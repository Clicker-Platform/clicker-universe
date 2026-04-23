'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface TopBarSlots {
    left: ReactNode;
    center: ReactNode;
    right: ReactNode;
}

interface TopBarSlotContextValue {
    slots: TopBarSlots;
    setLeftSlot: (node: ReactNode) => void;
    setCenterSlot: (node: ReactNode) => void;
    setRightSlot: (node: ReactNode) => void;
    clearSlots: () => void;
}

const TopBarSlotContext = createContext<TopBarSlotContextValue | null>(null);

export function TopBarSlotProvider({ children }: { children: ReactNode }) {
    const [slots, setSlots] = useState<TopBarSlots>({ left: null, center: null, right: null });

    const setLeftSlot = useCallback((node: ReactNode) => {
        setSlots(prev => ({ ...prev, left: node }));
    }, []);

    const setCenterSlot = useCallback((node: ReactNode) => {
        setSlots(prev => ({ ...prev, center: node }));
    }, []);

    const setRightSlot = useCallback((node: ReactNode) => {
        setSlots(prev => ({ ...prev, right: node }));
    }, []);

    const clearSlots = useCallback(() => {
        setSlots({ left: null, center: null, right: null });
    }, []);

    return (
        <TopBarSlotContext.Provider value={{ slots, setLeftSlot, setCenterSlot, setRightSlot, clearSlots }}>
            {children}
        </TopBarSlotContext.Provider>
    );
}

export function useTopBarSlots() {
    const ctx = useContext(TopBarSlotContext);
    if (!ctx) throw new Error('useTopBarSlots must be used within TopBarSlotProvider');
    return ctx;
}
