import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, collectionGroup, getDoc, doc, QuerySnapshot, QueryDocumentSnapshot, DocumentSnapshot } from 'firebase/firestore';

export interface UserSite {
    siteId: string;
    slug: string;
    name: string;
}

type SiteLike = { id: string; data: () => Record<string, unknown> };

function toSite(d: SiteLike): UserSite {
    const data = d.data();
    return {
        siteId: d.id,
        slug: (data.slug as string) || d.id,
        name: (data.name as string) || 'My Site',
    };
}

export async function getUserSites(uid: string, email: string | null): Promise<UserSite[]> {
    const seen = new Set<string>();
    const sites: UserSite[] = [];

    // 1+2. Query ownerId & ownerEmail in parallel — saves ~200ms for email-based fallback
    const queries: Promise<QuerySnapshot | null>[] = [
        getDocs(query(collection(db, 'sites'), where('ownerId', '==', uid))),
        email ? getDocs(query(collection(db, 'sites'), where('ownerEmail', '==', email))) : Promise.resolve(null),
    ];
    const [ownerSnap, emailSnap] = await Promise.all(queries);

    ownerSnap?.forEach((d: QueryDocumentSnapshot) => {
        if (!seen.has(d.id)) { seen.add(d.id); sites.push(toSite(d)); }
    });
    if (emailSnap) {
        emailSnap.forEach((d: QueryDocumentSnapshot) => {
            if (!seen.has(d.id)) { seen.add(d.id); sites.push(toSite(d)); }
        });
    }

    if (sites.length > 0) return sites;

    // 3. Staff member (collectionGroup) — only if not an owner
    if (email) {
        try {
            const memberSnap = await getDocs(query(collectionGroup(db, 'members'), where('email', '==', email)));
            await Promise.all(memberSnap.docs.map(async memberDoc => {
                const siteRef = memberDoc.ref.parent.parent;
                if (!siteRef || seen.has(siteRef.id)) return;
                seen.add(siteRef.id);
                const siteDoc: DocumentSnapshot = await getDoc(doc(db, 'sites', siteRef.id));
                if (siteDoc.exists()) sites.push(toSite(siteDoc as SiteLike));
            }));
        } catch { /* missing index — graceful skip */ }
    }

    return sites;
}
