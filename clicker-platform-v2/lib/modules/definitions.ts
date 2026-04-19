import { ModuleDefinition } from './types';

// Strict Parity with Properti
export const STATIC_MODULE_DEFINITIONS: Record<string, Partial<ModuleDefinition>> = {
    'byod_pos': {
        adminRoutes: [
            { label: 'Cashier Station', path: '/admin/pos/cashier', icon: 'monitor-dot', componentKey: 'byod_pos:Cashier' },
            { label: 'Kitchen Display', path: '/admin/pos/kds', icon: 'utensils', componentKey: 'byod_pos:KDS' },
            { label: 'Transactions', path: '/admin/pos/transactions', icon: 'credit-card', componentKey: 'byod_pos:Transactions' },
            { label: 'Menu Manager', path: '/admin/pos/menu', icon: 'clipboard-list', componentKey: 'byod_pos:AdminMenu' },
            { label: 'Configuration', path: '/admin/pos/settings', icon: 'settings', permission: 'settings', componentKey: 'byod_pos:AdminSettings' },
            { label: 'Orders', path: '/admin/pos/reports', icon: 'file-text', permission: 'view_reports', componentKey: 'byod_pos:AdminOrders' }
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
    },
    'sales_pipeline': {
        adminRoutes: [
            { label: 'Pipeline Board', path: '/admin/sales-pipeline/board', icon: 'trophy', componentKey: 'sales_pipeline:PipelinePage' },
            { label: 'Settings', path: '/admin/sales-pipeline/settings', icon: 'settings', permission: 'settings', componentKey: 'sales_pipeline:SettingsPage' }
        ]
    },
    'service_records': {
        adminRoutes: [
            { label: 'Service Records', path: '/admin/service-records/records',       icon: 'clipboard-list', componentKey: 'service_records:RecordsListPage' },
            { label: 'Reports',         path: '/admin/service-records/reports',        icon: 'bar-chart-3',    componentKey: 'service_records:ReportsPage',      permission: 'view_reports' },
            { label: 'New Record',      path: '/admin/service-records/new',           icon: 'plus',           componentKey: 'service_records:RecordFormPage',   hidden: true },
            { label: 'Record Detail',   path: '/admin/service-records/detail',        icon: 'file-text',      componentKey: 'service_records:RecordDetailPage', hidden: true },
            { label: 'Vehicles',        path: '/admin/service-records/vehicles',        icon: 'car',            componentKey: 'service_records:VehiclesPage' },
            { label: 'Vehicle Detail',  path: '/admin/service-records/vehicles/detail', icon: 'car',            componentKey: 'service_records:VehicleDetailPage', hidden: true },
            { label: 'Service Types',   path: '/admin/service-records/service-types', icon: 'wrench',         componentKey: 'service_records:ServiceTypesPage', permission: 'settings' },
            { label: 'Reminders',       path: '/admin/service-records/reminders',     icon: 'bell',           componentKey: 'service_records:RemindersPage',    permission: 'settings' },
            { label: 'Settings',        path: '/admin/service-records/settings',      icon: 'settings',       componentKey: 'service_records:SettingsPage',     permission: 'settings' },
        ]
    },
    'ai_marketing': {
        adminRoutes: [
            { label: 'Dashboard',        path: '/admin/marketing/dashboard',          icon: 'dashboard',      componentKey: 'ai_marketing:Dashboard',      hidden: true },
            { label: 'Generate',         path: '/admin/marketing/generate',           icon: 'bot',            componentKey: 'ai_marketing:Generate',       hidden: true },
            { label: 'Assets',           path: '/admin/marketing/assets',             icon: 'image',          componentKey: 'ai_marketing:Assets',         hidden: true },
            { label: 'Asset Detail',     path: '/admin/marketing/assets/detail',      icon: 'image',          componentKey: 'ai_marketing:AssetDetail',    hidden: true },
            { label: 'Campaigns',        path: '/admin/marketing/campaigns',          icon: 'clipboard-list', componentKey: 'ai_marketing:Campaigns',      hidden: true },
            { label: 'Campaign Detail',  path: '/admin/marketing/campaigns/detail',   icon: 'clipboard-list', componentKey: 'ai_marketing:CampaignDetail', hidden: true },
            { label: 'Analytics',        path: '/admin/marketing/analytics',          icon: 'bar-chart-3',    componentKey: 'ai_marketing:Analytics',      hidden: true },
            { label: 'Settings',         path: '/admin/marketing/settings',           icon: 'settings',       componentKey: 'ai_marketing:Settings',       hidden: true },
        ]
    }
};
