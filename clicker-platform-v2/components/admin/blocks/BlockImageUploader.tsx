'use client';

import { useState } from 'react';
import { Upload, X } from 'lucide-react';
import Image from 'next/image';
import { MediaPicker } from '@/components/admin/media/MediaPicker';

interface BlockImageUploaderProps {
    label?: string;
    currentUrl?: string;
    onUpload: (url: string) => void;
    onRemove: () => void;
}

export const BlockImageUploader = ({ label = "Upload Image", currentUrl, onUpload, onRemove }: BlockImageUploaderProps) => {
    const [pickerOpen, setPickerOpen] = useState(false);

    return (
        <div className="space-y-4">
            {label && <label className="block text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">{label}</label>}

            {!currentUrl ? (
                <button
                    type="button"
                    onClick={() => setPickerOpen(true)}
                    className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg border border-dashed border-gray-300 dark:border-neutral-700 bg-gray-50/50 dark:bg-neutral-900/30 hover:bg-gray-50 dark:hover:bg-neutral-900/50 transition-all text-neutral-600 dark:text-neutral-400 hover:text-blue-500 hover:border-blue-500/50 active:scale-[0.99] text-xs font-bold"
                >
                    <Upload size={14} />
                    Upload Image
                </button>
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
                        <button
                            type="button"
                            onClick={() => setPickerOpen(true)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded-md text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-700 transition-all active:scale-[0.98]"
                        >
                            <Upload size={14} /> Replace Image
                        </button>
                        <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-2 font-medium leading-tight">
                            Click image to remove.
                        </p>
                    </div>
                </div>
            )}

            <MediaPicker
                open={pickerOpen}
                onClose={() => setPickerOpen(false)}
                onSelect={({ url }) => { onUpload(url); setPickerOpen(false); }}
                accept="image"
            />
        </div>
    );
};
