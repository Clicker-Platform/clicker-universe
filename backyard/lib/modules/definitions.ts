import { ModuleDefinition } from './types';

// Strict Parity with clicker-platform-v2/lib/modules/definitions.ts
export const STATIC_MODULE_DEFINITIONS: Record<string, Partial<ModuleDefinition>> = {
    'byod_pos': {
        displayName: 'Self Order',
        description: 'BYOD POS System',
        adminRoutes: [
            { label: 'Cashier Station', path: '/admin/pos/cashier',      icon: 'monitor-dot',    componentKey: 'byod_pos:Cashier' },
            { label: 'Kitchen Display', path: '/admin/pos/kds',           icon: 'utensils',       componentKey: 'byod_pos:KDS' },
            { label: 'Transactions',    path: '/admin/pos/transactions',  icon: 'credit-card',    componentKey: 'byod_pos:Transactions' },
            { label: 'Menu Manager',    path: '/admin/pos/menu',          icon: 'clipboard-list', componentKey: 'byod_pos:AdminMenu' },
            { label: 'Configuration',   path: '/admin/pos/settings',      icon: 'settings',       componentKey: 'byod_pos:AdminSettings', permission: 'settings' },
            { label: 'Reports',         path: '/admin/pos/reports',       icon: 'file-text',      componentKey: 'byod_pos:AdminOrders',   permission: 'view_reports' },
        ]
    },
    'membership': {
        displayName: 'Membership & Loyalty',
        description: 'Customer loyalty program, points, and member management.',
        adminRoutes: [
            { label: 'Members',        path: '/admin/membership/list',     icon: 'users',    componentKey: 'membership:MemberListPage' },
            { label: 'Member Details', path: '/admin/membership/details',  icon: 'user',     componentKey: 'membership:MemberDetailsPage', hidden: true },
            { label: 'Settings',       path: '/admin/membership/settings', icon: 'settings', componentKey: 'membership:Settings', permission: 'settings' },
        ]
    },
    'inventory': {
        displayName: 'Inventory',
        description: 'Stock management',
        adminRoutes: [
            { label: 'Items', path: '/admin/inventory/items', icon: 'box', componentKey: 'inventory:AdminDashboard' },
        ]
    },
    'reservation': {
        displayName: 'Reservation',
        description: 'Booking system',
        adminRoutes: [
            { label: 'Bookings',  path: '/admin/reservation/bookings',  icon: 'calendar', componentKey: 'reservation:Dashboard' },
            { label: 'Services',  path: '/admin/reservation/services',  icon: 'list',     componentKey: 'reservation:ServiceList' },
            { label: 'Staff',     path: '/admin/reservation/staff',     icon: 'users',    componentKey: 'reservation:AdminStaff', hidden: true },
            { label: 'Settings',  path: '/admin/reservation/settings',  icon: 'settings', componentKey: 'reservation:Settings', permission: 'settings' },
        ]
    },
    'ai_sales': {
        displayName: 'AI Sales Agent',
        description: 'Auto-reply agent for customer inquiries.',
        adminRoutes: [
            { label: 'Overview', path: '/admin/ai-sales',          icon: 'bot',      componentKey: 'ai_sales:Dashboard' },
            { label: 'Settings', path: '/admin/ai-sales/settings', icon: 'settings', componentKey: 'ai_sales:AdminSettings' },
        ]
    },
    'sales_pipeline': {
        displayName: 'Sales Pipeline',
        description: 'CRM Kanban board for tracking leads through custom pipeline stages.',
        adminRoutes: [
            { label: 'Pipeline Board', path: '/admin/sales-pipeline/board',    icon: 'trophy',   componentKey: 'sales_pipeline:PipelinePage' },
            { label: 'Settings',       path: '/admin/sales-pipeline/settings', icon: 'settings', componentKey: 'sales_pipeline:SettingsPage', permission: 'settings' },
        ]
    },
    'service_records': {
        displayName: 'Service Records',
        description: 'Vehicle service records, warranty cards, and reminder engine.',
        adminRoutes: [
            { label: 'Service Records', path: '/admin/service-records/records',         icon: 'clipboard-list', componentKey: 'service_records:RecordsListPage' },
            { label: 'Reports',         path: '/admin/service-records/reports',          icon: 'bar-chart-3',    componentKey: 'service_records:ReportsPage',       permission: 'view_reports' },
            { label: 'New Record',      path: '/admin/service-records/new',             icon: 'plus',           componentKey: 'service_records:RecordFormPage',    hidden: true },
            { label: 'Record Detail',   path: '/admin/service-records/detail',          icon: 'file-text',      componentKey: 'service_records:RecordDetailPage',  hidden: true },
            { label: 'Vehicles',        path: '/admin/service-records/vehicles',         icon: 'car',            componentKey: 'service_records:VehiclesPage' },
            { label: 'Vehicle Detail',  path: '/admin/service-records/vehicles/detail', icon: 'car',            componentKey: 'service_records:VehicleDetailPage', hidden: true },
            { label: 'Service Types',   path: '/admin/service-records/service-types',   icon: 'wrench',         componentKey: 'service_records:ServiceTypesPage',  permission: 'settings' },
            { label: 'Reminders',       path: '/admin/service-records/reminders',       icon: 'bell',           componentKey: 'service_records:RemindersPage',     permission: 'settings' },
            { label: 'Settings',        path: '/admin/service-records/settings',        icon: 'settings',       componentKey: 'service_records:SettingsPage',      permission: 'settings' },
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
