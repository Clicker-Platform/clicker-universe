'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
// @ts-ignore
import { doc, getDoc } from 'firebase/firestore';
import { writeSiteSettings } from '@/lib/admin/siteSettings';
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
import { purgeTenantCache } from '@/lib/admin/purgeCache';
import { logger } from '@/lib/logger-edge';

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
        cardVariant: undefined,
        navigation: { topNav: [], bottomNav: [] }
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');

    // Template Management State
    const [templates, setTemplates] = useState<TemplateDocument[]>([]);
    const [seeding, setSeeding] = useState(false);

    useEffect(() => {
        if (!siteId) return;
        fetchSettings();
        fetchTemplates();
    }, [siteId]);

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
                    customBorderRadius: data.customBorderRadius || '',
                    cardVariant: data.cardVariant || undefined,
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
            logger.error('admin.template.settings.fetch.failed', { siteId, error });
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
            const payload = Object.fromEntries(
                Object.entries(settings).filter(([, v]) => v !== undefined)
            );
            await writeSiteSettings(siteId, payload);
            purgeTenantCache(siteId);
            setMessage('Template saved successfully!');
            setTimeout(() => setMessage(''), 3000);
        } catch (error) {
            logger.error('admin.template.save.failed', { siteId, error });
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
            logger.error('admin.template.seed.failed', { siteId, error });
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
            <h1 className="text-2xl font-bold text-gray-900 dark:text-neutral-100 mb-8 flex items-center gap-3">
                <Palette size={26} />
                Template
            </h1>

            {message && (
                <div className={`p-4 rounded-lg mb-6 font-bold ${message.includes('Error') ? 'bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400' : 'bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-400'}`}>
                    {message}
                </div>
            )}

            <div className="grid grid-cols-1 gap-8 items-start">
                <div className="flex flex-col gap-6">
                    {/* Editor Form */}
                    <form onSubmit={handleSave} className={`space-y-6 bg-white dark:bg-neutral-900 p-8 rounded-lg border border-gray-200 dark:border-neutral-800 h-fit transition-opacity duration-200 ${saving ? 'opacity-50 pointer-events-none' : ''}`}>

                                            <div className="space-y-8 animate-fade-in">
                                <div>
                                    <div className="flex items-center justify-between mb-4">
                                        <div>
                                            <label className="block text-gray-900 dark:text-neutral-100 font-bold text-lg">Template Gallery</label>
                                            <p className="text-sm text-gray-500 dark:text-neutral-500 mt-1">
                                                Choose a comprehensive design package.
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleSeed}
                                            disabled={seeding}
                                            className="text-xs flex items-center gap-1 text-gray-400 dark:text-neutral-600 hover:text-brand-dark transition-colors"
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
                                                        });
                                                    }}
                                                    className={`
                                                    group relative flex flex-col p-5 rounded-lg transition-all duration-300 text-left overflow-hidden
                                                    border
                                                    ${isSelected
                                                            ? (template.id === 'sojourner' ? 'border-brand-green bg-white dark:bg-neutral-900 shadow-md ring-1 ring-brand-green' : 'border-brand-dark bg-white dark:bg-neutral-900 shadow-md')
                                                            : 'border-gray-100 dark:border-neutral-800/50 hover:border-gray-300 dark:hover:border-neutral-700 hover:bg-white dark:bg-neutral-900'
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
                                                                className="w-8 h-8 rounded-full border-2 border-white"
                                                                style={{ backgroundColor: template.config.colors.primary }}
                                                            />
                                                            <div
                                                                className="w-8 h-8 rounded-full border-2 border-white"
                                                                style={{ backgroundColor: template.config.colors.foreground }}
                                                            />
                                                        </div>

                                                        {isSelected && (
                                                            <div className="bg-studio-blue text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider">
                                                                Active
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="relative z-10">
                                                        <h3 className="font-bold text-lg text-brand-dark">{template.name}</h3>
                                                        <div className="flex flex-wrap gap-2 mt-2">
                                                            <span className="inline-flex items-center px-2 py-1 rounded-md bg-gray-100 dark:bg-neutral-800 text-xs font-medium text-gray-600 dark:text-neutral-400">
                                                                {getLayoutDescription(template.id, template.config)}
                                                            </span>
                                                            {template.tier === 'premium' && (
                                                                <span className="inline-flex items-center px-2 py-1 rounded-md bg-yellow-100 text-yellow-800 text-xs font-bold">
                                                                    PRO
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-gray-400 dark:text-neutral-600 mt-3 leading-relaxed">
                                                            {template.description}
                                                        </p>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {allowColorOverride ? (
                                    <>
                                        {/* Standard templates: full background + accent control */}
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
                                                            group relative flex flex-col items-center gap-3 p-4 rounded-lg border transition-all duration-200
                                                            ${isSelected
                                                                    ? 'border-brand-dark bg-gray-50 dark:bg-neutral-800/50'
                                                                    : 'border-gray-100 dark:border-neutral-800/50 hover:border-gray-200 dark:hover:border-neutral-700 hover:'
                                                                }
                                                        `}
                                                        >
                                                            <div className="w-full aspect-square rounded-lg shadow-inner relative overflow-hidden flex items-center justify-center" style={{ backgroundColor: theme.bg }}>
                                                                <div className="w-8 h-8 rounded-full" style={{ backgroundColor: theme.accent }}></div>
                                                            </div>
                                                            <span className={`text-sm font-bold ${isSelected ? 'text-brand-dark' : 'text-gray-500 dark:text-neutral-500'}`}>{theme.name}</span>
                                                            {isSelected && (
                                                                <div className="absolute top-3 right-3 w-4 h-4 bg-brand-dark rounded-full border border-white animate-fade-in"></div>
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
                                                        className="w-12 h-12 rounded-lg border border-gray-200 dark:border-neutral-700 p-1 cursor-pointer"
                                                    />
                                                    <span className="text-sm font-mono text-gray-500 dark:text-neutral-500 uppercase">{settings.themeColor || '#B6FF2E'}</span>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-brand-dark font-bold mb-2">Custom Accent Color</label>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="color"
                                                        value={settings.accentColor || '#0E3B2E'}
                                                        onChange={(e) => setSettings({ ...settings, accentColor: e.target.value })}
                                                        className="w-12 h-12 rounded-lg border border-gray-200 dark:border-neutral-700 p-1 cursor-pointer"
                                                    />
                                                    <span className="text-sm font-mono text-gray-500 dark:text-neutral-500 uppercase">{settings.accentColor || '#0E3B2E'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        {/* Locked-background templates (MRB, MRB-Light): accent color only */}
                                        <div>
                                            <label className="block text-brand-dark font-bold mb-1">Accent Color</label>
                                            <p className="text-xs text-gray-400 dark:text-neutral-500 mb-3">
                                                Customize the accent color. Background and surface colors are set by the template.
                                            </p>
                                            <div className="grid grid-cols-3 gap-3">
                                                {(settings.templateId === 'mrb-light' ? [
                                                    { name: 'Terracotta', color: '#c2693a' },
                                                    { name: 'Sage', color: '#6b8f71' },
                                                    { name: 'Plum', color: '#7c4f7c' },
                                                    { name: 'Dusty Rose', color: '#c2848a' },
                                                    { name: 'Clay', color: '#b07850' },
                                                    { name: 'Slate Blue', color: '#5a7a9e' },
                                                ] : [
                                                    { name: 'Neon Orange', color: '#ec5b13' },
                                                    { name: 'Electric Blue', color: '#3b82f6' },
                                                    { name: 'Neon Green', color: '#22c55e' },
                                                    { name: 'Hot Pink', color: '#ec4899' },
                                                    { name: 'Gold', color: '#f59e0b' },
                                                    { name: 'Violet', color: '#8b5cf6' },
                                                ]).map((swatch) => {
                                                    const isSelected = settings.themeColor === swatch.color;
                                                    return (
                                                        <button
                                                            key={swatch.name}
                                                            type="button"
                                                            onClick={() => setSettings({ ...settings, themeColor: swatch.color })}
                                                            className={`
                                                                group relative flex flex-col items-center gap-2 p-3 rounded-lg border transition-all duration-200
                                                                ${isSelected
                                                                    ? 'border-brand-dark bg-gray-50 dark:bg-neutral-800/50'
                                                                    : 'border-gray-100 dark:border-neutral-800/50 hover:border-gray-200 dark:hover:border-neutral-700 hover:'
                                                                }
                                                            `}
                                                        >
                                                            <div className="w-full aspect-square rounded-lg" style={{ backgroundColor: swatch.color }} />
                                                            <span className={`text-xs font-bold text-center ${isSelected ? 'text-brand-dark' : 'text-gray-500 dark:text-neutral-500'}`}>{swatch.name}</span>
                                                            {isSelected && (
                                                                <div className="absolute top-2 right-2 w-3 h-3 bg-brand-dark rounded-full border border-white" />
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-brand-dark font-bold mb-0.5">Background</label>
                                                <p className="text-xs text-gray-400 dark:text-neutral-500 mb-2">Page canvas color</p>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="color"
                                                        value={settings.backgroundColor || '#FAF7F2'}
                                                        onChange={(e) => setSettings({ ...settings, backgroundColor: e.target.value })}
                                                        className="w-12 h-12 rounded-lg border border-gray-200 dark:border-neutral-700 p-1 cursor-pointer"
                                                    />
                                                    <span className="text-sm font-mono text-gray-500 dark:text-neutral-500 uppercase">{settings.backgroundColor || '#FAF7F2'}</span>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-brand-dark font-bold mb-0.5">Foreground</label>
                                                <p className="text-xs text-gray-400 dark:text-neutral-500 mb-2">Text, icons & inverted panels</p>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="color"
                                                        value={settings.accentColor || '#2A2724'}
                                                        onChange={(e) => setSettings({ ...settings, accentColor: e.target.value })}
                                                        className="w-12 h-12 rounded-lg border border-gray-200 dark:border-neutral-700 p-1 cursor-pointer"
                                                    />
                                                    <span className="text-sm font-mono text-gray-500 dark:text-neutral-500 uppercase">{settings.accentColor || '#2A2724'}</span>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-brand-dark font-bold mb-0.5">Surface</label>
                                                <p className="text-xs text-gray-400 dark:text-neutral-500 mb-2">Cards & input fields</p>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="color"
                                                        value={settings.surfaceColor || '#FFFFFF'}
                                                        onChange={(e) => setSettings({ ...settings, surfaceColor: e.target.value })}
                                                        className="w-12 h-12 rounded-lg border border-gray-200 dark:border-neutral-700 p-1 cursor-pointer"
                                                    />
                                                    <span className="text-sm font-mono text-gray-500 dark:text-neutral-500 uppercase">{settings.surfaceColor || '#FFFFFF'}</span>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-brand-dark font-bold mb-0.5">Accent</label>
                                                <p className="text-xs text-gray-400 dark:text-neutral-500 mb-2">Buttons & brand highlights</p>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="color"
                                                        value={settings.themeColor || '#c2693a'}
                                                        onChange={(e) => setSettings({ ...settings, themeColor: e.target.value })}
                                                        className="w-12 h-12 rounded-lg border border-gray-200 dark:border-neutral-700 p-1 cursor-pointer"
                                                    />
                                                    <span className="text-sm font-mono text-gray-500 dark:text-neutral-500 uppercase">{settings.themeColor || '#c2693a'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}

                                <div>
                                    <label className="block text-brand-dark font-bold mb-2">Corner Radius</label>
                                    <div className="flex bg-gray-100 dark:bg-neutral-800 p-1 rounded-lg">
                                        {(['none', 'small', 'medium', 'large', 'custom'] as const).map((size) => (
                                            <button
                                                key={size}
                                                type="button"
                                                onClick={() => setSettings({ ...settings, borderRadius: size })}
                                                className={`
                                                flex-1 py-2 rounded-lg font-bold text-sm capitalize transition-all
                                                ${(settings.borderRadius || 'large') === size
                                                        ? 'bg-white dark:bg-neutral-900 text-brand-dark'
                                                        : 'text-gray-500 dark:text-neutral-500 hover:text-gray-700 dark:hover:text-neutral-200'
                                                    }
                                            `}
                                            >
                                                {size}
                                            </button>
                                        ))}
                                    </div>
                                    {settings.borderRadius === 'custom' && (
                                        <div className="mt-2 flex items-center gap-2">
                                            <input
                                                type="text"
                                                value={settings.customBorderRadius || ''}
                                                onChange={(e) => setSettings({ ...settings, customBorderRadius: e.target.value })}
                                                placeholder="e.g. 8px, 1rem, 50%"
                                                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 text-sm focus:border-gray-400 outline-none font-mono"
                                            />
                                            <span className="text-xs text-gray-400 dark:text-neutral-500 whitespace-nowrap">any CSS value</span>
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-brand-dark font-bold mb-2">Card Shadow</label>
                                    <div className="flex bg-gray-100 dark:bg-neutral-800 p-1 rounded-lg">
                                        {(['outlined', 'shadow', 'flat'] as const).map((variant) => (
                                            <button
                                                key={variant}
                                                type="button"
                                                onClick={() => setSettings({ ...settings, cardVariant: variant })}
                                                className={`
                                                flex-1 py-2 rounded-lg font-bold text-sm capitalize transition-all
                                                ${(settings.cardVariant || 'outlined') === variant
                                                        ? 'bg-white dark:bg-neutral-900 text-brand-dark'
                                                        : 'text-gray-500 dark:text-neutral-500 hover:text-gray-700 dark:hover:text-neutral-200'
                                                    }
                                            `}
                                            >
                                                {variant}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-brand-dark font-bold mb-2">Typography</label>
                                    <select
                                        value={settings.fontFamily || 'Plus Jakarta Sans'}
                                        onChange={(e) => setSettings({ ...settings, fontFamily: e.target.value })}
                                        className="w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-gray-400 outline-none font-medium"
                                    >
                                        <option value="Plus Jakarta Sans">Plus Jakarta Sans (Default)</option>
                                        <option value="Inter">Inter</option>
                                        <option value="Playfair Display">Playfair Display (Serif)</option>
                                        <option value="Space Mono">Space Mono (Code)</option>
                                        <option value="Poppins">Poppins</option>
                                    </select>
                                </div>
                            </div>

                        <div className="pt-4 border-t border-gray-100 dark:border-neutral-800/50">
                            <SubmitButton isLoading={saving} label="Save Changes" className="w-full bg-studio-blue text-white py-4 rounded-lg font-bold hover:bg-studio-blue/85 transition-all shadow-lg active:scale-[0.98]" />
                        </div>
                    </form>
                </div>

            </div>
        </div>
    );
}
