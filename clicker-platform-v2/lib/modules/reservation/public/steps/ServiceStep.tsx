import { Service } from '../../types';
import { Search, Clock } from 'lucide-react';
import { useState } from 'react';

interface ServiceStepProps {
    services: Service[];
    onSelect: (service: Service) => void;
}

export default function ServiceStep({ services, onSelect }: ServiceStepProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

    const categories = Array.from(new Set(services.map(s => s.category).filter(Boolean))) as string[];

    const filteredServices = services.filter(service => {
        const matchesSearch = service.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = selectedCategory ? service.category === selectedCategory : true;
        return matchesSearch && matchesCategory;
    });

    return (
        <div className="space-y-4">
            {/* Sticky Header */}
            <div className="sticky top-0 z-10 bg-white pb-2 border-b border-gray-100 -mx-6 px-6 pt-2">
                <div className="space-y-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search services..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-brand-dark bg-gray-50/50"
                        />
                    </div>

                    {categories.length > 0 && (
                        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-6 px-6">
                            <button
                                onClick={() => setSelectedCategory(null)}
                                className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-bold transition-all ${!selectedCategory
                                    ? 'bg-brand-dark text-white shadow-md'
                                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                    }`}
                            >
                                All
                            </button>
                            {categories.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setSelectedCategory(cat)}
                                    className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-bold transition-all ${selectedCategory === cat
                                        ? 'bg-brand-dark text-white shadow-md'
                                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                        }`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* List */}
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-3 -mr-3 pb-8">
                {filteredServices.length === 0 ? (
                    <div className="text-center py-12 text-gray-400 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-3 text-gray-300">
                            <Search size={24} />
                        </div>
                        <p className="font-bold text-gray-500">No services found</p>
                        <p className="text-xs mt-1">Try adjusting your search</p>
                        {(searchQuery || selectedCategory) && (
                            <button
                                onClick={() => { setSearchQuery(''); setSelectedCategory(null); }}
                                className="mt-4 text-xs font-bold text-brand-blue hover:underline"
                            >
                                Clear Filters
                            </button>
                        )}
                    </div>
                ) : (
                    filteredServices.map(service => (
                        <button
                            key={service.id}
                            onClick={() => onSelect(service)}
                            className="w-full text-left p-4 rounded-xl border border-gray-100 hover:border-brand-dark hover:shadow-md transition-all group bg-white"
                        >
                            <div className="flex justify-between items-start mb-1">
                                <h3 className="font-bold text-brand-dark group-hover:text-brand-blue transition-colors">
                                    {service.name}
                                </h3>
                                <span className="font-bold text-brand-dark">
                                    {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(service.price)}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                <Clock size={12} /> {service.durationMinutes} mins
                                {service.category && <span className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{service.category}</span>}
                            </div>
                        </button>
                    ))
                )}
            </div>
        </div>
    );
}
