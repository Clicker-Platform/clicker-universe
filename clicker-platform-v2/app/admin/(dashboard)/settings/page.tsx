'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { SiteSettings } from '@/data/mockData';
import { Save, Search, Globe, ImageIcon } from 'lucide-react';
import { FormSkeleton } from '@/components/skeletons/FormSkeleton';
import { SocialMediaManager } from '@/components/admin/SocialMediaManager';
import { SubmitButton } from '@/components/admin/SubmitButton';
import { CompactImageUpload } from '@/components/admin/CompactImageUpload';
// ... imports
import { useSite } from '@/lib/site-context';

export default function SettingsPage() {
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
        backgroundImageUrl: ''
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (!siteId) return;
        fetchSettings();
    }, [siteId]);

    const fetchSettings = async () => {
        if (!siteId) return;
        try {
            const snap = await getDoc(doc(db, 'sites', siteId, 'content', 'siteSettings'));
            if (snap.exists()) {
                setSettings(snap.data() as SiteSettings);
            } else {
                // Set defaults if not found
                setSettings({
                    title: 'SunnySide - Fresh Bakes Daily',
                    description: 'Artisanal pastries, strong coffee, and good vibes.',
                    faviconUrl: '',
                    ogImageUrl: '',
                    themeColor: '#B6FF2E',
                    accentColor: '#0E3B2E',
                    fontFamily: 'Plus Jakarta Sans',
                    templateId: 'classic',
                    backgroundImageUrl: ''
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
        setSaving(true);
        setMessage('');

        if (!siteId) {
            setSaving(false);
            return;
        }

        try {
            await setDoc(doc(db, 'sites', siteId, 'content', 'siteSettings'), settings);
            setMessage('Settings saved successfully!');

            // Clear message after 3 seconds
            setTimeout(() => setMessage(''), 3000);
        } catch (err) {
            console.error(err);
            setMessage('Error saving settings');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <FormSkeleton />;

    return (
        <div className="max-w-4xl">
            <h1 className="text-3xl font-black text-brand-dark mb-8 uppercase">Site Settings</h1>

            {message && (
                <div className={`p-4 rounded-xl mb-6 font-bold ${message.includes('Error') ? 'bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400' : 'bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-400'}`}>
                    {message}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Editor Form */}
                <form onSubmit={handleSave} className={`space-y-6 bg-white dark:bg-neutral-900 p-8 rounded-2xl border border-gray-200 dark:border-neutral-800 shadow-sm h-fit transition-opacity duration-200 ${saving ? 'opacity-50 pointer-events-none' : ''}`}>
                    <div>
                        <label className="block text-brand-dark font-bold mb-2">Page Title</label>
                        <p className="text-xs text-gray-500 dark:text-neutral-500 mb-2">Results in 50-60 chars typically work best.</p>
                        <input
                            type="text"
                            value={settings.title}
                            onChange={(e) => setSettings({ ...settings, title: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-gray-400 outline-none font-medium"
                            placeholder="e.g. SunnySide - Best Coffee in Town"
                        />
                    </div>

                    <div>
                        <label className="block text-brand-dark font-bold mb-2">Homepage Slug (Optional)</label>
                        <p className="text-xs text-gray-500 dark:text-neutral-500 mb-2">The slug of the page to act as your homepage. Defaults to 'home' if empty.</p>
                        <input
                            type="text"
                            value={settings.homepageSlug || ''}
                            onChange={(e) => setSettings({ ...settings, homepageSlug: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-gray-400 outline-none font-medium"
                            placeholder="home"
                        />
                    </div>

                    <div>
                        <label className="block text-brand-dark font-bold mb-2">Meta Description</label>
                        <p className="text-xs text-gray-500 dark:text-neutral-500 mb-2">Keep it under 160 characters for best visibility.</p>
                        <textarea
                            value={settings.description}
                            onChange={(e) => setSettings({ ...settings, description: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-gray-400 outline-none font-medium h-24"
                            placeholder="A brief description of your site for search engines."
                        />
                    </div>

                    <div>
                        <label className="block text-brand-dark font-bold mb-2">Favicon</label>
                        <CompactImageUpload
                            label="Upload Favicon"
                            currentUrl={settings.faviconUrl}
                            onUpload={(url) => setSettings({ ...settings, faviconUrl: url })}
                            onRemove={() => setSettings({ ...settings, faviconUrl: '' })}
                        />
                    </div>

                    <div>
                        <label className="block text-brand-dark font-bold mb-2">Social Preview Image (OG Image)</label>
                        <CompactImageUpload
                            label="Upload OG Image"
                            currentUrl={settings.ogImageUrl}
                            onUpload={(url) => setSettings({ ...settings, ogImageUrl: url })}
                            onRemove={() => setSettings({ ...settings, ogImageUrl: '' })}
                        />
                    </div>

                    <div className="border-t-2 border-dashed border-gray-100 dark:border-neutral-800 pt-6">
                        <h3 className="font-bold text-gray-500 dark:text-neutral-500 uppercase text-xs tracking-wider mb-4">SEO & Analytics (Global Defaults)</h3>
                        <div className="space-y-4">
                            <div>
                                <h4 className="text-sm font-bold text-gray-700 dark:text-neutral-300 mb-2">Tracking Pixels</h4>
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-600 dark:text-neutral-400 mb-1">Facebook Pixel ID</label>
                                        <input
                                            type="text"
                                            value={settings.pixels?.facebookPixelId || ''}
                                            onChange={(e) => setSettings({ ...settings, pixels: { ...settings.pixels, facebookPixelId: e.target.value } })}
                                            className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-gray-400 outline-none font-medium text-sm"
                                            placeholder="1234567890"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-600 dark:text-neutral-400 mb-1">Google Analytics ID</label>
                                        <input
                                            type="text"
                                            value={settings.pixels?.googleAnalyticsId || ''}
                                            onChange={(e) => setSettings({ ...settings, pixels: { ...settings.pixels, googleAnalyticsId: e.target.value } })}
                                            className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-gray-400 outline-none font-medium text-sm"
                                            placeholder="G-XXXXXXXXXX"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-600 dark:text-neutral-400 mb-1">TikTok Pixel ID</label>
                                        <input
                                            type="text"
                                            value={settings.pixels?.tiktokPixelId || ''}
                                            onChange={(e) => setSettings({ ...settings, pixels: { ...settings.pixels, tiktokPixelId: e.target.value } })}
                                            className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-gray-400 outline-none font-medium text-sm"
                                            placeholder="CXXXXXXXXXXXX"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Appearance settings moved to /admin/appearance */}

                    <SocialMediaManager
                        links={settings.socialLinkItems || []}
                        onChange={(links) => setSettings({ ...settings, socialLinkItems: links })}
                    />

                    <SubmitButton
                        isLoading={saving}
                        loadingLabel="Saving..."
                        label="Save Changes"
                        className="flex items-center gap-2 bg-brand-dark text-white px-6 py-3 rounded-xl font-bold hover:bg-brand-green hover:text-brand-dark transition-colors w-full justify-center"
                    >
                        <Save size={20} /> Save Changes
                    </SubmitButton>
                </form>

                {/* Live Previews */}
                <div className="space-y-6">
                    <h3 className="font-bold text-gray-500 dark:text-neutral-500 uppercase text-sm tracking-wider">Live Previews</h3>

                    {/* Live Previews - Theme Preview Moved to Appearance */}

                    {/* Google Search Preview */}
                    <div className="bg-white dark:bg-neutral-900 p-6 rounded-2xl border border-gray-200 dark:border-neutral-800 shadow-sm">
                        <div className="flex items-center gap-2 mb-4 text-gray-500 dark:text-neutral-500 text-sm font-medium">
                            <Search size={16} /> Google Search Result
                        </div>
                        <div className="font-sans">
                            <div className="text-sm text-[#202124] flex items-center gap-1 mb-1">
                                <span className="bg-gray-200 dark:bg-neutral-700 rounded-full w-4 h-4 overflow-hidden flex items-center justify-center text-[8px]">
                                    {settings.faviconUrl ? <img src={settings.faviconUrl} className="w-full h-full object-cover" /> : <Globe size={10} />}
                                </span>
                                <span>example.com</span>
                            </div>
                            <div className="text-[#1a0dab] text-xl cursor-pointer hover:underline truncate">
                                {settings.title || 'Page Title'}
                            </div>
                            <div className="text-[#4d5156] text-sm mt-1 line-clamp-2">
                                {settings.description || 'This is how your page description will look in search results. Make it catchy and relevant to attract more visitors.'}
                            </div>
                        </div>
                    </div>

                    {/* Social Media Preview */}
                    <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-200 dark:border-neutral-800 shadow-sm overflow-hidden w-full">
                        <div className="p-4 border-b border-gray-100 dark:border-neutral-800 flex items-center gap-2 text-gray-500 dark:text-neutral-500 text-sm font-medium bg-gray-50 dark:bg-neutral-800/50">
                            <ImageIcon size={16} /> Social Share Preview
                        </div>
                        <div className="bg-gray-100 dark:bg-neutral-800 aspect-[1.91/1] w-full flex items-center justify-center overflow-hidden relative">
                            {settings.ogImageUrl ? (
                                <img src={settings.ogImageUrl} alt="OG Preview" className="w-full h-full object-cover" />
                            ) : (
                                <div className="text-gray-400 dark:text-neutral-600 flex flex-col items-center">
                                    <ImageIcon size={48} />
                                    <span className="text-xs mt-2">No Image Set</span>
                                </div>
                            )}
                        </div>
                        <div className="p-4 bg-[#f0f2f5] dark:bg-neutral-800/50">
                            <div className="text-[10px] uppercase text-gray-500 dark:text-neutral-500 mb-1">EXAMPLE.COM</div>
                            <div className="font-bold text-[#050505] dark:text-neutral-200 leading-tight mb-1 truncate">
                                {settings.title || 'Page Title'}
                            </div>
                            <div className="text-xs text-[#65676b] dark:text-neutral-500 line-clamp-1">
                                {settings.description || 'Page description...'}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
