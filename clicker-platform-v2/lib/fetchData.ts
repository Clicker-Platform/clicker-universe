import { cache } from 'react';
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { BusinessProfile, LinkItem, Product, SocialLink, SiteSettings, SocialLinkItem, initialBusinessHours, BusinessHours, Page, PageBlock, BusinessContact, Branch, initialBusinessContact, LinkSettings, ProductSettings } from "@/data/mockData";
import { TemplateId } from "@/lib/templates/types";
import { ICON_MAP } from "@/data/icons";

// Helper to map icon names string back to Lucide components
const IconMap = ICON_MAP;

/** Recursively converts Firestore Timestamp objects (and anything with toJSON/toMillis) to plain values so they can be passed to Client Components. */
function stripFirestoreTypes(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj?.toMillis === 'function') return obj.toMillis();
    if (typeof obj?.toJSON === 'function') return obj.toJSON();
    if (Array.isArray(obj)) return obj.map(stripFirestoreTypes);
    if (obj instanceof Date) return obj.toISOString();
    if (typeof obj === 'object') {
        const out: Record<string, any> = {};
        for (const k in obj) out[k] = stripFirestoreTypes(obj[k]);
        return out;
    }
    return obj;
}

function logDebug(msg: string) {
    if (process.env.NODE_ENV === 'development') {
        console.log(`[DEBUG] ${msg}`);
    }
}

