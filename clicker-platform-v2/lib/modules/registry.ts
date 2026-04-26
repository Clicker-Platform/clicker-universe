import {
    LayoutDashboard,
    Inbox,
    Link as LinkIcon,
    FileText,
    ShoppingBag,
    Map as MapIcon,
    Palette,
    User,
    Settings,
    Calendar,
    CreditCard,
    Box,
    Utensils,
    QrCode,
    Store,
    ClipboardList,
    Monitor,
    Trophy,
    Car,
    Wrench,
    Bell,
    Users,
    Plus,
    BarChart3,
    Bot,
    ImageIcon,
    ScanLine,
    Vault,
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { PublicRouteDefinition, ModuleDefinition, AdminRoute } from './types';
import { getDoc, getDocs, doc } from 'firebase/firestore';
import { STATIC_MODULE_DEFINITIONS } from './definitions';
import { logger } from '@/lib/logger-edge';

export async function findModuleForRoute(path: string): Promise<{ module: ModuleDefinition, route: PublicRouteDefinition } | null> {
    try {
        // Improve: Caching strategy could be implemented here to avoid frequent DB hits
        const q = query(collection(db, 'modules'), where('enabled', '==', true));
        const querySnapshot = await getDocs(q);

        for (const doc of querySnapshot.docs) {
            const mod = { id: doc.id, ...doc.data() } as ModuleDefinition;
            if (mod.publicRoutes) {
                const route = mod.publicRoutes.find(r => r.path === path);
                if (route) {
                    return { module: mod, route };
                }
            }
        }
        return null;
    } catch (error) {
        logger.error('registry.module.route.failed', { siteId: 'platform', error });
        return null; // Fallback to allow page to continue
    }
}

export async function findModuleForAdminRoute(path: string): Promise<{ module: ModuleDefinition, route: AdminRoute } | null> {
    // Fast path: resolve from static definitions without hitting Firestore
    for (const [moduleId, staticDef] of Object.entries(STATIC_MODULE_DEFINITIONS)) {
        const route = staticDef.adminRoutes?.find(r => r.path === path);
        if (route) {
            // Verify the module is enabled via Firestore (single doc read, not a collection scan)
            const docSnap = await getDoc(doc(db, 'modules', moduleId));
            if (docSnap.exists() && docSnap.data().enabled === true) {
                return {
                    module: { id: moduleId, ...docSnap.data() } as ModuleDefinition,
                    route,
                };
            }
            return null;
        }
    }

    // Fallback: scan Firestore for dynamically registered routes not in static definitions
    const q = query(collection(db, 'modules'), where('enabled', '==', true));
    const querySnapshot = await getDocs(q);

    for (const docItem of querySnapshot.docs) {
        const mod = { id: docItem.id, ...docItem.data() } as ModuleDefinition;
        const route = mod.adminRoutes?.find(r => r.path === path);
        if (route) {
            return { module: mod, route };
        }
    }
    return null;
}

export async function isModuleEnabled(moduleId: string): Promise<boolean> {
    try {
        const docRef = doc(db, 'modules', moduleId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return docSnap.data().enabled === true;
        }
    } catch (error) {
        logger.error('registry.module.status.failed', { siteId: 'platform', error, moduleId });
    }
    return false;
}


// Map string keys to actual Icon components
// This allows we to store "icon": "calendar" in Firestore
export const MODULE_ICONS: Record<string, any> = {
    'dashboard': LayoutDashboard,
    'inbox': Inbox,
    'link': LinkIcon,
    'file-text': FileText,
    'shopping-bag': ShoppingBag,
    'map': MapIcon,
    'palette': Palette,
    'user': User,
    'settings': Settings,
    'calendar': Calendar,
    'credit-card': CreditCard,
    'box': Box,
    'utensils': Store, // Overridden for Universal POS
    'qr-code': QrCode,
    'store': Store,
    'clipboard-list': ClipboardList,
    'monitor-dot': Monitor,
    'trophy': Trophy,
    'sales-pipeline': Trophy,
    'car': Car,
    'wrench': Wrench,
    'bell': Bell,
    'users': Users,
    'plus': Plus,
    'bar-chart-3': BarChart3,
    'bot': Bot,
    'image': ImageIcon,
    'scan-line': ScanLine,
    'vault': Vault,
};

/**
 * Subscribes to all enabled modules in Firestore.
 * @param callback Function to call with the list of modules
 * @returns Unsubscribe function
 */
export function subscribeToEnabledModules(callback: (modules: ModuleDefinition[]) => void): Unsubscribe {
    const q = query(
        collection(db, 'modules'),
        where('enabled', '==', true)
    );

    return onSnapshot(q, (snapshot) => {
        const modules = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as ModuleDefinition));
        callback(modules);
    }, (error) => {
        logger.error('registry.modules.fetch.failed', { siteId: 'platform', error });
        callback([]); // Fallback to empty on error
    });
}

export async function findModuleForBlock(blockType: string): Promise<{ module: ModuleDefinition, componentKey: string } | null> {
    // Only search enabled modules
    const q = query(collection(db, 'modules'), where('enabled', '==', true));
    const querySnapshot = await getDocs(q);

    for (const doc of querySnapshot.docs) {
        const mod = { id: doc.id, ...doc.data() } as ModuleDefinition;
        // Check if module has blocks and one of them matches the requested type
        if (mod.blocks) {
            const blockDef = mod.blocks.find(b => b.type === blockType);
            if (blockDef && blockDef.componentKey) {
                return { module: mod, componentKey: blockDef.componentKey };
            }
        }
    }
    return null;
}

export async function findWidgetsForLocation(location: string): Promise<{ module: ModuleDefinition, componentKey: string, priority: number }[]> {
    const q = query(collection(db, 'modules'), where('enabled', '==', true));
    const querySnapshot = await getDocs(q);

    const widgets: { module: ModuleDefinition, componentKey: string, priority: number }[] = [];

    querySnapshot.docs.forEach(doc => {
        const mod = { id: doc.id, ...doc.data() } as ModuleDefinition;
        // Safe check for array
        if (mod.dashboardWidgets && Array.isArray(mod.dashboardWidgets)) {
            mod.dashboardWidgets.filter(w => w.location === location).forEach(w => {
                widgets.push({
                    module: mod,
                    componentKey: w.componentKey,
                    priority: w.priority || 10
                });
            });
        }
    });

    // Sort by priority (higher first)
    return widgets.sort((a, b) => b.priority - a.priority);
}

export function getRouteIdFromPath(moduleId: string, path: string): string {
    if (!path) return 'main';

    const segments = path.split('/').filter(Boolean);
    const lastSegment = segments[segments.length - 1];

    if (!lastSegment) return 'main';

    return lastSegment;
}
