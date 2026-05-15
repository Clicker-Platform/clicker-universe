'use client';

import Image from 'next/image';
import { ShoppingBag } from 'lucide-react';
import { usePageStudio } from '@/components/admin/blocks/PageStudioContext';

interface ProductsFormProps {
    data: Record<string, unknown>;
    onChange: (data: Record<string, unknown>) => void;
    onOpenProducts?: () => void;
}

export const ProductsForm = ({ data, onChange, onOpenProducts }: ProductsFormProps) => {
    const safeData = (data || {}) as { title?: string; productIds?: string[] };
    const { hydratedData } = usePageStudio();

    type ProductLite = {
        id: string;
        name?: string;
        title?: string;
        price?: string | number;
        imageUrl?: string;
        image?: string;
    };
    const products = ((hydratedData.products as ProductLite[]) || []);
    const selectedIds: string[] = safeData.productIds || [];

    const toggleProduct = (id: string) => {
        const newIds = selectedIds.includes(id)
            ? selectedIds.filter(pid => pid !== id)
            : [...selectedIds, id];
        onChange({ ...safeData, productIds: newIds });
    };

    return (
        <div className="space-y-6">
            <div>
                <label className="block text-xs font-medium text-neutral-400 dark:text-neutral-500 mb-2">Section Title (Optional)</label>
                <input
                    type="text"
                    value={safeData.title || ''}
                    onChange={(e) => onChange({ ...safeData, title: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg text-sm font-bold text-neutral-900 dark:text-neutral-200 placeholder-neutral-400 dark:placeholder-neutral-600 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                    placeholder="e.g. Featured Products"
                />
            </div>

            <div>
                <label className="block text-xs font-medium text-neutral-400 dark:text-neutral-500 mb-2">Select Products</label>
                {products.length === 0 ? (
                    <div className="p-6 bg-gray-100/50 dark:bg-neutral-900/50 rounded-lg border-2 border-dashed border-gray-200 dark:border-neutral-800 text-center flex flex-col items-center gap-3">
                        <ShoppingBag size={24} className="text-neutral-300 dark:text-neutral-600" />
                        <p className="text-sm font-medium text-neutral-400 dark:text-neutral-500">No products found in catalog.</p>
                        {onOpenProducts && (
                            <button
                                type="button"
                                onClick={onOpenProducts}
                                className="text-xs font-bold text-blue-500 hover:text-blue-600 dark:hover:text-blue-400 underline underline-offset-2 transition-colors"
                            >
                                Add products →
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col gap-1.5 max-h-72 overflow-y-auto thin-scrollbar">
                        {products.map(product => {
                            const isSelected = selectedIds.includes(product.id);
                            return (
                                <div
                                    key={product.id}
                                    onClick={() => toggleProduct(product.id)}
                                    className={`
                                        px-2.5 py-2 rounded-lg border cursor-pointer flex items-center gap-2.5 transition-all active:scale-[0.98]
                                        ${isSelected
                                            ? 'border-blue-500 bg-blue-500/10'
                                            : 'border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-gray-300 dark:hover:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800'
                                        }
                                    `}
                                >
                                    <div className="w-8 h-8 bg-gray-100 dark:bg-neutral-800/50 rounded-md flex-shrink-0 overflow-hidden border border-gray-200 dark:border-neutral-700/30">
                                        {(product.imageUrl || product.image) && (
                                            <Image src={(product.imageUrl || product.image) as string} className="w-full h-full object-cover" alt={(product.name as string) || ''} width={32} height={32} unoptimized />
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1 overflow-hidden">
                                        <p className={`text-xs font-bold truncate ${isSelected ? 'text-neutral-900 dark:text-neutral-100' : 'text-neutral-600 dark:text-neutral-400'}`}>
                                            {product.name || product.title}
                                        </p>
                                        <p className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500 truncate">{product.price}</p>
                                    </div>
                                    <div className={`w-4 h-4 rounded-full flex-shrink-0 border-2 transition-colors ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-300 dark:border-neutral-600'}`} />
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};
