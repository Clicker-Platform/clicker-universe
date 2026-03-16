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
    const safeData = data || {};
    const { siteId } = useSite();
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);

    const selectedIds: string[] = safeData.productIds || [];

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
        onChange({ ...safeData, productIds: newIds });
    };

    if (loading) return <div className="py-12 bg-neutral-900/30 rounded-2xl border border-neutral-800/50 flex flex-col items-center justify-center gap-3">
        <Loader2 className="animate-spin text-blue-500" size={24} />
        <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Loading Catalog</p>
    </div>;

    return (
        <div className="space-y-6">
            <div>
                <label className="block text-xs font-medium text-neutral-500 mb-2">Section Title (Optional)</label>
                <input
                    type="text"
                    value={safeData.title || ''}
                    onChange={(e) => onChange({ ...safeData, title: e.target.value })}
                    className="w-full px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-sm font-bold text-neutral-200 placeholder-neutral-600 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                    placeholder="e.g. Featured Products"
                />
            </div>

            <div>
                <label className="block text-xs font-medium text-neutral-500 mb-2">Select Products</label>
                {products.length === 0 ? (
                    <div className="p-10 bg-neutral-900/50 rounded-2xl border-2 border-dashed border-neutral-800 text-center">
                        <p className="text-sm font-medium text-neutral-500">No products found in catalog.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1 thin-scrollbar">
                        {products.map(product => {
                            const isSelected = selectedIds.includes(product.id);
                            return (
                                <div
                                    key={product.id}
                                    onClick={() => toggleProduct(product.id)}
                                    className={`
                                        p-3 rounded-xl border cursor-pointer flex items-center gap-4 transition-all active:scale-[0.98]
                                        ${isSelected 
                                            ? 'border-blue-500 bg-blue-500/10 shadow-[0_0_15px_-5px_italic] shadow-blue-500/20' 
                                            : 'border-neutral-800 bg-neutral-900 hover:border-neutral-700 hover:bg-neutral-800'
                                        }
                                    `}
                                >
                                    <div className="w-12 h-12 bg-neutral-800/50 rounded-lg flex-shrink-0 overflow-hidden border border-neutral-700/30">
                                        {(product.imageUrl || (product as any).image) && (
                                            <img src={product.imageUrl || (product as any).image} className="w-full h-full object-cover" />
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className={`text-sm font-black truncate ${isSelected ? 'text-neutral-100' : 'text-neutral-400 group-hover:text-neutral-200'}`}>{product.name}</p>
                                        <p className="text-xs font-bold text-neutral-500 mt-0.5">{product.price}</p>
                                    </div>
                                    {isSelected && <div className="ml-auto w-2 h-2 rounded-full bg-blue-500" />}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};
