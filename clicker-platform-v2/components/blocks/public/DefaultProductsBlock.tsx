import React from 'react';
import { db } from "@/lib/firebase"; // Using Client SDK in Server Component is tricky in Next.js + Firebase unless using admin SDK
// BUT, since we are in `app` dir, we can technically use Client SDK if initialized, but strictly server components usually prefer Admin SDK.
// However, `lib/firebase` initializes client SDK. This works in Next.js Server Components for reading if auth is not an issue (public data).
// Better: Use `lib/firebase-admin` if available, or just client SDK if simple. Existing code uses client SDK for public fetch.
// Let's stick to consistent pattern: `getDocs` works in server components.

// getDocs, query, where, documentId, collection removed as we use getDoc/doc now
import { Product } from '@/data/mockData';


import { doc, getDoc } from "firebase/firestore";



import { ProductsBlockClient } from './ProductsBlockClient';

export const DefaultProductsBlock = ({ data, phoneNumber, whatsappSettings, siteId, products: preFetchedProducts }: { data: any, phoneNumber?: string, whatsappSettings?: any, siteId?: string, products?: any[] }) => {
    if (!siteId || !data) return null;

    let products = preFetchedProducts || [];

    // If specific IDs provided, filter and order the pre-fetched products
    if (data?.productIds && data?.productIds.length > 0) {
        products = data.productIds
            .map((id: string) => products.find(p => p.id === id))
            .filter(Boolean);
    }
    // Otherwise use preFetchedProducts (which is all active products)

    if (products.length === 0) return null;

    return <ProductsBlockClient data={data} products={products} phoneNumber={phoneNumber} whatsappSettings={whatsappSettings} />;
};
