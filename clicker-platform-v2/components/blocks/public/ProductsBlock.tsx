import React from 'react';
import { db } from "@/lib/firebase"; // Using Client SDK in Server Component is tricky in Next.js + Firebase unless using admin SDK
// BUT, since we are in `app` dir, we can technically use Client SDK if initialized, but strictly server components usually prefer Admin SDK.
// However, `lib/firebase` initializes client SDK. This works in Next.js Server Components for reading if auth is not an issue (public data).
// Better: Use `lib/firebase-admin` if available, or just client SDK if simple. Existing code uses client SDK for public fetch.
// Let's stick to consistent pattern: `getDocs` works in server components.

// getDocs, query, where, documentId, collection removed as we use getDoc/doc now
import { Product } from '@/data/mockData';


import { doc, getDoc } from "firebase/firestore";

async function getProductsByIds(siteId: string, ids: string[]) {
    if (!ids || !Array.isArray(ids) || ids.length === 0 || !siteId) return [];

    try {
        // Fetch products in parallel to preserve order and avoid 'in' query limitations
        const productPromises = ids.map(async (id) => {
            if (!id) return null;
            try {
                const docRef = doc(db, 'sites', siteId, 'products', id);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = docSnap.data();
                    return {
                        id: docSnap.id,
                        name: data.title || data.name || 'Untitled Product',
                        price: data.price || '',
                        description: data.description || '',
                        imageUrl: data.image || data.imageUrl || '',
                        category: data.category || '',
                        images: data.images || []
                    } as Product;
                }
                return null;
            } catch (e) {
                console.error(`Failed to fetch product ${id}`, e);
                return null;
            }
        });

        const results = await Promise.all(productPromises);
        return results.filter((p): p is Product => p !== null);
    } catch (error) {
        console.error("Error fetching block products:", error);
        return [];
    }
}

import { ProductsBlockClient } from './ProductsBlockClient';

export const ProductsBlock = async ({ data, phoneNumber, whatsappSettings, siteId, products: preFetchedProducts }: { data: any, phoneNumber?: string, whatsappSettings?: any, siteId?: string, products?: any[] }) => {
    if (!siteId) return null;

    let products = preFetchedProducts || [];

    // If specific IDs provided, prefer fetching those
    if (data.productIds && data.productIds.length > 0) {
        products = await getProductsByIds(siteId, data.productIds);
    }
    // Otherwise use preFetchedProducts (which is all active products)

    if (products.length === 0) return null;

    return <ProductsBlockClient data={data} products={products} phoneNumber={phoneNumber} whatsappSettings={whatsappSettings} />;
};
