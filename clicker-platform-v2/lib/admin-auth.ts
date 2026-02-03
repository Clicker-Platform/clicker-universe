import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, collectionGroup, doc, getDoc } from "firebase/firestore";

export interface UserSite {
    siteId: string;
    slug: string;
    role: string;
    name: string;
}

/**
 * Retrieves the list of sites a user has access to.
 * 
 * Strategy:
 * 1. Checks if user is an Owner (via 'ownerId' field on sites).
 * 2. Checks if user is a Member (via collectionGroup query on 'members').
 * 
 * Note: collectionGroup requires a composite index on 'userId' if filtered.
 * If index is missing, this might fail unless we catch it.
 */
export async function getUserSites(userId: string, email?: string | null): Promise<UserSite[]> {
    const sites: UserSite[] = [];
    const seenSiteIds = new Set<string>();

    try {
        // 1. Check for Owner sites (by ownerId)
        const ownerQuery = query(collection(db, 'sites'), where('ownerId', '==', userId));
        const ownerSnap = await getDocs(ownerQuery);

        // 2. Check for Owner sites (by ownerEmail) - Fallback for seeded data
        let emailSnap = null;
        if (email) {
            const emailQuery = query(collection(db, 'sites'), where('ownerEmail', '==', email));
            emailSnap = await getDocs(emailQuery);
        }

        const processDoc = (doc: any) => {
            const data = doc.data();
            if (!seenSiteIds.has(doc.id)) {
                sites.push({
                    siteId: doc.id,
                    slug: data.slug || doc.id,
                    role: 'owner', // Assume owner if matched by these fields
                    name: data.name || data.title || 'Untitled Site'
                });
                seenSiteIds.add(doc.id);
            }
        };

        ownerSnap.forEach(processDoc);
        if (emailSnap) emailSnap.forEach(processDoc);

        // 3. Check for Membership sites (Staff)
        // Use collectionGroup query to find all 'members' documents with matching email
        try {
            if (userId && email) {
                // Determine if we query by UID or Email. 
                // Our schema puts UID as document ID, but we also store email field.
                // collectionGroup queries work on fields.
                // We'll search by 'email' field.

                const membersQuery = query(
                    collectionGroup(db, 'members'),
                    where('email', '==', email)
                );

                const memberSnap = await getDocs(membersQuery);

                const membershipSitePromises = memberSnap.docs.map(async (memberDoc) => {
                    // memberDoc.ref.parent is the 'members' collection
                    // memberDoc.ref.parent.parent is the 'sites/{siteId}' document
                    const siteRef = memberDoc.ref.parent.parent;

                    if (siteRef && !seenSiteIds.has(siteRef.id)) {
                        seenSiteIds.add(siteRef.id); // Mark as seen immediately to prevent dupes in parallel

                        // We need to fetch the site doc to get the name/slug
                        // Optimisation: We could just return the ID, but UI needs names.
                        try {
                            // We need to fetch the site doc to get the name/slug
                            try {
                                // Let's try to fetch the site data
                                // We can use the existing db instance
                                // Re-construct ref to be safe
                                const safeSiteRef = doc(db, 'sites', siteRef.id);
                                const siteDocSnap = await getDoc(safeSiteRef);

                                if (siteDocSnap.exists()) {
                                    const data = siteDocSnap.data();
                                    const memberData = memberDoc.data();

                                    return {
                                        siteId: siteDocSnap.id,
                                        slug: data.slug || siteDocSnap.id,
                                        role: memberData.role || 'staff',
                                        name: data.name || data.title || 'Untitled Site (Staff)'
                                    } as UserSite;
                                }
                            } catch (err) {
                                console.error("Failed to fetch site details for member match:", siteRef.id, err);
                            }
                        } catch (err) {
                            console.error("Failed to fetch site details for member match:", siteRef.id, err);
                        }
                    }
                    return null;
                });

                const memberSites = await Promise.all(membershipSitePromises);

                // Add valid found sites
                memberSites.forEach(site => {
                    if (site) sites.push(site);
                });
            }

        } catch (e: any) {
            console.warn("Membership lookup failed. This is likely due to a missing Collection Group Index on 'members' -> 'email'.");
            console.warn("Please create this index in Firebase Console: Firestore -> Indexes -> Collection Group");
            console.error(e);
        }

    } catch (e) {
        console.error("[getUserSites] Error fetching user sites for user:", userId, e);
    }

    console.log("[getUserSites] Returning sites:", sites);
    return sites;
}
