'use client';

import { useState, useRef } from 'react';
import { Upload, X, Loader2, Image as ImageIcon, Plus } from 'lucide-react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { useSite } from '@/lib/site-context';
import Image from 'next/image';

interface MultiImageUploadProps {
    images: string[];
    onImagesChange: (newImages: string[]) => void;
    maxImages?: number;
}

export function MultiImageUpload({ images, onImagesChange, maxImages = 10 }: MultiImageUploadProps) {
    const { siteId } = useSite();
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        // Check limits
        if (images.length + files.length > maxImages) {
            setError(`You can only upload up to ${maxImages} images.`);
            return;
        }

        await processUploads(files);
    };

    const processUploads = async (files: File[]) => {
        setError('');
        setUploading(true);

        const newImageUrls: string[] = [];
        const errors: string[] = [];

        try {
            for (const file of files) {
                if (!file.type.startsWith('image/')) {
                    errors.push(`${file.name}: Not an image`);
                    continue;
                }

                if (file.size > 5 * 1024 * 1024) {
                    errors.push(`${file.name}: Max size 5MB`);
                    continue;
                }

                try {
                    // Upload directly to Firebase Storage (Client SDK)
                    // Site-scoped path: sites/{siteId}/products/{timestamp}_{filename}
                    const storagePath = siteId
                        ? `sites/${siteId}/products/${Date.now()}_${file.name}`
                        : `products/${Date.now()}_${file.name}`;
                    const storageRef = ref(storage, storagePath);

                    const snapshot = await uploadBytes(storageRef, file);
                    const url = await getDownloadURL(snapshot.ref);

                    newImageUrls.push(url);
                } catch (err: any) {
                    console.error("Upload error details:", err);
                    errors.push(`${file.name}: ${err.message || 'Upload failed'}`);
                }
            }

            if (newImageUrls.length > 0) {
                onImagesChange([...images, ...newImageUrls]);
            }

            if (errors.length > 0) {
                setError(`Some files failed: ${errors.join(', ')}`);
            }
        } catch (err) {
            console.error(err);
            setError('System error during upload');
        } finally {
            setUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const removeImage = (indexToRemove: number) => {
        const newImages = images.filter((_, index) => index !== indexToRemove);
        onImagesChange(newImages);
    };

    const setMainImage = (index: number) => {
        if (index === 0) return;
        const newImages = [...images];
        const [movedImage] = newImages.splice(index, 1);
        newImages.unshift(movedImage);
        onImagesChange(newImages);
    };

    return (
        <div className="w-full">
            {/* Dedicated Upload Zone */}
            {images.length < maxImages && (
                <div
                    onClick={() => !uploading && fileInputRef.current?.click()}
                    onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                    }}
                    onDrop={async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (uploading) return;

                        const files = Array.from(e.dataTransfer.files);
                        if (files.length > 0) {
                            if (images.length + files.length > maxImages) {
                                setError(`You can only upload up to ${maxImages} images.`);
                                return;
                            }
                            await processUploads(files);
                        }
                    }}
                    className={`
                        w-full border-2 border-dashed rounded-xl p-8 mb-6 flex flex-col items-center justify-center cursor-pointer transition-all duration-200
                        ${error ? 'border-red-300 bg-red-50' : 'border-gray-300 hover:border-brand-green hover:bg-brand-green/5'}
                        ${uploading ? 'opacity-50 pointer-events-none' : ''}
                    `}
                >
                    {uploading ? (
                        <div className="flex flex-col items-center gap-3">
                            <Loader2 className="animate-spin text-brand-dark" size={32} />
                            <p className="text-sm font-bold text-gray-500">Uploading...</p>
                        </div>
                    ) : (
                        <>
                            <div className="bg-gray-100 p-4 rounded-full mb-3 group-hover:bg-white group-hover:shadow-sm transition-all">
                                <Upload className="text-gray-400 group-hover:text-brand-green transition-colors" size={24} />
                            </div>
                            <h3 className="text-brand-dark font-bold text-base mb-1">Click to upload or drag and drop</h3>
                            <p className="text-gray-400 text-sm mb-1">SVG, PNG, JPG or WEBP (max. 5MB)</p>
                            <p className="text-xs font-bold text-gray-300">
                                {images.length}/{maxImages} images used
                            </p>
                        </>
                    )}
                </div>
            )}

            {/* Image Grid */}
            {images.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4 mb-2">
                    {images.map((url, index) => (
                        <div
                            key={`${url}-${index}`}
                            className={`
                                relative aspect-square rounded-xl overflow-hidden border group shadow-sm
                                ${index === 0 ? 'border-brand-dark ring-2 ring-brand-dark ring-offset-2' : 'border-gray-200'}
                            `}
                        >
                            <Image
                                src={url}
                                alt={`Product ${index + 1}`}
                                fill
                                sizes="(max-width: 640px) 33vw, 20vw"
                                className="object-cover"
                            />

                            {/* Overlay Actions */}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-2 gap-2">
                                {index !== 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setMainImage(index)}
                                        className="text-[10px] bg-white text-brand-dark font-bold px-2 py-1 rounded hover:bg-brand-green hover:text-white transition-colors w-full"
                                    >
                                        Set as Cover
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => removeImage(index)}
                                    className="bg-red-500 text-white p-1.5 rounded-full hover:bg-red-600 transition-colors shadow-sm"
                                    title="Remove Image"
                                >
                                    <X size={14} />
                                </button>
                            </div>

                            {index === 0 && (
                                <div className="absolute top-0 left-0 bg-brand-dark text-white text-[10px] uppercase font-bold px-2 py-1 rounded-br-lg z-10">
                                    Cover
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                className="hidden"
                accept="image/png, image/jpeg, image/webp"
                multiple
            />

            {error && (
                <div className="text-xs text-red-600 font-bold mt-2">
                    {error}
                </div>
            )}

            <p className="text-xs text-gray-400 text-center mt-2">
                First image is cover. Drag or upload multiple. Max {maxImages} images total.
            </p>
        </div>
    );
}
