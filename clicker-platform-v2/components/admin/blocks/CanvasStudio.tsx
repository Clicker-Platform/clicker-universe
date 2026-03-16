'use client';

import { useEditor } from './EditorContext';
import { BlockManager } from './BlockManager';
import { Settings, Layers, Box, FileText, BarChart2, CheckSquare, Square, X, Plus } from 'lucide-react';
import { useSite } from '@/lib/site-context';
import { TemplateProvider } from '@/components/TemplateProvider';
import { BlockRenderer } from '@/components/blocks/BlockRenderer';
import { useEffect, useState } from 'react';
import { hydratePageBlocks } from '@/lib/fetchData';
import { BlockFormRenderer } from './BlockFormRenderer';
import { getTemplate } from '@/lib/templates/registry';
import { ChromeHeaderPanel, ChromeFooterPanel, ChromeBottomNavPanel } from './ChromeSlotPanel';
import { ResponsiveNavBar } from '@/components/layout/ResponsiveNavBar';
import { Footer } from '@/components/Footer';
import { BottomNavBar } from '@/components/layout/BottomNavBar';
import { usePageStudio } from './PageStudioContext';
import { PagesPanel, AddBlocksPanel } from './LeftSidebarPanels';

export function CanvasStudio({
    globalSettings,
    pageSlug,
    pageTitle
}: {
    globalSettings?: any,
    pageSlug?: string;
    pageTitle?: string;
}) {
    const { blocks, setBlocks, selectedBlockId, setSelectedBlockId, updateBlockData, deviceView } = useEditor();
    const { tenantSlug, siteId } = useSite();
    const {
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
    } = usePageStudio();
    const [activePanel, setActivePanel] = useState<'page' | 'seo' | null>(null);
    const [host] = useState(() => typeof window !== 'undefined' ? window.location.host : '');
    const [tooltip, setTooltip] = useState<{ label: string; top: number; left: number; side?: boolean } | null>(null);
    const [leftPanel, setLeftPanel] = useState<'pages' | 'add' | 'navigator' | null>('navigator');

    const toggleLeftPanel = (panel: 'pages' | 'add' | 'navigator') => {
        setLeftPanel(prev => prev === panel ? null : panel);
    };

    // Keyboard shortcuts: P = Pages, A = Add, Z = Navigator
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            const tag = (e.target as HTMLElement).tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable) return;
            if (e.metaKey || e.ctrlKey || e.altKey) return;
            switch (e.key.toLowerCase()) {
                case 'p': toggleLeftPanel('pages'); break;
                case 'a': toggleLeftPanel('add'); break;
                case 'z': toggleLeftPanel('navigator'); break;
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const templateId = globalSettings?.templateId || 'classic';
    const themeColor = globalSettings?.themeColor;
    const borderRadius = globalSettings?.borderRadius || 'large';
    const getRadiusValue = (size: string) => {
        switch (size) {
            case 'small': return '12px';
            case 'medium': return '16px';
            case 'large': return '24px';
            default: return '24px';
        }
    };
    const radiusValue = getRadiusValue(borderRadius);
    const [hydratedData, setHydratedData] = useState<any>({});

    // Get the full template definition (includes components)
    const template = getTemplate(templateId);
    const HeaderComponent = template.components?.Header;
    const BackgroundComponent = template.components?.Background;

    const pageBackgroundColor = template.config.allowThemeColorOverride === false
        ? template.config.colors.background
        : (themeColor || template.config.colors.background);

    const isHomepage = pageSlug === (globalSettings?.homepageSlug || 'home');
    const isSubPage = !isHomepage;

    // Auto-hydrate system blocks when needed
    useEffect(() => {
        if (!blocks.length || !siteId) return;

        let isMounted = true;

        hydratePageBlocks(siteId, blocks).then(data => {
            if (isMounted) {
                setHydratedData(data);
            }
        });

        return () => { isMounted = false; };
    }, [blocks, siteId]);

    return (
        <div className="flex flex-1 overflow-hidden bg-neutral-950">
            {/* Left Sidebar - Icon strip + switchable panel */}
            <div className="flex flex-shrink-0 z-10">
                {/* Icon Strip */}
                <div className="w-12 bg-neutral-900 border-r border-neutral-800 flex flex-col items-center pt-2 gap-0.5">
                    {([
                        { id: 'pages' as const, icon: FileText, label: 'Pages', shortcut: 'P' },
                        { id: 'add' as const, icon: Plus, label: 'Add Block', shortcut: 'A' },
                        { id: 'navigator' as const, icon: Layers, label: 'Navigator', shortcut: 'Z' },
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
                                    : 'text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800'
                            }`}
                        >
                            <Icon size={17} />
                        </button>
                    ))}
                </div>

                {/* Panel */}
                {leftPanel && (
                    <div className="w-56 bg-neutral-900 border-r border-neutral-800 flex flex-col">
                        {leftPanel === 'pages' && <PagesPanel />}
                        {leftPanel === 'add' && (
                            <AddBlocksPanel
                                templateId={templateId}
                                onAfterAdd={() => setLeftPanel('navigator')}
                            />
                        )}
                        {leftPanel === 'navigator' && (
                            <>
                                <div className="px-3 h-10 border-b border-neutral-800 font-bold text-sm text-neutral-200 flex items-center gap-2 flex-shrink-0">
                                    <Layers size={15} className="text-neutral-400" />
                                    <span className="flex-1">Navigator</span>
                                </div>
                                <div className="overflow-y-auto flex-1 custom-scrollbar py-1">
                                    <BlockManager
                                        blocks={blocks}
                                        onChange={setBlocks}
                                        templateId={templateId}
                                        onAddClick={() => setLeftPanel('add')}
                                    />
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Center - Live Canvas */}
            <div className="flex-1 flex justify-center bg-neutral-950 relative overflow-y-auto">
                {/* The actual canvas container */}
                <div className={`w-full ${deviceView === 'tablet' ? 'max-w-lg' : deviceView === 'mobile' ? 'max-w-md' : ''} shadow-2xl ring-1 ring-white/10 overflow-hidden transition-all duration-300 my-8 self-start`}>
                    {/* WYSIWYG Renderer */}
                    {blocks.length === 0 ? (
                        <div className="h-96 flex items-center justify-center text-neutral-500 p-12 text-center text-sm font-medium bg-neutral-900">
                            Start adding blocks from the left panel to build your page.
                        </div>
                    ) : (
                        <TemplateProvider
                            templateId={templateId}
                            themeOverrides={{
                                borderRadius: radiusValue,
                                ...(themeColor && template.config.allowThemeColorOverride !== false ? {
                                    colors: { background: themeColor, primary: themeColor }
                                } : {})
                            }}
                        >
                            {/* Full template rendering pipeline - matches live site */}
                            <div className="flex flex-col h-full bg-white relative">
                                {/* Top Navbar Slot */}
                                <div
                                    className={`z-50 w-full cursor-pointer transition-all flex-shrink-0 ${selectedBlockId === 'chrome:header'
                                            ? 'ring-4 ring-blue-500 ring-offset-[-4px]'
                                            : 'hover:ring-2 hover:ring-blue-300'
                                        }`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedBlockId?.('chrome:header');
                                    }}
                                >
                                    {globalSettings?.profile && (
                                        <ResponsiveNavBar
                                            profile={globalSettings.profile}
                                            siteId={siteId!}
                                            forceMobile={true}
                                            isSubPage={isSubPage}
                                            pageTitle={pageTitle}
                                        />
                                    )}
                                </div>

                                <div
                                    className="w-full flex-1 relative overflow-x-clip"
                                    style={{ backgroundColor: pageBackgroundColor }}
                                    onClick={() => setSelectedBlockId?.(null)}
                                >
                                    <div className="relative">
                                        {/* Template Background Decorations */}
                                        {BackgroundComponent && (
                                            <div className="absolute inset-0 z-0 pointer-events-none">
                                                <BackgroundComponent />
                                            </div>
                                        )}

                                        <div className="px-4 py-8">
                                            {/* Template Header (Profile) */}
                                            {HeaderComponent && globalSettings?.profile && (
                                                <div className="relative z-10 mb-8">
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
                                            <div className="relative z-10 grid gap-6" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
                                                {blocks.map((block) => (
                                                    <div
                                                        key={block.id}
                                                        className={`min-w-0 relative transition-all ${block.type === 'hero' ? '' : 'rounded-lg'} ${selectedBlockId === block.id
                                                                ? 'ring-1 ring-blue-500/40 shadow-md z-20'
                                                                : 'hover:ring-1 hover:ring-blue-400/30 cursor-pointer'
                                                            }`}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedBlockId?.(block.id);
                                                        }}
                                                    >
                                                        <div className="pointer-events-none">
                                                            <BlockRenderer
                                                                block={block}
                                                                templateId={templateId}
                                                                theme={themeColor}
                                                                siteId={siteId}
                                                                previewMode={true}
                                                                tenantSlug={tenantSlug || ''}
                                                                links={hydratedData.links || []}
                                                                products={hydratedData.products || []}
                                                                featuredProduct={hydratedData.featuredProduct}
                                                                branches={hydratedData.branches || []}
                                                                linkSettings={hydratedData.linkSettings || globalSettings?.linkSettings}
                                                                productSettings={hydratedData.productSettings || globalSettings?.productSettings}
                                                                contact={globalSettings?.contact}
                                                                businessHours={globalSettings?.businessHours}
                                                                businessSchedule={globalSettings?.businessSchedule}
                                                                profile={globalSettings?.profile}
                                                            />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Site Footer */}
                                        <div
                                            className={`relative z-10 w-full cursor-pointer transition-all ${selectedBlockId === 'chrome:footer'
                                                    ? 'ring-4 ring-blue-500 ring-offset-[-4px]'
                                                    : 'hover:ring-2 hover:ring-blue-300'
                                                }`}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedBlockId?.('chrome:footer');
                                            }}
                                        >
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
                                </div>

                                {/* Bottom Nav Slot — only rendered when template enables showBottomNav */}
                                <div
                                    className={`relative z-50 w-full flex-shrink-0 cursor-pointer transition-all ${selectedBlockId === 'chrome:bottomnav'
                                            ? 'ring-4 ring-blue-500 ring-offset-[-4px]'
                                            : 'hover:ring-2 hover:ring-blue-300'
                                        }`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedBlockId?.('chrome:bottomnav');
                                    }}
                                >
                                    <div className="pointer-events-none">
                                        <BottomNavBar previewMode={true} />
                                    </div>
                                </div>
                            </div>
                        </TemplateProvider>
                    )}
                </div>
            </div>

            {/* Right Sidebar - Properties */}
            <div className="w-80 bg-neutral-900 border-l border-neutral-800 flex flex-col z-10">
                <div className="px-4 h-10 border-b border-neutral-800 font-bold text-sm text-neutral-200 flex items-center gap-2 flex-shrink-0">
                    <Settings size={16} className="text-neutral-400" />
                    <span className="flex-1">
                        {activePanel === 'page' ? 'Title & Slug' : activePanel === 'seo' ? 'SEO & Analytics' : 'Properties'}
                    </span>
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            onClick={() => setActivePanel(activePanel === 'page' ? null : 'page')}
                            onMouseEnter={(e) => { const r = e.currentTarget.getBoundingClientRect(); setTooltip({ label: 'Title & Slug', top: r.bottom + 6, left: r.left + r.width / 2 }); }}
                            onMouseLeave={() => setTooltip(null)}
                            className={`p-1.5 rounded-md transition-colors ${activePanel === 'page'
                                    ? 'bg-blue-500/20 text-blue-400'
                                    : 'text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800'
                                }`}
                        >
                            <FileText size={14} />
                        </button>
                        <button
                            type="button"
                            onClick={() => setActivePanel(activePanel === 'seo' ? null : 'seo')}
                            onMouseEnter={(e) => { const r = e.currentTarget.getBoundingClientRect(); setTooltip({ label: 'SEO & Analytics', top: r.bottom + 6, left: r.left + r.width / 2 }); }}
                            onMouseLeave={() => setTooltip(null)}
                            className={`p-1.5 rounded-md transition-colors ${activePanel === 'seo'
                                    ? 'bg-blue-500/20 text-blue-400'
                                    : 'text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800'
                                }`}
                        >
                            <BarChart2 size={14} />
                        </button>
                        {activePanel && (
                            <button
                                type="button"
                                onClick={() => setActivePanel(null)}
                                onMouseEnter={(e) => { const r = e.currentTarget.getBoundingClientRect(); setTooltip({ label: 'Close', top: r.bottom + 6, left: r.left + r.width / 2 }); }}
                                onMouseLeave={() => setTooltip(null)}
                                className="p-1.5 rounded-md text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>
                </div>
                <div className="p-4 overflow-y-auto flex-1 custom-scrollbar bg-neutral-900">
                    {activePanel === 'page' ? (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-neutral-500 mb-1.5">Title</label>
                                <input
                                    type="text"
                                    value={formData.title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 text-sm focus:border-blue-500/50 focus:outline-none transition-colors placeholder-neutral-600"
                                    placeholder="Page Title"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-neutral-500 mb-1.5">Slug</label>
                                <div className="flex items-center bg-neutral-800 border border-neutral-700 rounded-lg focus-within:border-blue-500/50 transition-colors overflow-hidden">
                                    <span className="pl-3 pr-1 text-neutral-500 font-medium select-none text-sm">/</span>
                                    <input
                                        type="text"
                                        value={formData.slug}
                                        onChange={(e) => setSlug(e.target.value)}
                                        className="flex-1 px-1 py-2 bg-transparent border-none focus:ring-0 text-neutral-200 text-sm outline-none placeholder-neutral-600"
                                        placeholder="page-slug"
                                    />
                                </div>
                                <p className="text-xs text-neutral-600 mt-1.5 truncate">
                                    {host || '...'}/{tenantSlug ? `${tenantSlug}/` : ''}{formData.slug || 'page-slug'}
                                </p>
                            </div>
                        </div>
                    ) : activePanel === 'seo' ? (
                        <div className="space-y-5">
                            {/* Tracking Pixels */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-xs font-bold text-neutral-300 uppercase tracking-wider">Tracking Pixels</h4>
                                    <button
                                        type="button"
                                        onClick={() => setOverridePixels(!formData.overridePixels)}
                                        className={`text-xs font-bold flex items-center gap-1 px-2 py-1 rounded-md transition-colors ${formData.overridePixels
                                                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                                : 'bg-neutral-800 text-neutral-500 border border-neutral-700 hover:text-neutral-300'
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
                                            <label className="block text-xs font-medium text-neutral-500 mb-1">{label}</label>
                                            <input
                                                type="text"
                                                value={value}
                                                onChange={(e) => onChange(e.target.value)}
                                                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 text-sm focus:border-blue-500/50 focus:outline-none transition-colors placeholder-neutral-600"
                                                placeholder={formData.overridePixels ? 'Enter ID' : (globalVal ? `Global: ${globalVal}` : 'Not Set Globally')}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="border-t border-neutral-800" />

                            {/* SEO Meta */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-xs font-bold text-neutral-300 uppercase tracking-wider">SEO Meta Tags</h4>
                                    <button
                                        type="button"
                                        onClick={() => setOverrideSeo(!formData.overrideSeo)}
                                        className={`text-xs font-bold flex items-center gap-1 px-2 py-1 rounded-md transition-colors ${formData.overrideSeo
                                                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                                : 'bg-neutral-800 text-neutral-500 border border-neutral-700 hover:text-neutral-300'
                                            }`}
                                    >
                                        {formData.overrideSeo ? <CheckSquare size={12} /> : <Square size={12} />}
                                        {formData.overrideSeo ? 'Overriding' : 'Use Global'}
                                    </button>
                                </div>
                                <div className={`space-y-2.5 transition-opacity duration-200 ${formData.overrideSeo ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                                    <div>
                                        <label className="block text-xs font-medium text-neutral-500 mb-1">Meta Title</label>
                                        <input
                                            type="text"
                                            value={formData.seoTitle}
                                            onChange={(e) => setSeoTitle(e.target.value)}
                                            className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 text-sm focus:border-blue-500/50 focus:outline-none transition-colors placeholder-neutral-600"
                                            placeholder={formData.overrideSeo ? 'Enter Title' : (globalSettings?.globalSeo?.title || 'Use Page Title')}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-neutral-500 mb-1">Meta Description</label>
                                        <textarea
                                            value={formData.seoDescription}
                                            onChange={(e) => setSeoDescription(e.target.value)}
                                            className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 text-sm focus:border-blue-500/50 focus:outline-none transition-colors placeholder-neutral-600 h-20 resize-none"
                                            placeholder={formData.overrideSeo ? 'Enter Description' : (globalSettings?.globalSeo?.description || 'Use Default Description')}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-neutral-500 mb-1">OG Image URL</label>
                                        <input
                                            type="text"
                                            value={formData.seoImage}
                                            onChange={(e) => setSeoImage(e.target.value)}
                                            className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 text-sm focus:border-blue-500/50 focus:outline-none transition-colors placeholder-neutral-600"
                                            placeholder={formData.overrideSeo ? 'Enter Image URL' : (globalSettings?.globalSeo?.image || 'Use Default Image')}
                                        />
                                    </div>
                                    <div className="flex items-center gap-2 pt-1">
                                        <input
                                            type="checkbox"
                                            id="canvas-noindex"
                                            checked={formData.seoNoIndex}
                                            onChange={(e) => setSeoNoIndex(e.target.checked)}
                                            className="rounded border-neutral-600 bg-neutral-800 text-blue-500 focus:ring-blue-500/30"
                                        />
                                        <label htmlFor="canvas-noindex" className="text-xs text-neutral-400 cursor-pointer">
                                            Discourage search engines from indexing
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : selectedBlockId?.startsWith('chrome:') ? (
                        selectedBlockId === 'chrome:header' ? (
                            <ChromeHeaderPanel siteId={siteId!} />
                        ) : selectedBlockId === 'chrome:footer' ? (
                            <ChromeFooterPanel
                                footerText={globalSettings?.footerText || ''}
                                onFooterTextChange={(val) => { console.log("Save footer:", val) }}
                            />
                        ) : selectedBlockId === 'chrome:bottomnav' ? (
                            <ChromeBottomNavPanel />
                        ) : null
                    ) : selectedBlockId ? (
                        blocks.find(b => b.id === selectedBlockId) ? (
                            <BlockFormRenderer
                                block={blocks.find(b => b.id === selectedBlockId)!}
                                onChange={updateBlockData}
                                templateId={templateId}
                            />
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-center text-neutral-500 gap-3">
                                <Box size={32} className="opacity-20" />
                                <p className="text-sm">Block not found</p>
                            </div>
                        )
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-center text-neutral-500 gap-3">
                            <Box size={32} className="opacity-20" />
                            <p className="text-sm">Select a block on the canvas<br />to edit its properties</p>
                        </div>
                    )}
                </div>
            </div>

            {tooltip && (
                tooltip.side ? (
                    <div
                        className="fixed z-[100] bg-gray-900 text-white text-xs font-bold px-2.5 py-1.5 rounded-lg shadow-xl animate-in fade-in duration-150 pointer-events-none whitespace-nowrap -translate-y-1/2"
                        style={{ top: tooltip.top, left: tooltip.left }}
                    >
                        {tooltip.label}
                        <div className="absolute top-1/2 -translate-y-1/2 -left-1.5 border-4 border-transparent border-r-gray-900" />
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
        </div>
    );
}
