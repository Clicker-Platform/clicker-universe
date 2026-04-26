
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: '.env.local' });

// Initialize Firebase Admin
function initializeAdmin() {
    if (getApps().length > 0) return getApps()[0];

    const serviceAccountKeyPath = process.env.GCP_SERVICE_ACCOUNT_KEY;
    if (serviceAccountKeyPath) {
        try {
            // Check if it's a file path
            let credential;
            if (fs.existsSync(serviceAccountKeyPath)) {
                console.log(`Reading credentials from file: ${serviceAccountKeyPath}`);
                const fileContent = fs.readFileSync(serviceAccountKeyPath, 'utf8');
                credential = JSON.parse(fileContent);
            } else {
                // Try parsing as JSON string directly
                console.log("Parsing credentials from env var...");
                credential = JSON.parse(serviceAccountKeyPath);
            }

            return initializeApp({ credential: cert(credential) });
        } catch (e: any) {
            console.error("Failed to initialize admin:", e.message);
        }
    } else {
        console.warn("GCP_SERVICE_ACCOUNT_KEY not found. Attempting default init...");
    }
    return initializeApp();
}

const db = getFirestore(initializeAdmin());

const MODULES = [
    {
        id: 'reservation',
        displayName: 'Reservation',
        description: 'Booking system',
        icon: 'calendar',
        version: '1.0.0',
        enabled: true,
        adminRoutes: [
            { label: 'Bookings', path: '/admin/reservation/bookings',  icon: 'calendar', componentKey: 'reservation:Dashboard' },
            { label: 'Services', path: '/admin/reservation/services',  icon: 'list',     componentKey: 'reservation:ServiceList' },
            { label: 'Staff',    path: '/admin/reservation/staff',     icon: 'users',    componentKey: 'reservation:AdminStaff', hidden: true },
            { label: 'Settings', path: '/admin/reservation/settings',  icon: 'settings', componentKey: 'reservation:Settings', permission: 'settings' },
        ],
        publicRoutes: [
            { path: '/book', componentKey: 'reservation:BookPage' }
        ],
        blocks: [
            { type: 'reservation_cta', label: 'Reservation', componentKey: 'reservation:BookNowWaitlist' }
        ]
    },
    {
        id: 'inventory',
        displayName: 'Inventory',
        description: 'Stock management',
        icon: 'box',
        version: '1.0.0',
        enabled: true,
        adminRoutes: [
            { label: 'Items', path: '/admin/inventory/items', icon: 'box', componentKey: 'inventory:AdminDashboard' }
        ]
    },
    {
        id: 'stocklens',
        displayName: 'Stocklens',
        description: 'AI-powered product scanner and inventory vault',
        icon: 'scan-line',
        version: '1.0.0',
        enabled: true,
        adminRoutes: [
            { label: 'Scanner',  path: '/admin/stocklens/scanner',          icon: 'scan-line', componentKey: 'stocklens:ScannerPage' },
            { label: 'Vault',    path: '/admin/stocklens/vault',     icon: 'vault',     componentKey: 'stocklens:VaultPage' },
            { label: 'Settings', path: '/admin/stocklens/settings',  icon: 'settings',  componentKey: 'stocklens:SettingsPage', permission: 'settings' },
        ],
    },
    {
        id: 'byod_pos',
        displayName: 'Self Order',
        description: 'BYOD POS System',
        icon: 'qr-code',
        version: '1.0.0',
        enabled: true,
        adminRoutes: [
            { label: 'Cashier Station', path: '/admin/pos/cashier',     icon: 'monitor-dot',    componentKey: 'byod_pos:Cashier' },
            { label: 'Kitchen Display', path: '/admin/pos/kds',          icon: 'utensils',       componentKey: 'byod_pos:KDS' },
            { label: 'Transactions',    path: '/admin/pos/transactions', icon: 'credit-card',    componentKey: 'byod_pos:Transactions' },
            { label: 'Menu Manager',    path: '/admin/pos/menu',         icon: 'clipboard-list', componentKey: 'byod_pos:AdminMenu' },
            { label: 'Configuration',   path: '/admin/pos/settings',     icon: 'settings',       componentKey: 'byod_pos:AdminSettings', permission: 'settings' },
            { label: 'Reports',         path: '/admin/pos/reports',      icon: 'file-text',      componentKey: 'byod_pos:AdminOrders',   permission: 'view_reports' },
        ],
        publicRoutes: [
            { path: '/order', componentKey: 'byod_pos:OrderPage' }
        ],
        requires: ['inventory'],
        blocks: [
            { type: 'pos_menu_grid', label: 'POS Menu', componentKey: 'byod_pos:MenuGrid' }
        ]
    },
    {
        id: 'membership',
        displayName: 'Membership & Loyalty',
        description: 'Customer loyalty program, points, and member management.',
        icon: 'user',
        version: '1.0.0',
        enabled: true,
        adminRoutes: [
            { label: 'Members',        path: '/admin/membership/list',     icon: 'users',    componentKey: 'membership:MemberListPage' },
            { label: 'Settings',       path: '/admin/membership/settings', icon: 'settings', componentKey: 'membership:Settings', permission: 'settings' },
        ],
        publicRoutes: [
            { path: '/member/login', componentKey: 'membership:LoginPage' }
        ],
        collections: ['modules/membership/members', 'modules/membership/transactions'],
        settings: {
            enableLoyalty: true,
            pointsName: 'Points',
            earningRatio: 1
        }
    },
    {
        id: 'ai_sales',
        displayName: 'AI Sales Agent',
        description: 'Auto-reply agent for customer inquiries.',
        icon: 'bot',
        version: '1.0.0',
        enabled: true,
        adminRoutes: [
            { label: 'Overview', path: '/admin/ai-sales',          icon: 'bot',      componentKey: 'ai_sales:Dashboard' },
            { label: 'Settings', path: '/admin/ai-sales/settings', icon: 'settings', componentKey: 'ai_sales:AdminSettings' },
        ],
        publicRoutes: [],
        blocks: [
            { type: 'ai_chat_widget', label: 'Chat Widget', componentKey: 'ai_sales:ChatWidget' }
        ]
    },
    {
        id: 'sales_pipeline',
        displayName: 'Sales Pipeline',
        description: 'CRM Kanban board for tracking leads through custom pipeline stages.',
        icon: 'trophy',
        version: '1.0.0',
        enabled: true,
        adminRoutes: [
            { path: '/admin/sales-pipeline/board', label: 'Pipeline Board', icon: 'trophy', componentKey: 'sales_pipeline:PipelinePage' },
            { path: '/admin/sales-pipeline/settings', label: 'Settings', icon: 'settings', componentKey: 'sales_pipeline:SettingsPage', permission: 'settings' }
        ],
        publicRoutes: [],
        collections: [
            'modules/sales_pipeline/leads',
            'modules/sales_pipeline/pipeline_config'
        ]
    },
    {
        id: 'service_records',
        displayName: 'Service Records',
        description: 'Vehicle service records, warranty cards, and reminder engine.',
        icon: 'clipboard-list',
        version: '1.0.0',
        enabled: true,
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
        ],
        publicRoutes: [],
        dashboardWidgets: [
            { location: 'member_dashboard', componentKey: 'service_records:MemberWarrantyWidget',      priority: 20 },
            { location: 'member_dashboard', componentKey: 'service_records:MemberServiceHistoryWidget', priority: 30 },
        ],
        collections: [
            'modules/service_records/serviceRecords',
            'modules/service_records/vehicles',
            'modules/service_records/serviceTypes',
            'modules/service_records/warrantyCards',
            'modules/service_records/reminderQueue',
            'modules/service_records/serviceConfig',
        ]
    },
    {
        id: 'ai_marketing',
        displayName: 'AI Marketing Workspace',
        description: 'Multi-agent AI system for marketing content generation.',
        icon: 'bot',
        version: '1.0.0',
        enabled: true,
        adminRoutes: [
            { path: '/admin/marketing/dashboard',        label: 'Dashboard',       icon: 'dashboard',      componentKey: 'ai_marketing:Dashboard' },
            { path: '/admin/marketing/generate',         label: 'Generate',        icon: 'bot',            componentKey: 'ai_marketing:Generate' },
            { path: '/admin/marketing/assets',           label: 'Assets',          icon: 'image',          componentKey: 'ai_marketing:Assets' },
            { path: '/admin/marketing/assets/detail',    label: 'Asset Detail',    icon: 'image',          componentKey: 'ai_marketing:AssetDetail',    hidden: true },
            { path: '/admin/marketing/campaigns',        label: 'Campaigns',       icon: 'clipboard-list', componentKey: 'ai_marketing:Campaigns' },
            { path: '/admin/marketing/campaigns/detail', label: 'Campaign Detail', icon: 'clipboard-list', componentKey: 'ai_marketing:CampaignDetail', hidden: true },
            { path: '/admin/marketing/analytics',        label: 'Analytics',       icon: 'bar-chart-3',    componentKey: 'ai_marketing:Analytics' },
            { path: '/admin/marketing/settings',         label: 'Settings',        icon: 'settings',       componentKey: 'ai_marketing:Settings',       permission: 'settings' },
        ],
        publicRoutes: [],
        blocks: [],
        dashboardWidgets: [],
        collections: [
            'modules/ai_marketing/settings',
            'modules/ai_marketing/assets',
            'modules/ai_marketing/generations',
            'modules/ai_marketing/saved_content',
            'modules/ai_marketing/campaigns',
        ],
        settings: {}
    }
];

async function seedModules() {
    console.log("🚀 Starting module seeding...");

    for (const moduleDef of MODULES) {
        try {
            console.log(`Seeding module: ${moduleDef.id}...`);
            await db.collection('modules').doc(moduleDef.id).set(moduleDef);
            console.log(`✅ Seeded ${moduleDef.id}`);
        } catch (error: any) {
            console.error(`❌ Error seeding ${moduleDef.id}:`, error.message);
        }
    }

    console.log("✨ Seeding complete!");
    process.exit(0);
}

seedModules().catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
});
