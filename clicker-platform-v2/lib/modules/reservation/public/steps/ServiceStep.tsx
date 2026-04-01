import { Service, PricingDisplay } from '../../types';
import { Search, Clock } from 'lucide-react';
import { useState } from 'react';

const formatPrice = (amount: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount);

interface ServiceStepProps {
    services: Service[];
    onSelect: (service: Service) => void;
    isGlass?: boolean;
    pricingDisplay?: PricingDisplay;
}

export default function ServiceStep({ services, onSelect, isGlass = false, pricingDisplay = 'fixed' }: ServiceStepProps) {
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
            <div className={`sticky top-0 z-10 pb-2 border-b -mx-6 px-6 pt-2 ${
                isGlass ? 'bg-black/40 backdrop-blur-md border-white/10' : 'bg-white border-gray-100'
            }`}>
                <div className="space-y-3">
                    <div className="relative">
                        <Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${isGlass ? 'text-white/40' : 'text-gray-400'}`} size={18} />
                        <input
                            type="text"
                            placeholder="Search services..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className={`w-full pl-10 pr-4 py-3 rounded-xl border focus:outline-none ${
                                isGlass
                                    ? 'bg-white/5 border-white/10 text-white placeholder-white/40 focus:border-white/30'
                                    : 'bg-gray-50/50 border-gray-200 focus:border-brand-dark'
                            }`}
                        />
                    </div>

                    {categories.length > 0 && (
                        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-6 px-6">
                            <button
                                onClick={() => setSelectedCategory(null)}
                                className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-bold transition-all ${!selectedCategory
                                    ? isGlass ? 'bg-[var(--theme-primary)] text-black shadow-md' : 'bg-brand-dark text-white shadow-md'
                                    : isGlass ? 'bg-white/10 text-white/60 hover:bg-white/20' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                }`}
                            >
                                All
                            </button>
                            {categories.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setSelectedCategory(cat)}
                                    className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-bold transition-all ${selectedCategory === cat
                                        ? isGlass ? 'bg-[var(--theme-primary)] text-black shadow-md' : 'bg-brand-dark text-white shadow-md'
                                        : isGlass ? 'bg-white/10 text-white/60 hover:bg-white/20' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
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
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-3 -mr-3 pb-4">
                {filteredServices.length === 0 ? (
                    <div className={`text-center py-12 rounded-2xl border border-dashed ${
                        isGlass ? 'bg-white/5 border-white/10 text-white/40' : 'bg-gray-50 border-gray-200 text-gray-400'
                    }`}>
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 ${
                            isGlass ? 'bg-white/10 text-white/30' : 'bg-white text-gray-300'
                        }`}>
                            <Search size={24} />
                        </div>
                        <p className={`font-bold ${isGlass ? 'text-white/50' : 'text-gray-500'}`}>No services found</p>
                        <p className="text-xs mt-1">Try adjusting your search</p>
                        {(searchQuery || selectedCategory) && (
                            <button
                                onClick={() => { setSearchQuery(''); setSelectedCategory(null); }}
                                className={`mt-4 text-xs font-bold hover:underline ${isGlass ? 'text-[var(--theme-primary)]' : 'text-brand-blue'}`}
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
                            className={`w-full text-left p-4 rounded-xl border transition-all group ${
                                isGlass
                                    ? 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                                    : 'bg-white border-gray-200 hover:border-gray-900 hover:shadow-md'
                            }`}
                        >
                            <div className="flex justify-between items-start gap-4 mb-1">
                                <h3 className={`font-bold transition-colors ${
                                    isGlass ? 'text-white group-hover:text-[var(--theme-primary)]' : 'text-gray-900 group-hover:text-blue-600'
                                }`}>
                                    {service.name}
                                </h3>
                                {pricingDisplay !== 'hidden' && (
                                    <span className={`font-bold text-right ${isGlass ? 'text-white' : 'text-gray-900'}`}>
                                        {pricingDisplay === 'starting_from' && (
                                            <span className={`block text-[10px] font-medium ${isGlass ? 'text-white/50' : 'text-gray-400'}`}>Mulai dari</span>
                                        )}
                                        {pricingDisplay === 'range' && service.maxPrice
                                            ? `${formatPrice(service.price)} – ${formatPrice(service.maxPrice)}`
                                            : formatPrice(service.price)
                                        }
                                    </span>
                                )}
                            </div>
                            <div className={`flex items-center gap-2 text-xs ${isGlass ? 'text-white/50' : 'text-gray-500'}`}>
                                {service.bookingType !== 'request' && service.durationMinutes && (
                                    <><Clock size={12} /> {service.durationMinutes} mins</>
                                )}
                                {service.category && (
                                    <span className={`px-1.5 py-0.5 rounded ${isGlass ? 'bg-white/10 text-white/60' : 'bg-gray-100 text-gray-600'}`}>
                                        {service.category}
                                    </span>
                                )}
                            </div>
                        </button>
                    ))
                )}
            </div>
        </div>
    );
}
