import { ModuleDefinition } from './types';

// Strict Parity with clicker-platform-v2/lib/modules/definitions.ts
export const STATIC_MODULE_DEFINITIONS: Record<string, Partial<ModuleDefinition>> = {
    'byod_pos': {
        displayName: 'Self Order',
        description: 'BYOD POS System',
        adminRoutes: [
            { label: 'Cashier',       path: '/admin/pos/cashier',      icon: 'monitor-dot',    componentKey: 'byod_pos:Cashier' },
            { label: 'Kitchen',       path: '/admin/pos/kds',           icon: 'utensils',       componentKey: 'byod_pos:KDS' },
            { label: 'Transactions',  path: '/admin/pos/transactions',  icon: 'credit-card',    componentKey: 'byod_pos:Transactions' },
            { label: 'Menu',          path: '/admin/pos/menu',          icon: 'clipboard-list', componentKey: 'byod_pos:AdminMenu' },
            { label: 'Configuration', path: '/admin/pos/settings',      icon: 'settings',       componentKey: 'byod_pos:AdminSettings', permission: 'settings' },
            { label: 'Reports',       path: '/admin/pos/reports',       icon: 'file-text',      componentKey: 'byod_pos:AdminOrders',   permission: 'view_reports' },
        ]
    },
    'membership': {
        displayName: 'Membership & Loyalty',
        description: 'Customer loyalty program, points, and member management.',
        adminRoutes: [
            { label: 'Members',        path: '/admin/membership/list',     icon: 'users',    componentKey: 'membership:MemberListPage' },
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
    'stocklens': {
        displayName: 'Stocklens',
        description: 'AI-powered product scanner and inventory vault',
        adminRoutes: [
            { label: 'Scanner',  path: '/admin/stocklens/scanner',  icon: 'scan-line', componentKey: 'stocklens:ScannerPage' },
            { label: 'Vault',    path: '/admin/stocklens/vault',    icon: 'vault',     componentKey: 'stocklens:VaultPage' },
            { label: 'Settings', path: '/admin/stocklens/settings', icon: 'settings',  componentKey: 'stocklens:SettingsPage', permission: 'settings' },
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
    'ai_marketing': {
        displayName: 'AI Marketing Workspace',
        description: 'Multi-agent AI content generation for marketing teams.',
        adminRoutes: [
            { path: '/admin/marketing/dashboard',        label: 'Dashboard',       icon: 'dashboard',      componentKey: 'ai_marketing:Dashboard' },
            { path: '/admin/marketing/generate',         label: 'Generate',        icon: 'bot',            componentKey: 'ai_marketing:Generate' },
            { path: '/admin/marketing/assets',           label: 'Assets',          icon: 'image',          componentKey: 'ai_marketing:Assets' },
            { path: '/admin/marketing/campaigns',        label: 'Campaigns',       icon: 'clipboard-list', componentKey: 'ai_marketing:Campaigns' },
            { path: '/admin/marketing/analytics',        label: 'Analytics',       icon: 'bar-chart-3',    componentKey: 'ai_marketing:Analytics' },
            { path: '/admin/marketing/settings',         label: 'Settings',        icon: 'settings',       componentKey: 'ai_marketing:Settings',       permission: 'settings' },
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
