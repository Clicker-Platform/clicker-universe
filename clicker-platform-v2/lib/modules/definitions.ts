import { ModuleDefinition } from './types';

// Strict Parity with Properti
export const STATIC_MODULE_DEFINITIONS: Record<string, Partial<ModuleDefinition>> = {
    'byod_pos': {
        adminRoutes: [
            { label: 'Catalog', path: '/admin/pos/menu', icon: 'clipboard-list', componentKey: 'byod_pos:AdminMenu' },
            { label: 'Orders', path: '/admin/pos/orders', icon: 'shopping-bag', componentKey: 'byod_pos:AdminOrders' },
            { label: 'Settings', path: '/admin/pos/settings', icon: 'settings', permission: 'settings', componentKey: 'byod_pos:AdminSettings' },
            { label: 'Reports', path: '/admin/pos/reports', icon: 'file-text', permission: 'view_reports', componentKey: 'byod_pos:AdminOrders' } // Placeholder
        ]
    },
    'membership': {
        adminRoutes: [
            { label: 'Members', path: '/admin/membership/list', icon: 'users', componentKey: 'membership:MemberListPage' },
            { label: 'Settings', path: '/admin/membership/settings', icon: 'settings', permission: 'settings', componentKey: 'membership:Settings' }
        ]
    },
    'inventory': {
        adminRoutes: [
            { label: 'Items', path: '/admin/inventory/items', icon: 'box', componentKey: 'inventory:AdminDashboard' }
        ]
    },
    'reservation': {
        adminRoutes: [
            { label: 'Bookings', path: '/admin/reservation/bookings', icon: 'calendar', componentKey: 'reservation:AdminBookingWizard' },
            { label: 'Services', path: '/admin/reservation/services', icon: 'list', componentKey: 'reservation:ServiceList' },
            { label: 'Settings', path: '/admin/reservation/settings', icon: 'settings', permission: 'settings', componentKey: 'reservation:Settings' }
        ]
    },
    'ai_sales': {
        adminRoutes: [
            { label: 'Overview', path: '/admin/ai-sales', icon: 'bot', componentKey: 'ai_sales:Dashboard' },
            { label: 'Settings', path: '/admin/ai-sales/settings', icon: 'settings', componentKey: 'ai_sales:AdminSettings' }
        ]
    }
};
