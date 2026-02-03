
const admin = require('firebase-admin');
var serviceAccount = require("./service-account.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function seedModules() {
    console.log('Seeding Global Modules...');

    const modules = [
        {
            id: 'reservation',
            displayName: 'Reservation',
            description: 'Booking system',
            icon: 'calendar',
            version: '1.0.0',
            enabled: true,
            adminRoutes: [
                { path: '/admin/reservation', label: 'Bookings', icon: 'calendar', componentKey: 'reservation:Dashboard' },
                { path: '/admin/reservation/services', label: 'Services', icon: 'list', componentKey: 'reservation:AdminServices' },
                { path: '/admin/reservation/staff', label: 'Resources', icon: 'user', componentKey: 'reservation:AdminStaff', hidden: true },
                { path: '/admin/reservation/calendar', label: 'Calendar Settings', icon: 'calendar', componentKey: 'reservation:AdminBookings', hidden: true }
            ],
            publicRoutes: [
                { path: '/book', componentKey: 'reservation:BookPage' }
            ],
            blocks: [
                { type: 'reservation_cta', label: 'Book Now Button', componentKey: 'reservation:BookNowWaitlist' }
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
                { path: '/admin/inventory', label: 'Stock', icon: 'box', componentKey: 'inventory:AdminDashboard' }
            ]
        },
        {
            id: 'byod_pos',
            displayName: 'Self Order',
            description: 'BYOD POS System',
            icon: 'qr-code',
            version: '1.0.0',
            enabled: true,
            adminRoutes: [
                { path: '/admin/pos/cashier', label: 'Cashier Station', icon: 'credit-card', componentKey: 'byod_pos:Cashier' },
                { path: '/admin/pos/kitchen', label: 'Kitchen Display', icon: 'monitor-dot', componentKey: 'byod_pos:KDS' },
                { path: '/admin/pos/history', label: 'Transactions', icon: 'clipboard-list', componentKey: 'byod_pos:Transactions' },
                { path: '/admin/pos/menu', label: 'Menu Manager', icon: 'utensils', componentKey: 'byod_pos:AdminMenu' },
                { path: '/admin/pos/settings', label: 'Configuration', icon: 'settings', componentKey: 'byod_pos:AdminSettings' }
            ],
            publicRoutes: [
                { path: '/order', componentKey: 'byod_pos:OrderPage' }
            ],
            requires: ['inventory'],
            blocks: [
                { type: 'pos_menu_grid', label: 'POS Menu Grid', componentKey: 'byod_pos:MenuGrid' }
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
                {
                    path: '/admin/membership',
                    label: 'Members',
                    icon: 'user',
                    componentKey: 'membership:MemberListPage'
                },
                {
                    path: '/admin/membership/details',
                    label: 'Member Details',
                    hidden: true,
                    componentKey: 'membership:MemberDetailsPage'
                },
                {
                    path: '/admin/membership/settings',
                    label: 'Settings',
                    hidden: true,
                    componentKey: 'membership:Settings'
                }
            ],
            publicRoutes: [
                {
                    path: '/member/login',
                    componentKey: 'membership:LoginPage'
                }
            ],
            collections: ['modules/membership/members', 'modules/membership/transactions'],
            settings: {
                enableLoyalty: true,
                pointsName: 'Points',
                earningRatio: 1
            }
        },
        {
            id: 'sales-pipeline',
            displayName: 'Sales Pipeline',
            description: 'Lead tracking and deal management',
            icon: 'trophy',
            version: '1.0.0',
            enabled: true,
            adminRoutes: [
                { path: '/admin/sales-pipeline', label: 'Pipeline', icon: 'trophy' }
            ]
        }
    ];

    for (const mod of modules) {
        console.log(`Setting module: ${mod.id}`);
        await db.collection('modules').doc(mod.id).set(mod, { merge: true });
    }

    console.log('✅ All modules seeded successfully.');
}

seedModules().catch(console.error);
