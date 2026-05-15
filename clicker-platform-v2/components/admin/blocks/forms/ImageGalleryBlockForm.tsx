'use client';

import { useState, useRef } from 'react';
import NextImage from 'next/image';
import { Loader2, Plus, X, Image as ImageIcon, Star } from 'lucide-react';
import { resizeAndConvert, validateImageFile } from '@/lib/imageUtils';
import { storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useSite } from '@/lib/site-context';

interface ImageGalleryBlockFormProps {
    data: {
        images?: string[];
        thumbnails?: string[];
        coverImage?: string;
    };
    onChange: (data: Record<string, unknown>) => void;
}

export const ImageGalleryBlockForm = ({ data, onChange }: ImageGalleryBlockFormProps) => {
    const safeData = data || {};
    const { siteId } = useSite();
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const images = safeData.images || [];
    const thumbnails = safeData.thumbnails || [];
    const coverImage = safeData.coverImage || (images.length > 0 ? images[0] : '');

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        if (images.length + files.length > 10) {
            alert('You can only have up to 10 images in the gallery.');
            return;
        }

        setUploading(true);

        try {
            const newFullUrls: string[] = [];
            const newThumbUrls: string[] = [];

            for (let i = 0; i < files.length; i++) {
                const file = files[i];

                const validationError = validateImageFile(file, 5);
                if (validationError) {
                    alert(`Error with ${file.name}: ${validationError}`);
                    continue;
                }

                const baseName = `${Date.now()}_${file.name.replace(/\.[^/.]+$/, '')}`;
                const uploadPath = siteId
                    ? `sites/${siteId}/uploads`
                    : 'uploads';

                // Full resolution (1920px max) — used in lightbox
                const fullBlob = await resizeAndConvert(file, 1920, 0.85);
                const fullRef = ref(storage, `${uploadPath}/${baseName}.webp`);
                const fullSnap = await uploadBytes(fullRef, fullBlob, { contentType: 'image/webp' });
                const fullUrl = await getDownloadURL(fullSnap.ref);

                // Thumbnail (800px max) — used in grid and cover
                const thumbBlob = await resizeAndConvert(file, 800, 0.8);
                const thumbRef = ref(storage, `${uploadPath}/${baseName}_thumb.webp`);
                const thumbSnap = await uploadBytes(thumbRef, thumbBlob, { contentType: 'image/webp' });
                const thumbUrl = await getDownloadURL(thumbSnap.ref);

                newFullUrls.push(fullUrl);
                newThumbUrls.push(thumbUrl);
            }

            if (newFullUrls.length > 0) {
                const newImages = [...images, ...newFullUrls];
                const newThumbnails = [...thumbnails, ...newThumbUrls];
                const newCover = !coverImage ? newThumbUrls[0] : coverImage;

                onChange({
                    ...safeData,
                    images: newImages,
                    thumbnails: newThumbnails,
                    coverImage: newCover,
                });
            }

        } catch (error: unknown) {
            console.error(error);
            alert(`Upload Error: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const removeImage = (index: number) => {
        const newImages = images.filter((_, i) => i !== index);
        const newThumbnails = thumbnails.filter((_, i) => i !== index);
        const removedFull = images[index];
        const removedThumb = thumbnails[index];

        let newCover = coverImage;
        if (coverImage === removedFull || coverImage === removedThumb) {
            newCover = newThumbnails.length > 0 ? newThumbnails[0] : newImages.length > 0 ? newImages[0] : '';
        }

        onChange({ ...safeData, images: newImages, thumbnails: newThumbnails, coverImage: newCover });
    };

    const setCover = (index: number) => {
        const thumbUrl = thumbnails[index] || images[index];
        onChange({ ...safeData, coverImage: thumbUrl });
    };

    // Determine if an index is the current cover
    const isCover = (index: number) => {
        const thumbUrl = thumbnails[index] || images[index];
        return coverImage === thumbUrl || coverImage === images[index];
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <label className="block text-xs font-medium text-neutral-400 dark:text-neutral-500">Gallery Images ({images.length}/10)</label>
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*"
                    multiple
                    className="hidden"
                />
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading || images.length >= 10}
                    className="flex items-center gap-2 text-xs font-bold text-neutral-900 dark:text-neutral-200 bg-gray-100 dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 hover:bg-gray-200 dark:hover:bg-neutral-700 px-4 py-2 rounded-lg transition-all disabled:opacity-50 active:scale-95"
                >
                    {uploading ? <Loader2 size={14} className="animate-spin text-blue-500" /> : <Plus size={14} />}
                    Add Images
                </button>
            </div>

            {images.length === 0 ? (
                <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-200 dark:border-neutral-800 bg-gray-100/50 dark:bg-neutral-900/50 rounded-lg p-10 flex flex-col items-center justify-center text-neutral-400 dark:text-neutral-500 cursor-pointer hover:border-gray-300 dark:hover:border-neutral-700 hover:bg-gray-100 dark:hover:bg-neutral-800/50 transition-all group"
                >
                    <ImageIcon size={32} className="mb-3 opacity-30 group-hover:opacity-100 group-hover:text-blue-500 transition-all" />
                    <p className="text-sm font-bold text-neutral-400">Click to upload images</p>
                    <p className="text-xs mt-1 font-medium opacity-60">PNG, JPG, WebP (Max 10MB)</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {images.map((url, index) => (
                        <div key={index} className="group relative aspect-square bg-gray-100 dark:bg-neutral-900 rounded-lg overflow-hidden border border-gray-200 dark:border-neutral-800 shadow-inner">
                            <NextImage
                                src={thumbnails[index] || url}
                                alt={`Gallery ${index + 1}`}
                                fill
                                className="object-cover transition-transform duration-500 group-hover:scale-110"
                                unoptimized
                            />

                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setCover(index)}
                                    title="Set as Cover"
                                    className={`p-2 rounded-full backdrop-blur-md transition-all active:scale-90 ${isCover(index) ? 'bg-yellow-500 text-black' : 'bg-white/10 text-white hover:bg-white/20'}`}
                                >
                                    <Star size={18} fill={isCover(index) ? 'currentColor' : 'none'} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => removeImage(index)}
                                    title="Remove Image"
                                    className="p-2 rounded-full backdrop-blur-md bg-white/10 text-white hover:bg-red-500 hover:text-white transition-all active:scale-90"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {isCover(index) && (
                                <div className="absolute top-2 left-2 bg-yellow-500 text-black text-[9px] font-black px-2.5 py-1 rounded-full shadow-lg flex items-center gap-1 border border-yellow-600/20">
                                    <Star size={8} fill="currentColor" />
                                    COVER
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            <p className="text-xs text-neutral-400 dark:text-neutral-500 font-medium leading-relaxed">
                The cover image will be displayed on your page. Clicking it opens the full gallery.
            </p>
        </div>
    );
};
