'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { writeSiteSettings } from '@/lib/admin/siteSettings';
import { useSite } from '@/lib/site-context';
import { usePageStudio } from '@/components/admin/blocks/PageStudioContext';
import { SiteSettings, SocialLinkItem } from '@/data/mockData';
import { CompactImageUpload } from '@/components/admin/CompactImageUpload';
import { SubmitButton } from '@/components/admin/SubmitButton';
import { purgeTenantCache } from '@/lib/admin/purgeCache';
import {
    Globe, Search, ImageIcon, Instagram, Facebook, Linkedin, Twitter,
    Youtube, Video, Plus, Trash2, ChevronDown, ChevronRight, Loader2, Check
} from 'lucide-react';

// ── Shared styles ─────────────────────────────────────────────────────────

const inputClass = "w-full px-3 py-2 bg-gray-100 dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded-lg text-sm text-neutral-900 dark:text-neutral-200 placeholder-neutral-400 dark:placeholder-neutral-600 focus:border-blue-500/50 focus:outline-none transition-colors";
const labelClass = "block text-xs font-medium text-neutral-400 dark:text-neutral-500 mb-1";
const sectionClass = "px-4 py-3 border-b border-gray-200 dark:border-neutral-800/60 space-y-3";

// ── Social platform config ────────────────────────────────────────────────

const PLATFORMS = [
    { name: 'Instagram', icon: Instagram, prefix: 'https://instagram.com/', atHandle: false },
    { name: 'TikTok', icon: Video, prefix: 'https://tiktok.com/@', atHandle: true },
    { name: 'YouTube', icon: Youtube, prefix: 'https://youtube.com/@', atHandle: true },
    { name: 'X', icon: Twitter, prefix: 'https://x.com/', atHandle: false },
    { name: 'LinkedIn', icon: Linkedin, prefix: 'https://linkedin.com/in/', atHandle: false },
    { name: 'Facebook', icon: Facebook, prefix: 'https://facebook.com/', atHandle: false },
    { name: 'Custom', icon: Globe, prefix: '', atHandle: false },
];

function urlToHandle(platform: string, url: string): string {
    const p = PLATFORMS.find(x => x.name === platform);
    if (!p || platform === 'Custom' || !p.prefix) return url;
    if (url.startsWith(p.prefix)) {
        return url.slice(p.prefix.length);
    }
    return url;
}

function handleToUrl(platform: string, handle: string): string {
    const p = PLATFORMS.find(x => x.name === platform);
    if (!p || platform === 'Custom' || !p.prefix) return handle;
    return p.prefix + handle;
}

// ── Preview cards ─────────────────────────────────────────────────────────

function GoogleSearchPreview({ title, description, faviconUrl }: { title: string; description: string; faviconUrl?: string }) {
    return (
        <div className="rounded-lg bg-gray-100 dark:bg-neutral-800/50 border border-gray-200 dark:border-neutral-700/50 p-3">
            <div className="flex items-center gap-1.5 mb-1">
                <div className="w-4 h-4 rounded-full bg-gray-200 dark:bg-neutral-700 overflow-hidden flex items-center justify-center flex-shrink-0">
                    {faviconUrl
                        ? <img src={faviconUrl} className="w-full h-full object-cover" alt="" />
                        : <Globe size={9} className="text-neutral-400 dark:text-neutral-500" />
                    }
                </div>
                <span className="text-[10px] text-neutral-500">example.com</span>
            </div>
            <div className="text-blue-600 dark:text-[#8ab4f8] text-sm font-medium leading-tight truncate mb-0.5">
                {title || 'Page Title'}
            </div>
            <div className="text-[11px] text-neutral-500 dark:text-neutral-400 line-clamp-2 leading-snug">
                {description || 'Your meta description will appear here. Keep it under 160 characters.'}
            </div>
        </div>
    );
}

