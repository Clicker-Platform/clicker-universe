'use client';

import { useState, useEffect } from 'react';
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { Product } from '@/data/mockData';
import { Loader2 } from 'lucide-react';

interface ProductsFormProps {
    data: any;
    onChange: (data: any) => void;
}

import { useSite } from '@/lib/site-context';

export const ProductsForm = ({ data, onChange }: ProductsFormProps) => {
    const { siteId } = useSite();
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);

    const selectedIds: string[] = data.productIds || [];

    useEffect(() => {
        if (!siteId) return;

        const fetchProducts = async () => {
            // In a real app we might want to cache this or pass it from parent to avoid re-fetching on every block
            // But for now, simple fetch is safer.
            try {
                const snap = await getDocs(collection(db, 'sites', siteId, 'products'));
                const list = snap.docs.map(doc => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        name: data.title || data.name || 'Untitled Product',
                        price: data.price || '',
                        description: data.description || '',
                        imageUrl: data.image || data.imageUrl || '',
                        category: data.category || ''
                    } as Product;
                });
                setProducts(list);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchProducts();
    }, [siteId]);

    const toggleProduct = (id: string) => {
        const newIds = selectedIds.includes(id)
            ? selectedIds.filter(pid => pid !== id)
            : [...selectedIds, id];
        onChange({ ...data, productIds: newIds });
    };

    if (loading) return <div className="py-4 text-center"><Loader2 className="animate-spin mx-auto text-gray-400" size={20} /></div>;

    return (
        <div className="space-y-4">
            <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Section Title (Optional)</label>
                <input
                    type="text"
                    value={data.title || ''}
                    onChange={(e) => onChange({ ...data, title: e.target.value })}
                    className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:border-brand-dark focus:ring-0"
                    placeholder="e.g. Featured Products"
                />
            </div>

            <div>
                <label className="block text-xs font-bold text-gray-500 mb-2">Select Products</label>
                {products.length === 0 ? (
                    <p className="text-sm text-gray-500 italic">No products found in catalog.</p>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
                        {products.map(product => {
                            const isSelected = selectedIds.includes(product.id);
                            return (
                                <div
                                    key={product.id}
                                    onClick={() => toggleProduct(product.id)}
                                    className={`
                                        p-2 rounded-lg border-2 cursor-pointer flex items-center gap-3 transition-colors
                                        ${isSelected ? 'border-brand-green bg-brand-green/5' : 'border-gray-100 hover:border-gray-200 bg-white'}
                                    `}
                                >
                                    <div className="w-10 h-10 bg-gray-100 rounded flex-shrink-0 overflow-hidden">
                                        {(product.imageUrl || (product as any).image) && (
                                            <img src={product.imageUrl || (product as any).image} className="w-full h-full object-cover" />
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <p className={`text-sm font-bold ${isSelected ? 'text-brand-dark' : 'text-gray-700'}`}>{product.name}</p>
                                        <p className="text-xs text-gray-500">{product.price}</p>
                                    </div>
                                    {isSelected && <div className="ml-auto w-2 h-2 rounded-full bg-brand-green" />}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};
