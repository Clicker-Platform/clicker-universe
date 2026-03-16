'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, Box, AlertTriangle, Pencil, Trash2, PackageOpen, History } from 'lucide-react';
import { getInventory, createInventoryItem, updateStock } from '@/lib/modules/inventory/api';
import { InventoryItem, TransactionReason } from '@/lib/modules/inventory/types';
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, deleteDoc, doc, updateDoc, where } from 'firebase/firestore';
import { toast } from 'sonner';
import { useSite } from '@/lib/site-context'; // New import
import { usePermission } from '@/components/admin/PermissionGuard'; // Import

import { InventorySkeleton } from './InventorySkeleton';
import { InventoryItemForm } from './InventoryItemForm';
import { AdjustStockDialog } from './AdjustStockDialog';
import { StockHistoryDrawer } from './StockHistoryDrawer';

export default function InventoryPage() {
    const { siteId } = useSite();
    const { isViewOnly } = usePermission(); // Use context
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Modals & Dialogs State
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<InventoryItem | undefined>(undefined);

    const [adjustItem, setAdjustItem] = useState<InventoryItem | null>(null);
    const [historyItem, setHistoryItem] = useState<InventoryItem | null>(null);

    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Form Handling State
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [posItems, setPosItems] = useState<{ id: string, name: string }[]>([]);

    useEffect(() => {
        if (siteId) fetchData();
    }, [siteId]);

    const fetchData = async () => {
        try {
            // Check if POS module is enabled
            let posItemsData: { id: string, name: string }[] = [];

            // Dynamic import to avoid hard dependency on registry if possible, 
            // though registry is core. Using dynamic here for consistency.
            const { isModuleEnabled } = await import('@/lib/modules/registry');
            const posEnabled = await isModuleEnabled('byod_pos');

            const promises: Promise<any>[] = [getInventory(siteId)];

            if (posEnabled) {
                // Use siteId for menu items fetch too if needed, but direct query needs update
                // Direct query to 'modules/byod_pos/menu_items' is WRONG for multi-tenant.
                // Should be `sites/${siteId}/modules/byod_pos/menu_items`
                promises.push(getDocs(query(collection(db, 'sites', siteId, 'modules', 'byod_pos', 'menu_items'), orderBy('name'))));
            }

            const results = await Promise.all(promises);
            const inventoryData = results[0];

            if (posEnabled && results[1]) {
                const posSnap = results[1] as any; // Firestore QuerySnapshot
                posItemsData = posSnap.docs.map((d: any) => ({ id: d.id, name: d.data().name }));
            }

            setItems(inventoryData);
            setPosItems(posItemsData);
        } catch (error) {
            console.error("Failed to fetch data", error);
            toast.error("Failed to load inventory data");
        } finally {
            setLoading(false);
        }
    };

    // --- Actions ---

    const handleCreateOrUpdate = async (formData: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'>) => {
        if (!siteId) return;
        setIsSubmitting(true);
        try {
            if (editingItem) {
                // Update manually constructed path to be tenant-aware or use API if available?
                // The original code used updateDoc directly. Better to use API or fix path.
                // Let's fix path: `sites/${siteId}/modules/inventory/items`
                await updateDoc(doc(db, 'sites', siteId, 'modules/inventory/items', editingItem.id), {
                    ...formData,
                    // Ensure numeric values
                    currentStock: Number(formData.currentStock),
                    lowStockThreshold: Number(formData.lowStockThreshold),
                    costPrice: Number(formData.costPrice || 0)
                });
                toast.success("Item updated successfully");
            } else {
                await createInventoryItem(siteId, formData);
                toast.success("Item created successfully");
            }

            setIsFormOpen(false);
            setEditingItem(undefined);
            fetchData();
        } catch (error) {
            console.error(error);
            const isPermissionError = (error as any)?.code === 'permission-denied' || (error as any)?.message?.includes('Missing or insufficient permissions');
            if (isPermissionError) {
                toast.info("View Only Mode", {
                    description: "You strictly have view-only access based on your role."
                });
            } else {
                toast.error("Failed to save item");
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAdjustStockConfirm = async (quantity: number, reason: TransactionReason) => {
        if (!adjustItem) return;
        try {
            await updateStock(
                siteId,
                adjustItem.id,
                quantity,
                reason,
                undefined,
                'Manual Adjustment'
            );
            toast.success(`Stock adjusted by ${quantity} (${reason})`);
            setAdjustItem(null);
            fetchData();
        } catch (error: any) {
            toast.error('Error updating stock: ' + error.message);
            throw error; // Re-throw to let the dialog know if needed, though mostly handled here
        }
    };

    const handleDeleteClick = (id: string) => {
        setDeleteId(id);
    };

    const handleConfirmDelete = async () => {
        if (!deleteId) return;
        setIsDeleting(true);
        try {
            // Verify query path for orders!
            // Old: 'modules/byod_pos/orders'
            // New: 'sites/${siteId}/modules/byod_pos/orders'
            const activeOrdersQ = query(
                collection(db, 'sites', siteId, 'modules/byod_pos/orders'),
                where('status', 'in', ['pending', 'preparing', 'ready'])
            );
            const snapshot = await getDocs(activeOrdersQ);

            const conflictingOrder = snapshot.docs.find(d => {
                const data = d.data();
                return data.items?.some((item: any) => item.inventoryId === deleteId);
            });

            if (conflictingOrder) {
                toast.error(`Cannot delete. Used in active order #${conflictingOrder.id.slice(-4).toUpperCase()}`);
                setIsDeleting(false);
                setDeleteId(null);
                return;
            }

            await deleteDoc(doc(db, 'sites', siteId, 'modules/inventory/items', deleteId));
            toast.success("Item deleted successfully");
            fetchData();
        } catch (error) {
            console.error(error);
            toast.error("Failed to delete item");
        } finally {
            setIsDeleting(false);
            setDeleteId(null);
        }
    };

    // --- Render Helpers ---

    const filteredItems = items.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sku.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const openAddModal = () => {
        setEditingItem(undefined);
        setIsFormOpen(true);
    };

    const openEditModal = (item: InventoryItem) => {
        setEditingItem(item);
        setIsFormOpen(true);
    };

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-brand-dark mb-2 uppercase tracking-tight flex items-center gap-3">
                        <Box size={32} className="text-brand-dark" /> Inventory
                    </h1>
                    <p className="text-gray-500 dark:text-neutral-500 font-medium">Manage products, stock levels and usage</p>
                </div>
            </div>
            {!isViewOnly && (
                <button
                    onClick={openAddModal}
                    className="bg-brand-dark text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-gray-800 transition shadow-lg shadow-brand-dark/20 active:scale-95"
                >
                    <Plus size={20} /> Add Item
                </button>
            )}


            {/* Inventory List Container */}
            <div className="bg-white dark:bg-neutral-900 rounded-3xl border-[3px] border-brand-dark shadow-sm overflow-hidden flex flex-col min-h-[600px]">
                {/* Search Header */}
                <div className="p-4 border-b border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-900">
                    <div className="relative max-w-md">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-neutral-600" size={18} />
                        <input
                            type="text"
                            placeholder="Search by Name or SKU..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 dark:text-neutral-200 dark:placeholder-neutral-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-dark/10 focus:border-brand-dark transition-all text-sm font-medium"
                        />
                    </div>
                </div>

                {/* Table Content */}
                <div className="flex-1 overflow-auto bg-gray-50/30 dark:bg-neutral-800/20">
                    {loading ? (
                        <div className="p-4">
                            <InventorySkeleton />
                        </div>
                    ) : filteredItems.length > 0 ? (
                        <>
                            {/* Desktop Table View */}
                            <div className="hidden xl:block">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50 dark:bg-neutral-800/50 text-gray-500 dark:text-neutral-500 font-bold text-xs uppercase tracking-wider sticky top-0 z-10">
                                        <tr>
                                            <th className="px-6 py-4 border-b border-gray-100 dark:border-neutral-800">SKU</th>
                                            <th className="px-6 py-4 border-b border-gray-100 dark:border-neutral-800">Item Name</th>
                                            <th className="px-6 py-4 border-b border-gray-100 dark:border-neutral-800 text-center">Stock</th>
                                            <th className="px-6 py-4 border-b border-gray-100 dark:border-neutral-800 text-center">Unit</th>
                                            <th className="px-6 py-4 border-b border-gray-100 dark:border-neutral-800 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-neutral-800 bg-white dark:bg-neutral-900">
                                        {filteredItems.map(item => {
                                            const isLowStock = item.currentStock <= item.lowStockThreshold;
                                            return (
                                                <tr key={item.id} className="hover:bg-gray-50/80 dark:hover:bg-neutral-800/50 transition-colors group">
                                                    <td className="px-6 py-4 font-mono text-sm text-gray-500 dark:text-neutral-500">{item.sku}</td>
                                                    <td className="px-6 py-4 font-medium text-gray-800 dark:text-neutral-200">
                                                        <div className="flex items-center gap-2">
                                                            {item.name}
                                                            {isLowStock && (
                                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700 animate-pulse">
                                                                    <AlertTriangle size={12} className="mr-1" /> Low
                                                                </span>
                                                            )}
                                                            {item.linkedPosItemId && (
                                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200" title="Linked to POS Item">
                                                                    Linked
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${isLowStock ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'
                                                            }`}>
                                                            {item.currentStock}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-center text-gray-500 dark:text-neutral-500 text-sm">{item.unit}</td>
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="flex items-center justify-end gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
                                                            {!isViewOnly && (
                                                                <button
                                                                    onClick={() => setAdjustItem(item)}
                                                                    className="text-brand-dark hover:bg-gray-100 dark:hover:bg-neutral-700 hover:text-black dark:hover:text-white px-3 py-1.5 rounded-lg text-sm font-semibold border border-gray-200 dark:border-neutral-700 transition-colors"
                                                                >
                                                                    Adjust
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => setHistoryItem(item)}
                                                                className="p-2 text-gray-400 dark:text-neutral-600 hover:text-brand-dark hover:bg-gray-100 dark:hover:bg-neutral-700 rounded-lg transition-colors"
                                                                title="History"
                                                            >
                                                                <History size={18} />
                                                            </button>
                                                            {!isViewOnly && (
                                                                <>
                                                                    <button
                                                                        onClick={() => openEditModal(item)}
                                                                        className="p-2 text-gray-400 dark:text-neutral-600 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-lg transition-colors"
                                                                        title="Edit"
                                                                    >
                                                                        <Pencil size={18} />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleDeleteClick(item.id)}
                                                                        className="p-2 text-gray-400 dark:text-neutral-600 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                                                                        title="Delete"
                                                                    >
                                                                        <Trash2 size={18} />
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile/Tablet Card View */}
                            <div className="block xl:hidden p-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {filteredItems.map(item => {
                                        const isLowStock = item.currentStock <= item.lowStockThreshold;
                                        return (
                                            <div key={item.id} className="bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-gray-100 dark:border-neutral-800 shadow-sm hover:shadow-md transition-all flex flex-col">
                                                <div className="flex justify-between items-start mb-3">
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="font-mono text-xs text-gray-400 dark:text-neutral-600 bg-gray-50 dark:bg-neutral-800 px-2 py-0.5 rounded">{item.sku}</span>
                                                            {isLowStock && (
                                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">
                                                                    Low Stock
                                                                </span>
                                                            )}
                                                        </div>
                                                        <h3 className="font-bold text-brand-dark text-lg leading-tight">{item.name}</h3>
                                                    </div>
                                                    <span className={`inline-flex items-center justify-center min-w-[3rem] px-2 py-1 rounded-lg text-sm font-bold ${isLowStock ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'
                                                        }`}>
                                                        {item.currentStock} <span className="text-[10px] ml-1 opacity-70 uppercase">{item.unit}</span>
                                                    </span>
                                                </div>

                                                <div className="mt-auto pt-4 flex items-center justify-between border-t border-gray-50 dark:border-neutral-800 gap-2">
                                                    {!isViewOnly && (
                                                        <button
                                                            onClick={() => setAdjustItem(item)}
                                                            className="flex-1 bg-gray-50 dark:bg-neutral-800 hover:bg-gray-100 dark:hover:bg-neutral-700 text-brand-dark text-sm font-bold py-2 rounded-lg transition-colors border border-gray-200 dark:border-neutral-700"
                                                        >
                                                            Adjust
                                                        </button>
                                                    )}
                                                    <div className="flex gap-1">
                                                        <button
                                                            onClick={() => setHistoryItem(item)}
                                                            className="p-2 text-gray-400 dark:text-neutral-600 hover:text-brand-dark hover:bg-gray-100 dark:hover:bg-neutral-700 rounded-lg transition-colors border border-transparent hover:border-gray-200 dark:hover:border-neutral-700"
                                                        >
                                                            <History size={18} />
                                                        </button>
                                                        {!isViewOnly && (
                                                            <>
                                                                <button
                                                                    onClick={() => openEditModal(item)}
                                                                    className="p-2 text-gray-400 dark:text-neutral-600 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-lg transition-colors border border-transparent hover:border-blue-100"
                                                                >
                                                                    <Pencil size={18} />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteClick(item.id)}
                                                                    className="p-2 text-gray-400 dark:text-neutral-600 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors border border-transparent hover:border-red-100"
                                                                >
                                                                    <Trash2 size={18} />
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center text-center h-full p-12">
                            <div className="bg-gray-50 dark:bg-neutral-800 p-4 rounded-full mb-4">
                                <PackageOpen size={48} className="text-gray-300 dark:text-neutral-600" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-800 dark:text-neutral-200 mb-2">No items found</h3>
                            <p className="text-gray-500 dark:text-neutral-500 max-w-md mx-auto mb-6">
                                We couldn't find any inventory items matching your search. Try adjusting your filters or create a new item.
                            </p>
                            <button
                                onClick={openAddModal}
                                className="bg-brand-dark text-white px-6 py-3 rounded-xl font-bold hover:bg-gray-800 transition shadow-lg shadow-brand-dark/20"
                            >
                                Create First Item
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Modals */}
            <InventoryItemForm
                isOpen={isFormOpen}
                onClose={() => setIsFormOpen(false)}
                onSubmit={handleCreateOrUpdate}
                initialData={editingItem}
                posItems={posItems}
                isSubmitting={isSubmitting}
            />

            <AdjustStockDialog
                isOpen={!!adjustItem}
                onClose={() => setAdjustItem(null)}
                item={adjustItem}
                onConfirm={handleAdjustStockConfirm}
            />

            <StockHistoryDrawer
                isOpen={!!historyItem}
                onClose={() => setHistoryItem(null)}
                item={historyItem}
            />

            <ConfirmationDialog
                isOpen={!!deleteId}
                title="Delete Inventory Item"
                message="Are you sure you want to delete this item? This action cannot be undone."
                onConfirm={handleConfirmDelete}
                onCancel={() => setDeleteId(null)}
                isLoading={isDeleting}
            />
        </div >
    );
}
