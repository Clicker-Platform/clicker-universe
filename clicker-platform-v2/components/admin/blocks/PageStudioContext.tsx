'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo, ReactNode } from 'react';
import { toast } from 'sonner';
import { db } from '@/lib/firebase';
import { collection, addDoc, doc, getDoc, updateDoc, deleteDoc, setDoc, getDocs, serverTimestamp, query, where, writeBatch } from 'firebase/firestore';
import { Page, PageBlock } from '@/data/mockData';
import { fetchLightweightPublicData, hydratePageBlocks } from '@/lib/fetchData';
import { useSite } from '@/lib/site-context';

// ── Types ──────────────────────────────────────────────────────────────────

interface PageListItem {
    id: string;
    title: string;
    slug: string;
    updatedAt?: any;
}

interface TrashedPageListItem {
    id: string;
    title: string;
    slug: string;
    deletedAt?: any;
}

interface PageFormData {
    title: string;
    slug: string;
    content: string;
    blocks: PageBlock[];
    seoTitle: string;
    seoDescription: string;
    seoImage: string;
    seoNoIndex: boolean;
    pixelFb: string;
    pixelGa: string;
    pixelTiktok: string;
    overrideSeo: boolean;
    overridePixels: boolean;
}

const emptyFormData: PageFormData = {
    title: '',
    slug: '',
    content: '',
    blocks: [],
    seoTitle: '',
    seoDescription: '',
    seoImage: '',
    seoNoIndex: false,
    pixelFb: '',
    pixelGa: '',
    pixelTiktok: '',
    overrideSeo: false,
    overridePixels: false,
};

// ── Page Cache ──────────────────────────────────────────────────────────

interface CachedPage {
    formData: PageFormData;
    savedSnapshot: string;
    hydratedData: Record<string, any>;
    blockTypesKey: string;
    cachedAt: number;
    updatedAt?: any;
}

const MAX_CACHED_PAGES = 10;

interface PageStudioContextType {
    // Page list
    pages: PageListItem[];
    pagesLoading: boolean;

    // Active page
    activePageId: string | null;
    formData: PageFormData;
    pageLoading: boolean;

    // Dirty tracking
    isDirty: boolean;

    // Hydrated data (links, products, etc.) — lifted from CanvasStudio for caching
    hydratedData: Record<string, any>;

    // Global settings
    globalSettings: any;

    // Saving state
    saving: boolean;

    // Field setters
    setTitle: (v: string) => void;
    setSlug: (v: string) => void;
    setBlocks: (blocks: PageBlock[] | ((prev: PageBlock[]) => PageBlock[])) => void;
    setContent: (v: string) => void;
    setSeoTitle: (v: string) => void;
    setSeoDescription: (v: string) => void;
    setSeoImage: (v: string) => void;
    setSeoNoIndex: (v: boolean) => void;
    setPixelFb: (v: string) => void;
    setPixelGa: (v: string) => void;
    setPixelTiktok: (v: string) => void;
    setOverrideSeo: (v: boolean) => void;
    setOverridePixels: (v: boolean) => void;
    setShowSeoSettings: (v: boolean) => void;
    showSeoSettings: boolean;

    // Actions
    switchPage: (pageId: string | 'create') => Promise<boolean>;
    savePage: () => Promise<void>;
    deletePage: () => Promise<void>;
    setHomepage: () => Promise<void>;
    unsetHomepage: () => Promise<void>;
    updateFooterText: (val: string) => Promise<void>;
    refreshGlobalSettings: () => Promise<void>;
    updateGlobalSettings: (partial: Record<string, any>) => void;
    refreshHydratedData: () => Promise<void>;

    // Trash
    trashedPages: TrashedPageListItem[];
    trashedPagesLoading: boolean;
    trashPage: () => Promise<void>;
    trashPageById: (pageId: string) => Promise<void>;
    loadTrashedPages: () => Promise<void>;
    restorePage: (pageId: string) => Promise<string>;
    restoreAllPages: () => Promise<void>;
    permanentlyDeletePage: (pageId: string) => Promise<void>;
    permanentlyDeleteAllPages: () => Promise<void>;

    // Unsaved changes dialog
    pendingSwitch: string | null;
    confirmDiscard: () => void;
    confirmSaveAndSwitch: () => void;
    cancelSwitch: () => void;
}

const PageStudioContext = createContext<PageStudioContextType | undefined>(undefined);

