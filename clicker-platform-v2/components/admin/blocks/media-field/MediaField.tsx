'use client';

import { useRef, useState } from 'react';
import { Image as ImageIcon, Film, Sparkles, Upload, X, Loader2 } from 'lucide-react';
import { uploadToStorage } from '@/lib/upload';
import { useSite } from '@/lib/site-context';
import { MediaFieldValue, MediaType, MediaAspectRatio, MediaObjectFit, DEFAULT_MEDIA } from './types';
import { detectVideoProvider } from '@/components/admin/blocks/rich-text/VideoEmbedExtension';
import { getRecommendedSize, isBelowRecommended } from '@/lib/media/recommendations';

interface MediaFieldProps {
    value?: MediaFieldValue;
    onChange: (value: MediaFieldValue) => void;
}

const TYPE_TABS: { id: MediaType; label: string; icon: React.ElementType }[] = [
    { id: 'image', label: 'Image', icon: ImageIcon },
    { id: 'video', label: 'Video', icon: Film },
    { id: 'lottie', label: 'Lottie', icon: Sparkles },
];

const labelClass = 'block text-[11px] font-medium text-neutral-400 dark:text-neutral-500 mb-1 uppercase tracking-wider';
const inputClass = 'w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg text-sm text-neutral-900 dark:text-neutral-200 placeholder-neutral-400 dark:placeholder-neutral-600 focus:border-blue-500/50 focus:outline-none transition-colors';

