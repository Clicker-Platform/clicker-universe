import React from 'react';
import { Product } from '@/data/mockData';



import { ProductsBlockClient } from './ProductsBlockClient';

export const DefaultProductsBlock = ({ data, phoneNumber, whatsappSettings, siteId, products: preFetchedProducts }: { data: Record<string, unknown>, phoneNumber?: string, whatsappSettings?: Record<string, unknown>, siteId?: string, products?: Product[] }) => {
    if (!siteId || !data) return null;

    let products = preFetchedProducts || [];

    // If specific IDs provided, filter and order the pre-fetched products
    const productIds = data?.productIds as string[] | undefined;
    if (productIds && productIds.length > 0) {
        products = productIds
            .map((id: string) => products.find(p => p.id === id))
            .filter((p): p is Product => Boolean(p));
    }
    // Otherwise use preFetchedProducts (which is all active products)

    if (products.length === 0) return null;

    return <ProductsBlockClient data={data} products={products} phoneNumber={phoneNumber} whatsappSettings={whatsappSettings} />;
};
