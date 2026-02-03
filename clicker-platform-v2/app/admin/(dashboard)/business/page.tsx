import { db } from '@/lib/firebase';
import { doc, getDoc, collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { BusinessHours, BusinessContact, Branch, initialBusinessHours, initialBusinessContact } from '@/data/mockData';
import BusinessSettingsClient from './BusinessSettingsClient';
import { headers } from 'next/headers';

async function fetchBusinessData(siteId: string) {
    let hours = initialBusinessHours;
    let contact = initialBusinessContact;
    let branches: Branch[] = [];

    if (!siteId) return { hours, contact, branches };

    try {
        // Fetch Main Business Settings (Hours + Contact)
        const docRef = doc(db, 'sites', siteId, 'content', 'business');
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            // Assuming combined storage or partial updates. 
            // We map what we find, falling back to defaults.
            if (data.enabled !== undefined) hours = { ...initialBusinessHours, ...data }; // Heuristic to detect hours data
            // If we store contact in the same doc (which we will), extract it. 
            // However, since we are transitioning, we might need to handle mixed data.
            // Let's assume we will store contact fields at the root of the doc too, or nested?
            // Let's store contact in a 'contact' field for cleanliness, OR top level.
            // Plan said "merged data". Let's stick to top level fields for simplicity but separate interface in code.
            // Actually, to avoid collisions, let's look at the fields.
            // BusinessHours: enabled, label, tagText, monFri, satSun
            // BusinessContact: whatsapp, email, address, mapUrl
            // No overlap. Safe to merge at top level.

            contact = {
                whatsapp: data.whatsapp || "",
                email: data.email || "",
                address: data.address || "",
                mapUrl: data.mapUrl || ""
            };
        }

        // Fetch Branches
        const branchesRef = collection(db, 'sites', siteId, 'branches');
        const q = query(branchesRef, orderBy('order', 'asc'), limit(100)); // Limit to prevent unbounded growth checks
        const branchesSnap = await getDocs(q);

        branches = branchesSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as Branch));

    } catch (error) {
        console.error("Error fetching business settings:", error);
    }

    return { hours, contact, branches };
}

export default async function BusinessSettingsPage() {
    const headersList = await headers();
    const siteId = headersList.get('x-site-id') || '';
    const { hours, contact, branches } = await fetchBusinessData(siteId);

    return <BusinessSettingsClient initialHours={hours} initialContact={contact} initialBranches={branches} />;
}
