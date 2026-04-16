'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { useSite } from '@/lib/site-context';
import { Globe, GripVertical, Trash2, ChevronDown, ChevronUp, Link as LinkIcon, Plus, Check, AlertCircle, Loader2 } from 'lucide-react';
import { InlinePanelIconPicker } from '@/components/admin/IconSelector';
import { ICON_MAP } from '@/data/icons';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function SortableNavItem({
    item,
    onRemove,
    onUpdate,
    onOpenIconPicker,
    forms,
    pages,
}: {
    item: any;
    onRemove: () => void;
    onUpdate: (field: string, val: string) => void;
    onOpenIconPicker: (currentIcon: string, onSelect: (icon: string) => void) => void;
    forms: any[];
    pages: any[];
}) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id });
    const style = { transform: CSS.Transform.toString(transform), transition };
    const [isExpanded, setIsExpanded] = useState(false);

    const Icon = item.icon && ICON_MAP[item.icon as keyof typeof ICON_MAP]
        ? ICON_MAP[item.icon as keyof typeof ICON_MAP]
        : LinkIcon;

    return (
        <div ref={setNodeRef} style={style} className="bg-gray-100 dark:bg-neutral-800 rounded-lg border border-gray-200 dark:border-neutral-700 overflow-hidden mb-2">
            <div className="flex items-center justify-between px-3 py-2 bg-gray-100/80 dark:bg-neutral-800/80">
                <div className="flex items-center gap-2">
                    <div
                        {...attributes}
                        {...listeners}
                        className="text-neutral-400 dark:text-neutral-600 hover:text-neutral-700 dark:hover:text-neutral-400 cursor-grab active:cursor-grabbing p-0.5"
                    >
                        <GripVertical size={15} />
                    </div>
                    <div className="w-6 h-6 bg-gray-200 dark:bg-neutral-700 rounded flex items-center justify-center text-neutral-700 dark:text-neutral-300">
                        <Icon size={13} />
                    </div>
                    <span className="text-sm font-medium text-neutral-900 dark:text-neutral-200 truncate max-w-[120px]">
                        {item.label || 'New Link'}
                    </span>
                    <span className="text-[10px] text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
                        {item.type === 'form' ? 'Form' : item.type === 'page' ? 'Page' : 'URL'}
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="p-1 text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
                    >
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    <button
                        type="button"
                        onClick={onRemove}
                        className="p-1 text-neutral-400 dark:text-neutral-600 hover:text-red-400 transition-colors"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>

            {isExpanded && (
                <div className="px-3 py-3 space-y-3 border-t border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-850">
                    <div>
                        <label className="block text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-1">Label</label>
                        <input
                            type="text"
                            value={item.label}
                            onChange={(e) => onUpdate('label', e.target.value)}
                            className="w-full px-3 py-1.5 text-sm bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-md text-neutral-900 dark:text-neutral-200 placeholder-neutral-400 dark:placeholder-neutral-600 focus:border-blue-500/50 focus:outline-none"
                            placeholder="e.g. Home"
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-1">Link Type</label>
                        <div className="flex gap-1">
                            {(['url', 'form', 'page'] as const).map(t => (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => onUpdate('type', t)}
                                    className={`flex-1 px-2 py-1.5 text-[10px] font-bold uppercase rounded transition-all ${
                                        (item.type === t) || (!item.type && t === 'url')
                                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                            : 'bg-gray-100 dark:bg-neutral-800 text-neutral-500 border border-gray-300 dark:border-neutral-700 hover:text-neutral-700 dark:hover:text-neutral-300'
                                    }`}
                                >
                                    {t === 'url' ? 'URL' : t}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        {item.type === 'form' ? (
                            <select
                                value={item.formId || ''}
                                onChange={(e) => onUpdate('formId', e.target.value)}
                                className="w-full px-3 py-1.5 text-sm bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-md text-neutral-900 dark:text-neutral-200 focus:border-blue-500/50 focus:outline-none"
                            >
                                <option value="">— Select Form —</option>
                                {forms.map(f => <option key={f.id} value={f.id}>{f.title}</option>)}
                            </select>
                        ) : item.type === 'page' ? (
                            <select
                                value={item.pageId || ''}
                                onChange={(e) => {
                                    const page = pages.find(p => p.id === e.target.value);
                                    onUpdate('pageId', e.target.value);
                                    if (page) onUpdate('value', `/${page.slug}`);
                                }}
                                className="w-full px-3 py-1.5 text-sm bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-md text-neutral-900 dark:text-neutral-200 focus:border-blue-500/50 focus:outline-none"
                            >
                                <option value="">— Select Page —</option>
                                {pages.map(p => <option key={p.id} value={p.id}>{p.title} (/{p.slug})</option>)}
                            </select>
                        ) : (
                            <input
                                type="text"
                                value={item.value || ''}
                                onChange={(e) => onUpdate('value', e.target.value)}
                                className="w-full px-3 py-1.5 text-sm bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-md text-neutral-900 dark:text-neutral-200 placeholder-neutral-400 dark:placeholder-neutral-600 focus:border-blue-500/50 focus:outline-none font-mono"
                                placeholder="/path or https://"
                            />
                        )}
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-1">Icon</label>
                        <button
                            type="button"
                            onClick={() => onOpenIconPicker(item.icon || '', (icon) => onUpdate('icon', icon))}
                            className="w-full flex items-center gap-2 px-3 py-1.5 bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-md hover:border-gray-400 dark:hover:border-neutral-600 transition-colors text-left"
                        >
                            <div className="w-5 h-5 flex items-center justify-center text-neutral-700 dark:text-neutral-300">
                                <Icon size={14} />
                            </div>
                            <span className="text-sm text-neutral-700 dark:text-neutral-300">{item.icon || 'Select Icon'}</span>
                            <span className="ml-auto text-[10px] text-neutral-400 dark:text-neutral-500">Change</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

function SaveStatusChip({ status }: { status: 'idle' | 'pending' | 'saving' | 'saved' | 'error' }) {
    if (status === 'idle') return null;
    return (
        <div className={`flex items-center gap-1 text-[10px] font-bold transition-all ${
            status === 'saved' ? 'text-green-400' :
            status === 'error' ? 'text-red-400' :
            'text-neutral-500'
        }`}>
            {status === 'saving' && <Loader2 size={10} className="animate-spin" />}
            {status === 'saved' && <Check size={10} />}
            {status === 'error' && <AlertCircle size={10} />}
            {status === 'pending' && <span className="w-1.5 h-1.5 rounded-full bg-neutral-500 animate-pulse inline-block" />}
            <span>
                {status === 'pending' ? 'Auto-saving…' :
                 status === 'saving' ? 'Saving…' :
                 status === 'saved' ? 'Saved' :
                 'Failed'}
            </span>
        </div>
    );
}

type PanelView =
    | { type: 'properties' }
    | { type: 'iconPicker'; currentIcon: string; onSelect: (icon: string) => void };

export function HeaderNavPanel() {
    const { siteId } = useSite();
    const [navigation, setNavigation] = useState<any>({ topNav: [], topNavActions: {}, headerStyle: {} });
    const [forms, setForms] = useState<any[]>([]);
    const [pages, setPages] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState<'idle' | 'pending' | 'saving' | 'saved' | 'error'>('idle');
    const [panelView, setPanelView] = useState<PanelView>({ type: 'properties' });
    const isFirstRender = useRef(true);
    const siteIdRef = useRef(siteId);
    useEffect(() => { siteIdRef.current = siteId; }, [siteId]);

    const openIconPicker = useCallback((currentIcon: string, onSelect: (icon: string) => void) => {
        setPanelView({ type: 'iconPicker', currentIcon, onSelect });
    }, []);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const fetchData = useCallback(async () => {
        if (!siteId) return;
        try {
            const [formsSnap, pagesSnap, settingsSnap] = await Promise.all([
                getDocs(collection(db, 'sites', siteId, 'forms')),
                getDocs(collection(db, 'sites', siteId, 'pages')),
                getDoc(doc(db, 'sites', siteId, 'content', 'siteSettings')),
            ]);
            setForms(formsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
            setPages(pagesSnap.docs.map(d => ({ id: d.id, ...d.data() })));
            if (settingsSnap.exists()) {
                const data = settingsSnap.data();
                if (data.navigation) setNavigation(data.navigation);
            }
        } catch (err) {
            console.error('Failed to load navigation:', err);
        } finally {
            setLoading(false);
        }
    }, [siteId]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const saveToFirestore = useCallback(async (nav: any) => {
        const sid = siteIdRef.current;
        if (!sid) return;
        setStatus('saving');
        try {
            const docRef = doc(db, 'sites', sid, 'content', 'siteSettings');
            const snap = await getDoc(docRef);
            const current = snap.exists() ? snap.data() : {};
            await setDoc(docRef, { ...current, navigation: { ...current.navigation, ...nav } }, { merge: true });
            setStatus('saved');
            setTimeout(() => setStatus('idle'), 2000);
        } catch (err) {
            console.error(err);
            setStatus('error');
            setTimeout(() => setStatus('idle'), 2500);
        }
    }, []);

    // Debounced auto-save on every navigation change (skip initial load)
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        setStatus('pending');
        const timer = setTimeout(() => { saveToFirestore(navigation); }, 600);
        return () => clearTimeout(timer);
    }, [navigation, saveToFirestore]);

    const generateId = () => Math.random().toString(36).substr(2, 9);

    const handleAddItem = () => {
        setNavigation((prev: any) => ({
            ...prev,
            topNav: [...(prev.topNav || []), { id: generateId(), label: 'New Link', type: 'url', value: '#', icon: 'Link' }],
        }));
    };

    const handleRemoveItem = (id: string) => {
        setNavigation((prev: any) => ({
            ...prev,
            topNav: (prev.topNav || []).filter((i: any) => i.id !== id),
        }));
    };

    const handleUpdateItem = (id: string, field: string, value: string) => {
        setNavigation((prev: any) => ({
            ...prev,
            topNav: (prev.topNav || []).map((item: any) =>
                item.id === id ? { ...item, [field]: value } : item
            ),
        }));
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            setNavigation((prev: any) => {
                const list = prev.topNav || [];
                const oldIndex = list.findIndex((i: any) => i.id === active.id);
                const newIndex = list.findIndex((i: any) => i.id === over.id);
                return { ...prev, topNav: arrayMove(list, oldIndex, newIndex) };
            });
        }
    };

    const cta = navigation?.topNavActions?.cta;
    const setCta = (updater: (prev: any) => any) => {
        setNavigation((prev: any) => ({
            ...prev,
            topNavActions: { ...prev.topNavActions, cta: updater(prev.topNavActions?.cta) },
        }));
    };

    if (panelView.type === 'iconPicker') {
        return (
            <InlinePanelIconPicker
                selectedIcon={panelView.currentIcon}
                onSelect={(icon) => {
                    panelView.onSelect(icon);
                    setPanelView({ type: 'properties' });
                }}
                onBack={() => setPanelView({ type: 'properties' })}
            />
        );
    }

    if (loading) {
        return (
            <div className="space-y-3 animate-pulse">
                <div className="h-16 bg-gray-100 dark:bg-neutral-800 rounded-lg" />
                <div className="h-10 bg-gray-100 dark:bg-neutral-800 rounded-lg" />
                <div className="h-10 bg-gray-100 dark:bg-neutral-800 rounded-lg" />
            </div>
        );
    }

    return (
        <div className="space-y-5 animate-fade-in">
            {/* Global Badge */}
            <div className="bg-blue-500/10 rounded-lg p-4 border border-blue-500/20 flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-100 dark:bg-neutral-800 rounded-full flex items-center justify-center shadow-lg text-blue-400">
                    <Globe size={20} />
                </div>
                <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-neutral-900 dark:text-neutral-200 text-sm">Header Navigation</h4>
                    <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="flex w-2 h-2 rounded-full bg-blue-500" />
                        <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Global Setting</span>
                    </div>
                </div>
                <SaveStatusChip status={status} />
            </div>

            {/* Top Nav Items */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <h5 className="text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">Nav Links</h5>
                    <button
                        type="button"
                        onClick={handleAddItem}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-lg hover:bg-blue-500/20 transition-colors"
                    >
                        <Plus size={12} /> Add
                    </button>
                </div>

                {(navigation?.topNav || []).length === 0 ? (
                    <div className="text-center py-6 text-neutral-400 dark:text-neutral-600 text-xs border border-dashed border-gray-300 dark:border-neutral-800 rounded-lg">
                        No links yet. Add one above.
                    </div>
                ) : (
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <SortableContext
                            items={(navigation?.topNav || []).map((i: any) => i.id)}
                            strategy={verticalListSortingStrategy}
                        >
                            {(navigation?.topNav || []).map((item: any) => (
                                <SortableNavItem
                                    key={item.id}
                                    item={item}
                                    forms={forms}
                                    pages={pages}
                                    onRemove={() => handleRemoveItem(item.id)}
                                    onUpdate={(field, val) => handleUpdateItem(item.id, field, val)}
                                    onOpenIconPicker={openIconPicker}
                                />
                            ))}
                        </SortableContext>
                    </DndContext>
                )}
            </div>

            {/* Appearance */}
            <div className="border-t border-gray-200 dark:border-neutral-800 pt-4 space-y-3">
                <h5 className="text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">Appearance</h5>
                <div>
                    <label className="block text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-1">Background Color</label>
                    <div className="flex items-center gap-2">
                        <label
                            className="w-8 h-8 rounded-lg border border-gray-400 dark:border-neutral-600 cursor-pointer overflow-hidden flex-shrink-0 relative"
                            style={{ backgroundColor: navigation.headerStyle?.bgColor || '#ffffff' }}
                        >
                            <input
                                type="color"
                                value={navigation.headerStyle?.bgColor || '#ffffff'}
                                onChange={(e) => setNavigation((prev: any) => ({ ...prev, headerStyle: { ...prev.headerStyle, bgColor: e.target.value } }))}
                                className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                            />
                        </label>
                        <input
                            type="text"
                            value={navigation.headerStyle?.bgColor || ''}
                            onChange={(e) => setNavigation((prev: any) => ({ ...prev, headerStyle: { ...prev.headerStyle, bgColor: e.target.value } }))}
                            placeholder="e.g. #ffffff  (empty = theme default)"
                            className="flex-1 px-3 py-1.5 bg-gray-100 dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded-lg text-xs text-neutral-900 dark:text-neutral-200 placeholder-neutral-400 dark:placeholder-neutral-600 outline-none focus:border-blue-500 font-mono"
                        />
                        {navigation.headerStyle?.bgColor && (
                            <button
                                type="button"
                                onClick={() => setNavigation((prev: any) => ({ ...prev, headerStyle: { ...prev.headerStyle, bgColor: undefined } }))}
                                className="text-neutral-400 hover:text-red-400 transition-colors text-xs px-1 font-bold"
                            >×</button>
                        )}
                    </div>
                </div>
                <div className="flex items-center justify-between">
                    <div>
                        <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">Show Border Bottom</span>
                        <p className="text-[10px] text-neutral-400 dark:text-neutral-600 mt-0.5">Uses theme border token</p>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <span className="text-xs text-neutral-400 dark:text-neutral-500">{navigation.headerStyle?.showBorder ? 'On' : 'Off'}</span>
                        <div className={`relative inline-flex h-5 w-9 rounded-full border-2 border-transparent transition-colors ${navigation.headerStyle?.showBorder ? 'bg-blue-500' : 'bg-gray-300 dark:bg-neutral-700'}`}>
                            <input
                                type="checkbox"
                                className="sr-only"
                                checked={!!navigation.headerStyle?.showBorder}
                                onChange={(e) => setNavigation((prev: any) => ({ ...prev, headerStyle: { ...prev.headerStyle, showBorder: e.target.checked } }))}
                            />
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ${navigation.headerStyle?.showBorder ? 'translate-x-4' : 'translate-x-0'}`} />
                        </div>
                    </label>
                </div>
            </div>

            {/* CTA Button */}
            <div className="border-t border-gray-200 dark:border-neutral-800 pt-4 space-y-3">
                <div className="flex items-center justify-between">
                    <h5 className="text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">CTA Button</h5>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <span className="text-xs text-neutral-400 dark:text-neutral-500">{cta?.enabled ? 'On' : 'Off'}</span>
                        <div className={`relative inline-flex h-5 w-9 rounded-full border-2 border-transparent transition-colors ${cta?.enabled ? 'bg-blue-500' : 'bg-gray-300 dark:bg-neutral-700'}`}>
                            <input
                                type="checkbox"
                                className="sr-only"
                                checked={cta?.enabled || false}
                                onChange={(e) => setCta(prev => ({
                                    enabled: e.target.checked,
                                    label: prev?.label || 'Order Now',
                                    linkType: prev?.linkType || 'url',
                                    linkValue: prev?.linkValue || '#',
                                    formId: prev?.formId || null,
                                    pageId: prev?.pageId || null,
                                }))}
                            />
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ${cta?.enabled ? 'translate-x-4' : 'translate-x-0'}`} />
                        </div>
                    </label>
                </div>

                {cta?.enabled && (
                    <div className="space-y-3 animate-fade-in">
                        <div>
                            <label className="block text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-1">Button Label</label>
                            <input
                                type="text"
                                value={cta?.label || ''}
                                onChange={(e) => setCta(prev => ({ ...prev, label: e.target.value }))}
                                className="w-full px-3 py-2 text-sm bg-gray-100 dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-neutral-200 placeholder-neutral-400 dark:placeholder-neutral-600 focus:border-blue-500/50 focus:outline-none"
                                placeholder="e.g. Order Now"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-1">Link Type</label>
                            <div className="flex gap-1">
                                {(['url', 'form', 'page'] as const).map(t => (
                                    <button
                                        key={t}
                                        type="button"
                                        onClick={() => setCta(prev => ({ ...prev, linkType: t, linkValue: '', formId: null, pageId: null }))}
                                        className={`flex-1 px-2 py-1.5 text-[10px] font-bold uppercase rounded transition-all ${
                                            cta?.linkType === t
                                                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                                : 'bg-neutral-800 text-neutral-500 border border-neutral-700 hover:text-neutral-300'
                                        }`}
                                    >
                                        {t === 'url' ? 'URL' : t}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            {cta?.linkType === 'form' ? (
                                <select
                                    value={cta?.formId || ''}
                                    onChange={(e) => setCta(prev => ({ ...prev, formId: e.target.value, linkValue: e.target.value }))}
                                    className="w-full px-3 py-2 text-sm bg-gray-100 dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-neutral-200 focus:border-blue-500/50 focus:outline-none"
                                >
                                    <option value="">— Select Form —</option>
                                    {forms.map(f => <option key={f.id} value={f.id}>{f.title}</option>)}
                                </select>
                            ) : cta?.linkType === 'page' ? (
                                <select
                                    value={cta?.pageId || ''}
                                    onChange={(e) => {
                                        const p = pages.find(pg => pg.id === e.target.value);
                                        setCta(prev => ({ ...prev, pageId: e.target.value, linkValue: p ? `/${p.slug}` : '' }));
                                    }}
                                    className="w-full px-3 py-2 text-sm bg-gray-100 dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-neutral-200 focus:border-blue-500/50 focus:outline-none"
                                >
                                    <option value="">— Select Page —</option>
                                    {pages.map(p => <option key={p.id} value={p.id}>{p.title} (/{p.slug})</option>)}
                                </select>
                            ) : (
                                <input
                                    type="text"
                                    value={cta?.linkValue || ''}
                                    onChange={(e) => setCta(prev => ({ ...prev, linkValue: e.target.value }))}
                                    className="w-full px-3 py-2 text-sm bg-gray-100 dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-neutral-200 placeholder-neutral-400 dark:placeholder-neutral-600 focus:border-blue-500/50 focus:outline-none font-mono"
                                    placeholder="https://..."
                                />
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
