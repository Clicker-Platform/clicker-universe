'use client';

import { useState, useRef } from 'react';
import { Upload, X, Loader2 } from 'lucide-react';

interface AvatarUploadProps {
    currentAvatarUrl?: string;
    onUploadComplete: (url: string) => void;
}

export function AvatarUpload({ currentAvatarUrl, onUploadComplete }: AvatarUploadProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) await ProcessUpload(file);
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) await ProcessUpload(file);
    };

    const ProcessUpload = async (file: File) => {
        setError('');

        if (!file.type.startsWith('image/')) {
            setError('Please upload an image file.');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            setError('File size must be less than 5MB.');
            return;
        }

        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch('/api/upload/avatar', {
                method: 'POST',
                body: formData,
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Upload failed');
            }

            onUploadComplete(data.url);
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Error uploading image');
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
                    flex flex-col items-center justify-center w-full h-48 
                    border-[3px] border-dashed rounded-xl cursor-pointer transition-colors
                    ${isDragging ? 'border-brand-dark bg-gray-50' : 'border-gray-300 hover:border-brand-dark hover:bg-gray-50'}
                    ${uploading ? 'opacity-50 pointer-events-none' : ''}
                `}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
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
                        <Loader2 className="animate-spin mb-2" size={32} />
                        <span className="font-bold">Uploading & Converting...</span>
                    </div>
                ) : (
                    <>
                        {currentAvatarUrl ? (
                            <div className="relative group w-full h-full flex items-center justify-center p-4">
                                <img
                                    src={currentAvatarUrl}
                                    alt="Current Avatar"
                                    className="w-32 h-32 rounded-full object-cover border-[3px] border-white shadow-md"
                                />
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl">
                                    <Upload size={32} className="text-brand-dark mb-2" />
                                    <span className="font-bold text-brand-dark">Change Avatar</span>
                                    <span className="text-sm text-gray-500">Max 5MB (WebP)</span>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center text-gray-500">
                                <Upload size={48} className="mb-3 text-gray-300" />
                                <span className="font-bold text-lg mb-1">Upload Avatar</span>
                                <span className="text-sm">Drag & drop or click to upload</span>
                                <span className="text-xs mt-2 text-gray-400">Max 5MB</span>
                            </div>
                        )}
                    </>
                )}
            </div>

            {error && (
                <div className="mt-3 text-sm text-red-600 font-bold flex items-center gap-2">
                    <X size={16} />
                    {error}
                </div>
            )}
        </div>
    );
}
