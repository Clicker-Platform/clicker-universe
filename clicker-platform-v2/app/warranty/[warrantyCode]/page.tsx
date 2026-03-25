/**
 * Public warranty card page — no authentication required.
 *
 * Uses a Firestore collectionGroup query to look up warrantyCards across all
 * tenants by warrantyCode (globally unique). This requires a collectionGroup
 * index in Firebase console:
 *   Collection group: warrantyCards
 *   Fields: warrantyCode ASC
 *
 * This route is registered in middleware.ts specialRoutes as 'warranty'
 * so it is NOT treated as a tenant slug.
 */

import { notFound } from 'next/navigation';
import { adminDb } from '@/lib/firebase-admin';
import WarrantyCardView from '@/lib/modules/service-records/public/WarrantyCardView';
import type { WarrantyCard, SerializedWarrantyCard } from '@/lib/modules/service-records/types';
import type { Timestamp } from 'firebase-admin/firestore';

interface Props {
    params: Promise<{ warrantyCode: string }>;
}

export async function generateMetadata({ params }: Props) {
    const { warrantyCode } = await params;
    return {
        title: `Warranty Card ${warrantyCode}`,
        description: 'View your service warranty certificate.',
    };
}

export default async function WarrantyCardPage({ params }: Props) {
    const { warrantyCode } = await params;

    // CollectionGroup query — warrantyCards exists under:
    // sites/{siteId}/modules/service_records/warrantyCards
    // Requires collectionGroup index: warrantyCards / warrantyCode ASC
    const snap = await adminDb
        .collectionGroup('warrantyCards')
        .where('warrantyCode', '==', warrantyCode.toUpperCase())
        .limit(1)
        .get();

    if (snap.empty) {
        notFound();
    }

    const doc = snap.docs[0];
    const data = doc.data() as Omit<WarrantyCard, 'id'>;

    // Serialize Firestore Timestamps → ISO strings for client component
    const card: SerializedWarrantyCard = {
        ...data,
        id: doc.id,
        serviceDate: (data.serviceDate as Timestamp).toDate().toISOString(),
        expiryDate: (data.expiryDate as Timestamp).toDate().toISOString(),
        createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
    };

    return <WarrantyCardView card={card} />;
}
