
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
 * Seeding Router - Calls specific seeders based on enabled modules
 */
export async function seedModules(db: admin.firestore.Firestore, siteId: string, modules: Record<string, boolean>) {
    const tasks = [];
    if (modules.booking) tasks.push(seedBookingData(db, siteId));
    if (modules.inventory) tasks.push(seedInventoryData(db, siteId));
    if (modules.membership) tasks.push(seedMembershipData(db, siteId));

    // POS is usually covered by core 'products' seeding, but could add specific POS settings here if needed

    await Promise.all(tasks);
}
