'use client';

import { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, setDoc, getDoc } from 'firebase/firestore';
import { Plus, Trash2, ArrowLeft, Save, Star, Eye, EyeOff, Settings, ShoppingBag, Loader2 } from 'lucide-react';
import { useSite } from '@/lib/site-context';
import { MultiImageUpload } from '@/components/admin/MultiImageUpload';
import Image from 'next/image';

// ── Shared styles ────────────────────────────────────────────────────────

const inputClass = "w-full px-3 py-2 bg-gray-100 dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded-lg text-sm text-neutral-900 dark:text-neutral-200 placeholder-neutral-400 dark:placeholder-neutral-600 focus:border-blue-500/50 focus:outline-none transition-colors";
const labelClass = "block text-xs font-medium text-neutral-400 dark:text-neutral-500 mb-1";

// ── Types ────────────────────────────────────────────────────────────────

interface Product {
    id: string;
    title: string;
    price: string;
    image: string;
    category: string;
    description?: string;
    images?: string[];
    isActive?: boolean;
    showPrice?: boolean;
    showLabel?: boolean;
}

interface ProductSettings {
    galleryTitle: string;
    showSectionTitle: boolean;
    itemsToShow: number;
    featuredTitle?: string;
    showFeaturedTitle?: boolean;
    featuredBtnText?: string;
    whatsappBtnLabel?: string;
    whatsappMessageTemplate?: string;
    whatsappBtnColor?: string;
    whatsappBtnTextColor?: string;
}

const defaultSettings: ProductSettings = {
    galleryTitle: 'More Treats',
    showSectionTitle: true,
    itemsToShow: 6,
    featuredTitle: 'Star Pick',
    showFeaturedTitle: true,
    featuredBtnText: 'Order This Now',
    whatsappBtnLabel: 'Order on WhatsApp',
    whatsappMessageTemplate: "Hi! I'd like to order the ${productName} for ${productPrice}.",
    whatsappBtnColor: '#25D366',
    whatsappBtnTextColor: '#FFFFFF',
};

// ── Product List Item ────────────────────────────────────────────────────

function ProductListItem({ product, isFeatured, onEdit, onDelete, onToggleVisibility, onSetFeatured }: {
    product: Product;
    isFeatured: boolean;
    onEdit: (p: Product) => void;
    onDelete: (id: string) => void;
    onToggleVisibility: (p: Product) => void;
    onSetFeatured: (p: Product) => void;
}) {
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const displayTitle = product.title || (product as any).name;
    const displayImage = (product.images && product.images[0]) || product.image || (product as any).imageUrl;
    const isActive = product.isActive !== false;

    const handleDelete = async () => {
        setDeleting(true);
        onDelete(product.id);
    };

    return (
        <div className={`flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-neutral-800/50 rounded-lg group transition-colors ${!isActive ? 'opacity-50' : ''}`}>
            {/* Thumbnail */}
            <div className="w-10 h-10 bg-gray-100 dark:bg-neutral-800 rounded-md flex-shrink-0 overflow-hidden relative">
                {displayImage ? (
                    <Image src={displayImage} alt={displayTitle} fill sizes="40px" className={`object-cover ${!isActive ? 'grayscale' : ''}`} />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-neutral-400 dark:text-neutral-600">
                        <ShoppingBag size={16} />
                    </div>
                )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onEdit(product)}>
                <div className="text-sm font-medium text-neutral-900 dark:text-neutral-200 truncate">{displayTitle}</div>
                <div className="flex items-center gap-1.5 mt-0.5">
                    {product.showPrice !== false && product.price && (
                        <span className="px-1 py-0.5 rounded text-[9px] font-bold bg-green-500/20 text-green-400">{product.price}</span>
                    )}
                    {product.showLabel !== false && product.category && (
                        <span className="text-[10px] text-neutral-600 truncate">{product.category}</span>
                    )}
                    {!isActive && (
                        <span className="px-1 py-0.5 rounded text-[9px] font-bold bg-gray-200 dark:bg-neutral-700 text-neutral-500 uppercase">Hidden</span>
                    )}
                </div>
            </div>

            {/* Actions */}
            {confirmDelete ? (
                <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={handleDelete} disabled={deleting} className="px-2 py-1 text-[10px] font-bold text-red-400 bg-red-500/10 border border-red-500/30 rounded-md hover:bg-red-500/20 transition-colors disabled:opacity-50">
                        {deleting ? '...' : 'Confirm'}
                    </button>
                    <button onClick={() => setConfirmDelete(false)} className="px-2 py-1 text-[10px] font-bold text-neutral-500 dark:text-neutral-400 bg-gray-100 dark:bg-neutral-800 rounded-md hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors">
                        Cancel
                    </button>
                </div>
            ) : (
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button onClick={() => onSetFeatured(product)} className={`p-1.5 rounded-md transition-colors ${isFeatured ? 'text-yellow-400' : 'text-neutral-400 dark:text-neutral-600 hover:text-yellow-400 hover:bg-gray-200 dark:hover:bg-neutral-700'}`} title="Set Featured">
                        <Star size={13} fill={isFeatured ? 'currentColor' : 'none'} />
                    </button>
                    <button onClick={() => onToggleVisibility(product)} className="p-1.5 text-neutral-400 dark:text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200 hover:bg-gray-200 dark:hover:bg-neutral-700 rounded-md transition-colors" title={isActive ? 'Hide' : 'Show'}>
                        {isActive ? <Eye size={13} /> : <EyeOff size={13} />}
                    </button>
                    <button onClick={() => onEdit(product)} className="p-1.5 text-neutral-400 dark:text-neutral-500 hover:text-blue-400 hover:bg-gray-200 dark:hover:bg-neutral-700 rounded-md transition-colors">
                        <ShoppingBag size={13} />
                    </button>
                    <button onClick={() => setConfirmDelete(true)} className="p-1.5 text-neutral-400 dark:text-neutral-500 hover:text-red-400 hover:bg-gray-200 dark:hover:bg-neutral-700 rounded-md transition-colors">
                        <Trash2 size={13} />
                    </button>
                </div>
            )}
        </div>
    );
}

