
import * as admin from "firebase-admin";

/**
 * Seeds Booking Module Data
 * - Services: Consultation, Meeting
 * - Staff: John Doe
 * - Resources: Room A
 */
export async function seedBookingData(db: admin.firestore.Firestore, siteId: string) {
    console.log(`[Seeding] Booking data for ${siteId}`);
    const siteRef = db.collection('sites').doc(siteId);

    // 1. Services
    const services = [
        {
            name: "Initial Consultation",
            duration: 60,
            price: 150000,
            description: "First meeting to discuss requirements.",
            isActive: true,
            color: "blue"
        },
        {
            name: "Quick Checkup",
            duration: 30,
            price: 75000,
            description: "Brief follow-up session.",
            isActive: true,
            color: "green"
        }
    ];

    const batch = db.batch();
    const serviceRef = siteRef.collection('services');
    for (const s of services) {
        batch.set(serviceRef.doc(), { ...s, createdAt: admin.firestore.FieldValue.serverTimestamp() });
    }

    // 2. Staff
    const staffRef = siteRef.collection('staff');
    batch.set(staffRef.doc(), {
        name: "Demo Staff",
        role: "Specialist",
        email: "staff@demo.com",
        isActive: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    await batch.commit();
}

/**
 * Seeds Inventory Module Data
 * - Items: Raw Materials
 * - Suppliers: Local Vendor
 */
export async function seedInventoryData(db: admin.firestore.Firestore, siteId: string) {
    console.log(`[Seeding] Inventory data for ${siteId}`);
    const siteRef = db.collection('sites').doc(siteId);

    // 1. Inventory Items
    const items = [
        {
            name: "Coffee Beans (Arabica)",
            sku: "RM-COF-001",
            category: "Raw Material",
            quantity: 50,
            unit: "kg",
            minStockLevel: 10,
            costPrice: 120000,
            supplier: "Local Farm"
        },
        {
            name: "Milk (UHT)",
            sku: "RM-MIL-001",
            category: "Raw Material",
            quantity: 100,
            unit: "L",
            minStockLevel: 20,
            costPrice: 18000,
            supplier: "Dairy Co"
        }
    ];

    const batch = db.batch();
    const invRef = siteRef.collection('inventory');
    for (const item of items) {
        batch.set(invRef.doc(), { ...item, createdAt: admin.firestore.FieldValue.serverTimestamp() });
    }
    await batch.commit();
}

/**
 * Seeds Membership Module Data
 * - Tiers: Silver, Gold
 */
export async function seedMembershipData(db: admin.firestore.Firestore, siteId: string) {
    console.log(`[Seeding] Membership data for ${siteId}`);
    const siteRef = db.collection('sites').doc(siteId);

    // 1. Loyalty Tiers
    const tiers = [
        {
            name: "Silver",
            minPoints: 0,
            multiplier: 1,
            color: "gray",
            benefits: ["Free Wifi"]
        },
        {
            name: "Gold",
            minPoints: 1000,
            multiplier: 1.5,
            color: "gold",
            benefits: ["Free Wifi", "Priority Service"]
        }
    ];

    const batch = db.batch();
    const tierRef = siteRef.collection('loyalty_tiers');
    for (const t of tiers) {
        batch.set(tierRef.doc(t.name.toLowerCase()), { ...t, createdAt: admin.firestore.FieldValue.serverTimestamp() });
    }
    await batch.commit();
}

/**
 * Seeds Sales Pipeline Module Data
 * - Config: Default stages (New Lead, Contacted, Proposal, Won)
 */
export async function seedSalesPipelineData(db: admin.firestore.Firestore, siteId: string) {
    console.log(`[Seeding] Sales Pipeline data for ${siteId}`);
    const configRef = db.doc(`sites/${siteId}/modules/sales_pipeline/settings/config`);

    const defaultStages = [
        { id: 'lead',        name: 'New Lead',      order: 0, type: 'active', color: '#3b82f6' },
        { id: 'qualified',   name: 'Qualified',     order: 1, type: 'active', color: '#8b5cf6' },
        { id: 'proposal',    name: 'Proposal',      order: 2, type: 'active', color: '#f59e0b' },
        { id: 'negotiation', name: 'Negotiation',   order: 3, type: 'active', color: '#ec4899' },
        { id: 'won',         name: 'Won',           order: 4, type: 'won',    color: '#10b981' },
        { id: 'lost',        name: 'Lost',          order: 5, type: 'lost',   color: '#ef4444' },
    ];

    await configRef.set({
        stages: defaultStages,
        formIntegrations: [],
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
}

const STORE_PAGE_ID = 'digital-goods-store';

/**
 * Seeds Digital Goods Module Data
 * - Auto-creates a "Store" custom page with a ProductGrid block if not already present.
 */
export async function seedDigitalGoodsData(db: admin.firestore.Firestore, siteId: string) {
    console.log(`[Seeding] Digital Goods Store page for ${siteId}`);
    const pageRef = db.doc(`sites/${siteId}/pages/${STORE_PAGE_ID}`);
    const snap = await pageRef.get();
    if (snap.exists) return;

    await pageRef.set({
        id: STORE_PAGE_ID,
        title: 'Store',
        slug: 'store',
        content: '',
        blocks: [
            {
                id: 'product-grid-default',
                type: 'digital_goods_product_grid',
                data: {
                    title: 'Store',
                    subtitle: 'Browse and buy digital products.',
                    limit: 12,
                    columns: 3,
                },
            },
        ],
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
}

/**
 * Seeding Router - Calls specific seeders based on enabled modules
 */
export async function seedModules(db: admin.firestore.Firestore, siteId: string, modules: Record<string, boolean>) {
    const tasks = [];
    if (modules.booking || modules.reservation) tasks.push(seedBookingData(db, siteId));
    if (modules.inventory) tasks.push(seedInventoryData(db, siteId));
    if (modules.membership) tasks.push(seedMembershipData(db, siteId));
    if (modules.sales_pipeline) tasks.push(seedSalesPipelineData(db, siteId));
    if (modules.digital_goods) tasks.push(seedDigitalGoodsData(db, siteId));

    await Promise.all(tasks);
}
