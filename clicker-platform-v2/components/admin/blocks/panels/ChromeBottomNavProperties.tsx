'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { useSite } from '@/lib/site-context';
import { Navigation, Link as LinkIcon, Plus, Check, AlertCircle, Loader2 } from 'lucide-react';
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
} from '@dnd-kit/sortable';
import { SortableNavItem } from './shared/SortableNavItem';
import { SelectMenu } from '../forms/SelectMenu';

function FabIconPicker({ currentIcon, onSelect, onOpenIconPicker }: { currentIcon: string; onSelect: (icon: string) => void; onOpenIconPicker: (currentIcon: string, onSelect: (icon: string) => void) => void }) {
    const Icon = currentIcon && ICON_MAP[currentIcon as keyof typeof ICON_MAP]
        ? ICON_MAP[currentIcon as keyof typeof ICON_MAP]
        : LinkIcon;

    return (
        <button
            type="button"
            onClick={() => onOpenIconPicker(currentIcon, onSelect)}
            className="w-full flex items-center gap-2 px-3 py-1.5 bg-neutral-900 border border-neutral-700 rounded-md hover:border-neutral-600 transition-colors text-left"
        >
            <div className="w-5 h-5 flex items-center justify-center text-neutral-300">
                <Icon size={14} />
            </div>
            <span className="text-sm text-neutral-700 dark:text-neutral-300">{currentIcon || 'Select Icon'}</span>
            <span className="ml-auto text-[10px] text-neutral-500">Change</span>
        </button>
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

export function ChromeBottomNavProperties() {
    const { siteId } = useSite();
    const [navigation, setNavigation] = useState<any>({ bottomNav: [], fab: null, bottomNavStyle: {} });
    const [forms, setForms] = useState<any[]>([]);
    const [pages, setPages] = useState<any[]>([]);
    const [homepageSlug, setHomepageSlug] = useState<string>('home');
    const [loading, setLoading] = useState(true);
    const [hydrated, setHydrated] = useState(false);
    const [status, setStatus] = useState<'idle' | 'pending' | 'saving' | 'saved' | 'error'>('idle');
    const [panelView, setPanelView] = useState<PanelView>({ type: 'properties' });
    const siteIdRef = useRef(siteId);
    const hydratedSiteIdRef = useRef<string | null>(null);
    const lastSavedSnapshotRef = useRef<string | null>(null);
    useEffect(() => { siteIdRef.current = siteId; }, [siteId]);

    const openIconPicker = useCallback((currentIcon: string, onSelect: (icon: string) => void) => {
        setPanelView({ type: 'iconPicker', currentIcon, onSelect });
    }, []);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    useEffect(() => {
        if (!siteId) return;
        let cancelled = false;
        setHydrated(false);
        setLoading(true);
        hydratedSiteIdRef.current = null;

        (async () => {
            try {
                const [formsSnap, pagesSnap, settingsSnap] = await Promise.all([
                    getDocs(collection(db, 'sites', siteId, 'forms')),
                    getDocs(collection(db, 'sites', siteId, 'pages')),
                    getDoc(doc(db, 'sites', siteId, 'content', 'siteSettings')),
                ]);
                if (cancelled) return;
                setForms(formsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
                setPages(pagesSnap.docs.map(d => ({ id: d.id, ...d.data() })));
                let loaded: any;
                if (settingsSnap.exists()) {
                    const data = settingsSnap.data();
                    if (data.homepageSlug) setHomepageSlug(data.homepageSlug);
                    const nav = data.navigation || {};
                    // Only hold the keys this panel owns; avoid round-tripping unrelated keys (topNav/topNavActions/headerStyle)
                    // which would otherwise let a stale copy here clobber edits made by HeaderNavPanel.
                    loaded = {
                        bottomNav: nav.bottomNav || [],
                        fab: nav.fab ?? null,
                        bottomNavStyle: nav.bottomNavStyle || {},
                    };
                } else {
                    loaded = { bottomNav: [], fab: null, bottomNavStyle: {} };
                }
                setNavigation(loaded);
                lastSavedSnapshotRef.current = JSON.stringify(loaded);
                hydratedSiteIdRef.current = siteId;
                setHydrated(true);
            } catch (err) {
                if (!cancelled) console.error('Failed to load navigation:', err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, [siteId]);

    const saveToFirestore = useCallback(async (nav: any) => {
        const sid = siteIdRef.current;
        if (!sid) return;
        if (hydratedSiteIdRef.current !== sid) return;
        const snapshot = JSON.stringify(nav);
        if (snapshot === lastSavedSnapshotRef.current) return;
        setStatus('saving');
        try {
            const docRef = doc(db, 'sites', sid, 'content', 'siteSettings');
            await setDoc(docRef, { navigation: nav }, { merge: true });
            lastSavedSnapshotRef.current = snapshot;
            setStatus('saved');
            setTimeout(() => setStatus('idle'), 2000);
        } catch (err) {
            console.error(err);
            setStatus('error');
            setTimeout(() => setStatus('idle'), 2500);
        }
    }, []);

    // Debounced auto-save — only fires after the panel has hydrated from Firestore for the current site
    // AND only if the navigation differs from the last value persisted to Firestore.
    // On unmount/dependency-change, flush the pending value so a closed-while-typing edit is not lost.
    useEffect(() => {
        if (!hydrated) return;
        if (hydratedSiteIdRef.current !== siteId) return;
        if (JSON.stringify(navigation) === lastSavedSnapshotRef.current) return;
        setStatus('pending');
        let fired = false;
        const timer = setTimeout(() => { fired = true; saveToFirestore(navigation); }, 600);
        return () => {
            clearTimeout(timer);
            if (!fired) saveToFirestore(navigation);
        };
    }, [navigation, hydrated, siteId, saveToFirestore]);

    const generateId = () => Math.random().toString(36).substr(2, 9);

    const handleAddItem = () => {
        setNavigation((prev: any) => ({
            ...prev,
            bottomNav: [...(prev.bottomNav || []), { id: generateId(), label: 'New Link', type: 'page', value: '', icon: 'Link' }],
        }));
    };

    const handleRemoveItem = (id: string) => {
        setNavigation((prev: any) => ({
            ...prev,
            bottomNav: (prev.bottomNav || []).filter((i: any) => i.id !== id),
        }));
    };

    const handleUpdateItem = (id: string, fieldOrPatch: string | Record<string, string>, value?: string) => {
        const patch = typeof fieldOrPatch === 'string' ? { [fieldOrPatch]: value as string } : fieldOrPatch;
        setNavigation((prev: any) => ({
            ...prev,
            bottomNav: (prev.bottomNav || []).map((item: any) =>
                item.id === id ? { ...item, ...patch } : item
            ),
        }));
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            setNavigation((prev: any) => {
                const list = prev.bottomNav || [];
                const oldIndex = list.findIndex((i: any) => i.id === active.id);
                const newIndex = list.findIndex((i: any) => i.id === over.id);
                return { ...prev, bottomNav: arrayMove(list, oldIndex, newIndex) };
            });
        }
    };

    const setFab = (updater: (prev: any) => any) => {
        setNavigation((prev: any) => ({ ...prev, fab: updater(prev.fab) }));
    };

    const fab = navigation?.fab;

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
                    <Navigation size={20} />
                </div>
                <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-neutral-900 dark:text-neutral-200 text-sm">Bottom Navigation</h4>
                    <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="flex w-2 h-2 rounded-full bg-blue-500" />
                        <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Global Setting</span>
                    </div>
                </div>
                <SaveStatusChip status={status} />
            </div>

            {/* Bottom Nav Items */}
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

                {(navigation?.bottomNav || []).length === 0 ? (
                    <div className="text-center py-6 text-neutral-400 dark:text-neutral-600 text-xs border border-dashed border-gray-300 dark:border-neutral-800 rounded-lg">
                        No links yet. Add one above.
                    </div>
                ) : (
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <SortableContext
                            items={(navigation?.bottomNav || []).map((i: any) => i.id)}
                            strategy={verticalListSortingStrategy}
                        >
                            {(navigation?.bottomNav || []).map((item: any) => (
                                <SortableNavItem
                                    key={item.id}
                                    item={item}
                                    forms={forms}
                                    pages={pages}
                                    homepageSlug={homepageSlug}
                                    onRemove={() => handleRemoveItem(item.id)}
                                    onUpdate={(fieldOrPatch, val) => handleUpdateItem(item.id, fieldOrPatch as any, val)}
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
                            style={{ backgroundColor: navigation.bottomNavStyle?.bgColor || '#ffffff' }}
                        >
                            <input
                                type="color"
                                value={navigation.bottomNavStyle?.bgColor || '#ffffff'}
                                onChange={(e) => setNavigation((prev: any) => ({ ...prev, bottomNavStyle: { ...prev.bottomNavStyle, bgColor: e.target.value } }))}
                                className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                            />
                        </label>
                        <input
                            type="text"
                            value={navigation.bottomNavStyle?.bgColor || ''}
                            onChange={(e) => setNavigation((prev: any) => ({ ...prev, bottomNavStyle: { ...prev.bottomNavStyle, bgColor: e.target.value } }))}
                            placeholder="e.g. #ffffff  (empty = theme default)"
                            className="flex-1 px-3 py-1.5 bg-gray-100 dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded-lg text-xs text-neutral-900 dark:text-neutral-200 placeholder-neutral-400 dark:placeholder-neutral-600 outline-none focus:border-blue-500 font-mono"
                        />
                        {navigation.bottomNavStyle?.bgColor && (
                            <button
                                type="button"
                                onClick={() => setNavigation((prev: any) => ({ ...prev, bottomNavStyle: { ...prev.bottomNavStyle, bgColor: undefined } }))}
                                className="text-neutral-400 hover:text-red-400 transition-colors text-xs px-1 font-bold"
                            >×</button>
                        )}
                    </div>
                </div>
                <div className="flex items-center justify-between">
                    <div>
                        <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">Show Border Top</span>
                        <p className="text-[10px] text-neutral-400 dark:text-neutral-600 mt-0.5">Uses theme border token</p>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <span className="text-xs text-neutral-400 dark:text-neutral-500">{navigation.bottomNavStyle?.showBorder ? 'On' : 'Off'}</span>
                        <div className={`relative inline-flex h-5 w-9 rounded-full border-2 border-transparent transition-colors ${navigation.bottomNavStyle?.showBorder ? 'bg-blue-500' : 'bg-gray-300 dark:bg-neutral-700'}`}>
                            <input
                                type="checkbox"
                                className="sr-only"
                                checked={!!navigation.bottomNavStyle?.showBorder}
                                onChange={(e) => setNavigation((prev: any) => ({ ...prev, bottomNavStyle: { ...prev.bottomNavStyle, showBorder: e.target.checked } }))}
                            />
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ${navigation.bottomNavStyle?.showBorder ? 'translate-x-4' : 'translate-x-0'}`} />
                        </div>
                    </label>
                </div>
            </div>

            {/* FAB Section */}
            <div className="border-t border-gray-200 dark:border-neutral-800 pt-4 space-y-3">
                <div className="flex items-center justify-between">
                    <div>
                        <h5 className="text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">Center FAB Button</h5>
                        <p className="text-[10px] text-neutral-400 dark:text-neutral-600 mt-0.5">Floating action button in center of bottom bar</p>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <span className="text-xs text-neutral-400 dark:text-neutral-500">{fab?.enabled ? 'On' : 'Off'}</span>
                        <div className={`relative inline-flex h-5 w-9 rounded-full border-2 border-transparent transition-colors ${fab?.enabled ? 'bg-blue-500' : 'bg-gray-300 dark:bg-neutral-700'}`}>
                            <input
                                type="checkbox"
                                className="sr-only"
                                checked={!!fab?.enabled}
                                onChange={(e) => setFab(prev => {
                                    const isEnabled = e.target.checked;
                                    return prev
                                        ? { ...prev, enabled: isEnabled }
                                        : { id: 'fab', label: '', type: 'url', value: '#', icon: 'PlusCircle', enabled: isEnabled };
                                })}
                            />
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ${fab?.enabled ? 'translate-x-4' : 'translate-x-0'}`} />
                        </div>
                    </label>
                </div>

                {fab?.enabled && (
                    <div className="space-y-3 animate-fade-in">
                        <div>
                            <label className="block text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-1">Link Type</label>
                            <div className="flex gap-1">
                                {(['url', 'form', 'page'] as const).map(t => (
                                    <button
                                        key={t}
                                        type="button"
                                        onClick={() => setFab(prev => ({ ...prev, type: t, formId: null, pageId: null }))}
                                        className={`flex-1 px-2 py-1.5 text-[10px] font-bold uppercase rounded transition-all ${
                                            fab?.type === t
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
                            <label className="block text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-1">Destination</label>
                            {fab?.type === 'form' ? (
                                <SelectMenu
                                    value={fab?.formId || ''}
                                    onChange={(v) => setFab(prev => ({ ...prev, formId: v }))}
                                    placeholder="— Select Form —"
                                    options={forms.map(f => ({ value: f.id, label: f.title || 'Untitled' }))}
                                />
                            ) : fab?.type === 'page' ? (
                                <SelectMenu
                                    value={fab?.pageId || ''}
                                    onChange={(v) => {
                                        const p = pages.find(pg => pg.id === v);
                                        setFab(prev => ({ ...prev, pageId: v, value: p ? `/${p.slug}` : '#' }));
                                    }}
                                    placeholder="— Select Page —"
                                    options={pages.map(p => ({ value: p.id, label: p.title || 'Untitled', hint: `/${p.slug}` }))}
                                />
                            ) : (
                                <input
                                    type="text"
                                    value={fab?.value || ''}
                                    onChange={(e) => setFab(prev => ({ ...prev, value: e.target.value }))}
                                    className="w-full px-3 py-2 text-sm bg-gray-100 dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-neutral-200 placeholder-neutral-400 dark:placeholder-neutral-600 focus:border-blue-500/50 focus:outline-none font-mono"
                                    placeholder="https://... or /path"
                                />
                            )}
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-1">Icon</label>
                            <FabIconPicker
                                currentIcon={fab?.icon || 'PlusCircle'}
                                onSelect={(icon) => setFab(prev => ({ ...prev, icon }))}
                                onOpenIconPicker={openIconPicker}
                            />
                        </div>
                    </div>
                )}
            </div>

        </div>
    );
}
