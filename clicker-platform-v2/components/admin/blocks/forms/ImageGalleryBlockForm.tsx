'use client';

import { useState, useRef } from 'react';
import { Loader2, Plus, X, Image as ImageIcon, Star } from 'lucide-react';
import { convertToWebP, validateImageFile } from '@/lib/imageUtils';
import { storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useSite } from '@/lib/site-context';

interface ImageGalleryBlockFormProps {
    data: {
        images?: string[];
        coverImage?: string;
    };
    onChange: (data: any) => void;
}

export const ImageGalleryBlockForm = ({ data, onChange }: ImageGalleryBlockFormProps) => {
    const { siteId } = useSite();
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const images = data.images || [];
    const coverImage = data.coverImage || (images.length > 0 ? images[0] : '');

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        // Check limit
        if (images.length + files.length > 10) {
            alert('You can only have up to 10 images in the gallery.');
            return;
        }

        setUploading(true);

        try {
            const uploadedUrls: string[] = [];

            for (let i = 0; i < files.length; i++) {
                const file = files[i];

                // Validate
                const validationError = validateImageFile(file, 5); // 5MB limit
                if (validationError) {
                    alert(`Error with ${file.name}: ${validationError}`);
                    continue;
                }

                // Convert to WebP
                const webpBlob = await convertToWebP(file);
                const webpFile = new File([webpBlob], file.name.replace(/\.[^/.]+$/, "") + ".webp", { type: 'image/webp' });

                // Upload directly using Client SDK (Bypasses server key issues)
                // Site-scoped path: sites/{siteId}/uploads/{timestamp}_{filename}
                const storagePath = siteId
                    ? `sites/${siteId}/uploads/${Date.now()}_${file.name}`
                    : `uploads/${Date.now()}_${file.name}`;
                const storageRef = ref(storage, storagePath);
                const snapshot = await uploadBytes(storageRef, webpFile, {
                    contentType: 'image/webp'
                });
                const downloadURL = await getDownloadURL(snapshot.ref);

                uploadedUrls.push(downloadURL);
                console.log(`[ClientUpload] Success: ${downloadURL}`);
            }

            if (uploadedUrls.length > 0) {
                const newImages = [...images, ...uploadedUrls];
                // Set cover image if it's the first image(s) being added and no cover exists
                const newCover = !coverImage ? uploadedUrls[0] : coverImage;

                onChange({
                    ...data,
                    images: newImages,
                    coverImage: newCover // Ensure at least one cover if images exist
                });
            }

        } catch (error: any) {
            console.error(error);
            alert(`Upload Error: ${error.message}`);
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const removeImage = (urlToRemove: string) => {
        const newImages = images.filter(url => url !== urlToRemove);
        let newCover = coverImage;

        // If we removed the cover image, default to the first available image, or empty string
        if (coverImage === urlToRemove) {
            newCover = newImages.length > 0 ? newImages[0] : '';
        }

        onChange({
            ...data,
            images: newImages,
            coverImage: newCover
        });
    };

    const setCover = (url: string) => {
        onChange({
            ...data,
            coverImage: url
        });
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <label className="block text-sm font-bold text-gray-700">Gallery Images ({images.length}/10)</label>
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*"
                    multiple // Allow multi-upload
                    className="hidden"
                />
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading || images.length >= 10}
                    className="flex items-center gap-2 text-xs font-bold text-brand-dark bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                >
                    {uploading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                    Add Images
                </button>
            </div>

            {images.length === 0 ? (
                <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-200 rounded-xl p-8 flex flex-col items-center justify-center text-gray-400 cursor-pointer hover:border-brand-dark/30 hover:bg-gray-50 transition-all"
                >
                    <ImageIcon size={32} className="mb-2 opacity-50" />
                    <p className="text-sm font-medium">Click to upload images</p>
                    <p className="text-xs mt-1">PNG, JPG, WebP (Max 5MB)</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {images.map((url, index) => (
                        <div key={index} className="group relative aspect-square bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                            <img src={url} alt={`Gallery ${index + 1}`} className="w-full h-full object-cover" />

                            {/* Overlay Actions */}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setCover(url)}
                                    title="Set as Cover"
                                    className={`p-1.5 rounded-full ${coverImage === url ? 'bg-yellow-400 text-white' : 'bg-white/20 text-white hover:bg-white/40'}`}
                                >
                                    <Star size={16} fill={coverImage === url ? "currentColor" : "none"} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => removeImage(url)}
                                    title="Remove Image"
                                    className="p-1.5 rounded-full bg-white/20 text-white hover:bg-red-500/80 transition-colors"
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            {/* Cover Indicator (Visible when not hovering/always if active) */}
                            {coverImage === url && (
                                <div className="absolute top-2 left-2 bg-yellow-400 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                                    COVER
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            <p className="text-xs text-gray-400">
                The cover image will be displayed on your page. Clicking it will open the full gallery.
            </p>
        </div>
    );
};
