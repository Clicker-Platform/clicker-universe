import { db } from '@/lib/firebase';
import { doc, getDoc, collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { logger } from '@/lib/logger';
import { BusinessHours, BusinessContact, Branch, initialBusinessHours, initialBusinessContact } from '@/data/mockData';
import BusinessSettingsClient from './BusinessSettingsClient';
import { headers } from 'next/headers';

async function fetchBusinessData(siteId: string) {
    let hours = initialBusinessHours;
    let contact = initialBusinessContact;
    let branches: Branch[] = [];
    let hasBranches = false;

    if (!siteId) return { hours, contact, branches, hasBranches };

    try {
        const docRef = doc(db, 'sites', siteId, 'content', 'business');
        const branchesRef = collection(db, 'sites', siteId, 'branches');
        const q = query(branchesRef, orderBy('order', 'asc'), limit(100));

        const [docSnap, branchesSnap] = await Promise.all([getDoc(docRef), getDocs(q)]);

        if (docSnap.exists()) {
            const data = docSnap.data();

            if (data.enabled !== undefined) hours = { ...initialBusinessHours, ...data };

            contact = {
                whatsapp: data.whatsapp || '',
                email: data.email || '',
                address: data.address || '',
                mapUrl: data.mapUrl || ''
            };

            hasBranches = data.hasBranches === true;
        }

        branches = branchesSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as Branch));

    } catch (error) {
        logger.error('admin.business.settings.fetch.failed', { siteId: 'platform', error });
    }

    return { hours, contact, branches, hasBranches };
}

export default async function BusinessSettingsPage() {
    const headersList = await headers();
    const siteId = headersList.get('x-site-id') || '';
    const { hours, contact, branches, hasBranches } = await fetchBusinessData(siteId);

    return (
        <BusinessSettingsClient
            initialHours={hours}
            initialContact={contact}
            initialBranches={branches}
            initialHasBranches={hasBranches}
        />
    );
}
