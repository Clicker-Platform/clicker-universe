'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { GripVertical, Trash2, ChevronDown, ChevronUp, Link as LinkIcon } from 'lucide-react';
import { SubmitButton } from '@/components/admin/SubmitButton';
import { IconSelector } from '@/components/admin/IconSelector';
import { ICON_MAP } from '@/data/icons';
import { useSite } from '@/lib/site-context';

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

function SortableNavItem({ item, onRemove, onUpdate, forms, pages }: { item: any, onRemove: () => void, onUpdate: (field: string, val: string) => void, forms: any[], pages: any[] }) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id });
    const style = { transform: CSS.Transform.toString(transform), transition };
    const [isExpanded, setIsExpanded] = useState(false);
    const [showIconSelector, setShowIconSelector] = useState(false);

    const Icon = item.icon && ICON_MAP[item.icon as keyof typeof ICON_MAP] ? ICON_MAP[item.icon as keyof typeof ICON_MAP] : LinkIcon;

    return (
        <div ref={setNodeRef} style={style} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-2 transition-all hover:border-gray-300 group">
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

                        <div className="col-span-1 md:col-span-2">
                            {item.type === 'form' ? (
                                <div>
                                    <label className="text-xs font-bold text-purple-600 uppercase mb-1.5 block tracking-wider">Select Form</label>
                                    <select
                                        value={item.formId || ''}
                                        onChange={(e) => onUpdate('formId', e.target.value)}
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
                                        value={item.value || ''}
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
    const Icon = currentIcon && ICON_MAP[currentIcon as keyof typeof ICON_MAP] ? ICON_MAP[currentIcon as keyof typeof ICON_MAP] : LinkIcon;

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

export default function NavigationClient() {
    const { siteId } = useSite();
    const [navigation, setNavigation] = useState<any>({ topNav: [], bottomNav: [] });
    const [forms, setForms] = useState<any[]>([]);
    const [pages, setPages] = useState<any[]>([]);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');
    const [messageType, setMessageType] = useState<'success' | 'error' | ''>('');

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    useEffect(() => {
        if (!siteId) return;

        const fetchResourcesAndSettings = async () => {
            try {
                const [formsSnap, pagesSnap, settingsSnap] = await Promise.all([
                    getDocs(collection(db, 'sites', siteId, 'forms')),
                    getDocs(collection(db, 'sites', siteId, 'pages')),
                    getDoc(doc(db, 'sites', siteId, 'content', 'siteSettings'))
                ]);
                
                setForms(formsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() })));
                setPages(pagesSnap.docs.map((d: any) => ({ id: d.id, ...d.data() })));
                
                if (settingsSnap.exists()) {
                    const data = settingsSnap.data();
                    if (data.navigation) {
                        setNavigation(data.navigation);
                    }
                }
            } catch (err) {
                console.error("Failed to load navigation resources:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchResourcesAndSettings();
    }, [siteId]);

    const generateId = () => Math.random().toString(36).substr(2, 9);

    const handleAddNavItem = (list: 'top' | 'bottom') => {
        const newItem: any = {
            id: generateId(),
            label: 'New Link',
            type: 'link',
            value: '#',
            icon: 'Link'
        };

        setNavigation((prev: any) => ({
            ...prev,
            topNav: list === 'top' ? [...(prev.topNav || []), newItem] : (prev.topNav || []),
            bottomNav: list === 'bottom' ? [...(prev.bottomNav || []), newItem] : (prev.bottomNav || []),
        }));
    };

    const handleRemoveNavItem = (list: 'top' | 'bottom', id: string) => {
        setNavigation((prev: any) => ({
            ...prev,
            topNav: list === 'top' ? (prev.topNav || []).filter((i: any) => i.id !== id) : (prev.topNav || []),
            bottomNav: list === 'bottom' ? (prev.bottomNav || []).filter((i: any) => i.id !== id) : (prev.bottomNav || []),
        }));
    };

    const handleUpdateNavItem = (list: 'top' | 'bottom', id: string, field: string, value: string) => {
        const updateList = (items: any[]) => items.map(item => item.id === id ? { ...item, [field]: value } : item);

        setNavigation((prev: any) => ({
            ...prev,
            topNav: list === 'top' ? updateList(prev.topNav || []) : (prev.topNav || []),
            bottomNav: list === 'bottom' ? updateList(prev.bottomNav || []) : (prev.bottomNav || []),
        }));
    };

    const handleNavDragEnd = (event: DragEndEvent, listKey: 'topNav' | 'bottomNav') => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            setNavigation((prev: any) => {
                const list = prev[listKey] || [];
                const oldIndex = list.findIndex((i: any) => i.id === active.id);
                const newIndex = list.findIndex((i: any) => i.id === over.id);

                return {
                    ...prev,
                    [listKey]: arrayMove(list, oldIndex, newIndex)
                };
            });
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            // We need to fetch the existing settings first to only update `navigation` property
            const docRef = doc(db, 'sites', siteId, 'content', 'siteSettings');
            const snap = await getDoc(docRef);
            if (snap.exists()) {
                const currentSettings = snap.data();
                await setDoc(docRef, { ...currentSettings, navigation }, { merge: true });
            } else {
                 await setDoc(docRef, { navigation }, { merge: true });
            }
            setMessage('Navigation saved successfully!');
            setMessageType('success');
            setTimeout(() => setMessage(''), 3000);
        } catch (err) {
            console.error(err);
            setMessage('Failed to save navigation.');
            setMessageType('error');
            setTimeout(() => setMessage(''), 3000);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="p-8 max-w-4xl mx-auto space-y-8 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black text-brand-dark mb-2 tracking-tight">Navigation Settings</h1>
                    <p className="text-gray-500 text-lg">Manage your site's menus and floating buttons.</p>
                </div>
                <SubmitButton
                    isLoading={saving}
                    label="Save Navigation"
                    form="navigation-form"
                    className="bg-brand-dark text-white px-6 py-3 rounded-xl font-black hover:bg-brand-dark/90 transition-all shadow-sm active:scale-[0.98] whitespace-nowrap"
                />
            </div>

            {message && (
                <div className={`p-4 rounded-xl text-sm font-bold flex items-center justify-between ${messageType === 'success' ? 'bg-brand-green/20 text-brand-dark' : 'bg-red-50 text-red-600'}`}>
                    <span>{message}</span>
                    <button onClick={() => setMessage('')} className="ml-4 opacity-50 hover:opacity-100">×</button>
                </div>
            )}

            <form id="navigation-form" onSubmit={handleSave} className="space-y-8">
                {/* Top Navigation */}
                <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-xl font-black text-brand-dark block">Top Navigation</h2>
                            <p className="text-sm text-gray-500">Links shown in header or side menu</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => handleAddNavItem('top')}
                            className="text-sm font-bold text-brand-dark bg-brand-green/20 hover:bg-brand-green px-4 py-2 rounded-xl transition-colors"
                        >
                            + Add Link
                        </button>
                    </div>
                    <div className="space-y-3">
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleNavDragEnd(e, 'topNav')}>
                            <SortableContext items={(navigation?.topNav || []).map((i: any) => i.id)} strategy={verticalListSortingStrategy}>
                                {(navigation?.topNav || []).map((item: any) => (
                                    <SortableNavItem
                                        key={item.id}
                                        item={item}
                                        forms={forms}
                                        pages={pages}
                                        onRemove={() => handleRemoveNavItem('top', item.id)}
                                        onUpdate={(field, val) => handleUpdateNavItem('top', item.id, field, val)}
                                    />
                                ))}
                            </SortableContext>
                        </DndContext>
                        {(!navigation?.topNav || navigation.topNav.length === 0) && (
                            <div className="text-gray-400 text-sm italic text-center py-8 border border-dashed border-gray-200 rounded-2xl">
                                No links yet. Add one to get started.
                            </div>
                        )}
                    </div>
                </div>

                {/* Top Navigation Actions (CTA) */}
                <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-8">
                    <label className="block text-brand-dark font-black text-lg mb-4 flex items-center gap-2">
                        <span className="bg-brand-green/20 text-brand-dark p-1 rounded-md text-[10px] uppercase tracking-wider">Feature</span>
                        Header Action Button
                    </label>

                    <div className="space-y-4">
                        <label className="flex items-center gap-3 cursor-pointer">
                            <div className={`
                                relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none 
                                ${navigation?.topNavActions?.cta?.enabled ? 'bg-brand-dark' : 'bg-gray-200'}
                            `}>
                                <input
                                    type="checkbox"
                                    className="sr-only"
                                    checked={navigation?.topNavActions?.cta?.enabled || false}
                                    onChange={(e) => {
                                        setNavigation((prev: any) => {
                                            const currentCta = prev.topNavActions?.cta;
                                            return {
                                                ...prev,
                                                topNavActions: {
                                                    ...prev.topNavActions,
                                                    cta: {
                                                        enabled: e.target.checked,
                                                        label: currentCta?.label || 'Order Now',
                                                        linkType: currentCta?.linkType || 'url',
                                                        linkValue: currentCta?.linkValue || '#',
                                                        formId: currentCta?.formId || null,
                                                        pageId: currentCta?.pageId || null
                                                    }
                                                }
                                            };
                                        })
                                    }}
                                />
                                <span className={`
                                    pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out
                                    ${navigation?.topNavActions?.cta?.enabled ? 'translate-x-5' : 'translate-x-0'}
                                `} />
                            </div>
                            <span className="font-bold text-gray-700 text-sm">Show CTA Button (e.g. Order)</span>
                        </label>

                        {navigation?.topNavActions?.cta?.enabled && (
                            <div className="pl-14 space-y-4 animate-fade-in-up">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Button Label</label>
                                    <input
                                        type="text"
                                        value={navigation?.topNavActions?.cta?.label || ''}
                                        onChange={(e) => setNavigation((prev: any) => ({
                                            ...prev,
                                            topNavActions: {
                                                ...prev.topNavActions,
                                                cta: { ...prev.topNavActions?.cta, label: e.target.value }
                                            }
                                        }))}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green outline-none"
                                        placeholder="e.g. Order Now"
                                    />
                                </div>

                                <div className="grid grid-cols-3 gap-2">
                                    {(['url', 'form', 'page'] as const).map(t => (
                                        <button
                                            key={t}
                                            type="button"
                                            onClick={() => setNavigation((prev: any) => ({
                                                ...prev,
                                                topNavActions: {
                                                    ...prev.topNavActions,
                                                    cta: {
                                                        ...prev.topNavActions?.cta,
                                                        linkType: t,
                                                        linkValue: '',
                                                        formId: null,
                                                        pageId: null
                                                    }
                                                }
                                            }))}
                                            className={`
                                                px-3 py-2 text-xs font-bold uppercase rounded-xl border transition-all tracking-wider
                                                ${navigation?.topNavActions?.cta?.linkType === t
                                                    ? 'bg-brand-dark text-white border-brand-dark shadow-sm'
                                                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}
                                            `}
                                        >
                                            {t === 'url' ? 'Link' : t}
                                        </button>
                                    ))}
                                </div>

                                <div>
                                    {navigation?.topNavActions?.cta?.linkType === 'url' && (
                                        <input
                                            type="text"
                                            placeholder="https://..."
                                            value={navigation?.topNavActions?.cta?.linkValue || ''}
                                            onChange={(e) => setNavigation((prev: any) => ({
                                                ...prev,
                                                topNavActions: {
                                                    ...prev.topNavActions,
                                                    cta: { ...prev.topNavActions?.cta, linkValue: e.target.value }
                                                }
                                            }))}
                                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green outline-none"
                                        />
                                    )}

                                    {navigation?.topNavActions?.cta?.linkType === 'form' && (
                                        <select
                                            value={navigation?.topNavActions?.cta?.formId || ''}
                                            onChange={(e) => setNavigation((prev: any) => ({
                                                ...prev,
                                                topNavActions: {
                                                    ...prev.topNavActions,
                                                    cta: {
                                                        ...prev.topNavActions?.cta,
                                                        formId: e.target.value,
                                                        linkValue: e.target.value
                                                    }
                                                }
                                            }))}
                                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green outline-none appearance-none"
                                        >
                                            <option value="">Select a Form...</option>
                                            {forms.map(f => <option key={f.id} value={f.id}>{f.title}</option>)}
                                        </select>
                                    )}

                                    {navigation?.topNavActions?.cta?.linkType === 'page' && (
                                        <select
                                            value={navigation?.topNavActions?.cta?.pageId || ''}
                                            onChange={(e) => {
                                                const p = pages.find(pg => pg.id === e.target.value);
                                                setNavigation((prev: any) => ({
                                                    ...prev,
                                                    topNavActions: {
                                                        ...prev.topNavActions,
                                                        cta: {
                                                            ...prev.topNavActions?.cta,
                                                            pageId: e.target.value,
                                                            linkValue: p ? `/${p.slug}` : ''
                                                        }
                                                    }
                                                }))
                                            }}
                                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green outline-none appearance-none"
                                        >
                                            <option value="">Select a Page...</option>
                                            {pages.map(p => <option key={p.id} value={p.id}>{p.title} (/{p.slug})</option>)}
                                        </select>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Bottom Navigation */}
                <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="block text-brand-dark font-black text-xl mb-1">Bottom Navigation</h2>
                            <p className="text-sm text-gray-500">Ideally 3-5 items for mobile app bars.</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => handleAddNavItem('bottom')}
                            className="text-sm font-bold text-brand-dark bg-brand-green/20 hover:bg-brand-green px-4 py-2 rounded-xl transition-colors"
                        >
                            + Add Link
                        </button>
                    </div>
                    <div className="space-y-3">
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleNavDragEnd(e, 'bottomNav')}>
                            <SortableContext items={(navigation?.bottomNav || []).map((i: any) => i.id)} strategy={verticalListSortingStrategy}>
                                {(navigation?.bottomNav || []).map((item: any) => (
                                    <SortableNavItem
                                        key={item.id}
                                        item={item}
                                        forms={forms}
                                        pages={pages}
                                        onRemove={() => handleRemoveNavItem('bottom', item.id)}
                                        onUpdate={(field, val) => handleUpdateNavItem('bottom', item.id, field, val)}
                                    />
                                ))}
                            </SortableContext>
                        </DndContext>
                        {(!navigation?.bottomNav || navigation.bottomNav.length === 0) && (
                            <div className="text-gray-400 text-sm italic text-center py-8 border border-dashed border-gray-200 rounded-2xl">
                                No bottom links configured. Add one to get started.
                            </div>
                        )}
                    </div>
                </div>

                {/* Center Floating Action Button (FAB) */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <p className="font-black text-brand-dark text-lg">Center FAB Button</p>
                            <p className="text-sm text-gray-500">Floating action button in bottom nav</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={!!navigation?.fab?.enabled}
                                onChange={(e) => {
                                    const isEnabled = e.target.checked;
                                    setNavigation((prev: any) => {
                                        const currentFab = prev.fab;
                                        const newFab = currentFab
                                            ? { ...currentFab, enabled: isEnabled }
                                            : { id: 'fab', label: '', type: 'url' as const, value: '#', icon: 'PlusCircle', enabled: isEnabled };

                                        return {
                                            ...prev,
                                            fab: newFab
                                        };
                                    });
                                }}
                            />
                            <div className="w-14 h-8 bg-gray-200 peer-checked:bg-brand-dark rounded-full peer-focus:ring-2 peer-focus:ring-brand-green/20 after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:after:translate-x-[24px]"></div>
                        </label>
                    </div>
                    {navigation?.fab?.enabled && (
                        <div className="space-y-5 pt-5 border-t border-gray-100 animate-fade-in-up">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Link Type</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {(['url', 'form', 'page'] as const).map(t => (
                                        <button
                                            key={t}
                                            type="button"
                                            onClick={() => setNavigation((prev: any) => ({
                                                ...prev,
                                                fab: { ...prev.fab!, type: t, formId: null, pageId: null }
                                            }))}
                                            className={`px-3 py-2.5 text-xs font-bold rounded-xl border uppercase tracking-wider ${navigation?.fab?.type === t ? 'bg-brand-dark text-white border-brand-dark shadow-sm' : 'bg-white text-gray-500 border-gray-200'}`}
                                        >
                                            {t === 'url' ? 'Link' : t}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Destination</label>
                                {navigation?.fab?.type === 'form' ? (
                                    <select
                                        value={navigation.fab.formId || ''}
                                        onChange={(e) => setNavigation((prev: any) => ({ ...prev, fab: { ...prev.fab!, formId: e.target.value } }))}
                                        className="w-full px-4 py-3 text-sm font-bold border border-gray-200 rounded-xl bg-gray-50 appearance-none outline-none focus:ring-2 focus:ring-brand-green/20"
                                    >
                                        <option value="">Select Form...</option>
                                        {forms.map(f => <option key={f.id} value={f.id}>{f.title}</option>)}
                                    </select>
                                ) : navigation?.fab?.type === 'page' ? (
                                    <select
                                        value={navigation.fab.pageId || ''}
                                        onChange={(e) => {
                                            const p = pages.find(pg => pg.id === e.target.value);
                                            setNavigation((prev: any) => ({ ...prev, fab: { ...prev.fab!, pageId: e.target.value, value: p ? `/${p.slug}` : '#' } }));
                                        }}
                                        className="w-full px-4 py-3 text-sm font-bold border border-gray-200 rounded-xl bg-gray-50 appearance-none outline-none focus:ring-2 focus:ring-brand-green/20"
                                    >
                                        <option value="">Select Page...</option>
                                        {pages.map(p => <option key={p.id} value={p.id}>{p.title} (/{p.slug})</option>)}
                                    </select>
                                ) : (
                                    <input
                                        type="text"
                                        value={navigation?.fab?.value || ''}
                                        onChange={(e) => setNavigation((prev: any) => ({ ...prev, fab: { ...prev.fab!, value: e.target.value } }))}
                                        className="w-full px-4 py-3 text-sm font-bold border border-gray-200 rounded-xl bg-gray-50 outline-none focus:ring-2 focus:ring-brand-green/20"
                                        placeholder="https://example.com or /path"
                                    />
                                )}
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Icon</label>
                                <NavIconPicker
                                    currentIcon={navigation?.fab?.icon || 'PlusCircle'}
                                    onSelect={(icon) => setNavigation((prev: any) => ({
                                        ...prev,
                                        fab: { ...prev.fab!, icon }
                                    }))}
                                />
                            </div>
                        </div>
                    )}
                </div>

            </form>
        </div>
    );
}
