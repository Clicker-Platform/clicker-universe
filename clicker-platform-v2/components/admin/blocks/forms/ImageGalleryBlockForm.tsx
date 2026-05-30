'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Plus, X, Image as ImageIcon, Star } from 'lucide-react';
import { MediaPicker } from '@/components/admin/media/MediaPicker';

interface ImageGalleryBlockFormProps {
    data: {
        images?: string[];
        coverImage?: string;
    };
    onChange: (data: any) => void;
}

const MAX_IMAGES = 10;

export const ImageGalleryBlockForm = ({ data, onChange }: ImageGalleryBlockFormProps) => {
    const safeData = data || {};
    const [pickerOpen, setPickerOpen] = useState(false);

    const images = safeData.images || [];
    const coverImage = safeData.coverImage || images[0] || '';

    const handleSelect = (url: string) => {
        if (images.length >= MAX_IMAGES) return;
        const newImages = [...images, url];
        onChange({
            ...safeData,
            images: newImages,
            coverImage: coverImage || url,
        });
    };

    const removeImage = (index: number) => {
        const removed = images[index];
        const newImages = images.filter((_, i) => i !== index);
        const newCover = coverImage === removed ? (newImages[0] || '') : coverImage;
        onChange({ ...safeData, images: newImages, coverImage: newCover });
    };

    const setCover = (index: number) => {
        onChange({ ...safeData, coverImage: images[index] });
    };

    const isCover = (index: number) => coverImage === images[index];

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <label className="block text-xs font-medium text-neutral-400 dark:text-neutral-500">Gallery Images ({images.length}/{MAX_IMAGES})</label>
                <button
                    type="button"
                    onClick={() => setPickerOpen(true)}
                    disabled={images.length >= MAX_IMAGES}
                    className="flex items-center gap-2 text-xs font-bold text-neutral-900 dark:text-neutral-200 bg-gray-100 dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 hover:bg-gray-200 dark:hover:bg-neutral-700 px-4 py-2 rounded-lg transition-all disabled:opacity-50 active:scale-95"
                >
                    <Plus size={14} />
                    Add Image
                </button>
            </div>

            {images.length === 0 ? (
                <div
                    onClick={() => setPickerOpen(true)}
                    className="border-2 border-dashed border-gray-200 dark:border-neutral-800 bg-gray-100/50 dark:bg-neutral-900/50 rounded-lg p-10 flex flex-col items-center justify-center text-neutral-400 dark:text-neutral-500 cursor-pointer hover:border-gray-300 dark:hover:border-neutral-700 hover:bg-gray-100 dark:hover:bg-neutral-800/50 transition-all group"
                >
                    <ImageIcon size={32} className="mb-3 opacity-30 group-hover:opacity-100 group-hover:text-blue-500 transition-all" />
                    <p className="text-sm font-bold text-neutral-400">Click to add images</p>
                    <p className="text-xs mt-1 font-medium opacity-60">Pick from library or upload new</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {images.map((url, index) => (
                        <div key={`${url}-${index}`} className="group relative aspect-square bg-gray-100 dark:bg-neutral-900 rounded-lg overflow-hidden border border-gray-200 dark:border-neutral-800 shadow-inner">
                            <Image
                                src={url}
                                alt={`Gallery ${index + 1}`}
                                fill
                                sizes="(max-width: 640px) 50vw, 200px"
                                className="object-cover transition-transform duration-500 group-hover:scale-110"
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

            <MediaPicker
                open={pickerOpen}
                onClose={() => setPickerOpen(false)}
                onSelect={({ url }) => { handleSelect(url); setPickerOpen(false); }}
                accept="image"
            />
        </div>
    );
};
