import { getPOSDataServer } from '../api-server';
import { POSBlock } from './POSWidget';

import { headers } from 'next/headers';

export default async function POSBlockServer() {
    const headersList = await headers();
    const siteId = headersList.get('x-site-id') || '';

    // 1. Fetch Data Server-Side (No "Loading..." spinor on client)
    const { initialItems } = await getPOSDataServer(siteId);

    // 2. Pass data to Client Component for hydration
    return (
        <POSBlock
            initialItems={initialItems}
        />
    );
}
