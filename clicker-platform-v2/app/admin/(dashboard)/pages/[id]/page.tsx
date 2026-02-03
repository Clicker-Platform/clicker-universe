'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from "@/lib/firebase";
import { collection, addDoc, doc, getDoc, updateDoc, deleteDoc, setDoc, serverTimestamp, query, where, getDocs } from "firebase/firestore";
import Link from 'next/link';
import { ArrowLeft, Save, Trash2, Loader2, AlertCircle, ChevronDown, ChevronRight, CheckSquare, Square, Home } from 'lucide-react';
import { Page, PageBlock, SiteSettings } from '@/data/mockData';
import { use } from "react";
import { fetchSiteSettings } from '@/lib/fetchData';
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog';
import { BlockManager } from '@/components/admin/blocks/BlockManager';
import { useSite } from '@/lib/site-context';

export default function PageEditor({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const { id } = use(params);
    const { siteId, tenantSlug } = useSite();
    const isNew = id === 'create';

    const [loading, setLoading] = useState(!isNew);
    const [saving, setSaving] = useState(false);
    const [title, setTitle] = useState('');
    const [slug, setSlug] = useState('');
    const [content, setContent] = useState(''); // Legacy HTML
    const [blocks, setBlocks] = useState<PageBlock[]>([]); // New Blocks
    const [error, setError] = useState<string | null>(null);
    const [host, setHost] = useState('');
    const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [homepageDialogOpen, setHomepageDialogOpen] = useState(false);
    const [isSettingHomepage, setIsSettingHomepage] = useState(false);

    // SEO & Analytics State
    const [seoTitle, setSeoTitle] = useState('');
    const [seoDescription, setSeoDescription] = useState('');
    const [seoImage, setSeoImage] = useState('');
    const [seoNoIndex, setSeoNoIndex] = useState(false);
    const [pixelFb, setPixelFb] = useState('');
    const [pixelGa, setPixelGa] = useState('');
    const [pixelTiktok, setPixelTiktok] = useState('');
    const [showSeoSettings, setShowSeoSettings] = useState(false);
    const [globalSettings, setGlobalSettings] = useState<SiteSettings | null>(null);
    const [overridePixels, setOverridePixels] = useState(false);
    const [overrideSeo, setOverrideSeo] = useState(false);

    useEffect(() => {
        setHost(window.location.host);

        // Fetch Global Settings
        if (siteId) {
            fetchSiteSettings(siteId).then(settings => {
                setGlobalSettings(settings);
            });
        }
    }, [siteId]);

    // ... (rest of the file until handleDelete)

    const handleDelete = async () => {
        setDeleteDialogOpen(true);
    };

    const handleConfirmDelete = async () => {
        setIsDeleting(true);
        try {
            await deleteDoc(doc(db, "sites", siteId, "pages", id));
            router.push('/admin/pages');
        } catch (err) {
            console.error("Error deleting page:", err);
            alert("Failed to delete page");
            setIsDeleting(false);
            setDeleteDialogOpen(false); // Close dialog on error so user can retry or cancel
        }
    };

    // Auto-generate slug from title if not manually edited
    const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setTitle(val);
        if ((isNew || !slugManuallyEdited) && !slugManuallyEdited) {
            setSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
        }
    };

    const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSlug(e.target.value);
        setSlugManuallyEdited(true);
    };

    useEffect(() => {
        if (!isNew && siteId) {
            const fetchPage = async () => {
                try {
                    const docSnap = await getDoc(doc(db, "sites", siteId, "pages", id));
                    if (docSnap.exists()) {
                        const data = docSnap.data() as Page;
                        setTitle(data.title);
                        setSlug(data.slug);
                        setContent(data.content || ''); // Ensure string
                        if (data.blocks && Array.isArray(data.blocks)) {
                            setBlocks(data.blocks);
                        }

                        // SEO & Analytics
                        if (data.seo) {
                            setSeoTitle(data.seo.title || '');
                            setSeoDescription(data.seo.description || '');
                            setSeoImage(data.seo.image || '');
                            setSeoNoIndex(data.seo.noIndex || false);

                            if (data.seo.title || data.seo.description || data.seo.image) {
                                setOverrideSeo(true);
                            }
                        }

                        if (data.pixels) {
                            setPixelFb(data.pixels.facebookPixelId || '');
                            setPixelGa(data.pixels.googleAnalyticsId || '');
                            setPixelTiktok(data.pixels.tiktokPixelId || '');

                            if (data.pixels.facebookPixelId || data.pixels.googleAnalyticsId || data.pixels.tiktokPixelId) {
                                setOverridePixels(true);
                            }
                        }

                        // If it's an existing page, we assume manual edit or final state, so don't auto-update
                        setSlugManuallyEdited(true);
                    } else {
                        setError("Page not found");
                    }
                } catch (err) {
                    console.error("Error loading page:", err);
                    setError("Failed to load page");
                } finally {
                    setLoading(false);
                }
            };
            fetchPage();
        }
    }, [id, isNew, siteId]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);

        const trimmedTitle = title.trim();
        const trimmedSlug = slug.trim().toLowerCase();

        if (!trimmedTitle || !trimmedSlug) {
            setError("Title and Slug are required");
            setSaving(false);
            return;
        }

        // Validate slug format (letters, numbers, hyphens only, no spaces)
        const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
        if (!slugRegex.test(trimmedSlug)) {
            setError("Invalid slug format. Use only lowercase letters, numbers, and hyphens (e.g., my-page-title). No spaces allowed.");
            setSaving(false);
            return;
        }

        try {
            // Check for duplicate slug
            const q = query(collection(db, "sites", siteId, "pages"), where("slug", "==", trimmedSlug));
            const querySnapshot = await getDocs(q);

            const isDuplicate = querySnapshot.docs.some(doc => doc.id !== id);

            if (isDuplicate) {
                setError("This slug is already taken by another page. Please choose a different one.");
                setSaving(false);
                return;
            }

            const pageData = {
                title: trimmedTitle,
                slug: trimmedSlug,
                content, // We verify what's saved. If blocks exist, we rely on blocks for rendering, but keep content for legacy safety?
                blocks,
                seo: overrideSeo ? {
                    title: seoTitle,
                    description: seoDescription,
                    image: seoImage,
                    noIndex: seoNoIndex
                } : null,
                pixels: overridePixels ? {
                    facebookPixelId: pixelFb,
                    googleAnalyticsId: pixelGa,
                    tiktokPixelId: pixelTiktok
                } : null,
                updatedAt: serverTimestamp()
            };

            if (isNew) {
                await addDoc(collection(db, "sites", siteId, "pages"), {
                    ...pageData,
                    createdAt: serverTimestamp()
                });
            } else {
                await updateDoc(doc(db, "sites", siteId, "pages", id), pageData);
            }

            router.push('/admin/pages');
        } catch (err) {
            console.error("Error saving page:", err);
            setError("Failed to save page. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    const handleSetHomepage = () => {
        if (!slug || isNew) return;
        setHomepageDialogOpen(true);
    };

    const confirmSetHomepage = async () => {
        setIsSettingHomepage(true);
        try {
            // Update site settings
            await setDoc(doc(db, 'sites', siteId, 'content', 'siteSettings'), {
                homepageSlug: slug
            }, { merge: true });

            // Update local state
            setGlobalSettings(prev => prev ? ({ ...prev, homepageSlug: slug }) : { homepageSlug: slug } as any);

            setHomepageDialogOpen(false);
        } catch (err) {
            console.error("Error setting homepage:", err);
            alert("Failed to set homepage. Please try again.");
        } finally {
            setIsSettingHomepage(false);
        }
    };

    // Old handleDelete removed from here

    if (loading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Loader2 className="animate-spin text-brand-dark" size={32} />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto">
            <form onSubmit={handleSave}>
                {/* Header */}
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
                    <div className="flex items-center justify-between w-full md:w-auto">
                        <div className="flex items-center gap-4">
                            <Link href="/admin/pages" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                                <ArrowLeft size={24} className="text-gray-600" />
                            </Link>
                            <div>
                                <h1 className="text-2xl font-bold font-heading text-brand-dark">
                                    {isNew ? 'Create Page' : 'Edit Page'}
                                </h1>
                                <p className="text-gray-500 text-sm">
                                    {isNew ? 'New content page' : `Editing /${slug}`}
                                </p>
                            </div>
                        </div>

                        {/* Mobile Save Button */}
                        <div className="md:hidden">
                            <button
                                type="submit"
                                disabled={saving}
                                className="flex items-center gap-2 bg-brand-dark text-white px-4 py-2 rounded-xl font-bold hover:bg-black transition-colors disabled:opacity-50 text-sm"
                            >
                                {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                                Save
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {!isNew && (
                            <>
                                {globalSettings?.homepageSlug === slug ? (
                                    <div className="flex items-center gap-2 px-4 py-2 bg-brand-green/10 text-brand-dark rounded-xl font-bold border border-brand-green/20 cursor-default">
                                        <Home size={18} className="fill-brand-green/20" />
                                        <span>Current Homepage</span>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={handleSetHomepage}
                                        disabled={saving}
                                        className="flex items-center gap-2 px-4 py-2 text-brand-dark bg-white border-2 border-brand-dark/10 hover:border-brand-dark/30 hover:bg-gray-50 rounded-xl font-bold transition-all disabled:opacity-50"
                                        title="Set as Homepage"
                                    >
                                        <Home size={18} />
                                        <span>Set as Homepage</span>
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={handleDelete}
                                    className="flex items-center gap-2 px-4 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-xl font-bold transition-colors"
                                >
                                    <Trash2 size={20} />
                                    <span>Delete</span>
                                </button>
                            </>
                        )}

                        {/* Desktop Save Button */}
                        <div className="hidden md:block">
                            <button
                                type="submit"
                                disabled={saving}
                                className="flex items-center gap-2 bg-brand-dark text-white px-6 py-2 rounded-xl font-bold hover:bg-black transition-colors disabled:opacity-50"
                            >
                                {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                                Save Page
                            </button>
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl flex items-center gap-2 border border-red-200">
                        <AlertCircle size={20} />
                        {error}
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main Content */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Legacy Content Warning / Fallback */}
                        {!isNew && content && blocks.length === 0 && (
                            <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 mb-4">
                                <h3 className="font-bold text-amber-800 mb-2">Legacy HTML Content Detected</h3>
                                <p className="text-sm text-amber-700 mb-4">This page was built with the old editor. You can continue editing it here, or clear it to start using the new Block Builder.</p>
                                <textarea
                                    value={content}
                                    onChange={(e) => setContent(e.target.value)}
                                    className="w-full h-[200px] p-4 bg-white border border-amber-200 rounded-xl text-sm font-mono"
                                />
                                <button type="button" onClick={() => { setContent(''); }} className="mt-2 text-xs font-bold text-red-600 hover:underline">
                                    Clear Legacy Content & Use Blocks
                                </button>
                            </div>
                        )}

                        {/* Block Manager */}
                        {(blocks.length > 0 || !content || isNew) && (
                            <BlockManager blocks={blocks} onChange={setBlocks} />
                        )}
                    </div>

                    {/* Sidebar Settings */}
                    <div className="space-y-6">
                        <div className="bg-white p-6 rounded-2xl border-2 border-gray-100 shadow-sm space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Title</label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={handleTitleChange}
                                    className="w-full p-3 bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-brand-dark focus:ring-0 transition-all"
                                    placeholder="Page Title"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Slug</label>
                                <div className="flex items-center gap-0 bg-gray-50 border-2 border-gray-200 rounded-xl focus-within:border-brand-dark transition-all overflow-hidden p-0 w-full">
                                    <div className="pl-3 pr-1 text-gray-400 font-medium select-none bg-gray-50 flex items-center h-full">
                                        /
                                    </div>
                                    <input
                                        type="text"
                                        value={slug}
                                        onChange={handleSlugChange}
                                        className="flex-1 p-3 pl-1 bg-transparent border-none focus:ring-0"
                                        placeholder="page-slug"
                                        required
                                    />
                                </div>
                                <p className="text-xs text-gray-400 mt-1">
                                    URL: {host || '...'}/{tenantSlug ? `${tenantSlug}/` : ''}{slug || 'page-slug'}
                                </p>
                            </div>
                        </div>

                        {/* SEO & Analytics Settings */}
                        <div className="bg-white rounded-2xl border-2 border-gray-100 shadow-sm overflow-hidden">
                            <button
                                type="button"
                                onClick={() => setShowSeoSettings(!showSeoSettings)}
                                className="w-full flex items-center justify-between p-6 hover:bg-gray-50 transition-colors text-left"
                            >
                                <span className="font-bold text-gray-700">SEO & Analytics Overrides</span>
                                {showSeoSettings ? <ChevronDown size={20} className="text-gray-400" /> : <ChevronRight size={20} className="text-gray-400" />}
                            </button>

                            {showSeoSettings && (
                                <div className="p-6 pt-0 space-y-6 border-t border-gray-100 mt-0 bg-gray-50/50">
                                    <div className="mt-4">
                                        <div className="flex items-center justify-between mb-4">
                                            <h4 className="text-sm font-bold text-gray-700">Tracking Pixels</h4>
                                            <button
                                                type="button"
                                                onClick={() => setOverridePixels(!overridePixels)}
                                                className={`text-xs font-bold flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors ${overridePixels ? 'bg-brand-dark text-white' : 'bg-gray-200 text-gray-500 hover:bg-gray-300'}`}
                                            >
                                                {overridePixels ? <CheckSquare size={14} /> : <Square size={14} />}
                                                {overridePixels ? 'Overriding Global' : 'Use Global Default'}
                                            </button>
                                        </div>

                                        <div className={`space-y-3 transition-opacity duration-200 ${overridePixels ? 'opacity-100' : 'opacity-60 pointer-events-none'}`}>
                                            <div>
                                                <label className="block text-xs font-semibold text-gray-600 mb-1">Facebook Pixel ID</label>
                                                <input
                                                    type="text"
                                                    value={pixelFb}
                                                    onChange={(e) => setPixelFb(e.target.value)}
                                                    className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-brand-dark outline-none font-medium text-sm"
                                                    placeholder={overridePixels ? "Enter ID" : (globalSettings?.pixels?.facebookPixelId ? `Global: ${globalSettings.pixels.facebookPixelId}` : "Not Set Globally")}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold text-gray-600 mb-1">Google Analytics ID</label>
                                                <input
                                                    type="text"
                                                    value={pixelGa}
                                                    onChange={(e) => setPixelGa(e.target.value)}
                                                    className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-brand-dark outline-none font-medium text-sm"
                                                    placeholder={overridePixels ? "Enter ID" : (globalSettings?.pixels?.googleAnalyticsId ? `Global: ${globalSettings.pixels.googleAnalyticsId}` : "Not Set Globally")}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold text-gray-600 mb-1">TikTok Pixel ID</label>
                                                <input
                                                    type="text"
                                                    value={pixelTiktok}
                                                    onChange={(e) => setPixelTiktok(e.target.value)}
                                                    className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-brand-dark outline-none font-medium text-sm"
                                                    placeholder={overridePixels ? "Enter ID" : (globalSettings?.pixels?.tiktokPixelId ? `Global: ${globalSettings.pixels.tiktokPixelId}` : "Not Set Globally")}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-4 border-t border-gray-200">
                                        <div className="flex items-center justify-between mb-4">
                                            <h4 className="text-sm font-bold text-gray-700">SEO Meta Tags</h4>
                                            <button
                                                type="button"
                                                onClick={() => setOverrideSeo(!overrideSeo)}
                                                className={`text-xs font-bold flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors ${overrideSeo ? 'bg-brand-dark text-white' : 'bg-gray-200 text-gray-500 hover:bg-gray-300'}`}
                                            >
                                                {overrideSeo ? <CheckSquare size={14} /> : <Square size={14} />}
                                                {overrideSeo ? 'Overriding Global' : 'Use Global Default'}
                                            </button>
                                        </div>

                                        <div className={`space-y-3 transition-opacity duration-200 ${overrideSeo ? 'opacity-100' : 'opacity-60 pointer-events-none'}`}>
                                            <div>
                                                <label className="block text-xs font-semibold text-gray-600 mb-1">Meta Title</label>
                                                <input
                                                    type="text"
                                                    value={seoTitle}
                                                    onChange={(e) => setSeoTitle(e.target.value)}
                                                    className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-brand-dark outline-none font-medium text-sm"
                                                    placeholder={overrideSeo ? "Enter Title" : (globalSettings?.seo?.title || "Use Page Title")}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold text-gray-600 mb-1">Meta Description</label>
                                                <textarea
                                                    value={seoDescription}
                                                    onChange={(e) => setSeoDescription(e.target.value)}
                                                    className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-brand-dark outline-none font-medium text-sm h-20"
                                                    placeholder={overrideSeo ? "Enter Description" : (globalSettings?.seo?.description || "Use Default Description")}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold text-gray-600 mb-1">OG Image URL</label>
                                                <input
                                                    type="text"
                                                    value={seoImage}
                                                    onChange={(e) => setSeoImage(e.target.value)}
                                                    className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-brand-dark outline-none font-medium text-sm"
                                                    placeholder={overrideSeo ? "Enter Image URL" : (globalSettings?.seo?.image || "Use Default Image")}
                                                />
                                            </div>
                                            <div className="flex items-center gap-2 pt-2">
                                                <input
                                                    type="checkbox"
                                                    id="noindex"
                                                    checked={seoNoIndex}
                                                    onChange={(e) => setSeoNoIndex(e.target.checked)}
                                                    className="rounded border-gray-300 text-brand-dark focus:ring-brand-dark"
                                                />
                                                <label htmlFor="noindex" className="text-xs font-medium text-gray-600">
                                                    Discourage search engines from indexing this page
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </form>

            <ConfirmationDialog
                isOpen={deleteDialogOpen}
                title="Delete Page"
                message="Are you sure you want to delete this page? This action cannot be undone."
                onConfirm={handleConfirmDelete}
                onCancel={() => setDeleteDialogOpen(false)}
                isLoading={isDeleting}
            />

            <ConfirmationDialog
                isOpen={homepageDialogOpen}
                title="Set as Homepage"
                message={`Are you sure you want to set "${title}" as your homepage?`}
                onConfirm={confirmSetHomepage}
                onCancel={() => setHomepageDialogOpen(false)}
                isLoading={isSettingHomepage}
                confirmLabel="Set as Homepage"
            />
        </div>
    );
}
