'use client';

import { createContext, useContext, ReactNode } from 'react';
import { useUser } from '@/lib/user-context';
import { Lock } from 'lucide-react';

interface PermissionContextType {
    isViewOnly: boolean;
}

const PermissionContext = createContext<PermissionContextType>({
    isViewOnly: false
});

export const usePermission = () => useContext(PermissionContext);

interface PermissionGuardProps {
    moduleId: string;
    routeId: string;
    children: ReactNode;
    fallback?: ReactNode;
}

export function PermissionGuard({ moduleId, routeId, children, fallback }: PermissionGuardProps) {
    const { hasAccess, getAccessLevel, loading } = useUser();

    if (loading) return null;

    if (!hasAccess(moduleId, routeId)) {
        if (fallback) return <>{fallback}</>;

        return (
            <div className="flex flex-col items-center justify-center p-12 text-center h-full min-h-[400px]">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <Lock size={32} className="text-gray-400" />
                </div>
                <h2 className="text-xl font-bold text-gray-800 mb-2">Access Denied</h2>
                <p className="text-gray-500 max-w-md">
                    You don't have permission to access this page. Please contact your administrator if you believe this is a mistake.
                </p>
                <div className="mt-4 text-xs text-gray-400 font-mono">
                    Missing Permission: {moduleId}:{routeId}
                </div>
            </div>
        );
    }

    const isViewOnly = getAccessLevel(moduleId, routeId) === 'view';

    return (
        <PermissionContext.Provider value={{ isViewOnly }}>
            {children}
        </PermissionContext.Provider>
    );
}
