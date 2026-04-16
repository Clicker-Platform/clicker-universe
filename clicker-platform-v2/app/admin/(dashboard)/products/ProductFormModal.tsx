import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { MultiImageUpload } from '@/components/admin/MultiImageUpload';
import { SubmitButton } from '@/components/admin/SubmitButton';

// Define Interface locally or import if shared.
// Matching ProductsClient usage for now to ensure compatibility.
export interface Product {
    id: string;
    title: string;
    price: string;
    image: string;
    category: string;
    description?: string;
    isFeatured?: boolean;
    images?: string[];
    isActive?: boolean;
    showPrice?: boolean;
    showLabel?: boolean;
}

interface ProductFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (e: React.FormEvent, formData: any) => Promise<void>;
    initialData?: Product | null;
    isSubmitting: boolean;
}

export function ProductFormModal({ isOpen, onClose, onSubmit, initialData, isSubmitting }: ProductFormModalProps) {
    const [formData, setFormData] = useState({
        title: '',
        price: '',
        showPrice: true,
        category: '',
        showLabel: true,
        description: '',
        images: [] as string[],
        isActive: true
    });

    useEffect(() => {
        if (initialData) {
            const existingImages = initialData.images && initialData.images.length > 0
                ? initialData.images
                : (initialData.image ? [initialData.image] : []);

            // Handle legacy or mapped fields (title vs name, image vs imageUrl)
            // But here we rely on what was passed from ProductsClient which likely already mapped it or is the raw doc.
            // ProductsClient map: title: product.title || product.name

            setFormData({
                title: initialData.title || (initialData as any).name || '',
                price: initialData.price ? String(initialData.price) : '',
                showPrice: initialData.showPrice !== false,
                category: initialData.category || '',
                showLabel: initialData.showLabel !== false,
                description: initialData.description || '',
                images: existingImages,
                isActive: initialData.isActive !== false
            });
        } else {
            // Reset
            setFormData({
                title: '',
                price: '',
                showPrice: true,
                category: '',
                showLabel: true,
                description: '',
                images: [],
                isActive: true
            });
        }
    }, [initialData?.id, isOpen]);

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(e, formData);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-neutral-900 rounded-lg w-full max-w-4xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 dark:border-neutral-800/50 flex justify-between items-center bg-gray-50 dark:bg-neutral-800/50 flex-shrink-0">
                    <h3 className="font-bold text-lg text-gray-800 dark:text-neutral-200 flex items-center gap-2">
                        {initialData ? 'Edit Product' : 'Add New Product'}
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-neutral-600 rounded-full transition-colors"
                        type="button"
                    >
                        <X size={20} className="text-gray-400 dark:text-neutral-600" />
                    </button>
                </div>

                {/* Scrollable Content */}
                <div className="overflow-y-auto p-6 md:p-8">
                    <form id="product-form" onSubmit={handleFormSubmit} className={`grid grid-cols-1 md:grid-cols-3 gap-6 transition-opacity duration-200 ${isSubmitting ? 'opacity-50 pointer-events-none' : ''}`}>
                        <div className="md:col-span-2 flex flex-col gap-6">
                            {/* Title */}
                            <div>
                                <label className="text-xs font-bold text-gray-500 dark:text-neutral-500 uppercase mb-2 block tracking-wider">Product Name</label>
                                <input
                                    placeholder="e.g. Croissant"
                                    className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-brand-dark font-bold text-lg"
                                    value={formData.title}
                                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                                    required
                                />
                            </div>

                            {/* Price Section */}
                            <div className="bg-white dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800 overflow-hidden group hover:border-gray-300 dark:hover:border-neutral-700 transition-colors">
                                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-neutral-800/50 border-b border-gray-100 dark:border-neutral-800/50">
                                    <label className="text-xs font-bold text-gray-700 dark:text-neutral-300 uppercase tracking-wider flex items-center gap-2">
                                        Price
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => setFormData(p => ({ ...p, showPrice: !p.showPrice }))}
                                        className={`
                                            relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none
                                            ${formData.showPrice ? 'bg-brand-dark' : 'bg-gray-200 dark:bg-neutral-700'}
                                        `}
                                    >
                                        <span
                                            aria-hidden="true"
                                            className={`
                                                pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out
                                                ${formData.showPrice ? 'translate-x-5' : 'translate-x-0'}
                                            `}
                                        />
                                    </button>
                                </div>
                                {formData.showPrice && (
                                    <div className="p-4 bg-white dark:bg-neutral-900 animate-in slide-in-from-top-1">
                                        <input
                                            type="text"
                                            placeholder="e.g. 50k, $5.00, Free, Contact us"
                                            className="w-full px-4 py-2 text-sm border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 rounded-lg focus:border-brand-dark focus:ring-0 text-gray-800"
                                            value={formData.price}
                                            onChange={e => setFormData({ ...formData, price: e.target.value })}
                                            required={formData.showPrice}
                                        />
                                        <p className="text-[10px] text-gray-400 dark:text-neutral-600 mt-2 font-medium">Accepts any text or currency format.</p>
                                    </div>
                                )}
                            </div>

                            {/* Label (Category) Section */}
                            <div className="bg-white dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800 overflow-hidden group hover:border-gray-300 dark:hover:border-neutral-700 transition-colors">
                                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-neutral-800/50 border-b border-gray-100 dark:border-neutral-800/50">
                                    <label className="text-xs font-bold text-gray-700 dark:text-neutral-300 uppercase tracking-wider flex items-center gap-2">
                                        Label / Category
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => setFormData(p => ({ ...p, showLabel: !p.showLabel }))}
                                        className={`
                                            relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none
                                            ${formData.showLabel ? 'bg-brand-dark' : 'bg-gray-200 dark:bg-neutral-700'}
                                        `}
                                    >
                                        <span
                                            aria-hidden="true"
                                            className={`
                                                pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out
                                                ${formData.showLabel ? 'translate-x-5' : 'translate-x-0'}
                                            `}
                                        />
                                    </button>
                                </div>
                                {formData.showLabel && (
                                    <div className="p-4 bg-white dark:bg-neutral-900 animate-in slide-in-from-top-1">
                                        <input
                                            placeholder="e.g. Pastries, Best Seller, New"
                                            className="w-full px-4 py-2 text-sm border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 rounded-lg focus:border-brand-dark focus:ring-0 text-gray-800"
                                            value={formData.category}
                                            onChange={e => setFormData({ ...formData, category: e.target.value })}
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Visibility Toggle in Form */}
                            <div className="flex items-center gap-3 bg-gray-50 dark:bg-neutral-800/50 p-3 rounded-lg border border-gray-200 dark:border-neutral-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors"
                                onClick={() => setFormData(prev => ({ ...prev, isActive: !prev.isActive }))}
                            >
                                <div
                                    className={`
                                        relative w-12 h-7 rounded-full transition-colors flex items-center
                                        ${formData.isActive ? 'bg-brand-green' : 'bg-gray-300 dark:bg-neutral-600'}
                                    `}
                                >
                                    <div className={`w-5 h-5 bg-white rounded-full transform transition-transform ml-1 ${formData.isActive ? 'translate-x-5' : ''}`} />
                                </div>
                                <span className="text-sm font-bold text-gray-700 dark:text-neutral-300 select-none">
                                    {formData.isActive ? 'Visible to Public' : 'Hidden (Draft Mode)'}
                                </span>
                            </div>

                            <textarea
                                placeholder="Description (optional)"
                                className="px-4 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 min-h-[120px]"
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                            />
                        </div>

                        <div className="md:col-span-1">
                            <MultiImageUpload
                                images={formData.images}
                                onImagesChange={(newImages) => setFormData({ ...formData, images: newImages })}
                                maxImages={10}
                            />
                        </div>
                    </form>
                </div>

                {/* Footer Buttons */}
                <div className="px-6 py-4 border-t border-gray-100 dark:border-neutral-800/50 bg-gray-50 dark:bg-neutral-800/50 flex justify-end gap-3 flex-shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-2 rounded-lg font-bold text-gray-500 dark:text-neutral-500 hover:bg-gray-200 dark:hover:bg-neutral-600 transition-colors"
                    >
                        Cancel
                    </button>
                    <SubmitButton
                        isLoading={isSubmitting}
                        loadingLabel={initialData ? 'Updating...' : 'Adding...'}
                        label={initialData ? 'Update Product' : 'Add Product'}
                        className={`text-white px-8 py-2 rounded-lg font-bold transition-all shadow-md transform active:scale-95 ${initialData ? 'bg-studio-blue hover:bg-studio-blue/85' : 'bg-studio-blue hover:bg-studio-blue/85'
                            }`}
                        form="product-form" // Link to form via ID
                    />
                </div>
            </div>
        </div>
    );
}