function SocialSharePreview({ title, description, ogImageUrl }: { title: string; description: string; ogImageUrl?: string }) {
    return (
        <div className="rounded-lg overflow-hidden bg-gray-100 dark:bg-neutral-800/50 border border-gray-200 dark:border-neutral-700/50">
            <div className="aspect-[1.91/1] bg-gray-200 dark:bg-neutral-700/50 flex items-center justify-center">
                {ogImageUrl
                    ? <img src={ogImageUrl} className="w-full h-full object-cover" alt="" />
                    : <div className="flex flex-col items-center text-neutral-400 dark:text-neutral-600 gap-1">
                        <ImageIcon size={28} />
                        <span className="text-[10px]">No Image Set</span>
                    </div>
                }
            </div>
            <div className="p-2.5 bg-gray-100 dark:bg-neutral-800/80">
                <div className="text-[9px] uppercase text-neutral-400 dark:text-neutral-500 mb-0.5">EXAMPLE.COM</div>
                <div className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 leading-tight truncate mb-0.5">
                    {title || 'Page Title'}
                </div>
                <div className="text-[10px] text-neutral-400 dark:text-neutral-500 line-clamp-1">
                    {description || 'Page description...'}
                </div>
            </div>
        </div>
    );
}

// ── Main panel ────────────────────────────────────────────────────────────

