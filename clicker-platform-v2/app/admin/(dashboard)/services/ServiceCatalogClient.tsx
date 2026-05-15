'use client';

import { useState, useEffect, useRef } from 'react';
import { Plus, Edit2, Trash2, Search, X, Clock, ShieldCheck, Settings2, Check, ChevronDown } from 'lucide-react';
import { useSite } from '@/lib/site-context';
import { useUser } from '@/lib/user-context';
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog';
import { useIsMobile } from '@/hooks/useIsMobile';
import { MobileBottomSheet } from '@/components/admin/blocks/MobileBottomSheet';
import {
    getServiceCatalog,
    createServiceCatalogItem,
    updateServiceCatalogItem,
    deleteServiceCatalogItem,
    getServiceCategories,
    saveServiceCategories,
} from '@/lib/core/serviceCatalog/api';
import type { ServiceCatalogItem, ServiceCategoryConfig } from '@/lib/core/serviceCatalog/types';
import { DEFAULT_SERVICE_CATEGORIES } from '@/lib/core/serviceCatalog/types';
import { getReservationSettings } from '@/lib/modules/reservation/api';
import { logger } from '@/lib/logger-edge';
import type { PricingDisplay } from '@/lib/modules/reservation/types';

// ─── Color presets for category manager ────────────────────────────────────────
const COLOR_PRESETS: { label: string; value: string }[] = [
    { label: 'Blue',   value: 'bg-blue-100 text-blue-700' },
    { label: 'Purple', value: 'bg-purple-100 text-purple-700' },
    { label: 'Amber',  value: 'bg-amber-100 text-amber-700' },
    { label: 'Cyan',   value: 'bg-cyan-100 text-cyan-700' },
    { label: 'Green',  value: 'bg-green-100 text-green-700' },
    { label: 'Red',    value: 'bg-red-100 text-red-700' },
    { label: 'Pink',   value: 'bg-pink-100 text-pink-700' },
    { label: 'Gray',   value: 'bg-gray-100 text-gray-600' },
];

function getCategoryColor(categories: ServiceCategoryConfig[], label: string): string {
    return categories.find(c => c.label === label)?.color ?? 'bg-gray-100 text-gray-600';
}

// ─── Form state ─────────────────────────────────────────────────────────────────

interface FormData {
    name: string;
    description: string;
    price: number;
    maxPrice: number | '';
    durationMinutes: number;
    bookingType: 'time_slot' | 'request';
    category: string;
    isActive: boolean;
    bookable: boolean;
    hasServiceRecord: boolean;
    hasWarranty: boolean;
    defaultWarrantyMonths: number;
    defaultPrice: number | '';
}

const DEFAULT_FORM: FormData = {
    name: '',
    description: '',
    price: 0,
    maxPrice: '',
    durationMinutes: 60,
    bookingType: 'time_slot',
    category: 'OTHER',
    isActive: true,
    bookable: false,
    hasServiceRecord: false,
    hasWarranty: false,
    defaultWarrantyMonths: 12,
    defaultPrice: '',
};

function itemToForm(item: ServiceCatalogItem): FormData {
    const src = item.serviceRecordsConfig;
    return {
        name: item.name,
        description: item.description ?? '',
        price: item.price,
        maxPrice: item.reservationConfig?.maxPrice ?? '',
        durationMinutes: item.durationMinutes ?? 60,
        bookingType: item.reservationConfig?.bookingType ?? 'time_slot',
        category: item.category,
        isActive: item.isActive,
        bookable: !!item.reservationConfig,
        hasServiceRecord: !!src,
        hasWarranty: src?.hasWarranty ?? false,
        defaultWarrantyMonths: src?.defaultWarrantyMonths ?? 12,
        defaultPrice: src?.defaultPrice ?? '',
    };
}

// ─── Category Picker ─────────────────────────────────────────────────────────────

