'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { SiteSettings, NavigationItem } from '@/data/mockData';
import { Save, Search, Globe, ImageIcon, Palette, GripVertical, DownloadCloud, ChevronDown, ChevronUp, Trash2, Link as LinkIcon, Plus } from 'lucide-react';
import { FormSkeleton } from '@/components/skeletons/FormSkeleton';
import { SubmitButton } from '@/components/admin/SubmitButton';
import { templateDefinitions } from '@/lib/templates/definitions';
import { getAvailableTemplates, saveTemplate } from '@/lib/templates/service';
import { TemplateDocument } from '@/lib/templates/types';
import { IconSelector } from '@/components/admin/IconSelector';
import { ICON_MAP } from '@/data/icons';
import { useSite } from '@/lib/site-context';
import { ThemeMockup } from '@/components/admin/ThemeMockup';

import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Available blocks map for display names
const BLOCK_NAMES: Record<string, string> = {
    'quick_actions': 'Quick Actions (Links)',
    'branches': 'Branches List',
    'featured': 'Featured Product',
    'gallery': 'Product Gallery',
    'hours': 'Operating Hours'
};

function SortableBlockItem({ id, isHidden, onToggle }: { id: string, isHidden: boolean, onToggle: () => void }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div ref={setNodeRef} style={style} className="bg-white border-2 border-gray-100 rounded-xl p-3 flex items-center gap-3 mb-2 shadow-sm relative z-10">
            <div {...attributes} {...listeners} className="cursor-grab text-gray-400 hover:text-brand-dark active:cursor-grabbing">
                <GripVertical size={20} />
            </div>
            <div className={`font-bold ${isHidden ? 'text-gray-400 line-through' : 'text-gray-700'} flex-1`}>
                {BLOCK_NAMES[id] || id} {isHidden && <span className="text-xs font-normal ml-2 text-gray-400">(Hidden)</span>}
            </div>

            <button
                type="button"
                onClick={onToggle}
                className={`
                    relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-green focus:ring-offset-2
                    ${!isHidden ? 'bg-brand-dark' : 'bg-gray-200'}
                `}
            >
                <span className="sr-only">Use setting</span>
                <span
                    aria-hidden="true"
                    className={`
                        pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out
                        ${!isHidden ? 'translate-x-5' : 'translate-x-0'}
                    `}
                />
            </button>
        </div>
    );
}

