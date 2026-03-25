import { getServiceCatalog } from '@/lib/core/serviceCatalog/api';
import ServiceCatalogClient from './ServiceCatalogClient';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function ServicesPage() {
    const headersList = await headers();
    const siteId = headersList.get('x-site-id');

    if (!siteId) {
        redirect('/admin/login');
    }

    const items = await getServiceCatalog(siteId);
    const serialized = JSON.parse(JSON.stringify(items));

    return <ServiceCatalogClient initialItems={serialized} />;
}
