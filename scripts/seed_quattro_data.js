
const admin = require('firebase-admin');
var serviceAccount = require("./service-account.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// 1. Module Definitions (Global Metadata) - Required for system to recognize them
const MODULE_DEFINITIONS = [
    {
        id: 'reservation',
        displayName: 'Reservation',
        description: 'Booking system',
        icon: 'calendar',
        version: '1.0.0',
        enabled: true, // Globally "available" as a definition
        adminRoutes: [
            { path: '/admin/reservation', label: 'Bookings', icon: 'calendar', componentKey: 'reservation:Dashboard' },
            { path: '/admin/reservation/services', label: 'Services', icon: 'list', componentKey: 'reservation:AdminServices' },
            { path: '/admin/reservation/staff', label: 'Resources', icon: 'user', componentKey: 'reservation:AdminStaff', hidden: true },
            { path: '/admin/reservation/calendar', label: 'Calendar Settings', icon: 'calendar', componentKey: 'reservation:AdminBookings', hidden: true }
        ],
        publicRoutes: [{ path: '/book', componentKey: 'reservation:BookPage' }],
        blocks: [{ type: 'reservation_cta', label: 'Book Now Button', componentKey: 'reservation:BookNowWaitlist' }]
    },
    {
        id: 'inventory',
        displayName: 'Inventory',
        description: 'Stock management',
        icon: 'box',
        version: '1.0.0',
        enabled: true,
        adminRoutes: [{ path: '/admin/inventory', label: 'Stock', icon: 'box', componentKey: 'inventory:AdminDashboard' }]
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
        publicRoutes: [{ path: '/order', componentKey: 'byod_pos:OrderPage' }],
        requires: ['inventory'],
        blocks: [{ type: 'pos_menu_grid', label: 'POS Menu Grid', componentKey: 'byod_pos:MenuGrid' }]
    },
    {
        id: 'membership',
        displayName: 'Membership & Loyalty',
        description: 'Customer loyalty program',
        icon: 'user',
        version: '1.0.0',
        enabled: true,
        adminRoutes: [
            { path: '/admin/membership', label: 'Members', icon: 'user', componentKey: 'membership:MemberListPage' },
            { path: '/admin/membership/details', label: 'Member Details', hidden: true, componentKey: 'membership:MemberDetailsPage' },
            { path: '/admin/membership/settings', label: 'Settings', hidden: true, componentKey: 'membership:Settings' }
        ],
        publicRoutes: [{ path: '/member/login', componentKey: 'membership:LoginPage' }],
        settings: { enableLoyalty: true, pointsName: 'Points', earningRatio: 1 }
    },
    {
        id: 'sales-pipeline',
        displayName: 'Sales Pipeline',
        description: 'Lead tracking',
        icon: 'trophy',
        version: '1.0.0',
        enabled: true,
        adminRoutes: [{ path: '/admin/sales-pipeline', label: 'Pipeline', icon: 'trophy' }]
    },
    {
        id: 'ai-sales-agent',
        displayName: 'AI Sales Agent',
        description: 'Automated customer support and sales',
        icon: 'message-square',
        version: '1.0.0',
        enabled: true,
        adminRoutes: [], // Mostly a background/widget service
        publicRoutes: [],
        settings: {
            model: 'gemini-2.0-flash',
            greetingMessage: 'Halo! Ada yang bisa saya bantu hari ini?'
        }
    }
];

async function seedQuattro() {
    console.log('🚀 Seeding Quattro Site Data...');
    const SITE_ID = 'quattro';

    // 1. Ensure Global Module Definitions exist (required for UI to function)
    console.log('Step 1: Updating Global Module Registry (Definitions only)...');
    for (const mod of MODULE_DEFINITIONS) {
        await db.collection('modules').doc(mod.id).set(mod, { merge: true });
    }

    // 2. Enable Modules for Quattro Site
    console.log(`Step 2: Activating modules for site '${SITE_ID}'...`);
    await db.collection('sites').doc(SITE_ID).set({
        modules: {
            reservation: true,
            inventory: true,
            byod_pos: true,
            membership: true,
            'sales-pipeline': true,
            'ai-sales-agent': true
        }
    }, { merge: true });

    // 2.5 Seed AI Agent Config
    console.log('Step 2.5: Configuring AI Sales Agent...');
    await db.collection('sites').doc(SITE_ID).collection('modules').doc('ai-sales-agent').set({
        enabled: true,
        model: 'gemini-2.0-flash',
        systemPrompt: 'Anda adalah asisten virtual untuk Quattro Cafe. Jawablah dengan ramah dan membantu.',
        businessContext: 'Quattro Cafe adalah kafe modern yang menyajikan kopi premium dan makanan lezat. Buka setiap hari jam 8 pagi sampai 10 malam.',
        greetingMessage: 'Halo! Selamat datang di Quattro Cafe. Ada yang bisa saya bantu terkait menu atau reservasi?',
        knowledgeBaseContent: 'Menu andalan kami adalah Kopi Susu Gula Aren dan Croissant Almond. Kami juga menyediakan WiFi gratis untuk pelanggan.'
    });

    // 3. Seed Sample Data

    // --- Inventory ---
    console.log('Step 3: Seeding Inventory Items...');
    const inventoryRef = db.collection('sites').doc(SITE_ID).collection('modules/inventory/items');
    await inventoryRef.add({
        name: 'Arabica Coffee Beans',
        sku: 'BEAN-001',
        category: 'Raw Material',
        stock: 5000,
        unit: 'grams',
        minLevel: 1000,
        updatedAt: new Date()
    });
    await inventoryRef.add({
        name: 'Fresh Milk',
        sku: 'MILK-001',
        category: 'Raw Material',
        stock: 20,
        unit: 'liters',
        minLevel: 5,
        updatedAt: new Date()
    });

    // --- Reservation Services ---
    console.log('Step 4: Seeding Reservation Services...');
    const servicesRef = db.collection('sites').doc(SITE_ID).collection('modules/reservation/services');
    await servicesRef.add({
        name: 'Standard Table Booking',
        description: 'Reserve a table for up to 4 people',
        durationMinutes: 60,
        price: 0,
        requiresConfirmation: false,
        active: true
    });
    await servicesRef.add({
        name: 'Private Meeting Room',
        description: 'Exclusive use of the meeting room (Max 10pax)',
        durationMinutes: 120,
        price: 150000,
        requiresConfirmation: true,
        active: true
    });

    // --- Membership ---
    console.log('Step 5: Seeding Members...');
    const membersRef = db.collection('sites').doc(SITE_ID).collection('modules/membership/members');
    await membersRef.add({
        name: 'John Doe',
        phone: '08123456789',
        email: 'john@example.com',
        points: 150,
        totalSpend: 1500000,
        tier: 'Gold',
        joinedAt: new Date()
    });

    console.log('✅ Quattro Seeding Complete!');
}

seedQuattro().catch(console.error);
