'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, addDoc, deleteDoc, doc, updateDoc, setDoc, getDoc } from 'firebase/firestore';
import { Trash2, Plus, Pencil, Star, LayoutGrid, List, Eye, EyeOff, Settings } from 'lucide-react';
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useSite } from '@/lib/site-context'; // New import

const ProductFormModal = dynamic(() => import('./ProductFormModal').then(mod => mod.ProductFormModal), {
    ssr: false,
    loading: () => null
});

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
    showPrice?: boolean; // New
    showLabel?: boolean; // New (formerly Category)
}

interface ProductsClientProps {
    initialProducts: Product[];
    initialFeaturedId: string | null;
}

export default function ProductsManager({ initialProducts, initialFeaturedId }: ProductsClientProps) {
    const { siteId } = useSite();
    const [products, setProducts] = useState<Product[]>(initialProducts);
    const [featuredId, setFeaturedId] = useState<string | null>(initialFeaturedId);

    // UI State
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Deletion State
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [productToDelete, setProductToDelete] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Settings State
    const [showSettings, setShowSettings] = useState(false);
    const [isSavingSettings, setIsSavingSettings] = useState(false);
    const [settings, setSettings] = useState<{ galleryTitle: string; showSectionTitle: boolean; itemsToShow: number }>({
        galleryTitle: 'More Treats',
        showSectionTitle: true,
        itemsToShow: 6
    });

    useEffect(() => {
        const loadSettings = async () => {
            if (!siteId) return;
            const snap = await getDoc(doc(db, "sites", siteId, "content", "productSettings"));
            if (snap.exists()) {
                setSettings(prev => ({ ...prev, ...snap.data() }));
            }
        }
        loadSettings();
    }, [siteId]);

    const saveSettings = async () => {
        if (!siteId) return;
        setIsSavingSettings(true);
        try {
            await setDoc(doc(db, "sites", siteId, "content", "productSettings"), settings);
        } catch (error) {
            console.error(error);
        } finally {
            setIsSavingSettings(false);
            setShowSettings(false);
        }
    }

    // State for Modal
    const [isFormOpen, setIsFormOpen] = useState(false);

    // Form data is now handled inside ProductFormModal, we just need to pass initial data
    const handleCreate = () => {
        setIsEditing(false);
        setEditingId(null);
        setIsFormOpen(true);
    };

    const handleEdit = (product: Product) => {
        setEditingId(product.id);
        setIsEditing(true);
        setIsFormOpen(true);
    };

    const handleProductSubmit = async (e: React.FormEvent, formData: any) => {
        // formData comes from the modal
        if (!formData.title || formData.images.length === 0) {
            alert("Please include a title and at least one image.");
            return;
        }

        setIsSubmitting(true);
        const mainImage = formData.images[0];

        const productData = {
            title: formData.title,
            price: formData.price,
            showPrice: formData.showPrice,
            image: mainImage,
            imageUrl: mainImage,
            images: formData.images,
            category: formData.category,
            showLabel: formData.showLabel,
            description: formData.description,
            isActive: formData.isActive
        };

        try {
            if (!siteId) return;
            if (isEditing && editingId) {
                await updateDoc(doc(db, 'sites', siteId, 'products', editingId), productData);
                setProducts(products.map(p =>
                    p.id === editingId ? { ...p, ...productData, id: editingId } : p
                ));
            } else {
                const docRef = await addDoc(collection(db, 'sites', siteId, 'products'), productData);
                const newProduct: Product = { id: docRef.id, ...productData } as Product;
                setProducts([...products, newProduct]);
            }
            setIsFormOpen(false); // Close modal
            setEditingId(null);
            setIsEditing(false);
        } catch (error) {
            console.error("Error saving product:", error);
            alert("Failed to save product. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // New function to toggle visibility directly
    const toggleProductVisibility = async (product: Product) => {
        if (!siteId) return;
        const newStatus = product.isActive === false; // Toggle
        try {
            await updateDoc(doc(db, 'sites', siteId, 'products', product.id), { isActive: newStatus });
            setProducts(products.map(p =>
                p.id === product.id ? { ...p, isActive: newStatus } : p
            ));
        } catch (error) {
            console.error("Error updating visibility:", error);
        }
    };

    const handleDeleteClick = (id: string) => {
        setProductToDelete(id);
        setDeleteDialogOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!productToDelete || !siteId) return;
        setIsDeleting(true);

        try {
            await deleteDoc(doc(db, 'sites', siteId, 'products', productToDelete));
            setProducts(products.filter(p => p.id !== productToDelete));

            if (editingId === productToDelete) {
                setIsFormOpen(false);
                setEditingId(null);
                setIsEditing(false);
            }
            if (featuredId === productToDelete) setFeaturedId(null);
        } catch (error) {
            console.error(error);
        } finally {
            setIsDeleting(false);
            setDeleteDialogOpen(false);
            setProductToDelete(null);
        }
    };

    const handleSetFeatured = async (product: Product) => {
        if (!siteId) return;
        try {
            await setDoc(doc(db, 'sites', siteId, 'content', 'featuredProduct'), {
                productId: product.id,
                originalId: product.id
            });
            setFeaturedId(product.id);
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <div className="max-w-4xl">
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-3xl font-black text-brand-dark uppercase">Manage Products</h1>
                <div className="flex gap-2">
                    <button
                        onClick={handleCreate}
                        className="bg-brand-dark text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-gray-800 transition shadow-lg shadow-brand-dark/20 active:scale-95"
                    >
                        <Plus size={20} /> Add Product
                    </button>
                    <button
                        onClick={() => setShowSettings(!showSettings)}
                        className="flex items-center gap-2 bg-gray-100 px-4 py-2 rounded-xl font-bold text-gray-700 hover:bg-gray-200 transition-colors border border-gray-200"
                    >
                        <Settings size={18} /> Configure
                    </button>
                    <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white text-brand-dark shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                            title="Grid View"
                        >
                            <LayoutGrid size={20} />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-white text-brand-dark shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                            title="List View"
                        >
                            <List size={20} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Settings Panel */}
            {showSettings && (
                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm mb-8 animate-in slide-in-from-top-2">
                    <h2 className="text-lg font-bold text-brand-dark mb-4">Gallery Settings</h2>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Section Title</label>
                            <input
                                type="text"
                                value={settings.galleryTitle || ''}
                                onChange={(e) => setSettings({ ...settings, galleryTitle: e.target.value })}
                                className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-brand-dark focus:ring-0"
                                placeholder="e.g. More Treats"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Items to Show (Home Page)</label>
                            <input
                                type="number"
                                value={settings.itemsToShow || 6}
                                onChange={(e) => setSettings({ ...settings, itemsToShow: parseInt(e.target.value) || 6 })}
                                className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-brand-dark focus:ring-0"
                                min={1}
                            />
                            <p className="text-xs text-gray-400 mt-1">If you have more active products than this limit, a "View More" button will appear.</p>
                        </div>

                        <label className="flex items-center gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={!!settings.showSectionTitle}
                                onChange={(e) => setSettings({ ...settings, showSectionTitle: e.target.checked })}
                                className="w-5 h-5 rounded text-brand-dark focus:ring-brand-dark border-gray-300"
                            />
                            <div>
                                <span className="block font-bold text-sm text-gray-900">Show Section Title</span>
                                <span className="block text-xs text-gray-500">If unchecked, the title will be hidden, but products will still be shown.</span>
                            </div>
                        </label>

                    </div>

                    {/* Featured Product Settings */}
                    <div className="mt-8 pt-8 border-t border-gray-100">
                        <h2 className="text-lg font-bold text-brand-dark mb-4">Featured Product Settings</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Badge Text (Section Title)</label>
                                <input
                                    type="text"
                                    value={(settings as any).featuredTitle || 'Star Pick'}
                                    onChange={(e) => setSettings({ ...settings, featuredTitle: e.target.value } as any)}
                                    className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-brand-dark focus:ring-0"
                                    placeholder="e.g. Star Pick"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Button Text</label>
                                <input
                                    type="text"
                                    value={(settings as any).featuredBtnText || 'Order This Now'}
                                    onChange={(e) => setSettings({ ...settings, featuredBtnText: e.target.value } as any)}
                                    className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-brand-dark focus:ring-0"
                                    placeholder="e.g. Order This Now"
                                />
                            </div>

                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={(settings as any).showFeaturedTitle !== false} // Default true
                                    onChange={(e) => setSettings({ ...settings, showFeaturedTitle: e.target.checked } as any)}
                                    className="w-5 h-5 rounded text-brand-dark focus:ring-brand-dark border-gray-300"
                                />
                                <div>
                                    <span className="block font-bold text-sm text-gray-900">Show Badge/Title</span>
                                    <span className="block text-xs text-gray-500">If unchecked, the "Star Pick" badge will be hidden.</span>
                                </div>
                            </label>
                        </div>
                    </div>

                    {/* Whatsapp Button Settings */}
                    <div className="mt-8 pt-8 border-t border-gray-100">
                        <h2 className="text-lg font-bold text-brand-dark mb-4">Whatsapp Button Settings</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Button Label</label>
                                <input
                                    type="text"
                                    value={(settings as any).whatsappBtnLabel || 'Order on WhatsApp'}
                                    onChange={(e) => setSettings({ ...settings, whatsappBtnLabel: e.target.value } as any)}
                                    className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-brand-dark focus:ring-0"
                                    placeholder="e.g. Order on WhatsApp"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Message Template</label>
                                <textarea
                                    value={(settings as any).whatsappMessageTemplate || "Hi! I'd like to order the ${productName} for ${productPrice}."}
                                    onChange={(e) => setSettings({ ...settings, whatsappMessageTemplate: e.target.value } as any)}
                                    className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-brand-dark focus:ring-0 min-h-[80px]"
                                    placeholder="Use ${productName} and ${productPrice} as placeholders."
                                />
                                <p className="text-xs text-gray-400 mt-1">Available placeholders: <code>${'{productName}'}</code>, <code>${'{productPrice}'}</code></p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Button Color</label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="color"
                                            value={(settings as any).whatsappBtnColor || '#25D366'}
                                            onChange={(e) => setSettings({ ...settings, whatsappBtnColor: e.target.value } as any)}
                                            className="h-10 w-10 rounded cursor-pointer border-0 p-0"
                                        />
                                        <input
                                            type="text"
                                            value={(settings as any).whatsappBtnColor || '#25D366'}
                                            onChange={(e) => setSettings({ ...settings, whatsappBtnColor: e.target.value } as any)}
                                            className="flex-1 px-4 py-2 rounded-lg border border-gray-200 focus:border-brand-dark focus:ring-0 uppercase"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Text Color</label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="color"
                                            value={(settings as any).whatsappBtnTextColor || '#FFFFFF'}
                                            onChange={(e) => setSettings({ ...settings, whatsappBtnTextColor: e.target.value } as any)}
                                            className="h-10 w-10 rounded cursor-pointer border-0 p-0"
                                        />
                                        <input
                                            type="text"
                                            value={(settings as any).whatsappBtnTextColor || '#FFFFFF'}
                                            onChange={(e) => setSettings({ ...settings, whatsappBtnTextColor: e.target.value } as any)}
                                            className="flex-1 px-4 py-2 rounded-lg border border-gray-200 focus:border-brand-dark focus:ring-0 uppercase"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end pt-6 border-t border-gray-100 mt-6">
                        <button
                            onClick={saveSettings}
                            disabled={isSavingSettings}
                            className="bg-brand-dark text-white px-8 py-3 rounded-xl font-bold hover:bg-black transition-colors disabled:opacity-50 shadow-lg shadow-brand-dark/20"
                        >
                            {isSavingSettings ? 'Saving Changes...' : 'Save All Settings'}
                        </button>
                    </div>
                </div >
            )
            }



            {/* Products List */}
            <div className={viewMode === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" : "space-y-4"}>
                {products.map(product => {
                    const isFeatured = featuredId === product.id;
                    const displayTitle = product.title || (product as any).name;
                    const displayImage = (product.images && product.images[0]) || product.image || (product as any).imageUrl;
                    const isActive = product.isActive !== false; // Default true
                    const showPrice = product.showPrice !== false;
                    const showLabel = product.showLabel !== false;

                    if (viewMode === 'list') {
                        return (
                            <div key={product.id} className={`
                                bg-white p-4 rounded-xl border transition-all duration-300 group flex flex-col md:flex-row md:items-center gap-4 
                                ${isFeatured ? 'border-2 border-yellow-400 shadow-sm' : 'border-gray-200'}
                                ${!isActive ? 'opacity-60 bg-gray-50' : ''}
                            `}>
                                <div className="flex items-start gap-4 flex-1 w-full">
                                    <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 relative">
                                        <Image
                                            src={displayImage}
                                            alt={displayTitle}
                                            width={64}
                                            height={64}
                                            className={`w-full h-full object-cover ${!isActive ? 'grayscale' : ''}`}
                                        />
                                        {product.images && product.images.length > 1 && (
                                            <div className="absolute bottom-0 right-0 bg-black/50 text-white text-[10px] px-1 rounded-tl-md">
                                                +{product.images.length - 1}
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                                        <div className="flex items-start justify-between gap-2">
                                            <h3 className="font-bold text-brand-dark line-clamp-2 leading-tight">{displayTitle}</h3>
                                            {!isActive && <span className="text-[10px] font-bold bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded whitespace-nowrap">HIDDEN</span>}
                                        </div>
                                        <div className="flex items-center gap-2 mt-1.5">
                                            {showPrice && <p className="text-sm text-brand-green font-bold bg-brand-dark inline-block px-2 py-0.5 rounded">{product.price}</p>}
                                            {showLabel && product.category && <span className="text-xs text-gray-500 font-bold bg-gray-100 px-2 py-0.5 rounded">{product.category}</span>}
                                            {isFeatured && (
                                                <span className="text-xs font-bold text-yellow-600 bg-yellow-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                    <Star size={10} fill="currentColor" /> Featured
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-end gap-2 w-full md:w-auto border-t md:border-t-0 pt-3 md:pt-0 border-gray-100">
                                    {/* Visibility Toggle */}
                                    <button
                                        onClick={() => toggleProductVisibility(product)}
                                        className={`p-2 rounded-lg transition-colors ${isActive ? 'text-gray-400 hover:text-brand-dark hover:bg-gray-100' : 'text-gray-400 hover:text-brand-dark hover:bg-gray-100'}`}
                                        title={isActive ? "Hide Product" : "Show Product"}
                                    >
                                        {isActive ? <Eye size={18} /> : <EyeOff size={18} />}
                                    </button>

                                    <button
                                        onClick={() => handleEdit(product)}
                                        className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                                        title="Edit Product"
                                    >
                                        <Pencil size={18} />
                                    </button>
                                    <button
                                        onClick={() => handleSetFeatured(product)}
                                        className={`p-2 rounded-lg transition-colors ${isFeatured ? 'text-yellow-500 hover:bg-yellow-50' : 'text-gray-300 hover:text-yellow-500 hover:bg-yellow-50'}`}
                                        title="Set as Featured"
                                    >
                                        <Star size={18} fill={isFeatured ? "currentColor" : "none"} />
                                    </button>
                                    <button
                                        onClick={() => handleDeleteClick(product.id)}
                                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Delete Product"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        );
                    }

                    return (
                        <div key={product.id} className={`
                            bg-white p-4 rounded-xl border transition-all duration-300 group relative overflow-hidden 
                            ${isFeatured ? 'border-[3px] border-yellow-400 shadow-md scale-[1.02]' : 'border-gray-200'}
                            ${!isActive ? 'opacity-70' : ''}
                        `}>

                            {isFeatured && (
                                <div className="absolute top-0 left-0 bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-1 rounded-br-lg z-10 flex items-center gap-1">
                                    <Star size={12} fill="currentColor" /> Featured
                                </div>
                            )}

                            {!isActive && (
                                <div className="absolute top-0 right-0 left-0 bg-gray-800/80 text-white text-xs font-bold py-1 z-10 text-center backdrop-blur-sm">
                                    HIDDEN
                                </div>
                            )}

                            <div className="aspect-square bg-gray-100 rounded-lg mb-3 overflow-hidden relative">
                                <Image
                                    src={displayImage}
                                    alt={displayTitle}
                                    fill
                                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                                    className={`object-cover ${!isActive ? 'grayscale' : ''}`}
                                />
                                {product.images && product.images.length > 1 && (
                                    <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-sm text-white text-xs font-bold px-2 py-1 rounded-full">
                                        +{product.images.length - 1} images
                                    </div>
                                )}
                            </div>
                            <h3 className="font-bold text-brand-dark">{displayTitle}</h3>
                            <div className="flex flex-wrap gap-2 mt-1">
                                {showPrice && <p className="text-sm text-brand-green font-bold bg-brand-dark inline-block px-2 py-0.5 rounded">{product.price}</p>}
                                {showLabel && product.category && <span className="text-xs text-gray-500 font-bold bg-gray-100 px-2 py-0.5 rounded flex items-center">{product.category}</span>}
                            </div>

                            <div className="absolute top-3 right-2 flex flex-col gap-2">
                                <button
                                    onClick={() => handleEdit(product)}
                                    className="p-2 bg-white/90 backdrop-blur text-blue-500 rounded-lg hover:bg-blue-500 hover:text-white transition-colors shadow-sm"
                                    title="Edit Product"
                                >
                                    <Pencil size={18} />
                                </button>
                                <button
                                    onClick={() => toggleProductVisibility(product)}
                                    className="p-2 bg-white/90 backdrop-blur text-gray-600 rounded-lg hover:bg-gray-800 hover:text-white transition-colors shadow-sm"
                                    title={isActive ? "Hide Product" : "Show Product"}
                                >
                                    {isActive ? <Eye size={18} /> : <EyeOff size={18} />}
                                </button>
                                <button
                                    onClick={() => handleSetFeatured(product)}
                                    className={`p-2 bg-white/90 backdrop-blur rounded-lg transition-colors shadow-sm ${isFeatured ? 'text-yellow-500' : 'text-gray-400 hover:text-yellow-500'}`}
                                    title="Set as Featured"
                                >
                                    <Star size={18} fill={isFeatured ? "currentColor" : "none"} />
                                </button>
                                <button
                                    onClick={() => handleDeleteClick(product.id)}
                                    className="p-2 bg-white/90 backdrop-blur text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-colors shadow-sm"
                                    title="Delete Product"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>
                    );
                })}
                {products.length === 0 && <p className="col-span-3 text-gray-500 text-center py-10">No products found.</p>}
            </div>

            <ConfirmationDialog
                isOpen={deleteDialogOpen}
                title="Delete Product"
                message="Are you sure you want to delete this product? This action cannot be undone."
                onConfirm={handleConfirmDelete}
                onCancel={() => setDeleteDialogOpen(false)}
                isLoading={isDeleting}
            />

            {isFormOpen && (
                <ProductFormModal
                    isOpen={isFormOpen}
                    onClose={() => setIsFormOpen(false)}
                    onSubmit={handleProductSubmit}
                    isSubmitting={isSubmitting}
                    initialData={isEditing && editingId ? products.find(p => p.id === editingId) : null}
                />
            )}
        </div >
    );
}
