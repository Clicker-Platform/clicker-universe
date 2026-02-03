'use client';

import { useState, useMemo, useCallback } from 'react';
import { Product } from '@/data/mockData';
import { ProductCard } from '@/components/catalog/ProductCard';
import { CategoryTabs } from '@/components/catalog/CategoryTabs';
import { SearchBar } from '@/components/catalog/SearchBar';
import { ProductDetailModal } from '@/components/catalog/ProductDetailModal';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useDebounce } from '@/hooks/useDebounce';

interface CatalogClientProps {
    products: Product[];
}

export function CatalogClient({ products }: CatalogClientProps) {
    const { track } = useAnalytics();
    const [searchQuery, setSearchQuery] = useState('');
    const debouncedSearchQuery = useDebounce(searchQuery, 300);
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

    // Derive Categories
    const categories = useMemo(() => {
        const uniqueCats = new Set(products.map(p => p.category || 'Other'));
        uniqueCats.delete('All');
        return ['All', ...Array.from(uniqueCats).sort()];
    }, [products]);

    // Filter Products
    const filteredProducts = useMemo(() => {
        return products.filter(product => {
            const matchesCategory = selectedCategory === 'All' || (product.category || 'Other') === selectedCategory;
            const matchesSearch = product.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
                (product.description?.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) || false);
            return matchesCategory && matchesSearch;
        });
    }, [products, selectedCategory, debouncedSearchQuery]);

    const handleProductClick = useCallback((product: Product) => {
        track({ type: 'product_click', id: product.id });
        setSelectedProduct(product);
    }, [track]);

    return (
        <div className="w-full">
            <div className="mb-8">
                <div className="mb-6">
                    <SearchBar value={searchQuery} onChange={setSearchQuery} />
                </div>

                <CategoryTabs
                    categories={categories}
                    selectedCategory={selectedCategory}
                    onSelect={setSelectedCategory}
                />
            </div>

            {filteredProducts.length > 0 ? (
                <div className="grid grid-cols-2 gap-4">
                    {filteredProducts.map((product, index) => (
                        <ProductCard
                            key={product.id}
                            product={product}
                            onClick={() => handleProductClick(product)}
                            className={index % 2 === 0 ? 'rotate-1' : '-rotate-1'}
                        />
                    ))}
                </div>
            ) : (
                <div className="text-center py-20 text-gray-500">
                    <p className="font-bold text-lg">No treats found!</p>
                    <p className="text-sm">Try a different search or category.</p>
                </div>
            )}

            <ProductDetailModal
                product={selectedProduct}
                isOpen={!!selectedProduct}
                onClose={() => setSelectedProduct(null)}
            />
        </div>
    );
}
