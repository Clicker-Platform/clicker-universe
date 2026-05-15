'use client';

import React, { useState, useEffect, createContext, useContext, ReactNode } from 'react';

interface AdminThemeContextType {
    isDark: boolean;
    toggle: () => void;
}

const AdminThemeContext = createContext<AdminThemeContextType | undefined>(undefined);

export function AdminThemeProvider({ children }: { children: ReactNode }): React.ReactElement {
    const [isDark, setIsDark] = useState(false);

    useEffect(() => {
        const saved = localStorage.getItem('admin_dark_mode');
        if (saved === 'true') Promise.resolve().then(() => setIsDark(true));
    }, []);

    const toggle = () => {
        const next = !isDark;
        setIsDark(next);
        localStorage.setItem('admin_dark_mode', String(next));
    };

    return (
        <AdminThemeContext.Provider value={{ isDark, toggle }}>
            {children}
        </AdminThemeContext.Provider>
    );
}

export function useAdminTheme() {
    const context = useContext(AdminThemeContext);
    if (context === undefined) {
        // Fallback or Error? 
        // For admin dashboard, we expect it to be wrapped.
        // But let's return a safe fallback to prevent crashes if used outside.
        return { isDark: false, toggle: () => { } };
    }
    return context;
}
