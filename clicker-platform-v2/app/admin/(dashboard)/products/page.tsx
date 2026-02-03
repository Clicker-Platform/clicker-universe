'use client';

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import ProductsManager from './ProductsClient';
import { useSite } from '@/lib/site-context'; // New import
// Local definition matching ProductsClient
interface Product {
    id: string;
    title: string;
    price: string;
    image: string;
    category: string;
    description?: string;
    isFeatured?: boolean;
    images?: string[];
    isActive?: boolean;
}
import { Loader2 } from 'lucide-react';
import { ProductsSkeleton } from '@/components/skeletons/ProductsSkeleton';

export default function ProductsPage() {
    const { siteId } = useSite();
    const [products, setProducts] = useState<Product[]>([]);
    const [featuredId, setFeaturedId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchProductsData() {
            if (!siteId) return; // Wait for siteId
            try {
                // 1. Fetch Products
                const productsSnap = await getDocs(collection(db, 'sites', siteId, 'products'));
                const fetchedProducts = productsSnap.docs.map(doc => {
                    const data = doc.data();

                    return {
                        id: doc.id,
                        title: data.name || data.title || '',
                        price: data.price || '',
                        image: data.imageUrl || data.image || '',
                        category: data.category || '',
                        description: data.description || '',
                        isFeatured: data.isFeatured || false,
                        images: data.images || [],
                        isActive: data.isActive !== false
                    };
                });

                // 2. Fetch Featured
                const featuredSnap = await getDoc(doc(db, 'sites', siteId, 'content', 'featuredProduct'));
                let fetchedFeaturedId = null;
                if (featuredSnap.exists()) {
                    const data = featuredSnap.data();
                    fetchedFeaturedId = data?.originalId || data?.id || null;
                }

                setProducts(fetchedProducts);
                setFeaturedId(fetchedFeaturedId);
            } catch (error) {
                console.error("Error fetching products:", error);
            } finally {
                setLoading(false);
            }
        }

        fetchProductsData();
    }, [siteId]);

    if (loading) {
        return <ProductsSkeleton />;
    }

    return (
        <ProductsManager
            initialProducts={products}
            initialFeaturedId={featuredId}
        />
    );
}
