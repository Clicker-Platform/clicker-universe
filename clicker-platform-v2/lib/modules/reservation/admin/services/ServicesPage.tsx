import { getServices } from '@/lib/modules/reservation/api';
import ServicesClient from './ServicesClient';

export const dynamic = 'force-dynamic';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function ServicesPage() {
    const headersList = await headers();
    const siteId = headersList.get('x-site-id');

    if (!siteId) {
        redirect('/admin/login');
    }

    const services = await getServices(siteId);
    // Serialize to plain JSON to avoid "Only plain objects can be passed to Client Components" error
    // because Firestore returns complex objects (Timestamp)
    const serializedServices = JSON.parse(JSON.stringify(services));

    return <ServicesClient initialServices={serializedServices} />;
}
