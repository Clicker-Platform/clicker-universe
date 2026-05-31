import { ModuleDefinition } from './types';

// Strict Parity with Properti
export const STATIC_MODULE_DEFINITIONS: Record<string, Partial<ModuleDefinition>> = {
    'byod_pos': {
        adminRoutes: [
            { label: 'Cashier', path: '/admin/pos/cashier', icon: 'monitor-dot', componentKey: 'byod_pos:Cashier' },
            { label: 'Kitchen', path: '/admin/pos/kds', icon: 'utensils', componentKey: 'byod_pos:KDS' },
            { label: 'Transactions', path: '/admin/pos/transactions', icon: 'credit-card', componentKey: 'byod_pos:Transactions' },
            { label: 'Menu', path: '/admin/pos/menu', icon: 'clipboard-list', componentKey: 'byod_pos:AdminMenu' },
            { label: 'Configuration', path: '/admin/pos/settings', icon: 'settings', permission: 'settings', componentKey: 'byod_pos:AdminSettings' },
            { label: 'Reports', path: '/admin/pos/reports', icon: 'file-text', permission: 'view_reports', componentKey: 'byod_pos:AdminOrders' }
        ],
        dashboardAction: { label: 'Open Cashier', href: '/admin/pos/cashier' },
        adminDashboardWidget: { componentKey: 'byod_pos:DashboardWidget' },
    },
    'membership': {
        adminRoutes: [
            { label: 'Members', path: '/admin/membership/list', icon: 'users', componentKey: 'membership:MemberListPage' },
            { label: 'Settings', path: '/admin/membership/settings', icon: 'settings', permission: 'settings', componentKey: 'membership:Settings' }
        ],
        dashboardAction: { label: 'View Members', href: '/admin/membership/list' },
        adminDashboardWidget: { componentKey: 'membership:DashboardWidget' },
    },
    'inventory': {
        adminRoutes: [
            { label: 'Items', path: '/admin/inventory/items', icon: 'box', componentKey: 'inventory:AdminDashboard' }
        ],
        dashboardAction: { label: 'View Stock', href: '/admin/inventory/items' },
        adminDashboardWidget: { componentKey: 'inventory:DashboardWidget' },
    },
    'stocklens': {
        adminRoutes: [
            { label: 'Scanner',  path: '/admin/stocklens/scanner',  icon: 'scan-line', componentKey: 'stocklens:ScannerPage' },
            { label: 'Vault',    path: '/admin/stocklens/vault',    icon: 'vault',     componentKey: 'stocklens:VaultPage' },
            { label: 'Settings', path: '/admin/stocklens/settings', icon: 'settings',  componentKey: 'stocklens:SettingsPage', permission: 'settings' },
        ]
    },
    'reservation': {
        adminRoutes: [
            { label: 'Bookings', path: '/admin/reservation/bookings', icon: 'calendar', componentKey: 'reservation:Dashboard' },
            { label: 'Services', path: '/admin/reservation/services', icon: 'list', componentKey: 'reservation:ServiceList' },
            { label: 'Staff', path: '/admin/reservation/staff', icon: 'users', componentKey: 'reservation:AdminStaff', hidden: true },
            { label: 'Settings', path: '/admin/reservation/settings', icon: 'settings', permission: 'settings', componentKey: 'reservation:Settings' }
        ],
        dashboardAction: { label: 'New Booking', href: '/admin/reservation/bookings' },
        adminDashboardWidget: { componentKey: 'reservation:DashboardWidget' },
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
        ],
        dashboardAction: { label: 'View Pipeline', href: '/admin/sales-pipeline/board' },
        adminDashboardWidget: { componentKey: 'sales_pipeline:DashboardWidget' },
    },
    'service_records': {
        adminRoutes: [
            { label: 'Service', path: '/admin/service-records/records',       icon: 'clipboard-list', componentKey: 'service_records:RecordsListPage' },
            { label: 'Reports',         path: '/admin/service-records/reports',        icon: 'bar-chart-3',    componentKey: 'service_records:ReportsPage',      permission: 'view_reports' },
            { label: 'New Record',      path: '/admin/service-records/new',           icon: 'plus',           componentKey: 'service_records:RecordFormPage',   hidden: true },
            { label: 'Record Detail',   path: '/admin/service-records/detail',        icon: 'file-text',      componentKey: 'service_records:RecordDetailPage', hidden: true },
            { label: 'Vehicles',        path: '/admin/service-records/vehicles',        icon: 'car',            componentKey: 'service_records:VehiclesPage' },
            { label: 'Vehicle Detail',  path: '/admin/service-records/vehicles/detail', icon: 'car',            componentKey: 'service_records:VehicleDetailPage', hidden: true },
            { label: 'Service Types',   path: '/admin/service-records/service-types', icon: 'wrench',         componentKey: 'service_records:ServiceTypesPage', permission: 'settings' },
            { label: 'Reminders',       path: '/admin/service-records/reminders',     icon: 'bell',           componentKey: 'service_records:RemindersPage',    permission: 'settings' },
            { label: 'Settings',        path: '/admin/service-records/settings',      icon: 'settings',       componentKey: 'service_records:SettingsPage',     permission: 'settings' },
        ],
        dashboardAction: { label: 'New Record', href: '/admin/service-records/new' },
        adminDashboardWidget: { componentKey: 'service_records:DashboardWidget' },
    },
    'fintrack': {
        adminRoutes: [
            { label: 'Dashboard', path: '/admin/fintrack',          icon: 'layout-dashboard', componentKey: 'fintrack:DashboardPage' },
            { label: 'Entries',   path: '/admin/fintrack/entries',  icon: 'list',             componentKey: 'fintrack:EntriesPage' },
            { label: 'Wallets',   path: '/admin/fintrack/wallets',  icon: 'wallet',           componentKey: 'fintrack:WalletVaultPage' },
            { label: 'New Entry', path: '/admin/fintrack/new',      icon: 'plus',             componentKey: 'fintrack:NewEntryPage', hidden: true },
            { label: 'Advanced',  path: '/admin/fintrack/advanced', icon: 'star',             componentKey: 'fintrack:AdvancedPage' },
            { label: 'Settings',  path: '/admin/fintrack/settings', icon: 'settings',         componentKey: 'fintrack:SettingsPage', permission: 'settings' },
        ],
        dashboardAction: { label: 'View Entries', href: '/admin/fintrack/entries' },
        adminDashboardWidget: { componentKey: 'fintrack:DashboardWidget' },
    },
    'digital_goods': {
        adminRoutes: [
            { label: 'Products', path: '/admin/digital-goods',          icon: 'shopping-bag', componentKey: 'digital_goods:ProductsList' },
            { label: 'Orders',   path: '/admin/digital-goods/orders',   icon: 'receipt',      componentKey: 'digital_goods:OrdersList'  },
            { label: 'Settings', path: '/admin/digital-goods/settings', icon: 'settings',     componentKey: 'digital_goods:Settings',    permission: 'settings' }
        ],
        dashboardAction: { label: 'View Products', href: '/admin/digital-goods' },
        memberSurface: {
            id: 'library',
            label: 'My Library',
            icon: 'box',
            route: '/library',
            componentKey: 'digital_goods:LibrarySurface',
            // Visibility is implicit-by-data (no isGranted). The data check needs the
            // admin SDK and runs server-side, so it is NOT defined here (definitions.ts
            // is imported by client components and must stay free of firebase-admin).
            // The surfaces API route resolves it via dataCheck below. See
            // app/api/account/surfaces/route.ts + surface-admin.ts.
            dataCheck: 'digital_goods:library',
        },
    },
    'promo': {
        adminRoutes: [
            { label: 'Promotions', path: '/admin/promo', icon: 'tag', componentKey: 'promo:PromoAdminPage' },
            { label: 'Vouchers', path: '/admin/promo/vouchers', icon: 'ticket', componentKey: 'promo:PromoAdminPage' },
            { label: 'Settings', path: '/admin/promo/settings', icon: 'settings', permission: 'settings', componentKey: 'promo:PromoAdminPage' },
        ],
        dashboardWidgets: [
            { location: 'member_dashboard', componentKey: 'promo:MemberRewardsWidget', priority: 50 },
            { location: 'member_dashboard', componentKey: 'promo:MyVouchersWidget',    priority: 40 },
        ],
        dashboardAction: { label: 'New Promo', href: '/admin/promo' },
        adminDashboardWidget: { componentKey: 'promo:DashboardWidget' },
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
