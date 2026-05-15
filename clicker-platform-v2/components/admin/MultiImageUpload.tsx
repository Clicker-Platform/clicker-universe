'use client';

import { useState, useRef } from 'react';
import { Upload, X, Loader2 } from 'lucide-react';
import { uploadToStorage } from '@/lib/upload';
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

                if (file.size > 10 * 1024 * 1024) {
                    errors.push(`${file.name}: Max size 10MB`);
                    continue;
                }

                try {
                    const url = await uploadToStorage({ file, folder: 'products', siteId });
                    newImageUrls.push(url);
                } catch (err: unknown) {
                    console.error("Upload error details:", err);
                    errors.push(`${file.name}: ${err instanceof Error ? err.message : 'Upload failed'}`);
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
                        w-full border-2 border-dashed rounded-lg p-8 mb-6 flex flex-col items-center justify-center cursor-pointer transition-all duration-200
                        ${error ? 'border-red-300 bg-red-50 dark:border-red-900/50 dark:bg-red-900/20' : 'border-gray-300 dark:border-neutral-700 hover:border-brand-green dark:hover:border-brand-green hover:bg-brand-green/5 dark:hover:bg-brand-green/10'}
                        ${uploading ? 'opacity-50 pointer-events-none' : ''}
                    `}
                >
                    {uploading ? (
                        <div className="flex flex-col items-center gap-3">
                            <Loader2 className="animate-spin text-brand-dark dark:text-neutral-200" size={32} />
                            <p className="text-sm font-bold text-gray-500 dark:text-neutral-400">Uploading...</p>
                        </div>
                    ) : (
                        <>
                            <div className="bg-gray-100 dark:bg-neutral-800 p-4 rounded-full mb-3 group-hover:bg-white dark:group-hover:bg-neutral-700 group-hover:transition-all">
                                <Upload className="text-gray-400 dark:text-neutral-500 group-hover:text-brand-green transition-colors" size={24} />
                            </div>
                            <h3 className="text-brand-dark dark:text-neutral-200 font-bold text-base mb-1">Click to upload or drag and drop</h3>
                            <p className="text-gray-400 dark:text-neutral-500 text-sm mb-1">SVG, PNG, JPG or WEBP (max. 10MB)</p>
                            <p className="text-xs font-bold text-gray-300 dark:text-neutral-600">
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
                                relative aspect-square rounded-lg overflow-hidden border group
                                ${index === 0 ? 'border-gray-400 dark:border-neutral-500 ring-2 ring-gray-400 dark:ring-neutral-500 ring-offset-2 dark:ring-offset-neutral-900' : 'border-gray-200 dark:border-neutral-800'}
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
                                        className="text-[10px] bg-white dark:bg-neutral-800 text-brand-dark dark:text-neutral-200 font-bold px-2 py-1 rounded hover:bg-brand-green hover:text-white transition-colors w-full"
                                    >
                                        Set as Cover
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => removeImage(index)}
                                    className="bg-red-500 text-white p-1.5 rounded-full hover:bg-red-600 transition-colors"
                                    title="Remove Image"
                                >
                                    <X size={14} />
                                </button>
                            </div>

                            {index === 0 && (
                                <div className="absolute top-0 left-0 bg-brand-dark dark:bg-neutral-700 text-white text-[10px] uppercase font-bold px-2 py-1 rounded-br-lg z-10">
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

            <p className="text-xs text-gray-400 dark:text-neutral-500 text-center mt-2">
                First image is cover. Drag or upload multiple. Max {maxImages} images total.
            </p>
        </div>
    );
}
