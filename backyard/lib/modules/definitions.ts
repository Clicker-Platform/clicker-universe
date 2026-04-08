import { ModuleDefinition } from './types';

// Strict Parity with Properti
export const STATIC_MODULE_DEFINITIONS: Record<string, Partial<ModuleDefinition>> = {
    'byod_pos': {
        displayName: 'Self Order',
        description: 'BYOD POS System',
        adminRoutes: [
            { path: '/admin/pos/cashier', label: 'Cashier Station', icon: 'credit-card', componentKey: 'byod_pos:Cashier' },
            { path: '/admin/pos/kitchen', label: 'Kitchen Display', icon: 'monitor-dot', componentKey: 'byod_pos:KDS' },
            { path: '/admin/pos/history', label: 'Transactions', icon: 'clipboard-list', componentKey: 'byod_pos:Transactions' },
            { path: '/admin/pos/menu', label: 'Menu Manager', icon: 'utensils', componentKey: 'byod_pos:AdminMenu' },
            { path: '/admin/pos/settings', label: 'Configuration', icon: 'settings', componentKey: 'byod_pos:AdminSettings' }
        ]
    },
    'membership': {
        displayName: 'Membership & Loyalty',
        description: 'Customer loyalty program, points, and member management.',
        adminRoutes: [
            { path: '/admin/membership', label: 'Members', icon: 'user', componentKey: 'membership:MemberListPage' },
            { path: '/admin/membership/details', label: 'Member Details', hidden: true, componentKey: 'membership:MemberDetailsPage' },
            { path: '/admin/membership/settings', label: 'Settings', hidden: true, componentKey: 'membership:Settings' }
        ]
    },
    'inventory': {
        displayName: 'Inventory',
        description: 'Stock management',
        adminRoutes: [
            { path: '/admin/inventory', label: 'Stock', icon: 'box', componentKey: 'inventory:AdminDashboard' }
        ]
    },
    'reservation': {
        displayName: 'Reservation',
        description: 'Booking system',
        adminRoutes: [
            { path: '/admin/reservation', label: 'Bookings', icon: 'calendar', componentKey: 'reservation:Dashboard' },
            { path: '/admin/reservation/services', label: 'Services', icon: 'list', componentKey: 'reservation:AdminServices' },
            { path: '/admin/reservation/staff', label: 'Resources', icon: 'user', componentKey: 'reservation:AdminStaff', hidden: true },
            { path: '/admin/reservation/calendar', label: 'Calendar Settings', icon: 'calendar', componentKey: 'reservation:AdminBookings', hidden: true }
        ]
    },
    'ai_sales': {
        displayName: 'AI Sales Agent',
        description: 'Auto-reply agent for customer inquiries.',
        adminRoutes: [
            { path: '/admin/ai-sales', label: 'Dashboard', icon: 'layout-dashboard', componentKey: 'ai_sales:AdminSettings' },
            { path: '/admin/ai-sales/settings', label: 'Settings', icon: 'settings', componentKey: 'ai_sales:AdminSettings' }
        ]
    },
    'sales_pipeline': {
        displayName: 'Sales Pipeline',
        description: 'CRM Kanban board for tracking leads through custom pipeline stages.',
        adminRoutes: [
            { path: '/admin/sales-pipeline/board', label: 'Pipeline Board', icon: 'trophy', componentKey: 'sales_pipeline:PipelinePage' },
            { path: '/admin/sales-pipeline/settings', label: 'Settings', icon: 'settings', componentKey: 'sales_pipeline:SettingsPage' }
        ]
    },
    'service_records': {
        displayName: 'Service Records',
        description: 'Vehicle service records, warranty cards, and reminder engine.',
        adminRoutes: [
            { path: '/admin/service-records/records',       label: 'Service Records', icon: 'clipboard-list', componentKey: 'service_records:RecordsListPage' },
            { path: '/admin/service-records/vehicles',      label: 'Vehicles',        icon: 'car',            componentKey: 'service_records:VehiclesPage' },
            { path: '/admin/service-records/service-types', label: 'Service Types',   icon: 'wrench',         componentKey: 'service_records:ServiceTypesPage', permission: 'settings' },
            { path: '/admin/service-records/reminders',     label: 'Reminders',       icon: 'bell',           componentKey: 'service_records:RemindersPage',    permission: 'settings' },
            { path: '/admin/service-records/settings',      label: 'Settings',        icon: 'settings',       componentKey: 'service_records:SettingsPage',     permission: 'settings' },
        ]
    },
};

// Helper for UI iterators (Backyard)
export const SYSTEM_MODULES = Object.entries(STATIC_MODULE_DEFINITIONS).map(([id, def]) => ({
    id,
    displayName: def.displayName || id,
    description: def.description || 'Module',
    ...def
}));
