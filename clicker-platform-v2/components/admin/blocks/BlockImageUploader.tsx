'use client';

import { useState, useRef } from 'react';
import { Loader2, Upload, X, Image as ImageIcon } from 'lucide-react';
import Image from 'next/image';
// import { toast } from 'sonner'; // Assuming sonner is used or use alert

interface BlockImageUploaderProps {
    label?: string;
    currentUrl?: string;
    onUpload: (url: string) => void;
    onRemove: () => void;
}

import { validateImageFile } from '@/lib/imageUtils';
import { uploadToStorage } from '@/lib/upload';
import { useSite } from '@/lib/site-context';

export const BlockImageUploader = ({ label = "Upload Image", currentUrl, onUpload, onRemove }: BlockImageUploaderProps) => {
    const { siteId } = useSite();
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const validationError = validateImageFile(file);
        if (validationError) {
            alert(validationError);
            return;
        }

        setUploading(true);
        try {
            const url = await uploadToStorage({ file, folder: 'uploads', siteId });
            onUpload(url);
        } catch (error) {
            console.error(error);
            alert("Failed to upload image");
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return (
        <div className="space-y-4">
            {label && <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider">{label}</label>}

            <div className="flex items-start gap-4 p-4 bg-neutral-900/50 rounded-2xl border border-neutral-800 shadow-sm">
                {/* Preview / Placeholder */}
                <div className="w-20 h-20 bg-neutral-800 rounded-xl border border-neutral-700 overflow-hidden flex-shrink-0 relative group shadow-inner">
                    {currentUrl ? (
                        <>
                            <Image
                                src={currentUrl}
                                alt="Preview"
                                fill
                                sizes="80px"
                                className="object-cover"
                            />
                            <button
                                type="button"
                                onClick={onRemove}
                                className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                            >
                                <X size={20} />
                            </button>
                        </>
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-neutral-700 bg-neutral-800/50">
                            <ImageIcon size={24} />
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="flex-1">
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept="image/*"
                        className="hidden"
                    />
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="flex items-center gap-2 px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-xl text-sm font-bold text-neutral-200 hover:bg-neutral-700 hover:border-neutral-600 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50 transition-all active:scale-[0.98] shadow-sm"
                    >
                        {uploading ? (
                            <>
                                <Loader2 size={16} className="animate-spin" /> Uploading...
                            </>
                        ) : (
                            <>
                                <Upload size={16} /> Choose Image
                            </>
                        )}
                    </button>
                    <p className="text-[10px] text-neutral-500 mt-3 font-medium flex items-center gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-neutral-700" />
                        Max 5MB. Converted to WebP/AVIF on upload.
                    </p>
                </div>
            </div>
        </div>
    );
};