// ── Provider ───────────────────────────────────────────────────────────────

export function PageStudioProvider({ children, initialPageId }: { children: ReactNode; initialPageId?: string | null }) {
    const { siteId } = useSite();

    // Page list
    const [pages, setPages] = useState<PageListItem[]>([]);
    const [pagesLoading, setPagesLoading] = useState(true);

    // Active page
    const [activePageId, setActivePageId] = useState<string | null>(initialPageId || null);
    const [pageLoading, setPageLoading] = useState(false);

    // Form data
    const [formData, setFormData] = useState<PageFormData>({ ...emptyFormData });
    const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
    const [showSeoSettings, setShowSeoSettings] = useState(false);

    // Snapshot for dirty tracking
    const savedSnapshotRef = useRef<string>('');

    // Global settings
    const [globalSettings, setGlobalSettings] = useState<any>(null);

    // Saving
    const [saving, setSaving] = useState(false);

    // Trash
    const [trashedPages, setTrashedPages] = useState<TrashedPageListItem[]>([]);
    const [trashedPagesLoading, setTrashedPagesLoading] = useState(false);

    // Unsaved changes dialog
    const [pendingSwitch, setPendingSwitch] = useState<string | null>(null);

    // Hydrated data (lifted from CanvasStudio for caching)
    const [hydratedData, setHydratedData] = useState<Record<string, any>>({});

    // ── Page Cache ──────────────────────────────────────────────────────────

    const pageCacheRef = useRef<Map<string, CachedPage>>(new Map());

    // Mirror refs for async callbacks (avoid stale closures in backgroundRefresh)
    const activePageIdRef = useRef<string | null>(activePageId);
    activePageIdRef.current = activePageId;
    const formDataRef = useRef<PageFormData>(formData);
    formDataRef.current = formData;

    // ── Dirty tracking ─────────────────────────────────────────────────────

    const getSnapshot = useCallback((data: PageFormData) => {
        return JSON.stringify({
            title: data.title,
            slug: data.slug,
            blocks: data.blocks,
            seoTitle: data.seoTitle,
            seoDescription: data.seoDescription,
            seoImage: data.seoImage,
            seoNoIndex: data.seoNoIndex,
            pixelFb: data.pixelFb,
            pixelGa: data.pixelGa,
            pixelTiktok: data.pixelTiktok,
            overrideSeo: data.overrideSeo,
            overridePixels: data.overridePixels,
        });
    }, []);

    const isDirty = getSnapshot(formData) !== savedSnapshotRef.current;

    // Browser beforeunload guard
    useEffect(() => {
        if (!isDirty) return;
        const handler = (e: BeforeUnloadEvent) => {
            e.preventDefault();
        };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [isDirty]);

    // ── Field setters ──────────────────────────────────────────────────────

    const updateField = useCallback(<K extends keyof PageFormData>(key: K, value: PageFormData[K]) => {
        setFormData(prev => ({ ...prev, [key]: value }));
    }, []);

    const setTitle = useCallback((v: string) => {
        updateField('title', v);
        // Auto-generate slug if not manually edited and this is a new page
        if (!slugManuallyEdited) {
            const autoSlug = v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
            updateField('slug', autoSlug);
        }
    }, [updateField, slugManuallyEdited]);

    const setSlug = useCallback((v: string) => {
        updateField('slug', v);
        setSlugManuallyEdited(true);
    }, [updateField]);

    const setBlocks = useCallback((blocksOrFn: PageBlock[] | ((prev: PageBlock[]) => PageBlock[])) => {
        setFormData(prev => ({
            ...prev,
            blocks: typeof blocksOrFn === 'function' ? blocksOrFn(prev.blocks) : blocksOrFn,
        }));
    }, []);

    const setContent = useCallback((v: string) => updateField('content', v), [updateField]);
    const setSeoTitle = useCallback((v: string) => updateField('seoTitle', v), [updateField]);
    const setSeoDescription = useCallback((v: string) => updateField('seoDescription', v), [updateField]);
    const setSeoImage = useCallback((v: string) => updateField('seoImage', v), [updateField]);
    const setSeoNoIndex = useCallback((v: boolean) => updateField('seoNoIndex', v), [updateField]);
    const setPixelFb = useCallback((v: string) => updateField('pixelFb', v), [updateField]);
    const setPixelGa = useCallback((v: string) => updateField('pixelGa', v), [updateField]);
    const setPixelTiktok = useCallback((v: string) => updateField('pixelTiktok', v), [updateField]);
    const setOverrideSeo = useCallback((v: boolean) => updateField('overrideSeo', v), [updateField]);
    const setOverridePixels = useCallback((v: boolean) => updateField('overridePixels', v), [updateField]);

    // ── Cache helpers ─────────────────────────────────────────────────────

    const cacheCurrentPage = useCallback((
        pageId: string,
        data: PageFormData,
        snapshot: string,
        hydrated: Record<string, any>,
        updatedAt?: any,
    ) => {
        const cache = pageCacheRef.current;
        cache.set(pageId, {
            formData: { ...data, blocks: [...data.blocks] },
            savedSnapshot: snapshot,
            hydratedData: { ...hydrated },
            blockTypesKey: data.blocks.map(b => b.type).sort().join(','),
            cachedAt: Date.now(),
            updatedAt,
        });
        // LRU eviction
        if (cache.size > MAX_CACHED_PAGES) {
            let oldestKey: string | null = null;
            let oldestTime = Infinity;
            for (const [key, entry] of cache) {
                if (entry.cachedAt < oldestTime) {
                    oldestTime = entry.cachedAt;
                    oldestKey = key;
                }
            }
            if (oldestKey) cache.delete(oldestKey);
        }
    }, []);

    const evictFromCache = useCallback((pageId: string) => {
        pageCacheRef.current.delete(pageId);
    }, []);

    // ── Block hydration (lifted from CanvasStudio) ──────────────────────

    const blockTypesKey = useMemo(
        () => formData.blocks.map(b => b.type).sort().join(','),
        [formData.blocks]
    );

    useEffect(() => {
        if (!formData.blocks.length || !siteId) return;

        let isMounted = true;

        hydratePageBlocks(siteId, formData.blocks).then(data => {
            if (isMounted) {
                setHydratedData(data);
                // Update cache entry with hydrated data
                const pageId = activePageIdRef.current;
                if (pageId) {
                    const cached = pageCacheRef.current.get(pageId);
                    if (cached) {
                        cached.hydratedData = { ...data };
                        cached.blockTypesKey = formData.blocks.map(b => b.type).sort().join(',');
                    }
                }
            }
        });

        return () => { isMounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [blockTypesKey, siteId]);

    // ── Load page list + global settings on mount ──────────────────────────

    useEffect(() => {
        if (!siteId) return;

        let isMounted = true;

        const loadInitial = async () => {
            try {
                const [pagesSnap, settings] = await Promise.all([
                    getDocs(collection(db, 'sites', siteId, 'pages')),
                    fetchLightweightPublicData(siteId),
                ]);

                if (!isMounted) return;

                const fetchedPages: PageListItem[] = pagesSnap.docs.map(d => ({
                    id: d.id,
                    title: d.data().title || '',
                    slug: d.data().slug || '',
                    updatedAt: d.data().updatedAt,
                }));
                setPages(fetchedPages);
                setGlobalSettings(settings);

                // Determine initial page to load
                const paramId = initialPageId;
                if (paramId && paramId !== 'create' && fetchedPages.some(p => p.id === paramId)) {
                    await loadPage(paramId, settings);
                } else if (fetchedPages.length > 0) {
                    // Auto-select homepage first, fallback to first page
                    const homeSlug = settings?.homepageSlug || 'home';
                    const homePage = fetchedPages.find(p => p.slug === homeSlug);
                    await loadPage((homePage || fetchedPages[0]).id, settings);
                }
                // If no pages, stay in create mode (activePageId = null)
            } catch (err) {
                if (isMounted) console.error('Error loading page studio:', err);
            } finally {
                if (isMounted) setPagesLoading(false);
            }
        };

        loadInitial();

        return () => { isMounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [siteId]);

    // ── Build formData from Firestore doc ──────────────────────────────────

    const buildFormData = useCallback(async (data: Page, settingsOverride?: any): Promise<PageFormData> => {
        let pageBlocks = data.blocks && Array.isArray(data.blocks) && data.blocks.length > 0
            ? data.blocks
            : [];

        // Legacy migration for homepage
        if (pageBlocks.length === 0) {
            const settings = settingsOverride || globalSettings;
            if (data.slug === (settings?.homepageSlug || 'home')) {
                const { generateSystemBlocks } = await import('@/lib/systemBlocks');
                pageBlocks = generateSystemBlocks(settings?.homeBlockOrder || [], settings?.hiddenBlockIds || []);
            } else if (data.blocks && Array.isArray(data.blocks)) {
                pageBlocks = data.blocks;
            }
        }

        return {
            title: data.title || '',
            slug: data.slug || '',
            content: data.content || '',
            blocks: pageBlocks,
            seoTitle: data.seo?.title || '',
            seoDescription: data.seo?.description || '',
            seoImage: data.seo?.image || '',
            seoNoIndex: data.seo?.noIndex || false,
            pixelFb: data.pixels?.facebookPixelId || '',
            pixelGa: data.pixels?.googleAnalyticsId || '',
            pixelTiktok: data.pixels?.tiktokPixelId || '',
            overrideSeo: !!(data.seo?.title || data.seo?.description || data.seo?.image),
            overridePixels: !!(data.pixels?.facebookPixelId || data.pixels?.googleAnalyticsId || data.pixels?.tiktokPixelId),
        };
    }, [globalSettings]);

    // ── Restore page state (shared by cache hit and Firestore load) ─────

    const restorePageState = useCallback((pageId: string, newFormData: PageFormData, snapshot: string) => {
        setFormData(newFormData);
        setActivePageId(pageId);
        setSlugManuallyEdited(true);
        savedSnapshotRef.current = snapshot;

        // Update URL without full navigation
        const url = new URL(window.location.href);
        url.searchParams.set('pageId', pageId);
        window.history.replaceState({}, '', url.toString());
    }, []);

    // ── Background refresh (silent Firestore check after cache hit) ─────

    const backgroundRefresh = useCallback(async (pageId: string) => {
        if (!siteId) return;
        try {
            const docSnap = await getDoc(doc(db, 'sites', siteId, 'pages', pageId));
            if (!docSnap.exists()) return;

            const data = docSnap.data() as Page;
            const cached = pageCacheRef.current.get(pageId);
            if (!cached) return;

            const remoteUpdatedAt = data.updatedAt?.toMillis?.() ?? 0;
            const cachedUpdatedAt = cached.updatedAt?.toMillis?.() ?? 0;

            if (remoteUpdatedAt > cachedUpdatedAt) {
                // Firestore has newer data
                const freshFormData = await buildFormData(data);
                const freshSnapshot = getSnapshot(freshFormData);

                // Update cache
                cacheCurrentPage(pageId, freshFormData, freshSnapshot, cached.hydratedData, data.updatedAt);

                // If still the active page and user hasn't edited, silently update
                if (activePageIdRef.current === pageId) {
                    const currentSnapshot = getSnapshot(formDataRef.current);
                    if (currentSnapshot === cached.savedSnapshot) {
                        restorePageState(pageId, freshFormData, freshSnapshot);
                    }
                }
            }
        } catch {
            // Silent failure — background refresh is best-effort
        }
    }, [siteId, buildFormData, getSnapshot, cacheCurrentPage, restorePageState]);

    // ── Load a single page ─────────────────────────────────────────────────

    const loadPage = useCallback(async (pageId: string, settingsOverride?: any) => {
        if (!siteId) return;
        // ── CACHE HIT: instant restore ──
        const cached = pageCacheRef.current.get(pageId);
        if (cached) {
            restorePageState(pageId, { ...cached.formData, blocks: [...cached.formData.blocks] }, cached.savedSnapshot);
            setHydratedData(cached.hydratedData);
            cached.cachedAt = Date.now();
            // Background refresh — don't await
            backgroundRefresh(pageId);
            return;
        }

        // ── CACHE MISS: fetch from Firestore ──
        setPageLoading(true);

        try {
            const docSnap = await getDoc(doc(db, 'sites', siteId, 'pages', pageId));
            if (!docSnap.exists()) {
                toast.error('Page not found');
                setPageLoading(false);
                return;
            }

            const data = docSnap.data() as Page;
            const newFormData = await buildFormData(data, settingsOverride);
            const snapshot = getSnapshot(newFormData);

            restorePageState(pageId, newFormData, snapshot);

            // Cache the freshly loaded page (hydratedData will be added by hydration effect)
            cacheCurrentPage(pageId, newFormData, snapshot, {}, data.updatedAt);
        } catch (err) {
            console.error('Error loading page:', err);
            toast.error('Failed to load page');
        } finally {
            setPageLoading(false);
        }
    }, [siteId, buildFormData, getSnapshot, cacheCurrentPage, restorePageState, backgroundRefresh]);

    // ── Switch page (with dirty check) ─────────────────────────────────────

    const executeSwitchPage = useCallback(async (pageId: string | 'create'): Promise<boolean> => {
        if (pageId === 'create') {
            const newData = { ...emptyFormData };
            setFormData(newData);
            setActivePageId(null);
            setSlugManuallyEdited(false);
            savedSnapshotRef.current = getSnapshot(newData);

            const url = new URL(window.location.href);
            url.searchParams.delete('pageId');
            window.history.replaceState({}, '', url.toString());
            return true;
        }

        await loadPage(pageId);
        return true;
    }, [loadPage, getSnapshot]);

    const switchPage = useCallback(async (pageId: string | 'create'): Promise<boolean> => {
        // If switching to same page, no-op
        if (pageId === activePageId) return true;
        if (pageId === 'create' && activePageId === null) return true;

        if (isDirty) {
            setPendingSwitch(pageId);
            return false; // Caller should not proceed — dialog will handle it
        }

        return await executeSwitchPage(pageId);
    }, [activePageId, isDirty, executeSwitchPage]);

    // Unsaved changes dialog handlers
    const confirmDiscard = useCallback(() => {
        if (pendingSwitch) {
            const target = pendingSwitch;
            setPendingSwitch(null);
            // Reset to saved snapshot so isDirty becomes false
            savedSnapshotRef.current = getSnapshot(formData);
            executeSwitchPage(target);
        }
    }, [pendingSwitch, executeSwitchPage, getSnapshot, formData]);

    const confirmSaveAndSwitch = useCallback(async () => {
        if (pendingSwitch) {
            const target = pendingSwitch;
            setPendingSwitch(null);
            await savePageInternal();
            await executeSwitchPage(target);
        }
    }, [pendingSwitch, executeSwitchPage]);

    const cancelSwitch = useCallback(() => {
        setPendingSwitch(null);
    }, []);

    // ── Save page (lift from PageEditor handleSave) ────────────────────────

    const savePageInternal = useCallback(async () => {
        if (!siteId) return;

        setSaving(true);

        let trimmedTitle = formData.title.trim();
        let trimmedSlug = formData.slug.trim().toLowerCase();

        if (!trimmedTitle || !trimmedSlug) {
            if (!trimmedTitle && !trimmedSlug) {
                // Auto-generate title and slug for entirely empty state
                let counter = 1;
                let candidateTitle = 'Untitled';
                let candidateSlug = 'untitled';
                
                while (true) {
                    const q = query(collection(db, 'sites', siteId, 'pages'), where('slug', '==', candidateSlug));
                    const querySnapshot = await getDocs(q);
                    const duplicateExists = querySnapshot.docs.some(d => d.id !== activePageId);
                    
                    if (!duplicateExists) {
                        break;
                    }
                    candidateTitle = `Untitled (${counter})`;
                    candidateSlug = `untitled-${counter}`;
                    counter++;
                }

                trimmedTitle = candidateTitle;
                trimmedSlug = candidateSlug;
                
                // Update local form state so UI reflects the auto-name immediately
                setFormData(prev => ({ ...prev, title: candidateTitle, slug: candidateSlug }));
            } else {
                toast.error('Both Title and Slug are required if one is set');
                setSaving(false);
                return;
            }
        }

        const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
        if (!slugRegex.test(trimmedSlug)) {
            toast.error('Invalid slug format. Use only lowercase letters, numbers, and hyphens (e.g., my-page-title). No spaces allowed.');
            setSaving(false);
            return;
        }

        try {
            // Check for duplicate slug
            const q = query(collection(db, 'sites', siteId, 'pages'), where('slug', '==', trimmedSlug));
            const querySnapshot = await getDocs(q);
            const duplicateExists = querySnapshot.docs.some(d => d.id !== activePageId);

            if (duplicateExists) {
                toast.error('This slug is already taken by another page. Please choose a different one.');
                setSaving(false);
                return;
            }

            const pageData = {
                title: trimmedTitle,
                slug: trimmedSlug,
                content: formData.content,
                blocks: formData.blocks,
                seo: formData.overrideSeo ? {
                    title: formData.seoTitle,
                    description: formData.seoDescription,
                    image: formData.seoImage,
                    noIndex: formData.seoNoIndex,
                } : null,
                pixels: formData.overridePixels ? {
                    facebookPixelId: formData.pixelFb,
                    googleAnalyticsId: formData.pixelGa,
                    tiktokPixelId: formData.pixelTiktok,
                } : null,
                updatedAt: serverTimestamp(),
            };

            let savedPageId = activePageId;

            if (activePageId === null) {
                // Create new page
                const docRef = await addDoc(collection(db, 'sites', siteId, 'pages'), {
                    ...pageData,
                    createdAt: serverTimestamp(),
                });
                savedPageId = docRef.id;
                setActivePageId(docRef.id);

                // Update page list
                setPages(prev => [...prev, { id: docRef.id, title: trimmedTitle, slug: trimmedSlug }]);

                // Update URL
                const url = new URL(window.location.href);
                url.searchParams.set('pageId', docRef.id);
                window.history.replaceState({}, '', url.toString());
            } else {
                await updateDoc(doc(db, 'sites', siteId, 'pages', activePageId), pageData);

                // Update page list entry
                setPages(prev => prev.map(p =>
                    p.id === activePageId ? { ...p, title: trimmedTitle, slug: trimmedSlug } : p
                ));
            }

            // Update saved snapshot + cache
            const snapshot = getSnapshot(formData);
            savedSnapshotRef.current = snapshot;

            if (savedPageId) {
                const existingHydrated = pageCacheRef.current.get(savedPageId)?.hydratedData || {};
                cacheCurrentPage(savedPageId, formData, snapshot, existingHydrated);
            }
        } catch (err) {
            console.error('Error saving page:', err);
            toast.error('Failed to save page. Please try again.');
        } finally {
            setSaving(false);
        }
    }, [siteId, activePageId, formData, getSnapshot, cacheCurrentPage]);

    const savePage = useCallback(async () => {
        await savePageInternal();
    }, [savePageInternal]);

    // ── Load trashed pages ─────────────────────────────────────────────────

    const loadTrashedPages = useCallback(async () => {
        if (!siteId) return;
        setTrashedPagesLoading(true);
        try {
            const snap = await getDocs(collection(db, 'sites', siteId, 'pages_trash'));
            const items: TrashedPageListItem[] = snap.docs.map(d => ({
                id: d.id,
                title: d.data().title || '',
                slug: d.data().slug || '',
                deletedAt: d.data().deletedAt,
            }));
            // Sort newest first
            items.sort((a, b) => {
                const aMs = a.deletedAt?.toMillis?.() ?? 0;
                const bMs = b.deletedAt?.toMillis?.() ?? 0;
                return bMs - aMs;
            });
            setTrashedPages(items);
        } catch (err) {
            console.error('Error loading trash:', err);
        } finally {
            setTrashedPagesLoading(false);
        }
    }, [siteId]);

    // ── Helper: move active page to trash ─────────────────────────────────

    const _movePageToTrash = useCallback(async (pageId: string) => {
        if (!siteId) return;

        // Read full page doc
        const pageSnap = await getDoc(doc(db, 'sites', siteId, 'pages', pageId));
        if (!pageSnap.exists()) return;

        const pageData = pageSnap.data();

        // Write to pages_trash with deletedAt + originalSlug
        await setDoc(doc(db, 'sites', siteId, 'pages_trash', pageId), {
            ...pageData,
            originalSlug: pageData.slug || '',
            deletedAt: serverTimestamp(),
        });

        // Delete from pages
        await deleteDoc(doc(db, 'sites', siteId, 'pages', pageId));
    }, [siteId]);

    // ── Trash active page (soft delete) ───────────────────────────────────

    const trashPage = useCallback(async () => {
        if (!siteId || activePageId === null) return;

        try {
            await _movePageToTrash(activePageId);
            evictFromCache(activePageId);

            // Add to local trashed list
            const trashed: TrashedPageListItem = {
                id: activePageId,
                title: formData.title,
                slug: formData.slug,
            };
            setTrashedPages(prev => [trashed, ...prev]);

            const remainingPages = pages.filter(p => p.id !== activePageId);
            setPages(remainingPages);

            if (remainingPages.length > 0) {
                await loadPage(remainingPages[0].id);
            } else {
                setFormData({ ...emptyFormData });
                setActivePageId(null);
                savedSnapshotRef.current = getSnapshot(emptyFormData);
            }
        } catch (err) {
            console.error('Error trashing page:', err);
            toast.error('Failed to move page to trash');
        }
    }, [siteId, activePageId, formData, pages, loadPage, getSnapshot, _movePageToTrash, evictFromCache]);

    // ── Trash a page by ID (for non-active pages) ─────────────────────────

    const trashPageById = useCallback(async (pageId: string) => {
        if (!siteId) return;

        // If it's the active page, delegate to trashPage
        if (pageId === activePageId) {
            await trashPage();
            return;
        }

        try {
            const pageToTrash = pages.find(p => p.id === pageId);
            if (!pageToTrash) return;

            await _movePageToTrash(pageId);
            evictFromCache(pageId);

            const trashed: TrashedPageListItem = {
                id: pageId,
                title: pageToTrash.title,
                slug: pageToTrash.slug,
            };
            setTrashedPages(prev => [trashed, ...prev]);
            setPages(prev => prev.filter(p => p.id !== pageId));
        } catch (err) {
            console.error('Error trashing page:', err);
            toast.error('Failed to move page to trash');
        }
    }, [siteId, activePageId, pages, trashPage, _movePageToTrash, evictFromCache]);

    // ── Keep deletePage as soft-delete alias for backwards compat ─────────

    const deletePage = useCallback(async () => {
        await trashPage();
    }, [trashPage]);

    // ── Restore a trashed page ─────────────────────────────────────────────

    const restorePage = useCallback(async (pageId: string): Promise<string> => {
        if (!siteId) return '';

        try {
            const trashSnap = await getDoc(doc(db, 'sites', siteId, 'pages_trash', pageId));
            if (!trashSnap.exists()) return '';

            const pageData = trashSnap.data();
            let slug = pageData.originalSlug || pageData.slug || '';

            // Check for slug conflict
            if (slug) {
                const q = query(collection(db, 'sites', siteId, 'pages'), where('slug', '==', slug));
                const conflictSnap = await getDocs(q);
                if (!conflictSnap.empty) {
                    // Generate unique slug
                    let suffix = 1;
                    let candidate = `${slug}-restored`;
                    while (true) {
                        const cq = query(collection(db, 'sites', siteId, 'pages'), where('slug', '==', candidate));
                        const cSnap = await getDocs(cq);
                        if (cSnap.empty) {
                            slug = candidate;
                            break;
                        }
                        suffix++;
                        candidate = `${pageData.originalSlug || pageData.slug}-restored-${suffix}`;
                    }
                }
            }

            // Strip trash-only fields
            const { originalSlug, deletedAt, ...restoredData } = pageData;
            const finalData = { ...restoredData, slug, updatedAt: serverTimestamp() };

            // Write back to pages
            await setDoc(doc(db, 'sites', siteId, 'pages', pageId), finalData);

            // Remove from pages_trash
            await deleteDoc(doc(db, 'sites', siteId, 'pages_trash', pageId));

            // Update local state
            setTrashedPages(prev => prev.filter(p => p.id !== pageId));
            setPages(prev => [...prev, { id: pageId, title: pageData.title || '', slug }]);

            return slug;
        } catch (err) {
            console.error('Error restoring page:', err);
            toast.error('Failed to restore page');
            return '';
        }
    }, [siteId]);

    // ── Restore all trashed pages ──────────────────────────────────────────

    const restoreAllPages = useCallback(async () => {
        if (!siteId || trashedPages.length === 0) return;
        // Restore sequentially to handle slug conflicts individually
        for (const trashed of trashedPages) {
            await restorePage(trashed.id);
        }
    }, [siteId, trashedPages, restorePage]);

    // ── Permanently delete a trashed page ─────────────────────────────────

    const permanentlyDeletePage = useCallback(async (pageId: string) => {
        if (!siteId) return;
        try {
            await deleteDoc(doc(db, 'sites', siteId, 'pages_trash', pageId));
            setTrashedPages(prev => prev.filter(p => p.id !== pageId));
        } catch (err) {
            console.error('Error permanently deleting page:', err);
            toast.error('Failed to permanently delete page');
        }
    }, [siteId]);

    // ── Permanently delete all trashed pages ──────────────────────────────

    const permanentlyDeleteAllPages = useCallback(async () => {
        if (!siteId || trashedPages.length === 0) return;
        try {
            const batch = writeBatch(db);
            trashedPages.forEach(p => {
                batch.delete(doc(db, 'sites', siteId, 'pages_trash', p.id));
            });
            await batch.commit();
            setTrashedPages([]);
        } catch (err) {
            console.error('Error emptying trash:', err);
            toast.error('Failed to empty trash');
        }
    }, [siteId, trashedPages]);

    // ── Set / Unset homepage ───────────────────────────────────────────────

    const setHomepage = useCallback(async () => {
        if (!siteId || !formData.slug || activePageId === null) return;

        try {
            await setDoc(doc(db, 'sites', siteId, 'content', 'siteSettings'), {
                homepageSlug: formData.slug,
            }, { merge: true });

            setGlobalSettings((prev: any) => prev ? { ...prev, homepageSlug: formData.slug } : { homepageSlug: formData.slug });
        } catch (err) {
            console.error('Error setting homepage:', err);
            toast.error('Failed to set homepage. Please try again.');
        }
    }, [siteId, formData.slug, activePageId]);

    const unsetHomepage = useCallback(async () => {
        if (!siteId) return;

        try {
            await setDoc(doc(db, 'sites', siteId, 'content', 'siteSettings'), {
                homepageSlug: 'home',
            }, { merge: true });

            setGlobalSettings((prev: any) => prev ? { ...prev, homepageSlug: 'home' } : { homepageSlug: 'home' });
        } catch (err) {
            console.error('Error unsetting homepage:', err);
            toast.error('Failed to unset homepage. Please try again.');
        }
    }, [siteId]);

    const refreshGlobalSettings = useCallback(async () => {
        if (!siteId) return;
        try {
            const settings = await fetchLightweightPublicData(siteId);
            setGlobalSettings(settings);
        } catch (err) {
            console.error('Error refreshing global settings:', err);
        }
    }, [siteId]);

    const updateGlobalSettings = useCallback((partial: Record<string, any>) => {
        setGlobalSettings((prev: any) => prev ? { ...prev, ...partial } : partial);
    }, []);

    const refreshHydratedData = useCallback(async () => {
        if (!siteId || !formData.blocks.length) return;
        const data = await hydratePageBlocks(siteId, formData.blocks);
        setHydratedData(data);
        const pageId = activePageIdRef.current;
        if (pageId) {
            const cached = pageCacheRef.current.get(pageId);
            if (cached) cached.hydratedData = { ...data };
        }
    }, [siteId, formData.blocks]);

    const updateFooterText = useCallback(async (val: string) => {
        if (!siteId) return;
        try {
            await setDoc(doc(db, 'sites', siteId, 'content', 'siteSettings'), {
                footerText: val,
            }, { merge: true });
            setGlobalSettings((prev: any) => prev ? { ...prev, footerText: val } : { footerText: val });
        } catch (err) {
            console.error('Error updating footer text:', err);
        }
    }, [siteId]);

    // ── Context value ──────────────────────────────────────────────────────

    return (
        <PageStudioContext.Provider value={{
            pages,
            pagesLoading,
            activePageId,
            formData,
            pageLoading,
            isDirty,
            hydratedData,
            globalSettings,
            saving,
            setTitle,
            setSlug,
            setBlocks,
            setContent,
            setSeoTitle,
            setSeoDescription,
            setSeoImage,
            setSeoNoIndex,
            setPixelFb,
            setPixelGa,
            setPixelTiktok,
            setOverrideSeo,
            setOverridePixels,
            setShowSeoSettings,
            showSeoSettings,
            switchPage,
            savePage,
            deletePage,
            setHomepage,
            unsetHomepage,
            updateFooterText,
            refreshGlobalSettings,
            updateGlobalSettings,
            refreshHydratedData,
            trashedPages,
            trashedPagesLoading,
            trashPage,
            trashPageById,
            loadTrashedPages,
            restorePage,
            restoreAllPages,
            permanentlyDeletePage,
            permanentlyDeleteAllPages,
            pendingSwitch,
            confirmDiscard,
            confirmSaveAndSwitch,
            cancelSwitch,
        }}>
            {children}
        </PageStudioContext.Provider>
    );
}

export function usePageStudio() {
    const context = useContext(PageStudioContext);
    if (context === undefined) {
        throw new Error('usePageStudio must be used within a PageStudioProvider');
    }
    return context;
}
