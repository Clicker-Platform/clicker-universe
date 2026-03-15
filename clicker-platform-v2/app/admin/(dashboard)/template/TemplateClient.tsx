'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
// @ts-ignore
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

export default function TemplateClient() {
    const { siteId } = useSite();
    const [settings, setSettings] = useState<SiteSettings>({
        title: '',
        description: '',
        faviconUrl: '',
        ogImageUrl: '',
        themeColor: '#B6FF2E',
        accentColor: '#0E3B2E',
        fontFamily: 'Plus Jakarta Sans',
        templateId: 'classic',
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
    const [realData, setRealData] = useState<any>(null);
    const [seeding, setSeeding] = useState(false);


    useEffect(() => {
        if (!siteId) return;
        fetchSettings();
        fetchTemplates();
        fetchResources();
    }, [siteId]);

    const fetchResources = async () => {
        if (!siteId) return;
        try {
            const [formsSnap, pagesSnap, linksSnap, productsSnap, branchesSnap, featuredSnap, contactSnap, prodSettingsSnap, linkSettingsSnap] = await Promise.all([
                getDocs(collection(db, 'sites', siteId, 'forms')),
                getDocs(collection(db, 'sites', siteId, 'pages')),
                getDocs(collection(db, 'sites', siteId, 'links')),
                getDocs(collection(db, 'sites', siteId, 'products')),
                getDocs(collection(db, 'sites', siteId, 'branches')),
                getDoc(doc(db, 'sites', siteId, 'content', 'featuredProduct')),
                getDoc(doc(db, 'sites', siteId, 'content', 'contact')),
                getDoc(doc(db, 'sites', siteId, 'content', 'productSettings')),
                getDoc(doc(db, 'sites', siteId, 'content', 'linkSettings'))
            ]);

            const fetchedForms = formsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
            const fetchedPages = pagesSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
            const fetchedLinks = linksSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
            const fetchedProducts = productsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
            const fetchedBranches = branchesSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));

            setForms(fetchedForms);
            setPages(fetchedPages);

            setRealData({
                links: fetchedLinks.sort((a, b) => (a.order || 0) - (b.order || 0)),
                products: fetchedProducts,
                branches: fetchedBranches,
                featuredProduct: featuredSnap.exists() ? featuredSnap.data() : null,
                contact: contactSnap.exists() ? contactSnap.data() : null,
                productSettings: prodSettingsSnap.exists() ? prodSettingsSnap.data() : null,
                linkSettings: linkSettingsSnap.exists() ? linkSettingsSnap.data() : null,
                forms: fetchedForms,
                pages: fetchedPages
            });
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
                    templateId: 'classic',
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
            setMessage('Template saved successfully!');
            setTimeout(() => setMessage(''), 3000);
        } catch (error) {
            console.error('Error saving template:', error);
            setMessage('Error saving template');
        } finally {
            setSaving(false);
        }
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

    const currentTemplateDef = templatesToDisplay.find(t => t.id === (settings.templateId || 'classic')) || templatesToDisplay[0];
    const allowColorOverride = currentTemplateDef?.config?.allowThemeColorOverride !== false;

    return (
        <div className="max-w-4xl">
            <h1 className="text-3xl font-black text-brand-dark mb-8 uppercase flex items-center gap-3 relative">
                <Palette size={32} />
                Template
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
                                            {seeding ? 'Seeding...' : 'Seed Templates'}
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {templatesToDisplay.map((template) => {
                                            const isSelected = (settings.templateId || 'classic') === template.id;
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
                                                            templateId: template.id as any,
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

                                {allowColorOverride && (
                                    <>
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
                                    </>
                                )}

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
                                <hr className="border-gray-100" />
                                <div>
                                    <label className="block text-brand-dark font-bold mb-2">Footer Text</label>
                                    <input
                                        type="text"
                                        value={settings.footerText || ''}
                                        onChange={(e) => setSettings({ ...settings, footerText: e.target.value })}
                                        placeholder="© 2024 Your Company"
                                        className="w-full px-4 py-3 rounded-xl border-[2px] border-gray-200 focus:border-brand-dark outline-none font-medium"
                                    />
                                </div>
                            </div>

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
                                template={templatesToDisplay.find(t => t.id === settings.templateId) || templatesToDisplay[0]}
                                settings={settings}
                                realData={realData}
                                siteId={siteId}
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
