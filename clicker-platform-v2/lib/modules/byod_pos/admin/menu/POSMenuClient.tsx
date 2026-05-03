'use client';

import { useState, useMemo, useEffect } from 'react';
import { ensureCategoryExists, getMenuItems, getPOSCategories, savePOSCategories, POSCategory } from '../../api';
import { db } from '@/lib/firebase';
import { isModuleEnabled } from '@/lib/modules/registry';
import { collection, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { Trash2, Plus, Pencil, LayoutGrid, List, Eye, EyeOff, Store } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog';
import { POSMenuItemDialog } from './components/POSMenuItemDialog';
import { POSCategoryManagerModal } from './components/POSCategoryManagerModal';
import { useSite } from '@/lib/site-context';
import { logger } from '@/lib/logger-edge';

interface POSItem {
    id: string;
    name: string;
    price: number;
    category: string;
    description?: string;
    imageUrl?: string;
    images?: string[];
    isActive?: boolean;
}

interface POSMenuClientProps {
    initialItems?: POSItem[];
}

export default function POSMenuClient({ initialItems = [] }: POSMenuClientProps) {
    const { siteId } = useSite();
    const [items, setItems] = useState<POSItem[]>(initialItems);
    const [inventoryItems, setInventoryItems] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(initialItems.length === 0);

    // Category state
    const [menuCategories, setMenuCategories] = useState<POSCategory[]>([]);
    const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);

    useEffect(() => {
        // Fetch inventory for linking (Strict Modularity Check)
        if (siteId) {
            isModuleEnabled('inventory').then(enabled => {
                if (enabled) {
                    import('@/lib/modules/inventory/api').then(async (mod) => {
                        const inv = await mod.getInventory(siteId);
                        setInventoryItems(inv);
                    });
                }
            });

            // Fetch menu categories
            getPOSCategories(siteId).then(cats => setMenuCategories(cats));
        }

        // Fetch items if not provided
        if (initialItems.length === 0 && siteId) {
            getMenuItems(siteId, 'All', '', 1000).then(({ items }) => {
                setItems(items);
                setIsLoading(false);
            });
        }
    }, [initialItems.length, siteId]);

    const handleSaveCategories = async (cats: POSCategory[]) => {
        if (!siteId) return;
        await savePOSCategories(siteId, cats);
        setMenuCategories(cats);
        toast.success('Categories saved');
    };

    // UI State
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);



    // Category Logic
    const categories = useMemo(() => ['All', ...Array.from(new Set(items.map(i => i.category))).filter(Boolean).sort()], [items]);
    const [selectedCategory, setSelectedCategory] = useState('All');

    const filteredItems = useMemo(() => items.filter(item => {
        if (selectedCategory !== 'All' && item.category !== selectedCategory) return false;
        return true;
    }), [items, selectedCategory]);

    const handleSaveItem = async (data: any) => {
        setIsSubmitting(true);
        const mainImage = data.images && data.images.length > 0 ? data.images[0] : '';
        const numericPrice = Number(data.price);

        const itemData = {
            name: data.name,
            price: numericPrice,
            imageUrl: mainImage,
            images: data.images,
            category: data.category,
            description: data.description,
            isActive: data.isActive,
            variants: data.variants || []
        };

        try {
            // Ensure category exists in settings for global filtering
            if (siteId) await ensureCategoryExists(siteId, itemData.category);

            if (isEditing && editingId && siteId) {
                await updateDoc(doc(db, 'sites', siteId, 'modules/byod_pos/menu_items', editingId), itemData);
                setItems(items.map(i =>
                    i.id === editingId ? { ...i, ...itemData, id: editingId } : i
                ));
            } else if (siteId) {
                const docRef = await addDoc(collection(db, 'sites', siteId, 'modules/byod_pos/menu_items'), itemData);
                const newItem: POSItem = { id: docRef.id, ...itemData } as POSItem;
                setItems([...items, newItem]);
            }
            setIsEditing(false);
            setEditingId(null);
        } catch (error) {
            logger.error('pos.menu.item.save.failed', { siteId, error });
            // Check for permission error (code usually 'permission-denied' or message 'Missing or insufficient permissions')
            const isPermissionError = (error as any)?.code === 'permission-denied' || (error as any)?.message?.includes('Missing or insufficient permissions');

            if (isPermissionError) {
                toast.info("View Only Mode", {
                    description: "You strictly have view-only access based on your role."
                });
            } else {
                toast.error("Failed to save item", {
                    description: "Please try again."
                });
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const toggleItemVisibility = async (item: POSItem) => {
        const newStatus = item.isActive === false; // Toggle
        if (!siteId) return;
        try {
            await updateDoc(doc(db, 'sites', siteId, 'modules/byod_pos/menu_items', item.id), { isActive: newStatus });
            setItems(items.map(i =>
                i.id === item.id ? { ...i, isActive: newStatus } : i
            ));
        } catch (error) {
            logger.error('pos.menu.item.visibility.failed', { siteId, error });
        }
    };

    // Deletion State
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDeleteClick = (id: string) => {
        setItemToDelete(id);
        setDeleteDialogOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!itemToDelete) return;
        setIsDeleting(true);

        try {
            if (!siteId) return;
            await deleteDoc(doc(db, 'sites', siteId, 'modules/byod_pos/menu_items', itemToDelete));
            setItems(items.filter(i => i.id !== itemToDelete));
            if (editingId === itemToDelete) {
                setEditingId(null);
                setIsEditing(false);
            }
        } catch (error) {
            logger.error('pos.menu.item.delete.failed', { siteId, error });
        } finally {
            setIsDeleting(false);
            setDeleteDialogOpen(false);
            setItemToDelete(null);
        }
    };

    // Form State (Only for passing initial data to dialog)
    const [formData, setFormData] = useState({
        name: '',
        price: '',
        category: '',
        description: '',
        images: [] as string[],
        isActive: true
    });

    const handleEdit = (item: POSItem) => {
        const existingImages = item.images && item.images.length > 0
            ? item.images
            : (item.imageUrl ? [item.imageUrl] : []);

        setFormData({
            name: item.name,
            price: item.price.toString(),
            category: item.category,
            description: item.description || '',
            images: existingImages,
            isActive: item.isActive !== false
        });
        setEditingId(item.id);
        setIsEditing(true);
    };

    const openAddDialog = () => {
        setEditingId(null);
        // data passed to dialog will be undefined, triggering its internal reset
        setIsEditing(true);
    };

    return (
        <div>
            <div className="hidden md:flex md:items-center justify-between gap-4 mb-8">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-neutral-100">Menu manager</h1>
                <button
                    onClick={openAddDialog}
                    className="flex items-center gap-1.5 bg-studio-blue text-white px-3 py-2 rounded-lg text-sm font-semibold transition-colors hover:bg-studio-blue/90 active:scale-95"
                >
                    <Plus size={15} /> Add Item
                </button>
            </div>

            {/* Mobile FAB */}
            <button
                onClick={openAddDialog}
                className="md:hidden fixed bottom-20 right-4 z-30 w-14 h-14 bg-studio-blue text-white rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-transform"
                style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
                aria-label="Add Item"
            >
                <Plus size={24} />
            </button>

            {/* Unified Container */}
            <div className="bg-white dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800 overflow-hidden flex flex-col min-h-[600px]">
                {/* Header Controls */}
                <div className="p-4 border-b border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex flex-col xl:flex-row gap-4 justify-between items-start xl:items-center">
                    {/* Category Filter */}
                    <div className="flex gap-2 overflow-x-auto max-w-full pb-2 xl:pb-0 no-scrollbar items-center">
                        {items.length > 0 && categories.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                className={`
                                    px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors border
                                    ${selectedCategory === cat
                                        ? 'bg-studio-blue text-white border-brand-dark'
                                        : 'bg-gray-50 dark:bg-neutral-800/50 text-gray-600 dark:text-neutral-400 border-gray-200 dark:border-neutral-800 hover:border-gray-300 dark:hover:border-neutral-700 hover:bg-gray-100 dark:hover:bg-neutral-700'}
                                `}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 shrink-0 w-full xl:w-auto justify-end">
                        <div className="flex bg-gray-50 dark:bg-neutral-800/50 p-1 rounded-lg border border-gray-200 dark:border-neutral-800">
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-neutral-900 text-brand-dark ring-1 ring-gray-200 dark:ring-neutral-700' : 'text-gray-400 dark:text-neutral-600 hover:text-gray-600 dark:hover:text-neutral-400'}`}
                                title="Grid View"
                            >
                                <LayoutGrid size={18} />
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-white dark:bg-neutral-900 text-brand-dark ring-1 ring-gray-200 dark:ring-neutral-700' : 'text-gray-400 dark:text-neutral-600 hover:text-gray-600 dark:hover:text-neutral-400'}`}
                                title="List View"
                            >
                                <List size={18} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Content Area */}
                <div className={`flex-1 overflow-auto ${viewMode === 'grid' ? 'p-6 bg-gray-50/30 dark:bg-neutral-800/20' : ''}`}>
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-neutral-600">
                            <Store size={48} className="mb-4 opacity-20 animate-pulse" />
                            <p className="font-bold text-lg animate-pulse">Loading Catalog...</p>
                        </div>
                    ) : (
                        <div className={viewMode === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-in fade-in duration-300" : "divide-y divide-gray-100 dark:divide-neutral-800 animate-in fade-in duration-300"}>
                            {filteredItems.map(item => {
                                const isActive = item.isActive !== false;
                                const displayImage = (item.images && item.images[0]) || item.imageUrl;

                                if (viewMode === 'list') {
                                    return (
                                        <div key={item.id} className={`
                                        py-2 px-4 flex flex-col md:flex-row md:items-center gap-3 transition-colors group
                                        ${!isActive ? 'opacity-60 bg-gray-50/50 dark:bg-neutral-800/20' : 'hover:bg-gray-50 dark:hover:bg-neutral-800'}
                                    `}>
                                            <div className="flex items-center gap-3 flex-1 w-full">
                                                <div className="w-10 h-10 bg-gray-100 dark:bg-neutral-800 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200 dark:border-neutral-700">
                                                    {displayImage ? (
                                                        <img src={displayImage} alt={item.name} className={`w-full h-full object-cover ${!isActive ? 'grayscale' : ''}`} />
                                                    ) : (
                                                        <div className={`w-full h-full flex items-center justify-center bg-gray-100 dark:bg-neutral-800 text-gray-400 dark:text-neutral-600 font-bold text-lg ${!isActive ? 'grayscale' : ''}`}>
                                                            {item.name.slice(0, 2).toUpperCase()}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <h3 className="font-bold text-gray-900 dark:text-neutral-100">{item.name}</h3>
                                                        {!isActive && <span className="text-[10px] font-bold bg-gray-200 dark:bg-neutral-700 text-gray-500 dark:text-neutral-500 px-1.5 py-0.5 rounded whitespace-nowrap">HIDDEN</span>}
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-sm text-brand-dark font-black">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(item.price)}</span>
                                                        <span className="text-xs text-gray-500 dark:text-neutral-500 font-medium px-2 py-0.5 bg-gray-100 dark:bg-neutral-800 rounded-md">{item.category}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="hidden md:flex items-center justify-end gap-1 md:w-auto opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => toggleItemVisibility(item)}
                                                    className="p-2 rounded-lg text-gray-400 dark:text-neutral-600 hover:text-gray-700 dark:hover:text-neutral-300 hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors"
                                                    title={isActive ? "Hide" : "Show"}
                                                >
                                                    {isActive ? <Eye size={16} /> : <EyeOff size={16} />}
                                                </button>
                                                <button
                                                    onClick={() => handleEdit(item)}
                                                    className="p-2 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                                                >
                                                    <Pencil size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteClick(item.id)}
                                                    className="p-2 text-red-400 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                }

                                return (
                                    <div key={item.id} className={`
                                    bg-white dark:bg-neutral-900 p-4 rounded-lg border transition-all duration-300 group relative overflow-hidden
                                    ${!isActive ? 'opacity-70 border-gray-200 dark:border-neutral-800' : 'border-gray-200 dark:border-neutral-800 hover:border-brand-dark hover:shadow-md'}
                                `}>
                                        {!isActive && (
                                            <div className="absolute top-0 right-0 left-0 bg-gray-800/80 text-white text-xs font-bold py-1 z-10 text-center backdrop-blur-sm">
                                                HIDDEN
                                            </div>
                                        )}

                                        <div className="aspect-square bg-gray-100 dark:bg-neutral-800 rounded-lg mb-3 overflow-hidden text-brand-dark border border-gray-100 dark:border-neutral-800">
                                            {displayImage ? (
                                                <img src={displayImage} alt={item.name} className={`w-full h-full object-cover ${!isActive ? 'grayscale' : ''}`} />
                                            ) : (
                                                <div className={`w-full h-full flex items-center justify-center bg-gray-100 dark:bg-neutral-800 text-gray-400 dark:text-neutral-600 font-bold text-3xl ${!isActive ? 'grayscale' : ''}`}>
                                                    {item.name.slice(0, 2).toUpperCase()}
                                                </div>
                                            )}
                                        </div>
                                        <h3 className="font-bold text-gray-900 dark:text-neutral-100 leading-tight">{item.name}</h3>
                                        <p className="text-sm text-brand-dark font-black mt-1">
                                            {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(item.price)}
                                        </p>

                                        <div className="absolute top-3 right-3 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => handleEdit(item)} className="p-1.5 bg-white/90 backdrop-blur text-blue-600 rounded-md hover:bg-blue-600 hover:text-white transition-colors ring-1 ring-black/5"><Pencil size={14} /></button>
                                            <button onClick={() => toggleItemVisibility(item)} className="p-1.5 bg-white/90 backdrop-blur text-gray-600 rounded-md hover:bg-gray-800 hover:text-white transition-colors ring-1 ring-black/5">{isActive ? <Eye size={14} /> : <EyeOff size={14} />}</button>
                                            <button onClick={() => handleDeleteClick(item.id)} className="p-1.5 bg-white/90 backdrop-blur text-red-500 rounded-md hover:bg-red-500 hover:text-white transition-colors ring-1 ring-black/5"><Trash2 size={14} /></button>
                                        </div>
                                    </div>
                                );
                            })}
                            {items.length === 0 && <div className="col-span-full flex flex-col items-center justify-center py-20 text-gray-400 dark:text-neutral-600">
                                <Store size={48} className="mb-4 opacity-20" />
                                <p className="font-bold text-lg">Empty Catalog</p>
                                <p className="text-sm">Start by adding your first item.</p>
                            </div>}
                        </div>
                    )}
                </div>
            </div>

            <POSMenuItemDialog
                isOpen={isEditing}
                onClose={() => setIsEditing(false)}
                onSave={handleSaveItem}
                isLoading={isSubmitting}
                inventoryItems={inventoryItems}
                categories={menuCategories}
                onRequestManageCategories={() => setCategoryManagerOpen(true)}
                initialData={editingId ? {
                    name: formData.name,
                    price: formData.price,
                    category: formData.category,
                    description: formData.description,
                    images: formData.images,
                    isActive: formData.isActive,
                    variants: (items.find(i => i.id === editingId) as any)?.variants || []
                } : undefined}
            />

            {categoryManagerOpen && (
                <POSCategoryManagerModal
                    categories={menuCategories}
                    onSave={handleSaveCategories}
                    onClose={() => setCategoryManagerOpen(false)}
                />
            )}

            <ConfirmationDialog
                isOpen={deleteDialogOpen}
                title="Delete Menu Item"
                message="Are you sure you want to delete this item? It will be removed from the POS menu."
                onConfirm={handleConfirmDelete}
                onCancel={() => setDeleteDialogOpen(false)}
                isLoading={isDeleting}
            />
        </div>
    );
}