export function SiteInfoPanel() {
    const { siteId } = useSite();
    const { updateGlobalSettings, refreshGlobalSettings } = usePageStudio();
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
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    // Social media local state
    const [selectedPlatform, setSelectedPlatform] = useState(PLATFORMS[0].name);
    const [handle, setHandle] = useState('');

    // Pixels section collapsed state
    const [pixelsOpen, setPixelsOpen] = useState(false);

    useEffect(() => {
        if (!siteId) return;
        getDoc(doc(db, 'sites', siteId, 'content', 'siteSettings')).then(snap => {
            if (snap.exists()) setSettings(snap.data() as SiteSettings);
        }).finally(() => setLoading(false));
    }, [siteId]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!siteId) return;
        setSaving(true);
        try {
            await writeSiteSettings(siteId, settings);
            purgeTenantCache(siteId);
            await refreshGlobalSettings();
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (err) {
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    const addSocialLink = () => {
        if (!handle.trim()) return;
        const url = handleToUrl(selectedPlatform, handle.trim());
        const newLink: SocialLinkItem = { platform: selectedPlatform, url };
        const updated = [...(settings.socialLinkItems || []), newLink];
        setSettings(s => ({ ...s, socialLinkItems: updated }));
        updateGlobalSettings({ socialLinks: updated });
        setHandle('');
    };

    const removeSocialLink = (index: number) => {
        const updated = [...(settings.socialLinkItems || [])];
        updated.splice(index, 1);
        setSettings(s => ({ ...s, socialLinkItems: updated }));
        updateGlobalSettings({ socialLinks: updated });
    };

    const currentPlatform = PLATFORMS.find(p => p.name === selectedPlatform) || PLATFORMS[0];
    const isCustom = selectedPlatform === 'Custom';

    if (loading) {
        return (
            <div className="flex items-center justify-center h-32 text-neutral-600">
                <Loader2 size={20} className="animate-spin" />
            </div>
        );
    }

    return (
        <form onSubmit={handleSave} className="flex flex-col h-full overflow-y-auto custom-scrollbar">

            {/* ── Site Identity ─────────────────────────────────────────── */}
            <div className={sectionClass}>
                <div className="text-[10px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">Site Identity</div>

                <div>
                    <label className={labelClass}>Site Title</label>
                    <input
                        value={settings.title || ''}
                        onChange={e => setSettings(s => ({ ...s, title: e.target.value }))}
                        className={inputClass}
                        placeholder="e.g. My Business — Best in Town"
                    />
                </div>

                <div>
                    <label className={labelClass}>Meta Description</label>
                    <textarea
                        value={settings.description || ''}
                        onChange={e => setSettings(s => ({ ...s, description: e.target.value }))}
                        className={`${inputClass} resize-none h-16`}
                        placeholder="Keep it under 160 characters"
                    />
                </div>

                {/* Google Search Preview */}
                <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                        <Search size={11} className="text-neutral-400 dark:text-neutral-600" />
                        <span className="text-[10px] text-neutral-400 dark:text-neutral-600">Google Search Preview</span>
                    </div>
                    <GoogleSearchPreview
                        title={settings.title || ''}
                        description={settings.description || ''}
                        faviconUrl={settings.faviconUrl}
                    />
                </div>

                <div>
                    <label className={labelClass}>Homepage Slug</label>
                    <input
                        value={settings.homepageSlug || ''}
                        onChange={e => setSettings(s => ({ ...s, homepageSlug: e.target.value }))}
                        className={inputClass}
                        placeholder="home"
                    />
                    <p className="text-[10px] text-neutral-400 dark:text-neutral-600 mt-1">Defaults to &apos;home&apos; if empty</p>
                </div>
            </div>

            {/* ── Images ────────────────────────────────────────────────── */}
            <div className={sectionClass}>
                <div className="text-[10px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">Images</div>

                <div>
                    <label className={labelClass}>Favicon</label>
                    <CompactImageUpload
                        label="Upload Favicon"
                        currentUrl={settings.faviconUrl}
                        onUpload={url => setSettings(s => ({ ...s, faviconUrl: url }))}
                        onRemove={() => setSettings(s => ({ ...s, faviconUrl: '' }))}
                    />
                </div>

                <div>
                    <label className={labelClass}>Social Preview Image (OG)</label>
                    <CompactImageUpload
                        label="Upload OG Image"
                        currentUrl={settings.ogImageUrl}
                        onUpload={url => setSettings(s => ({ ...s, ogImageUrl: url }))}
                        onRemove={() => setSettings(s => ({ ...s, ogImageUrl: '' }))}
                    />
                </div>

                {/* Social Share Preview */}
                <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                        <ImageIcon size={11} className="text-neutral-400 dark:text-neutral-600" />
                        <span className="text-[10px] text-neutral-400 dark:text-neutral-600">Social Share Preview</span>
                    </div>
                    <SocialSharePreview
                        title={settings.title || ''}
                        description={settings.description || ''}
                        ogImageUrl={settings.ogImageUrl}
                    />
                </div>
            </div>

            {/* ── Tracking Pixels (collapsible) ─────────────────────────── */}
            <div className="border-b border-gray-200 dark:border-neutral-800/60">
                <button
                    type="button"
                    onClick={() => setPixelsOpen(o => !o)}
                    className="w-full flex items-center justify-between px-4 py-3 text-left"
                >
                    <span className="text-[10px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">Tracking Pixels</span>
                    {pixelsOpen ? <ChevronDown size={13} className="text-neutral-400 dark:text-neutral-600" /> : <ChevronRight size={13} className="text-neutral-400 dark:text-neutral-600" />}
                </button>

                {pixelsOpen && (
                    <div className="px-4 pb-3 space-y-3">
                        <div>
                            <label className={labelClass}>Facebook Pixel ID</label>
                            <input
                                value={settings.pixels?.facebookPixelId || ''}
                                onChange={e => setSettings(s => ({ ...s, pixels: { ...s.pixels, facebookPixelId: e.target.value } }))}
                                className={inputClass}
                                placeholder="1234567890"
                            />
                        </div>
                        <div>
                            <label className={labelClass}>Google Analytics ID</label>
                            <input
                                value={settings.pixels?.googleAnalyticsId || ''}
                                onChange={e => setSettings(s => ({ ...s, pixels: { ...s.pixels, googleAnalyticsId: e.target.value } }))}
                                className={inputClass}
                                placeholder="G-XXXXXXXXXX"
                            />
                        </div>
                        <div>
                            <label className={labelClass}>TikTok Pixel ID</label>
                            <input
                                value={settings.pixels?.tiktokPixelId || ''}
                                onChange={e => setSettings(s => ({ ...s, pixels: { ...s.pixels, tiktokPixelId: e.target.value } }))}
                                className={inputClass}
                                placeholder="CXXXXXXXXXXXX"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* ── Social Media Links ────────────────────────────────────── */}
            <div className={sectionClass}>
                <div className="text-[10px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">Social Media</div>

                {/* Platform picker */}
                <div className="flex flex-wrap gap-1.5">
                    {PLATFORMS.map(p => (
                        <button
                            key={p.name}
                            type="button"
                            onClick={() => setSelectedPlatform(p.name)}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                selectedPlatform === p.name
                                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                    : 'bg-gray-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 border border-gray-300 dark:border-neutral-700 hover:border-gray-400 dark:hover:border-neutral-600'
                            }`}
                        >
                            <p.icon size={13} />
                            {p.name}
                        </button>
                    ))}
                </div>

                {/* Handle / URL input */}
                <div className="flex gap-2">
                    {!isCustom && (
                        <div className="flex items-center px-2 bg-gray-100 dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded-lg border-r-0 rounded-r-none text-xs text-neutral-400 dark:text-neutral-500 whitespace-nowrap">
                            {currentPlatform.atHandle ? '@' : currentPlatform.prefix.replace('https://', '').split('/').filter(Boolean).join('/') + '/'}
                        </div>
                    )}
                    <input
                        value={handle}
                        onChange={e => setHandle(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSocialLink(); } }}
                        className={`${inputClass} flex-1 ${!isCustom ? 'rounded-l-none border-l-0' : ''}`}
                        placeholder={isCustom ? 'https://example.com' : 'yourusername'}
                    />
                    <button
                        type="button"
                        onClick={addSocialLink}
                        disabled={!handle.trim()}
                        className="px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex-shrink-0"
                    >
                        <Plus size={15} />
                    </button>
                </div>

                {/* Added links list */}
                {(settings.socialLinkItems || []).length > 0 ? (
                    <div className="space-y-1.5">
                        {(settings.socialLinkItems || []).map((link, i) => {
                            const platform = PLATFORMS.find(p => p.name === link.platform) || PLATFORMS[PLATFORMS.length - 1];
                            const Icon = platform.icon;
                            const displayHandle = urlToHandle(link.platform, link.url);
                            return (
                                <div key={i} className="flex items-center gap-2 px-2.5 py-2 bg-gray-100 dark:bg-neutral-800/60 rounded-lg border border-gray-200 dark:border-neutral-700/50">
                                    <div className="w-6 h-6 rounded-md bg-gray-200 dark:bg-neutral-700 flex items-center justify-center flex-shrink-0">
                                        <Icon size={13} className="text-neutral-700 dark:text-neutral-300" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-xs font-medium text-neutral-700 dark:text-neutral-300 truncate">
                                            {link.platform === 'Custom' ? displayHandle : (platform.atHandle ? `@${displayHandle}` : displayHandle)}
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => removeSocialLink(i)}
                                        className="p-1 text-neutral-400 dark:text-neutral-600 hover:text-red-400 rounded transition-colors flex-shrink-0"
                                    >
                                        <Trash2 size={13} />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <p className="text-[11px] text-neutral-400 dark:text-neutral-600 text-center py-2">No social links added yet</p>
                )}
            </div>

            {/* ── Save button ───────────────────────────────────────────── */}
            <div className="px-4 py-3 sticky bottom-0 bg-white dark:bg-neutral-900 border-t border-gray-200 dark:border-neutral-800">
                <SubmitButton
                    isLoading={saving}
                    loadingLabel="Saving..."
                    className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                        saved
                            ? 'bg-green-600/20 text-green-400 border border-green-600/30'
                            : 'bg-blue-600 hover:bg-blue-500 text-white'
                    }`}
                >
                    {saved ? <><Check size={15} /> Saved</> : 'Save Changes'}
                </SubmitButton>
            </div>
        </form>
    );
}
