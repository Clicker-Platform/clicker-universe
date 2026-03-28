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
import { headers } from 'next/headers';
import { db } from '@/lib/firebase';
import { collectionGroup, query, where, limit, getDocs, Timestamp } from 'firebase/firestore';
import WarrantyCardView from '@/lib/modules/service-records/public/WarrantyCardView';
import type { WarrantyCard, SerializedWarrantyCard } from '@/lib/modules/service-records/types';

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
    const q = query(
        collectionGroup(db, 'warrantyCards'),
        where('warrantyCode', '==', warrantyCode.toUpperCase()),
        limit(1)
    );
    const snap = await getDocs(q);

    if (snap.empty) {
        notFound();
    }

    const docSnap = snap.docs[0];
    const data = docSnap.data() as Omit<WarrantyCard, 'id'>;

    // Serialize Firestore Timestamps → ISO strings for client component
    const card: SerializedWarrantyCard = {
        ...data,
        id: docSnap.id,
        serviceDate: (data.serviceDate as Timestamp).toDate().toISOString(),
        expiryDate: (data.expiryDate as Timestamp).toDate().toISOString(),
        createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
    };

    // Build full warranty URL server-side to avoid hydration mismatch in QR code
    const headersList = await headers();
    const host = headersList.get('host') || 'localhost:3000';
    const protocol = headersList.get('x-forwarded-proto') || 'http';
    const warrantyUrl = `${protocol}://${host}/warranty/${warrantyCode.toUpperCase()}`;

    return <WarrantyCardView card={card} warrantyUrl={warrantyUrl} />;
}
