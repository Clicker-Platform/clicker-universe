'use client';

import { useState, useRef } from 'react';
import { Loader2, Upload, X, Image as ImageIcon } from 'lucide-react';
import Image from 'next/image';
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog';

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
    const [errorDialog, setErrorDialog] = useState<{ title: string; message: string } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const validationError = validateImageFile(file);
        if (validationError) {
            setErrorDialog({ title: 'Invalid File', message: validationError });
            return;
        }

        setUploading(true);
        try {
            const { url } = await uploadToStorage({ file, folder: 'uploads', siteId });
            onUpload(url);
        } catch (error) {
            console.error(error);
            setErrorDialog({ title: 'Upload Failed', message: 'Failed to upload image. Please try again.' });
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return (
        <div className="space-y-4">
            <ConfirmationDialog
                isOpen={!!errorDialog}
                title={errorDialog?.title ?? ''}
                message={errorDialog?.message}
                onConfirm={() => setErrorDialog(null)}
                onCancel={() => setErrorDialog(null)}
                confirmLabel="OK"
                cancelLabel="Cancel"
                isDestructive={false}
                hideFooter={false}
            />
            {label && <label className="block text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">{label}</label>}

            {!currentUrl ? (
                <div className="flex items-center gap-3">
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
                        className="flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg border border-dashed border-gray-300 dark:border-neutral-700 bg-gray-50/50 dark:bg-neutral-900/30 hover:bg-gray-50 dark:hover:bg-neutral-900/50 transition-all text-neutral-600 dark:text-neutral-400 hover:text-blue-500 hover:border-blue-500/50 active:scale-[0.99] text-xs font-bold"
                    >
                        {uploading ? (
                            <>
                                <Loader2 size={14} className="animate-spin text-blue-500" />
                                Uploading...
                            </>
                        ) : (
                            <>
                                <Upload size={14} />
                                Upload Image
                            </>
                        )}
                    </button>
                    <span className="text-[10px] font-medium text-neutral-400 opacity-80 whitespace-nowrap">
                        Max 10MB
                    </span>
                </div>
            ) : (
                <div className="flex items-start gap-4 p-3 bg-gray-50 dark:bg-neutral-900/50 rounded-lg border border-gray-200 dark:border-neutral-800">
                    {/* Preview / Placeholder */}
                    <div className="w-20 h-20 bg-gray-100 dark:bg-neutral-800 rounded-lg border border-gray-300 dark:border-neutral-700 overflow-hidden flex-shrink-0 relative group shadow-inner">
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
                    </div>

                    {/* Actions */}
                    <div className="flex-1 py-1">
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
                            className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded-md text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-700 transition-all active:scale-[0.98]"
                        >
                            {uploading ? (
                                <>
                                    <Loader2 size={14} className="animate-spin" /> Uploading...
                                </>
                            ) : (
                                <>
                                    <Upload size={14} /> Replace Image
                                </>
                            )}
                        </button>
                        <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-2 font-medium leading-tight">
                            Click image to remove.<br/>Max 10MB.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};