function SortableNavItem({ item, onRemove, onUpdate, forms, pages }: { item: any, onRemove: () => void, onUpdate: (field: string, val: string) => void, forms: any[], pages: any[] }) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id });
    const style = { transform: CSS.Transform.toString(transform), transition };
    const [isExpanded, setIsExpanded] = useState(false);
    const [showIconSelector, setShowIconSelector] = useState(false);

    // Get Icon Component
    const Icon = item.icon && ICON_MAP[item.icon] ? ICON_MAP[item.icon] : LinkIcon;

    return (
        <div ref={setNodeRef} style={style} className="bg-white rounded-xl border-2 border-gray-100 shadow-sm overflow-hidden mb-2 transition-all hover:border-brand-dark/50 group">
            {/* Header / Drag Handle */}
            <div className="flex items-center justify-between p-3 bg-gray-50 border-b border-gray-100">
                <div className="flex items-center gap-3">
                    <div {...attributes} {...listeners} className="p-1.5 text-gray-400 hover:text-brand-dark hover:bg-gray-200 rounded cursor-grab active:cursor-grabbing">
                        <GripVertical size={18} />
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center border border-gray-200 text-brand-dark shadow-sm">
                            <Icon size={16} />
                        </div>
                        <div>
                            <span className="font-bold text-sm text-gray-800 block truncate max-w-[150px]">{item.label || 'New Link'}</span>
                            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mt-0.5">
                                {item.type === 'form' ? 'Form Link' : item.type === 'page' ? 'Page Link' : 'External URL'}
                            </span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="p-1.5 text-gray-500 hover:text-brand-dark hover:bg-gray-200 rounded transition-colors"
                    >
                        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                    <button
                        type="button"
                        onClick={onRemove}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    >
                        <Trash2 size={18} />
                    </button>
                </div>
            </div>

            {/* Form Content */}
            {isExpanded && (
                <div className="p-4 bg-white space-y-4 animate-in slide-in-from-top-2 duration-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="col-span-1 md:col-span-2">
                            <label className="text-xs font-bold text-gray-500 uppercase mb-1.5 block tracking-wider">Label</label>
                            <input
                                type="text"
                                value={item.label}
                                onChange={(e) => onUpdate('label', e.target.value)}
                                className="w-full px-4 py-2 text-sm border border-gray-200 rounded-lg focus:border-brand-dark focus:ring-0 text-gray-800 font-bold"
                                placeholder="e.g. Home"
                            />
                        </div>

                        {/* Link Type Selector */}
                        <div className="col-span-1 md:col-span-2">
                            <label className="text-xs font-bold text-gray-500 uppercase mb-2 block tracking-wider">Link Type</label>
                            <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-lg border border-gray-200 w-fit">
                                <button
                                    type="button"
                                    onClick={() => onUpdate('type', 'url')}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${item.type === 'url' || !item.type ? 'bg-white shadow text-brand-dark' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    External URL
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onUpdate('type', 'form')}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${item.type === 'form' ? 'bg-white shadow text-purple-600' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    Link to Form
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onUpdate('type', 'page')}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${item.type === 'page' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    Link to Page
                                </button>
                            </div>
                        </div>

                        {/* Dynamic Input Based on Type */}
                        <div className="col-span-1 md:col-span-2">
                            {item.type === 'form' ? (
                                <div>
                                    <label className="text-xs font-bold text-purple-600 uppercase mb-1.5 block tracking-wider">Select Form</label>
                                    <select
                                        value={item.formId || ''}
                                        onChange={(e) => {
                                            const fId = e.target.value;
                                            onUpdate('formId', fId);
                                        }}
                                        className="w-full px-4 py-2 text-sm border border-purple-200 bg-purple-50/50 rounded-lg focus:border-purple-500 focus:ring-0 text-gray-800"
                                    >
                                        <option value="">-- Choose a Form --</option>
                                        {forms.map(f => (
                                            <option key={f.id} value={f.id}>{f.title}</option>
                                        ))}
                                    </select>
                                </div>
                            ) : item.type === 'page' ? (
                                <div>
                                    <label className="text-xs font-bold text-blue-600 uppercase mb-1.5 block tracking-wider">Select Page</label>
                                    <select
                                        value={item.pageId || ''}
                                        onChange={(e) => {
                                            const pId = e.target.value;
                                            const page = pages.find(p => p.id === pId);
                                            onUpdate('pageId', pId);
                                            if (page) onUpdate('value', `/${page.slug}`);
                                        }}
                                        className="w-full px-4 py-2 text-sm border border-blue-200 bg-blue-50/50 rounded-lg focus:border-blue-500 focus:ring-0 text-gray-800"
                                    >
                                        <option value="">-- Choose a Page --</option>
                                        {pages.map(p => (
                                            <option key={p.id} value={p.id}>{p.title} (/{p.slug})</option>
                                        ))}
                                    </select>
                                </div>
                            ) : (
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase mb-1.5 block tracking-wider">URL / Action</label>
                                    <input
                                        type="text"
                                        value={item.value}
                                        onChange={(e) => onUpdate('value', e.target.value)}
                                        className="w-full px-4 py-2 text-sm border border-gray-200 rounded-lg focus:border-brand-dark focus:ring-0 text-gray-600 font-mono"
                                        placeholder="/path or https://"
                                    />
                                </div>
                            )}
                        </div>

                        <div className="col-span-1 md:col-span-2">
                            <label className="text-xs font-bold text-gray-500 uppercase mb-1.5 block tracking-wider">Icon</label>
                            <button
                                type="button"
                                onClick={() => setShowIconSelector(true)}
                                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-200 hover:border-brand-dark hover:bg-gray-50 transition-all text-left group/icon"
                            >
                                <div className="w-10 h-10 bg-brand-green/10 rounded-lg flex items-center justify-center text-brand-dark group-hover/icon:bg-brand-green/20 transition-colors">
                                    <Icon size={20} />
                                </div>
                                <div className="flex-1">
                                    <span className="block font-bold text-sm text-gray-800">{item.icon || 'Select Icon'}</span>
                                    <span className="text-xs text-gray-500">Click to change icon</span>
                                </div>
                                <span className="text-xs text-brand-dark font-bold bg-brand-green/10 px-3 py-1 rounded-full">Change</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Icon Selector Modal */}
            {showIconSelector && (
                <IconSelector
                    selectedIcon={item.icon || ''}
                    onSelect={(iconName) => {
                        onUpdate('icon', iconName);
                        setShowIconSelector(false);
                    }}
                    onClose={() => setShowIconSelector(false)}
                />
            )}
        </div>
    );
}

function NavIconPicker({ currentIcon, onSelect }: { currentIcon: string, onSelect: (icon: string) => void }) {
    const [showSelector, setShowSelector] = useState(false);
    const Icon = currentIcon && ICON_MAP[currentIcon] ? ICON_MAP[currentIcon] : LinkIcon;

    return (
        <>
            <button
                type="button"
                onClick={() => setShowSelector(true)}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg border border-gray-200 hover:border-brand-dark hover:bg-gray-50 transition-all text-left group/icon"
            >
                <div className="w-8 h-8 bg-brand-green/10 rounded-lg flex items-center justify-center text-brand-dark group-hover/icon:bg-brand-green/20 transition-colors">
                    <Icon size={18} />
                </div>
                <div className="flex-1">
                    <span className="block font-bold text-sm text-gray-800">{currentIcon || 'Select Icon'}</span>
                </div>
                <span className="text-xs text-brand-dark font-bold bg-brand-green/10 px-2 py-1 rounded-full">Change</span>
            </button>
            {showSelector && (
                <IconSelector
                    selectedIcon={currentIcon}
                    onSelect={(icon) => {
                        onSelect(icon);
                        setShowSelector(false);
                    }}
                    onClose={() => setShowSelector(false)}
                />
            )}
        </>
    );
}

export default function AppearanceClient() {
    const { siteId } = useSite();
    const [settings, setSettings] = useState<SiteSettings>({
        title: '',
        description: '',
        faviconUrl: '',
        ogImageUrl: '',
        themeColor: '#B6FF2E',
        accentColor: '#0E3B2E',
        fontFamily: 'Plus Jakarta Sans',
        layoutStyle: 'classic',
        backgroundImageUrl: '',
        footerText: '',
        homeBlockOrder: ['quick_actions', 'branches', 'featured', 'gallery', 'hours'],
        hiddenBlockIds: [],
        galleryTitle: '',
        borderRadius: 'large',
        navigation: { topNav: [], bottomNav: [] }
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');

    // Template Management State
    const [templates, setTemplates] = useState<TemplateDocument[]>([]);
    const [forms, setForms] = useState<any[]>([]);
    const [pages, setPages] = useState<any[]>([]);
    const [seeding, setSeeding] = useState(false);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    useEffect(() => {
        if (!siteId) return;
        fetchSettings();
        fetchTemplates();
        fetchResources();
    }, [siteId]);

    const fetchResources = async () => {
        if (!siteId) return;
        try {
            const [formsSnap, pagesSnap] = await Promise.all([
                getDocs(collection(db, 'sites', siteId, 'forms')),
                getDocs(collection(db, 'sites', siteId, 'pages'))
            ]);
            setForms(formsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
            setPages(pagesSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (err) {
            console.error("Failed to load resources:", err);
        }
    };

    const fetchTemplates = async () => {
        const fetched = await getAvailableTemplates();
        if (fetched.length > 0) {
            setTemplates(fetched);
        }
    };

    const fetchSettings = async () => {
        if (!siteId) return;
        try {
            const snap = await getDoc(doc(db, 'sites', siteId, 'content', 'siteSettings'));
            if (snap.exists()) {
                const data = snap.data() as SiteSettings;
                setSettings({
                    ...data,
                    homeBlockOrder: data.homeBlockOrder || ['quick_actions', 'branches', 'featured', 'gallery', 'hours'],
                    hiddenBlockIds: data.hiddenBlockIds || [],
                    galleryTitle: data.galleryTitle || '',
                    borderRadius: data.borderRadius || 'large',
                    navigation: data.navigation || { topNav: [], bottomNav: [] }
                });
            } else {
                // Set defaults
                setSettings({
                    title: 'SunnySide - Fresh Bakes Daily',
                    description: 'Artisanal pastries, strong coffee, and good vibes.',
                    faviconUrl: '',
                    ogImageUrl: '',
                    themeColor: '#B6FF2E',
                    accentColor: '#0E3B2E',
                    fontFamily: 'Plus Jakarta Sans',
                    layoutStyle: 'classic',
                    backgroundImageUrl: '',
                    footerText: '© 2024 SunnySide',
                    homeBlockOrder: ['quick_actions', 'branches', 'featured', 'gallery', 'hours'],
                    hiddenBlockIds: [],
                    galleryTitle: '',
                    borderRadius: 'large',
                    navigation: { topNav: [], bottomNav: [] }
                });
            }
        } catch (error) {
            console.error("Error fetching settings:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!siteId) return;
        setSaving(true);
        setMessage('');

        try {
            await setDoc(doc(db, 'sites', siteId, 'content', 'siteSettings'), settings);
            setMessage('Appearance saved successfully!');
            setTimeout(() => setMessage(''), 3000);
        } catch (err) {
            console.error(err);
            setMessage('Error saving appearance');
        } finally {
            setSaving(false);
        }
    };


    // --- Navigation Handlers ---

    // Helper to generate IDs
    const generateId = () => Math.random().toString(36).substr(2, 9);

    const handleAddNavItem = (list: 'top' | 'bottom') => {
        const newItem: any = {
            id: generateId(),
            label: 'New Link',
            type: 'link',
            value: '#',
            icon: 'Link'
        };

        setSettings(prev => {
            const nav = prev.navigation || { topNav: [], bottomNav: [] };
            return {
                ...prev,
                navigation: {
                    ...nav,
                    topNav: list === 'top' ? [...(nav.topNav || []), newItem] : (nav.topNav || []),
                    bottomNav: list === 'bottom' ? [...(nav.bottomNav || []), newItem] : (nav.bottomNav || []),
                }
            };
        });
    };

    const handleRemoveNavItem = (list: 'top' | 'bottom', id: string) => {
        setSettings(prev => {
            const nav = prev.navigation || { topNav: [], bottomNav: [] };
            return {
                ...prev,
                navigation: {
                    ...nav,
                    topNav: list === 'top' ? (nav.topNav || []).filter(i => i.id !== id) : (nav.topNav || []),
                    bottomNav: list === 'bottom' ? (nav.bottomNav || []).filter(i => i.id !== id) : (nav.bottomNav || []),
                }
            };
        });
    };

    const handleUpdateNavItem = (list: 'top' | 'bottom', id: string, field: string, value: string) => {
        const updateList = (items: any[]) => items.map(item => item.id === id ? { ...item, [field]: value } : item);

        setSettings(prev => {
            const nav = prev.navigation || { topNav: [], bottomNav: [] };
            return {
                ...prev,
                navigation: {
                    ...nav,
                    topNav: list === 'top' ? updateList(nav.topNav || []) : (nav.topNav || []),
                    bottomNav: list === 'bottom' ? updateList(nav.bottomNav || []) : (nav.bottomNav || []),
                }
            };
        });
    };

    const handleSeed = async () => {
        if (!confirm('This will seed the database with system templates. Existing custom templates will be preserved. Continue?')) return;
        setSeeding(true);
        try {
            for (const key in templateDefinitions) {
                const def = templateDefinitions[key];
                const doc: TemplateDocument = {
                    id: def.id as string,
                    name: def.name,
                    description: def.description,
                    type: 'system',
                    tier: def.isPro ? 'premium' : 'free',
                    status: 'active',
                    config: def.config,
                    ownerId: null,
                    updatedAt: new Date(),
                };
                await saveTemplate(doc);
            }
            setMessage('Templates seeded successfully!');
            fetchTemplates();
        } catch (error) {
            console.error(error);
            setMessage('Error seeding templates');
        } finally {
            setSeeding(false);
        }
    };

    const handleNavDragEnd = (event: DragEndEvent, listKey: 'topNav' | 'bottomNav') => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            setSettings((prev) => {
                const nav = prev.navigation || { topNav: [], bottomNav: [] };
                const list = nav[listKey] || [];
                const oldIndex = list.findIndex(i => i.id === active.id);
                const newIndex = list.findIndex(i => i.id === over.id);

                return {
                    ...prev,
                    navigation: {
                        ...nav,
                        [listKey]: arrayMove(list, oldIndex, newIndex)
                    }
                };
            });
        }
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            setSettings((items) => {
                const oldIndex = (items.homeBlockOrder || []).indexOf(active.id as string);
                const newIndex = (items.homeBlockOrder || []).indexOf(over.id as string);

                return {
                    ...items,
                    homeBlockOrder: arrayMove(items.homeBlockOrder || [], oldIndex, newIndex)
                };
            });
        }
    };

    const [activeTab, setActiveTab] = useState<'template' | 'layout' | 'navigation'>('template');

    if (loading) return <FormSkeleton />;

    const templatesToDisplay = templates.length > 0
        ? templates
        : Object.values(templateDefinitions).map(d => ({
            ...d,
            type: 'system' as const,
            tier: d.isPro ? 'premium' : 'free',
            status: 'active',
            ownerId: null
        } as TemplateDocument));

    return (
        <div className="max-w-4xl">
            <h1 className="text-3xl font-black text-brand-dark mb-8 uppercase flex items-center gap-3">
                <Palette size={32} />
                Appearance
            </h1>

            {message && (
                <div className={`p-4 rounded-xl mb-6 font-bold ${message.includes('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                    {message}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                <div className="flex flex-col gap-6">
                    {/* Editor Form */}
                    <form onSubmit={handleSave} className={`space-y-6 bg-white p-8 rounded-3xl border-[3px] border-brand-dark shadow-sm h-fit transition-opacity duration-200 ${saving ? 'opacity-50 pointer-events-none' : ''}`}>

                    <div className="flex gap-2 p-1 bg-gray-100 rounded-xl mb-6">
                        <button
                            type="button"
                            onClick={() => setActiveTab('template')}
                            className={`flex-1 py-2 px-4 rounded-lg font-bold text-sm transition-all ${activeTab === 'template'
                                ? 'bg-white text-brand-dark shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            Template
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('layout')}
                            className={`flex-1 py-2 px-4 rounded-lg font-bold text-sm transition-all ${activeTab === 'layout'
                                ? 'bg-white text-brand-dark shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            Block Layout
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('navigation')}
                            className={`flex-1 py-2 px-4 rounded-lg font-bold text-sm transition-all ${activeTab === 'navigation'
                                ? 'bg-white text-brand-dark shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            Navigation
                        </button>
                    </div>

                        {activeTab === 'template' && (
                            <div className="space-y-8 animate-fade-in">
                                <div>
                                    <div className="flex items-center justify-between mb-4">
                                        <div>
                                            <label className="block text-brand-dark font-black text-xl">Template Gallery</label>
                                            <p className="text-sm text-gray-500 mt-1">
                                                Choose a comprehensive design package.
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleSeed}
                                            disabled={seeding}
                                            className="text-xs flex items-center gap-1 text-gray-400 hover:text-brand-dark transition-colors"
                                        >
                                            <DownloadCloud size={14} />
                                            {seeding ? 'Seeding...' : 'Reset Templates'}
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {templatesToDisplay.map((template) => {
                                            const isSelected = (settings.layoutStyle || 'classic') === template.id;
                                            const getLayoutDescription = (id: string, config: any) => {
                                                if (config.cardStyle) return config.cardStyle.charAt(0).toUpperCase() + config.cardStyle.slice(1);
                                                return 'Standard';
                                            };

                                            return (
                                                <button
                                                    key={template.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setSettings({
                                                            ...settings,
                                                            layoutStyle: template.id as any,
                                                            themeColor: template.config.colors.primary,
                                                            accentColor: template.config.colors.foreground,
                                                            fontFamily: template.config.fonts.heading
                                                        });
                                                    }}
                                                    className={`
                                                    group relative flex flex-col p-5 rounded-3xl transition-all duration-300 text-left overflow-hidden
                                                    ${template.id === 'sojourner' ? 'border' : 'border-[3px]'}
                                                    ${isSelected
                                                            ? (template.id === 'sojourner' ? 'border-brand-green bg-white shadow-md ring-1 ring-brand-green' : 'border-brand-dark bg-white shadow-md scale-[1.01]')
                                                            : 'border-gray-100 hover:border-brand-dark/30 hover:shadow-sm bg-white'
                                                        }
                                                `}
                                                >
                                                    <div
                                                        className="absolute top-0 left-0 w-full h-24 opacity-10 transition-colors"
                                                        style={{ backgroundColor: template.config.colors.primary }}
                                                    />

                                                    <div className="relative z-10 flex justify-between items-start mb-3">
                                                        <div className="flex items-center -space-x-2">
                                                            <div
                                                                className="w-8 h-8 rounded-full border-2 border-white shadow-sm"
                                                                style={{ backgroundColor: template.config.colors.primary }}
                                                            />
                                                            <div
                                                                className="w-8 h-8 rounded-full border-2 border-white shadow-sm"
                                                                style={{ backgroundColor: template.config.colors.foreground }}
                                                            />
                                                        </div>

                                                        {isSelected && (
                                                            <div className="bg-brand-dark text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider">
                                                                Active
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="relative z-10">
                                                        <h3 className="font-bold text-lg text-brand-dark">{template.name}</h3>
                                                        <div className="flex flex-wrap gap-2 mt-2">
                                                            <span className="inline-flex items-center px-2 py-1 rounded-md bg-gray-100 text-xs font-medium text-gray-600">
                                                                {getLayoutDescription(template.id, template.config)}
                                                            </span>
                                                            {template.tier === 'premium' && (
                                                                <span className="inline-flex items-center px-2 py-1 rounded-md bg-yellow-100 text-yellow-800 text-xs font-bold">
                                                                    PRO
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-gray-400 mt-3 leading-relaxed">
                                                            {template.description}
                                                        </p>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-brand-dark font-bold mb-3">Quick Themes</label>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                        {[
                                            { name: 'Sunnyside', bg: '#B6FF2E', accent: '#0E3B2E' },
                                            { name: 'Electric Blue', bg: '#2EC5FF', accent: '#0B1F17' },
                                            { name: 'Tangerine', bg: '#FF8A00', accent: '#1A1A1A' },
                                            { name: 'Coral Pink', bg: '#FF5A5F', accent: '#0B1F17' },
                                            { name: 'Royal Purple', bg: '#6C4DFF', accent: '#FFFFFF' },
                                            { name: 'Solar Yellow', bg: '#FFD400', accent: '#1A1A1A' },
                                        ].map((theme) => {
                                            const isSelected = settings.themeColor === theme.bg && settings.accentColor === theme.accent;
                                            return (
                                                <button
                                                    key={theme.name}
                                                    type="button"
                                                    onClick={() => setSettings({ ...settings, themeColor: theme.bg, accentColor: theme.accent })}
                                                    className={`
                                                    group relative flex flex-col items-center gap-3 p-4 rounded-2xl border-[3px] transition-all duration-200
                                                    ${isSelected
                                                            ? 'border-brand-dark shadow-md scale-[1.02] bg-gray-50'
                                                            : 'border-gray-100 hover:border-gray-200 hover:shadow-sm'
                                                        }
                                                `}
                                                >
                                                    <div className="w-full aspect-square rounded-xl shadow-inner relative overflow-hidden flex items-center justify-center" style={{ backgroundColor: theme.bg }}>
                                                        <div className="w-8 h-8 rounded-full shadow-sm" style={{ backgroundColor: theme.accent }}></div>
                                                    </div>
                                                    <span className={`text-sm font-bold ${isSelected ? 'text-brand-dark' : 'text-gray-500'}`}>{theme.name}</span>

                                                    {isSelected && (
                                                        <div className="absolute top-3 right-3 w-4 h-4 bg-brand-dark rounded-full border-[2px] border-white shadow-sm animate-fade-in"></div>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-brand-dark font-bold mb-2">Custom Theme Color</label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="color"
                                                value={settings.themeColor || '#B6FF2E'}
                                                onChange={(e) => setSettings({ ...settings, themeColor: e.target.value })}
                                                className="w-12 h-12 rounded-lg border-2 border-gray-200 p-1 cursor-pointer"
                                            />
                                            <span className="text-sm font-mono text-gray-500 uppercase">{settings.themeColor || '#B6FF2E'}</span>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-brand-dark font-bold mb-2">Custom Accent Color</label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="color"
                                                value={settings.accentColor || '#0E3B2E'}
                                                onChange={(e) => setSettings({ ...settings, accentColor: e.target.value })}
                                                className="w-12 h-12 rounded-lg border-2 border-gray-200 p-1 cursor-pointer"
                                            />
                                            <span className="text-sm font-mono text-gray-500 uppercase">{settings.accentColor || '#0E3B2E'}</span>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-brand-dark font-bold mb-2">Corner Radius</label>
                                    <div className="flex bg-gray-100 p-1 rounded-xl">
                                        {(['small', 'medium', 'large'] as const).map((size) => (
                                            <button
                                                key={size}
                                                type="button"
                                                onClick={() => setSettings({ ...settings, borderRadius: size })}
                                                className={`
                                                flex-1 py-2 rounded-lg font-bold text-sm capitalize transition-all
                                                ${(settings.borderRadius || 'large') === size
                                                        ? 'bg-white text-brand-dark shadow-sm'
                                                        : 'text-gray-500 hover:text-gray-700'
                                                    }
                                            `}
                                            >
                                                {size}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-brand-dark font-bold mb-2">Typography</label>
                                    <select
                                        value={settings.fontFamily || 'Plus Jakarta Sans'}
                                        onChange={(e) => setSettings({ ...settings, fontFamily: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl border-[2px] border-gray-200 focus:border-brand-dark outline-none font-medium"
                                    >
                                        <option value="Plus Jakarta Sans">Plus Jakarta Sans (Default)</option>
                                        <option value="Inter">Inter</option>
                                        <option value="Playfair Display">Playfair Display (Serif)</option>
                                        <option value="Space Mono">Space Mono (Code)</option>
                                        <option value="Poppins">Poppins</option>
                                    </select>
                                </div>
                            </div>
                        )}

                        {activeTab === 'layout' && (
                            <div className="space-y-8 animate-fade-in">
                                <div>
                                    <label className="block text-brand-dark font-bold mb-2">Home Page Layout</label>
                                    <div className="text-xs text-gray-500 mb-3">Drag items to reorder blocks on the home page.</div>
                                    <div className="bg-gray-50 rounded-2xl p-4 border-2 border-dashed border-gray-200">
                                        <div className="bg-gray-100 border-2 border-transparent rounded-xl p-3 flex items-center gap-3 mb-2 opacity-60">
                                            <div className="w-5"></div>
                                            <div className="font-bold text-gray-500">Profile Header (Fixed)</div>
                                        </div>

                                        <DndContext
                                            sensors={sensors}
                                            collisionDetection={closestCenter}
                                            onDragEnd={handleDragEnd}
                                        >
                                            <SortableContext
                                                items={settings.homeBlockOrder || []}
                                                strategy={verticalListSortingStrategy}
                                            >
                                                {(settings.homeBlockOrder || []).map((id) => (
                                                    <SortableBlockItem
                                                        key={id}
                                                        id={id}
                                                        isHidden={(settings.hiddenBlockIds || []).includes(id)}
                                                        onToggle={() => {
                                                            const currentHidden = settings.hiddenBlockIds || [];
                                                            const newHidden = currentHidden.includes(id)
                                                                ? currentHidden.filter(hid => hid !== id)
                                                                : [...currentHidden, id];

                                                            setSettings({ ...settings, hiddenBlockIds: newHidden });
                                                        }}
                                                    />
                                                ))}
                                            </SortableContext>
                                        </DndContext>

                                        <div className="bg-gray-100 border-2 border-transparent rounded-xl p-3 flex items-center gap-3 mt-2 opacity-60">
                                            <div className="w-5"></div>
                                            <div className="font-bold text-gray-500">Footer (Fixed)</div>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-brand-dark font-bold mb-3">Block Settings</label>
                                    <div className="space-y-4 bg-gray-50 rounded-2xl p-6 border border-gray-200"></div>
                                </div>

                                <div>
                                    <label className="block text-brand-dark font-bold mb-3">Business Address</label>
                                    <div className="space-y-3">
                                        <label className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200 cursor-pointer hover:border-brand-dark/30 transition-colors">
                                            <div className={`
                                            relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-green focus:ring-offset-2
                                            ${settings.showHeaderAddress ? 'bg-brand-dark' : 'bg-gray-200'}
                                        `}>
                                                <input
                                                    type="checkbox"
                                                    className="sr-only"
                                                    checked={settings.showHeaderAddress || false}
                                                    onChange={(e) => setSettings({ ...settings, showHeaderAddress: e.target.checked })}
                                                />
                                                <span
                                                    className={`
                                                    pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out
                                                    ${settings.showHeaderAddress ? 'translate-x-5' : 'translate-x-0'}
                                                `}
                                                />
                                            </div>
                                            <div>
                                                <span className="block font-bold text-brand-dark">Show Address in Header</span>
                                                <span className="block text-sm text-gray-500">Show location pin below description</span>
                                            </div>
                                        </label>

                                        <label className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200 cursor-pointer hover:border-brand-dark/30 transition-colors">
                                            <div className={`
                                            relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-green focus:ring-offset-2
                                            ${!settings.hideFooterContact ? 'bg-brand-dark' : 'bg-gray-200'}
                                        `}>
                                                <input
                                                    type="checkbox"
                                                    className="sr-only"
                                                    checked={!settings.hideFooterContact}
                                                    onChange={(e) => setSettings({ ...settings, hideFooterContact: !e.target.checked })}
                                                />
                                                <span
                                                    className={`
                                                    pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out
                                                    ${!settings.hideFooterContact ? 'translate-x-5' : 'translate-x-0'}
                                                `}
                                                />
                                            </div>
                                            <div>
                                                <span className="block font-bold text-brand-dark">Show Contact Info</span>
                                                <span className="block text-sm text-gray-500">Display address and email in footer</span>
                                            </div>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* TAB 3: Navigation / Menu */}
                        {activeTab === 'navigation' && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div>
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="font-black text-brand-dark text-lg uppercase tracking-tight">Main Navigation</h3>
                                        <button
                                            type="button"
                                            onClick={() => handleAddNavItem('top')}
                                            className="bg-brand-dark text-white p-2 rounded-xl hover:bg-brand-dark/90 text-sm font-bold flex items-center gap-2"
                                        >
                                            <Plus size={16} /> Add Link
                                        </button>
                                    </div>
                                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleNavDragEnd(e, 'topNav')}>
                                        <SortableContext items={(settings.navigation?.topNav || []).map(i => i.id)} strategy={verticalListSortingStrategy}>
                                            {settings.navigation?.topNav?.map((item) => (
                                                <SortableNavItem
                                                    key={item.id}
                                                    item={item}
                                                    onRemove={() => handleRemoveNavItem('top', item.id)}
                                                    onUpdate={(f, v) => handleUpdateNavItem('top', item.id, f, v)}
                                                    forms={forms}
                                                    pages={pages}
                                                />
                                            ))}
                                        </SortableContext>
                                    </DndContext>
                                </div>

                                {/* NEW: Action Buttons (CTA) Restoration */}
                                <div className="mt-8 bg-gray-50 border-2 border-gray-100 rounded-3xl p-6">
                                    <div className="flex items-center gap-2 mb-4">
                                        <h3 className="font-black text-brand-dark text-lg uppercase tracking-tight">Action Buttons (CTA)</h3>
                                        <span className="text-[8px] bg-brand-green/20 text-brand-dark px-1.5 py-0.5 rounded font-black uppercase tracking-widest">Header Only</span>
                                    </div>

                                    <div className="space-y-4">
                                        <label className="flex items-center gap-3 cursor-pointer">
                                            <div className={`
                                                relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out 
                                                ${settings.navigation?.topNavActions?.cta?.enabled ? 'bg-brand-dark' : 'bg-gray-200'}
                                            `}>
                                                <input
                                                    type="checkbox"
                                                    className="sr-only"
                                                    checked={settings.navigation?.topNavActions?.cta?.enabled || false}
                                                    onChange={(e) => setSettings({
                                                        ...settings,
                                                        navigation: {
                                                            ...settings.navigation!,
                                                            topNavActions: {
                                                                ...settings.navigation?.topNavActions,
                                                                showSearch: settings.navigation?.topNavActions?.showSearch || false,
                                                                cta: { ...(settings.navigation?.topNavActions?.cta || { label: 'Book Now', linkValue: '', linkType: 'url' }), enabled: e.target.checked }
                                                            }
                                                        }
                                                    })}
                                                />
                                                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${settings.navigation?.topNavActions?.cta?.enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                                            </div>
                                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Show CTA Button in Header</span>
                                        </label>

                                        {settings.navigation?.topNavActions?.cta?.enabled && (
                                            <div className="grid grid-cols-2 gap-4 pt-2 animate-in slide-in-from-top-1 duration-200">
                                                <div>
                                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Button Label</label>
                                                    <input
                                                        type="text"
                                                        value={settings.navigation?.topNavActions?.cta?.label || ''}
                                                        onChange={(e) => setSettings({
                                                            ...settings,
                                                            navigation: {
                                                                ...settings.navigation!,
                                                                    topNavActions: {
                                                                        ...settings.navigation?.topNavActions,
                                                                        showSearch: settings.navigation?.topNavActions?.showSearch || false,
                                                                        cta: { ...settings.navigation?.topNavActions?.cta!, label: e.target.value }
                                                                    }
                                                            }
                                                        })}
                                                        className="w-full px-4 py-2 text-sm border-2 border-white bg-white rounded-xl focus:border-brand-dark focus:ring-0 font-bold"
                                                        placeholder="e.g. Reservation"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Target link</label>
                                                    <input
                                                        type="text"
                                                        value={settings.navigation?.topNavActions?.cta?.linkValue || ''}
                                                        onChange={(e) => setSettings({
                                                            ...settings,
                                                            navigation: {
                                                                ...settings.navigation!,
                                                                    topNavActions: {
                                                                        ...settings.navigation?.topNavActions,
                                                                        showSearch: settings.navigation?.topNavActions?.showSearch || false,
                                                                        cta: { ...settings.navigation?.topNavActions?.cta!, linkValue: e.target.value, linkType: 'url' }
                                                                    }
                                                            }
                                                        })}
                                                        className="w-full px-4 py-2 text-[10px] font-mono border-2 border-white bg-white rounded-xl focus:border-brand-dark focus:ring-0"
                                                        placeholder="/reservation"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Footer Text Restoration */}
                                <div className="mt-8">
                                    <label className="text-xs font-black text-brand-dark uppercase tracking-widest mb-2 block">Footer Text</label>
                                    <input
                                        type="text"
                                        value={settings.footerText || ''}
                                        onChange={(e) => setSettings({ ...settings, footerText: e.target.value })}
                                        className="w-full px-4 py-3 bg-white border-2 border-gray-100 rounded-2xl focus:border-brand-dark focus:ring-0 text-sm font-bold"
                                        placeholder="e.g. © 2024 Your Business Name"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="pt-4 border-t border-gray-100">
                            <SubmitButton isLoading={saving} label="Save Changes" className="w-full bg-brand-dark text-white py-4 rounded-3xl font-black uppercase tracking-widest hover:bg-brand-dark/90 transition-all shadow-lg active:scale-[0.98]" />
                        </div>
                    </form>
                </div>

                {/* Right Column: Live Site Preview */}
                <div className="sticky top-24 hidden lg:block">
                    <div className="flex items-center justify-between mb-4">
                        <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Live Site Preview</label>
                        <div className="flex gap-2">
                            <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                            <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                            <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                        </div>
                    </div>
                    <div className="bg-brand-dark rounded-[2.5rem] p-4 shadow-2xl border-[8px] border-brand-dark relative">
                        <div className="aspect-[9/19] bg-white rounded-[2rem] overflow-hidden border-4 border-brand-dark/5 shadow-inner">
                            <ThemeMockup
                                template={templatesToDisplay.find(t => t.id === settings.layoutStyle) || templatesToDisplay[0]}
                                settings={settings}
                            />
                        </div>
                        {/* Status bar mock */}
                        <div className="absolute top-6 left-1/2 -translate-x-1/2 w-20 h-4 bg-brand-dark rounded-full" />
                    </div>
                </div>
            </div>
        </div>
    );
}