export const fetchPublicData = cache(async function fetchPublicData(siteId: string, options: { includeProducts?: boolean } = { includeProducts: true }) {
    if (!siteId || siteId === 'default' || siteId === 'pending') {
        logDebug(`Skipping fetchPublicData for invalid siteId: ${siteId}`);
        return {
            profile: null,
            links: [],
            socialLinks: [],
            products: [],
            featuredProduct: null,
            businessHours: initialBusinessHours,
            contact: initialBusinessContact,
            branches: [],
            templateId: 'classic',
            footerText: '',
            hideFooterContact: false,
            showHeaderAddress: false,
            homeBlockOrder: [],
            hiddenBlockIds: [],
            linkSettings: { sectionTitle: '', showOnHome: false },
            productSettings: { galleryTitle: '', showSectionTitle: false, itemsToShow: 0 },
            homepageSlug: undefined,
            businessSchedule: initialBusinessHours.schedule
        } as any;
    }
    logDebug(`Fetching public data for siteId: ${siteId}`);
    // Execute all independent fetches in parallel with individual error handling
    const [
        profileSnap,
        linksSnap,
        productsSnap,
        featuredSnap,
        settings,
        businessResult,
        branchesResult,
        linkSettings,
        productSettings
    ] = await Promise.all([
        getDoc(doc(db, "sites", siteId, "content", "profile")).then(r => { logDebug('Profile: Success'); return r; }).catch(e => { logDebug(`Profile: Error ${e}`); return { exists: () => false, data: () => null } as any; }),
        getDocs(collection(db, "sites", siteId, "links")).then(r => { logDebug('Links: Success'); return r; }).catch(e => { logDebug(`Links: Error ${e}`); return { docs: [] } as any; }),
        options.includeProducts ? getDocs(collection(db, "sites", siteId, "products")).then(r => { logDebug('Products: Success'); return r; }).catch(e => { logDebug(`Products: Error ${e}`); return { docs: [] } as any; }) : Promise.resolve(null),
        getDoc(doc(db, "sites", siteId, "content", "featuredProduct")).then(r => { logDebug('Featured: Success'); return r; }).catch(e => { logDebug(`Featured: Error ${e}`); return { exists: () => false, data: () => null } as any; }),
        fetchSiteSettings(siteId).then(r => { logDebug('Settings: Success'); return r; }).catch(e => { logDebug(`Settings: Error ${e}`); return null; }),
        getDoc(doc(db, "sites", siteId, "content", "business")).then(snap => ({ success: true, snap } as const)).catch(error => { logDebug(`Business: Error ${error}`); return { success: false, error } as const; }),
        getDocs(query(collection(db, "sites", siteId, "branches"), orderBy("order", "asc"))).then(snap => ({ success: true, snap } as const)).catch(error => { logDebug(`Branches: Error ${error}`); return { success: false, error } as const; }),
        fetchLinkSettings(siteId).then(r => { logDebug('LinkSettings: Success'); return r; }).catch(e => { logDebug(`LinkSettings: Error ${e}`); return null; }),
        fetchProductSettings(siteId).then(r => { logDebug('ProductSettings: Success'); return r; }).catch(e => { logDebug(`ProductSettings: Error ${e}`); return null; })
    ]);

    // Process Profile
    const profile = profileSnap.exists() ? profileSnap.data() as BusinessProfile : null;

    // Process Links
    const links = (linksSnap.docs || []).map((doc: any) =>
        stripFirestoreTypes({ ...doc.data(), id: doc.id }) as LinkItem
    );
    // Sort links by order
    links.sort((a: LinkItem, b: LinkItem) => (a.order || 0) - (b.order || 0));

    // Process Products (Optional)
    let products: Product[] = [];
    if (productsSnap) {
        products = (productsSnap.docs || [])
            .map((doc: any) => {
                const data = doc.data();
                return {
                    id: doc.id,
                    name: data.name || data.title || 'Untitled Product',
                    price: data.price ? String(data.price) : '',
                    imageUrl: data.imageUrl || data.image || '',
                    description: data.description || '',
                    category: data.category || 'All',
                    images: data.images || [],
                    isActive: data.isActive !== false,
                    showPrice: data.showPrice !== false,
                    showLabel: data.showLabel !== false
                } as Product;
            })
            .filter((p: Product) => p.isActive) // Filter out inactive products
            .sort((a: Product, b: Product) => a.name.localeCompare(b.name));
    }

    // Process Featured Product
    let featuredProduct: Product | null = null;
    if (featuredSnap.exists()) {
        const featuredData = featuredSnap.data();
        // Support both old format (full object with originalId) and new format (just productId)
        const featuredId = featuredData.productId || featuredData.originalId;

        if (featuredId) {
            if (products.length > 0) {
                // If we already fetched products, just find it
                featuredProduct = products.find(p => p.id === featuredId) || null;
            } else {
                // Otherwise fetch it individually
                // Note: This is an additional fetch, but necessary if products weren't requested or not found
                // We could include this in the initial Promise.all if we knew the ID beforehand, but we don't.
                // Optimally, includeProducts=true is the common case, so this is fast.
                const pSnap = await getDoc(doc(db, "sites", siteId, "products", featuredId));
                if (pSnap.exists()) {
                    const data = pSnap.data();
                    featuredProduct = {
                        id: pSnap.id,
                        name: data.name || data.title || 'Untitled Product',
                        price: data.price ? String(data.price) : '',
                        imageUrl: data.imageUrl || data.image || '',
                        description: data.description || '',
                        category: data.category || 'All',
                        images: data.images || [],
                        isActive: data.isActive !== false,
                        showPrice: data.showPrice !== false,
                        showLabel: data.showLabel !== false
                    } as Product;
                }
            }
        }
    }

    // Process Socials (from settings doc)
    const socialLinks = settings?.socialLinkItems || [];

    // Process Business Settings
    let businessHours = initialBusinessHours;
    let contact = initialBusinessContact;

    if (businessResult.success && businessResult.snap && businessResult.snap.exists()) {
        const businessSnap = businessResult.snap;
        businessHours = stripFirestoreTypes(businessSnap.data()) as BusinessHours;
        const data = businessSnap.data();
        contact = {
            whatsapp: data.whatsapp || "",
            email: data.email || "",
            address: data.address || "",
            mapUrl: data.mapUrl || ""
        };
    } else if (!businessResult.success) {
        console.error("Error fetching business settings:", businessResult.error);
    }

    // Process Branches
    let branches: Branch[] = [];
    if (branchesResult.success && branchesResult.snap) {
        branches = branchesResult.snap.docs.map(doc =>
            stripFirestoreTypes({ id: doc.id, ...doc.data() }) as Branch
        );
    } else if (!branchesResult.success) {
        console.error("Error fetching branches:", branchesResult.error);
    }

    return {
        profile,
        links,
        socialLinks,
        products,
        featuredProduct,
        businessHours,
        contact,
        branches,
        templateId: (settings?.templateId || settings?.layoutStyle || 'classic') as TemplateId,
        footerText: settings?.footerText || '© 2024 SunnySide',
        hideFooterContact: settings?.hideFooterContact || false,
        showHeaderAddress: settings?.showHeaderAddress || false,
        homeBlockOrder: settings?.homeBlockOrder || ['quick_actions', 'branches', 'featured', 'gallery', 'hours'],
        themeColor: settings?.themeColor,
        accentColor: settings?.accentColor,
        hiddenBlockIds: settings?.hiddenBlockIds || [],
        galleryTitle: settings?.galleryTitle,
        borderRadius: settings?.borderRadius || 'large',
        globalSeo: settings?.seo,
        globalPixels: settings?.pixels,
        linkSettings: linkSettings,
        productSettings: productSettings,
        homepageSlug: settings?.homepageSlug,
        businessSchedule: businessHours.schedule
    };
});

