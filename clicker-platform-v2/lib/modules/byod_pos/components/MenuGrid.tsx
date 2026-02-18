'use client';

import NextImage from 'next/image';

import { useEffect, useState } from 'react';
import { useCart } from '../cart-context';
import { Plus, Search } from 'lucide-react';
import { InventoryItem } from '@/lib/modules/inventory/types';
import { getMenuItems, getPOSSettings } from '@/lib/modules/byod_pos/api';
import { POSItem } from '@/lib/modules/byod_pos/types';

import { VariantSelectionDialog } from './VariantSelectionDialog';
import { useSite } from '@/lib/site-context';

interface MenuGridProps {
    initialItems?: POSItem[];
    initialInventoryMap?: Record<string, InventoryItem>;
}

export function MenuGrid({ initialItems, initialInventoryMap }: MenuGridProps) {
    const { siteId } = useSite();
    const { addToCart, itemCount } = useCart();
    const [items, setItems] = useState<POSItem[]>(initialItems || []);
    const [inventoryMap, setInventoryMap] = useState<Record<string, InventoryItem>>(initialInventoryMap || {});
    const [inventoryById, setInventoryById] = useState<Record<string, InventoryItem>>({});

    const [loading, setLoading] = useState(!initialItems);
    const [selectedItemForVariant, setSelectedItemForVariant] = useState<POSItem | null>(null);

    // Filtering & Categories
    const [categories, setCategories] = useState<string[]>(['All']);
    const [activeCategory, setActiveCategory] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');

    const [lastDoc, setLastDoc] = useState<any>(null);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    // Debounce Search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Initial Load: Settings & Inventory
    useEffect(() => {
        async function init() {
            if (!siteId) return;

            try {
                const settings = await getPOSSettings(siteId);
                if (settings.categories && settings.categories.length > 0) {
                    setCategories(['All', ...settings.categories.sort()]);
                } else {
                    if (initialItems && initialItems.length > 0) {
                        const derived = Array.from(new Set(initialItems.map(i => i.category))).filter(Boolean).sort();
                        setCategories(['All', ...derived]);
                    }
                }

                // Dynamic Import for Modularity
                const { isModuleEnabled } = await import('@/lib/modules/registry');
                const inventoryEnabled = await isModuleEnabled('inventory');

                if (inventoryEnabled) {
                    try {
                        const { getInventory } = await import('@/lib/modules/inventory/api');
                        const inventoryItems = await getInventory(siteId);

                        const invById: Record<string, InventoryItem> = {};
                        inventoryItems.forEach(invItem => {
                            invById[invItem.id] = invItem;
                        });
                        setInventoryById(invById);
                    } catch (inventoryError: any) {
                        // Gracefully handle permission errors for Public POS
                        if (inventoryError.code === 'permission-denied' || inventoryError.message?.includes('permission-denied') || inventoryError.message?.includes('Missing or insufficient permissions')) {
                            console.warn("Inventory access restricted (Public POS). Stock levels will not be tracked.");
                        } else {
                            throw inventoryError;
                        }
                    }
                }
            } catch (e) {
                console.error("Failed to init POS", e);
            }
        }
        init();
    }, [siteId]);

    // Fetch Items on Filter Change
    useEffect(() => {
        async function fetchItems() {
            if (!siteId) return;

            setLoading(true);
            setLastDoc(null); // Reset pagination
            try {
                const { items: fetchedItems, lastDoc: newLastDoc } = await getMenuItems(siteId, activeCategory, debouncedSearch, 20, null);

                setItems(fetchedItems);
                setLastDoc(newLastDoc);
                setHasMore(!!newLastDoc);

                // Self-healing categories
                if (activeCategory === 'All' && categories.length === 1 && fetchedItems.length > 0) {
                    const derived = Array.from(new Set(fetchedItems.map(i => i.category))).filter(Boolean).sort();
                    if (derived.length > 0) {
                        setCategories(['All', ...derived]);
                    }
                }
            } catch (e) {
                console.error("Error fetching items", e);
            } finally {
                setLoading(false);
            }
        }
        fetchItems();
    }, [activeCategory, debouncedSearch, siteId]);

    const loadMore = async () => {
        if (!lastDoc || loadingMore || !siteId) return;
        setLoadingMore(true);
        try {
            const { items: newItems, lastDoc: newLastDoc } = await getMenuItems(siteId, activeCategory, debouncedSearch, 20, lastDoc);
            setItems(prev => [...prev, ...newItems]);
            setLastDoc(newLastDoc);
            setHasMore(!!newLastDoc);
        } catch (e) {
            console.error("Error loading more items", e);
        } finally {
            setLoadingMore(false);
        }
    };

    // Helper to find stock for an item
    const getStockForItem = (item: POSItem) => {
        // We need the raw inventory lists or maps. 
        // Let's use `inventoryById` or re-fetch?
        // Actually, preventing `inventoryMap` complexity:
        // Let's just find by ID (linked) or Name.
        // We need access to the FULL inventory list to match by name?
        // We can't easily do "match by name" if we only have ID map.
        // But `inventoryById` is by ID.
        // `initialInventoryMap` logic in original code built a map `itemID -> stock`.
        // We should replicate that for the *current* items.
        // But `inventoryItems` (array) is not in state, only `inventoryById`.
        // I should put `inventoryItems` in state or `invByLink`/`invByName` in state.
        return null; // Implementation detail below
    };

    // We need `invByLink` and `invByName` in state to map correctly.
    const [lookupMaps, setLookupMaps] = useState<{ byLink: Record<string, InventoryItem>, byName: Record<string, InventoryItem> }>({ byLink: {}, byName: {} });

    useEffect(() => {
        if (!siteId) return;

        async function loadInventoryMaps() {
            const { isModuleEnabled } = await import('@/lib/modules/registry');
            const inventoryEnabled = await isModuleEnabled('inventory');

            if (inventoryEnabled) {
                const { getInventory } = await import('@/lib/modules/inventory/api');
                const inv = await getInventory(siteId);
                const byLink: Record<string, InventoryItem> = {};
                const byName: Record<string, InventoryItem> = {};
                const byId: Record<string, InventoryItem> = {};
                inv.forEach(i => {
                    byId[i.id] = i;
                    if (i.linkedPosItemId) byLink[i.linkedPosItemId] = i;
                    byName[i.name] = i;
                });
                setLookupMaps({ byLink, byName });
                setInventoryById(byId);
            }
        }

        loadInventoryMaps();
    }, [siteId]);

    const getItemStock = (item: POSItem) => {
        if (lookupMaps.byLink[item.id]) return lookupMaps.byLink[item.id];
        if (lookupMaps.byName[item.name]) return lookupMaps.byName[item.name];
        return undefined;
    };

    const handleItemClick = (item: POSItem, linkedStock: InventoryItem | undefined) => {
        if (item.variants && item.variants.length > 0) {
            setSelectedItemForVariant(item);
        } else {
            addToCart({
                productId: item.id,
                name: item.name,
                price: item.price,
                quantity: 1,
                image: item.imageUrl,
                inventoryId: linkedStock?.id
            });
        }
    };

    return (
        <div className={`p-2 ${itemCount > 0 ? 'pb-24' : 'pb-2'} space-y-6`}>
            {/* Search & Filter Header */}
            <div className="space-y-4 px-2">
                {/* Search Bar */}
                <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                        <Search size={20} />
                    </div>
                    <input
                        type="text"
                        placeholder="Search items..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-white rounded-xl border-[3px] border-brand-dark focus:outline-none focus:ring-4 focus:ring-brand-dark/10 font-bold transition-shadow"
                    />
                </div>

                {/* Categories */}
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setActiveCategory(cat)}
                            className={`
                                px-4 py-2 rounded-full font-bold whitespace-nowrap border-[3px] transition-all
                                ${activeCategory === cat
                                    ? 'bg-brand-dark text-white border-brand-dark shadow-md'
                                    : 'bg-white text-gray-700 border-brand-dark hover:bg-gray-50'}
                            `}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            {/* Grid */}
            {loading ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                        <div key={i} className="aspect-square bg-gray-100 rounded-3xl animate-pulse" />
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2">
                    {items.map((item, index) => {
                        const linkedStock = getItemStock(item);
                        const hasVariants = item.variants && item.variants.length > 0;
                        const isOutOfStock = !hasVariants && linkedStock && linkedStock.currentStock <= 0;

                        return (
                            <div key={item.id} className={`bg-white rounded-3xl border-[3px] border-brand-dark shadow-sm overflow-hidden flex flex-col hover:-translate-y-1 hover:shadow-md transition-all duration-300 ${isOutOfStock ? 'opacity-60 grayscale' : ''}`}>
                                <div className="aspect-square bg-gray-100 relative">
                                    {item.imageUrl ? (
                                        <NextImage
                                            src={item.imageUrl}
                                            alt={item.name}
                                            fill
                                            unoptimized
                                            className="object-cover"
                                            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
                                            priority={index < 4}
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-gray-200 text-gray-400 font-bold text-4xl uppercase">
                                            {item.name.slice(0, 2)}
                                        </div>
                                    )}
                                    {isOutOfStock && (
                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
                                            <span className="text-white font-bold bg-red-600 px-2 py-1 text-xs rounded">SOLD OUT</span>
                                        </div>
                                    )}
                                </div>
                                <div className="p-3 flex items-start justify-between gap-2 flex-1">
                                    <div>
                                        <h3 className="font-bold text-gray-800 text-sm line-clamp-2 leading-tight mb-1">{item.name}</h3>
                                        <div className="text-brand-dark font-black text-sm">
                                            {hasVariants && <span className="text-xs text-gray-400 font-normal mr-1">from</span>}
                                            {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(item.price)}
                                        </div>
                                    </div>
                                </div>
                                <div className="p-3 pt-0 mt-auto">
                                    <button
                                        disabled={isOutOfStock}
                                        onClick={() => handleItemClick(item, linkedStock)}
                                        className="w-full py-3 bg-brand-dark text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 hover:bg-gray-800 disabled:bg-gray-300 transition-all duration-200 active:scale-95 hover:scale-[1.02]"
                                    >
                                        <Plus size={18} /> Add
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                    {items.length === 0 && (
                        <div className="col-span-full py-12 text-center text-gray-400">
                            No items found matching your search.
                        </div>
                    )}
                </div>
            )}

            {/* Load More Button */}
            {hasMore && !loading && (
                <div className="flex justify-center pb-8">
                    <button
                        onClick={loadMore}
                        disabled={loadingMore}
                        className="px-6 py-3 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl shadow-sm hover:bg-gray-50 disabled:opacity-50"
                    >
                        {loadingMore ? 'Loading...' : 'Load More Items'}
                    </button>
                </div>
            )}

            {/* Variant Selection Dialog */}
            {selectedItemForVariant && (
                <VariantSelectionDialog
                    isOpen={!!selectedItemForVariant}
                    itemName={selectedItemForVariant.name}
                    variants={selectedItemForVariant.variants || []}
                    inventoryMap={inventoryById}
                    onClose={() => setSelectedItemForVariant(null)}
                    onSelect={(variant) => {
                        addToCart({
                            productId: selectedItemForVariant.id,
                            name: selectedItemForVariant.name,
                            price: variant.price,
                            quantity: 1,
                            image: selectedItemForVariant.imageUrl,
                            inventoryId: variant.inventoryId,
                            variantId: variant.id,
                            variantName: variant.name
                        });
                        setSelectedItemForVariant(null);
                    }}
                />
            )}
        </div>
    );
}
