import { ModuleDefinition } from './types';

// Strict Parity with Properti
export const STATIC_MODULE_DEFINITIONS: Record<string, Partial<ModuleDefinition>> = {
    'byod_pos': {
        adminRoutes: [
            { label: 'Catalog', path: '/admin/pos/menu', icon: 'clipboard-list', componentKey: 'byod_pos:AdminMenu' },
            { label: 'Orders', path: '/admin/pos/orders', icon: 'shopping-bag', componentKey: 'byod_pos:AdminOrders' },
            { label: 'Cashier', path: '/admin/pos/cashier', icon: 'monitor-dot', componentKey: 'byod_pos:Cashier', hidden: true },
            { label: 'KDS', path: '/admin/pos/kds', icon: 'utensils', componentKey: 'byod_pos:KDS', hidden: true },
            { label: 'Transactions', path: '/admin/pos/transactions', icon: 'credit-card', componentKey: 'byod_pos:Transactions', hidden: true },
            { label: 'Settings', path: '/admin/pos/settings', icon: 'settings', permission: 'settings', componentKey: 'byod_pos:AdminSettings' },
            { label: 'Reports', path: '/admin/pos/reports', icon: 'file-text', permission: 'view_reports', componentKey: 'byod_pos:AdminOrders' } // Placeholder
        ]
    },
    'membership': {
        adminRoutes: [
            { label: 'Members', path: '/admin/membership/list', icon: 'users', componentKey: 'membership:MemberListPage' },
            { label: 'Member Details', path: '/admin/membership/details', icon: 'user', componentKey: 'membership:MemberDetailsPage', hidden: true },
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
            { label: 'Bookings', path: '/admin/reservation/bookings', icon: 'calendar', componentKey: 'reservation:Dashboard' },
            { label: 'Services', path: '/admin/reservation/services', icon: 'list', componentKey: 'reservation:ServiceList' },
            { label: 'Staff', path: '/admin/reservation/staff', icon: 'users', componentKey: 'reservation:AdminStaff', hidden: true },
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
