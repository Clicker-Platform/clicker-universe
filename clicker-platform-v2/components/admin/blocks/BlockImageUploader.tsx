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

import { convertToWebP, validateImageFile } from '@/lib/imageUtils';
import { storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
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
            // Client-side WebP Conversion
            const webpBlob = await convertToWebP(file);
            const webpFile = new File([webpBlob], file.name.replace(/\.[^/.]+$/, "") + ".webp", { type: 'image/webp' });

            // Upload directly via Client SDK
            // Site-scoped path: sites/{siteId}/uploads/{timestamp}_{filename}
            const storagePath = siteId
                ? `sites/${siteId}/uploads/${Date.now()}_${file.name}`
                : `uploads/${Date.now()}_${file.name}`;
            const storageRef = ref(storage, storagePath);
            const snapshot = await uploadBytes(storageRef, webpFile, {
                contentType: 'image/webp'
            });
            const downloadURL = await getDownloadURL(snapshot.ref);

            onUpload(downloadURL);
        } catch (error) {
            console.error(error);
            alert("Failed to upload image");
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return (
        <div className="space-y-2">
            {label && <label className="block text-xs font-bold text-gray-500">{label}</label>}

            <div className="flex items-start gap-4">
                {/* Preview / Placeholder */}
                <div className="w-20 h-20 bg-gray-50 rounded-lg border border-gray-200 overflow-hidden flex-shrink-0 relative group">
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
                        <div className="w-full h-full flex items-center justify-center text-gray-300">
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
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-bold text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-brand-dark/20 disabled:opacity-50 transition-all"
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
                    <p className="text-[10px] text-gray-400 mt-2">
                        Max 5MB. Formats: PNG, JPG, WebP. Auto-converted to WebP.
                    </p>
                </div>
            </div>
        </div>
    );
};
