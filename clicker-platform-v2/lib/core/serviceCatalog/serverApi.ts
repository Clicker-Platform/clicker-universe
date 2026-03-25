import { adminDb } from '@/lib/firebase-admin';
import { ServiceCatalogItem } from './types';
import { SERVICE_CATALOG } from './api';

export async function fetchServiceCatalog(
    siteId: string,
    opts: { activeOnly?: boolean } = {}
): Promise<ServiceCatalogItem[]> {
    const col = adminDb
        .collection('sites')
        .doc(siteId)
        .collection(SERVICE_CATALOG);

    const snap = await (opts.activeOnly
        ? col.where('outletId', '==', siteId).where('isActive', '==', true).orderBy('name')
        : col.where('outletId', '==', siteId).orderBy('name')
    ).get();

    return snap.docs.map(d => ({ id: d.id, ...d.data() } as ServiceCatalogItem));
}