export const fetchSiteSettings = cache(async function fetchSiteSettings(siteId: string) {
    if (!siteId || siteId === 'default' || siteId === 'pending') return null;
    try {
        const snap = await getDoc(doc(db, "sites", siteId, "content", "siteSettings"));
        if (snap.exists()) {
            return snap.data() as SiteSettings;
        }
        return null;
    } catch (e) {
        logDebug(`fetchSiteSettings: Error ${e}`);
        return null;
    }
});

export async function fetchPageBySlug(siteId: string, slug: string) {
    try {
        const q = query(collection(db, "sites", siteId, "pages"), where("slug", "==", slug));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            return null;
        }

        const doc = querySnapshot.docs[0];
        return {
            id: doc.id,
            ...doc.data()
        } as Page;
    } catch (e) {
        console.error(`Error fetching page with slug ${slug}:`, e);
        return null;
    }
}

export async function fetchPages(siteId: string) {
    try {
        const querySnapshot = await getDocs(collection(db, "sites", siteId, "pages"));
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as Page));
    } catch (e) {
        logDebug(`fetchPages: Error ${e}`);
        return [];
    }
}

export async function fetchLinkSettings(siteId: string) {
    try {
        const snap = await getDoc(doc(db, "sites", siteId, "content", "linkSettings"));
        if (snap.exists()) {
            return snap.data() as LinkSettings;
        }
    } catch (e) {
        logDebug(`fetchLinkSettings: Error ${e}`);
    }
    return { sectionTitle: "Quick Actions", showOnHome: true } as LinkSettings;
}

export async function fetchProductSettings(siteId: string) {
    try {
        const snap = await getDoc(doc(db, "sites", siteId, "content", "productSettings"));
        if (snap.exists()) {
            return snap.data() as ProductSettings;
        }
    } catch (e) {
        logDebug(`fetchProductSettings: Error ${e}`);
    }
    return { galleryTitle: "More Treats", showSectionTitle: true, itemsToShow: 6 } as ProductSettings;
}
export const fetchLightweightPublicData = cache(async function fetchLightweightPublicData(siteId: string) {
    // Fetch only essential data for content pages (Profile, Settings, Contact)
    const nullSnap = { exists: () => false, data: () => null } as any;
    const [
        profileSnap,
        settings,
        businessSnap
    ] = await Promise.all([
        getDoc(doc(db, "sites", siteId, "content", "profile")).catch(e => { logDebug(`fetchLightweightPublicData profile: Error ${e}`); return nullSnap; }),
        fetchSiteSettings(siteId),
        getDoc(doc(db, "sites", siteId, "content", "business")).catch(e => { logDebug(`fetchLightweightPublicData business: Error ${e}`); return nullSnap; }),
    ]);

    // Process Profile
    const profile = profileSnap.exists() ? profileSnap.data() as BusinessProfile : null;

    // Process Business Settings (Contact/Hours)
    let businessHours = initialBusinessHours;
    let contact = initialBusinessContact;

    if (businessSnap.exists()) {
        const data = businessSnap.data();
        businessHours = data as BusinessHours; // Assuming structure matches or we map it
        // Re-map contact fields just in case
        contact = {
            whatsapp: data.whatsapp || "",
            email: data.email || "",
            address: data.address || "",
            mapUrl: data.mapUrl || ""
        };
    }

    // Return strict subset required for SharedPageLayout
    // We return empty arrays for lists we didn't fetch to satisfy the interface
    return {
        profile,
        links: [], // Not fetched
        socialLinks: settings?.socialLinkItems || [],
        products: [], // Not fetched
        featuredProduct: null, // Not fetched
        businessHours,
        contact,
        branches: [], // Not fetched
        templateId: (settings?.templateId || settings?.layoutStyle || 'classic') as TemplateId,
        footerText: settings?.footerText || '© 2024 SunnySide',
        hideFooterContact: settings?.hideFooterContact || false,
        showHeaderAddress: settings?.showHeaderAddress || false,
        homeBlockOrder: settings?.homeBlockOrder || [],
        themeColor: settings?.themeColor,
        accentColor: settings?.accentColor,
        hiddenBlockIds: settings?.hiddenBlockIds || [],
        galleryTitle: settings?.galleryTitle,
        borderRadius: settings?.borderRadius || 'large',
        globalSeo: settings?.seo,
        globalPixels: settings?.pixels,
        linkSettings: { sectionTitle: '', showOnHome: false }, // Placeholder
        productSettings: {
            galleryTitle: '',
            showSectionTitle: false,
            itemsToShow: 0,
            whatsappBtnLabel: '',
            whatsappMessageTemplate: '',
            whatsappBtnColor: '',
            whatsappBtnTextColor: ''
        }, // Placeholder
        homepageSlug: settings?.homepageSlug,
        businessSchedule: businessHours.schedule
    };
});