export function MediaField({ value, onChange }: MediaFieldProps) {
    const media = value ?? DEFAULT_MEDIA;
    const { siteId } = useSite();
    const imageInputRef = useRef<HTMLInputElement>(null);
    const lottieInputRef = useRef<HTMLInputElement>(null);
    const posterInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState<null | 'image' | 'lottie' | 'poster'>(null);
    const [error, setError] = useState('');
    const [sizeWarning, setSizeWarning] = useState('');
    // Tab is local UI state only — does NOT write to block data until user provides new content
    const [selectedTab, setSelectedTab] = useState<MediaType>(media.type);

    const recommended = getRecommendedSize(media.aspectRatio);

    const clean = (v: MediaFieldValue): MediaFieldValue =>
        Object.fromEntries(Object.entries(v).filter(([, val]) => val !== undefined)) as MediaFieldValue;

    const update = (patch: Partial<MediaFieldValue>) => {
        onChange(clean({ ...media, ...patch }));
    };

    // Commits new content with the selected tab's type — called only on upload/link
    const commit = (src: string, extraPatch?: Partial<MediaFieldValue>) => {
        onChange(clean({ ...media, ...extraPatch, type: selectedTab, src }));
    };

    const readImageDimensions = (file: File): Promise<{ width: number; height: number } | null> =>
        new Promise((resolve) => {
            const url = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => {
                resolve({ width: img.naturalWidth, height: img.naturalHeight });
                URL.revokeObjectURL(url);
            };
            img.onerror = () => {
                resolve(null);
                URL.revokeObjectURL(url);
            };
            img.src = url;
        });

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: 'image' | 'poster') => {
        const file = e.target.files?.[0];
        if (!file) return;
        setError('');
        setSizeWarning('');
        if (!file.type.startsWith('image/')) {
            setError('Please select an image file.');
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            setError('Max 10MB.');
            return;
        }

        if (target === 'image') {
            const dims = await readImageDimensions(file);
            if (dims && isBelowRecommended(dims, media.aspectRatio)) {
                setSizeWarning(
                    `Uploaded ${dims.width}×${dims.height}px is smaller than recommended (${recommended.label}). The image may appear blurry.`,
                );
            }
        }

        setUploading(target);
        try {
            const url = await uploadToStorage({ file, folder: 'content-showcase', siteId });
            if (target === 'image') commit(url);
            else update({ poster: url });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Upload failed');
        } finally {
            setUploading(null);
            if (imageInputRef.current) imageInputRef.current.value = '';
            if (posterInputRef.current) posterInputRef.current.value = '';
        }
    };

    const handleLottieUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setError('');
        if (!file.name.toLowerCase().endsWith('.json')) {
            setError('Lottie file must be a .json');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            setError('Max 5MB for Lottie.');
            return;
        }
        setUploading('lottie');
        try {
            const url = await uploadToStorage({ file, folder: 'content-showcase-lottie', siteId, convertToWebP: false });
            commit(url);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Upload failed');
        } finally {
            setUploading(null);
            if (lottieInputRef.current) lottieInputRef.current.value = '';
        }
    };

    return (
        <div className="space-y-3">
            {/* Type tabs */}
            <div className="flex gap-1 p-1 bg-gray-100 dark:bg-neutral-800 rounded-lg">
                {TYPE_TABS.map((t) => {
                    const Icon = t.icon;
                    const active = selectedTab === t.id;
                    return (
                        <button
                            key={t.id}
                            type="button"
                            onClick={() => { setSelectedTab(t.id); setError(''); }}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold rounded-md transition-all ${
                                active
                                    ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-sm'
                                    : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
                            }`}
                        >
                            <Icon size={14} /> {t.label}
                        </button>
                    );
                })}
            </div>

            {/* Image */}
            {selectedTab === 'image' && (
                <div className="space-y-3">
                    <div>
                        <label className={labelClass}>Image</label>
                        <input type="file" ref={imageInputRef} className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, 'image')} />
                        {media.type === 'image' && media.src ? (
                            <div className="relative group">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={media.src} alt={media.alt || ''} className="w-full h-40 object-cover rounded-lg border border-gray-200 dark:border-neutral-800" />
                                <button
                                    type="button"
                                    onClick={() => { update({ src: '' }); setSizeWarning(''); }}
                                    className="absolute top-2 right-2 p-1.5 bg-black/70 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => imageInputRef.current?.click()}
                                disabled={uploading === 'image'}
                                className="w-full h-32 flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-300 dark:border-neutral-700 rounded-lg text-neutral-500 hover:border-blue-500 hover:text-blue-500 transition-colors disabled:opacity-50"
                            >
                                {uploading === 'image' ? <Loader2 size={20} className="animate-spin" /> : <Upload size={20} />}
                                <span className="text-xs font-bold">{uploading === 'image' ? 'Uploading…' : 'Click to upload'}</span>
                            </button>
                        )}
                        <p className="text-[10px] text-neutral-500 mt-1">
                            Any size. Image renders at its natural aspect ratio.
                        </p>
                        {sizeWarning && (
                            <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">{sizeWarning}</p>
                        )}
                    </div>
                    <div>
                        <label className={labelClass}>Alt Text</label>
                        <input
                            type="text"
                            value={media.alt || ''}
                            onChange={(e) => update({ alt: e.target.value })}
                            placeholder="Describe the image for screen readers"
                            className={inputClass}
                        />
                    </div>
                </div>
            )}

            {/* Video */}
            {selectedTab === 'video' && (
                <div className="space-y-3">
                    <div>
                        <label className={labelClass}>Video URL</label>
                        <input
                            type="text"
                            value={selectedTab === media.type ? (media.src || '') : ''}
                            onChange={(e) => commit(e.target.value)}
                            placeholder="https://youtube.com/... or .mp4"
                            className={inputClass}
                        />
                        <p className="text-[10px] text-neutral-500 mt-1">YouTube, Vimeo, or direct .mp4/.webm.</p>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        <ToggleButton label="Autoplay" checked={!!media.autoplay} onChange={(v) => update({ autoplay: v })} />
                        <ToggleButton label="Muted" checked={!!media.muted} onChange={(v) => update({ muted: v })} />
                        <ToggleButton label="Loop" checked={!!media.loop} onChange={(v) => update({ loop: v })} />
                    </div>
                    {detectVideoProvider(media.src || '')?.provider === 'mp4' && (
                        <div>
                            <label className={labelClass}>Poster image (optional)</label>
                            <input type="file" ref={posterInputRef} className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, 'poster')} />
                            {media.poster ? (
                                <div className="flex items-center gap-2">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={media.poster} alt="Poster" className="h-12 w-20 object-cover rounded border border-gray-200 dark:border-neutral-800" />
                                    <button type="button" onClick={() => update({ poster: '' })} className="text-xs text-neutral-500 hover:text-red-500">Remove</button>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => posterInputRef.current?.click()}
                                    disabled={uploading === 'poster'}
                                    className="text-xs font-bold text-blue-500 hover:underline disabled:opacity-50"
                                >
                                    {uploading === 'poster' ? 'Uploading…' : 'Upload poster'}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Lottie */}
            {selectedTab === 'lottie' && (
                <div className="space-y-3">
                    <div>
                        <label className={labelClass}>Lottie JSON</label>
                        <input type="file" ref={lottieInputRef} className="hidden" accept="application/json,.json" onChange={handleLottieUpload} />
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => lottieInputRef.current?.click()}
                                disabled={uploading === 'lottie'}
                                className="px-3 py-2 bg-gray-100 dark:bg-neutral-800 text-xs font-bold rounded-lg border border-gray-200 dark:border-neutral-700 hover:bg-gray-200 dark:hover:bg-neutral-700 disabled:opacity-50"
                            >
                                {uploading === 'lottie' ? 'Uploading…' : 'Upload .json'}
                            </button>
                            <span className="text-neutral-400 text-xs">or</span>
                            <input
                                type="text"
                                value={selectedTab === media.type ? (media.src || '') : ''}
                                onChange={(e) => commit(e.target.value)}
                                placeholder="Paste Lottie JSON URL"
                                className={`${inputClass} flex-1`}
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <ToggleButton label="Autoplay" checked={media.autoplay !== false} onChange={(v) => update({ autoplay: v })} />
                        <ToggleButton label="Loop" checked={media.loop !== false} onChange={(v) => update({ loop: v })} />
                    </div>
                </div>
            )}

            {error && <p className="text-xs text-red-500">{error}</p>}

            {/* Aspect ratio + object fit — only meaningful for video/lottie, which need
                a defined frame. Images render at their natural aspect ratio. */}
            {selectedTab !== 'image' && (
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-200 dark:border-neutral-800">
                    <div>
                        <label className={labelClass}>Aspect</label>
                        <select
                            value={media.aspectRatio || '16:9'}
                            onChange={(e) => update({ aspectRatio: e.target.value as MediaAspectRatio })}
                            className={inputClass}
                        >
                            <option value="16:9">16:9</option>
                            <option value="4:3">4:3</option>
                            <option value="square">Square</option>
                            <option value="3:4">3:4</option>
                            <option value="free">Free</option>
                        </select>
                    </div>
                    <div>
                        <label className={labelClass}>Fit</label>
                        <select
                            value={media.objectFit || 'cover'}
                            onChange={(e) => update({ objectFit: e.target.value as MediaObjectFit })}
                            className={inputClass}
                        >
                            <option value="cover">Cover</option>
                            <option value="contain">Contain</option>
                        </select>
                    </div>
                </div>
            )}
        </div>
    );
}

function ToggleButton({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
    return (
        <button
            type="button"
            onClick={() => onChange(!checked)}
            className={`px-2 py-1.5 text-[11px] font-bold rounded-lg border transition-colors ${
                checked
                    ? 'bg-blue-500 border-blue-500 text-white'
                    : 'bg-white dark:bg-neutral-900 border-gray-200 dark:border-neutral-800 text-neutral-500 hover:border-blue-500/50'
            }`}
        >
            {label}
        </button>
    );
}