// ── Main ProductsPanel ───────────────────────────────────────────────────

export function ProductsPanel() {
    const { siteId } = useSite();
    const [products, setProducts] = useState<Product[]>([]);
    const [featuredId, setFeaturedId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    // View state
    const [view, setView] = useState<'list' | 'editor' | 'settings'>('list');

    // Editor state
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        title: '', price: '', showPrice: true, category: '', showLabel: true,
        description: '', images: [] as string[], isActive: true,
    });
    const [saving, setSaving] = useState(false);

    // Settings state
    const [settings, setSettings] = useState<ProductSettings>({ ...defaultSettings });
    const [savingSettings, setSavingSettings] = useState(false);

    // ── Data fetching ─────────────────────────────────────────────────

    const fetchProducts = useCallback(async () => {
        if (!siteId) return;
        try {
            const [productsSnap, featuredSnap, settingsSnap] = await Promise.all([
                getDocs(collection(db, 'sites', siteId, 'products')),
                getDoc(doc(db, 'sites', siteId, 'content', 'featuredProduct')),
                getDoc(doc(db, 'sites', siteId, 'content', 'productSettings')),
            ]);

            const fetched = productsSnap.docs.map(d => {
                const data = d.data();
                return {
                    id: d.id,
                    title: data.title || data.name || '',
                    price: data.price ? String(data.price) : '',
                    image: data.image || data.imageUrl || '',
                    images: data.images || (data.image ? [data.image] : data.imageUrl ? [data.imageUrl] : []),
                    category: data.category || '',
                    description: data.description || '',
                    isActive: data.isActive,
                    showPrice: data.showPrice,
                    showLabel: data.showLabel,
                } as Product;
            });
            setProducts(fetched);

            if (featuredSnap.exists()) {
                setFeaturedId(featuredSnap.data().productId || null);
            }
            if (settingsSnap.exists()) {
                setSettings(prev => ({ ...prev, ...settingsSnap.data() }));
            }
        } catch (error) {
            console.error('Error fetching products:', error);
        } finally {
            setLoading(false);
        }
    }, [siteId]);

    useEffect(() => { fetchProducts(); }, [fetchProducts]);

    // ── Editor actions ────────────────────────────────────────────────

    const openEditor = (product?: Product) => {
        if (product) {
            setEditingId(product.id);
            setFormData({
                title: product.title || (product as any).name || '',
                price: product.price ? String(product.price) : '',
                showPrice: product.showPrice !== false,
                category: product.category || '',
                showLabel: product.showLabel !== false,
                description: product.description || '',
                images: product.images || (product.image ? [product.image] : []),
                isActive: product.isActive !== false,
            });
        } else {
            setEditingId(null);
            setFormData({
                title: '', price: '', showPrice: true, category: '', showLabel: true,
                description: '', images: [], isActive: true,
            });
        }
        setView('editor');
    };

    const handleSave = async () => {
        if (!siteId || !formData.title || formData.images.length === 0) return;
        setSaving(true);
        try {
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
                isActive: formData.isActive,
            };

            if (editingId) {
                await updateDoc(doc(db, 'sites', siteId, 'products', editingId), productData);
                setProducts(prev => prev.map(p => p.id === editingId ? { ...p, ...productData, id: editingId } : p));
            } else {
                const docRef = await addDoc(collection(db, 'sites', siteId, 'products'), productData);
                setProducts(prev => [...prev, { id: docRef.id, ...productData } as Product]);
            }
            setView('list');
            setEditingId(null);
        } catch (error) {
            console.error('Error saving product:', error);
        } finally {
            setSaving(false);
        }
    };

    // ── List actions ──────────────────────────────────────────────────

    const handleDelete = async (id: string) => {
        if (!siteId) return;
        try {
            await deleteDoc(doc(db, 'sites', siteId, 'products', id));
            setProducts(prev => prev.filter(p => p.id !== id));
            if (featuredId === id) setFeaturedId(null);
        } catch (error) {
            console.error('Error deleting product:', error);
        }
    };

    const toggleVisibility = async (product: Product) => {
        if (!siteId) return;
        const newStatus = product.isActive === false;
        try {
            await updateDoc(doc(db, 'sites', siteId, 'products', product.id), { isActive: newStatus });
            setProducts(prev => prev.map(p => p.id === product.id ? { ...p, isActive: newStatus } : p));
        } catch (error) {
            console.error('Error toggling visibility:', error);
        }
    };

    const setFeatured = async (product: Product) => {
        if (!siteId) return;
        try {
            await setDoc(doc(db, 'sites', siteId, 'content', 'featuredProduct'), {
                productId: product.id,
                originalId: product.id,
            });
            setFeaturedId(product.id);
        } catch (error) {
            console.error('Error setting featured:', error);
        }
    };

    // ── Settings actions ──────────────────────────────────────────────

    const saveSettings = async () => {
        if (!siteId) return;
        setSavingSettings(true);
        try {
            await setDoc(doc(db, 'sites', siteId, 'content', 'productSettings'), settings);
            setView('list');
        } catch (error) {
            console.error('Error saving settings:', error);
        } finally {
            setSavingSettings(false);
        }
    };

    // ── Render ────────────────────────────────────────────────────────

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12 text-neutral-500">
                <Loader2 size={20} className="animate-spin" />
            </div>
        );
    }

    // ── Settings View ─────────────────────────────────────────────────

    if (view === 'settings') {
        return (
            <div className="flex flex-col h-full">
                <div className="px-3 py-2 border-b border-gray-200 dark:border-neutral-800 flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => setView('list')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-gray-300 dark:border-neutral-700 hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors">
                        <ArrowLeft size={13} /> Back
                    </button>
                    <div className="flex-1" />
                    <button onClick={saveSettings} disabled={savingSettings} className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
                        {savingSettings ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                        {savingSettings ? 'Saving...' : 'Save'}
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <div className="p-3 space-y-4">
                        {/* Gallery Settings */}
                        <div className="space-y-3">
                            <h3 className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Gallery</h3>
                            <div>
                                <label className={labelClass}>Section Title</label>
                                <input type="text" value={settings.galleryTitle} onChange={e => setSettings({ ...settings, galleryTitle: e.target.value })} className={inputClass} placeholder="e.g. More Treats" />
                            </div>
                            <div>
                                <label className={labelClass}>Items to Show (Home)</label>
                                <input type="number" value={settings.itemsToShow} onChange={e => setSettings({ ...settings, itemsToShow: parseInt(e.target.value) || 6 })} className={inputClass} min={1} />
                                <p className="text-[10px] text-neutral-400 dark:text-neutral-600 mt-1">Exceeding this shows a "View More" button.</p>
                            </div>
                            <label className="flex items-center gap-2.5 cursor-pointer">
                                <input type="checkbox" checked={settings.showSectionTitle} onChange={e => setSettings({ ...settings, showSectionTitle: e.target.checked })} className="rounded border-gray-300 dark:border-neutral-600 bg-gray-100 dark:bg-neutral-800 text-blue-500 focus:ring-blue-500/30" />
                                <span className="text-xs text-neutral-700 dark:text-neutral-300">Show Section Title</span>
                            </label>
                        </div>

                        <div className="border-t border-gray-200 dark:border-neutral-800" />

                        {/* Featured Product Settings */}
                        <div className="space-y-3">
                            <h3 className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Featured Product</h3>
                            <div>
                                <label className={labelClass}>Badge Text</label>
                                <input type="text" value={settings.featuredTitle || ''} onChange={e => setSettings({ ...settings, featuredTitle: e.target.value })} className={inputClass} placeholder="e.g. Star Pick" />
                            </div>
                            <div>
                                <label className={labelClass}>Button Text</label>
                                <input type="text" value={settings.featuredBtnText || ''} onChange={e => setSettings({ ...settings, featuredBtnText: e.target.value })} className={inputClass} placeholder="e.g. Order This Now" />
                            </div>
                            <label className="flex items-center gap-2.5 cursor-pointer">
                                <input type="checkbox" checked={settings.showFeaturedTitle !== false} onChange={e => setSettings({ ...settings, showFeaturedTitle: e.target.checked })} className="rounded border-gray-300 dark:border-neutral-600 bg-gray-100 dark:bg-neutral-800 text-blue-500 focus:ring-blue-500/30" />
                                <span className="text-xs text-neutral-700 dark:text-neutral-300">Show Badge</span>
                            </label>
                        </div>

                        <div className="border-t border-gray-200 dark:border-neutral-800" />

                        {/* WhatsApp Button Settings */}
                        <div className="space-y-3">
                            <h3 className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">WhatsApp Button</h3>
                            <div>
                                <label className={labelClass}>Button Label</label>
                                <input type="text" value={settings.whatsappBtnLabel || ''} onChange={e => setSettings({ ...settings, whatsappBtnLabel: e.target.value })} className={inputClass} placeholder="e.g. Order on WhatsApp" />
                            </div>
                            <div>
                                <label className={labelClass}>Message Template</label>
                                <textarea value={settings.whatsappMessageTemplate || ''} onChange={e => setSettings({ ...settings, whatsappMessageTemplate: e.target.value })} className={`${inputClass} min-h-[80px] resize-none`} placeholder="Use ${productName} and ${productPrice}" />
                                <p className="text-[10px] text-neutral-400 dark:text-neutral-600 mt-1">Placeholders: {'${productName}'}, {'${productPrice}'}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className={labelClass}>Button Color</label>
                                    <div className="flex items-center gap-2">
                                        <input type="color" value={settings.whatsappBtnColor || '#25D366'} onChange={e => setSettings({ ...settings, whatsappBtnColor: e.target.value })} className="h-8 w-8 rounded cursor-pointer border-0 p-0 bg-transparent" />
                                        <input type="text" value={settings.whatsappBtnColor || '#25D366'} onChange={e => setSettings({ ...settings, whatsappBtnColor: e.target.value })} className={`${inputClass} uppercase`} />
                                    </div>
                                </div>
                                <div>
                                    <label className={labelClass}>Text Color</label>
                                    <div className="flex items-center gap-2">
                                        <input type="color" value={settings.whatsappBtnTextColor || '#FFFFFF'} onChange={e => setSettings({ ...settings, whatsappBtnTextColor: e.target.value })} className="h-8 w-8 rounded cursor-pointer border-0 p-0 bg-transparent" />
                                        <input type="text" value={settings.whatsappBtnTextColor || '#FFFFFF'} onChange={e => setSettings({ ...settings, whatsappBtnTextColor: e.target.value })} className={`${inputClass} uppercase`} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ── Editor View ───────────────────────────────────────────────────

    if (view === 'editor') {
        return (
            <div className="flex flex-col h-full">
                <div className="px-3 py-2 border-b border-gray-200 dark:border-neutral-800 flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => { setView('list'); setEditingId(null); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-gray-300 dark:border-neutral-700 hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors">
                        <ArrowLeft size={13} /> Back
                    </button>
                    <div className="flex-1" />
                    <button onClick={handleSave} disabled={saving || !formData.title || formData.images.length === 0} className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
                        {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                        {saving ? 'Saving...' : 'Save'}
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <div className="p-3 space-y-4">
                        {/* Product Name */}
                        <div>
                            <label className={labelClass}>Product Name</label>
                            <input type="text" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} className={inputClass} placeholder="e.g. Croissant" required />
                        </div>

                        {/* Price */}
                        <div className="bg-gray-100 dark:bg-neutral-800/50 rounded-lg border border-gray-200 dark:border-neutral-700/50 overflow-hidden">
                            <div className="flex items-center justify-between px-3 py-2">
                                <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase">Price</span>
                                <button type="button" onClick={() => setFormData(p => ({ ...p, showPrice: !p.showPrice }))} className={`w-8 h-4.5 rounded-full transition-colors relative ${formData.showPrice ? 'bg-blue-500' : 'bg-gray-300 dark:bg-neutral-700'}`}>
                                    <span className={`absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full transition-transform ${formData.showPrice ? 'left-[18px]' : 'left-0.5'}`} />
                                </button>
                            </div>
                            {formData.showPrice && (
                                <div className="px-3 pb-3">
                                    <input type="text" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} className={inputClass} placeholder="e.g. 50k, $5.00, Free" />
                                </div>
                            )}
                        </div>

                        {/* Label / Category */}
                        <div className="bg-gray-100 dark:bg-neutral-800/50 rounded-lg border border-gray-200 dark:border-neutral-700/50 overflow-hidden">
                            <div className="flex items-center justify-between px-3 py-2">
                                <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase">Label / Category</span>
                                <button type="button" onClick={() => setFormData(p => ({ ...p, showLabel: !p.showLabel }))} className={`w-8 h-4.5 rounded-full transition-colors relative ${formData.showLabel ? 'bg-blue-500' : 'bg-gray-300 dark:bg-neutral-700'}`}>
                                    <span className={`absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full transition-transform ${formData.showLabel ? 'left-[18px]' : 'left-0.5'}`} />
                                </button>
                            </div>
                            {formData.showLabel && (
                                <div className="px-3 pb-3">
                                    <input type="text" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} className={inputClass} placeholder="e.g. Pastries, Best Seller" />
                                </div>
                            )}
                        </div>

                        {/* Visibility */}
                        <label className="flex items-center gap-2.5 cursor-pointer">
                            <input type="checkbox" checked={formData.isActive} onChange={e => setFormData({ ...formData, isActive: e.target.checked })} className="rounded border-gray-300 dark:border-neutral-600 bg-gray-100 dark:bg-neutral-800 text-blue-500 focus:ring-blue-500/30" />
                            <span className="text-xs text-neutral-700 dark:text-neutral-300">{formData.isActive ? 'Visible to Public' : 'Hidden (Draft)'}</span>
                        </label>

                        {/* Description */}
                        <div>
                            <label className={labelClass}>Description (optional)</label>
                            <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className={`${inputClass} min-h-[80px] resize-none`} placeholder="Product description..." />
                        </div>

                        <div className="border-t border-gray-200 dark:border-neutral-800" />

                        {/* Images */}
                        <div>
                            <label className={labelClass}>Images</label>
                            <MultiImageUpload
                                images={formData.images}
                                onImagesChange={(newImages) => setFormData({ ...formData, images: newImages })}
                                maxImages={10}
                            />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ── List View ─────────────────────────────────────────────────────

    return (
        <div className="flex flex-col h-full">
            <div className="px-3 py-2 border-b border-gray-200 dark:border-neutral-800 flex items-center gap-2 flex-shrink-0">
                <button onClick={() => openEditor()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-gray-300 dark:border-neutral-700 hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors">
                    <Plus size={13} /> Add Product
                </button>
                <button onClick={() => setView('settings')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-gray-300 dark:border-neutral-700 hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors">
                    <Settings size={13} /> Settings
                </button>
                <div className="flex-1" />
                <span className="text-[10px] text-neutral-400 dark:text-neutral-600 font-medium">{products.length} products</span>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="py-1">
                    {products.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center text-neutral-500 gap-2">
                            <ShoppingBag size={24} className="opacity-20" />
                            <p className="text-xs">No products yet</p>
                            <button onClick={() => openEditor()} className="text-xs text-blue-400 hover:text-blue-300 font-bold">
                                Add your first product
                            </button>
                        </div>
                    ) : (
                        products.map(product => (
                            <ProductListItem
                                key={product.id}
                                product={product}
                                isFeatured={featuredId === product.id}
                                onEdit={openEditor}
                                onDelete={handleDelete}
                                onToggleVisibility={toggleVisibility}
                                onSetFeatured={setFeatured}
                            />
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
