'use client';

import { useState, useEffect } from 'react';
import { Service } from '@/lib/modules/reservation/types';
import { getServices } from '@/lib/modules/reservation/api';
import { Search, Clock, LayoutGrid, List as ListIcon, ExternalLink } from 'lucide-react';
import { useSite } from '@/lib/site-context';
import Link from 'next/link';

import { ReservationBreadcrumb } from '../components/ReservationBreadcrumb';

interface ServicesClientProps {
    initialServices: Service[];
}

export default function ServicesClient({ initialServices = [] }: ServicesClientProps) {
    const { siteId } = useSite();
    const [services, setServices] = useState<Service[]>(initialServices);
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('All');

    useEffect(() => {
        if (!siteId || initialServices.length > 0) return;
        getServices(siteId)
            .then(setServices)
            .catch(e => console.error('Failed to fetch services:', e));
    }, [siteId]);

    const usedCategories = Array.from(new Set(services.map(s => s.category).filter((c): c is string => !!c)));
    const categories = ['All', ...usedCategories];

    const filteredServices = services.filter(s => {
        const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.category?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = selectedCategory === 'All' || s.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    return (
        <div>
            <ReservationBreadcrumb currentPage="Services" />
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-neutral-100 mb-2">Services</h1>
                    <p className="text-gray-600 dark:text-neutral-400 font-medium">Bookable services from the shared catalog</p>
                </div>
                <Link
                    href="/admin/services"
                    className="bg-studio-blue text-white px-6 py-2.5 rounded-xl font-bold hover:bg-studio-blue/85 flex items-center gap-2 shadow-lg hover:shadow-xl transition-all active:scale-95"
                >
                    <ExternalLink size={18} /> Manage in Services Catalog
                </Link>
            </div>

            {/* Info banner */}
            <div className="mb-5 px-4 py-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-xl text-sm text-blue-700 dark:text-blue-300 font-medium">
                Showing services marked as <strong>bookable</strong> from the shared catalog. To add, edit, or remove services, use the{' '}
                <Link href="/admin/services" className="underline underline-offset-2 hover:text-blue-900">
                    Services Catalog
                </Link>.
            </div>

            {/* Services container */}
            <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-gray-200 dark:border-neutral-800 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
                {/* Header Controls */}
                <div className="p-4 border-b border-gray-100 dark:border-neutral-800 flex flex-col md:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-neutral-600" size={18} />
                        <input
                            type="text"
                            placeholder="Search services..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-dark/10 focus:border-brand-dark transition-all text-sm font-medium dark:text-neutral-200"
                        />
                    </div>
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

                {/* Category Pills */}
                <div className="px-4 pb-4 border-b border-gray-100 dark:border-neutral-800 overflow-x-auto no-scrollbar">
                    <div className="flex items-center gap-2">
                        {categories.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                className={`px-4 py-1.5 rounded-full text-sm font-bold whitespace-nowrap transition-all ${selectedCategory === cat
                                    ? 'bg-studio-blue text-white shadow-md shadow-brand-dark/20'
                                    : 'bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-neutral-500 hover:bg-gray-200 dark:hover:bg-neutral-700'
                                }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className={`flex-1 overflow-auto ${viewMode === 'grid' ? 'p-6 bg-gray-50/30 dark:bg-neutral-800/20' : ''}`}>
                    {filteredServices.length === 0 ? (
                        <div className="flex flex-col items-center justify-center text-center h-full p-12">
                            <h3 className="text-xl font-bold text-gray-800 dark:text-neutral-200 mb-2">No bookable services</h3>
                            <p className="text-gray-500 dark:text-neutral-500 max-w-md mx-auto mb-4">
                                Add services in the catalog and enable the &quot;Bookable via Reservation&quot; option.
                            </p>
                            <Link
                                href="/admin/services"
                                className="inline-flex items-center gap-2 bg-studio-blue text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-studio-blue/85 transition-all"
                            >
                                <ExternalLink size={16} /> Go to Services Catalog
                            </Link>
                        </div>
                    ) : viewMode === 'list' ? (
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 dark:bg-neutral-800/50 text-gray-500 dark:text-neutral-500 font-bold text-xs uppercase tracking-wider sticky top-0 z-10">
                                <tr>
                                    <th className="py-4 px-6 border-b border-gray-100 dark:border-neutral-800">Service Name</th>
                                    <th className="py-4 px-6 border-b border-gray-100 dark:border-neutral-800">Category</th>
                                    <th className="py-4 px-6 border-b border-gray-100 dark:border-neutral-800">Price</th>
                                    <th className="py-4 px-6 border-b border-gray-100 dark:border-neutral-800">Duration</th>
                                    <th className="py-4 px-6 border-b border-gray-100 dark:border-neutral-800">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                                {filteredServices.map(service => (
                                    <tr key={service.id} className="hover:bg-gray-50/80 dark:hover:bg-neutral-800/50 transition-colors">
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
                                            <span className="font-bold text-gray-900 dark:text-neutral-100">
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
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredServices.map(service => (
                                <div key={service.id} className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-200 dark:border-neutral-800 p-5 shadow-sm hover:shadow-md transition-all hover:border-brand-dark/20">
                                    <div className="mb-3">
                                        <h3 className="text-lg font-semibold text-gray-900 dark:text-neutral-100 leading-tight">{service.name}</h3>
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-neutral-500 bg-gray-100 dark:bg-neutral-800 px-2 py-0.5 rounded-md inline-block mt-2">
                                            {service.category || 'No Category'}
                                        </span>
                                    </div>
                                    <p className="text-gray-500 dark:text-neutral-500 text-sm mb-4 line-clamp-2 h-10 font-medium">{service.description}</p>
                                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100 dark:border-neutral-800">
                                        <div className="font-bold text-gray-900 dark:text-neutral-100 text-lg">
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
        </div>
    );
}
