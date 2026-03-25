'use client';

import { useEffect, useState } from 'react';
import { ExternalLink, Wrench } from 'lucide-react';
import { useSite } from '@/lib/site-context';
import { getServiceTypes, toggleServiceType } from '../api';
import type { ServiceType } from '../types';
import Link from 'next/link';
import { getServiceCategories } from '@/lib/core/serviceCatalog/api';
import type { ServiceCategoryConfig } from '@/lib/core/serviceCatalog/types';
import { DEFAULT_SERVICE_CATEGORIES } from '@/lib/core/serviceCatalog/types';

function getCatColor(cats: ServiceCategoryConfig[], label: string): string {
    return cats.find(c => c.label === label)?.color ?? 'bg-gray-100 text-gray-600';
}

export default function ServiceTypesPage() {
    const { siteId } = useSite();
    const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
    const [categories, setCategories] = useState<ServiceCategoryConfig[]>(DEFAULT_SERVICE_CATEGORIES);
    const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    useEffect(() => {
        if (!siteId) return;
        loadTypes();
        getServiceCategories(siteId).then(setCategories).catch(console.error);
    }, [siteId]);

    async function loadTypes() {
        setLoading(true);
        try {
            const types = await getServiceTypes(siteId);
            setServiceTypes(types);
        } catch (err) {
            console.error('[SR ServiceTypesPage] load error:', err);
        } finally {
            setLoading(false);
        }
    }

    function showToast(type: 'success' | 'error', message: string) {
        setToast({ type, message });
        setTimeout(() => setToast(null), 3000);
    }

    async function handleToggle(type: ServiceType) {
        try {
            await toggleServiceType(siteId, type.id, !type.isActive);
            setServiceTypes(prev => prev.map(t => t.id === type.id ? { ...t, isActive: !t.isActive } : t));
        } catch (err) {
            console.error('[SR ServiceTypesPage] toggle error:', err);
            showToast('error', 'Failed to update status');
        }
    }

    const filtered = categoryFilter === 'ALL'
        ? serviceTypes
        : serviceTypes.filter(t => t.category === categoryFilter);

    // Build filter pills from categories that are actually used
    const usedLabels = Array.from(new Set(serviceTypes.map(t => t.category)));
    const filterPills = ['ALL', ...categories.map(c => c.label).filter(l => usedLabels.includes(l))];

    return (
        <div className="p-6 space-y-5">
            {toast && (
                <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-lg ${
                    toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                }`}>
                    {toast.message}
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Service Types</h1>
                    <p className="text-sm text-gray-500 mt-0.5">Configure the service catalog for this outlet.</p>
                </div>
                <Link
                    href="/admin/services"
                    className="flex items-center gap-2 bg-brand-dark text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-brand-dark/90 transition-all"
                >
                    <ExternalLink className="w-4 h-4" />
                    Manage in Services Catalog
                </Link>
            </div>

            {/* Info banner */}
            <div className="px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700 font-medium">
                Showing service types from the shared catalog with <strong>Service Records</strong> config enabled. To add or edit service types, use the{' '}
                <Link href="/admin/services" className="underline underline-offset-2 hover:text-blue-900">
                    Services Catalog
                </Link>.
            </div>

            {/* Category filter */}
            <div className="flex flex-wrap gap-2">
                {filterPills.map(cat => (
                    <button
                        key={cat}
                        onClick={() => setCategoryFilter(cat)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                            categoryFilter === cat ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-sm text-gray-400">Loading…</div>
                ) : filtered.length === 0 ? (
                    <div className="p-12 text-center">
                        <Wrench className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                        <p className="text-sm font-medium text-gray-500">No service types yet</p>
                        <p className="text-xs text-gray-400 mt-1">Add service types in the Services Catalog with Service Records config enabled.</p>
                        <Link
                            href="/admin/services"
                            className="mt-4 inline-flex items-center gap-1.5 text-sm text-brand-dark font-medium hover:underline"
                        >
                            <ExternalLink className="w-3.5 h-3.5" /> Go to Services Catalog
                        </Link>
                    </div>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Name</th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Category</th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Warranty</th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Default Price</th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                                <th className="px-4 py-3" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filtered.map(type => (
                                <tr key={type.id} className={`hover:bg-gray-50 transition-colors ${!type.isActive ? 'opacity-50' : ''}`}>
                                    <td className="px-4 py-3 font-medium text-gray-900">{type.name}</td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getCatColor(categories, type.category)}`}>
                                            {type.category}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-gray-600">
                                        {type.hasWarranty ? (
                                            <span className="text-green-600 font-medium">{type.defaultWarrantyMonths ?? '—'} mo</span>
                                        ) : (
                                            <span className="text-gray-400">None</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-gray-600">
                                        {type.defaultPrice != null ? `Rp ${type.defaultPrice.toLocaleString()}` : '—'}
                                    </td>
                                    <td className="px-4 py-3">
                                        <button
                                            onClick={() => handleToggle(type)}
                                            className={`text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${
                                                type.isActive
                                                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                            }`}
                                            title={type.isActive ? 'Click to deactivate' : 'Click to activate'}
                                        >
                                            {type.isActive ? 'Active' : 'Inactive'}
                                        </button>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <Link
                                            href="/admin/services"
                                            className="text-xs text-gray-400 hover:text-brand-dark transition-colors"
                                            title="Edit in Services Catalog"
                                        >
                                            <ExternalLink className="w-3.5 h-3.5 inline" />
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
