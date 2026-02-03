import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

export const DEMO_SITE_DATA = {
    metadata: {
        name: "Demo Store",
        domain: "demo.localhost",
        isActive: true,
        settings: {
            modules: { pos: true, inventory: true, forms: true }
        }
    },
    settings: {
        title: "SunnySide - Fresh Bakes Daily",
        description: "Artisanal pastries, strong coffee, and good vibes.",
        themeColor: "#B6FF2E",
        accentColor: "#0E3B2E",
        fontFamily: "Plus Jakarta Sans",
        layoutStyle: "classic",
    },
    profile: {
        name: "SunnySide Cafe",
        tagline: "Est. 2024",
        description: "We serve the best coffee in town with a side of sunshine. Come visit us!",
        contact: {
            email: "hello@sunnyside.demo",
            phone: "+6281234567890",
            address: "Jl. Sudirman No. 1, Jakarta"
        },
        socialLinks: [
            { platform: "instagram", url: "https://instagram.com/sunnyside", isActive: true },
            { platform: "whatsapp", url: "https://wa.me/6281234567890", isActive: true }
        ]
    },
    pages: {
        home: {
            title: "Welcome to SunnySide",
            slug: "home",
            isActive: true,
            blocks: [
                {
                    id: "hero-1",
                    type: "hero",
                    content: {
                        headline: "Fresh Coffee & Pastries",
                        subheadline: "Start your day with a smile.",
                        buttonText: "Order Now",
                        buttonLink: "/catalog"
                    },
                    order: 0
                },
                {
                    id: "features-1",
                    type: "features",
                    content: {
                        title: "Why Choose Us",
                        items: [
                            { title: "Organic Beans", description: "Directly sourced from farmers." },
                            { title: "Freshly Baked", description: "Baked every morning at 5 AM." }
                        ]
                    },
                    order: 1
                }
            ]
        },
        about: {
            title: "About Us",
            slug: "about",
            isActive: true,
            content: "<p>We started in a small garage with a big dream: to serve the perfect cup of coffee. Today, we are proud to share our passion with you.</p>"
        }
    },
    products: [
        {
            name: "Signature Latte",
            price: 35000,
            description: "Espresso with steamed milk and a thin layer of foam.",
            category: "Coffee",
            isActive: true,
            imageUrl: "https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&q=80&w=1000"
        },
        {
            name: "Almond Croissant",
            price: 28000,
            description: "Buttery, flaky croissant topped with toasted almonds.",
            category: "Pastry",
            isActive: true,
            imageUrl: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&q=80&w=1000"
        },
        {
            name: "Avocado Toast",
            price: 45000,
            description: "Sourdough bread topped with smashed avocado and poached egg.",
            category: "Food",
            isActive: true,
            imageUrl: "https://images.unsplash.com/photo-1588137372308-15f75323ca8d?auto=format&fit=crop&q=80&w=1000"
        }
    ],
    links: [
        {
            title: "Official Website",
            url: "https://example.com",
            iconName: "Globe",
            isActive: true,
            order: 0
        },
        {
            title: "Check our Menu",
            url: "/catalog",
            iconName: "Coffee",
            isActive: true,
            order: 1
        }
    ]
};

export async function performSiteSeeding(db: admin.firestore.Firestore, siteId: string, ownerId?: string) {
    console.log(`🌱 Seeding site logic for: ${siteId}`);
    const siteRef = db.collection('sites').doc(siteId);

    // 1. Site Metadata
    const metadata = {
        ...DEMO_SITE_DATA.metadata,
        id: siteId,
        ownerId: ownerId || 'system-seed',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    await siteRef.set(metadata, { merge: true });

    // 2. Site Settings
    await siteRef.collection('content').doc('siteSettings').set(DEMO_SITE_DATA.settings);

    // 3. Business Profile
    await siteRef.collection('content').doc('profile').set(DEMO_SITE_DATA.profile);

    // 4. Pages
    const pagesBatch = db.batch();
    for (const [key, pageData] of Object.entries(DEMO_SITE_DATA.pages)) {
        const pageRef = siteRef.collection('pages').doc(key);
        pagesBatch.set(pageRef, {
            ...pageData,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
    }
    await pagesBatch.commit();

    // 5. Products
    const productsBatch = db.batch();
    const existingProducts = await siteRef.collection('products').get();
    existingProducts.docs.forEach(doc => productsBatch.delete(doc.ref));

    for (const product of DEMO_SITE_DATA.products) {
        const newProductRef = siteRef.collection('products').doc();
        productsBatch.set(newProductRef, {
            ...product,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
    }
    await productsBatch.commit();

    // 6. Links
    const linksBatch = db.batch();
    const existingLinks = await siteRef.collection('links').get();
    existingLinks.docs.forEach(doc => linksBatch.delete(doc.ref));

    for (const link of DEMO_SITE_DATA.links) {
        const newLinkRef = siteRef.collection('links').doc();
        linksBatch.set(newLinkRef, {
            ...link,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
    }
    await linksBatch.commit();
}

export const seedSiteData = functions.https.onCall(async (request) => {
    const { siteId, ownerId } = request.data;
    if (!siteId) {
        throw new functions.https.HttpsError('invalid-argument', 'siteId is required.');
    }

    const db = admin.firestore();
    try {
        await performSiteSeeding(db, siteId, ownerId);
        return { success: true, siteId, message: "Site seeded successfully" };
    } catch (error: any) {
        console.error("❌ Error seeding site:", error);
        throw new functions.https.HttpsError('internal', `Failed to seed site: ${error.message}`);
    }
});
