'use client';

import { useState, useRef } from 'react';
import { Upload, X, Loader2, Image as ImageIcon } from 'lucide-react';

interface ProductImageUploadProps {
    currentImageUrl?: string;
    onUpload: (url: string) => void;
    onRemove?: () => void;
}

export function ProductImageUpload({ currentImageUrl, onUpload, onRemove }: ProductImageUploadProps) {
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) await ProcessUpload(file);
    };

    const ProcessUpload = async (file: File) => {
        setError('');

        if (!file.type.startsWith('image/')) {
            setError('Image files only.');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            setError('Max size 5MB.');
            return;
        }

        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch('/api/upload/image?folder=products', {
                method: 'POST',
                body: formData,
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Upload failed');
            }

            onUpload(data.url);
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Error uploading');
        } finally {
            setUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    return (
        <div className="w-full">
            <div
                className={`
                    relative w-full h-40 bg-gray-50 rounded-xl border-2 border-dashed
                    flex flex-col items-center justify-center cursor-pointer overflow-hidden group transition-all
                    ${error ? 'border-red-300 bg-red-50' : 'border-gray-300 hover:border-brand-dark hover:bg-white'}
                    ${uploading ? 'opacity-70 pointer-events-none' : ''}
                `}
                onClick={() => !uploading && fileInputRef.current?.click()}
            >
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    className="hidden"
                    accept="image/png, image/jpeg, image/webp"
                />

                {uploading ? (
                    <div className="flex flex-col items-center text-gray-500">
                        <Loader2 className="animate-spin mb-2" size={24} />
                        <span className="text-xs font-bold">Uploading...</span>
                    </div>
                ) : currentImageUrl ? (
                    <>
                        <img
                            src={currentImageUrl}
                            alt="Product"
                            className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center flex-col text-white">
                            <Upload size={24} className="mb-1" />
                            <span className="text-xs font-bold">Change Image</span>
                        </div>
                        {onRemove && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onRemove();
                                }}
                                className="absolute top-2 right-2 p-1 bg-white text-red-500 rounded-md shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50"
                                title="Remove Image"
                            >
                                <X size={16} />
                            </button>
                        )}
                    </>
                ) : (
                    <div className="flex flex-col items-center text-gray-400 p-4 text-center">
                        <ImageIcon size={32} className="mb-2" />
                        <span className="text-xs font-bold text-gray-500">Upload Image</span>
                        <span className="text-[10px] mt-1">Max 5MB (WebP)</span>
                    </div>
                )}
            </div>
            {error && (
                <div className="mt-1 text-xs text-red-600 font-bold">
                    {error}
                </div>
            )}
        </div>
    );
}
