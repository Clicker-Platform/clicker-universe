
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: '.env.local' });

// --- Initialize Firebase Admin (Copied from seed-modules.ts) ---
function initializeAdmin() {
    if (getApps().length > 0) return getApps()[0];

    const serviceAccountKeyPath = process.env.GCP_SERVICE_ACCOUNT_KEY;
    if (serviceAccountKeyPath) {
        try {
            let credential;
            if (fs.existsSync(serviceAccountKeyPath)) {
                console.log(`Reading credentials from file: ${serviceAccountKeyPath}`);
                const fileContent = fs.readFileSync(serviceAccountKeyPath, 'utf8');
                credential = JSON.parse(fileContent);
            } else {
                console.log("Parsing credentials from env var...");
                credential = JSON.parse(serviceAccountKeyPath);
            }
            return initializeApp({ credential: cert(credential) });
        } catch (e: any) {
            console.error("Failed to initialize admin:", e.message);
        }
    } else {
        console.warn("GCP_SERVICE_ACCOUNT_KEY not found. Defaulting...");
    }
    return initializeApp();
}

const db = getFirestore(initializeAdmin());

// --- Default Data ---
// Based on lib/mockData.ts but adapted for Firestore (no Lucide components)

const profileData = {
    name: "Aletra ",
    tagline: "Experience the Future ",
    description: "powered by Aletra.",
    avatarUrl: "https://picsum.photos/300/300"
};

const businessData = {
    address: "123 Innovation Drive, Tech City",
    email: "contact@aletra.com",
    enabled: true,
    label: "Opening Hours",
    mapUrl: "https://maps.google.com",
    monFri: "08:00 - 22:00",
    satSun: "09:00 - 23:00",
    schedule: [
        { dayOfWeek: 1, isOpen: true, hours: [{ start: "08:00", end: "22:00" }] },
        { dayOfWeek: 2, isOpen: true, hours: [{ start: "08:00", end: "22:00" }] },
        { dayOfWeek: 3, isOpen: true, hours: [{ start: "08:00", end: "22:00" }] },
        { dayOfWeek: 4, isOpen: true, hours: [{ start: "08:00", end: "22:00" }] },
        { dayOfWeek: 5, isOpen: true, hours: [{ start: "08:00", end: "22:00" }] },
        { dayOfWeek: 6, isOpen: true, hours: [{ start: "09:00", end: "23:00" }] },
        { dayOfWeek: 0, isOpen: true, hours: [{ start: "09:00", end: "23:00" }] }
    ],
    tagText: "Open Now",
    whatsapp: "+1234567890"
};

const siteSettingsData = {
    title: "Aletra Cafe",
    description: "Welcome to Aletra",
    faviconUrl: "",
    ogImageUrl: "",
    themeColor: "#000000",
    accentColor: "#FF5733",
    fontFamily: "Inter",
    templateId: "classic",
    backgroundImageUrl: "",
    socialLinkItems: [],
    footerText: "© 2024 Aletra",
    borderRadius: "large"
};

const linkSettingsData = {
    sectionTitle: "Quick Actions",
    showOnHome: true
};

const productSettingsData = {
    galleryTitle: "Our Menu",
    showSectionTitle: true,
    itemsToShow: 6
};

// --- Seeding Function ---
async function seedContent() {
    console.log("🚀 Starting content seeding...");

    const collections = [
        { col: 'content', doc: 'profile', data: profileData },
        { col: 'content', doc: 'business', data: businessData },
        { col: 'content', doc: 'siteSettings', data: siteSettingsData },
        { col: 'content', doc: 'linkSettings', data: linkSettingsData },
        { col: 'content', doc: 'productSettings', data: productSettingsData }
    ];

    for (const item of collections) {
        try {
            const docRef = db.collection(item.col).doc(item.doc);
            const snapshot = await docRef.get();
            if (!snapshot.exists) {
                console.log(`Creating ${item.col}/${item.doc}...`);
                await docRef.set(item.data);
                console.log(`✅ Created ${item.doc}`);
            } else {
                console.log(`ℹ️ ${item.col}/${item.doc} already exists. Skipping.`);
            }
        } catch (error: any) {
            console.error('❌ Error seeding', item.doc + ':', error.message);
        }
    }

    console.log("✨ Content seeding complete!");
    process.exit(0);
}

seedContent().catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
});
