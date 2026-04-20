import { Service, PricingDisplay } from '../../types';
import { Search, Clock } from 'lucide-react';
import { useState } from 'react';
import { ThemeConfig } from '@/lib/templates/types';

const formatPrice = (amount: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount);

interface ServiceStepProps {
    services: Service[];
    onSelect: (service: Service) => void;
    theme: ThemeConfig;
    pricingDisplay?: PricingDisplay;
}

export default function ServiceStep({ services, onSelect, theme, pricingDisplay = 'fixed' }: ServiceStepProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

    const isGlass = theme.decorations?.surfaceStyle === 'glass' || theme.cardStyle === 'glass';
    const surfaceBg = theme.colors.surfaceElevated || theme.colors.surface || '#ffffff';
    const borderColor = isGlass ? 'rgba(255,255,255,0.1)' : (theme.colors.border || '#e5e7eb');
    const mutedText = theme.colors.textMuted || theme.colors.foreground;
    const subtleText = theme.colors.textSubtle || theme.colors.muted || theme.colors.foreground;

    const categories = Array.from(new Set(services.map(s => s.category).filter(Boolean))) as string[];

    const filteredServices = services.filter(service => {
        const matchesSearch = service.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = selectedCategory ? service.category === selectedCategory : true;
        return matchesSearch && matchesCategory;
    });

    return (
        <div className="space-y-4">
            {/* Sticky Header */}
            <div
                className="sticky top-0 z-10 pb-2 border-b -mx-4 px-4 sm:-mx-6 sm:px-6 pt-2"
                style={{ backgroundColor: surfaceBg, borderColor }}
            >
                <div className="space-y-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={18}
                            style={{ color: subtleText }} />
                        <input
                            type="text"
                            placeholder="Search services..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 rounded-xl border focus:outline-none"
                            style={{
                                backgroundColor: surfaceBg,
                                borderColor,
                                color: theme.colors.foreground,
                            }}
                        />
                    </div>

                    {categories.length > 0 && (
                        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-6 px-6">
                            <button
                                onClick={() => setSelectedCategory(null)}
                                className="whitespace-nowrap px-4 py-2 rounded-full text-xs font-bold transition-all"
                                style={!selectedCategory
                                    ? { backgroundColor: theme.colors.primary, color: theme.colors.accentForeground || '#ffffff' }
                                    : { backgroundColor: surfaceBg, color: mutedText }
                                }
                            >
                                All
                            </button>
                            {categories.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setSelectedCategory(cat)}
                                    className="whitespace-nowrap px-4 py-2 rounded-full text-xs font-bold transition-all"
                                    style={selectedCategory === cat
                                        ? { backgroundColor: theme.colors.primary, color: theme.colors.accentForeground || '#ffffff' }
                                        : { backgroundColor: surfaceBg, color: mutedText }
                                    }
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
                    <div className="text-center py-12 border border-dashed"
                        style={{ backgroundColor: surfaceBg, borderColor, color: subtleText, borderRadius: 'var(--theme-radius)' }}>
                        <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
                            style={{ backgroundColor: surfaceBg, color: subtleText }}>
                            <Search size={24} />
                        </div>
                        <p className="font-bold" style={{ color: mutedText }}>No services found</p>
                        <p className="text-xs mt-1">Try adjusting your search</p>
                        {(searchQuery || selectedCategory) && (
                            <button
                                onClick={() => { setSearchQuery(''); setSelectedCategory(null); }}
                                className="mt-4 text-xs font-bold hover:underline"
                                style={{ color: theme.colors.primary }}
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
                            className="w-full text-left p-4 border transition-all group hover:shadow-md"
                            style={{ backgroundColor: surfaceBg, borderColor, color: theme.colors.foreground, borderRadius: 'calc(var(--theme-radius) * 0.75)' }}
                        >
                            <div className="flex justify-between items-start gap-4 mb-1">
                                <h3 className="font-bold transition-colors" style={{ color: theme.colors.foreground }}>
                                    {service.name}
                                </h3>
                                {pricingDisplay !== 'hidden' && (
                                    <span className="font-bold text-right" style={{ color: theme.colors.foreground }}>
                                        {pricingDisplay === 'starting_from' && (
                                            <span className="block text-[10px] font-medium" style={{ color: subtleText }}>Mulai dari</span>
                                        )}
                                        {pricingDisplay === 'range' && service.maxPrice
                                            ? `${formatPrice(service.price)} – ${formatPrice(service.maxPrice)}`
                                            : formatPrice(service.price)
                                        }
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2 text-xs" style={{ color: subtleText }}>
                                {service.bookingType !== 'request' && service.durationMinutes && (
                                    <><Clock size={12} /> {service.durationMinutes} mins</>
                                )}
                                {service.category && (
                                    <span className="px-1.5 py-0.5 rounded"
                                        style={{ backgroundColor: `${theme.colors.primary}15`, color: mutedText }}>
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
