'use client';

import { useState, useEffect, useMemo } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Box, LayoutDashboard, Palette, Layers, MessageCircle } from 'lucide-react';
import { subscribeToEnabledModules, MODULE_ICONS, getRouteIdFromPath } from '@/lib/modules/registry';
import { STATIC_MODULE_DEFINITIONS } from '@/lib/modules/definitions';
import { ModuleDefinition } from '@/lib/modules/types';
import { useSite } from '@/lib/site-context';
import { useUser } from '@/lib/user-context';

export interface NavItem {
    icon: any;
    label: string;
    href: string;
}

export interface NavGroup {
    title: string;
    items: NavItem[];
    isModule: boolean;
    moduleIcon?: any;
}

export function useAdminNavGroups(): NavGroup[] {
    const { siteId, tenantSlug, isSubdomain } = useSite();
    const { permissions: userPermissions, isOwner, hasAccess } = useUser();
    const [modules, setModules] = useState<ModuleDefinition[]>([]);
    const [siteEnabledModules, setSiteEnabledModules] = useState<Record<string, boolean>>({});

    useEffect(() => {
        if (!siteId || siteId === 'default' || siteId === 'pending') return;
        const unsub = onSnapshot(doc(db, 'sites', siteId), (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                const legacy = data.settings?.modules || {};
                const root = data.modules || {};
                setSiteEnabledModules({ ...legacy, ...root });
            }
        });
        return () => unsub();
    }, [siteId]);

    useEffect(() => {
        const unsub = subscribeToEnabledModules((fetched) => setModules(fetched));
        return () => unsub();
    }, []);

    return useMemo(() => {
        const baseUrl = (tenantSlug && !isSubdomain) ? `/${tenantSlug}` : '';
        const hasFullAccess = isOwner || userPermissions.includes('*');

        const allCoreItems = [
            { icon: LayoutDashboard, label: 'Overview', href: `${baseUrl}/admin`, permission: null },
            { icon: Box, label: 'Canvas Studio', href: `${baseUrl}/admin/canvas`, permission: 'biolink' },
            { icon: Palette, label: 'Template', href: `${baseUrl}/admin/template`, permission: 'biolink' },
            { icon: Layers, label: 'Services', href: `${baseUrl}/admin/services`, permission: null },
            { icon: MessageCircle, label: 'WhatsApp', href: `${baseUrl}/admin/whatsapp`, permission: null },
        ];

        const coreItems = allCoreItems.filter(item => {
            if (hasFullAccess) return true;
            if (item.permission === null) return true;
            return userPermissions.includes(item.permission) || userPermissions.includes('biolink');
        });

        const moduleGroups: NavGroup[] = modules
            .map(m => {
                if (!siteEnabledModules[m.id]) return null;
                const staticDef = STATIC_MODULE_DEFINITIONS[m.id];
                const routes = staticDef?.adminRoutes || m.adminRoutes || [];

                const items = routes
                    .filter(r => !r.hidden)
                    .filter(r => {
                        if (r.permission) {
                            if (hasFullAccess) return true;
                            return userPermissions.includes(r.permission as any);
                        }
                        const routeId = getRouteIdFromPath(m.id, r.path);
                        return hasAccess(m.id, routeId);
                    })
                    .map(route => ({
                        icon: MODULE_ICONS[route.icon || ''] || MODULE_ICONS[m.icon] || Box,
                        label: route.label,
                        href: `${baseUrl}${route.path}`,
                    }));

                if (items.length === 0) return null;

                let title = m.displayName || m.id;
                if (title === 'Self Order' || title === 'BYOD POS') title = 'POS';

                return {
                    title,
                    items,
                    isModule: true,
                    moduleIcon: MODULE_ICONS[m.icon] || items[0]?.icon || Box,
                };
            })
            .filter(Boolean) as NavGroup[];

        const coreGroup: NavGroup = { title: 'Core', items: coreItems, isModule: false };
        return [coreGroup, ...moduleGroups].filter(g => g.items.length > 0);
    }, [modules, siteEnabledModules, tenantSlug, isSubdomain, userPermissions, isOwner, hasAccess]);
}
