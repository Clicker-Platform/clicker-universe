'use client';

import React, { useRef, useState } from 'react';
import { Upload, X, Loader2, Image as ImageIcon, Check } from 'lucide-react';
import { convertToWebP, validateImageFile } from '@/lib/imageUtils';
import { uploadToStorage } from '@/lib/upload';
import { useSite } from '@/lib/site-context';

interface FormFileFieldProps {
    label: string;
    required?: boolean;
    onChange: (url: string) => void;
    value?: string;
}

export const FormFileField: React.FC<FormFileFieldProps> = ({ label, required, onChange, value }) => {
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { siteId } = useSite();

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setError(null);

        const validationError = validateImageFile(file);
        if (validationError) {
            setError(validationError);
            return;
        }

        setUploading(true);
        try {
            const webpBlob = await convertToWebP(file);
            const webpFile = new File([webpBlob], file.name.replace(/\.[^/.]+$/, "") + ".webp", { type: 'image/webp' });

            const { url } = await uploadToStorage({ file: webpFile, folder: 'form-uploads', siteId });
            onChange(url);
        } catch (err) {
            console.error('Upload Error:', err);
            setError('Failed to upload image. Please try again.');
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleRemove = () => {
        onChange('');
        setError(null);
    };

    return (
        <div className="space-y-2">
            <label className="block text-sm font-bold text-gray-700">
                {label} {required && <span className="text-red-500">*</span>}
            </label>

            {value ? (
                <div className="relative group rounded-xl overflow-hidden border-2 border-brand-green/30 bg-gray-50 max-w-[200px]">
                    <img src={value} alt="Uploaded" className="w-full h-32 object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <a href={value} target="_blank" rel="noreferrer" className="p-2 bg-white rounded-full text-brand-dark hover:scale-110 transition-transform">
                            <Check size={16} />
                        </a>
                        <button type="button" onClick={handleRemove} className="p-2 bg-red-500 rounded-full text-white hover:scale-110 transition-transform">
                            <X size={16} />
                        </button>
                    </div>
                    <div className="absolute top-2 right-2 bg-brand-green text-brand-dark text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                        UPLOADED
                    </div>
                </div>
            ) : (
                <div>
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
                        className={`
                            w-full px-4 py-4 rounded-xl border-2 border-dashed transition-all flex items-center justify-center gap-3
                            ${error ? 'border-red-300 bg-red-50 text-red-500' : 'border-gray-300 bg-gray-50 text-gray-500 hover:border-brand-dark hover:bg-white hover:text-brand-dark'}
                        `}
                    >
                        {uploading ? (
                            <>
                                <Loader2 size={20} className="animate-spin text-brand-dark" />
                                <span className="font-bold text-brand-dark">Optimizing & Uploading...</span>
                            </>
                        ) : (
                            <>
                                <Upload size={20} />
                                <span className="font-bold">Choose Image</span>
                            </>
                        )}
                    </button>
                    {error && <p className="text-xs text-red-500 mt-2 font-bold">{error}</p>}
                </div>
            )}
        </div>
    );
};
