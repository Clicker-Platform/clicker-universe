'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { useSite } from '@/lib/site-context';
import { Globe, Plus, Check, AlertCircle, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { InlinePanelIconPicker } from '@/components/admin/IconSelector';
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
import {
    HeaderNavigationConfig,
    HeaderVariant,
    HeaderScrollBehavior,
    HeaderContainerWidth,
    HeaderNavTextPreset,
} from '@/data/mockData';

// ─── Constants ────────────────────────────────────────────────────────────────

const VARIANT_OPTIONS: { id: HeaderVariant; label: string; description: string }[] = [
    { id: 'logo-left', label: 'Logo-Left', description: 'Logo on the left, menu + CTA on the right.' },
    { id: 'logo-center', label: 'Logo-Center', description: 'Menu split around centered logo.' },
    { id: 'burger', label: 'Burger Minimal', description: 'Logo + CTA, menu in drop-down.' },
    { id: 'logo-left-stacked', label: 'Stacked', description: 'Two rows: logo + CTA above, menu below.' },
];

const DEFAULT_HEADER: HeaderNavigationConfig = {
    variant: 'logo-left',
    width: 'constrained',
    scrollBehavior: 'fixed',
    items: [],
    cta: { enabled: false, label: 'Order Now', linkType: 'url', linkValue: '#' },
    typography: { preset: 'default' },
    scrolledAppearance: { enabled: false },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

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

function SectionHeader({ label }: { label: string }) {
    return (
        <h5 className="text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
            {label}
        </h5>
    );
}

function Toggle({
    checked,
    onChange,
    label,
}: {
    checked: boolean;
    onChange: (v: boolean) => void;
    label?: string;
}) {
    return (
        <label className="flex items-center gap-2 cursor-pointer">
            {label && <span className="text-xs text-neutral-400 dark:text-neutral-500">{checked ? 'On' : 'Off'}</span>}
            <div className={`relative inline-flex h-5 w-9 rounded-full border-2 border-transparent transition-colors ${checked ? 'bg-blue-500' : 'bg-gray-300 dark:bg-neutral-700'}`}>
                <input
                    type="checkbox"
                    className="sr-only"
                    checked={checked}
                    onChange={(e) => onChange(e.target.checked)}
                />
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
            </div>
        </label>
    );
}

function SegmentedControl<T extends string>({
    options,
    value,
    onChange,
}: {
    options: { value: T; label: string }[];
    value: T;
    onChange: (v: T) => void;
}) {
    return (
        <div className="flex gap-1 flex-wrap">
            {options.map(opt => (
                <button
                    key={opt.value}
                    type="button"
                    onClick={() => onChange(opt.value)}
                    className={`flex-1 min-w-0 px-2 py-1.5 text-[10px] font-bold uppercase rounded transition-all whitespace-nowrap ${
                        value === opt.value
                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                            : 'bg-gray-100 dark:bg-neutral-800 text-neutral-500 border border-gray-300 dark:border-neutral-700 hover:text-neutral-700 dark:hover:text-neutral-300'
                    }`}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    );
}

function ColorInput({
    value,
    onChange,
    placeholder,
}: {
    value?: string;
    onChange: (v: string | undefined) => void;
    placeholder?: string;
}) {
    return (
        <div className="flex items-center gap-2">
            <label
                className="w-8 h-8 rounded-lg border border-gray-400 dark:border-neutral-600 cursor-pointer overflow-hidden flex-shrink-0 relative"
                style={{ backgroundColor: value || '#ffffff' }}
            >
                <input
                    type="color"
                    value={value || '#ffffff'}
                    onChange={(e) => onChange(e.target.value)}
                    className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                />
            </label>
            <input
                type="text"
                value={value || ''}
                onChange={(e) => onChange(e.target.value || undefined)}
                placeholder={placeholder || 'e.g. #ffffff  (empty = theme default)'}
                className="flex-1 px-3 py-1.5 bg-gray-100 dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded-lg text-xs text-neutral-900 dark:text-neutral-200 placeholder-neutral-400 dark:placeholder-neutral-600 outline-none focus:border-blue-500 font-mono"
            />
            {value && (
                <button
                    type="button"
                    onClick={() => onChange(undefined)}
                    className="text-neutral-400 hover:text-red-400 transition-colors text-xs px-1 font-bold"
                >×</button>
            )}
        </div>
    );
}

// ─── Panel view type ──────────────────────────────────────────────────────────

type PanelView =
    | { type: 'properties' }
    | { type: 'iconPicker'; currentIcon: string; onSelect: (icon: string) => void };

// ─── Main Panel ───────────────────────────────────────────────────────────────

export function HeaderNavPanel() {
    const { siteId } = useSite();

    // All state lives in a single `header` object — matches HeaderNavigationConfig
    const [header, setHeader] = useState<HeaderNavigationConfig>(DEFAULT_HEADER);
    const [forms, setForms] = useState<any[]>([]);
    const [pages, setPages] = useState<any[]>([]);
    const [homepageSlug, setHomepageSlug] = useState<string>('home');
    const [loading, setLoading] = useState(true);
    const [hydrated, setHydrated] = useState(false);
    const [status, setStatus] = useState<'idle' | 'pending' | 'saving' | 'saved' | 'error'>('idle');
    const [panelView, setPanelView] = useState<PanelView>({ type: 'properties' });
    const [advancedTypographyOpen, setAdvancedTypographyOpen] = useState(false);

    const siteIdRef = useRef(siteId);
    const hydratedSiteIdRef = useRef<string | null>(null);
    const lastSavedSnapshotRef = useRef<string | null>(null);
    useEffect(() => { siteIdRef.current = siteId; }, [siteId]);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const openIconPicker = useCallback((currentIcon: string, onSelect: (icon: string) => void) => {
        setPanelView({ type: 'iconPicker', currentIcon, onSelect });
    }, []);

    // ── Load from Firestore ──
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

                let loadedHeader: HeaderNavigationConfig = { ...DEFAULT_HEADER };
                if (settingsSnap.exists()) {
                    const data = settingsSnap.data();
                    if (data.homepageSlug) setHomepageSlug(data.homepageSlug);
                    const nav = data.navigation || {};
                    if (nav.header) {
                        // New shape — use it directly
                        loadedHeader = { ...DEFAULT_HEADER, ...nav.header };
                    } else {
                        // Legacy shape — synthesize into HeaderNavigationConfig for local state
                        // (we write to navigation.header; legacy fields remain untouched in Firestore)
                        loadedHeader = {
                            ...DEFAULT_HEADER,
                            items: nav.topNav || [],
                            cta: nav.topNavActions?.cta
                                ? { ...DEFAULT_HEADER.cta, ...nav.topNavActions.cta }
                                : DEFAULT_HEADER.cta,
                            bgColor: nav.headerStyle?.bgColor,
                            showBorder: nav.headerStyle?.showBorder,
                        };
                    }
                }

                setHeader(loadedHeader);
                lastSavedSnapshotRef.current = JSON.stringify(loadedHeader);
                hydratedSiteIdRef.current = siteId;
                setHydrated(true);
            } catch (err) {
                if (!cancelled) console.error('Failed to load header navigation:', err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, [siteId]);

    // ── Firestore write helper ──
    // Writes only navigation.header — does NOT clobber bottomNav / fab / topNav / etc.
    const saveToFirestore = useCallback(async (nextHeader: HeaderNavigationConfig) => {
        const sid = siteIdRef.current;
        if (!sid) return;
        if (hydratedSiteIdRef.current !== sid) return;
        const snapshot = JSON.stringify(nextHeader);
        if (snapshot === lastSavedSnapshotRef.current) return;
        setStatus('saving');
        try {
            const docRef = doc(db, 'sites', sid, 'content', 'siteSettings');
            // merge: true at the top level means the `navigation` field is merged,
            // so bottomNav / fab / topNav / etc. are untouched.
            await setDoc(docRef, { navigation: { header: nextHeader } }, { merge: true });
            lastSavedSnapshotRef.current = snapshot;
            setStatus('saved');
            setTimeout(() => setStatus('idle'), 2000);
        } catch (err) {
            console.error(err);
            setStatus('error');
            setTimeout(() => setStatus('idle'), 2500);
        }
    }, []);

    // ── Debounced auto-save ──
    useEffect(() => {
        if (!hydrated) return;
        if (hydratedSiteIdRef.current !== siteId) return;
        if (JSON.stringify(header) === lastSavedSnapshotRef.current) return;
        setStatus('pending');
        let fired = false;
        const timer = setTimeout(() => { fired = true; saveToFirestore(header); }, 600);
        return () => {
            clearTimeout(timer);
            if (!fired) saveToFirestore(header);
        };
    }, [header, hydrated, siteId, saveToFirestore]);

    // ── Single update helper ──
    const updateHeader = useCallback((partial: Partial<HeaderNavigationConfig>) => {
        setHeader(prev => ({ ...prev, ...partial }));
    }, []);

    // ── Nav item handlers ──
    const generateId = () => Math.random().toString(36).substr(2, 9);

    const handleAddItem = () => {
        updateHeader({ items: [...(header.items || []), { id: generateId(), label: 'New Link', type: 'page', value: '', icon: 'Link' }] });
    };

    const handleRemoveItem = (id: string) => {
        updateHeader({ items: (header.items || []).filter(i => i.id !== id) });
    };

    const handleUpdateItem = (id: string, field: string, value: string) => {
        updateHeader({
            items: (header.items || []).map(item =>
                item.id === id ? { ...item, [field]: value } : item
            ),
        });
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const list = header.items || [];
            const oldIndex = list.findIndex(i => i.id === active.id);
            const newIndex = list.findIndex(i => i.id === over.id);
            updateHeader({ items: arrayMove(list, oldIndex, newIndex) });
        }
    };

    // ── Icon picker view ──
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
                <div className="h-10 bg-gray-100 dark:bg-neutral-800 rounded-lg" />
            </div>
        );
    }

    const scrollBehaviorDisabled = header.scrollBehavior === 'none';

    return (
        <div className="space-y-5 animate-fade-in">

            {/* ── Global Badge ── */}
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

            {/* ══ LAYOUT ════════════════════════════════════════════════════════ */}
            <div className="space-y-4">
                <SectionHeader label="Layout" />

                {/* Variant */}
                <div className="space-y-2">
                    <label className="block text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">Variant</label>
                    <div className="space-y-1.5">
                        {VARIANT_OPTIONS.map(opt => (
                            <button
                                key={opt.id}
                                type="button"
                                onClick={() => updateHeader({ variant: opt.id })}
                                className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all ${
                                    header.variant === opt.id
                                        ? 'border-blue-500 ring-2 ring-blue-100 dark:ring-blue-500/20 bg-blue-500/5'
                                        : 'border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800/50 hover:border-gray-300 dark:hover:border-neutral-600'
                                }`}
                            >
                                <div className="text-xs font-bold text-neutral-900 dark:text-neutral-100">{opt.label}</div>
                                <div className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-0.5">{opt.description}</div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Width */}
                <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">Width</label>
                    <SegmentedControl<HeaderContainerWidth>
                        value={header.width}
                        onChange={(v) => updateHeader({ width: v })}
                        options={[
                            { value: 'full', label: 'Full' },
                            { value: 'constrained', label: 'Constrained' },
                        ]}
                    />
                </div>

                {/* Scroll Behavior */}
                <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">Scroll behavior</label>
                    <SegmentedControl<HeaderScrollBehavior>
                        value={header.scrollBehavior}
                        onChange={(v) => updateHeader({ scrollBehavior: v })}
                        options={[
                            { value: 'none', label: 'None' },
                            { value: 'fixed', label: 'Fixed' },
                            { value: 'sticky-on-scroll-up', label: 'Sticky on scroll-up' },
                            { value: 'shrink-on-scroll', label: 'Shrink on scroll' },
                        ]}
                    />
                </div>
            </div>

            {/* ══ NAV LINKS ═════════════════════════════════════════════════════ */}
            <div className="border-t border-gray-200 dark:border-neutral-800 pt-4">
                <div className="flex items-center justify-between mb-2">
                    <SectionHeader label="Nav Links" />
                    <button
                        type="button"
                        onClick={handleAddItem}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-lg hover:bg-blue-500/20 transition-colors"
                    >
                        <Plus size={12} /> Add
                    </button>
                </div>

                {(header.items || []).length === 0 ? (
                    <div className="text-center py-6 text-neutral-400 dark:text-neutral-600 text-xs border border-dashed border-gray-300 dark:border-neutral-800 rounded-lg">
                        No links yet. Add one above.
                    </div>
                ) : (
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <SortableContext
                            items={(header.items || []).map(i => i.id)}
                            strategy={verticalListSortingStrategy}
                        >
                            {(header.items || []).map((item) => (
                                <SortableNavItem
                                    key={item.id}
                                    item={item}
                                    forms={forms}
                                    pages={pages}
                                    homepageSlug={homepageSlug}
                                    onRemove={() => handleRemoveItem(item.id)}
                                    onUpdate={(field, val) => handleUpdateItem(item.id, field, val)}
                                    onOpenIconPicker={openIconPicker}
                                />
                            ))}
                        </SortableContext>
                    </DndContext>
                )}
            </div>

            {/* ══ CTA BUTTON ════════════════════════════════════════════════════ */}
            <div className="border-t border-gray-200 dark:border-neutral-800 pt-4 space-y-3">
                <div className="flex items-center justify-between">
                    <SectionHeader label="CTA Button" />
                    <Toggle
                        checked={header.cta?.enabled || false}
                        onChange={(enabled) =>
                            updateHeader({
                                cta: {
                                    enabled,
                                    label: header.cta?.label || 'Order Now',
                                    linkType: header.cta?.linkType || 'url',
                                    linkValue: header.cta?.linkValue || '#',
                                    formId: header.cta?.formId,
                                    pageId: header.cta?.pageId,
                                },
                            })
                        }
                        label=""
                    />
                </div>

                {header.cta?.enabled && (
                    <div className="space-y-3 animate-fade-in">
                        <div>
                            <label className="block text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-1">Button Label</label>
                            <input
                                type="text"
                                value={header.cta?.label || ''}
                                onChange={(e) => updateHeader({ cta: { ...header.cta, label: e.target.value } })}
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
                                        onClick={() => updateHeader({ cta: { ...header.cta, linkType: t, linkValue: '', formId: undefined, pageId: undefined } })}
                                        className={`flex-1 px-2 py-1.5 text-[10px] font-bold uppercase rounded transition-all ${
                                            header.cta?.linkType === t
                                                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 border border-neutral-300 dark:border-neutral-700 hover:text-neutral-700 dark:hover:text-neutral-300'
                                        }`}
                                    >
                                        {t === 'url' ? 'URL' : t}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            {header.cta?.linkType === 'form' ? (
                                <select
                                    value={header.cta?.formId || ''}
                                    onChange={(e) => updateHeader({ cta: { ...header.cta, formId: e.target.value, linkValue: e.target.value } })}
                                    className="w-full px-3 py-2 text-sm bg-gray-100 dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-neutral-200 focus:border-blue-500/50 focus:outline-none"
                                >
                                    <option value="">— Select Form —</option>
                                    {forms.map(f => <option key={f.id} value={f.id}>{f.title}</option>)}
                                </select>
                            ) : header.cta?.linkType === 'page' ? (
                                <select
                                    value={header.cta?.pageId || ''}
                                    onChange={(e) => {
                                        const p = pages.find(pg => pg.id === e.target.value);
                                        const resolvedValue = p ? (p.slug === homepageSlug ? 'action:homepage' : `/${p.slug}`) : '';
                                        updateHeader({ cta: { ...header.cta, pageId: e.target.value, linkValue: resolvedValue } });
                                    }}
                                    className="w-full px-3 py-2 text-sm bg-gray-100 dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-neutral-200 focus:border-blue-500/50 focus:outline-none"
                                >
                                    <option value="">— Select Page —</option>
                                    {pages.map(p => <option key={p.id} value={p.id}>{p.title} (/{p.slug})</option>)}
                                </select>
                            ) : (
                                <input
                                    type="text"
                                    value={header.cta?.linkValue || ''}
                                    onChange={(e) => updateHeader({ cta: { ...header.cta, linkValue: e.target.value } })}
                                    className="w-full px-3 py-2 text-sm bg-gray-100 dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-neutral-200 placeholder-neutral-400 dark:placeholder-neutral-600 focus:border-blue-500/50 focus:outline-none font-mono"
                                    placeholder="https://..."
                                />
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* ══ APPEARANCE ════════════════════════════════════════════════════ */}
            <div className="border-t border-gray-200 dark:border-neutral-800 pt-4 space-y-4">
                <SectionHeader label="Appearance" />

                {/* Background color */}
                <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">Background Color</label>
                    <ColorInput
                        value={header.bgColor}
                        onChange={(v) => updateHeader({ bgColor: v })}
                    />
                </div>

                {/* Show border */}
                <div className="flex items-center justify-between">
                    <div>
                        <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">Show Border</span>
                        <p className="text-[10px] text-neutral-400 dark:text-neutral-600 mt-0.5">Uses theme border token</p>
                    </div>
                    <Toggle
                        checked={!!header.showBorder}
                        onChange={(v) => updateHeader({ showBorder: v })}
                    />
                </div>

                {/* Typography */}
                <div className="space-y-2">
                    <label className="block text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">Typography</label>

                    <div className="space-y-1.5">
                        <label className="block text-[10px] text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">Style Preset</label>
                        <SegmentedControl<HeaderNavTextPreset>
                            value={header.typography?.preset || 'default'}
                            onChange={(v) => updateHeader({ typography: { ...header.typography, preset: v } })}
                            options={[
                                { value: 'default', label: 'Default' },
                                { value: 'tight', label: 'Tight' },
                                { value: 'spacious', label: 'Spacious' },
                                { value: 'sentence-case', label: 'Sentence case' },
                            ]}
                        />
                    </div>

                    {/* Advanced disclosure */}
                    <div className="border border-gray-200 dark:border-neutral-700 rounded-lg overflow-hidden">
                        <button
                            type="button"
                            onClick={() => setAdvancedTypographyOpen(v => !v)}
                            className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
                        >
                            <span>Advanced</span>
                            {advancedTypographyOpen
                                ? <ChevronDown size={12} />
                                : <ChevronRight size={12} />
                            }
                        </button>
                        {advancedTypographyOpen && (
                            <div className="px-3 pb-3 space-y-3 border-t border-gray-200 dark:border-neutral-700 bg-gray-50/50 dark:bg-neutral-800/30">
                                <div className="space-y-1.5 pt-3">
                                    <label className="block text-[10px] text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">Tracking Override</label>
                                    <SegmentedControl<'normal' | 'tight' | 'wide'>
                                        value={header.typography?.trackingOverride || 'normal'}
                                        onChange={(v) => updateHeader({ typography: { ...header.typography, preset: header.typography?.preset || 'default', trackingOverride: v } })}
                                        options={[
                                            { value: 'normal', label: 'Normal' },
                                            { value: 'tight', label: 'Tight' },
                                            { value: 'wide', label: 'Wide' },
                                        ]}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="block text-[10px] text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">Case Override</label>
                                    <SegmentedControl<'uppercase' | 'none'>
                                        value={header.typography?.caseOverride || 'none'}
                                        onChange={(v) => updateHeader({ typography: { ...header.typography, preset: header.typography?.preset || 'default', caseOverride: v } })}
                                        options={[
                                            { value: 'uppercase', label: 'Uppercase' },
                                            { value: 'none', label: 'None' },
                                        ]}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ══ SCROLLED STATE ════════════════════════════════════════════════ */}
            <div className="border-t border-gray-200 dark:border-neutral-800 pt-4 space-y-3">
                <div className="flex items-center justify-between">
                    <SectionHeader label="Scrolled State" />
                    {!scrollBehaviorDisabled && (
                        <Toggle
                            checked={!!header.scrolledAppearance?.enabled}
                            onChange={(enabled) =>
                                updateHeader({
                                    scrolledAppearance: { ...header.scrolledAppearance, enabled },
                                })
                            }
                        />
                    )}
                </div>

                {scrollBehaviorDisabled ? (
                    <p className="text-[10px] text-neutral-400 dark:text-neutral-500 italic">
                        Set Scroll behavior to enable scrolled state overrides.
                    </p>
                ) : header.scrolledAppearance?.enabled ? (
                    <div className="space-y-3 animate-fade-in">
                        <div className="space-y-1.5">
                            <label className="block text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">Background Color</label>
                            <ColorInput
                                value={header.scrolledAppearance?.bgColor}
                                onChange={(v) =>
                                    updateHeader({
                                        scrolledAppearance: { ...header.scrolledAppearance, enabled: true, bgColor: v },
                                    })
                                }
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <div>
                                <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">Show Border</span>
                                <p className="text-[10px] text-neutral-400 dark:text-neutral-600 mt-0.5">Uses theme border token</p>
                            </div>
                            <Toggle
                                checked={!!header.scrolledAppearance?.showBorder}
                                onChange={(v) =>
                                    updateHeader({
                                        scrolledAppearance: { ...header.scrolledAppearance, enabled: true, showBorder: v },
                                    })
                                }
                            />
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
