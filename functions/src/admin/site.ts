import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

export const STARTER_TEMPLATE = {
    metadata: {
        isActive: true,
        settings: {
            modules: { pos: false, inventory: false, forms: false } // Default off
        },
        seo: {
            noIndex: true
        },
        pixels: {
            facebookPixelId: "",
            googleAnalyticsId: "",
            tiktokPixelId: ""
        }
    },
    settings: {
        themeColor: "#ec5b13",
        accentColor: "#ec5b13",
        fontFamily: "Inter",
        layoutStyle: "mrb",
    },
    profile: {
        tagline: "Your Quality Brand",
        description: "Welcome to your new website. You can edit this description in the Admin Panel.",
        contact: {
            email: "contact@example.com",
            phone: "+62 000-0000-0000",
            address: "Your Business Address"
        },
        socialLinks: []
    },
    pages: {
        home: {
            title: "Home",
            slug: "home",
            isActive: true,
            blocks: [
                {
                    id: "hero-1",
                    type: "hero",
                    data: {
                        title: "Powered by Clicker",
                        subtitle: "Your new website is ready. This platform enables you to scale your business effortlessly.",
                        buttonText: "Manage Content",
                        buttonLink: "/admin",
                        imageUrl: "/clicker_brand_logo.png"
                    },
                    order: 0
                },
                {
                    id: "quick-actions-1",
                    type: "quick_actions",
                    data: {},
                    order: 1
                },
                {
                    id: "hours-1",
                    type: "hours",
                    data: {},
                    order: 2
                }
            ]
        }
    },
    products: [
        {
            name: "Clicker Starter Pack",
            price: 100000,
            description: "A sample product demonstrating the Clicker e-commerce capability. Replace this with your own inventory.",
            category: "General",
            isActive: true,
            imageUrl: "/clicker_brand_logo.png"
        }
    ],
    links: [
        {
            title: "Visit Admin Panel",
            url: `https://${process.env.BASE_DOMAIN || 'clicker.id'}/admin`,
            iconName: "Settings",
            isActive: true,
            order: 0
        }
    ]
};

export async function performSiteSeeding(db: admin.firestore.Firestore, siteId: string, ownerId?: string, overrides?: any) {
    console.log(`🌱 Seeding STARTER template for: ${siteId}`);
    const siteRef = db.collection('sites').doc(siteId);

    const siteName = overrides?.name || "New Site";

    // 1. Site Metadata
    const metadata = {
        ...STARTER_TEMPLATE.metadata,
        name: siteName, // Use actual name
        domain: `${siteId}.${process.env.BASE_DOMAIN || 'clicker.id'}`, // Default domain
        id: siteId,
        ownerId: ownerId || 'system-seed',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        seo: {
            ...STARTER_TEMPLATE.metadata.seo,
            title: siteName,
            description: `Official site for ${siteName}`
        }
    };
    await siteRef.set(metadata, { merge: true });

    // 2. Site Settings
    const settings = {
        ...STARTER_TEMPLATE.settings,
        title: siteName,
        description: `Official site for ${siteName}`
    };
    await siteRef.collection('content').doc('siteSettings').set(settings);

    // 3. Business Profile
    const profile = {
        ...STARTER_TEMPLATE.profile,
        name: siteName
    };
    await siteRef.collection('content').doc('profile').set(profile);

    // 4. Pages
    const pagesBatch = db.batch();
    for (const [key, pageData] of Object.entries(STARTER_TEMPLATE.pages)) {
        const pageRef = siteRef.collection('pages').doc(key);
        pagesBatch.set(pageRef, {
            ...pageData,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
    }
    await pagesBatch.commit();

    // 5. Products (Ensure empty collection exists or just skip)
    // No need to delete existing if we assume new site, but for safety/re-seed:
    const existingProducts = await siteRef.collection('products').limit(10).get();
    if (!existingProducts.empty) {
        // If re-seeding, maybe we shouldn't delete user data? 
        // For now, let's strictly follow "clean slate" only for creation or explicit reset.
        // If `seedSampleData` flag was passed, we might want logic here.
        // But for "Clean Seed", we simply do nothing here.
    }

    // 5. Products
    const productsBatch = db.batch();
    // Safety check: only seed if collection is empty to avoid dupes on re-run, or if we want to force seed.
    // For creation, it's empty.
    for (const product of STARTER_TEMPLATE.products) {
        const newProductRef = siteRef.collection('products').doc();
        productsBatch.set(newProductRef, {
            ...product,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
    }
    await productsBatch.commit();

    // 6. Links
    const linksBatch = db.batch();
    for (const link of STARTER_TEMPLATE.links) {
        const newLinkRef = siteRef.collection('links').doc();
        linksBatch.set(newLinkRef, {
            ...link,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
    }
    await linksBatch.commit();
}



export const seedSiteData = functions.https.onCall(async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
    }
    const email = request.auth.token.email;
    if (email !== process.env.SUPER_ADMIN_EMAIL) {
        throw new functions.https.HttpsError('permission-denied', 'Superadmin only.');
    }

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
