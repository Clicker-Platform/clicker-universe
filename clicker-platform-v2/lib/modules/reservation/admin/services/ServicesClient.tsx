'use client';

import { useState, useEffect } from 'react';
import { Service } from '@/lib/modules/reservation/types';
import { createService, updateService, deleteService, getServices } from '@/lib/modules/reservation/api';
import { Plus, Edit2, Trash2, Search, X, Clock, LayoutGrid, List as ListIcon } from 'lucide-react';
import { useSite } from '@/lib/site-context';
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog';

import { ReservationBreadcrumb } from '../components/ReservationBreadcrumb';

interface ServicesClientProps {
    initialServices: Service[];
}

export default function ServicesClient({ initialServices = [] }: ServicesClientProps) {
    const { siteId } = useSite();
    const [services, setServices] = useState<Service[]>(initialServices);

    useEffect(() => {
        if (!siteId) return;
        const loadServices = async () => {
            // Only fetch if initialServices was empty/undefined (ModuleLoader case)
            // We can check if services is empty, but that might re-fetch if validly empty.
            // Best to just check if initialServices prop was provided (implied by this effect running on mount?)
            // Actually, if initialServices is [] because it wasn't passed, we should fetch.
            if (initialServices.length === 0) {
                try {
                    const data = await getServices(siteId);
                    setServices(data);
                } catch (e) {
                    console.error("Failed to fetch services:", e);
                }
            }
        };
        loadServices();
    }, [siteId]);

    const [viewMode, setViewMode] = useState<'list' | 'grid'>('list'); // Default to list view
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingService, setEditingService] = useState<Service | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Category Filter State
    const [selectedCategory, setSelectedCategory] = useState<string>('All');

    // Derived State: Unique Categories
    // We use a Set to get unique values, then sort them alphabeticall
    const categories = ['All', ...Array.from(new Set(services.map(s => s.category).filter((c): c is string => !!c))).sort()];

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        durationMinutes: 60,
        price: 0,
        isActive: true,
        category: ''
    });

    const resetForm = () => {
        setFormData({
            name: '',
            description: '',
            durationMinutes: 60,
            price: 0,
            isActive: true,
            category: ''
        });
        setEditingService(null);
    };

    const handleOpenModal = (service?: Service) => {
        if (service) {
            setEditingService(service);
            setFormData({
                name: service.name,
                description: service.description,
                durationMinutes: service.durationMinutes,
                price: service.price,
                isActive: service.isActive ?? true,
                category: service.category || ''
            });
        } else {
            resetForm();
        }
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting || !siteId) return;

        setIsSubmitting(true);
        try {
            if (editingService) {
                await updateService(siteId, editingService.id, {
                    ...formData,
                    // imageUrl: TODO
                });
                setServices(prev => prev.map(s => s.id === editingService.id ? { ...s, ...formData } : s));
            } else {
                const id = await createService(siteId, {
                    ...formData,
                    currency: 'IDR'
                });
                // Optimistically add to list
                setServices(prev => [...prev, { id, ...formData, currency: 'IDR', isActive: formData.isActive } as Service]);
            }
            setIsModalOpen(false);
            resetForm();
        } catch (error) {
            console.error("Error saving service:", error);
            alert("Failed to save service");
        } finally {
            setIsSubmitting(false);
        }
    };

    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [serviceToDelete, setServiceToDelete] = useState<string | null>(null);

    const confirmDelete = (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setServiceToDelete(id);
        setDeleteDialogOpen(true);
    };

    const executeDelete = async () => {
        if (!serviceToDelete || !siteId) return;

        try {
            await deleteService(siteId, serviceToDelete);
            setServices(prev => prev.filter(s => s.id !== serviceToDelete));
            setDeleteDialogOpen(false);
            setServiceToDelete(null);
        } catch (error) {
            console.error("Error deleting service:", error);
            alert("Failed to delete service");
        }
    };

    const filteredServices = services.filter(s => {
        const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.category?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = selectedCategory === 'All' || s.category === selectedCategory;

        return matchesSearch && matchesCategory;
    });

    return (
        <div>
            <ReservationBreadcrumb currentPage="Services" />
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-black text-brand-dark mb-2 uppercase">Services</h1>
                    <p className="text-gray-600 dark:text-neutral-400 font-medium">Manage your service menu</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="bg-brand-dark text-white px-6 py-2.5 rounded-xl font-bold hover:bg-brand-dark/90 flex items-center gap-2 shadow-lg hover:shadow-xl transition-all cursor-pointer active:scale-95"
                >
                    <Plus size={20} /> Add New Service
                </button>
            </div>

            {/* Services Unified Container */}
            <div className="bg-white dark:bg-neutral-900 rounded-3xl border-[3px] border-brand-dark shadow-sm overflow-hidden flex flex-col min-h-[600px]">
                {/* Header Controls */}
                <div className="p-4 border-b border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex flex-col md:flex-row gap-4">
                    {/* Search */}
                    <div className="relative flex-1">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-neutral-600" size={18} />
                        <input
                            type="text"
                            placeholder="Search services..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-dark/10 focus:border-brand-dark transition-all text-sm font-medium dark:text-neutral-200"
                        />
                    </div>

                    {/* View Toggle */}
                    <div className="flex bg-gray-50 dark:bg-neutral-800/50 p-1 rounded-lg shrink-0 h-[38px] border border-gray-200 dark:border-neutral-700">
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-1.5 rounded-md transition-all flex items-center gap-2 px-3 text-sm ${viewMode === 'list'
                                ? 'bg-white dark:bg-neutral-700 text-brand-dark shadow-sm font-bold border border-gray-100 dark:border-neutral-600'
                                : 'text-gray-500 dark:text-neutral-500 hover:text-gray-700 dark:hover:text-neutral-300 font-medium'
                                }`}
                        >
                            <ListIcon size={16} /> List
                        </button>
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-1.5 rounded-md transition-all flex items-center gap-2 px-3 text-sm ${viewMode === 'grid'
                                ? 'bg-white dark:bg-neutral-700 text-brand-dark shadow-sm font-bold border border-gray-100 dark:border-neutral-600'
                                : 'text-gray-500 dark:text-neutral-500 hover:text-gray-700 dark:hover:text-neutral-300 font-medium'
                                }`}
                        >
                            <LayoutGrid size={16} /> Grid
                        </button>
                    </div>
                </div>

                {/* Category Pills - Horizontal Scroll */}
                <div className="px-4 pb-4 border-b border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-x-auto no-scrollbar">
                    <div className="flex items-center gap-2">
                        {categories.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                className={`
                                    px-4 py-1.5 rounded-full text-sm font-bold whitespace-nowrap transition-all
                                    ${selectedCategory === cat
                                        ? 'bg-brand-dark text-white shadow-md shadow-brand-dark/20'
                                        : 'bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-neutral-500 hover:bg-gray-200 dark:hover:bg-neutral-700'
                                    }
                                `}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content Area */}
                <div className={`flex-1 overflow-auto ${viewMode === 'grid' ? 'p-6 bg-gray-50/30 dark:bg-neutral-800/20' : ''}`}>
                    {filteredServices.length === 0 ? (
                        <div className="flex flex-col items-center justify-center text-center h-full p-12">
                            <h3 className="text-xl font-bold text-gray-800 dark:text-neutral-200 mb-2">No services found</h3>
                            <p className="text-gray-500 dark:text-neutral-500 max-w-md mx-auto">
                                Try adjusting your search query or add a new service.
                            </p>
                        </div>
                    ) : viewMode === 'list' ? (
                        // LIST VIEW
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 dark:bg-neutral-800/50 text-gray-500 dark:text-neutral-500 font-bold text-xs uppercase tracking-wider sticky top-0 z-10">
                                <tr>
                                    <th className="py-4 px-6 border-b border-gray-100 dark:border-neutral-800">Service Name</th>
                                    <th className="py-4 px-6 border-b border-gray-100 dark:border-neutral-800">Category</th>
                                    <th className="py-4 px-6 border-b border-gray-100 dark:border-neutral-800">Price</th>
                                    <th className="py-4 px-6 border-b border-gray-100 dark:border-neutral-800">Duration</th>
                                    <th className="py-4 px-6 border-b border-gray-100 dark:border-neutral-800">Status</th>
                                    <th className="py-4 px-6 border-b border-gray-100 dark:border-neutral-800 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                                {filteredServices.map(service => (
                                    <tr key={service.id} className="hover:bg-gray-50/80 dark:hover:bg-neutral-800/50 transition-colors group">
                                        <td className="py-4 px-6">
                                            <p className="font-bold text-brand-dark">{service.name}</p>
                                            {service.description && (
                                                <p className="text-xs text-gray-400 dark:text-neutral-600 line-clamp-1 mt-0.5">{service.description}</p>
                                            )}
                                        </td>
                                        <td className="py-4 px-6">
                                            <span className="text-xs font-bold text-gray-600 dark:text-neutral-400 px-2 py-1 bg-gray-100 dark:bg-neutral-800 rounded-md uppercase tracking-wide">
                                                {service.category || 'Uncategorized'}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6">
                                            <span className="font-black text-brand-dark">
                                                {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(service.price)}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6">
                                            <div className="flex items-center gap-1.5 text-sm font-medium text-gray-500 dark:text-neutral-500">
                                                <Clock size={14} /> {service.durationMinutes}m
                                            </div>
                                        </td>
                                        <td className="py-4 px-6">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${service.isActive
                                                ? 'bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-400'
                                                : 'bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-neutral-500'
                                                }`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${service.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
                                                {service.isActive ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => handleOpenModal(service)}
                                                    className="p-2 hover:bg-blue-50 dark:hover:bg-blue-950/30 text-gray-400 dark:text-neutral-600 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg transition-colors"
                                                    title="Edit"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    onClick={(e) => confirmDelete(service.id, e)}
                                                    className="p-2 hover:bg-red-50 dark:hover:bg-red-950/30 text-gray-400 dark:text-neutral-600 hover:text-red-600 dark:hover:text-red-400 rounded-lg transition-colors"
                                                    title="Delete"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        // GRID VIEW
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredServices.map(service => (
                                <div key={service.id} className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-200 dark:border-neutral-800 p-5 shadow-sm hover:shadow-md transition-all hover:border-brand-dark/20 relative group">
                                    <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                        <button onClick={() => handleOpenModal(service)} className="p-2 bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 shadow-sm rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:text-blue-600 dark:hover:text-blue-400 text-gray-600 dark:text-neutral-400 cursor-pointer active:scale-95 transition-all">
                                            <Edit2 size={14} />
                                        </button>
                                        <button onClick={() => confirmDelete(service.id)} className="p-2 bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 shadow-sm rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 dark:hover:text-red-400 text-gray-600 dark:text-neutral-400 cursor-pointer active:scale-95 transition-all">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>

                                    <div className="mb-3 pr-8">
                                        <h3 className="text-lg font-black text-brand-dark leading-tight">{service.name}</h3>
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-neutral-500 bg-gray-100 dark:bg-neutral-800 px-2 py-0.5 rounded-md inline-block mt-2">
                                            {service.category || 'No Category'}
                                        </span>
                                    </div>
                                    <p className="text-gray-500 dark:text-neutral-500 text-sm mb-4 line-clamp-2 h-10 font-medium">{service.description}</p>

                                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100 dark:border-neutral-800">
                                        <div className="font-black text-brand-dark text-lg">
                                            {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(service.price)}
                                        </div>
                                        <div className="text-xs font-bold text-gray-400 dark:text-neutral-600 flex items-center gap-1 bg-gray-50 dark:bg-neutral-800 px-2 py-1 rounded-full">
                                            <Clock size={12} /> {service.durationMinutes}m
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-neutral-900 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-neutral-800">
                            <h2 className="text-xl font-bold text-brand-dark">
                                {editingService ? 'Edit Service' : 'New Service'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-full transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-neutral-300 mb-1">Service Name</label>
                                <input
                                    required
                                    type="text"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-neutral-700 focus:outline-none focus:border-brand-dark dark:bg-neutral-800 dark:text-neutral-200"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-neutral-300 mb-1">Price</label>
                                    <input
                                        required
                                        type="number"
                                        min="0"
                                        value={formData.price}
                                        onChange={e => setFormData({ ...formData, price: Number(e.target.value) })}
                                        className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-neutral-700 focus:outline-none focus:border-brand-dark dark:bg-neutral-800 dark:text-neutral-200"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-neutral-300 mb-1">Duration (min)</label>
                                    <input
                                        required
                                        type="number"
                                        min="5"
                                        step="5"
                                        value={formData.durationMinutes}
                                        onChange={e => setFormData({ ...formData, durationMinutes: Number(e.target.value) })}
                                        className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-neutral-700 focus:outline-none focus:border-brand-dark dark:bg-neutral-800 dark:text-neutral-200"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-neutral-300 mb-1">Category</label>
                                <input
                                    type="text"
                                    value={formData.category}
                                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                                    placeholder="e.g. Hair, Facial, Massage"
                                    className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-neutral-700 focus:outline-none focus:border-brand-dark dark:bg-neutral-800 dark:text-neutral-200"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-neutral-300 mb-1">Description</label>
                                <textarea
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    rows={3}
                                    className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-neutral-700 focus:outline-none focus:border-brand-dark dark:bg-neutral-800 dark:text-neutral-200"
                                />
                            </div>

                            <div className="flex items-center gap-2 pt-2">
                                <input
                                    type="checkbox"
                                    id="isActive"
                                    checked={formData.isActive}
                                    onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
                                    className="w-5 h-5 rounded border-gray-300 dark:border-neutral-700 text-brand-dark focus:ring-brand-dark"
                                />
                                <label htmlFor="isActive" className="text-sm font-medium text-gray-700 dark:text-neutral-300">Available for booking</label>
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    disabled={isSubmitting}
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 py-3 px-4 rounded-xl font-bold text-gray-600 dark:text-neutral-400 bg-gray-100 dark:bg-neutral-800 hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors cursor-pointer active:scale-95 disabled:opacity-50 disabled:active:scale-100"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="flex-1 py-3 px-4 rounded-xl font-bold text-white bg-brand-dark hover:bg-brand-dark/90 transition-colors cursor-pointer active:scale-95 disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2"
                                >
                                    {isSubmitting && <Clock size={18} className="animate-spin" />}
                                    {isSubmitting ? 'Saving...' : 'Save Service'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <ConfirmationDialog
                isOpen={deleteDialogOpen}
                title="Delete Service"
                message="Are you sure you want to delete this service? This action cannot be undone."
                onConfirm={executeDelete}
                onCancel={() => setDeleteDialogOpen(false)}
                confirmLabel="Delete Service"
                isDestructive={true}
            />
        </div>
    );
}
