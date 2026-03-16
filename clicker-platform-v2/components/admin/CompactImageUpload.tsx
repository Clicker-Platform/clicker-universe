'use client';

import { useState, useRef } from 'react';
import { Upload, X, Loader2, Image as ImageIcon } from 'lucide-react';
import { uploadToStorage } from '@/lib/upload';
import { useSite } from '@/lib/site-context';

interface CompactImageUploadProps {
    currentUrl?: string;
    onUpload: (url: string) => void;
    onRemove?: () => void;
    label?: string;
}

export function CompactImageUpload({ currentUrl, onUpload, onRemove, label = "Upload Image" }: CompactImageUploadProps) {
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { siteId } = useSite();

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

        try {
            const url = await uploadToStorage({ file, folder: 'assets', siteId });
            onUpload(url);
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
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                className="hidden"
                accept="image/png, image/jpeg, image/webp, image/x-icon, image/svg+xml"
            />

            {currentUrl ? (
                <div className="flex items-center gap-3 p-2 bg-gray-50 border border-gray-200 rounded-xl group hover:border-brand-dark transition-colors">
                    {/* Thumbnail */}
                    <div className="w-10 h-10 rounded-lg bg-white border border-gray-200 overflow-hidden flex-shrink-0 flex items-center justify-center">
                        <img src={currentUrl} alt="Preview" className="w-full h-full object-cover" />
                    </div>

                    {/* URL / Info */}
                    <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-500 truncate font-medium">{currentUrl.split('/').pop() || 'image.jpg'}</p>
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="text-[10px] text-blue-600 font-bold hover:underline"
                            disabled={uploading}
                        >
                            Change Image
                        </button>
                    </div>

                    {/* Remove Button */}
                    {onRemove && (
                        <button
                            type="button"
                            onClick={onRemove}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Remove Image"
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className={`
                        w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed border-gray-300
                        text-gray-500 font-bold hover:border-brand-dark hover:bg-gray-50 transition-all text-sm
                        ${uploading ? 'opacity-70 cursor-wait' : ''}
                    `}
                >
                    {uploading ? (
                        <>
                            <Loader2 size={18} className="animate-spin" />
                            <span>Uploading...</span>
                        </>
                    ) : (
                        <>
                            <Upload size={18} />
                            <span>{label}</span>
                        </>
                    )}
                </button>
            )}

            {error && (
                <p className="mt-1 text-xs text-red-600 font-bold">{error}</p>
            )}
        </div>
    );
}
