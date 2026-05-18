'use client';

import { useEditor } from './EditorContext';
import { BlockManager } from './BlockManager';
import { Settings, Layers, Box, FileText, BarChart2, CheckSquare, Square, X, Plus, Link2, FileInput, ShoppingBag, Globe, Loader2, Palette, MoreHorizontal as MoreHorizontalIcon, Image as ImageIcon } from 'lucide-react';
import { useSite } from '@/lib/site-context';
import { TemplateProvider } from '@/components/TemplateProvider';
import { BlockRenderer } from '@/components/blocks/BlockRenderer';
import { SelectableBlock } from './SelectableBlock';
import { SelectionChrome } from './SelectionChrome';
import { findBlockPath } from './forms/container/types';
import { useEffect, useRef, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { getTemplate } from '@/lib/templates/registry';
import { HeaderNavigation } from '@/components/layout/header/HeaderNavigation';
import { Footer } from '@/components/Footer';
import { BottomNavBar } from '@/components/layout/BottomNavBar';
import { usePageStudio } from './PageStudioContext';
import { DeviceViewProvider } from '@/components/DeviceViewContext';
import { NavigationProvider } from '@/components/layout/NavigationProvider';
import { useIsMobile } from '@/hooks/useIsMobile';
import { MobileBottomSheet } from './MobileBottomSheet';
import { MobileStudioTabBar, type MobileActiveSheet } from './MobileStudioTabBar';
import { InlineEditToolbar, type InlineFieldFocus } from './InlineEditToolbar';
import { BackgroundMediaEditor } from './BackgroundMediaEditor';
import { PageBackground } from '@/components/blocks/PageBackground';

// Lazy-load sidebar panels — only needed when their respective panels are open
const BlockFormRenderer = dynamic(() => import('./BlockFormRenderer').then(m => m.BlockFormRenderer));
const ChromeHeaderPanel = dynamic(() => import('./ChromeSlotPanel').then(m => m.ChromeHeaderPanel));
const ChromeFooterPanel = dynamic(() => import('./ChromeSlotPanel').then(m => m.ChromeFooterPanel));
const ChromeBottomNavPanel = dynamic(() => import('./ChromeSlotPanel').then(m => m.ChromeBottomNavPanel));
const PagesPanel = dynamic(() => import('./LeftSidebarPanels').then(m => m.PagesPanel));
const AddBlocksPanel = dynamic(() => import('./LeftSidebarPanels').then(m => m.AddBlocksPanel));
const SlideOverPanel = dynamic(() => import('./SlideOverPanel').then(m => m.SlideOverPanel));
const LinksPanel = dynamic(() => import('./panels/LinksPanel').then(m => m.LinksPanel));
const FormsPanel = dynamic(() => import('./panels/FormsPanel').then(m => m.FormsPanel));
const ProductsPanel = dynamic(() => import('./panels/ProductsPanel').then(m => m.ProductsPanel));
const SiteInfoPanel = dynamic(() => import('./panels/SiteInfoPanel').then(m => m.SiteInfoPanel));
const BrandingPanel = dynamic(() => import('./panels/BrandingPanel').then(m => m.BrandingPanel));

export function CanvasStudio({
    globalSettings,
    pageSlug,
    pageTitle
}: {
    globalSettings?: any,
    pageSlug?: string;
    pageTitle?: string;
}) {
    const { blocks, setBlocks, selection, setSelection, updateBlockData, deviceView, showGuides } = useEditor();

    // Derived helpers — keep the local names familiar while reading from `selection`.
    const selectedBlockId: string | null = (
        selection.kind === 'blocks' && selection.ids.length === 1 ? selection.ids[0] :
        selection.kind === 'chrome' ? `chrome:${selection.chromeId}` :
        null
    );
    const { tenantSlug, siteId } = useSite();
    const {
        activePageId,
        formData,
        setTitle,
        setSlug,
        setSeoTitle,
        setSeoDescription,
        setSeoImage,
        setSeoNoIndex,
        setPixelFb,
        setPixelGa,
        setPixelTiktok,
        setOverrideSeo,
        setOverridePixels,
        setBackground,
        updateFooterText,
        pageLoading,
        hydratedData,
        isHydrating,
        saving,
        isDirty,
        savePage,
        pages,
        switchPage,
    } = usePageStudio();

    const isMobile = useIsMobile();
    const canvasScrollRef = useRef<HTMLDivElement>(null);
    const rightSidebarRef = useRef<HTMLDivElement>(null);

    // Desktop state
    const [activePanel, setActivePanel] = useState<'page' | 'seo' | 'background' | null>('page');
    const [rightPanelOpen, setRightPanelOpen] = useState(true);
    const [host] = useState(() => typeof window !== 'undefined' ? window.location.host : '');
    const [tooltip, setTooltip] = useState<{ label: string; top: number; left: number; side?: boolean; sideLeft?: boolean } | null>(null);
    const [leftPanel, setLeftPanel] = useState<'pages' | 'add' | 'layers' | null>('layers');
    const [slideOverPanel, setSlideOverPanel] = useState<'links' | 'forms' | 'products' | 'siteinfo' | 'branding' | null>(null);

    // Mobile state
    const [mobileSheet, setMobileSheet] = useState<MobileActiveSheet>(null);

    // Inline field toolbar state
    const [inlineFocus, setInlineFocus] = useState<InlineFieldFocus | null>(null);

    // Scroll right sidebar to focused field and briefly flash it
    useEffect(() => {
        if (!inlineFocus?.field || isMobile) return;
        const sidebar = rightSidebarRef.current;
        if (!sidebar) return;
        const target = sidebar.querySelector<HTMLElement>(`[data-field="${inlineFocus.field}"]`);
        if (!target) return;
        const containerRect = sidebar.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        const offset = targetRect.top - containerRect.top + sidebar.scrollTop - 16;
        sidebar.scrollTo({ top: offset, behavior: 'smooth' });
        target.style.transition = 'background-color 0s';
        target.style.backgroundColor = 'rgba(147, 197, 253, 0.35)'; // blue-300/35
        target.style.borderRadius = '8px';
        requestAnimationFrame(() => {
            target.style.transition = 'background-color 1.2s ease-out';
            target.style.backgroundColor = 'transparent';
        });
        const t = setTimeout(() => {
            target.style.transition = '';
            target.style.backgroundColor = '';
            target.style.borderRadius = '';
        }, 1400);
        return () => clearTimeout(t);
    }, [inlineFocus?.field, isMobile]);

    const toggleLeftPanel = (panel: 'pages' | 'add' | 'layers') => {
        setLeftPanel(prev => prev === panel ? null : panel);
        setSlideOverPanel(null);
    };

    const toggleSlideOverPanel = (panel: 'links' | 'forms' | 'products' | 'siteinfo' | 'branding') => {
        setSlideOverPanel(prev => prev === panel ? null : panel);
        setLeftPanel(null);
    };

    // True when the form panel (block / chrome / slot) should be shown instead
    // of the page-level Title/Slug panel.
    const hasSelectionForForm = selection.kind !== 'none';

    // Desktop: sync activePanel with selection.
    useEffect(() => {
        if (isMobile) return;
        if (hasSelectionForForm) {
            setActivePanel(null);
            setRightPanelOpen(true);
        } else if (activePageId === null) {
            setActivePanel('page');
            setRightPanelOpen(true);
        } else {
            setActivePanel(prev => prev === null ? 'page' : prev);
        }
        // Clear inline field toolbar when selection changes
        setInlineFocus(null);
    }, [isMobile, hasSelectionForForm, activePageId]);

    // Calculate active background config
    const activeBackgroundConfig = useMemo(() => {
        if (formData.background && formData.background.mode !== 'inherit') {
            return formData.background;
        }
        return globalSettings?.globalBackground;
    }, [formData.background, globalSettings?.globalBackground]);

    // Auto-open props sheet on mobile when a block or slot is selected.
    useEffect(() => {
        if (!isMobile) return;
        if (hasSelectionForForm) {
            setMobileSheet('props');
            setActivePanel(null);
        } else {
            setMobileSheet(prev => {
                if (prev === 'props') setActivePanel('page');
                return prev;
            });
        }
    }, [isMobile, hasSelectionForForm]);

    // Scroll canvas to selected block
    useEffect(() => {
        if (!selectedBlockId) return;
        const scrollEl = canvasScrollRef.current;
        if (!scrollEl) return;
        const target = scrollEl.querySelector<HTMLElement>(`[data-block-id="${selectedBlockId}"]`);
        if (!target) return;
        const containerRect = scrollEl.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        const offset = targetRect.top - containerRect.top + scrollEl.scrollTop - 80;
        scrollEl.scrollTo({ top: offset, behavior: 'smooth' });
    }, [selectedBlockId]);

    // Keyboard shortcuts: P = Pages, A = Add, Z = Layers, L = Links, F = Forms, B = Products, I = Site Info, G = Branding (desktop only)
    useEffect(() => {
        if (isMobile) return;
        const handler = (e: KeyboardEvent) => {
            const tag = (e.target as HTMLElement).tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target as HTMLElement).isContentEditable) return;
            if (e.metaKey || e.ctrlKey || e.altKey) return;
            switch (e.key.toLowerCase()) {
                case 'p': toggleLeftPanel('pages'); break;
                case 'a': toggleLeftPanel('add'); break;
                case 'z': toggleLeftPanel('layers'); break;
                case 'l': toggleSlideOverPanel('links'); break;
                case 'f': toggleSlideOverPanel('forms'); break;
                case 'b': toggleSlideOverPanel('products'); break;
                case 'i': toggleSlideOverPanel('siteinfo'); break;
                case 'g': toggleSlideOverPanel('branding'); break;
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isMobile]);

    const templateId = globalSettings?.templateId || 'classic';
    const themeColor = globalSettings?.themeColor;
    const accentColor = globalSettings?.accentColor;
    const borderRadius = globalSettings?.borderRadius || 'large';
    const getRadiusValue = (size: string) => {
        switch (size) {
            case 'none': return '0px';
            case 'small': return '12px';
            case 'medium': return '16px';
            case 'large': return '24px';
            case 'custom': return globalSettings?.customBorderRadius || '24px';
            default: return '24px';
        }
    };
    const radiusValue = getRadiusValue(borderRadius);

    // Get the full template definition (includes components)
    const template = getTemplate(templateId);
    const HeaderComponent = template.components?.Header;
    const BackgroundComponent = template.components?.Background;

    const pageBackgroundColor = template.config.allowThemeColorOverride === false
        ? (globalSettings?.backgroundColor || template.config.colors.background)
        : (globalSettings?.backgroundColor || themeColor || template.config.colors.background);

    const isHomepage = pageSlug === (globalSettings?.homepageSlug || 'home');
    const isSubPage = !isHomepage;

    // ─── Shared canvas content ────────────────────────────────────────────────
    const canvasContent = (
        <div
            ref={canvasScrollRef}
            className={`flex-1 flex items-start relative overflow-y-auto overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [--canvas-bg:rgb(229_231_235)] [--canvas-dot:rgb(0_0_0_/_0.12)] dark:[--canvas-bg:rgb(10_10_10)] dark:[--canvas-dot:rgb(255_255_255_/_0.09)] justify-center ${isMobile ? 'pb-20' : ''}`}
            style={{
                backgroundColor: 'var(--canvas-bg)',
                backgroundImage: 'radial-gradient(circle, var(--canvas-dot) 1.5px, transparent 1.5px)',
                backgroundSize: '20px 20px',
            }}
        >
            {/* Page switch overlay */}
            {pageLoading && (
                <div className="absolute inset-0 z-30 bg-white/60 dark:bg-neutral-950/60 backdrop-blur-[2px] flex items-center justify-center transition-opacity duration-200">
                    <div className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400 text-sm">
                        <Loader2 size={16} className="animate-spin" />
                        Loading page...
                    </div>
                </div>
            )}
            {/* The actual canvas container */}
            <div className={`px-8 py-8 self-start ${deviceView === 'desktop' ? 'w-full' : ''}`}>
            <div className={`${deviceView === 'tablet' ? 'min-w-[768px] max-w-[768px]' : deviceView === 'mobile' ? 'min-w-[375px] max-w-[390px]' : 'w-full min-w-[1024px]'} shadow-2xl ring-1 ring-black/10 dark:ring-white/10 overflow-hidden transition-all duration-300 isolate`}>
                {/* WYSIWYG Renderer — providers are always mounted to prevent context loss during block reorder */}
                <DeviceViewProvider deviceView={deviceView}>
                <TemplateProvider
                    templateId={templateId}
                    themeOverrides={(() => {
                        const isLocked = template.config.allowThemeColorOverride === false;
                        const colorOverrides: Record<string, string> = {};
                        if (themeColor) {
                            if (isLocked) {
                                colorOverrides.primary = themeColor;
                                colorOverrides.accent = themeColor;
                            } else {
                                colorOverrides.background = themeColor;
                                colorOverrides.primary = themeColor;
                            }
                        }
                        if (accentColor) colorOverrides.foreground = accentColor;
                        if (globalSettings?.backgroundColor) colorOverrides.background = globalSettings.backgroundColor;
                        if (globalSettings?.surfaceColor) colorOverrides.surface = globalSettings.surfaceColor;
                        return {
                            borderRadius: radiusValue,
                            ...(globalSettings?.cardVariant ? { cardVariant: globalSettings.cardVariant } : {}),
                            ...(Object.keys(colorOverrides).length > 0 ? { colors: colorOverrides } : {}),
                        };
                    })()}
                >
                {/* Background wrapper inside TemplateProvider so var(--theme-background) is resolved */}
                <div>
                <NavigationProvider siteId={siteId!}>
                        <div className="flex flex-col h-full relative">
                            {/* Top Navbar Slot */}
                            <div
                                data-block-id="chrome:header"
                                className="z-50 w-full cursor-pointer transition-all flex-shrink-0 relative"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setSelection({ kind: 'chrome', chromeId: 'header' });
                                }}
                            >
                                <SelectionChrome
                                    selected={selection.kind === 'chrome' && selection.chromeId === 'header'}
                                    hoverGuide={showGuides && !(selection.kind === 'chrome' && selection.chromeId === 'header')}
                                />
                                {globalSettings?.profile && (
                                    <HeaderNavigation
                                        profile={globalSettings.profile}
                                        siteId={siteId!}
                                        forceMobile={deviceView !== 'desktop'}
                                        isSubPage={isSubPage}
                                        pageTitle={pageTitle}
                                        onNavigate={(href, item) => {
                                            const val: string = item?.value ?? href;
                                            // External URLs — open in new tab
                                            if (val.startsWith('http://') || val.startsWith('https://') || val.startsWith('mailto:') || val.startsWith('tel:')) {
                                                window.open(val, '_blank', 'noopener,noreferrer');
                                                return;
                                            }
                                            // Anchor links — ignore in preview
                                            if (val.startsWith('#')) return;
                                            // Page slugs — find page and switch canvas to it
                                            const slug = val.startsWith('/') ? val.slice(1) : val;
                                            const target = pages.find(p => p.slug === slug);
                                            if (target) switchPage(target.id);
                                        }}
                                    />
                                )}
                            </div>

                            <main
                                className={`w-full flex-1 relative overflow-x-clip ${blocks[0]?.type === 'hero' ? 'pt-0 pb-12' : 'py-12'}`}
                                onClick={() => setSelection({ kind: 'none' })}
                            >
                                {/* Base Background Fallback */}
                                <div className="absolute inset-0 -z-20 pointer-events-none" style={{ backgroundColor: pageBackgroundColor }} />

                                {/* User Custom Background (Page or Global) */}
                                <PageBackground config={activeBackgroundConfig} previewMode={true} />

                                {/* Template Background Decorations */}
                                {BackgroundComponent && (
                                    <div className="absolute inset-0 -z-10 pointer-events-none">
                                        <BackgroundComponent />
                                    </div>
                                )}

                                {/* Constrained container — mirrors SharedPageLayout.
                                    mt-2: small gap so block selection/hover guides clear the header chrome ring. */}
                                <div
                                    className="w-full mx-auto px-4 md:px-6 mt-2 relative z-10 flex flex-col gap-6 min-h-[90vh]"
                                    style={{ maxWidth: 'var(--layout-max-width, 480px)' }}
                                >
                                    {/* Template Header (Profile) */}
                                    {HeaderComponent && globalSettings?.profile && (
                                        <div>
                                            <div className="pointer-events-none">
                                                <HeaderComponent
                                                    profile={globalSettings.profile}
                                                    contact={globalSettings.contact}
                                                    showAddress={globalSettings.showHeaderAddress}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Blocks */}
                                    <div className="grid gap-6" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
                                            {blocks.map((block) => (
                                                <SelectableBlock
                                                    key={block.id}
                                                    blockId={block.id}
                                                    blockType={block.type}
                                                    blockData={block.data}
                                                    onInlineFocus={setInlineFocus}
                                                >
                                                    <BlockRenderer
                                                        block={block}
                                                        templateId={templateId}
                                                        theme={themeColor}
                                                        siteId={siteId}
                                                        previewMode={true}
                                                        showGuides={showGuides}
                                                        isHydrating={isHydrating}
                                                        tenantSlug={tenantSlug || ''}
                                                        links={hydratedData.links || []}
                                                        products={hydratedData.products || []}
                                                        featuredProduct={hydratedData.featuredProduct}
                                                        branches={hydratedData.branches || []}
                                                        linkSettings={hydratedData.linkSettings || globalSettings?.linkSettings}
                                                        productSettings={hydratedData.productSettings || globalSettings?.productSettings}
                                                        reservationServices={hydratedData.reservationServices}
                                                        reservationStaff={hydratedData.reservationStaff}
                                                        reservationSettings={hydratedData.reservationSettings}
                                                        contact={globalSettings?.contact}
                                                        businessHours={globalSettings?.businessHours}
                                                        businessSchedule={globalSettings?.businessSchedule}
                                                        profile={globalSettings?.profile}
                                                        onInlineChange={
                                                            (block.type === 'hero' || block.type === 'heading') && selectedBlockId === block.id
                                                                ? (field, value) => updateBlockData(block.id, { [field]: value })
                                                                : undefined
                                                        }
                                                        onFieldFocus={
                                                            (block.type === 'hero' || block.type === 'heading') && selectedBlockId === block.id
                                                                ? (field, rect) => setInlineFocus({ blockId: block.id, field, rect, currentData: block.data })
                                                                : undefined
                                                        }
                                                        onFieldBlur={
                                                            (block.type === 'hero' || block.type === 'heading') && selectedBlockId === block.id
                                                                ? () => setInlineFocus(null)
                                                                : undefined
                                                        }
                                                    />
                                                </SelectableBlock>
                                            ))}
                                            {blocks.length === 0 && (
                                                <div
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="min-h-[280px] flex items-center justify-center p-12 text-center text-sm font-medium text-neutral-500 dark:text-neutral-400"
                                                >
                                                    <div>
                                                        Start{' '}
                                                        {isMobile ? (
                                                            'adding blocks from the Add tab below to build your page.'
                                                        ) : (
                                                            <>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setLeftPanel('add')}
                                                                    className="text-studio-blue dark:text-studio-blue-muted underline underline-offset-2 hover:opacity-80 transition-opacity mx-1"
                                                                >
                                                                    adding blocks
                                                                </button>
                                                                from the left panel to build your page.
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                    </div>

                                    {/* Site Footer */}
                                    <div
                                        data-block-id="chrome:footer"
                                        className="w-full cursor-pointer transition-all relative"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelection({ kind: 'chrome', chromeId: 'footer' });
                                        }}
                                    >
                                        <SelectionChrome
                                            selected={selection.kind === 'chrome' && selection.chromeId === 'footer'}
                                            hoverGuide={showGuides && !(selection.kind === 'chrome' && selection.chromeId === 'footer')}
                                        />
                                        <div className="pointer-events-none">
                                            <Footer
                                                socialLinks={globalSettings?.socialLinks}
                                                footerText={globalSettings?.footerText}
                                                contact={globalSettings?.contact}
                                                hideContact={globalSettings?.hideFooterContact}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </main>

                            {/* Bottom Nav Slot — only rendered when template enables showBottomNav */}
                            <div
                                data-block-id="chrome:bottomnav"
                                className="relative z-50 w-full flex-shrink-0 cursor-pointer transition-all"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setSelection({ kind: 'chrome', chromeId: 'bottomnav' });
                                }}
                            >
                                <SelectionChrome
                                    selected={selection.kind === 'chrome' && selection.chromeId === 'bottomnav'}
                                    hoverGuide={showGuides && !(selection.kind === 'chrome' && selection.chromeId === 'bottomnav')}
                                />
                                <div className="pointer-events-none">
                                    <BottomNavBar previewMode={true} />
                                </div>
                            </div>
                        </div>
                </NavigationProvider>
                </div>
                </TemplateProvider>
                </DeviceViewProvider>
            </div>
            </div>
        </div>
    );

    // ─── Inline field toolbar (portal — renders above focused field) ──────────
    const inlineToolbar = (
        <InlineEditToolbar
            focus={inlineFocus}
            onAction={(blockId, patch) => {
                updateBlockData(blockId, patch);
                // Keep rect in sync after data change so toolbar doesn't jump
                setInlineFocus(prev => prev ? { ...prev, currentData: { ...prev.currentData, ...patch } } : null);
            }}
            onDismiss={() => setInlineFocus(null)}
        />
    );

    // ─── Right sidebar content (shared between desktop sidebar + mobile sheet) ─
    const rightSidebarContent = (
        <div ref={rightSidebarRef} className="p-4 overflow-y-auto flex-1 custom-scrollbar bg-gray-50 dark:bg-neutral-900">
            {activePanel === 'page' ? (
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-neutral-400 dark:text-neutral-500 mb-1.5">Title</label>
                        <input
                            type="text"
                            value={formData.title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full px-3 py-2 bg-gray-100 dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-neutral-200 text-sm focus:border-blue-500/50 focus:outline-none transition-colors placeholder-neutral-400 dark:placeholder-neutral-600"
                            placeholder="Page Title"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-neutral-400 dark:text-neutral-500 mb-1.5">Slug</label>
                        <div className="flex items-center bg-gray-100 dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded-lg focus-within:border-blue-500/50 transition-colors overflow-hidden">
                            <span className="pl-3 pr-1 text-neutral-400 dark:text-neutral-500 font-medium select-none text-sm">/</span>
                            <input
                                type="text"
                                value={formData.slug}
                                onChange={(e) => setSlug(e.target.value)}
                                className="flex-1 px-1 py-2 bg-transparent border-none focus:ring-0 text-neutral-900 dark:text-neutral-200 text-sm outline-none placeholder-neutral-400 dark:placeholder-neutral-600"
                                placeholder="page-slug"
                            />
                        </div>
                        <p className="text-xs text-neutral-400 dark:text-neutral-600 mt-1.5 truncate">
                            {host || '...'}/{tenantSlug ? `${tenantSlug}/` : ''}{formData.slug || 'page-slug'}
                        </p>
                    </div>
                </div>
            ) : activePanel === 'seo' ? (
                <div className="space-y-5">
                    {/* Tracking Pixels */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">Tracking Pixels</h4>
                            <button
                                type="button"
                                onClick={() => setOverridePixels(!formData.overridePixels)}
                                className={`text-xs font-bold flex items-center gap-1 px-2 py-1 rounded-md transition-colors ${formData.overridePixels
                                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                        : 'bg-gray-100 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500 border border-gray-300 dark:border-neutral-700 hover:text-neutral-700 dark:hover:text-neutral-300'
                                    }`}
                            >
                                {formData.overridePixels ? <CheckSquare size={12} /> : <Square size={12} />}
                                {formData.overridePixels ? 'Overriding' : 'Use Global'}
                            </button>
                        </div>
                        <div className={`space-y-2.5 transition-opacity duration-200 ${formData.overridePixels ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                            {[
                                { label: 'Facebook Pixel ID', value: formData.pixelFb, onChange: setPixelFb, globalVal: globalSettings?.globalPixels?.facebookPixelId },
                                { label: 'Google Analytics ID', value: formData.pixelGa, onChange: setPixelGa, globalVal: globalSettings?.globalPixels?.googleAnalyticsId },
                                { label: 'TikTok Pixel ID', value: formData.pixelTiktok, onChange: setPixelTiktok, globalVal: globalSettings?.globalPixels?.tiktokPixelId },
                            ].map(({ label, value, onChange, globalVal }) => (
                                <div key={label}>
                                    <label className="block text-xs font-medium text-neutral-400 dark:text-neutral-500 mb-1">{label}</label>
                                    <input
                                        type="text"
                                        value={value}
                                        onChange={(e) => onChange(e.target.value)}
                                        className="w-full px-3 py-2 bg-gray-100 dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-neutral-200 text-sm focus:border-blue-500/50 focus:outline-none transition-colors placeholder-neutral-400 dark:placeholder-neutral-600"
                                        placeholder={formData.overridePixels ? 'Enter ID' : (globalVal ? `Global: ${globalVal}` : 'Not Set Globally')}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="border-t border-gray-200 dark:border-neutral-800" />

                    {/* SEO Meta */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">SEO Meta Tags</h4>
                            <button
                                type="button"
                                onClick={() => setOverrideSeo(!formData.overrideSeo)}
                                className={`text-xs font-bold flex items-center gap-1 px-2 py-1 rounded-md transition-colors ${formData.overrideSeo
                                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                        : 'bg-gray-100 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500 border border-gray-300 dark:border-neutral-700 hover:text-neutral-700 dark:hover:text-neutral-300'
                                    }`}
                            >
                                {formData.overrideSeo ? <CheckSquare size={12} /> : <Square size={12} />}
                                {formData.overrideSeo ? 'Overriding' : 'Use Global'}
                            </button>
                        </div>
                        <div className={`space-y-2.5 transition-opacity duration-200 ${formData.overrideSeo ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                            <div>
                                <label className="block text-xs font-medium text-neutral-400 dark:text-neutral-500 mb-1">Meta Title</label>
                                <input
                                    type="text"
                                    value={formData.seoTitle}
                                    onChange={(e) => setSeoTitle(e.target.value)}
                                    className="w-full px-3 py-2 bg-gray-100 dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-neutral-200 text-sm focus:border-blue-500/50 focus:outline-none transition-colors placeholder-neutral-400 dark:placeholder-neutral-600"
                                    placeholder={formData.overrideSeo ? 'Enter Title' : (globalSettings?.globalSeo?.title || 'Use Page Title')}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-neutral-400 dark:text-neutral-500 mb-1">Meta Description</label>
                                <textarea
                                    value={formData.seoDescription}
                                    onChange={(e) => setSeoDescription(e.target.value)}
                                    className="w-full px-3 py-2 bg-gray-100 dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-neutral-200 text-sm focus:border-blue-500/50 focus:outline-none transition-colors placeholder-neutral-400 dark:placeholder-neutral-600 h-20 resize-none"
                                    placeholder={formData.overrideSeo ? 'Enter Description' : (globalSettings?.globalSeo?.description || 'Use Default Description')}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-neutral-400 dark:text-neutral-500 mb-1">OG Image URL</label>
                                <input
                                    type="text"
                                    value={formData.seoImage}
                                    onChange={(e) => setSeoImage(e.target.value)}
                                    className="w-full px-3 py-2 bg-gray-100 dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-neutral-200 text-sm focus:border-blue-500/50 focus:outline-none transition-colors placeholder-neutral-400 dark:placeholder-neutral-600"
                                    placeholder={formData.overrideSeo ? 'Enter Image URL' : (globalSettings?.globalSeo?.image || 'Use Default Image')}
                                />
                            </div>
                            <div className="flex items-center gap-2 pt-1">
                                <input
                                    type="checkbox"
                                    id="canvas-noindex"
                                    checked={formData.seoNoIndex}
                                    onChange={(e) => setSeoNoIndex(e.target.checked)}
                                    className="rounded border-gray-400 dark:border-neutral-600 bg-gray-100 dark:bg-neutral-800 text-blue-500 focus:ring-blue-500/30"
                                />
                                <label htmlFor="canvas-noindex" className="text-xs text-neutral-500 dark:text-neutral-400 cursor-pointer">
                                    Discourage search engines from indexing
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            ) : activePanel === 'background' ? (
                <div className="space-y-4">
                    <div className="text-[10px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">Page Background</div>
                    <BackgroundMediaEditor
                        value={formData.background}
                        onChange={setBackground}
                        allowInherit={true}
                    />
                </div>
            ) : selection.kind === 'chrome' ? (
                selection.chromeId === 'header' ? (
                    <ChromeHeaderPanel />
                ) : selection.chromeId === 'footer' ? (
                    <ChromeFooterPanel
                        footerText={globalSettings?.footerText || ''}
                        onFooterTextChange={updateFooterText}
                    />
                ) : selection.chromeId === 'bottomnav' ? (
                    <ChromeBottomNavPanel />
                ) : null
            ) : selection.kind === 'blocks' && selection.ids.length === 1 ? (
                (() => {
                    const blockId = selection.ids[0];
                    // Top-level block selected — render its form directly.
                    const topLevel = blocks.find(b => b.id === blockId);
                    if (topLevel) {
                        return (
                            <BlockFormRenderer
                                block={topLevel}
                                onChange={updateBlockData}
                                templateId={templateId}
                                onOpenSlideOver={toggleSlideOverPanel}
                            />
                        );
                    }
                    // Nested block selected — render its parent container's form.
                    // The container form derives drill-down state from `selection`.
                    const path = findBlockPath(blocks, blockId);
                    if (path && (path.kind === 'columns-child' || path.kind === 'grid-cell')) {
                        return (
                            <BlockFormRenderer
                                block={path.parentBlock}
                                onChange={updateBlockData}
                                templateId={templateId}
                                onOpenSlideOver={toggleSlideOverPanel}
                            />
                        );
                    }
                    return (
                        <div className="flex flex-col items-center justify-center h-full text-center text-neutral-400 dark:text-neutral-500 gap-3">
                            <Box size={32} className="opacity-20" />
                            <p className="text-sm">Block not found</p>
                        </div>
                    );
                })()
            ) : selection.kind === 'slots' && selection.containerId ? (
                // Empty container slot selected — render the parent container's form.
                // The container form (ColumnsForm / GridForm) reads `selection` to
                // pick the active tab and show the slot's properties / picker.
                (() => {
                    const container = blocks.find(b => b.id === selection.containerId);
                    if (container) {
                        return (
                            <BlockFormRenderer
                                block={container}
                                onChange={updateBlockData}
                                templateId={templateId}
                                onOpenSlideOver={toggleSlideOverPanel}
                            />
                        );
                    }
                    return (
                        <div className="flex flex-col items-center justify-center h-full text-center text-neutral-400 dark:text-neutral-500 gap-3">
                            <Box size={32} className="opacity-20" />
                            <p className="text-sm">Container not found</p>
                        </div>
                    );
                })()
            ) : (
                <div className="flex flex-col items-center justify-center h-full text-center text-neutral-400 dark:text-neutral-500 gap-3">
                    <Box size={32} className="opacity-20" />
                    <p className="text-sm">Select a block on the canvas<br />to edit its properties</p>
                </div>
            )}
        </div>
    );

    // ─── Mobile layout ────────────────────────────────────────────────────────
    if (isMobile) {
        const mobileSheetTitle =
            mobileSheet === 'pages' ? 'Pages' :
            mobileSheet === 'layers' ? 'Layers' :
            mobileSheet === 'add' ? 'Add Block' :
            mobileSheet === 'more' ? 'More' :
            mobileSheet === 'props' ? (
                activePanel === 'page' ? 'Title & Slug' :
                activePanel === 'seo' ? 'SEO & Analytics' :
                'Properties'
            ) : '';

        const mobileSheetIcon =
            mobileSheet === 'pages' ? FileText :
            mobileSheet === 'layers' ? Layers :
            mobileSheet === 'add' ? Plus :
            mobileSheet === 'more' ? MoreHorizontalIcon :
            Settings;

        return (
            <div className="flex flex-col flex-1 overflow-hidden bg-gray-200 dark:bg-neutral-950 relative">
                {/* Full-width canvas */}
                {canvasContent}
                {inlineToolbar}

                {/* Properties sheet header tabs — only shown inside props sheet */}
                <MobileBottomSheet
                    isOpen={mobileSheet !== null}
                    onClose={() => setMobileSheet(null)}
                    title={mobileSheetTitle}
                    icon={mobileSheetIcon}
                    height={mobileSheet === 'props' ? '72vh' : '65vh'}
                >
                    {mobileSheet === 'pages' && <PagesPanel />}
                    {mobileSheet === 'layers' && (
                        <div className="overflow-y-auto flex-1 custom-scrollbar py-1">
                            <BlockManager
                                blocks={blocks}
                                onChange={setBlocks}
                                onAddClick={() => setMobileSheet('add')}
                            />
                        </div>
                    )}
                    {mobileSheet === 'add' && (
                        <AddBlocksPanel
                            templateId={templateId}
                            onAfterAdd={() => setMobileSheet('layers')}
                        />
                    )}
                    {mobileSheet === 'more' && (
                        <div className="p-4 space-y-2">
                            {([
                                { id: 'links' as const, icon: Link2, label: 'Links', description: 'Manage link cards and URLs' },
                                { id: 'forms' as const, icon: FileInput, label: 'Forms', description: 'Manage contact forms' },
                                { id: 'products' as const, icon: ShoppingBag, label: 'Products', description: 'Manage product listings' },
                                { id: 'siteinfo' as const, icon: Globe, label: 'Site Info', description: 'Business info & contact details' },
                                { id: 'branding' as const, icon: Palette, label: 'Branding', description: 'Logos, colors & typography' },
                            ]).map(({ id, icon: Icon, label, description }) => (
                                <button
                                    key={id}
                                    onClick={() => {
                                        setMobileSheet(null);
                                        toggleSlideOverPanel(id);
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-3 bg-gray-100 dark:bg-neutral-800/60 hover:bg-gray-200 dark:hover:bg-neutral-800 rounded-lg transition-colors text-left"
                                >
                                    <div className="w-9 h-9 flex items-center justify-center rounded-lg bg-gray-200 dark:bg-neutral-700/60 text-neutral-600 dark:text-neutral-300 flex-shrink-0">
                                        <Icon size={18} />
                                    </div>
                                    <div>
                                        <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-200">{label}</div>
                                        <div className="text-xs text-neutral-500 dark:text-neutral-500">{description}</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                    {mobileSheet === 'props' && (
                        <div className="flex flex-col h-full">
                            {/* Sub-header tabs for page/seo */}
                            <div className="flex items-center gap-1 px-4 py-2 border-b border-gray-200 dark:border-neutral-800 flex-shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setActivePanel(activePanel === 'page' ? null : 'page')}
                                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors ${activePanel === 'page'
                                            ? 'bg-blue-500/20 text-blue-400'
                                            : 'text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-800'
                                        }`}
                                >
                                    <FileText size={12} />
                                    Page
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActivePanel(activePanel === 'seo' ? null : 'seo')}
                                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors ${activePanel === 'seo'
                                            ? 'bg-blue-500/20 text-blue-400'
                                            : 'text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-800'
                                        }`}
                                >
                                    <BarChart2 size={12} />
                                    SEO
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActivePanel(activePanel === 'background' ? null : 'background')}
                                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors ${activePanel === 'background'
                                            ? 'bg-blue-500/20 text-blue-400'
                                            : 'text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-800'
                                        }`}
                                >
                                    <ImageIcon size={12} />
                                    Background
                                </button>
                                {activePanel && (
                                    <button
                                        type="button"
                                        onClick={() => setActivePanel(null)}
                                        className="ml-auto p-1.5 rounded-md text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                                    >
                                        <X size={12} />
                                    </button>
                                )}
                            </div>
                            {rightSidebarContent}
                        </div>
                    )}
                </MobileBottomSheet>

                {/* Mobile bottom tab bar */}
                <MobileStudioTabBar
                    activeSheet={mobileSheet}
                    onTabPress={(tab) => {
                        setMobileSheet(tab);
                        // When tapping Props with no block selected, show Title & Slug by default
                        if (tab === 'props' && !selectedBlockId) {
                            setActivePanel('page');
                        }
                    }}
                    hasBlockSelected={!!selectedBlockId}
                    isDirty={isDirty}
                    saving={saving}
                    onSave={savePage}
                />

                {/* Slide-over panels (Links / Forms / Products / Site Info / Branding) — mobile */}
                <MobileBottomSheet
                    isOpen={!!slideOverPanel}
                    onClose={() => setSlideOverPanel(null)}
                    title={slideOverPanel === 'links' ? 'Links' : slideOverPanel === 'forms' ? 'Forms' : slideOverPanel === 'products' ? 'Products' : slideOverPanel === 'siteinfo' ? 'Site Info' : slideOverPanel === 'branding' ? 'Branding' : ''}
                    icon={slideOverPanel === 'links' ? Link2 : slideOverPanel === 'forms' ? FileInput : slideOverPanel === 'products' ? ShoppingBag : slideOverPanel === 'siteinfo' ? Globe : slideOverPanel === 'branding' ? Palette : undefined}
                    height="80vh"
                >
                    {slideOverPanel === 'links' && <LinksPanel />}
                    {slideOverPanel === 'forms' && <FormsPanel />}
                    {slideOverPanel === 'products' && <ProductsPanel />}
                    {slideOverPanel === 'siteinfo' && <SiteInfoPanel />}
                    {slideOverPanel === 'branding' && <BrandingPanel />}
                </MobileBottomSheet>
            </div>
        );
    }

    // ─── Desktop layout ───────────────────────────────────────────────────────
    return (
        <div className="flex flex-1 overflow-hidden bg-gray-200 dark:bg-neutral-950">
            {/* Left Sidebar - Icon strip + switchable panel */}
            <div className="flex flex-shrink-0 z-10">
                {/* Icon Strip */}
                <div className="w-12 bg-gray-50 dark:bg-neutral-900 border-r border-gray-200 dark:border-neutral-800 flex flex-col items-center pt-2 gap-0.5">
                    {/* Page editing icons */}
                    {([
                        { id: 'pages' as const, icon: FileText, label: 'Pages', shortcut: 'P' },
                        { id: 'add' as const, icon: Plus, label: 'Add Block', shortcut: 'A' },
                        { id: 'layers' as const, icon: Layers, label: 'Layers', shortcut: 'Z' },
                    ]).map(({ id, icon: Icon, label, shortcut }) => (
                        <button
                            key={id}
                            onClick={() => toggleLeftPanel(id)}
                            onMouseEnter={(e) => {
                                const r = e.currentTarget.getBoundingClientRect();
                                setTooltip({ label: `${label} (${shortcut})`, top: r.top + r.height / 2, left: r.right + 8, side: true });
                            }}
                            onMouseLeave={() => setTooltip(null)}
                            className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors ${
                                leftPanel === id
                                    ? 'bg-blue-500/20 text-blue-400'
                                    : 'text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-800'
                            }`}
                        >
                            <Icon size={17} />
                        </button>
                    ))}

                    {/* Divider */}
                    <div className="w-6 border-t border-gray-200 dark:border-neutral-800 my-1.5" />

                    {/* Feature management icons */}
                    {([
                        { id: 'links' as const, icon: Link2, label: 'Links', shortcut: 'L' },
                        { id: 'forms' as const, icon: FileInput, label: 'Forms', shortcut: 'F' },
                        { id: 'products' as const, icon: ShoppingBag, label: 'Products', shortcut: 'B' },
                        { id: 'siteinfo' as const, icon: Globe, label: 'Site Info', shortcut: 'I' },
                        { id: 'branding' as const, icon: Palette, label: 'Branding', shortcut: 'G' },
                    ]).map(({ id, icon: Icon, label, shortcut }) => (
                        <button
                            key={id}
                            onClick={() => toggleSlideOverPanel(id)}
                            onMouseEnter={(e) => {
                                const r = e.currentTarget.getBoundingClientRect();
                                setTooltip({ label: `${label} (${shortcut})`, top: r.top + r.height / 2, left: r.right + 8, side: true });
                            }}
                            onMouseLeave={() => setTooltip(null)}
                            className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors ${
                                slideOverPanel === id
                                    ? 'bg-blue-500/20 text-blue-400'
                                    : 'text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-800'
                            }`}
                        >
                            <Icon size={17} />
                        </button>
                    ))}
                </div>

                {/* Panel */}
                {leftPanel && (
                    <div className="w-56 bg-gray-50 dark:bg-neutral-900 border-r border-gray-200 dark:border-neutral-800 flex flex-col">
                        {leftPanel === 'pages' && <PagesPanel />}
                        {leftPanel === 'add' && (
                            <AddBlocksPanel
                                templateId={templateId}
                                onAfterAdd={() => setLeftPanel('layers')}
                            />
                        )}
                        {leftPanel === 'layers' && (
                            <>
                                <div className="px-3 h-10 border-b border-gray-200 dark:border-neutral-800 font-bold text-sm text-neutral-900 dark:text-neutral-200 flex items-center gap-2 flex-shrink-0">
                                    <Layers size={15} className="text-neutral-500 dark:text-neutral-400" />
                                    <span className="flex-1">Layers</span>
                                </div>
                                <div className="overflow-y-auto flex-1 custom-scrollbar py-1">
                                    <BlockManager
                                        blocks={blocks}
                                        onChange={setBlocks}
                                        onAddClick={() => setLeftPanel('add')}
                                    />
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Slide-over Panel (Links / Forms / Products / Site Info) */}
            {slideOverPanel && (
                <SlideOverPanel
                    title={slideOverPanel === 'links' ? 'Links' : slideOverPanel === 'forms' ? 'Forms' : slideOverPanel === 'products' ? 'Products' : slideOverPanel === 'siteinfo' ? 'Site Info' : slideOverPanel === 'branding' ? 'Branding' : slideOverPanel}
                    icon={slideOverPanel === 'links' ? Link2 : slideOverPanel === 'forms' ? FileInput : slideOverPanel === 'products' ? ShoppingBag : slideOverPanel === 'siteinfo' ? Globe : slideOverPanel === 'branding' ? Palette : Link2}
                    onClose={() => setSlideOverPanel(null)}
                >
                    {slideOverPanel === 'links' && <LinksPanel />}
                    {slideOverPanel === 'forms' && <FormsPanel />}
                    {slideOverPanel === 'products' && <ProductsPanel />}
                    {slideOverPanel === 'siteinfo' && <SiteInfoPanel />}
                    {slideOverPanel === 'branding' && <BrandingPanel />}
                </SlideOverPanel>
            )}

            {/* Center - Live Canvas */}
            {canvasContent}

            {/* Right Sidebar - Properties */}
            {rightPanelOpen ? (
                <div className="w-80 bg-gray-50 dark:bg-neutral-900 border-l border-gray-200 dark:border-neutral-800 flex flex-col z-10 flex-shrink-0">
                    <div className="px-4 h-10 border-b border-gray-200 dark:border-neutral-800 font-bold text-sm text-neutral-900 dark:text-neutral-200 flex items-center gap-2 flex-shrink-0">
                        <span className="flex-1">
                            {activePanel === 'page' ? 'Title & Slug' : activePanel === 'seo' ? 'SEO & Analytics' : activePanel === 'background' ? 'Page Background' : 'Properties'}
                        </span>
                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                onClick={() => {
                                    if (activePanel === 'page') { setRightPanelOpen(false); setActivePanel(null); }
                                    else { setActivePanel('page'); }
                                }}
                                onMouseEnter={(e) => { const r = e.currentTarget.getBoundingClientRect(); setTooltip({ label: 'Title & Slug', top: r.bottom + 6, left: r.left + r.width / 2 }); }}
                                onMouseLeave={() => setTooltip(null)}
                                className={`p-1.5 rounded-md transition-colors ${activePanel === 'page'
                                        ? 'bg-blue-500/20 text-blue-400'
                                        : 'text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-800'
                                    }`}
                            >
                                <FileText size={14} />
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    if (activePanel === 'seo') { setRightPanelOpen(false); setActivePanel(null); }
                                    else { setActivePanel('seo'); }
                                }}
                                onMouseEnter={(e) => { const r = e.currentTarget.getBoundingClientRect(); setTooltip({ label: 'SEO & Analytics', top: r.bottom + 6, left: r.left + r.width / 2 }); }}
                                onMouseLeave={() => setTooltip(null)}
                                className={`p-1.5 rounded-md transition-colors ${activePanel === 'seo'
                                        ? 'bg-blue-500/20 text-blue-400'
                                        : 'text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-800'
                                    }`}
                            >
                                <BarChart2 size={14} />
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    if (activePanel === 'background') { setRightPanelOpen(false); setActivePanel(null); }
                                    else { setActivePanel('background'); }
                                }}
                                onMouseEnter={(e) => { const r = e.currentTarget.getBoundingClientRect(); setTooltip({ label: 'Page Background', top: r.bottom + 6, left: r.left + r.width / 2 }); }}
                                onMouseLeave={() => setTooltip(null)}
                                className={`p-1.5 rounded-md transition-colors ${activePanel === 'background'
                                        ? 'bg-blue-500/20 text-blue-400'
                                        : 'text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-800'
                                    }`}
                            >
                                <ImageIcon size={14} />
                            </button>
                            <button
                                type="button"
                                onClick={() => { setRightPanelOpen(false); setActivePanel(null); }}
                                onMouseEnter={(e) => { const r = e.currentTarget.getBoundingClientRect(); setTooltip({ label: 'Close panel', top: r.bottom + 6, left: r.left + r.width / 2 }); }}
                                onMouseLeave={() => setTooltip(null)}
                                className="p-1.5 rounded-md text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    </div>
                    {rightSidebarContent}
                </div>
            ) : (
                /* Collapsed right strip */
                <div className="w-12 bg-gray-50 dark:bg-neutral-900 border-l border-gray-200 dark:border-neutral-800 flex flex-col items-center pt-2 gap-0.5 flex-shrink-0 z-10">
                    <button
                        onClick={() => { setRightPanelOpen(true); setActivePanel('page'); }}
                        onMouseEnter={(e) => { const r = e.currentTarget.getBoundingClientRect(); setTooltip({ label: 'Title & Slug', top: r.top + r.height / 2, left: r.left - 8, sideLeft: true }); }}
                        onMouseLeave={() => setTooltip(null)}
                        className="w-9 h-9 flex items-center justify-center rounded-lg text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                    >
                        <FileText size={17} />
                    </button>
                    <button
                        onClick={() => { setRightPanelOpen(true); setActivePanel('seo'); }}
                        onMouseEnter={(e) => { const r = e.currentTarget.getBoundingClientRect(); setTooltip({ label: 'SEO & Analytics', top: r.top + r.height / 2, left: r.left - 8, sideLeft: true }); }}
                        onMouseLeave={() => setTooltip(null)}
                        className="w-9 h-9 flex items-center justify-center rounded-lg text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                    >
                        <BarChart2 size={17} />
                    </button>
                    <button
                        onClick={() => { setRightPanelOpen(true); setActivePanel('background'); }}
                        onMouseEnter={(e) => { const r = e.currentTarget.getBoundingClientRect(); setTooltip({ label: 'Page Background', top: r.top + r.height / 2, left: r.left - 8, sideLeft: true }); }}
                        onMouseLeave={() => setTooltip(null)}
                        className="w-9 h-9 flex items-center justify-center rounded-lg text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                    >
                        <ImageIcon size={17} />
                    </button>
                    <button
                        onClick={() => { setRightPanelOpen(true); setActivePanel(null); }}
                        onMouseEnter={(e) => { const r = e.currentTarget.getBoundingClientRect(); setTooltip({ label: 'Properties', top: r.top + r.height / 2, left: r.left - 8, sideLeft: true }); }}
                        onMouseLeave={() => setTooltip(null)}
                        className="w-9 h-9 flex items-center justify-center rounded-lg text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                    >
                        <Settings size={17} />
                    </button>
                </div>
            )}

            {tooltip && (
                tooltip.side ? (
                    <div
                        className="fixed z-[100] bg-gray-900 text-white text-xs font-bold px-2.5 py-1.5 rounded-lg shadow-xl animate-in fade-in duration-150 pointer-events-none whitespace-nowrap -translate-y-1/2"
                        style={{ top: tooltip.top, left: tooltip.left }}
                    >
                        {tooltip.label}
                        <div className="absolute top-1/2 -translate-y-1/2 -left-1.5 border-4 border-transparent border-r-gray-900" />
                    </div>
                ) : tooltip.sideLeft ? (
                    <div
                        className="fixed z-[100] bg-gray-900 text-white text-xs font-bold px-2.5 py-1.5 rounded-lg shadow-xl animate-in fade-in duration-150 pointer-events-none whitespace-nowrap -translate-y-1/2 -translate-x-full"
                        style={{ top: tooltip.top, left: tooltip.left }}
                    >
                        {tooltip.label}
                        <div className="absolute top-1/2 -translate-y-1/2 -right-1.5 border-4 border-transparent border-l-gray-900" />
                    </div>
                ) : (
                    <div
                        className="fixed z-[100] bg-gray-900 text-white text-xs font-bold px-2.5 py-1.5 rounded-lg shadow-xl animate-in fade-in duration-150 pointer-events-none whitespace-nowrap -translate-x-1/2"
                        style={{ top: tooltip.top, left: tooltip.left }}
                    >
                        {tooltip.label}
                        <div className="absolute -top-1 left-1/2 -translate-x-1/2 border-4 border-transparent border-b-gray-900" />
                    </div>
                )
            )}
            {inlineToolbar}
        </div>
    );
}