import { getServices, getReservationSettings } from '@/lib/modules/reservation/api';
import { getStaffMembers } from '@/lib/modules/reservation/staff';

export async function hydratePageBlocks(siteId: string, blocks: PageBlock[]) {
    const data: {
        links?: LinkItem[];
        products?: Product[];
        featuredProduct?: Product | null;
        branches?: Branch[];
        linkSettings?: LinkSettings;
        productSettings?: ProductSettings;
        reservationServices?: any[];
        reservationStaff?: any[];
        reservationSettings?: any;
    } = {};

    if (!blocks || blocks.length === 0) return data;

    const blockTypes = blocks.map(b => b.type);
    
    const needsLinks = blockTypes.includes('quick_actions');
    const needsProducts = blockTypes.includes('products');
    const needsFeatured = blockTypes.includes('featured_product');
    const needsBranches = blockTypes.includes('branches');
    const needsReservation = blockTypes.includes('reservation');

    const promises: Promise<void>[] = [];

    if (needsLinks) {
        promises.push(
            getDocs(collection(db, "sites", siteId, "links"))
                .then(snap => {
                    const links = snap.docs.map(doc =>
                        stripFirestoreTypes({ ...doc.data(), id: doc.id }) as LinkItem
                    );
                    links.sort((a, b) => (a.order || 0) - (b.order || 0));
                    data.links = links;
                })
                .catch(e => { console.error("Error fetching links", e); data.links = []; }),
            fetchLinkSettings(siteId)
                .then(res => { if (res) data.linkSettings = res; })
                .catch(e => console.error("Error fetching link settings", e))
        );
    }

    if (needsProducts || needsFeatured) {
        promises.push(
            getDocs(collection(db, "sites", siteId, "products"))
                .then(async snap => {
                    const products = snap.docs.map(doc => {
                        const productData = doc.data();
                        return {
                            ...productData,
                            id: doc.id,
                            name: productData.name || productData.title || 'Untitled Product',
                            price: productData.price ? String(productData.price) : '',
                            imageUrl: productData.imageUrl || productData.image || '',
                            description: productData.description || '',
                            category: productData.category || 'All',
                            images: productData.images || [],
                            isActive: productData.isActive !== false,
                            showPrice: productData.showPrice !== false,
                            showLabel: productData.showLabel !== false
                        } as Product;
                    }).filter(p => p.isActive).sort((a, b) => a.name.localeCompare(b.name));
                    
                    data.products = products;

                    if (needsFeatured) {
                        const featuredSnap = await getDoc(doc(db, "sites", siteId, "content", "featuredProduct"));
                        if (featuredSnap.exists()) {
                            const featuredData = featuredSnap.data();
                            const featuredId = featuredData?.productId || featuredData?.originalId;
                            data.featuredProduct = products.find(p => p.id === featuredId) || null;
                        } else {
                            data.featuredProduct = null;
                        }
                    }
                })
                .catch(e => { console.error("Error fetching products", e); data.products = []; data.featuredProduct = null; }),
            fetchProductSettings(siteId)
                .then(res => { if (res) data.productSettings = res; })
                .catch(e => console.error("Error fetching product settings", e))
        );
    }

    if (needsBranches) {
        promises.push(
            getDocs(query(collection(db, "sites", siteId, "branches"), orderBy("order", "asc")))
                .then(snap => {
                    data.branches = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Branch));
                })
                .catch(e => { console.error("Error fetching branches", e); data.branches = []; })
        );
    }

    if (needsReservation) {
        promises.push(
            Promise.all([
                getServices(siteId),
                getStaffMembers(siteId, true),
                getReservationSettings(siteId)
            ])
                .then(([services, staff, settings]) => {
                    // Strip Firestore Timestamps (toJSON converts them to { seconds, nanoseconds })
                    // without the cost of a full JSON.parse(JSON.stringify()) round-trip.
                    const stripTimestamps = (obj: any): any => {
                        if (obj === null || obj === undefined) return obj;
                        if (typeof obj?.toJSON === 'function') return obj.toJSON();
                        if (Array.isArray(obj)) return obj.map(stripTimestamps);
                        if (typeof obj === 'object') {
                            const out: Record<string, any> = {};
                            for (const k in obj) out[k] = stripTimestamps(obj[k]);
                            return out;
                        }
                        return obj;
                    };
                    data.reservationServices = stripTimestamps(
                        services.filter((s: any) => s.isActive !== false)
                    );
                    data.reservationStaff = stripTimestamps(staff);
                    data.reservationSettings = stripTimestamps(settings);
                })
                .catch(e => {
                    console.error("Error fetching reservation data", e);
                    data.reservationServices = [];
                    data.reservationStaff = [];
                    data.reservationSettings = {};
                })
        );
    }

    await Promise.all(promises);
    return data;
}
