import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, collectionGroup, getDoc, doc } from 'firebase/firestore';

export interface UserSite {
    siteId: string;
    slug: string;
    name: string;
}

export async function getUserSites(uid: string, email: string | null): Promise<UserSite[]> {
    const sites: UserSite[] = [];
    const seen = new Set<string>();

    // 1. Owner by ownerId
    const ownerSnap = await getDocs(query(collection(db, 'sites'), where('ownerId', '==', uid)));
    ownerSnap.forEach(d => {
        if (!seen.has(d.id)) {
            seen.add(d.id);
            sites.push({ siteId: d.id, slug: d.data().slug || d.id, name: d.data().name || 'My Site' });
        }
    });

    // 2. Owner by ownerEmail (fallback for seeded data)
    if (email && sites.length === 0) {
        const emailSnap = await getDocs(query(collection(db, 'sites'), where('ownerEmail', '==', email)));
        emailSnap.forEach(d => {
            if (!seen.has(d.id)) {
                seen.add(d.id);
                sites.push({ siteId: d.id, slug: d.data().slug || d.id, name: d.data().name || 'My Site' });
            }
        });
    }

    // 3. Staff member (collectionGroup)
    if (email && sites.length === 0) {
        try {
            const memberSnap = await getDocs(query(collectionGroup(db, 'members'), where('email', '==', email)));
            await Promise.all(memberSnap.docs.map(async memberDoc => {
                const siteRef = memberDoc.ref.parent.parent;
                if (!siteRef || seen.has(siteRef.id)) return;
                seen.add(siteRef.id);
                const siteDoc = await getDoc(doc(db, 'sites', siteRef.id));
                if (siteDoc.exists()) {
                    sites.push({ siteId: siteDoc.id, slug: siteDoc.data().slug || siteDoc.id, name: siteDoc.data().name || 'My Site' });
                }
            }));
        } catch { /* missing index — graceful skip */ }
    }

    return sites;
}