function CategoryPicker({
    value,
    onChange,
    categories,
    onRequestManage,
}: {
    value: string;
    onChange: (v: string) => void;
    categories: ServiceCategoryConfig[];
    onRequestManage: () => void;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const selected = categories.find(c => c.label === value);
    const colorClass = selected?.color ?? 'bg-gray-100 text-gray-600';

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className="w-full flex items-center justify-between px-4 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 focus:outline-none focus:border-brand-dark text-sm dark:text-neutral-200"
            >
                <span className={`px-2 py-0.5 rounded-md text-xs font-bold uppercase tracking-wide ${colorClass}`}>
                    {value || 'Select category'}
                </span>
                <ChevronDown size={16} className="text-gray-400" />
            </button>
            {open && (
                <div className="absolute z-50 mt-1 w-full bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg shadow-lg overflow-hidden">
                    {categories.map(cat => (
                        <button
                            key={cat.id}
                            type="button"
                            onClick={() => { onChange(cat.label); setOpen(false); }}
                            className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-neutral-700 transition-colors text-left"
                        >
                            <span className={`px-2 py-0.5 rounded-md text-xs font-bold uppercase tracking-wide ${cat.color}`}>
                                {cat.label}
                            </span>
                            {value === cat.label && <Check size={14} className="text-brand-dark" />}
                        </button>
                    ))}
                    <div className="border-t border-gray-100 dark:border-neutral-700">
                        <button
                            type="button"
                            onClick={() => { setOpen(false); onRequestManage(); }}
                            className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-brand-dark hover:bg-gray-50 dark:hover:bg-neutral-700 transition-colors"
                        >
                            <Settings2 size={13} /> Manage categories…
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Category Manager Modal ───────────────────────────────────────────────────────

function CategoryManagerModal({
    categories,
    onSave,
    onClose,
}: {
    categories: ServiceCategoryConfig[];
    onSave: (cats: ServiceCategoryConfig[]) => Promise<void>;
    onClose: () => void;
}) {
    const isMobile = useIsMobile();
    const [cats, setCats] = useState<ServiceCategoryConfig[]>(categories);
    const [newLabel, setNewLabel] = useState('');
    const [newColor, setNewColor] = useState(COLOR_PRESETS[0].value);
    const [saving, setSaving] = useState(false);

    const addCategory = () => {
        const label = newLabel.trim().toUpperCase();
        if (!label || cats.some(c => c.label === label)) return;
        const id = label.toLowerCase().replace(/[^a-z0-9]/g, '_');
        setCats(prev => [...prev, { id, label, color: newColor }]);
        setNewLabel('');
        setNewColor(COLOR_PRESETS[0].value);
    };

    const removeCategory = (id: string) => {
        setCats(prev => prev.filter(c => c.id !== id));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await onSave(cats);
            onClose();
        } finally {
            setSaving(false);
        }
    };

    const content = (
        <div className="flex flex-col flex-1 overflow-hidden">
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
                {/* Existing categories */}
                <div className="space-y-2">
                    {cats.map(cat => (
                        <div key={cat.id} className="flex items-center justify-between gap-3 px-3 py-2.5 bg-gray-50 dark:bg-neutral-800 rounded-lg">
                            <span className={`px-2.5 py-0.5 rounded-md text-xs font-bold uppercase tracking-wide ${cat.color}`}>
                                {cat.label}
                            </span>
                            <button
                                onClick={() => removeCategory(cat.id)}
                                className="p-1 hover:bg-red-50 dark:hover:bg-red-950/30 text-gray-400 hover:text-red-500 rounded-lg transition-colors"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    ))}
                </div>

                {/* Add new */}
                <div className="border-t border-gray-100 dark:border-neutral-800 pt-4 space-y-3">
                    <p className="text-xs font-bold text-gray-500 dark:text-neutral-500 uppercase tracking-wide">Add category</p>
                    <input
                        type="text"
                        placeholder="e.g. TINTING"
                        value={newLabel}
                        onChange={e => setNewLabel(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCategory())}
                        className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 focus:outline-none focus:border-brand-dark dark:bg-neutral-800 dark:text-neutral-200 text-sm"
                    />
                    <div className="flex flex-wrap gap-2">
                        {COLOR_PRESETS.map(preset => (
                            <button
                                key={preset.value}
                                type="button"
                                onClick={() => setNewColor(preset.value)}
                                className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${preset.value} ${newColor === preset.value ? 'ring-2 ring-offset-1 ring-brand-dark' : ''}`}
                            >
                                {preset.label}
                            </button>
                        ))}
                    </div>
                    <button
                        type="button"
                        onClick={addCategory}
                        disabled={!newLabel.trim()}
                        className="w-full py-2 rounded-lg border-2 border-dashed border-gray-300 dark:border-neutral-700 text-sm font-bold text-gray-500 dark:text-neutral-500 hover:border-brand-dark hover:text-brand-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        + Add Category
                    </button>
                </div>
            </div>

            <div className="p-5 border-t border-gray-100 dark:border-neutral-800 flex gap-3 flex-shrink-0">
                <button
                    onClick={onClose}
                    className="flex-1 py-2.5 rounded-lg font-bold text-gray-600 dark:text-neutral-400 bg-gray-100 dark:bg-neutral-800 hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors"
                >
                    Cancel
                </button>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 py-2.5 rounded-lg font-bold text-white bg-studio-blue hover:bg-studio-blue/85 transition-colors disabled:opacity-50"
                >
                    {saving ? 'Saving…' : 'Save Categories'}
                </button>
            </div>
        </div>
    );

    if (isMobile) {
        return (
            <MobileBottomSheet
                isOpen={true}
                onClose={onClose}
                title="Manage Categories"
                height="80vh"
            >
                {content}
            </MobileBottomSheet>
        );
    }

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-neutral-900 rounded-lg w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
                <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-neutral-800 flex-shrink-0">
                    <h2 className="text-lg font-bold text-brand-dark">Manage Categories</h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-full transition-colors">
                        <X size={18} />
                    </button>
                </div>
                {content}
            </div>
        </div>
    );
}

// ─── Shared service form (used by both desktop modal and mobile sheet) ───────────

interface ServiceFormProps {
    form: FormData;
    set: (field: Partial<FormData>) => void;
    categories: ServiceCategoryConfig[];
    pricingDisplay: PricingDisplay;
    isSubmitting: boolean;
    editing: ServiceCatalogItem | null;
    onCancel: () => void;
    onSubmit: (e: React.FormEvent) => void;
    onRequestManageCategories: () => void;
    padding?: string;
}

function ServiceForm({ form, set, categories, pricingDisplay, isSubmitting, editing, onCancel, onSubmit, onRequestManageCategories, padding = 'p-6' }: ServiceFormProps) {
    return (
        <form onSubmit={onSubmit} className="flex flex-col flex-1 overflow-hidden">
            {/* Scrollable fields */}
            <div className={`${padding} space-y-5 overflow-y-auto flex-1`}>
            {/* Name */}
            <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-neutral-300 mb-1">Service Name <span className="text-red-500">*</span></label>
                <input
                    required
                    type="text"
                    value={form.name}
                    onChange={e => set({ name: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 focus:outline-none focus:border-brand-dark dark:bg-neutral-800 dark:text-neutral-200"
                />
            </div>

            {/* Description */}
            <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-neutral-300 mb-1">Description</label>
                <textarea
                    value={form.description}
                    onChange={e => set({ description: e.target.value })}
                    rows={2}
                    placeholder="Displayed on the public booking form"
                    className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 focus:outline-none focus:border-brand-dark dark:bg-neutral-800 dark:text-neutral-200"
                />
            </div>

            {/* Price + Category */}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-neutral-300 mb-1">
                        {form.bookable && pricingDisplay === 'range' ? 'Min Price (IDR)' :
                         form.bookable && pricingDisplay === 'starting_from' ? 'Starting Price (IDR)' :
                         'Price (IDR)'} <span className="text-red-500">*</span>
                    </label>
                    <input
                        required
                        type="number"
                        min="0"
                        value={form.price}
                        onChange={e => set({ price: Number(e.target.value) })}
                        className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 focus:outline-none focus:border-brand-dark dark:bg-neutral-800 dark:text-neutral-200"
                    />
                    {form.bookable && pricingDisplay === 'starting_from' && (
                        <p className="text-xs text-indigo-600 dark:text-indigo-500 mt-1">Shown as &quot;Mulai dari&quot; on the booking page.</p>
                    )}
                </div>
                <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-neutral-300 mb-1">Category</label>
                    <CategoryPicker
                        value={form.category}
                        onChange={v => set({ category: v })}
                        categories={categories}
                        onRequestManage={onRequestManageCategories}
                    />
                </div>
            </div>

            {/* Active */}
            <div className="flex items-center gap-2">
                <input
                    type="checkbox"
                    id="isActive"
                    checked={form.isActive}
                    onChange={e => set({ isActive: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 dark:border-neutral-700 text-brand-dark focus:ring-brand-dark"
                />
                <label htmlFor="isActive" className="text-sm font-medium text-gray-700 dark:text-neutral-300">Active</label>
            </div>

            {/* Reservation config */}
            <div className="border border-indigo-200 dark:border-indigo-900 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        id="bookable"
                        checked={form.bookable}
                        onChange={e => set({ bookable: e.target.checked })}
                        className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <label htmlFor="bookable" className="text-sm font-bold text-indigo-700 dark:text-indigo-400">Bookable via Reservation</label>
                </div>
                {form.bookable && (
                    <div className="space-y-3 pt-1">
                        <div>
                            <p className="text-xs font-bold text-gray-500 dark:text-neutral-500 uppercase tracking-wide mb-2">Booking Type</p>
                            <div className="grid grid-cols-2 gap-2">
                                {(['time_slot', 'request'] as const).map(bt => (
                                    <button
                                        key={bt}
                                        type="button"
                                        onClick={() => set({ bookingType: bt })}
                                        className={`flex flex-col items-start px-3 py-2.5 rounded-lg border text-left transition-all ${form.bookingType === bt
                                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30'
                                            : 'border-gray-200 dark:border-neutral-700 hover:border-indigo-300'
                                        }`}
                                    >
                                        <span className={`text-sm font-bold ${form.bookingType === bt ? 'text-indigo-700 dark:text-indigo-400' : 'text-gray-700 dark:text-neutral-300'}`}>
                                            {bt === 'time_slot' ? 'Time Slot' : 'On Request'}
                                        </span>
                                        <span className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">
                                            {bt === 'time_slot' ? 'Customer picks a time' : 'You confirm timing'}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                        {pricingDisplay === 'range' && (
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-neutral-300 mb-1">Max Price (IDR)</label>
                                <input
                                    type="number"
                                    min="0"
                                    placeholder={`e.g. ${form.price * 3 || 500000}`}
                                    value={form.maxPrice}
                                    onChange={e => set({ maxPrice: e.target.value === '' ? '' : Number(e.target.value) })}
                                    className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 focus:outline-none focus:border-brand-dark dark:bg-neutral-800 dark:text-neutral-200"
                                />
                                <p className="text-xs text-indigo-600 dark:text-indigo-500 mt-1">Upper bound shown on booking page, e.g. Rp {form.price.toLocaleString('id-ID')} – Rp {(Number(form.maxPrice) || form.price * 3 || 500000).toLocaleString('id-ID')}</p>
                            </div>
                        )}
                        {form.bookingType === 'time_slot' && (
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-neutral-300 mb-1">Duration (min) <span className="text-red-500">*</span></label>
                                <input
                                    required
                                    type="number"
                                    min="5"
                                    step="5"
                                    value={form.durationMinutes}
                                    onChange={e => set({ durationMinutes: Number(e.target.value) })}
                                    className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 focus:outline-none focus:border-brand-dark dark:bg-neutral-800 dark:text-neutral-200"
                                />
                                <p className="text-xs text-indigo-600 dark:text-indigo-500 mt-1.5">Controls booking slot length in the public booking form.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Service Records config */}
            <div className="border border-green-200 dark:border-green-900 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        id="hasServiceRecord"
                        checked={form.hasServiceRecord}
                        onChange={e => set({ hasServiceRecord: e.target.checked })}
                        className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                    />
                    <label htmlFor="hasServiceRecord" className="text-sm font-bold text-green-700 dark:text-green-400">Used in Service Records</label>
                </div>
                {form.hasServiceRecord && (
                    <div className="space-y-3 pt-1">
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="hasWarranty"
                                checked={form.hasWarranty}
                                onChange={e => set({ hasWarranty: e.target.checked })}
                                className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                            />
                            <label htmlFor="hasWarranty" className="text-sm font-medium text-gray-700 dark:text-neutral-300 flex items-center gap-1.5">
                                <ShieldCheck size={14} className="text-green-600" /> Issues warranty card on completion
                            </label>
                        </div>
                        {form.hasWarranty && (
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-neutral-300 mb-1">Default Warranty (months)</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={form.defaultWarrantyMonths}
                                    onChange={e => set({ defaultWarrantyMonths: Number(e.target.value) })}
                                    className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 focus:outline-none focus:border-brand-dark dark:bg-neutral-800 dark:text-neutral-200"
                                />
                            </div>
                        )}
                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-neutral-300 mb-1">Walk-in Price Override (optional)</label>
                            <input
                                type="number"
                                min="0"
                                placeholder={`Default: ${form.price}`}
                                value={form.defaultPrice}
                                onChange={e => set({ defaultPrice: e.target.value === '' ? '' : Number(e.target.value) })}
                                className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 focus:outline-none focus:border-brand-dark dark:bg-neutral-800 dark:text-neutral-200"
                            />
                        </div>
                    </div>
                )}
            </div>

            </div>{/* end scrollable fields */}

            {/* Sticky footer CTA */}
            <div className="flex gap-3 p-4 border-t border-gray-100 dark:border-neutral-800 flex-shrink-0">
                <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={onCancel}
                    className="flex-1 py-3 px-4 rounded-lg font-bold text-gray-600 dark:text-neutral-400 bg-gray-100 dark:bg-neutral-800 hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors cursor-pointer active:scale-95 disabled:opacity-50"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-3 px-4 rounded-lg font-bold text-white bg-studio-blue hover:bg-studio-blue/85 transition-colors cursor-pointer active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    {isSubmitting ? 'Saving...' : editing ? 'Save Changes' : 'Add Service'}
                </button>
            </div>
        </form>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────────

interface Props {
    initialItems: ServiceCatalogItem[];
}

export default function ServiceCatalogClient({ initialItems = [] }: Props) {
    const { siteId } = useSite();
    const { isOwner } = useUser();
    const isMobile = useIsMobile();
    const [items, setItems] = useState<ServiceCatalogItem[]>(initialItems);
    const [categories, setCategories] = useState<ServiceCategoryConfig[]>(DEFAULT_SERVICE_CATEGORIES);
    const [search, setSearch] = useState('');
    const [filterCat, setFilterCat] = useState<string>('ALL');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
    const [editing, setEditing] = useState<ServiceCatalogItem | null>(null);
    const [form, setForm] = useState<FormData>(DEFAULT_FORM);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);
    const [pricingDisplay, setPricingDisplay] = useState<PricingDisplay>('fixed');

    // Load categories and reservation settings on mount
    useEffect(() => {
        if (!siteId) return;
        getServiceCategories(siteId).then(setCategories).catch(err => logger.error('admin.services.categories.fetch.failed', { siteId, error: err }));
        getReservationSettings(siteId).then(s => setPricingDisplay(s.pricingDisplay || 'fixed')).catch(err => logger.error('admin.services.reservation.settings.fetch.failed', { siteId, error: err }));
    }, [siteId]);

    const refresh = async () => {
        if (!siteId) return;
        const data = await getServiceCatalog(siteId);
        setItems(data);
    };

    const openCreate = () => {
        setEditing(null);
        setForm({ ...DEFAULT_FORM, category: categories[0]?.label ?? 'OTHER' });
        setIsModalOpen(true);
    };

    const openEdit = (item: ServiceCatalogItem) => {
        setEditing(item);
        setForm(itemToForm(item));
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting || !siteId) return;
        setIsSubmitting(true);
        try {
            const isTimeSlot = form.bookable && form.bookingType === 'time_slot';
            const payload: Omit<ServiceCatalogItem, 'id' | 'outletId' | 'createdAt' | 'updatedAt'> = {
                name: form.name.trim(),
                description: form.description.trim() || undefined,
                price: form.price,
                durationMinutes: isTimeSlot ? form.durationMinutes : undefined,
                category: form.category,
                isActive: form.isActive,
                reservationConfig: form.bookable ? {
                    bookingType: form.bookingType,
                    ...(form.maxPrice !== '' ? { maxPrice: Number(form.maxPrice) } : {}),
                } : undefined,
                serviceRecordsConfig: form.hasServiceRecord ? {
                    hasWarranty: form.hasWarranty,
                    defaultWarrantyMonths: form.hasWarranty ? form.defaultWarrantyMonths : undefined,
                    defaultPrice: form.defaultPrice !== '' ? Number(form.defaultPrice) : undefined,
                } : undefined,
            };

            if (editing) {
                await updateServiceCatalogItem(siteId, editing.id, payload);
            } else {
                await createServiceCatalogItem(siteId, payload);
            }
            await refresh();
            setIsModalOpen(false);
        } catch (err) {
            logger.error('admin.services.save.failed', { siteId, error: err });
            alert('Failed to save service. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const confirmDelete = (id: string) => {
        setItemToDelete(id);
        setDeleteDialogOpen(true);
    };

    const executeDelete = async () => {
        if (!itemToDelete || !siteId) return;
        try {
            await deleteServiceCatalogItem(siteId, itemToDelete);
            setItems(prev => prev.filter(i => i.id !== itemToDelete));
        } catch (err) {
            logger.error('admin.services.delete.failed', { siteId, error: err });
            alert('Failed to delete service.');
        } finally {
            setDeleteDialogOpen(false);
            setItemToDelete(null);
        }
    };

    const handleSaveCategories = async (cats: ServiceCategoryConfig[]) => {
        if (!siteId) return;
        await saveServiceCategories(siteId, cats);
        setCategories(cats);
    };

    const filtered = items.filter(i => {
        const matchSearch = i.name.toLowerCase().includes(search.toLowerCase());
        const matchCat = filterCat === 'ALL' || i.category === filterCat;
        return matchSearch && matchCat;
    });

    const set = (field: Partial<FormData>) => setForm(prev => ({ ...prev, ...field }));

    // Build filter pills: ALL (only when items exist) + categories that are actually used
    const usedLabels = Array.from(new Set(items.map(i => i.category)));
    const filterPills = items.length > 0
        ? ['ALL', ...categories.map(c => c.label).filter(l => usedLabels.includes(l))]
        : [];

    return (
        <div>
            {/* Desktop header */}
            <div className="hidden md:flex md:items-center justify-between mb-8 gap-4">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-neutral-100">Services</h1>
                <div className="flex items-center gap-2">
                    {isOwner && (
                        <button
                            onClick={() => setIsCategoryManagerOpen(true)}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-semibold border border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors text-sm"
                        >
                            <Settings2 size={15} /> Categories
                        </button>
                    )}
                    {isOwner && (
                        <button
                            onClick={openCreate}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-semibold text-sm bg-studio-blue text-white hover:bg-studio-blue/90 transition-colors active:scale-95"
                        >
                            <Plus size={15} /> Add Service
                        </button>
                    )}
                </div>
            </div>

            {/* Mobile FAB */}
            {isOwner && (
                <button
                    onClick={openCreate}
                    className="md:hidden fixed bottom-6 right-4 z-30 w-14 h-14 bg-studio-blue text-white rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-transform"
                    style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
                    aria-label="Add Service"
                >
                    <Plus size={24} />
                </button>
            )}

            <div className="bg-white dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800 overflow-hidden">
                {/* Search */}
                <div className="p-4 border-b border-gray-100 dark:border-neutral-800">
                    <div className="relative">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search services..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg focus:outline-none focus:border-brand-dark text-sm font-medium dark:text-neutral-200"
                        />
                    </div>
                </div>

                {/* Category filter pills */}
                <div className="px-4 py-3 border-b border-gray-100 dark:border-neutral-800 flex items-center gap-2 overflow-x-auto no-scrollbar">
                    {filterPills.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setFilterCat(cat)}
                            className={`px-4 py-1.5 rounded-full text-sm font-bold whitespace-nowrap transition-all ${filterCat === cat
                                ? 'bg-studio-blue text-white shadow-md shadow-brand-dark/20'
                                : 'bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-neutral-500 hover:bg-gray-200 dark:hover:bg-neutral-700'
                            }`}
                        >
                            {cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase()}
                        </button>
                    ))}
                </div>

                {/* Table */}
                {filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-center p-16">
                        <p className="text-xl font-bold text-gray-700 dark:text-neutral-300 mb-2">No services found</p>
                        <p className="text-gray-500 dark:text-neutral-500 text-sm">
                            {items.length === 0 ? 'Add your first service to get started.' : 'Try adjusting your search or filter.'}
                        </p>
                    </div>
                ) : (
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 dark:bg-neutral-800/50 text-gray-500 dark:text-neutral-500 font-bold text-xs uppercase tracking-wider">
                            <tr>
                                <th className="py-4 px-6 border-b border-gray-100 dark:border-neutral-800">Service</th>
                                <th className="py-4 px-6 border-b border-gray-100 dark:border-neutral-800">Category</th>
                                <th className="py-4 px-6 border-b border-gray-100 dark:border-neutral-800">Price</th>
                                <th className="py-4 px-6 border-b border-gray-100 dark:border-neutral-800">Modules</th>
                                <th className="py-4 px-6 border-b border-gray-100 dark:border-neutral-800">Status</th>
                                {isOwner && <th className="py-4 px-6 border-b border-gray-100 dark:border-neutral-800 text-right">Actions</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                            {filtered.map(item => (
                                <tr key={item.id} className="hover:bg-gray-50/80 dark:hover:bg-neutral-800/50 transition-colors group">
                                    <td className="py-4 px-6">
                                        <p className="font-bold text-brand-dark">{item.name}</p>
                                        {item.description && (
                                            <p className="text-xs text-gray-400 dark:text-neutral-600 line-clamp-1 mt-0.5">{item.description}</p>
                                        )}
                                    </td>
                                    <td className="py-4 px-6">
                                        <span className={`text-xs font-bold px-2 py-1 rounded-md uppercase tracking-wide ${getCategoryColor(categories, item.category)}`}>
                                            {item.category}
                                        </span>
                                    </td>
                                    <td className="py-4 px-6 font-bold text-gray-900 dark:text-neutral-100">
                                        {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(item.price)}
                                    </td>
                                    <td className="py-4 px-6">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            {item.reservationConfig && (
                                                <span className="text-xs font-bold px-2 py-0.5 bg-indigo-100 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400 rounded-full flex items-center gap-1">
                                                    {item.reservationConfig.bookingType === 'request'
                                                        ? 'On Request'
                                                        : <><Clock size={10} /> {item.durationMinutes}m</>
                                                    }
                                                </span>
                                            )}
                                            {item.serviceRecordsConfig && (
                                                <span className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-400 rounded-full">
                                                    {item.serviceRecordsConfig.hasWarranty && <ShieldCheck size={11} />}
                                                    SR
                                                    {item.serviceRecordsConfig.hasWarranty && ` · ${item.serviceRecordsConfig.defaultWarrantyMonths ?? '?'}mo`}
                                                </span>
                                            )}
                                            {!item.reservationConfig && !item.serviceRecordsConfig && (
                                                <span className="text-xs text-gray-400 dark:text-neutral-600">—</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="py-4 px-6">
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${item.isActive
                                            ? 'bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-400'
                                            : 'bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-neutral-500'
                                        }`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${item.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
                                            {item.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    {isOwner && (
                                        <td className="py-4 px-6 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => openEdit(item)}
                                                    className="p-2 hover:bg-blue-50 dark:hover:bg-blue-950/30 text-gray-400 dark:text-neutral-600 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg transition-colors"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => confirmDelete(item.id)}
                                                    className="p-2 hover:bg-red-50 dark:hover:bg-red-950/30 text-gray-400 dark:text-neutral-600 hover:text-red-600 dark:hover:text-red-400 rounded-lg transition-colors"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Service Add/Edit — bottom sheet on mobile, centered modal on desktop */}
            {isMobile ? (
                <MobileBottomSheet
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    title={editing ? 'Edit Service' : 'New Service'}
                    height="90vh"
                >
                    <ServiceForm
                        form={form} set={set} categories={categories} pricingDisplay={pricingDisplay}
                        isSubmitting={isSubmitting} editing={editing}
                        onCancel={() => setIsModalOpen(false)}
                        onSubmit={handleSave}
                        onRequestManageCategories={() => { setIsModalOpen(false); setIsCategoryManagerOpen(true); }}
                        padding="p-4"
                    />
                </MobileBottomSheet>
            ) : isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-neutral-900 rounded-lg w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
                        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-neutral-800 flex-shrink-0">
                            <h2 className="text-xl font-bold text-brand-dark">
                                {editing ? 'Edit Service' : 'New Service'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-full transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <ServiceForm
                            form={form} set={set} categories={categories} pricingDisplay={pricingDisplay}
                            isSubmitting={isSubmitting} editing={editing}
                            onCancel={() => setIsModalOpen(false)}
                            onSubmit={handleSave}
                            onRequestManageCategories={() => { setIsModalOpen(false); setIsCategoryManagerOpen(true); }}
                            padding="p-6"
                        />
                    </div>
                </div>
            )}

            {/* Category Manager Modal */}
            {isCategoryManagerOpen && (
                <CategoryManagerModal
                    categories={categories}
                    onSave={handleSaveCategories}
                    onClose={() => setIsCategoryManagerOpen(false)}
                />
            )}

            <ConfirmationDialog
                isOpen={deleteDialogOpen}
                title="Delete Service"
                message="Are you sure you want to delete this service? Existing bookings and service records referencing it will not be affected."
                onConfirm={executeDelete}
                onCancel={() => setDeleteDialogOpen(false)}
                confirmLabel="Delete Service"
                isDestructive={true}
            />
        </div>
    );
}
